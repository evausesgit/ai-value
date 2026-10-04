# AI Value

Suivre l'adoption de l'IA dans les équipes, pour n'importe quelle entreprise :

1. **Adoption** : chacun déclare ses outils IA. Quand le manager le demande, une **campagne de mise à jour** collecte l'état de chacun ;
2. **Connaissances** : auto-évaluation sur 6 domaines et quiz (bibliothèque commune + quiz maison) ;
3. **Feedback** : freins, idées et besoins, anonymes si on le souhaite, avec réponse des leads ;
4. **Use cases** : catalogue des usages concrets (problème, méthode, prompt, gain de temps), que l'on adopte et valide.

Les collaborateurs sont autonomes : ils publient et mettent à jour quand ils veulent. Le manager n'a rien à saisir :
il lance une campagne (outils, auto-évaluation, use cases et temps gagné, ressenti), suit la participation et lit les
résultats. Chaque campagne devient un point sur les courbes d'évolution. Les **team leads** ont le tableau de
bord de leur équipe, et le **management** la vue organisation, avec comparaison des équipes et carte des compétences.

Multilingue : français et anglais (sélecteur FR/EN, langue mémorisée dans le profil). Ajouter une
langue revient à ajouter un dictionnaire (voir `ARCHITECTURE.md`).

Multi-entreprise : une organisation par entreprise, données isolées. Le superadmin crée les
organisations, et chaque admin invite ses équipes par lien.

## Démarrer en local

```bash
# Postgres jetable
docker run -d --name aivalue-pg-dev -e POSTGRES_USER=aivalue -e POSTGRES_PASSWORD=aivalue \
  -e POSTGRES_DB=aivalue -p 127.0.0.1:55432:5432 postgres:16-alpine
cp .env.example .env
uv sync --group dev
uv run alembic upgrade head
uv run python -m scripts.admin demo --admin-email toi@exemple.fr --password 'mot-de-passe-local'
uv run uvicorn app.main:app --port 8820          # API

cd web && npm install && npm run dev               # front sur http://localhost:3020
```

## Administration

```bash
python -m scripts.admin create-org "Nom de la boîte" --admin-email admin@boite.fr   # → lien d'invitation
python -m scripts.admin create-user moi@x.fr --org-slug acme --role admin --superadmin
python -m scripts.admin demo --admin-email moi@x.fr      # organisation de démo remplie
```

En production : `docker exec -it <conteneur api> python -m scripts.admin …`.

## Déploiement

**Chez un client (sur ses serveurs, avec ses données)** : voir [`docs/DEPLOYING.md`](docs/DEPLOYING.md)
(en anglais, pour la DSI : architecture, données stockées, sécurité, installation locale ou
serveur avec `docker-compose.local.yml`, exploitation, checklist RGPD).

**Notre instance hébergée** :
Coolify, build `docker-compose.yml` : seul `web` est exposé, et `api` et `db` restent internes.
Variables : `DB_PASSWORD`, `INTERNAL_API_TOKEN`.

Voir `ARCHITECTURE.md` pour le schéma, les règles d'accès et les définitions des indicateurs.
