from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tests.conftest import client_for

CHECKIN = {"usage_level": 3, "satisfaction": 4, "blockers": ["acces"], "comment": "Top"}


def _spec(**kw):
    return {
        "title": "Point IA de mars",
        "items": ["tools", "skills", "usecases", "checkin"],
        "closes_on": (datetime.now(UTC).date() + timedelta(days=10)).isoformat(),
    } | kw


def test_member_cannot_launch_and_lead_only_for_own_team(world):
    assert client_for("dev@acme.fr").post("/campaigns", json=_spec()).status_code == 403
    lead = client_for("lead@acme.fr")
    assert lead.post("/campaigns", json=_spec(team_ids=[world["sales"].id])).status_code == 403
    cid = lead.post("/campaigns", json=_spec()).json()["id"]
    camp = next(c for c in lead.get("/campaigns").json() if c["id"] == cid)
    assert camp["team_ids"] == [world["tech"].id] and camp["targeted"] == 3  # admin + lead + dev
    # Hors périmètre : le vendeur ne la voit pas.
    assert client_for("seller@acme.fr").get("/campaigns/mine").json() == []
    assert client_for("seller@acme.fr").get(f"/campaigns/{cid}/me").status_code == 404


def test_participation_flow_and_snapshot(world):
    cid = client_for("manager@acme.fr").post("/campaigns", json=_spec()).json()["id"]
    dev = client_for("dev@acme.fr")
    mine = dev.get("/campaigns/mine").json()
    assert [c["id"] for c in mine] == [cid] and mine[0]["me"]["completed_at"] is None

    # Mise à jour de l'état déclaré, puis validation des étapes.
    tools = dev.get("/tools").json()
    dev.put("/me/tools", json={"usages": {str(tools[0]["id"]): "daily"}})
    dev.put("/skills", json={"prompting": 2})
    dev.post(
        "/usecases", json={"title": "Tests auto", "category": "code", "minutes_saved_per_week": 90}
    )
    assert dev.post(f"/campaigns/{cid}/me/submit").status_code == 400  # étapes manquantes
    # « checkin » ne peut pas être coché sans répondre.
    r = dev.put(
        f"/campaigns/{cid}/me", json={"done_items": ["tools", "skills", "usecases", "checkin"]}
    )
    assert "checkin" not in r.json()["me"]["done_items"]
    dev.put(f"/campaigns/{cid}/me", json={"checkin": CHECKIN})
    r = dev.post(f"/campaigns/{cid}/me/submit")
    assert r.status_code == 200 and r.json()["me"]["completed_at"]

    res = client_for("manager@acme.fr").get(f"/campaigns/{cid}/results").json()
    s = res["summary"]
    assert s["respondents"] == 1 and s["adoption_pct"] == 100.0 and s["hours_saved"] == 1.5
    # Un seul répondant : ressenti masqué.
    assert s["satisfaction"] is None and s["blockers"] is None and s["comments"] is None
    pending_names = {p["name"] for p in res["pending"]}
    assert "dev" not in pending_names and "seller" in pending_names


def test_closed_campaign_refuses_answers_and_feeds_evolution(world):
    mgr = client_for("manager@acme.fr")
    cid = mgr.post("/campaigns", json=_spec(items=["tools"])).json()["id"]
    for email in ("dev@acme.fr", "lead@acme.fr", "seller@acme.fr"):
        c = client_for(email)
        c.put(f"/campaigns/{cid}/me", json={"done_items": ["tools"]})
        assert c.post(f"/campaigns/{cid}/me/submit").status_code == 200
    assert client_for("dev@acme.fr").get("/campaigns/mine").json()[0]["me"]["completed_at"]
    mgr.post(f"/campaigns/{cid}/close")
    assert (
        client_for("admin@acme.fr")
        .put(f"/campaigns/{cid}/me", json={"done_items": ["tools"]})
        .status_code
        == 400
    )
    evo = mgr.get("/dashboard/org").json()["evolution"]
    assert len(evo) == 1 and evo[0]["respondents"] == 3 and evo[0]["targeted"] == 5
    # Un lead ne voit dans les résultats que son équipe.
    lead_res = client_for("lead@acme.fr").get(f"/campaigns/{cid}/results").json()
    assert lead_res["summary"]["targeted"] == 3 and lead_res["by_team"] == []


def test_campaigns_isolated_between_orgs(world):
    cid = client_for("manager@acme.fr").post("/campaigns", json=_spec()).json()["id"]
    out = client_for("x@autre.fr")
    assert out.get("/campaigns").json() == []
    assert out.get(f"/campaigns/{cid}/results").status_code == 404
    assert out.get(f"/campaigns/{cid}/me").status_code == 404


def test_member_dashboard_counts_pending_requests(world):
    client_for("manager@acme.fr").post("/campaigns", json=_spec())
    assert client_for("dev@acme.fr").get("/dashboard/me").json()["pending_campaigns"] == 1
