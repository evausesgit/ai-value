"""Campagnes de mise à jour : le lead ou le management demande, chacun met à jour.

Le demandeur n'a rien à saisir : il lance, suit la participation, lit les
résultats. Le collaborateur met à jour ce qui est demandé (outils,
auto-évaluation, use cases, ressenti) puis envoie ; on photographie alors son
état. En dehors des campagnes, tout reste modifiable librement.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.campaign_stats import summarize
from app.catalog import ACTIVE_FREQUENCIES, BLOCKERS, CAMPAIGN_ITEMS
from app.db import get_session
from app.deps import current_user, has_role, require_role
from app.models import (
    Campaign,
    CampaignParticipant,
    SkillAssessment,
    Team,
    Tool,
    ToolUsage,
    UseCase,
    UseCaseReaction,
    User,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _today() -> date:
    return datetime.now(UTC).date()


def is_open(c: Campaign) -> bool:
    return not c.closed and _today() <= c.closes_on


def in_scope(c: Campaign, user: User) -> bool:
    return user.org_id == c.org_id and (not c.team_ids or user.team_id in c.team_ids)


def _visible_to_lead(c: Campaign, user: User) -> bool:
    """Le management voit toutes les campagnes ; un lead, celles qui touchent son équipe."""
    if c.org_id != user.org_id:
        return False
    if has_role(user, "manager"):
        return True
    return has_role(user, "lead") and (
        c.created_by == user.id or not c.team_ids or user.team_id in c.team_ids
    )


def _get(session: Session, campaign_id: int, user: User) -> Campaign:
    c = session.get(Campaign, campaign_id)
    if c is None or c.org_id != user.org_id:
        raise HTTPException(404, "Campagne introuvable.")
    return c


def _participant(
    session: Session, c: Campaign, user: User, create: bool
) -> CampaignParticipant | None:
    p = session.scalar(
        select(CampaignParticipant).where(
            CampaignParticipant.campaign_id == c.id, CampaignParticipant.user_id == user.id
        )
    )
    # Arrivé après le lancement : on l'ajoute tant que la campagne est ouverte.
    if p is None and create and is_open(c) and in_scope(c, user):
        p = CampaignParticipant(campaign_id=c.id, user_id=user.id, team_id=user.team_id)
        session.add(p)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            return _participant(session, c, user, create=False)
    return p


def take_snapshot(session: Session, p: CampaignParticipant, user: User) -> None:
    """Photographie l'état déclaré de `user` dans `p` (outils, compétences, use cases)."""
    tools = {
        name: freq
        for name, freq in session.execute(
            select(Tool.name, ToolUsage.frequency)
            .join(Tool, Tool.id == ToolUsage.tool_id)
            .where(ToolUsage.user_id == user.id)
        )
    }
    p.tools = tools
    p.active_tools = sum(1 for f in tools.values() if f in ACTIVE_FREQUENCIES)
    p.skills = {
        s.domain: s.level
        for s in session.scalars(select(SkillAssessment).where(SkillAssessment.user_id == user.id))
    }
    own = session.scalars(
        select(UseCase.minutes_saved_per_week).where(UseCase.author_id == user.id)
    ).all()
    adopted = session.scalars(
        select(UseCase.minutes_saved_per_week)
        .join(UseCaseReaction, UseCaseReaction.use_case_id == UseCase.id)
        .where(
            UseCaseReaction.user_id == user.id,
            UseCaseReaction.kind == "adopt",
            UseCase.author_id != user.id,
        )
    ).all()
    p.usecases = len(own)
    p.adopted = len(adopted)
    p.minutes_saved = sum(own) + sum(adopted)
    p.team_id = user.team_id
    p.completed_at = datetime.now(UTC)


def _campaign_out(c: Campaign) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "message": c.message,
        "team_ids": c.team_ids,
        "items": c.items,
        "opens_at": c.opens_at.isoformat() if c.opens_at else None,
        "closes_on": c.closes_on.isoformat(),
        "open": is_open(c),
        "author": c.author.name if c.author else None,
    }


def _me_out(p: CampaignParticipant | None) -> dict | None:
    if p is None:
        return None
    return {
        "done_items": p.done_items,
        "completed_at": p.completed_at.isoformat() if p.completed_at else None,
        "usage_level": p.usage_level,
        "satisfaction": p.satisfaction,
        "blockers": p.blockers,
        "comment": p.comment,
    }


# --- Côté collaborateur -----------------------------------------------------------


