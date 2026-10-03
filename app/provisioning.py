"""Création d'organisation, de sessions et chargement de la bibliothèque commune."""

from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import DEFAULT_TOOLS, LIBRARY_QUIZZES
from app.config import settings
from app.models import AuthSession, Invite, Org, Quiz, QuizQuestion, Tool, User
from app.security import new_token, token_hash


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "org"


def create_org(session: Session, name: str) -> Org:
    base = slugify(name)
    slug, n = base, 1
    while session.scalar(select(Org.id).where(Org.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    org = Org(name=name, slug=slug)
    session.add(org)
    session.flush()
    for tool_name, category in DEFAULT_TOOLS:
        session.add(Tool(org_id=org.id, name=tool_name, category=category))
    session.flush()
    return org


def create_invite(
    session: Session,
    *,
    org_id: int,
    role: str = "member",
    team_id: int | None = None,
    email: str | None = None,
    multi_use: bool = False,
    created_by: int | None = None,
) -> tuple[Invite, str]:
    """Renvoie l'invitation et le jeton en clair (affiché une seule fois)."""
    token = new_token()
    invite = Invite(
        org_id=org_id,
        role=role,
        team_id=team_id,
        email=email.lower() if email else None,
        multi_use=multi_use,
        token_hash=token_hash(token),
        created_by=created_by,
        expires_at=datetime.now(UTC) + timedelta(days=settings.invite_days),
    )
    session.add(invite)
    session.flush()
    return invite, token


def open_session(session: Session, user: User) -> str:
    token = new_token()
    session.add(
        AuthSession(
            user_id=user.id,
            token_hash=token_hash(token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.session_days),
        )
    )
    session.commit()
    return token


def ensure_library(session: Session) -> None:
    """Insère les quiz de la bibliothèque commune absents (idempotent)."""
    existing = set(session.scalars(select(Quiz.slug).where(Quiz.slug.is_not(None))))
    for spec in LIBRARY_QUIZZES:
        if spec["slug"] in existing:
            continue
        quiz = Quiz(
            org_id=None,
            slug=spec["slug"],
            domain=spec["domain"],
            title=spec["title"],
            description=spec["description"],
        )
        for i, q in enumerate(spec["questions"]):
            quiz.questions.append(
                QuizQuestion(
                    position=i,
                    prompt=q["prompt"],
                    options=q["options"],
                    correct=q["correct"],
                    explanation=q["explanation"],
                )
            )
        session.add(quiz)
    session.commit()
