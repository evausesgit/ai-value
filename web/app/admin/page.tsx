"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Role, type Team } from "@/lib/api";
import { ROLES, fmtDate } from "@/lib/catalog";
import { hasRole, useSession } from "@/lib/session";

type Tab = "teams" | "members" | "invites" | "tools" | "platform";

export default function AdminPage() {
  const { me } = useSession();
  const isAdmin = hasRole(me, "admin");
  const [tab, setTab] = useState<Tab>("invites");
  const [teams, setTeams] = useState<Team[]>([]);

  const loadTeams = useCallback(() => {
    api<Team[]>("/teams").then(setTeams);
  }, []);
  useEffect(loadTeams, [loadTeams]);

  if (!me) return <main className="page muted">Chargement…</main>;
  if (!hasRole(me, "lead")) return <main className="page"><div className="error">Accès réservé.</div></main>;

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "invites", label: "Invitations", show: true },
    { key: "members", label: "Membres", show: true },
    { key: "teams", label: "Équipes", show: isAdmin },
    { key: "tools", label: "Outils", show: isAdmin },
    { key: "platform", label: "Plateforme", show: me.is_superadmin },
  ];

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          <p className="sub">{isAdmin ? me.org.name : `Équipe ${me.team?.name ?? ""}`}</p>
        </div>
      </div>
      <div className="tabs">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
      </div>
      {tab === "invites" && <Invites teams={teams} isAdmin={isAdmin} />}
      {tab === "members" && <Members teams={teams} isAdmin={isAdmin} myId={me.id} />}
      {tab === "teams" && isAdmin && <Teams teams={teams} reload={loadTeams} />}
      {tab === "tools" && isAdmin && <Tools />}
      {tab === "platform" && me.is_superadmin && <Platform />}
    </main>
  );
}

function inviteUrl(token: string) {
  return `${window.location.origin}/invitation/${token}`;
}

function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-box">
      <input readOnly value={value} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="small"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}

interface InviteRow {
  id: number;
  email: string | null;
  role: Role;
  team_id: number | null;
  multi_use: boolean;
  used_count: number;
  expires_at: string;
  expired: boolean;
}

