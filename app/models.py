"""Schéma AI Value — multi-entreprise (une `Org` = un client, données isolées).

Toute lecture métier filtre par `org_id` de l'utilisateur connecté : ne jamais
renvoyer une ligne d'une autre organisation.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (UniqueConstraint("org_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    team_id: Mapped[int | None] = mapped_column(
        ForeignKey("teams.id", ondelete="SET NULL"), index=True
    )
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    job: Mapped[str] = mapped_column(String(120), default="")
    lang: Mapped[str] = mapped_column(String(5), default="fr", server_default="fr")
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # member < lead < manager < admin (cf. app.deps.ROLE_RANK)
    role: Mapped[str] = mapped_column(String(16), default="member")
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    org: Mapped[Org] = relationship(lazy="joined")
    team: Mapped[Team | None] = relationship(lazy="joined")


class AuthSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    email: Mapped[str | None] = mapped_column(String(254))
    role: Mapped[str] = mapped_column(String(16), default="member")
    # Lien réutilisable (toute une équipe) ou à usage unique (email fixé).
    multi_use: Mapped[bool] = mapped_column(Boolean, default=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


# --- Adoption (déclaratif) -------------------------------------------------


class Tool(Base):
    __tablename__ = "tools"
    __table_args__ = (UniqueConstraint("org_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(32), default="assistant")
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ToolUsage(Base):
    """Ce que l'utilisateur déclare utiliser, et à quelle fréquence (état courant)."""

    __tablename__ = "tool_usages"
    __table_args__ = (UniqueConstraint("user_id", "tool_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    tool_id: Mapped[int] = mapped_column(ForeignKey("tools.id", ondelete="CASCADE"), index=True)
    frequency: Mapped[str] = mapped_column(String(16))  # daily | weekly | monthly | tried
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Campaign(Base):
    """Demande de mise à jour lancée par un lead ou le management.

    Chaque participant met à jour ce qui est demandé (`items`), puis envoie :
    on photographie alors son état dans `CampaignParticipant`. Une campagne =
    un point sur les courbes d'évolution.
    """

    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text, default="")
    # Équipes visées ; liste vide = toute l'organisation.
    team_ids: Mapped[list] = mapped_column(JSON, default=list)
    items: Mapped[list] = mapped_column(JSON, default=list)  # cf. app.catalog.CAMPAIGN_ITEMS
    opens_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closes_on: Mapped[date] = mapped_column(Date)
    closed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped[User | None] = relationship(foreign_keys=[created_by], lazy="joined")


class CampaignParticipant(Base):
    """Une personne visée par une campagne, et la photo de son état à l'envoi."""

    __tablename__ = "campaign_participants"
    __table_args__ = (UniqueConstraint("campaign_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # Équipe au moment de la campagne : l'historique ne bouge pas si l'on change d'équipe.
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    done_items: Mapped[list] = mapped_column(JSON, default=list)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Photo à l'envoi ---
    tools: Mapped[dict] = mapped_column(JSON, default=dict)  # nom d'outil → fréquence
    active_tools: Mapped[int] = mapped_column(Integer, default=0)
    skills: Mapped[dict] = mapped_column(JSON, default=dict)  # domaine → niveau
    usecases: Mapped[int] = mapped_column(Integer, default=0)  # publiés par la personne
    adopted: Mapped[int] = mapped_column(Integer, default=0)  # use cases d'autres adoptés
    # Temps gagné par semaine : ses use cases + ceux qu'elle a adoptés.
    minutes_saved: Mapped[int] = mapped_column(Integer, default=0)
    # Ressenti (facultatif selon la campagne).
    usage_level: Mapped[int | None] = mapped_column(Integer)  # 0..4
    satisfaction: Mapped[int | None] = mapped_column(Integer)  # 1..5
    blockers: Mapped[list] = mapped_column(JSON, default=list)
    comment: Mapped[str] = mapped_column(Text, default="")


# --- Connaissances ---------------------------------------------------------


class SkillAssessment(Base):
    __tablename__ = "skill_assessments"
    __table_args__ = (UniqueConstraint("user_id", "domain"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    domain: Mapped[str] = mapped_column(String(32))  # cf. app.catalog.DOMAINS
    level: Mapped[int] = mapped_column(Integer)  # 0..3
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[int] = mapped_column(primary_key=True)
    # NULL = bibliothèque commune (fournie par AI Value, visible de toutes les orgs).
    org_id: Mapped[int | None] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str | None] = mapped_column(String(80), unique=True)
    domain: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    questions: Mapped[list[QuizQuestion]] = relationship(
        order_by="QuizQuestion.position", cascade="all, delete-orphan"
    )


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSON)
    correct: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str] = mapped_column(Text, default="")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    quiz_id: Mapped[int] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    answers: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# --- Use cases -------------------------------------------------------------


class UseCase(Base):
    __tablename__ = "use_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(32))  # cf. app.catalog.CATEGORIES
    problem: Mapped[str] = mapped_column(Text, default="")
    solution: Mapped[str] = mapped_column(Text, default="")
    prompt: Mapped[str] = mapped_column(Text, default="")
    tools: Mapped[list] = mapped_column(JSON, default=list)  # noms d'outils
    minutes_saved_per_week: Mapped[int] = mapped_column(Integer, default=0)
    risk: Mapped[str] = mapped_column(String(16), default="low")  # low | medium | high
    status: Mapped[str] = mapped_column(String(16), default="published")  # published|validated
    validated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author: Mapped[User | None] = relationship(foreign_keys=[author_id], lazy="joined")
    team: Mapped[Team | None] = relationship(lazy="joined")


class UseCaseReaction(Base):
    """`like` = utile ; `adopt` = « je l'utilise aussi » (mesure la diffusion)."""

    __tablename__ = "use_case_reactions"
    __table_args__ = (UniqueConstraint("use_case_id", "user_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    use_case_id: Mapped[int] = mapped_column(
        ForeignKey("use_cases.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(8))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# --- Feedback --------------------------------------------------------------


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[int] = mapped_column(primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("orgs.id", ondelete="CASCADE"), index=True)
    # NULL si anonyme : l'auteur n'est stocké nulle part, pas seulement masqué.
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id", ondelete="SET NULL"))
    kind: Mapped[str] = mapped_column(String(16))  # cf. app.catalog.FEEDBACK_KINDS
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="new")  # new | in_progress | done
    response: Mapped[str] = mapped_column(Text, default="")
    responded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    author: Mapped[User | None] = relationship(foreign_keys=[author_id], lazy="joined")
    team: Mapped[Team | None] = relationship(lazy="joined")
