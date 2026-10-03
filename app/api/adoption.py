"""Adoption déclarative : outils utilisés (état courant) et pulse hebdomadaire."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import BLOCKERS
from app.db import get_session
from app.deps import current_user
from app.models import Pulse, Tool, ToolUsage, User
from app.weeks import current_week

router = APIRouter(tags=["adoption"])

Frequency = Literal["daily", "weekly", "monthly", "tried"]


@router.get("/tools")
def list_tools(user: User = Depends(current_user), session: Session = Depends(get_session)):
    tools = session.scalars(
        select(Tool).where(Tool.org_id == user.org_id, Tool.active).order_by(Tool.name)
    )
    return [{"id": t.id, "name": t.name, "category": t.category} for t in tools]


@router.get("/me/tools")
def my_tools(user: User = Depends(current_user), session: Session = Depends(get_session)):
    rows = session.scalars(select(ToolUsage).where(ToolUsage.user_id == user.id))
    return {str(r.tool_id): r.frequency for r in rows}


class ToolsIn(BaseModel):
    # tool_id → fréquence ; None = « je ne l'utilise pas ».
    usages: dict[int, Frequency | None]


@router.put("/me/tools")
def set_my_tools(
    body: ToolsIn, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    allowed = set(session.scalars(select(Tool.id).where(Tool.org_id == user.org_id)))
    existing = {
        r.tool_id: r for r in session.scalars(select(ToolUsage).where(ToolUsage.user_id == user.id))
    }
    for tool_id, freq in body.usages.items():
        if tool_id not in allowed:
            raise HTTPException(400, f"Outil inconnu : {tool_id}")
        row = existing.get(tool_id)
        if freq is None:
            if row:
                session.delete(row)
        elif row:
            row.frequency = freq
        else:
            session.add(ToolUsage(user_id=user.id, tool_id=tool_id, frequency=freq))
    session.commit()
    return my_tools(user, session)


def _pulse_out(p: Pulse | None) -> dict | None:
    if p is None:
        return None
    return {
        "week": p.week.isoformat(),
        "usage_level": p.usage_level,
        "hours_saved": p.hours_saved,
        "satisfaction": p.satisfaction,
        "blockers": p.blockers,
        "comment": p.comment,
    }


@router.get("/me/pulse")
def my_pulse(user: User = Depends(current_user), session: Session = Depends(get_session)):
    week = current_week()
    p = session.scalar(select(Pulse).where(Pulse.user_id == user.id, Pulse.week == week))
    return {"week": week.isoformat(), "pulse": _pulse_out(p)}


class PulseIn(BaseModel):
    usage_level: int = Field(ge=0, le=4)
    hours_saved: float = Field(ge=0, le=40)
    satisfaction: int = Field(ge=1, le=5)
    blockers: list[str] = []
    comment: str = Field(default="", max_length=2000)


@router.put("/me/pulse")
def set_my_pulse(
    body: PulseIn, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    unknown = set(body.blockers) - set(BLOCKERS)
    if unknown:
        raise HTTPException(400, f"Frein inconnu : {', '.join(sorted(unknown))}")
    week = current_week()
    p = session.scalar(select(Pulse).where(Pulse.user_id == user.id, Pulse.week == week))
    if p is None:
        p = Pulse(user_id=user.id, org_id=user.org_id, week=week)
        session.add(p)
    p.team_id = user.team_id
    p.usage_level = body.usage_level
    p.hours_saved = body.hours_saved
    p.satisfaction = body.satisfaction
    p.blockers = sorted(set(body.blockers))
    p.comment = body.comment.strip()
    session.commit()
    return {"week": week.isoformat(), "pulse": _pulse_out(p)}
