"""Connaissances : auto-évaluation par domaine et quiz."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.catalog import DOMAINS
from app.db import get_session
from app.deps import current_user, has_role, require_role
from app.models import Quiz, QuizAttempt, QuizQuestion, SkillAssessment, User
from app.quiz_i18n import localize_quiz

router = APIRouter(tags=["skills"])


@router.get("/skills")
def my_skills(user: User = Depends(current_user), session: Session = Depends(get_session)):
    rows = session.scalars(select(SkillAssessment).where(SkillAssessment.user_id == user.id))
    return {r.domain: r.level for r in rows}


@router.put("/skills")
def set_my_skills(
    body: dict[str, int],
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    existing = {
        r.domain: r
        for r in session.scalars(select(SkillAssessment).where(SkillAssessment.user_id == user.id))
    }
    for domain, level in body.items():
        if domain not in DOMAINS or not 0 <= level <= 3:
            raise HTTPException(400, f"Valeur invalide : {domain}={level}")
        if domain in existing:
            existing[domain].level = level
        else:
            session.add(SkillAssessment(user_id=user.id, domain=domain, level=level))
    session.commit()
    return my_skills(user, session)


def _visible_quiz(session: Session, user: User, quiz_id: int) -> Quiz:
    quiz = session.get(Quiz, quiz_id)
    if quiz is None or not quiz.active or quiz.org_id not in (None, user.org_id):
        raise HTTPException(404, "Quiz introuvable.")
    return quiz


@router.get("/quizzes")
def list_quizzes(user: User = Depends(current_user), session: Session = Depends(get_session)):
    quizzes = session.scalars(
        select(Quiz)
        .where(Quiz.active, or_(Quiz.org_id.is_(None), Quiz.org_id == user.org_id))
        .order_by(Quiz.org_id.is_(None), Quiz.created_at)
    ).all()
    best = dict(
        session.execute(
            select(QuizAttempt.quiz_id, func.max(QuizAttempt.score * 100 / QuizAttempt.total))
            .where(QuizAttempt.user_id == user.id)
            .group_by(QuizAttempt.quiz_id)
        ).all()
    )
    counts = dict(
        session.execute(
            select(QuizQuestion.quiz_id, func.count()).group_by(QuizQuestion.quiz_id)
        ).all()
    )
    out = []
    for q in quizzes:
        tr = localize_quiz(q.slug, user.lang) or {}
        out.append(
            {
                "id": q.id,
                "title": tr.get("title", q.title),
                "description": tr.get("description", q.description),
                "domain": q.domain,
                "library": q.org_id is None,
                "questions": counts.get(q.id, 0),
                "best_pct": best.get(q.id),
                "can_delete": q.org_id is not None
                and (has_role(user, "admin") or q.created_by == user.id),
            }
        )
    return out


@router.get("/quizzes/{quiz_id}")
def get_quiz(
    quiz_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    quiz = _visible_quiz(session, user, quiz_id)
    texts = _texts(quiz, user.lang)
    return {
        "id": quiz.id,
        "title": texts["title"],
        "description": texts["description"],
        "domain": quiz.domain,
        # Pas de bonne réponse ici : elle n'est révélée qu'après la tentative.
        "questions": [{"prompt": t["prompt"], "options": t["options"]} for t in texts["questions"]],
    }


def _texts(quiz: Quiz, lang: str) -> dict:
    """Textes du quiz dans la langue demandée (bibliothèque traduite, sinon d'origine)."""
    tr = localize_quiz(quiz.slug, lang)
    if tr and len(tr["questions"]) == len(quiz.questions):
        return tr
    return {
        "title": quiz.title,
        "description": quiz.description,
        "questions": [
            {"prompt": q.prompt, "options": q.options, "explanation": q.explanation}
            for q in quiz.questions
        ],
    }


class AttemptIn(BaseModel):
    answers: list[int]


@router.post("/quizzes/{quiz_id}/attempt")
def attempt_quiz(
    quiz_id: int,
    body: AttemptIn,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
):
    quiz = _visible_quiz(session, user, quiz_id)
    if len(body.answers) != len(quiz.questions):
        raise HTTPException(400, "Réponds à toutes les questions.")
    score = sum(1 for q, a in zip(quiz.questions, body.answers, strict=True) if q.correct == a)
    session.add(
        QuizAttempt(
            quiz_id=quiz.id,
            user_id=user.id,
            score=score,
            total=len(quiz.questions),
            answers=body.answers,
        )
    )
    session.commit()
    return {
        "score": score,
        "total": len(quiz.questions),
        "corrections": [
            {"correct": q.correct, "explanation": t["explanation"]}
            for q, t in zip(quiz.questions, _texts(quiz, user.lang)["questions"], strict=True)
        ],
    }


class QuestionIn(BaseModel):
    prompt: str = Field(min_length=3)
    options: list[str] = Field(min_length=2, max_length=6)
    correct: int = Field(ge=0)
    explanation: str = ""


class QuizIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = ""
    domain: str
    questions: list[QuestionIn] = Field(min_length=1, max_length=30)


@router.post("/quizzes")
def create_quiz(
    body: QuizIn,
    user: User = Depends(require_role("lead")),
    session: Session = Depends(get_session),
):
    if body.domain not in DOMAINS:
        raise HTTPException(400, "Domaine inconnu.")
    quiz = Quiz(
        org_id=user.org_id,
        domain=body.domain,
        title=body.title.strip(),
        description=body.description.strip(),
        created_by=user.id,
    )
    for i, q in enumerate(body.questions):
        options = [o.strip() for o in q.options if o.strip()]
        if q.correct >= len(options):
            raise HTTPException(400, f"Question {i + 1} : bonne réponse hors des options.")
        quiz.questions.append(
            QuizQuestion(
                position=i,
                prompt=q.prompt.strip(),
                options=options,
                correct=q.correct,
                explanation=q.explanation.strip(),
            )
        )
    session.add(quiz)
    session.commit()
    return {"id": quiz.id}


@router.delete("/quizzes/{quiz_id}")
def delete_quiz(
    quiz_id: int, user: User = Depends(current_user), session: Session = Depends(get_session)
):
    quiz = _visible_quiz(session, user, quiz_id)
    if quiz.org_id is None or not (has_role(user, "admin") or quiz.created_by == user.id):
        raise HTTPException(403, "Suppression non autorisée.")
    quiz.active = False  # on garde les tentatives pour l'historique
    session.commit()
    return {"ok": True}
