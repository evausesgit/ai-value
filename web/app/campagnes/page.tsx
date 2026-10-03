"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Meter } from "@/components/charts";
import { api, type Campaign, type Team } from "@/lib/api";
import { CAMPAIGN_ITEMS, fmtDay } from "@/lib/catalog";
import { hasRole, useSession } from "@/lib/session";

export default function CampaignsPage() {
  const { me } = useSession();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    api<Campaign[]>("/campaigns").then(setItems);
    api<Team[]>("/teams").then(setTeams);
  }, []);

  if (me && !hasRole(me, "lead")) return <main className="page"><div className="error">Accès réservé.</div></main>;
  const scope = (c: Campaign) =>
    c.team_ids.length === 0 ? "Toute l'organisation" : c.team_ids.map((id) => teams.find((t) => t.id === id)?.name ?? "?").join(", ");

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Campagnes de mise à jour</h1>
          <p className="sub">
            Demande aux équipes de mettre à jour leurs outils, compétences et use cases. Chaque campagne devient un point de suivi.
          </p>
        </div>
        <Link href="/campagnes/nouvelle" className="btn">
          + Nouvelle campagne
        </Link>
      </div>
      {items === null ? (
        <p className="muted">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="card empty">
          Aucune campagne pour l&apos;instant. <Link href="/campagnes/nouvelle">Lance la première</Link> : les équipes
          recevront la demande sur leur espace.
        </div>
      ) : (
        <div className="grid g2">
          {items.map((c) => {
            const pct = c.targeted ? Math.round((100 * (c.respondents ?? 0)) / c.targeted) : 0;
            return (
              <Link key={c.id} href={`/campagnes/${c.id}`} className="card uc-card">
                <div className="pills">
                  {c.open ? <span className="pill blue">● En cours</span> : <span className="pill">■ Close</span>}
                  <span className="pill">{scope(c)}</span>
                </div>
                <h3>{c.title}</h3>
                <div className="small muted">
                  {c.opens_at ? fmtDay(c.opens_at) : ""} → {fmtDay(c.closes_on)} · {c.items.map((i) => CAMPAIGN_ITEMS[i].label).join(", ")}
                </div>
                <div style={{ marginTop: "auto" }}>
                  <div className="row small" style={{ justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span>
                      {c.respondents} / {c.targeted} réponses
                    </span>
                    <strong>{pct} %</strong>
                  </div>
                  <Meter value={pct} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
