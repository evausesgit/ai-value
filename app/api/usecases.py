"""Catalogue de use cases : chacun publie, tout le monde s'en inspire."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.catalog import CATEGORIES
from app.db import get_session
from app.deps import can_see_team, current_user, has_role
from app.models import UseCase, UseCaseReaction, User

router = APIRouter(prefix="/usecases", tags=["usecases"])


def _counts(session: Session, ids: list[int]) -> dict[tuple[int, str], int]:
    if not ids:
        return {}
    rows = session.execute(
        select(UseCaseReaction.use_case_id, UseCaseReaction.kind, func.count())
        .where(UseCaseReaction.use_case_id.in_(ids))
        .group_by(UseCaseReaction.use_case_id, UseCaseReaction.kind)
    )
    return {(uc_id, kind): n for uc_id, kind, n in rows}


def _mine(session: Session, user: User, ids: list[int]) -> set[tuple[int, str]]:
    if not ids:
        return set()
    rows = session.execute(
        select(UseCaseReaction.use_case_id, UseCaseReaction.kind).where(
            UseCaseReaction.use_case_id.in_(ids), UseCaseReaction.user_id == user.id
        )
    )
    return {(a, b) for a, b in rows}


def _can_edit(user: User, uc: UseCase) -> bool:
    return uc.author_id == user.id or has_role(user, "admin")


def _can_validate(user: User, uc: UseCase) -> bool:
    return can_see_team(user, uc.team_id)


def _out(uc: UseCase, user: User, counts: dict, mine: set, full: bool = False) -> dict:
    d = {
        "id": uc.id,
        "title": uc.title,
        "category": uc.category,
        "problem": uc.problem,
        "tools": uc.tools,
        "minutes_saved_per_week": uc.minutes_saved_per_week,
        "risk": uc.risk,
        "status": uc.status,
        "author": uc.author.name if uc.author else None,
        "team": uc.team.name if uc.team else None,
        "created_at": uc.created_at.isoformat() if uc.created_at else None,
        "likes": counts.get((uc.id, "like"), 0),
        "adopters": counts.get((uc.id, "adopt"), 0),
        "liked": (uc.id, "like") in mine,
        "adopted": (uc.id, "adopt") in mine,
    }
    if full:
        d |= {
            "solution": uc.solution,
            "prompt": uc.prompt,
            "can_edit": _can_edit(user, uc),
            "can_validate": _can_validate(user, uc),
            "mine": uc.author_id == user.id,
        }
    return d


@router.get("")
def list_usecases(
    q: str = "",
    category: str = "",
    team_id: int | None = None,
    tool: str = "",
    mine: bool = False,
    sort: Literal["recent", "popular", "saved"] = "recent",
    limit: int = Query(default=100, le=300),
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    stmt = select(UseCase).where(UseCase.org_id == user.org_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(UseCase.title).like(like),
                func.lower(UseCase.problem).like(like),
                func.lower(UseCase.solution).like(like),
            )
        )
    if category:
        stmt = stmt.where(UseCase.category == category)
    if team_id:
        stmt = stmt.where(UseCase.team_id == team_id)
    if mine:
        stmt = stmt.where(UseCase.author_id == user.id)
    items = session.scalars(stmt.order_by(UseCase.created_at.desc())).unique().all()
    if tool:
        items = [uc for uc in items if tool in (uc.tools or [])]
    ids = [uc.id for uc in items]
    counts, my = _counts(session, ids), _mine(session, user, ids)
    out = [_out(uc, user, counts, my) for uc in items]
    if sort == "popular":
        out.sort(key=lambda d: d["adopters"] * 2 + d["likes"], reverse=True)
    elif sort == "saved":
        out.sort(key=lambda d: d["minutes_saved_per_week"] * (1 + d["adopters"]), reverse=True)
    return out[:limit]


def _get(session: Session, user: User, uc_id: int) -> UseCase:
    uc = session.get(UseCase, uc_id)
    if uc is None or uc.org_id != user.org_id:
        raise HTTPException(404, "Use case introuvable.")
    return uc


@router.get("/{uc_id}")
def get_usecase(
    uc_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    uc = _get(session, user, uc_id)
    return _out(uc, user, _counts(session, [uc.id]), _mine(session, user, [uc.id]), full=True)


class UseCaseIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    category: str
    problem: str = Field(default="", max_length=4000)
    solution: str = Field(default="", max_length=8000)
    prompt: str = Field(default="", max_length=8000)
    tools: list[str] = Field(default_factory=list, max_length=10)
    minutes_saved_per_week: int = Field(default=0, ge=0, le=2400)
    risk: Literal["low", "medium", "high"] = "low"


def _apply(uc: UseCase, body: UseCaseIn) -> None:
    if body.category not in CATEGORIES:
        raise HTTPException(400, "Catégorie inconnue.")
    uc.title = body.title.strip()
    uc.category = body.category
    uc.problem = body.problem.strip()
    uc.solution = body.solution.strip()
    uc.prompt = body.prompt.strip()
    uc.tools = sorted({t.strip() for t in body.tools if t.strip()})
    uc.minutes_saved_per_week = body.minutes_saved_per_week
    uc.risk = body.risk


@router.post("")
def create_usecase(
    body: UseCaseIn, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    uc = UseCase(org_id=user.org_id, author_id=user.id, team_id=user.team_id)
    _apply(uc, body)
    session.add(uc)
    session.commit()
    return {"id": uc.id}


@router.put("/{uc_id}")
def update_usecase(
    uc_id: int,
    body: UseCaseIn,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    uc = _get(session, user, uc_id)
    if not _can_edit(user, uc):
        raise HTTPException(403, "Seul l'auteur peut modifier ce use case.")
    _apply(uc, body)
    session.commit()
    return {"id": uc.id}


@router.delete("/{uc_id}")
def delete_usecase(
    uc_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    uc = _get(session, user, uc_id)
    if not _can_edit(user, uc):
        raise HTTPException(403, "Seul l'auteur peut supprimer ce use case.")
    session.delete(uc)
    session.commit()
    return {"ok": True}


class ReactIn(BaseModel):
    kind: Literal["like", "adopt"]


@router.post("/{uc_id}/react")
def toggle_reaction(
    uc_id: int,
    body: ReactIn,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    uc = _get(session, user, uc_id)
    row = session.scalar(
        select(UseCaseReaction).where(
            UseCaseReaction.use_case_id == uc.id,
            UseCaseReaction.user_id == user.id,
            UseCaseReaction.kind == body.kind,
        )
    )
    if row:
        session.delete(row)
    else:
        session.add(UseCaseReaction(use_case_id=uc.id, user_id=user.id, kind=body.kind))
    session.commit()
    return get_usecase(uc_id, user, session)


@router.post("/{uc_id}/validate")
def toggle_validation(
    uc_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    uc = _get(session, user, uc_id)
    if not _can_validate(user, uc):
        raise HTTPException(403, "Validation réservée au lead de l'équipe ou au management.")
    if uc.status == "validated":
        uc.status, uc.validated_by = "published", None
    else:
        uc.status, uc.validated_by = "validated", user.id
    session.commit()
    return get_usecase(uc_id, user, session)
