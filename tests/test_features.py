from __future__ import annotations

from app.config import settings
from app.models import Pulse
from app.provisioning import ensure_library
from app.weeks import current_week
from tests.conftest import client_for


def test_pulse_upsert_and_validation(world):
    c = client_for("dev@acme.fr")
    body = {"usage_level": 3, "hours_saved": 2.5, "satisfaction": 4, "blockers": ["acces"]}
    assert c.put("/me/pulse", json=body).status_code == 200
    body["usage_level"] = 4
    r = c.put("/me/pulse", json=body).json()
    assert r["pulse"]["usage_level"] == 4
    assert c.put("/me/pulse", json=body | {"blockers": ["inconnu"]}).status_code == 400
    me = c.get("/dashboard/me").json()
    assert me["pulse_done"] and me["streak"] == 1


def test_tools_are_scoped_to_org(world):
    c = client_for("dev@acme.fr")
    tools = c.get("/tools").json()
    assert len(tools) > 5
    r = c.put("/me/tools", json={"usages": {str(tools[0]["id"]): "daily"}})
    assert r.json() == {str(tools[0]["id"]): "daily"}
    other_tools = client_for("x@autre.fr").get("/tools").json()
    r = c.put("/me/tools", json={"usages": {str(other_tools[0]["id"]): "daily"}})
    assert r.status_code == 400


def test_usecases_isolated_between_orgs(world):
    dev = client_for("dev@acme.fr")
    uc = dev.post(
        "/usecases",
        json={
            "title": "Tests auto",
            "category": "code",
            "tools": ["Claude"],
            "minutes_saved_per_week": 60,
        },
    ).json()
    assert client_for("x@autre.fr").get(f"/usecases/{uc['id']}").status_code == 404
    assert client_for("x@autre.fr").get("/usecases").json() == []
    seller = client_for("seller@acme.fr")
    assert (
        seller.post(f"/usecases/{uc['id']}/react", json={"kind": "adopt"}).json()["adopters"] == 1
    )
    assert (
        seller.put(f"/usecases/{uc['id']}", json={"title": "Hack", "category": "code"}).status_code
        == 403
    )
    # Validation : lead de l'équipe de l'auteur oui, lead d'une autre équipe non.
    assert client_for("lead@acme.fr").post(f"/usecases/{uc['id']}/validate").json()["status"] == (
        "validated"
    )


def test_anonymous_feedback_has_no_author(world, db):
    dev = client_for("dev@acme.fr")
    dev.post("/feedback", json={"kind": "frein", "text": "Pas de licence", "anonymous": True})
    dev.post("/feedback", json={"kind": "idee", "text": "Un atelier", "anonymous": False})
    assert len(dev.get("/feedback/mine").json()) == 1
    inbox = client_for("lead@acme.fr").get("/feedback/inbox").json()
    assert {f["author"] for f in inbox} == {None, "dev"}
    assert client_for("dev@acme.fr").get("/feedback/inbox").status_code == 403
    # Le lead des Ventes n'est pas concerné ; le manager voit tout.
    assert len(client_for("manager@acme.fr").get("/feedback/inbox").json()) == 2


def test_team_dashboard_access(world):
    tech, sales = world["tech"].id, world["sales"].id
    assert client_for("lead@acme.fr").get(f"/dashboard/team?team_id={tech}").status_code == 200
    assert client_for("lead@acme.fr").get(f"/dashboard/team?team_id={sales}").status_code == 404
    assert client_for("dev@acme.fr").get("/dashboard/team").status_code == 403
    assert client_for("manager@acme.fr").get(f"/dashboard/team?team_id={sales}").status_code == 200
    assert client_for("lead@acme.fr").get("/dashboard/org").status_code == 403
    assert client_for("x@autre.fr").get(f"/dashboard/team?team_id={tech}").status_code == 404


def test_small_groups_hide_sensitive_aggregates(world, db):
    week = current_week()
    users = [world["lead"], world["dev"]]
    for u in users:
        db.add(
            Pulse(
                user_id=u.id,
                org_id=u.org_id,
                team_id=u.team_id,
                week=week,
                usage_level=3,
                hours_saved=2,
                satisfaction=2,
                blockers=["acces"],
            )
        )
    db.commit()
    assert len(users) < settings.min_group_size
    d = client_for("lead@acme.fr").get("/dashboard/team").json()
    last = d["pulse"]["trend"][-1]
    assert last["respondents"] == 2 and last["satisfaction"] is None
    assert d["pulse"]["blockers"] is None
    # Le tableau des membres ne contient jamais les réponses individuelles.
    assert "satisfaction" not in d["roster"][0]


def test_quiz_flow(world, db):
    ensure_library(db)
    c = client_for("dev@acme.fr")
    quizzes = c.get("/quizzes").json()
    q = c.get(f"/quizzes/{quizzes[0]['id']}").json()
    assert "correct" not in q["questions"][0]
    r = c.post(f"/quizzes/{quizzes[0]['id']}/attempt", json={"answers": [0] * len(q["questions"])})
    res = r.json()
    assert res["total"] == len(q["questions"]) and len(res["corrections"]) == res["total"]
    assert c.get("/quizzes").json()[0]["best_pct"] is not None
    # Un membre ne crée pas de quiz ; un lead oui, visible seulement dans son org.
    spec = {
        "title": "Quiz maison",
        "domain": "metier",
        "questions": [{"prompt": "Q ?", "options": ["a", "b"], "correct": 1}],
    }
    assert c.post("/quizzes", json=spec).status_code == 403
    assert client_for("lead@acme.fr").post("/quizzes", json=spec).status_code == 200
    titles = [x["title"] for x in client_for("x@autre.fr").get("/quizzes").json()]
    assert "Quiz maison" not in titles


def test_skills(world):
    c = client_for("dev@acme.fr")
    assert c.put("/skills", json={"prompting": 2, "donnees": 1}).json() == {
        "prompting": 2,
        "donnees": 1,
    }
    assert c.put("/skills", json={"prompting": 9}).status_code == 400
