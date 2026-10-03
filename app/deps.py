"""Authentification (cookie de session) et contrôle d'accès par rôle.

Hiérarchie : member < lead < manager < admin. Un lead voit son équipe ; un
manager et un admin voient toute l'organisation ; seul l'admin administre.
`is_superadmin` (plateforme) permet en plus de créer des organisations.
"""

from __future__ import annotations

import hmac
from datetime import UTC, datetime, timedelta

from fastapi import Cookie, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_session
from app.models import AuthSession, User
from app.security import token_hash

ROLE_RANK = {"member": 0, "lead": 1, "manager": 2, "admin": 3}


def check_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    if settings.internal_api_token and not hmac.compare_digest(
        x_internal_token or "", settings.internal_api_token
    ):
        raise HTTPException(401, "Appel direct refusé : passer par le proxy.")


def current_user(
    _: None = Depends(check_internal_token),
    aivalue_session: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> User:
    if not aivalue_session:
        raise HTTPException(401, "Connexion requise.")
    auth = session.scalar(
        select(AuthSession).where(AuthSession.token_hash == token_hash(aivalue_session))
    )
    now = datetime.now(UTC)
    if auth is None or _aware(auth.expires_at) < now:
        raise HTTPException(401, "Session expirée.")
    user = session.get(User, auth.user_id)
    if user is None or not user.active:
        raise HTTPException(401, "Compte désactivé.")
    # Mise à jour paresseuse : au plus une écriture par heure et par utilisateur.
    if user.last_seen_at is None or _aware(user.last_seen_at) < now - timedelta(hours=1):
        user.last_seen_at = now
        session.commit()
    return user


def _aware(dt: datetime) -> datetime:
    # SQLite (tests) rend des datetimes naïfs ; Postgres des datetimes UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def has_role(user: User, minimum: str) -> bool:
    return ROLE_RANK.get(user.role, 0) >= ROLE_RANK[minimum]


def require_role(minimum: str):
    def dep(user: User = Depends(current_user)) -> User:
        if not has_role(user, minimum):
            raise HTTPException(403, "Accès réservé.")
        return user

    return dep


def require_superadmin(user: User = Depends(current_user)) -> User:
    if not user.is_superadmin:
        raise HTTPException(403, "Accès réservé à la plateforme.")
    return user


def can_see_team(user: User, team_id: int | None) -> bool:
    """Un lead ne voit que son équipe ; manager et admin voient toutes celles de l'org."""
    if has_role(user, "manager"):
        return True
    return has_role(user, "lead") and team_id is not None and team_id == user.team_id
