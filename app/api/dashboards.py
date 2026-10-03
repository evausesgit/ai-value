"""Tableaux de bord : collaborateur, équipe (lead), organisation (management).

Deux temporalités :
- **état actuel**, calculé en direct sur ce que chacun a déclaré (outils,
  auto-évaluation, use cases, quiz) — modifiable à tout moment ;
- **évolution**, un point par campagne de mise à jour (photo de l'état de
  chaque répondant à l'envoi, cf. app/api/campaigns.py).

Définitions (reprises dans l'interface) :
- **adoption** = part des membres déclarant au moins un outil IA utilisé chaque
  jour ou chaque semaine ;
- **temps gagné** = minutes/semaine des use cases, pour l'auteur et chacun de
  ses adoptants ;
- **participation** = répondants / personnes visées par la campagne.
Satisfaction, freins et verbatims sont masqués sous `min_group_size` répondants.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.campaigns import in_scope, is_open
from app.campaign_stats import summarize
from app.catalog import ACTIVE_FREQUENCIES, DOMAINS
from app.db import get_session
from app.deps import can_see_team, current_user, has_role, require_role
from app.models import (
    Campaign,
    CampaignParticipant,
    Feedback,
    QuizAttempt,
    SkillAssessment,
    Team,
    Tool,
    ToolUsage,
    UseCase,
    UseCaseReaction,
    User,
)

router = APIRouter(prefix="/dashboard", tags=["dashboards"])


def _pct(num: int, den: int) -> float | None:
    return round(100 * num / den, 1) if den else None


def _avg(values: list[float], digits: int = 2) -> float | None:
    return round(mean(values), digits) if values else None


def _best_quiz_pct(session: Session, user_ids: list[int]) -> dict[int, float]:
    """Moyenne, par utilisateur, de son meilleur score (%) à chaque quiz tenté."""
    if not user_ids:
        return {}
    rows = session.execute(
        select(
            QuizAttempt.user_id,
            QuizAttempt.quiz_id,
            func.max(QuizAttempt.score * 100.0 / QuizAttempt.total),
        )
        .where(QuizAttempt.user_id.in_(user_ids))
        .group_by(QuizAttempt.user_id, QuizAttempt.quiz_id)
    )
    per_user: dict[int, list[float]] = defaultdict(list)
    for uid, _qid, pct in rows:
        per_user[uid].append(float(pct))
    return {uid: mean(v) for uid, v in per_user.items()}


def _evolution(
    session: Session, org_id: int, team_id: int | None
) -> list[tuple[Campaign, list[CampaignParticipant]]]:
    """Campagnes de l'org (ordre chronologique) avec leurs participants du périmètre."""
    campaigns = (
        session.scalars(
            select(Campaign).where(Campaign.org_id == org_id).order_by(Campaign.opens_at)
        )
        .unique()
        .all()
    )
    if not campaigns:
        return []
    stmt = select(CampaignParticipant).where(
        CampaignParticipant.campaign_id.in_([c.id for c in campaigns])
    )
    if team_id is not None:
        stmt = stmt.where(CampaignParticipant.team_id == team_id)
    by_campaign: dict[int, list[CampaignParticipant]] = defaultdict(list)
    for p in session.scalars(stmt):
        by_campaign[p.campaign_id].append(p)
    return [(c, by_campaign[c.id]) for c in campaigns if by_campaign[c.id]]


