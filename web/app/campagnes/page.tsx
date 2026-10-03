"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Meter } from "@/components/charts";
import { api, type Campaign, type Team } from "@/lib/api";
import { fmtDay } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
import { hasRole, useSession } from "@/lib/session";

export default function CampaignsPage() {
  const { me } = useSession();
  const { m } = useI18n();
  const c_ = m.campaigns;
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    api<Campaign[]>("/campaigns").then(setItems);
    api<Team[]>("/teams").then(setTeams);
  }, []);

  if (me && !hasRole(me, "lead")) return <main className="page"><div className="error">{m.common.restricted}</div></main>;
  const scope = (c: Campaign) =>
    c.team_ids.length === 0 ? c_.wholeOrg : c.team_ids.map((id) => teams.find((t) => t.id === id)?.name ?? "?").join(", ");

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{c_.title}</h1>
          <p className="sub">
            {c_.subtitle}
          </p>
        </div>
        <Link href="/campagnes/nouvelle" className="btn">
          {c_.new}
        </Link>
      </div>
      {items === null ? (
        <p className="muted">{m.common.loading}</p>
      ) : items.length === 0 ? (
        <div className="card empty">
          {c_.empty} <Link href="/campagnes/nouvelle">{c_.launchFirst}</Link>
          {c_.emptyEnd}
        </div>
      ) : (
        <div className="grid g2">
          {items.map((c) => {
            const pct = c.targeted ? Math.round((100 * (c.respondents ?? 0)) / c.targeted) : 0;
            return (
              <Link key={c.id} href={`/campagnes/${c.id}`} className="card uc-card">
                <div className="pills">
                  {c.open ? <span className="pill blue">{c_.open}</span> : <span className="pill">{c_.closed}</span>}
                  <span className="pill">{scope(c)}</span>
                </div>
                <h3>{c.title}</h3>
                <div className="small muted">
                  {c.opens_at ? fmtDay(c.opens_at) : ""} → {fmtDay(c.closes_on)} · {c.items.map((i) => m.catalog.campaignItems[i].label).join(", ")}
                </div>
                <div style={{ marginTop: "auto" }}>
                  <div className="row small" style={{ justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span>
                      {m.common.respondedOf(c.respondents ?? 0, c.targeted ?? 0)}
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
