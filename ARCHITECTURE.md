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
| lead | + tableau de bord de **son** équipe, campagnes pour son équipe, boîte feedback de son équipe, valider les use cases de son équipe, inviter des membres dans son équipe, créer des quiz |
| manager | + toutes les équipes, vue organisation, campagnes sur toute l'org ou des équipes choisies, toute la boîte feedback |
| admin | + équipes, membres (rôles, équipes, désactivation), invitations de tout rôle, outils |
| `is_superadmin` | + créer des organisations (onglet Plateforme) |

## Tables

`orgs`, `teams`, `users`, `sessions`, `invites` · adoption : `tools` (catalogue par org),
`tool_usages` (état courant déclaré) · campagnes : `campaigns` (demande : équipes visées — vide =
toute l'org —, éléments demandés, date limite), `campaign_participants` (une ligne par personne
visée ; à l'envoi, **photo** de son état : outils, compétences, use cases, minutes gagnées,
ressenti ; `team_id` figé) · connaissances : `skill_assessments`, `quizzes`,
`quiz_questions`, `quiz_attempts` · `use_cases`, `use_case_reactions` (`like` | `adopt`) ·
`feedbacks` (`author_id` NULL si anonyme : l'auteur n'est stocké nulle part).

Les listes fermées (fréquences, freins, domaines, catégories…) sont dans `app/catalog.py`, et leurs
libellés dans `web/lib/catalog.ts`.

## Campagnes de mise à jour (app/api/campaigns.py)

Pas de saisie récurrente imposée : un lead (pour son équipe) ou le management (org entière ou
équipes choisies) **lance une campagne** : titre, message, date limite, et ce qu'il demande
(`tools`, `skills`, `usecases`, `checkin`). Chaque personne visée la voit sur « Mon espace »,
met à jour sur une seule page, valide chaque étape (« C'est à jour » ; le ressenti est validé en
le remplissant), puis envoie. On photographie alors son état. Elle peut renvoyer jusqu'à la
clôture. Le demandeur suit la participation, la liste des personnes en attente (avec un message
de relance à copier) et les résultats comparés à la campagne précédente, puis il peut prolonger,
clore ou supprimer la campagne. En dehors des campagnes, chacun met à jour son profil, ses use
cases et son feedback quand il veut.

## Indicateurs (app/api/dashboards.py, app/campaign_stats.py)

- **État actuel** (en direct) : adoption = part des membres déclarant au moins un outil utilisé
  chaque jour ou chaque semaine ; niveau de compétences = moyenne des auto-évaluations ;
  **temps gagné** = minutes/semaine des use cases × (auteur + adoptants).
- **Évolution** : un point par campagne, calculé sur la photo de ses répondants (participation,
  adoption, temps gagné par personne et par semaine, compétences, satisfaction). Le temps photographié
  d'une personne correspond à ses use cases plus ceux qu'elle a adoptés.
- Comparaisons (écarts, tableau des équipes, ressenti) : la **dernière campagne close**. Une
  campagne en cours sous-estime la participation.
- **Anonymat** : satisfaction, freins et verbatims masqués sous 3 répondants
  (`MIN_GROUP_SIZE`). Les vues lead ou manager ne montrent que l'activité individuelle (campagnes
  répondues, auto-évaluation faite, outils, use cases, quiz), jamais le ressenti.

## Langues (fr, en)

- **Front** : `web/lib/i18n.tsx` (sans dépendance). Dictionnaires typés `web/messages/fr.ts`
  (référence) et `en.ts` (même forme, imposée par le type `Messages`). Langue = `users.lang` si
  connecté, sinon choix mémorisé dans le navigateur, sinon langue du navigateur. Sélecteur FR/EN
  dans la barre de navigation et dans le profil. Dates et nombres formatés selon la langue.
- **API** : messages d'erreur écrits en français, traduits par le gestionnaire d'exceptions
  (`app/i18n.py`) selon `Accept-Language`, envoyé par le front.
- **Contenus** : les quiz de la bibliothèque sont traduits (`app/quiz_i18n.py`). Ce que saisissent
  les utilisateurs (use cases, feedback, campagnes, quiz maison) reste dans sa langue d'origine.
- **Ajouter une langue** : `web/messages/xx.ts` + `DICTS` dans `web/lib/i18n.tsx`, `MESSAGES`
  et `PATTERNS` dans `app/i18n.py`, `QUIZ_TRANSLATIONS` dans `app/quiz_i18n.py`, et le
  `Literal` de `Lang` dans `app/api/auth.py`.

## Suite prévue

- Métriques de delivery (lead time, cycle time) via GitHub/GitLab et Jira/Linear, corrélées à l'adoption.
- Orchestrateur, sous forme de gestionnaire de tickets.
- SSO Google / Microsoft.