@router.get("/mine")
def my_campaigns(user: User = Depends(current_user), session: Session = Depends(get_session)):
    """Campagnes ouvertes qui me concernent, puis celles auxquelles j'ai répondu."""
    campaigns = session.scalars(
        select(Campaign).where(Campaign.org_id == user.org_id).order_by(Campaign.opens_at.desc())
    ).unique()
    out = []
    for c in campaigns:
        p = _participant(session, c, user, create=True)
        if p is None:
            continue
        if is_open(c) or p.completed_at is not None:
            out.append(_campaign_out(c) | {"me": _me_out(p)})
    return out[:10]


@router.get("/{campaign_id}/me")
def my_participation(
    campaign_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    c = _get(session, campaign_id, user)
    p = _participant(session, c, user, create=True)
    if p is None:
        raise HTTPException(404, "Cette campagne ne te concerne pas.")
    return _campaign_out(c) | {"me": _me_out(p)}


class CheckinIn(BaseModel):
    usage_level: int = Field(ge=0, le=4)
    satisfaction: int = Field(ge=1, le=5)
    blockers: list[str] = []
    comment: str = Field(default="", max_length=2000)


class ParticipationIn(BaseModel):
    done_items: list[str] | None = None
    checkin: CheckinIn | None = None


def _open_participant(
    session: Session, campaign_id: int, user: User
) -> tuple[Campaign, CampaignParticipant]:
    c = _get(session, campaign_id, user)
    if not is_open(c):
        raise HTTPException(400, "Cette campagne est close.")
    p = _participant(session, c, user, create=True)
    if p is None:
        raise HTTPException(404, "Cette campagne ne te concerne pas.")
    return c, p


@router.put("/{campaign_id}/me")
def update_participation(
    campaign_id: int,
    body: ParticipationIn,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    c, p = _open_participant(session, campaign_id, user)
    done = set(p.done_items or [])
    if body.done_items is not None:
        # « checkin » ne se coche pas : il est fait quand le ressenti est envoyé.
        done = {i for i in body.done_items if i in c.items and i != "checkin"} | (
            {"checkin"} & done
        )
    if body.checkin is not None:
        if "checkin" not in c.items:
            raise HTTPException(400, "Cette campagne ne demande pas de ressenti.")
        unknown = set(body.checkin.blockers) - set(BLOCKERS)
        if unknown:
            raise HTTPException(400, f"Frein inconnu : {', '.join(sorted(unknown))}")
        p.usage_level = body.checkin.usage_level
        p.satisfaction = body.checkin.satisfaction
        p.blockers = sorted(set(body.checkin.blockers))
        p.comment = body.checkin.comment.strip()
        done.add("checkin")
    p.done_items = sorted(done)
    session.commit()
    return _campaign_out(c) | {"me": _me_out(p)}


@router.post("/{campaign_id}/me/submit")
def submit_participation(
    campaign_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    c, p = _open_participant(session, campaign_id, user)
    missing = [i for i in c.items if i not in (p.done_items or [])]
    if missing:
        raise HTTPException(400, "Il reste des étapes à valider avant d'envoyer.")
    take_snapshot(session, p, user)
    session.commit()
    return _campaign_out(c) | {"me": _me_out(p)}


# --- Côté demandeur (lead, management) ---------------------------------------------


class CampaignIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    message: str = Field(default="", max_length=4000)
    team_ids: list[int] = []
    items: list[str] = Field(min_length=1)
    closes_on: date


@router.post("")
def create_campaign(
    body: CampaignIn,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    items = [i for i in CAMPAIGN_ITEMS if i in body.items]
    if not items:
        raise HTTPException(400, "Choisis au moins une chose à mettre à jour.")
    if body.closes_on < _today():
        raise HTTPException(400, "La date limite est déjà passée.")
    team_ids = sorted(set(body.team_ids))
    if not has_role(user, "manager"):
        # Un lead interroge uniquement son équipe.
        if user.team_id is None or team_ids not in ([], [user.team_id]):
            raise HTTPException(403, "Un lead lance une campagne pour son équipe uniquement.")
        team_ids = [user.team_id]
    if team_ids:
        known = set(
            session.scalars(
                select(Team.id).where(Team.org_id == user.org_id, Team.id.in_(team_ids))
            )
        )
        if known != set(team_ids):
            raise HTTPException(400, "Équipe inconnue.")
    c = Campaign(
        org_id=user.org_id,
        created_by=user.id,
        title=body.title.strip(),
        message=body.message.strip(),
        team_ids=team_ids,
        items=items,
        closes_on=body.closes_on,
    )
    session.add(c)
    session.flush()
    members = select(User).where(User.org_id == user.org_id, User.active)
    if team_ids:
        members = members.where(User.team_id.in_(team_ids))
    for m in session.scalars(members).unique():
        session.add(CampaignParticipant(campaign_id=c.id, user_id=m.id, team_id=m.team_id))
    session.commit()
    return {"id": c.id}


def _participants(session: Session, c: Campaign, user: User) -> list[CampaignParticipant]:
    stmt = select(CampaignParticipant).where(CampaignParticipant.campaign_id == c.id)
    if not has_role(user, "manager"):
        stmt = stmt.where(CampaignParticipant.team_id == user.team_id)
    return list(session.scalars(stmt))


@router.get("")
def list_campaigns(
    user: User = Depends(require_role("lead")), session: Session = Depends(get_session)
):
    campaigns = session.scalars(
        select(Campaign).where(Campaign.org_id == user.org_id).order_by(Campaign.opens_at.desc())
    ).unique()
    out = []
    for c in campaigns:
        if not _visible_to_lead(c, user):
            continue
        ps = _participants(session, c, user)
        done = sum(1 for p in ps if p.completed_at is not None)
        out.append(
            _campaign_out(c)
            | {
                "targeted": len(ps),
                "respondents": done,
                "can_manage": c.created_by == user.id or has_role(user, "manager"),
            }
        )
    return out


def _previous(session: Session, c: Campaign) -> Campaign | None:
    return session.scalars(
        select(Campaign)
        .where(Campaign.org_id == c.org_id, Campaign.opens_at < c.opens_at)
        .order_by(Campaign.opens_at.desc())
    ).first()


@router.get("/{campaign_id}/results")
def campaign_results(
    campaign_id: int,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    c = _get(session, campaign_id, user)
    if not _visible_to_lead(c, user):
        raise HTTPException(404, "Campagne introuvable.")
    ps = _participants(session, c, user)
    users = (
        {
            u.id: u
            for u in session.scalars(
                select(User).where(User.id.in_([p.user_id for p in ps]))
            ).unique()
        }
        if ps
        else {}
    )
    teams = {t.id: t.name for t in session.scalars(select(Team).where(Team.org_id == c.org_id))}

    # Comparaison avec la campagne précédente, sur les mêmes équipes.
    prev = _previous(session, c)
    prev_summary = None
    if prev is not None:
        team_set = {p.team_id for p in ps}
        prev_ps = [
            p
            for p in session.scalars(
                select(CampaignParticipant).where(CampaignParticipant.campaign_id == prev.id)
            )
            if p.team_id in team_set
        ]
        if any(p.completed_at for p in prev_ps):
            prev_summary = {"id": prev.id, "title": prev.title} | summarize(prev_ps)

    by_team = []
    if has_role(user, "manager"):
        for team_id in sorted({p.team_id for p in ps}, key=lambda t: teams.get(t, "")):
            tp = [p for p in ps if p.team_id == team_id]
            by_team.append({"team": teams.get(team_id, "Sans équipe")} | summarize(tp))

    # Qui n'a pas encore répondu : de l'activité, jamais des réponses.
    pending = sorted(
        (
            {
                "name": (users[p.user_id].name or users[p.user_id].email),
                "team": teams.get(p.team_id, "—"),
            }
            for p in ps
            if p.completed_at is None and p.user_id in users
        ),
        key=lambda r: (r["team"], r["name"].lower()),
    )
    return {
        "campaign": _campaign_out(c),
        "summary": summarize(ps, with_comments=True),
        "previous": prev_summary,
        "by_team": by_team,
        "pending": pending,
        "can_manage": c.created_by == user.id or has_role(user, "manager"),
    }


def _manageable(session: Session, campaign_id: int, user: User) -> Campaign:
    c = _get(session, campaign_id, user)
    if not (c.created_by == user.id or has_role(user, "manager")):
        raise HTTPException(403, "Seul le demandeur ou le management peut gérer cette campagne.")
    return c


@router.post("/{campaign_id}/close")
def close_campaign(
    campaign_id: int,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    c = _manageable(session, campaign_id, user)
    c.closed = True
    session.commit()
    return _campaign_out(c)


class ExtendIn(BaseModel):
    closes_on: date


@router.post("/{campaign_id}/extend")
def extend_campaign(
    campaign_id: int,
    body: ExtendIn,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    c = _manageable(session, campaign_id, user)
    if body.closes_on < _today():
        raise HTTPException(400, "La date limite est déjà passée.")
    c.closes_on, c.closed = body.closes_on, False
    session.commit()
    return _campaign_out(c)


@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    c = _manageable(session, campaign_id, user)
    session.delete(c)
    session.commit()
    return {"ok": True}