function Invites({ teams, isAdmin }: { teams: Team[]; isAdmin: boolean }) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [form, setForm] = useState({ email: "", role: "member" as Role, team_id: "", multi_use: true });
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<InviteRow[]>("/admin/invites").then(setRows);
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<InviteRow & { token: string }>("/admin/invites", {
        body: {
          email: form.email || null,
          role: form.role,
          team_id: form.team_id ? Number(form.team_id) : null,
          multi_use: !form.email && form.multi_use,
        },
      });
      setLink(inviteUrl(r.token));
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revoke(id: number) {
    await api(`/admin/invites/${id}`, { method: "DELETE" });
    load();
  }

  const teamName = (id: number | null) => teams.find((t) => t.id === id)?.name ?? "—";

  return (
    <>
      <form className="card" onSubmit={create}>
        <h2>Inviter des personnes</h2>
        <p className="muted small">
          Un lien d&apos;équipe peut être partagé à tout le monde (Slack, mail…). Un lien nominatif ne sert qu&apos;une fois.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="row">
          <div className="field grow">
            <label htmlFor="iemail">
              Email <span className="hint">(vide = lien d&apos;équipe)</span>
            </label>
            <input id="iemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {isAdmin ? (
            <>
              <div className="field grow">
                <label htmlFor="iteam">Équipe</label>
                <select id="iteam" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                  <option value="">Aucune</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field grow">
                <label htmlFor="irole">Rôle</label>
                <select id="irole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {Object.entries(ROLES).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>
        <button type="submit">Générer le lien</button>
        {link ? (
          <div style={{ marginTop: "1rem" }}>
            <div className="success" style={{ marginBottom: "0.5rem" }}>
              Lien créé — il ne sera plus affiché ensuite, copie-le maintenant.
            </div>
            <CopyBox value={link} />
          </div>
        ) : null}
      </form>

      <div className="card">
        <h2>Invitations actives</h2>
        {rows.length === 0 ? (
          <div className="empty small">Aucune invitation.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pour</th>
                  <th>Équipe</th>
                  <th>Rôle</th>
                  <th className="num">Utilisée</th>
                  <th>Expire</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.email ?? <span className="pill blue">Lien d&apos;équipe</span>}</td>
                    <td>{teamName(r.team_id)}</td>
                    <td>{ROLES[r.role]}</td>
                    <td className="num">{r.used_count}</td>
                    <td>{r.expired ? <span className="pill crit">Expirée</span> : fmtDate(r.expires_at)}</td>
                    <td className="num">
                      <button className="danger small" onClick={() => revoke(r.id)}>
                        Révoquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

interface MemberRow {
  id: number;
  name: string;
  email: string;
  job: string;
  role: Role;
  team_id: number | null;
  active: boolean;
  last_seen_at: string | null;
}

function Members({ teams, isAdmin, myId }: { teams: Team[]; isAdmin: boolean; myId: number }) {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<MemberRow[]>("/admin/members").then(setRows);
  }, []);
  useEffect(load, [load]);

  async function update(m: MemberRow, patch: Partial<MemberRow>) {
    setError("");
    const next = { ...m, ...patch };
    try {
      await api(`/admin/members/${m.id}`, {
        method: "PATCH",
        body: { role: next.role, team_id: next.team_id, active: next.active },
      });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const filtered = rows.filter((r) => `${r.name} ${r.email} ${r.job}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="card">
      <div className="card-head">
        <h2>Membres ({rows.length})</h2>
        <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Équipe</th>
              <th>Rôle</th>
              <th>Dernière visite</th>
              {isAdmin ? <th>Actif</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                <td>
                  {m.name || m.email}
                  <div className="muted tiny">
                    {m.email}
                    {m.job ? ` · ${m.job}` : ""}
                  </div>
                </td>
                <td>
                  {isAdmin ? (
                    <select value={m.team_id ?? ""} onChange={(e) => update(m, { team_id: e.target.value ? Number(e.target.value) : null })} style={{ width: "auto" }}>
                      <option value="">Aucune</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    teams.find((t) => t.id === m.team_id)?.name ?? "—"
                  )}
                </td>
                <td>
                  {isAdmin && m.id !== myId ? (
                    <select value={m.role} onChange={(e) => update(m, { role: e.target.value as Role })} style={{ width: "auto" }}>
                      {Object.entries(ROLES).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLES[m.role]
                  )}
                </td>
                <td className="muted small">{m.last_seen_at ? fmtDate(m.last_seen_at) : "Jamais"}</td>
                {isAdmin ? (
                  <td>
                    {m.id !== myId ? (
                      <input type="checkbox" checked={m.active} onChange={(e) => update(m, { active: e.target.checked })} style={{ width: "auto" }} aria-label="Compte actif" />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Teams({ teams, reload }: { teams: Team[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/teams", { body: { name } });
      setName("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function rename(t: Team) {
    const n = prompt("Nouveau nom", t.name);
    if (!n || n === t.name) return;
    try {
      await api(`/admin/teams/${t.id}`, { method: "PUT", body: { name: n } });
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function remove(t: Team) {
    if (!confirm(`Supprimer l'équipe ${t.name} ? Ses ${t.members} membres resteront sans équipe.`)) return;
    await api(`/admin/teams/${t.id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="card">
      <h2>Équipes</h2>
      {error ? <div className="error">{error}</div> : null}
      <form className="row" onSubmit={add} style={{ marginBottom: "1rem" }}>
        <input className="grow" required placeholder="Nom de la nouvelle équipe" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Ajouter</button>
      </form>
      <table>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.name}</strong>
              </td>
              <td className="num muted">
                {t.members} membre{t.members > 1 ? "s" : ""}
              </td>
              <td className="num">
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="ghost small" onClick={() => rename(t)}>
                    Renommer
                  </button>
                  <button className="danger small" onClick={() => remove(t)}>
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ToolRow {
  id: number;
  name: string;
  category: string;
  active: boolean;
}

function Tools() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [form, setForm] = useState({ name: "", category: "assistant" });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<ToolRow[]>("/admin/tools").then(setRows);
  }, []);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/admin/tools", { body: form });
      setForm({ ...form, name: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function toggle(t: ToolRow) {
    await api(`/admin/tools/${t.id}`, { method: "PUT", body: { name: t.name, category: t.category, active: !t.active } });
    load();
  }

  const cats = ["assistant", "code", "recherche", "image", "productivite", "interne"];
  return (
    <div className="card">
      <h2>Outils proposés aux collaborateurs</h2>
      <p className="muted small">Ajoute vos outils internes ; désactive ceux qui ne sont pas autorisés chez vous.</p>
      {error ? <div className="error">{error}</div> : null}
      <form className="row" onSubmit={add} style={{ marginBottom: "1rem" }}>
        <input className="grow" required placeholder="Nom de l'outil" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: "auto" }}>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit">Ajouter</button>
      </form>
      <table>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ opacity: t.active ? 1 : 0.5 }}>
              <td>
                <strong>{t.name}</strong>
              </td>
              <td className="muted">{t.category}</td>
              <td className="num">
                <button className="ghost small" onClick={() => toggle(t)}>
                  {t.active ? "Désactiver" : "Réactiver"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface OrgRow {
  id: number;
  name: string;
  slug: string;
  members: number;
}

function Platform() {
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [form, setForm] = useState({ name: "", admin_email: "" });
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<OrgRow[]>("/platform/orgs").then(setRows);
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ admin_invite_token: string }>("/platform/orgs", {
        body: { name: form.name, admin_email: form.admin_email || null },
      });
      setLink(inviteUrl(r.admin_invite_token));
      setForm({ name: "", admin_email: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <form className="card" onSubmit={create}>
        <h2>Nouvelle organisation</h2>
        <p className="muted small">
          Crée l&apos;espace d&apos;une entreprise et envoie le lien à son premier admin : il crée ses équipes et invite ses collègues.
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="row">
          <div className="field grow">
            <label htmlFor="oname">Nom de l&apos;entreprise</label>
            <input id="oname" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field grow">
            <label htmlFor="oemail">
              Email du premier admin <span className="hint">(facultatif)</span>
            </label>
            <input id="oemail" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
          </div>
        </div>
        <button type="submit">Créer</button>
        {link ? (
          <div style={{ marginTop: "1rem" }}>
            <div className="success" style={{ marginBottom: "0.5rem" }}>
              Organisation créée. Lien d&apos;invitation de l&apos;admin (valable 14 jours, usage unique) :
            </div>
            <CopyBox value={link} />
          </div>
        ) : null}
      </form>
      <div className="card">
        <h2>Organisations</h2>
        <table>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>{o.name}</strong>
                  <div className="muted tiny">{o.slug}</div>
                </td>
                <td className="num">
                  {o.members} compte{o.members > 1 ? "s" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
