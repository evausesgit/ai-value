from __future__ import annotations

import os

# Base SQLite en mémoire : doit être posée AVANT l'import de l'application.
os.environ["DATABASE_URL"] = "sqlite+pysqlite://"
os.environ["INTERNAL_API_TOKEN"] = ""

import pytest
from fastapi.testclient import TestClient

from app import models  # noqa: F401
from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import Team, User
from app.provisioning import create_org
from app.security import hash_password

PASSWORD = "mot-de-passe-solide"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


def make_user(db, org, email, role="member", team=None, superadmin=False):
    u = User(
        org_id=org.id,
        team_id=team.id if team else None,
        email=email,
        name=email.split("@")[0],
        role=role,
        is_superadmin=superadmin,
        password_hash=hash_password(PASSWORD),
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture
def world(db):
    """Deux organisations ; dans `acme`, deux équipes avec lead et membres."""
    acme = create_org(db, "Acme")
    other = create_org(db, "Autre boîte")
    tech, sales = Team(org_id=acme.id, name="Tech"), Team(org_id=acme.id, name="Ventes")
    db.add_all([tech, sales])
    db.commit()
    w = {
        "acme": acme,
        "other": other,
        "tech": tech,
        "sales": sales,
        "admin": make_user(db, acme, "admin@acme.fr", "admin", tech, superadmin=True),
        "manager": make_user(db, acme, "manager@acme.fr", "manager"),
        "lead": make_user(db, acme, "lead@acme.fr", "lead", tech),
        "dev": make_user(db, acme, "dev@acme.fr", "member", tech),
        "seller": make_user(db, acme, "seller@acme.fr", "member", sales),
        "outsider": make_user(db, other, "x@autre.fr", "admin"),
    }
    return w


def client_for(email: str) -> TestClient:
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return c
