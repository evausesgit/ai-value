# CLAUDE.md

AI Value : suivi de l'adoption de l'IA dans les équipes (adoption déclarative, connaissances,
feedback, use cases), multi-entreprise. **`ARCHITECTURE.md` fait foi** (rôles, tables,
définitions des indicateurs) : le garder synchronisé avec le code. Langue du projet : français.

## Commandes

- Tests : `uv run --group dev pytest -q` (SQLite en mémoire) · Lint : `uv run --group dev ruff check`
- Front : `cd web && npx tsc --noEmit && npx next build`
- Migrations : `uv run alembic revision --autogenerate -m "…"` contre un Postgres réel, puis
  `alembic upgrade head` (l'API les joue au démarrage du conteneur).
- Démo : `python -m scripts.admin demo --admin-email …`

## Règles

- Toute requête métier filtre sur `user.org_id`. Ne jamais renvoyer une ligne d'une autre org.
- Les listes fermées se trouvent dans `app/catalog.py`, et leurs libellés dans `web/lib/catalog.ts` : modifier les deux.
- Anonymat : agrégats de pulse masqués sous `min_group_size`. Un feedback anonyme a `author_id`
  NULL. Jamais de réponse individuelle au pulse dans une vue lead ou manager.
- Graphiques : méthode dataviz (une teinte pour les grandeurs, rampe bleue ordinale/séquentielle,
  infobulle au survol, pas de double axe), tokens dans `web/app/globals.css`.