def _scope_stats(session: Session, org_id: int, members: list[User], team_id: int | None) -> dict:
    ids = [u.id for u in members]
    n = len(members)

    # --- Adoption déclarative (outils, état actuel) ---
    usages = (
        session.scalars(select(ToolUsage).where(ToolUsage.user_id.in_(ids))).all() if ids else []
    )
    active_users = {u.user_id for u in usages if u.frequency in ACTIVE_FREQUENCIES}
    any_users = {u.user_id for u in usages}
    tools = {t.id: t.name for t in session.scalars(select(Tool).where(Tool.org_id == org_id))}
    by_tool: dict[str, Counter] = defaultdict(Counter)
    for u in usages:
        if u.tool_id in tools:
            by_tool[tools[u.tool_id]][u.frequency] += 1
    tool_rows = sorted(
        (
            {
                "tool": name,
                "daily": c["daily"],
                "weekly": c["weekly"],
                "monthly": c["monthly"],
                "tried": c["tried"],
                "active": c["daily"] + c["weekly"],
            }
            for name, c in by_tool.items()
        ),
        key=lambda r: (r["active"], r["daily"]),
        reverse=True,
    )

    # --- Connaissances (état actuel) ---
    skills = (
        session.scalars(select(SkillAssessment).where(SkillAssessment.user_id.in_(ids))).all()
        if ids
        else []
    )
    by_domain: dict[str, list[int]] = defaultdict(list)
    for s in skills:
        by_domain[s.domain].append(s.level)
    skills_out = [
        {
            "domain": d,
            "avg": _avg(by_domain.get(d, [])),
            "n": len(by_domain.get(d, [])),
            "dist": [by_domain.get(d, []).count(lv) for lv in range(4)],
        }
        for d in DOMAINS
    ]
    all_levels = [s.level for s in skills]
    quiz = _best_quiz_pct(session, ids)

    # --- Use cases et temps gagné (état actuel) ---
    ucs = (
        session.scalars(select(UseCase).where(UseCase.author_id.in_(ids))).unique().all()
        if ids
        else []
    )
    adopters = (
        dict(
            session.execute(
                select(UseCaseReaction.use_case_id, func.count())
                .where(
                    UseCaseReaction.use_case_id.in_([u.id for u in ucs]),
                    UseCaseReaction.kind == "adopt",
                )
                .group_by(UseCaseReaction.use_case_id)
            ).all()
        )
        if ucs
        else {}
    )
    month_ago = datetime.now(UTC) - timedelta(days=30)

    def _recent(uc: UseCase) -> bool:
        ts = uc.created_at
        return ts is not None and (ts if ts.tzinfo else ts.replace(tzinfo=UTC)) >= month_ago

    top = sorted(ucs, key=lambda uc: adopters.get(uc.id, 0), reverse=True)[:5]

    # --- Évolution : un point par campagne ---
    evolution = []
    for c, ps in _evolution(session, org_id, team_id):
        s = summarize(ps)
        evolution.append(
            {
                "id": c.id,
                "title": c.title,
                "date": c.opens_at.date().isoformat(),
                "open": is_open(c),
                **{
                    k: s[k]
                    for k in (
                        "targeted",
                        "respondents",
                        "participation",
                        "adoption_pct",
                        "skills_avg",
                        "hours_saved",
                        "hours_saved_avg",
                        "satisfaction",
                    )
                },
            }
        )
    # Ressenti : la dernière campagne close qui en a collecté (sinon celle en cours).
    feeling = None
    evo_ps = _evolution(session, org_id, team_id)
    ordered = [x for x in reversed(evo_ps) if not is_open(x[0])] + [
        x for x in reversed(evo_ps) if is_open(x[0])
    ]
    for c, ps in ordered:
        s = summarize(ps, with_comments=True)
        if s["checkin_respondents"]:
            feeling = {
                "campaign": c.title,
                "date": c.opens_at.date().isoformat(),
                "respondents": s["checkin_respondents"],
                "satisfaction": s["satisfaction"],
                "usage_level": s["usage_level"],
                "blockers": s["blockers"],
                "comments": (s["comments"] or [])[:8] if s["comments"] is not None else None,
            }
            break

    return {
        "members": n,
        "adoption": {
            "active_pct": _pct(len(active_users), n),
            "explorers_pct": _pct(len(any_users), n),
            "active": len(active_users),
            "tools": tool_rows,
        },
        "skills": {
            "domains": skills_out,
            "avg": _avg(all_levels),
            "assessed_pct": _pct(len({s.user_id for s in skills}), n),
            "quiz_avg_pct": _avg(list(quiz.values()), 1),
            "quiz_participants": len(quiz),
        },
        "usecases": {
            "count": len(ucs),
            "validated": sum(1 for uc in ucs if uc.status == "validated"),
            "last_30_days": sum(1 for uc in ucs if _recent(uc)),
            "contributors": len({uc.author_id for uc in ucs}),
            "hours_saved_per_week": round(
                sum(uc.minutes_saved_per_week * (1 + adopters.get(uc.id, 0)) for uc in ucs) / 60,
                1,
            ),
            "top": [
                {
                    "id": uc.id,
                    "title": uc.title,
                    "category": uc.category,
                    "adopters": adopters.get(uc.id, 0),
                    "author": uc.author.name if uc.author else None,
                }
                for uc in top
            ],
        },
        "evolution": evolution,
        "feeling": feeling,
    }


