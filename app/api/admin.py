"""Administration d'une organisation (équipes, membres, invitations, outils) et
de la plateforme (création d'organisations, superadmin uniquement)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_session
from app.deps import _aware, current_user, has_role, require_role, require_superadmin
from app.models import Invite, Org, Team, Tool, User
from app.provisioning import create_invite, create_org

router = APIRouter(tags=["admin"])

Role = Literal["member", "lead", "manager", "admin"]


def _team_in_org(session: Session, org_id: int, team_id: int | None) -> None:
    if team_id is None:
        return
    team = session.get(Team, team_id)
    if team is None or team.org_id != org_id:
        raise HTTPException(400, "Équipe inconnue.")


# --- Équipes (lecture pour tous : formulaires, filtres) ------------------------


@router.get("/teams")
def list_teams(user: User = Depends(current_user), session: Session = Depends(get_session)):
    counts = dict(
        session.execute(
            select(User.team_id, func.count())
            .where(User.org_id == user.org_id, User.active)
            .group_by(User.team_id)
        ).all()
    )
    teams = session.scalars(select(Team).where(Team.org_id == user.org_id).order_by(Team.name))
    return [{"id": t.id, "name": t.name, "members": counts.get(t.id, 0)} for t in teams]


class TeamIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


@router.post("/admin/teams")
def create_team(
    body: TeamIn,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    team = Team(org_id=user.org_id, name=body.name.strip())
    session.add(team)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Cette équipe existe déjà.") from None
    return {"id": team.id, "name": team.name}


@router.put("/admin/teams/{team_id}")
def rename_team(
    team_id: int,
    body: TeamIn,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    _team_in_org(session, user.org_id, team_id)
    team = session.get(Team, team_id)
    team.name = body.name.strip()
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Cette équipe existe déjà.") from None
    return {"id": team.id, "name": team.name}


@router.delete("/admin/teams/{team_id}")
def delete_team(
    team_id: int,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    _team_in_org(session, user.org_id, team_id)
    session.delete(session.get(Team, team_id))  # membres → sans équipe (SET NULL)
    session.commit()
    return {"ok": True}


# --- Membres ------------------------------------------------------------------


@router.get("/admin/members")
def list_members(
    user: User = Depends(require_role("lead")), session: Session = Depends(get_session)
):
    stmt = select(User).where(User.org_id == user.org_id)
    if not has_role(user, "admin"):
        stmt = stmt.where(User.team_id == user.team_id)
    members = session.scalars(stmt.order_by(User.name)).unique()
    return [
        {
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "job": m.job,
            "role": m.role,
            "team_id": m.team_id,
            "active": m.active,
            "last_seen_at": m.last_seen_at.isoformat() if m.last_seen_at else None,
        }
        for m in members
    ]


class MemberUpdate(BaseModel):
    role: Role
    team_id: int | None
    active: bool


@router.patch("/admin/members/{member_id}")
def update_member(
    member_id: int,
    body: MemberUpdate,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    member = session.get(User, member_id)
    if member is None or member.org_id != user.org_id:
        raise HTTPException(404, "Membre introuvable.")
    _team_in_org(session, user.org_id, body.team_id)
    if member.id == user.id and (body.role != "admin" or not body.active):
        raise HTTPException(400, "Tu ne peux pas retirer tes propres droits d'admin.")
    member.role, member.team_id, member.active = body.role, body.team_id, body.active
    session.commit()
    return {"ok": True}


# --- Invitations --------------------------------------------------------------


def _invite_out(i: Invite) -> dict:
    return {
        "id": i.id,
        "email": i.email,
        "role": i.role,
        "team_id": i.team_id,
        "multi_use": i.multi_use,
        "used_count": i.used_count,
        "expires_at": i.expires_at.isoformat(),
        "expired": _aware(i.expires_at) < datetime.now(UTC),
    }


@router.get("/admin/invites")
def list_invites(
    user: User = Depends(require_role("lead")), session: Session = Depends(get_session)
):
    stmt = select(Invite).where(Invite.org_id == user.org_id, Invite.revoked.is_(False))
    if not has_role(user, "admin"):
        stmt = stmt.where(Invite.created_by == user.id)
    return [_invite_out(i) for i in session.scalars(stmt.order_by(Invite.created_at.desc()))]


class InviteIn(BaseModel):
    email: EmailStr | None = None
    role: Role = "member"
    team_id: int | None = None
    multi_use: bool = False


@router.post("/admin/invites")
def new_invite(
    body: InviteIn,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    # Autonomie des équipes : un lead invite des membres dans SON équipe ;
    # l'admin invite n'importe qui, avec n'importe quel rôle.
    if not has_role(user, "admin"):
        if body.role != "member" or body.team_id not in (None, user.team_id):
            raise HTTPException(403, "Un lead invite uniquement des membres dans son équipe.")
        body.team_id = user.team_id
    _team_in_org(session, user.org_id, body.team_id)
    invite, token = create_invite(
        session,
        org_id=user.org_id,
        role=body.role,
        team_id=body.team_id,
        email=body.email,
        multi_use=body.multi_use and not body.email,
        created_by=user.id,
    )
    session.commit()
    return _invite_out(invite) | {"token": token}


@router.delete("/admin/invites/{invite_id}")
def revoke_invite(
    invite_id: int,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    invite = session.get(Invite, invite_id)
    if invite is None or invite.org_id != user.org_id:
        raise HTTPException(404, "Invitation introuvable.")
    if not has_role(user, "admin") and invite.created_by != user.id:
        raise HTTPException(403, "Invitation créée par quelqu'un d'autre.")
    invite.revoked = True
    session.commit()
    return {"ok": True}


# --- Outils -------------------------------------------------------------------


@router.get("/admin/tools")
def all_tools(user: User = Depends(require_role("admin")), session: Session = Depends(get_session)):
    tools = session.scalars(select(Tool).where(Tool.org_id == user.org_id).order_by(Tool.name))
    return [{"id": t.id, "name": t.name, "category": t.category, "active": t.active} for t in tools]


class ToolIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field(default="assistant", max_length=32)
    active: bool = True


@router.post("/admin/tools")
def add_tool(
    body: ToolIn,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    tool = Tool(org_id=user.org_id, name=body.name.strip(), category=body.category, active=True)
    session.add(tool)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Cet outil existe déjà.") from None
    return {"id": tool.id}


@router.put("/admin/tools/{tool_id}")
def edit_tool(
    tool_id: int,
    body: ToolIn,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_session),
):
    tool = session.get(Tool, tool_id)
    if tool is None or tool.org_id != user.org_id:
        raise HTTPException(404, "Outil introuvable.")
    tool.name, tool.category, tool.active = body.name.strip(), body.category, body.active
    session.commit()
    return {"ok": True}


# --- Plateforme ---------------------------------------------------------------


@router.get("/platform/orgs")
def list_orgs(_: User = Depends(require_superadmin), session: Session = Depends(get_session)):
    counts = dict(session.execute(select(User.org_id, func.count()).group_by(User.org_id)).all())
    orgs = session.scalars(select(Org).order_by(Org.created_at))
    return [
        {"id": o.id, "name": o.name, "slug": o.slug, "members": counts.get(o.id, 0)} for o in orgs
    ]


class OrgIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    admin_email: EmailStr | None = None


@router.post("/platform/orgs")
def new_org(
    body: OrgIn, user: User = Depends(require_superadmin), session: Session = Depends(get_session)
):
    """Crée une organisation et renvoie le lien d'invitation de son premier admin."""
    org = create_org(session, body.name.strip())
    _, token = create_invite(
        session, org_id=org.id, role="admin", email=body.admin_email, created_by=user.id
    )
    session.commit()
    return {"id": org.id, "name": org.name, "slug": org.slug, "admin_invite_token": token}
