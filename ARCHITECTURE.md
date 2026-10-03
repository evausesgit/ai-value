# Architecture

```
navigateur ──► web (Next 16, :3000) ──/api/*──► api (FastAPI, :8820) ──► db (Postgres 16)
               proxy.ts : pages sans cookie → /login ; ajoute X-Internal-Token sur /api
```

- **Auth** : email + mot de passe (scrypt). L'API pose un cookie `aivalue_session` httpOnly (jeton
  opaque, seule son empreinte SHA-256 est stockée, 30 jours). Comptes créés uniquement par
  **invitation** : un lien nominatif à usage unique, ou un lien d'équipe réutilisable (14 jours).
- **Multi-entreprise** : chaque table métier porte `org_id`. Toute lecture filtre sur l'org de
  l'utilisateur connecté. Les quiz `org_id NULL` forment la bibliothèque commune.

## Rôles

| Rôle | Peut |
|---|---|
| member | tout l'espace perso, publier des use cases, feedback, quiz |
| lead | + tableau de bord de **son** équipe, boîte feedback de son équipe, valider les use cases de son équipe, inviter des membres dans son équipe, créer des quiz |
| manager | + toutes les équipes, vue organisation, toute la boîte feedback |
| admin | + équipes, membres (rôles, équipes, désactivation), invitations de tout rôle, outils |
| `is_superadmin` | + créer des organisations (onglet Plateforme) |

## Tables

`orgs`, `teams`, `users`, `sessions`, `invites` · adoption : `tools` (catalogue par org),
`tool_usages` (état courant déclaré), `pulses` (une ligne par utilisateur et par semaine, clé =
lundi, `team_id` figé au moment de la réponse) · connaissances : `skill_assessments`, `quizzes`,
`quiz_questions`, `quiz_attempts` · `use_cases`, `use_case_reactions` (`like` | `adopt`) ·
`feedbacks` (`author_id` NULL si anonyme : l'auteur n'est stocké nulle part).

Les listes fermées (fréquences, freins, domaines, catégories…) sont dans `app/catalog.py`, et leurs
libellés dans `web/lib/catalog.ts`.

## Indicateurs (app/api/dashboards.py)

- **Adoption** : part des membres actifs déclarant au moins un outil utilisé chaque jour ou chaque semaine.
- **Utilisent l'IA cette semaine** : part des répondants au pulse avec un usage au moins égal à « plusieurs fois ».
- **Participation** : répondants au pulse / membres.
- **Intensité** : niveau d'usage moyen (0 à 4).
- **Temps gagné** : somme des heures déclarées au pulse.
- **Gain potentiel des use cases** : minutes/semaine déclarées × (auteur + adoptants).
- **Semaine de référence** : la semaine courante si elle a assez de réponses (≥ 3 et ≥ 1/3 des
  membres), sinon la précédente.
- **Anonymat** : satisfaction, heures, freins et verbatims sont masqués sous 3 répondants
  (`MIN_GROUP_SIZE`). Le tableau des membres d'un lead ne montre que l'activité (nombre de pulses,
  outils, use cases, quiz), jamais les réponses.

## Suite prévue

- Métriques de delivery (lead time, cycle time) via GitHub/GitLab et Jira/Linear, corrélées à l'adoption.
- Orchestrateur, sous forme de gestionnaire de tickets.
- SSO Google / Microsoft.