def _members(session: Session, org_id: int, team_id: int | None = None) -> list[User]:
    stmt = select(User).where(User.org_id == org_id, User.active)
    if team_id is not None:
        stmt = stmt.where(User.team_id == team_id)
    return list(session.scalars(stmt).unique())


def _feedback_counts(session: Session, org_id: int, team_id: int | None = None) -> dict:
    stmt = select(Feedback.status, Feedback.kind, func.count()).where(Feedback.org_id == org_id)
    if team_id is not None:
        stmt = stmt.where(Feedback.team_id == team_id)
    by_status: Counter = Counter()
    by_kind: Counter = Counter()
    for status, kind, c in session.execute(stmt.group_by(Feedback.status, Feedback.kind)):
        by_status[status] += c
        by_kind[kind] += c
    return {"by_status": dict(by_status), "by_kind": dict(by_kind)}


def _org_teams(session: Session, org_id: int) -> list[Team]:
    return list(session.scalars(select(Team).where(Team.org_id == org_id).order_by(Team.name)))


@router.get("/team")
def team_dashboard(
    team_id: int | None = None,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    team_id = team_id or user.team_id
    team = session.get(Team, team_id) if team_id else None
    if team is None or team.org_id != user.org_id or not can_see_team(user, team.id):
        raise HTTPException(404, "Équipe introuvable.")
    members = _members(session, user.org_id, team.id)
    stats = _scope_stats(session, user.org_id, members, team.id)

    # Tableau des membres : activité seulement, jamais les réponses au ressenti.
    ids = [m.id for m in members]
    active_tools = (
        Counter(
            session.scalars(
                select(ToolUsage.user_id).where(
                    ToolUsage.user_id.in_(ids), ToolUsage.frequency.in_(ACTIVE_FREQUENCIES)
                )
            ).all()
        )
        if ids
        else Counter()
    )
    uc_counts = (
        Counter(session.scalars(select(UseCase.author_id).where(UseCase.author_id.in_(ids))).all())
        if ids
        else Counter()
    )
    assessed = (
        set(
            session.scalars(select(SkillAssessment.user_id).where(SkillAssessment.user_id.in_(ids)))
        )
        if ids
        else set()
    )
    answered = (
        Counter(
            session.scalars(
                select(CampaignParticipant.user_id).where(
                    CampaignParticipant.user_id.in_(ids),
                    CampaignParticipant.completed_at.is_not(None),
                )
            ).all()
        )
        if ids
        else Counter()
    )
    quiz = _best_quiz_pct(session, ids)
    stats["roster"] = sorted(
        (
            {
                "id": m.id,
                "name": m.name or m.email,
                "job": m.job,
                "role": m.role,
                "campaigns": answered.get(m.id, 0),
                "assessed": m.id in assessed,
                "active_tools": active_tools.get(m.id, 0),
                "usecases": uc_counts.get(m.id, 0),
                "quiz_pct": round(quiz[m.id], 0) if m.id in quiz else None,
            }
            for m in members
        ),
        key=lambda r: r["name"].lower(),
    )
    stats["team"] = {"id": team.id, "name": team.name}
    stats["feedback"] = _feedback_counts(session, user.org_id, team.id)
    stats["teams"] = (
        [{"id": t.id, "name": t.name} for t in _org_teams(session, user.org_id)]
        if has_role(user, "manager")
        else [{"id": team.id, "name": team.name}]
    )
    return stats


@router.get("/org")
def org_dashboard(
    user: User = Depends(require_role("manager")), session: Session = Depends(get_session)
):
    members = _members(session, user.org_id)
    stats = _scope_stats(session, user.org_id, members, None)
    stats["org"] = {"id": user.org.id, "name": user.org.name}
    stats["feedback"] = _feedback_counts(session, user.org_id)

    rows = []
    heat = []
    for team in _org_teams(session, user.org_id):
        tm = [m for m in members if m.team_id == team.id]
        if not tm:
            continue
        s = _scope_stats(session, user.org_id, tm, team.id)
        # Dernière campagne close (une campagne en cours sous-estime la participation).
        closed = [e for e in s["evolution"] if not e["open"]]
        last = closed[-1] if closed else None
        rows.append(
            {
                "id": team.id,
                "name": team.name,
                "members": s["members"],
                "adoption_pct": s["adoption"]["active_pct"],
                "skills_avg": s["skills"]["avg"],
                "quiz_avg_pct": s["skills"]["quiz_avg_pct"],
                "usecases": s["usecases"]["count"],
                "hours_saved": s["usecases"]["hours_saved_per_week"],
                "participation": last["participation"] if last else None,
                "satisfaction": last["satisfaction"] if last else None,
                "adoption_trend": [e["adoption_pct"] for e in s["evolution"]],
            }
        )
        heat.append(
            {
                "team": team.name,
                "values": [{"avg": d["avg"], "n": d["n"]} for d in s["skills"]["domains"]],
            }
        )
    stats["teams"] = rows
    stats["skills_heatmap"] = {"domains": DOMAINS, "rows": heat}
    return stats


@router.get("/me")
def me_dashboard(user: User = Depends(current_user), session: Session = Depends(get_session)):
    usages = session.scalars(select(ToolUsage).where(ToolUsage.user_id == user.id)).all()
    skills = {
        s.domain: s.level
        for s in session.scalars(select(SkillAssessment).where(SkillAssessment.user_id == user.id))
    }
    org_skill = dict(
        session.execute(
            select(SkillAssessment.domain, func.avg(SkillAssessment.level))
            .join(User, User.id == SkillAssessment.user_id)
            .where(User.org_id == user.org_id)
            .group_by(SkillAssessment.domain)
        ).all()
    )
    my_ucs = session.scalars(select(UseCase).where(UseCase.author_id == user.id)).unique().all()
    adopters = (
        session.scalar(
            select(func.count()).where(
                UseCaseReaction.use_case_id.in_([u.id for u in my_ucs]),
                UseCaseReaction.kind == "adopt",
            )
        )
        if my_ucs
        else 0
    )
    adopted_minutes = session.scalars(
        select(UseCase.minutes_saved_per_week)
        .join(UseCaseReaction, UseCaseReaction.use_case_id == UseCase.id)
        .where(
            UseCaseReaction.user_id == user.id,
            UseCaseReaction.kind == "adopt",
            UseCase.author_id != user.id,
        )
    ).all()
    quiz = _best_quiz_pct(session, [user.id]).get(user.id)
    quizzes_done = session.scalar(
        select(func.count(func.distinct(QuizAttempt.quiz_id))).where(QuizAttempt.user_id == user.id)
    )

    # Demandes de mise à jour en attente (campagnes ouvertes non envoyées).
    pending = 0
    for c in session.scalars(select(Campaign).where(Campaign.org_id == user.org_id)).unique():
        if not (is_open(c) and in_scope(c, user)):
            continue
        done = session.scalar(
            select(CampaignParticipant.completed_at).where(
                CampaignParticipant.campaign_id == c.id, CampaignParticipant.user_id == user.id
            )
        )
        pending += done is None

    todo = [
        {"key": "tools", "done": bool(usages), "label": "Déclarer les outils IA que tu utilises"},
        {"key": "skills", "done": len(skills) == len(DOMAINS), "label": "T'auto-évaluer"},
        {"key": "usecase", "done": bool(my_ucs), "label": "Partager un use case"},
        {"key": "quiz", "done": bool(quizzes_done), "label": "Faire un premier quiz"},
    ]
    return {
        "pending_campaigns": pending,
        "tools": {
            "active": sum(1 for u in usages if u.frequency in ACTIVE_FREQUENCIES),
            "declared": len(usages),
        },
        "skills": [
            {
                "domain": d,
                "mine": skills.get(d),
                "org_avg": round(float(org_skill[d]), 2) if d in org_skill else None,
            }
            for d in DOMAINS
        ],
        "quiz_avg_pct": round(quiz, 0) if quiz is not None else None,
        "quizzes_done": quizzes_done,
        "usecases": {
            "count": len(my_ucs),
            "adopters": adopters,
            "adopted": len(adopted_minutes),
            "minutes_saved": sum(u.minutes_saved_per_week for u in my_ucs) + sum(adopted_minutes),
        },
        "todo": todo,
    }
