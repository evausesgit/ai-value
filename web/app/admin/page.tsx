"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Role, type Team } from "@/lib/api";
import { fmtDate } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
import { hasRole, useSession } from "@/lib/session";

type Tab = "teams" | "members" | "invites" | "tools" | "platform";

export default function AdminPage() {
  const { me } = useSession();
  const { m } = useI18n();
  const isAdmin = hasRole(me, "admin");
  const [tab, setTab] = useState<Tab>("invites");
  const [teams, setTeams] = useState<Team[]>([]);

  const loadTeams = useCallback(() => {
    api<Team[]>("/teams").then(setTeams);
  }, []);
  useEffect(loadTeams, [loadTeams]);

  if (!me) return <main className="page muted">{m.common.loading}</main>;
  if (!hasRole(me, "lead")) return <main className="page"><div className="error">{m.common.restricted}</div></main>;

  const tabs: { key: Tab; show: boolean }[] = [
    { key: "invites", show: true },
    { key: "members", show: true },
    { key: "teams", show: isAdmin },
    { key: "tools", show: isAdmin },
    { key: "platform", show: me.is_superadmin },
  ];

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>{m.admin.title}</h1>
          <p className="sub">{isAdmin ? me.org.name : m.admin.teamOf(me.team?.name ?? "")}</p>
        </div>
      </div>
      <div className="tabs">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {m.admin.tabs[t.key]}
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
  const { m } = useI18n();
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
        {copied ? m.common.copied : m.common.copy}
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
  const { m } = useI18n();
  const a = m.admin;
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
        <h2>{a.inviteTitle}</h2>
        <p className="muted small">
          {a.inviteHelp}
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="row">
          <div className="field grow">
            <label htmlFor="iemail">
              {a.email} <span className="hint">{a.emailHint}</span>
            </label>
            <input id="iemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {isAdmin ? (
            <>
              <div className="field grow">
                <label htmlFor="iteam">{a.team}</label>
                <select id="iteam" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                  <option value="">{m.common.none}</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field grow">
                <label htmlFor="irole">{a.role}</label>
                <select id="irole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  {Object.entries(m.catalog.roles).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>
        <button type="submit">{a.generate}</button>
        {link ? (
          <div style={{ marginTop: "1rem" }}>
            <div className="success" style={{ marginBottom: "0.5rem" }}>
              {a.linkCreated}
            </div>
            <CopyBox value={link} />
          </div>
        ) : null}
      </form>

      <div className="card">
        <h2>{a.activeInvites}</h2>
        {rows.length === 0 ? (
          <div className="empty small">{a.noInvite}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{a.colFor}</th>
                  <th>{a.team}</th>
                  <th>{a.role}</th>
                  <th className="num">{a.colUsed}</th>
                  <th>{a.colExpires}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.email ?? <span className="pill blue">{a.teamLink}</span>}</td>
                    <td>{teamName(r.team_id)}</td>
                    <td>{m.catalog.roles[r.role]}</td>
                    <td className="num">{r.used_count}</td>
                    <td>{r.expired ? <span className="pill crit">{a.expired}</span> : fmtDate(r.expires_at)}</td>
                    <td className="num">
                      <button className="danger small" onClick={() => revoke(r.id)}>
                        {a.revoke}
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
  const { m } = useI18n();
  const a = m.admin;
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
        <h2>{a.membersCount(rows.length)}</h2>
        <input placeholder={m.common.search} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{a.colName}</th>
              <th>{a.team}</th>
              <th>{a.role}</th>
              <th>{a.colLastSeen}</th>
              {isAdmin ? <th>{a.colActive}</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((mb) => (
              <tr key={mb.id} style={{ opacity: mb.active ? 1 : 0.5 }}>
                <td>
                  {mb.name || mb.email}
                  <div className="muted tiny">
                    {mb.email}
                    {mb.job ? ` · ${mb.job}` : ""}
                  </div>
                </td>
                <td>
                  {isAdmin ? (
                    <select value={mb.team_id ?? ""} onChange={(e) => update(mb, { team_id: e.target.value ? Number(e.target.value) : null })} style={{ width: "auto" }}>
                      <option value="">{m.common.none}</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    teams.find((t) => t.id === mb.team_id)?.name ?? "—"
                  )}
                </td>
                <td>
                  {isAdmin && mb.id !== myId ? (
                    <select value={mb.role} onChange={(e) => update(mb, { role: e.target.value as Role })} style={{ width: "auto" }}>
                      {Object.entries(m.catalog.roles).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    m.catalog.roles[mb.role]
                  )}
                </td>
                <td className="muted small">{mb.last_seen_at ? fmtDate(mb.last_seen_at) : m.common.never}</td>
                {isAdmin ? (
                  <td>
                    {mb.id !== myId ? (
                      <input type="checkbox" checked={mb.active} onChange={(e) => update(mb, { active: e.target.checked })} style={{ width: "auto" }} aria-label={a.activeAria} />
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
  const { m } = useI18n();
  const a = m.admin;
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
    const n = prompt(a.renamePrompt, t.name);
    if (!n || n === t.name) return;
    try {
      await api(`/admin/teams/${t.id}`, { method: "PUT", body: { name: n } });
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function remove(t: Team) {
    if (!confirm(a.confirmDeleteTeam(t.name, t.members))) return;
    await api(`/admin/teams/${t.id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="card">
      <h2>{a.teams}</h2>
      {error ? <div className="error">{error}</div> : null}
      <form className="row" onSubmit={add} style={{ marginBottom: "1rem" }}>
        <input className="grow" required placeholder={a.newTeamPh} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">{m.common.add}</button>
      </form>
      <table>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.name}</strong>
              </td>
              <td className="num muted">
                {m.common.members(t.members)}
              </td>
              <td className="num">
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="ghost small" onClick={() => rename(t)}>
                    {a.rename}
                  </button>
                  <button className="danger small" onClick={() => remove(t)}>
                    {m.common.delete}
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
  const { m } = useI18n();
  const a = m.admin;
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
      <h2>{a.toolsTitle}</h2>
      <p className="muted small">{a.toolsHelp}</p>
      {error ? <div className="error">{error}</div> : null}
      <form className="row" onSubmit={add} style={{ marginBottom: "1rem" }}>
        <input className="grow" required placeholder={a.toolNamePh} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: "auto" }}>
          {cats.map((c) => (
            <option key={c} value={c}>
              {m.catalog.toolCategories[c] ?? c}
            </option>
          ))}
        </select>
        <button type="submit">{m.common.add}</button>
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
                  {t.active ? a.disable : a.enable}
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
  const { m } = useI18n();
  const a = m.admin;
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
        <h2>{a.newOrg}</h2>
        <p className="muted small">
          {a.newOrgHelp}
        </p>
        {error ? <div className="error">{error}</div> : null}
        <div className="row">
          <div className="field grow">
            <label htmlFor="oname">{a.orgName}</label>
            <input id="oname" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field grow">
            <label htmlFor="oemail">
              {a.firstAdmin} <span className="hint">{a.optional}</span>
            </label>
            <input id="oemail" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
          </div>
        </div>
        <button type="submit">{a.create}</button>
        {link ? (
          <div style={{ marginTop: "1rem" }}>
            <div className="success" style={{ marginBottom: "0.5rem" }}>
              {a.orgCreated}
            </div>
            <CopyBox value={link} />
          </div>
        ) : null}
      </form>
      <div className="card">
        <h2>{a.orgs}</h2>
        <table>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>{o.name}</strong>
                  <div className="muted tiny">{o.slug}</div>
                </td>
                <td className="num">
                  {a.accounts(o.members)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
