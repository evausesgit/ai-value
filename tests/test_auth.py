from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import PASSWORD, client_for


def test_login_wrong_password(world):
    c = TestClient(app)
    r = c.post("/auth/login", json={"email": "dev@acme.fr", "password": "faux"})
    assert r.status_code == 401


def test_me_requires_session():
    assert TestClient(app).get("/auth/me").status_code == 401


def test_login_and_logout(world):
    c = client_for("DEV@acme.fr")
    me = c.get("/auth/me").json()
    assert me["email"] == "dev@acme.fr" and me["team"]["name"] == "Tech"
    c.post("/auth/logout")
    assert c.get("/auth/me").status_code == 401


def test_lead_invites_member_into_own_team_only(world):
    lead = client_for("lead@acme.fr")
    r = lead.post("/admin/invites", json={"role": "manager"})
    assert r.status_code == 403
    r = lead.post("/admin/invites", json={"team_id": world["sales"].id})
    assert r.status_code == 403
    r = lead.post("/admin/invites", json={"email": "new@acme.fr"})
    assert r.status_code == 200
    token = r.json()["token"]

    anon = TestClient(app)
    info = anon.get(f"/auth/invite/{token}").json()
    assert info == {"org": "Acme", "team": "Tech", "role": "member", "email": "new@acme.fr"}
    r = anon.post(
        f"/auth/invite/{token}",
        json={"email": "autre@acme.fr", "name": "N", "password": PASSWORD},
    )
    assert r.status_code == 400  # invitation nominative
    r = anon.post(
        f"/auth/invite/{token}",
        json={"email": "new@acme.fr", "name": "Nouveau", "password": PASSWORD},
    )
    assert r.status_code == 200 and r.json()["team"]["name"] == "Tech"
    assert anon.get("/auth/me").json()["email"] == "new@acme.fr"
    # Usage unique.
    assert TestClient(app).get(f"/auth/invite/{token}").status_code == 404


def test_multi_use_team_link(world):
    admin = client_for("admin@acme.fr")
    token = admin.post(
        "/admin/invites", json={"team_id": world["sales"].id, "multi_use": True}
    ).json()["token"]
    for i in range(2):
        r = TestClient(app).post(
            f"/auth/invite/{token}",
            json={"email": f"v{i}@acme.fr", "name": f"V{i}", "password": PASSWORD},
        )
        assert r.status_code == 200


def test_superadmin_creates_org(world):
    admin = client_for("admin@acme.fr")
    r = admin.post("/platform/orgs", json={"name": "Nouvelle Boîte", "admin_email": "a@nb.fr"})
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "nouvelle-boite"
    info = TestClient(app).get(f"/auth/invite/{body['admin_invite_token']}").json()
    assert info["role"] == "admin" and info["org"] == "Nouvelle Boîte"
    assert client_for("lead@acme.fr").get("/platform/orgs").status_code == 403
