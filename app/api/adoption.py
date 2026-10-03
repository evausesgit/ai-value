"""Adoption déclarative : outils utilisés (état courant, modifiable à tout moment)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.deps import current_user
from app.models import Tool, ToolUsage, User

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
