"use client";

import Link from "next/link";
import ToolsEditor from "@/components/ToolsEditor";
import { useI18n } from "@/lib/i18n";

export default function ToolsPage() {
  const { m } = useI18n();
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>{m.tools.title}</h1>
          <p className="sub">{m.tools.subtitle}</p>
        </div>
        <Link href="/" className="btn ghost">
          {m.tools.back}
        </Link>
      </div>
      <div className="card">
        <ToolsEditor />
      </div>
      <p className="muted small" style={{ marginTop: "1rem" }}>
        {m.tools.missing} <Link href="/feedback">{m.tools.missingLink}</Link>
        {m.tools.missingEnd}
      </p>
    </main>
  );
}
