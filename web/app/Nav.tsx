"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LangSwitch from "@/components/LangSwitch";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { hasRole, useSession } from "@/lib/session";

export default function Nav() {
  const { me } = useSession();
  const { m } = useI18n();
  const path = usePathname();
  if (!me || path.startsWith("/login") || path.startsWith("/invitation")) {
    return (
      <nav className="nav">
        <div className="nav-inner">
          <span className="brand">
            <span className="dot">AI</span> AI Value
          </span>
          <div style={{ flex: 1 }} />
          <LangSwitch />
        </div>
      </nav>
    );
  }

  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/", label: m.nav.home, show: true },
    { href: "/usages", label: m.nav.usecases, show: true },
    { href: "/competences", label: m.nav.skills, show: true },
    { href: "/feedback", label: m.nav.feedback, show: true },
    { href: "/campagnes", label: m.nav.campaigns, show: hasRole(me, "lead") },
    { href: "/equipe", label: m.nav.team, show: hasRole(me, "lead") },
    { href: "/organisation", label: m.nav.org, show: hasRole(me, "manager") },
    { href: "/admin", label: m.nav.admin, show: hasRole(me, "lead") },
  ];
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const initials = (me.name || me.email)
    .split(/[\s.@]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="dot">AI</span> AI Value
        </Link>
        <div className="nav-links">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link key={l.href} href={l.href} className={isActive(l.href) ? "active" : ""}>
                {l.label}
              </Link>
            ))}
        </div>
        <div className="nav-user">
          <span className="org-name">{me.org.name}</span>
          <LangSwitch />
          <Link href="/profil" className="avatar" title={`${me.name} — ${m.common.profile}`}>
            {initials}
          </Link>
          <button className="ghost small" onClick={logout}>
            {m.common.signOut}
          </button>
        </div>
      </div>
    </nav>
  );
}
