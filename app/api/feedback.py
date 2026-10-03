"""Boîte à feedback : chacun écrit (anonymement s'il le souhaite), les leads répondent."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import FEEDBACK_KINDS
from app.db import get_session
from app.deps import can_see_team, current_user, has_role, require_role
from app.models import Feedback, User

router = APIRouter(prefix="/feedback", tags=["feedback"])


def _out(f: Feedback, with_author: bool = True) -> dict:
    return {
        "id": f.id,
        "kind": f.kind,
        "text": f.text,
        "status": f.status,
        "response": f.response,
        "team": f.team.name if f.team else None,
        "author": (f.author.name if f.author else None) if with_author else None,
        "anonymous": f.author_id is None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
    }


class FeedbackIn(BaseModel):
    kind: str
    text: str = Field(min_length=3, max_length=4000)
    anonymous: bool = False


@router.post("")
def create_feedback(
    body: FeedbackIn, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    if body.kind not in FEEDBACK_KINDS:
        raise HTTPException(400, "Type inconnu.")
    f = Feedback(
        org_id=user.org_id,
        author_id=None if body.anonymous else user.id,
        team_id=user.team_id,
        kind=body.kind,
        text=body.text.strip(),
    )
    session.add(f)
    session.commit()
    return {"id": f.id, "anonymous": body.anonymous}


@router.get("/mine")
def my_feedback(user: User = Depends(current_user), session: Session = Depends(get_session)):
    # Les feedbacks anonymes ne sont rattachés à personne : ils n'apparaissent pas ici.
    rows = session.scalars(
        select(Feedback).where(Feedback.author_id == user.id).order_by(Feedback.created_at.desc())
    ).unique()
    return [_out(f) for f in rows]


@router.get("/inbox")
def inbox(
    status: str = "",
    team_id: int | None = None,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    stmt = select(Feedback).where(Feedback.org_id == user.org_id)
    if not has_role(user, "manager"):
        stmt = stmt.where(Feedback.team_id == user.team_id)
    elif team_id:
        stmt = stmt.where(Feedback.team_id == team_id)
    if status:
        stmt = stmt.where(Feedback.status == status)
    rows = session.scalars(stmt.order_by(Feedback.created_at.desc()).limit(300)).unique()
    return [_out(f) for f in rows]


class FeedbackUpdate(BaseModel):
    status: Literal["new", "in_progress", "done"]
    response: str = Field(default="", max_length=4000)


@router.patch("/{fb_id}")
def update_feedback(
    fb_id: int,
    body: FeedbackUpdate,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    f = session.get(Feedback, fb_id)
    if f is None or f.org_id != user.org_id or not can_see_team(user, f.team_id):
        raise HTTPException(404, "Feedback introuvable.")
    f.status = body.status
    if body.response.strip() != f.response:
        f.response = body.response.strip()
        f.responded_by = user.id
    session.commit()
    return _out(f)
