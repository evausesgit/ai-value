import Link from "next/link";
import ToolsEditor from "@/components/ToolsEditor";

export default function ToolsPage() {
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Mes outils IA</h1>
          <p className="sub">Indique ceux que tu utilises et à quelle fréquence. Enregistré automatiquement.</p>
        </div>
        <Link href="/" className="btn ghost">
          ← Mon espace
        </Link>
      </div>
      <div className="card">
        <ToolsEditor />
      </div>
      <p className="muted small" style={{ marginTop: "1rem" }}>
        Un outil manque ? Signale-le via le <Link href="/feedback">feedback</Link>, ton admin pourra l&apos;ajouter.
      </p>
    </main>
  );
}
