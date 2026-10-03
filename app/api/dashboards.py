"""Tableaux de bord : collaborateur, équipe (lead), organisation (management).

Définitions (reprises telles quelles dans l'interface) :
- **adoption** = part des membres actifs qui déclarent au moins un outil IA
  utilisé chaque jour ou chaque semaine ;
- **participation** = part des membres ayant répondu au pulse de la semaine ;
- **intensité** = niveau d'usage moyen déclaré au pulse (0 à 4) ;
- **temps gagné** = somme des heures déclarées au pulse de la semaine.
Satisfaction, freins et temps gagné sont masqués quand moins de
`min_group_size` personnes ont répondu : un lead ne peut pas déduire une réponse
individuelle.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalog import ACTIVE_FREQUENCIES, DOMAINS
from app.config import settings
from app.db import get_session
from app.deps import can_see_team, current_user, has_role, require_role
from app.models import (
    Feedback,
    Pulse,
    QuizAttempt,
    SkillAssessment,
    Team,
    Tool,
    ToolUsage,
    UseCase,
    UseCaseReaction,
    User,
)
from app.weeks import current_week, last_weeks

router = APIRouter(prefix="/dashboard", tags=["dashboards"])

N_WEEKS = 12


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


def _scope_stats(session: Session, org_id: int, members: list[User], pulses: list[Pulse]) -> dict:
    """Indicateurs communs à une équipe et à l'organisation."""
    ids = [u.id for u in members]
    n = len(members)
    k = settings.min_group_size

    # --- Adoption déclarative (outils) ---
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

    # --- Pulse : série hebdomadaire ---
    by_week: dict = defaultdict(list)
    for p in pulses:
        by_week[p.week].append(p)
    trend = []
    for w in last_weeks(N_WEEKS):
        ps = by_week.get(w, [])
        enough = len(ps) >= k
        trend.append(
            {
                "week": w.isoformat(),
                "respondents": len(ps),
                "participation": _pct(len(ps), n),
                "intensity": _avg([p.usage_level for p in ps]),
                "using_pct": _pct(sum(1 for p in ps if p.usage_level >= 2), len(ps)),
                "satisfaction": _avg([p.satisfaction for p in ps]) if enough else None,
                "hours_saved": round(sum(p.hours_saved for p in ps), 1) if enough else None,
            }
        )

    # Semaine de référence : la courante si elle a déjà assez de réponses, sinon la précédente.
    cur, prev = trend[-1], trend[-2]
    ref = cur if cur["respondents"] >= max(k, n // 3) else prev

    since = current_week() - timedelta(weeks=4)
    recent = [p for p in pulses if p.week > since]
    blockers = Counter(b for p in recent for b in (p.blockers or []))
    blockers_out = (
        [{"blocker": b, "count": c} for b, c in blockers.most_common()]
        if len({p.user_id for p in recent}) >= k
        else None
    )
    comments = (
        [
            {"week": p.week.isoformat(), "text": p.comment}
            for p in sorted(recent, key=lambda p: p.week, reverse=True)
            if p.comment
        ][:12]
        if len({p.user_id for p in recent}) >= k
        else None
    )

    # --- Connaissances ---
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
    quiz = _best_quiz_pct(session, ids)

    # --- Use cases ---
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

    return {
        "members": n,
        "adoption": {
            "active_pct": _pct(len(active_users), n),
            "explorers_pct": _pct(len(any_users), n),
            "active": len(active_users),
            "tools": tool_rows,
        },
        "pulse": {
            "reference_week": ref["week"],
            "participation": ref["participation"],
            "intensity": ref["intensity"],
            "using_pct": ref["using_pct"],
            "satisfaction": ref["satisfaction"],
            "hours_saved": ref["hours_saved"],
            "trend": trend,
            "blockers": blockers_out,
            "comments": comments,
        },
        "skills": {
            "domains": skills_out,
            "assessed_pct": _pct(len({s.user_id for s in skills}), n),
            "quiz_avg_pct": _avg(list(quiz.values()), 1),
            "quiz_participants": len(quiz),
        },
        "usecases": {
            "count": len(ucs),
            "validated": sum(1 for uc in ucs if uc.status == "validated"),
            "last_30_days": sum(1 for uc in ucs if _recent(uc)),
            "contributors": len({uc.author_id for uc in ucs}),
            # Heures/semaine : gain déclaré × (auteur + adoptants).
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
    }


def _members(session: Session, org_id: int, team_id: int | None = None) -> list[User]:
    stmt = select(User).where(User.org_id == org_id, User.active)
    if team_id is not None:
        stmt = stmt.where(User.team_id == team_id)
    return list(session.scalars(stmt).unique())


def _pulses(session: Session, org_id: int, team_id: int | None = None) -> list[Pulse]:
    since = last_weeks(N_WEEKS)[0]
    stmt = select(Pulse).where(Pulse.org_id == org_id, Pulse.week >= since)
    if team_id is not None:
        stmt = stmt.where(Pulse.team_id == team_id)
    return list(session.scalars(stmt))


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
    stats = _scope_stats(session, user.org_id, members, _pulses(session, user.org_id, team.id))

    # Tableau des membres : activité seulement, jamais les réponses individuelles au pulse.
    ids = [m.id for m in members]
    since = current_week() - timedelta(weeks=4)
    pulse_counts = (
        Counter(
            session.scalars(
                select(Pulse.user_id).where(Pulse.user_id.in_(ids), Pulse.week > since)
            ).all()
        )
        if ids
        else Counter()
    )
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
    quiz = _best_quiz_pct(session, ids)
    stats["roster"] = sorted(
        (
            {
                "id": m.id,
                "name": m.name or m.email,
                "job": m.job,
                "role": m.role,
                "pulses_4w": pulse_counts.get(m.id, 0),
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


def _org_teams(session: Session, org_id: int) -> list[Team]:
    return list(session.scalars(select(Team).where(Team.org_id == org_id).order_by(Team.name)))


@router.get("/org")
def org_dashboard(
    user: User = Depends(require_role("manager")), session: Session = Depends(get_session)
):
    members = _members(session, user.org_id)
    pulses = _pulses(session, user.org_id)
    stats = _scope_stats(session, user.org_id, members, pulses)
    stats["org"] = {"id": user.org.id, "name": user.org.name}
    stats["feedback"] = _feedback_counts(session, user.org_id)

    # Comparaison par équipe (mêmes définitions, calculées équipe par équipe).
    rows = []
    heat = []
    for team in _org_teams(session, user.org_id):
        tm = [m for m in members if m.team_id == team.id]
        if not tm:
            continue
        s = _scope_stats(session, user.org_id, tm, [p for p in pulses if p.team_id == team.id])
        rows.append(
            {
                "id": team.id,
                "name": team.name,
                "members": s["members"],
                "adoption_pct": s["adoption"]["active_pct"],
                "participation": s["pulse"]["participation"],
                "intensity": s["pulse"]["intensity"],
                "satisfaction": s["pulse"]["satisfaction"],
                "hours_saved": s["pulse"]["hours_saved"],
                "usecases": s["usecases"]["count"],
                "quiz_avg_pct": s["skills"]["quiz_avg_pct"],
                "adoption_trend": [w["using_pct"] for w in s["pulse"]["trend"]],
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
    week = current_week()
    my_weeks = set(session.scalars(select(Pulse.week).where(Pulse.user_id == user.id)))
    streak, w = 0, week if week in my_weeks else week - timedelta(weeks=1)
    while w in my_weeks:
        streak += 1
        w -= timedelta(weeks=1)

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
    quiz = _best_quiz_pct(session, [user.id]).get(user.id)
    quizzes_done = session.scalar(
        select(func.count(func.distinct(QuizAttempt.quiz_id))).where(QuizAttempt.user_id == user.id)
    )

    todo = [
        {"key": "pulse", "done": week in my_weeks, "label": "Répondre au pulse de la semaine"},
        {"key": "tools", "done": bool(usages), "label": "Déclarer les outils IA que tu utilises"},
        {"key": "skills", "done": len(skills) == len(DOMAINS), "label": "T'auto-évaluer"},
        {"key": "quiz", "done": bool(quizzes_done), "label": "Faire un premier quiz"},
        {"key": "usecase", "done": bool(my_ucs), "label": "Partager un use case"},
    ]
    return {
        "week": week.isoformat(),
        "pulse_done": week in my_weeks,
        "streak": streak,
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
        "usecases": {"count": len(my_ucs), "adopters": adopters},
        "todo": todo,
    }
