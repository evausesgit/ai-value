"""Connexion email + mot de passe, invitations, profil."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from datetime import UTC, datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_session
from app.deps import _aware, check_internal_token, current_user
from app.models import AuthSession, Invite, Org, Team, User
from app.provisioning import open_session
from app.security import hash_password, token_hash, verify_password

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(check_internal_token)])

# Anti force brute minimal (mémoire du process) : 8 essais / 10 min par email.
_ATTEMPTS: dict[str, deque[float]] = defaultdict(deque)
_WINDOW, _MAX_ATTEMPTS = 600, 8


def _throttle(email: str) -> None:
    now = time.monotonic()
    q = _ATTEMPTS[email]
    while q and q[0] < now - _WINDOW:
        q.popleft()
    if len(q) >= _MAX_ATTEMPTS:
        raise HTTPException(429, "Trop de tentatives, réessaie dans quelques minutes.")
    q.append(now)


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.session_cookie,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def me_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "job": user.job,
        "role": user.role,
        "is_superadmin": user.is_superadmin,
        "org": {"id": user.org.id, "name": user.org.name},
        "team": {"id": user.team.id, "name": user.team.name} if user.team else None,
    }


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
def login(body: LoginIn, response: Response, session: Session = Depends(get_session)):
    email = body.email.lower()
    _throttle(email)
    user = session.scalar(select(User).where(func.lower(User.email) == email))
    if user is None or not user.active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email ou mot de passe incorrect.")
    _ATTEMPTS.pop(email, None)
    _set_cookie(response, open_session(session, user))
    return me_payload(user)


@router.post("/logout")
def logout(
    response: Response,
    aivalue_session: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
):
    if aivalue_session:
        session.execute(
            delete(AuthSession).where(AuthSession.token_hash == token_hash(aivalue_session))
        )
        session.commit()
    response.delete_cookie(settings.session_cookie, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return me_payload(user)


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    job: str = Field(default="", max_length=120)


@router.put("/me")
def update_me(
    body: ProfileIn, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    user.name = body.name.strip()
    user.job = body.job.strip()
    session.commit()
    return me_payload(user)


class PasswordIn(BaseModel):
    current: str
    new: str = Field(min_length=10, max_length=200)


@router.post("/password")
def change_password(
    body: PasswordIn, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    if not verify_password(body.current, user.password_hash):
        raise HTTPException(400, "Mot de passe actuel incorrect.")
    user.password_hash = hash_password(body.new)
    session.commit()
    return {"ok": True}


# --- Invitations ----------------------------------------------------------


def _valid_invite(session: Session, token: str) -> Invite:
    invite = session.scalar(select(Invite).where(Invite.token_hash == token_hash(token)))
    if (
        invite is None
        or invite.revoked
        or _aware(invite.expires_at) < datetime.now(UTC)
        or (not invite.multi_use and invite.used_count > 0)
    ):
        raise HTTPException(404, "Invitation invalide ou expirée.")
    return invite


@router.get("/invite/{token}")
def invite_info(token: str, session: Session = Depends(get_session)):
    invite = _valid_invite(session, token)
    team = session.get(Team, invite.team_id) if invite.team_id else None
    org = session.get(Org, invite.org_id)
    return {
        "org": org.name,
        "team": team.name if team else None,
        "role": invite.role,
        "email": invite.email,
    }


class AcceptIn(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    job: str = Field(default="", max_length=120)
    password: str = Field(min_length=10, max_length=200)


@router.post("/invite/{token}")
def accept_invite(
    token: str, body: AcceptIn, response: Response, session: Session = Depends(get_session)
):
    invite = _valid_invite(session, token)
    email = body.email.lower()
    if invite.email and invite.email != email:
        raise HTTPException(400, "Cette invitation est réservée à une autre adresse.")
    user = User(
        org_id=invite.org_id,
        team_id=invite.team_id,
        email=email,
        name=body.name.strip(),
        job=body.job.strip(),
        role=invite.role,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    invite.used_count += 1
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "Un compte existe déjà avec cet email : connecte-toi.") from None
    _set_cookie(response, open_session(session, user))
    return me_payload(user)
