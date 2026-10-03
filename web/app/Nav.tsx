"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { hasRole, useSession } from "@/lib/session";

export default function Nav() {
  const { me } = useSession();
  const path = usePathname();
  if (!me || path.startsWith("/login") || path.startsWith("/invitation")) {
    return (
      <nav className="nav">
        <div className="nav-inner">
          <span className="brand">
            <span className="dot">AI</span> AI Value
          </span>
        </div>
      </nav>
    );
  }

  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/", label: "Mon espace", show: true },
    { href: "/usages", label: "Use cases", show: true },
    { href: "/competences", label: "Compétences", show: true },
    { href: "/feedback", label: "Feedback", show: true },
    { href: "/equipe", label: "Mon équipe", show: hasRole(me, "lead") },
    { href: "/organisation", label: "Organisation", show: hasRole(me, "manager") },
    { href: "/admin", label: "Admin", show: hasRole(me, "admin") || hasRole(me, "lead") },
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
          <Link href="/profil" className="avatar" title={`${me.name} — profil`}>
            {initials}
          </Link>
          <button className="ghost small" onClick={logout}>
            Sortir
          </button>
        </div>
      </div>
    </nav>
  );
}
