"""Organisation de démonstration « Acme Industries » : 8 équipes, ~50 personnes,
12 semaines de pulses, use cases, feedback, quiz. Données fictives, déterministes
(graine fixe), pour montrer les tableaux de bord remplis.
"""

from __future__ import annotations

import random
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.catalog import DOMAINS
from app.models import (
    Feedback,
    Org,
    Pulse,
    Quiz,
    QuizAttempt,
    SkillAssessment,
    Team,
    Tool,
    ToolUsage,
    UseCase,
    UseCaseReaction,
    User,
)
from app.provisioning import create_org, slugify
from app.security import hash_password
from app.weeks import last_weeks

DEMO_NAME = "Acme Industries (démo)"
DEMO_DOMAIN = "demo.acme.test"

# équipe → (propension à adopter 0..1, métiers, outils de prédilection)
TEAMS: dict[str, tuple[float, list[str], list[str]]] = {
    "Direction": (
        0.6,
        ["Directrice générale", "Directeur des opérations", "Directrice financière"],
        ["ChatGPT", "Microsoft Copilot", "Claude"],
    ),
    "Produit": (
        0.72,
        ["Product manager", "Product designer", "Product owner"],
        ["Claude", "ChatGPT", "Notion AI", "Perplexity"],
    ),
    "Tech": (
        0.86,
        ["Développeuse", "Développeur", "Tech lead", "SRE"],
        ["GitHub Copilot", "Cursor", "Claude Code", "Claude", "ChatGPT"],
    ),
    "Data": (
        0.9,
        ["Data analyst", "Data scientist", "Data engineer"],
        ["Claude", "ChatGPT", "GitHub Copilot", "NotebookLM"],
    ),
    "Marketing": (
        0.76,
        ["Chargée de marketing", "Content manager", "Growth"],
        ["ChatGPT", "Midjourney", "Claude", "Le Chat (Mistral)", "Perplexity"],
    ),
    "Ventes": (
        0.46,
        ["Commercial", "Account manager", "Business developer"],
        ["ChatGPT", "Microsoft Copilot", "Perplexity"],
    ),
    "Support client": (
        0.6,
        ["Chargé de support", "Responsable support"],
        ["ChatGPT", "Microsoft Copilot", "Le Chat (Mistral)"],
    ),
    "RH": (
        0.36,
        ["Chargée RH", "Recruteuse", "Responsable formation"],
        ["ChatGPT", "Microsoft Copilot"],
    ),
    "Finance": (
        0.4,
        ["Contrôleur de gestion", "Comptable", "Analyste financier"],
        ["Microsoft Copilot", "ChatGPT", "Gemini"],
    ),
}
SIZES = {
    "Direction": 3,
    "Produit": 6,
    "Tech": 9,
    "Data": 5,
    "Marketing": 6,
    "Ventes": 7,
    "Support client": 6,
    "RH": 4,
    "Finance": 5,
}

FIRST = [
    "Camille",
    "Léa",
    "Hugo",
    "Inès",
    "Lucas",
    "Manon",
    "Nathan",
    "Chloé",
    "Yanis",
    "Sarah",
    "Louis",
    "Emma",
    "Adam",
    "Jade",
    "Gabriel",
    "Lina",
    "Raphaël",
    "Zoé",
    "Arthur",
    "Alice",
    "Mehdi",
    "Julie",
    "Théo",
    "Nora",
    "Paul",
    "Clara",
    "Samir",
    "Agathe",
    "Victor",
    "Maëlle",
    "Karim",
    "Elsa",
    "Antoine",
    "Salomé",
    "Bastien",
    "Anaïs",
    "Moussa",
    "Laura",
    "Quentin",
    "Pauline",
    "Rayan",
    "Margaux",
    "Julien",
    "Yasmine",
    "Simon",
    "Lou",
    "Thomas",
    "Mila",
    "Benoît",
    "Aya",
]
LAST = [
    "Martin",
    "Bernard",
    "Dubois",
    "Thomas",
    "Robert",
    "Richard",
    "Petit",
    "Durand",
    "Leroy",
    "Moreau",
    "Simon",
    "Laurent",
    "Lefebvre",
    "Michel",
    "Garcia",
    "David",
    "Bertrand",
    "Roux",
    "Vincent",
    "Fournier",
    "Morel",
    "Girard",
    "André",
    "Mercier",
    "Dupont",
    "Lambert",
    "Bonnet",
    "François",
    "Martinez",
    "Benali",
    "Nguyen",
    "Haddad",
    "Diallo",
    "Cohen",
    "Rousseau",
]

COMMENTS = [
    "J'ai gagné beaucoup de temps sur les comptes rendus de réunion.",
    "Toujours pas de licence Copilot, je dois passer par la version gratuite.",
    "Pas sûr de ce qu'on a le droit de mettre dedans côté données clients.",
    "Super pour démarrer un document, moins pour les chiffres.",
    "Il faudrait une formation sur les prompts pour notre métier.",
    "Les use cases de l'équipe Data m'ont donné plein d'idées.",
    "Semaine chargée, pas eu le temps d'explorer.",
    "Les réponses sur notre réglementation sont souvent fausses.",
    "Claude m'aide énormément pour relire mes specs.",
    "J'aimerais un outil validé pour analyser des fichiers Excel.",
]

USE_CASES = [
    (
        "Tech",
        "Générer les tests unitaires d'un module existant",
        "code",
        "Écrire les tests d'un vieux module sans tests prend des jours.",
        "Je donne le fichier au modèle avec nos conventions de test, il propose une première "
        "batterie ; je relis, j'ajuste les cas limites et je lance.",
        "Voici un module Python et nos conventions pytest. Écris des tests couvrant les cas "
        "nominaux, les erreurs et les cas limites. Ne modifie pas le code testé.",
        ["Claude Code", "GitHub Copilot"],
        180,
        "low",
    ),
    (
        "Tech",
        "Relire une pull request avant la revue humaine",
        "code",
        "Les revues prennent du temps et laissent passer des erreurs simples.",
        "Avant de demander une revue, je fais relire le diff par l'IA : bugs probables, nommage, "
        "tests manquants. La revue humaine se concentre sur l'architecture.",
        "Relis ce diff comme un développeur senior. Liste les bugs probables, puis les "
        "améliorations, par ordre d'importance.",
        ["Claude", "Cursor"],
        90,
        "low",
    ),
    (
        "Tech",
        "Expliquer un incident de prod à partir des logs",
        "analyse",
        "Lire des milliers de lignes de logs pendant un incident.",
        "Je colle les logs anonymisés, l'IA propose une chronologie et des hypothèses que je "
        "vérifie une à une.",
        "",
        ["Claude"],
        60,
        "medium",
    ),
    (
        "Data",
        "Écrire et documenter des requêtes SQL",
        "analyse",
        "Les métiers attendent des extractions, et la doc des requêtes n'existe pas.",
        "Je décris le besoin et le schéma ; l'IA écrit la requête et un commentaire explicatif. "
        "Je vérifie sur un échantillon.",
        "Voici le schéma des tables (sans données). Écris la "
        "requête SQL pour : … Explique chaque jointure.",
        ["Claude", "ChatGPT"],
        150,
        "low",
    ),
    (
        "Data",
        "Résumer un tableau de bord pour le comité de direction",
        "synthese",
        "Transformer 20 graphiques en trois messages clés chaque mois.",
        "Je fournis les chiffres clés exportés, l'IA rédige un premier jet de synthèse que "
        "j'édite.",
        "",
        ["Claude"],
        120,
        "medium",
    ),
    (
        "Produit",
        "Transformer des notes d'entretien utilisateur en insights",
        "synthese",
        "Dix entretiens par sprint, des pages de notes non exploitées.",
        "Je colle les notes anonymisées, l'IA regroupe par thème avec citations ; je valide et "
        "priorise.",
        "Regroupe ces notes d'entretiens par thème. Pour chaque thème : 1 phrase "
        "de synthèse et 2 citations exactes.",
        ["Claude", "NotebookLM"],
        240,
        "medium",
    ),
    (
        "Produit",
        "Rédiger une première version de spec fonctionnelle",
        "redaction",
        "La page blanche sur chaque nouvelle fonctionnalité.",
        "Je donne le contexte, les utilisateurs et les contraintes ; l'IA propose un plan de spec "
        "et des critères d'acceptation que je complète.",
        "",
        ["Claude", "Notion AI"],
        120,
        "low",
    ),
    (
        "Marketing",
        "Décliner un article en posts LinkedIn",
        "redaction",
        "Chaque article devait être réécrit à la main pour chaque réseau.",
        "Un article → 5 posts dans notre ton, que je relis et ajuste.",
        "Voici un article et trois exemples de nos posts LinkedIn. Propose 5 posts dans le même "
        "ton, 600 caractères max.",
        ["ChatGPT", "Claude"],
        150,
        "low",
    ),
    (
        "Marketing",
        "Visuels d'illustration pour le blog",
        "creatif",
        "Banques d'images génériques et coûteuses.",
        "Génération d'illustrations dans notre charte, retouchées par la graphiste.",
        "",
        ["Midjourney"],
        90,
        "medium",
    ),
    (
        "Marketing",
        "Veille concurrentielle hebdomadaire",
        "recherche",
        "Suivre 10 concurrents à la main prenait une demi-journée.",
        "Recherche web outillée avec sources, synthèse en 10 lignes, vérification des liens.",
        "",
        ["Perplexity"],
        120,
        "low",
    ),
    (
        "Ventes",
        "Préparer un rendez-vous client en 10 minutes",
        "recherche",
        "Arriver en rendez-vous sans connaître l'actualité du client.",
        "Recherche sur l'entreprise (actualités, enjeux, interlocuteurs publics), puis questions "
        "de découverte adaptées.",
        "",
        ["Perplexity", "ChatGPT"],
        90,
        "low",
    ),
    (
        "Ventes",
        "Rédiger les relances après rendez-vous",
        "redaction",
        "Les comptes rendus et relances partaient avec plusieurs jours de retard.",
        "À partir de mes notes, l'IA rédige le mail de suivi avec les prochaines étapes.",
        "",
        ["Microsoft Copilot"],
        60,
        "low",
    ),
    (
        "Support client",
        "Proposer des réponses aux tickets fréquents",
        "support",
        "60 % des tickets portent sur les mêmes questions.",
        "Je fournis la question et notre base de connaissances ; l'IA propose une réponse que "
        "je personnalise. Jamais de données client dans l'outil grand public.",
        "",
        ["Le Chat (Mistral)", "ChatGPT"],
        300,
        "medium",
    ),
    (
        "Support client",
        "Traduire les réponses pour les clients étrangers",
        "support",
        "Clients en allemand et en espagnol, personne ne parle ces langues dans l'équipe.",
        "Traduction de nos réponses, relecture rapide du sens.",
        "",
        ["ChatGPT"],
        90,
        "low",
    ),
    (
        "RH",
        "Rédiger des offres d'emploi inclusives",
        "redaction",
        "Des offres trop longues et un vocabulaire qui écarte des candidats.",
        "L'IA réécrit l'offre en langage inclusif et signale les exigences superflues. "
        "Vérification humaine systématique contre les biais.",
        "",
        ["ChatGPT"],
        60,
        "medium",
    ),
    (
        "RH",
        "Préparer un parcours d'onboarding",
        "redaction",
        "Chaque manager improvisait l'accueil des nouveaux.",
        "Trame d'onboarding sur 30 jours par métier, adaptée puis validée par les managers.",
        "",
        ["Microsoft Copilot"],
        45,
        "low",
    ),
    (
        "Finance",
        "Expliquer les écarts budgétaires",
        "analyse",
        "Commenter les écarts du mois pour chaque centre de coût.",
        "À partir du tableau d'écarts agrégé (sans données nominatives), l'IA propose des "
        "commentaires que je complète.",
        "",
        ["Microsoft Copilot"],
        120,
        "high",
    ),
    (
        "Finance",
        "Formules Excel complexes",
        "automatisation",
        "Des heures perdues sur des formules imbriquées.",
        "Je décris le calcul, l'IA écrit la formule et l'explique.",
        "",
        ["Microsoft Copilot", "ChatGPT"],
        60,
        "low",
    ),
    (
        "Direction",
        "Préparer un comité de direction",
        "synthese",
        "Lire tous les documents préparatoires la veille.",
        "Synthèse des documents (outil validé entreprise), questions à poser, points de vigilance.",
        "",
        ["Microsoft Copilot", "Claude"],
        120,
        "high",
    ),
    (
        "Tech",
        "Automatiser la création de tickets depuis les alertes",
        "automatisation",
        "Les alertes de monitoring étaient retranscrites à la main.",
        "Un petit agent lit l'alerte, propose un ticket pré-rempli avec contexte et priorité, "
        "validé par l'astreinte.",
        "",
        ["Claude Code"],
        120,
        "medium",
    ),
    (
        "Produit",
        "Écrire les notes de version",
        "redaction",
        "Traduire les tickets techniques en langage client.",
        "Liste des tickets du sprint → notes de version claires, relues par le PO.",
        "",
        ["Claude"],
        60,
        "low",
    ),
    (
        "Data",
        "Nettoyer un fichier CSV de prospects",
        "automatisation",
        "Doublons, formats de téléphone, villes mal orthographiées.",
        "L'IA écrit un script pandas de nettoyage ; jamais le fichier lui-même dans l'outil.",
        "",
        ["ChatGPT", "GitHub Copilot"],
        90,
        "medium",
    ),
]

FEEDBACKS = [
    (
        "Ventes",
        "frein",
        "On n'a pas de licence Copilot dans l'équipe commerciale, on bricole.",
        False,
        "in_progress",
        "Demande de licences envoyée à la DSI, retour prévu fin du mois.",
    ),
    (
        "RH",
        "formation",
        "Une formation sur les bons usages et les risques serait utile.",
        True,
        "new",
        "",
    ),
    (
        "Support client",
        "outil",
        "Un assistant branché sur notre base de connaissances interne "
        "ferait gagner énormément de temps.",
        False,
        "new",
        "",
    ),
    (
        "Finance",
        "frein",
        "Je ne sais pas ce qu'on a le droit de mettre dans ces outils.",
        True,
        "done",
        "Charte d'usage publiée sur l'intranet, section « Données ».",
    ),
    (
        "Tech",
        "idee",
        "Partager nos prompts de revue de code dans un dépôt commun.",
        False,
        "done",
        "Fait : voir le use case « Relire une pull request ».",
    ),
    (
        "Marketing",
        "idee",
        "Organiser un atelier mensuel de partage d'usages entre équipes.",
        False,
        "in_progress",
        "Premier atelier le 15, inscriptions ouvertes.",
    ),
    (
        "Produit",
        "outil",
        "Avoir accès à Claude en version entreprise pour les documents internes.",
        False,
        "new",
        "",
    ),
    (
        "Ventes",
        "formation",
        "Des exemples concrets pour notre métier, pas des généralités.",
        True,
        "new",
        "",
    ),
    (
        "Data",
        "autre",
        "Mesurer le temps gagné serait plus fiable avec les données Jira.",
        False,
        "new",
        "",
    ),
    (
        "Support client",
        "frein",
        "Les réponses sont parfois fausses sur nos offres tarifaires.",
        True,
        "in_progress",
        "On prépare une fiche de référence à fournir en contexte.",
    ),
    ("RH", "frein", "Peur que l'IA soit utilisée pour évaluer les salariés.", True, "new", ""),
    ("Finance", "outil", "Copilot dans Excel pour toute l'équipe.", False, "new", ""),
]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def seed_demo(session: Session, admin_email: str, admin_password: str | None) -> None:
    if session.scalar(select(Org).where(Org.name == DEMO_NAME)):
        print("Organisation de démo déjà présente : rien à faire.")
        return
    rnd = random.Random(42)
    org = create_org(session, DEMO_NAME)
    tools = {t.name: t for t in session.scalars(select(Tool).where(Tool.org_id == org.id))}
    teams: dict[str, Team] = {}
    for name in TEAMS:
        teams[name] = Team(org_id=org.id, name=name)
        session.add(teams[name])
    session.flush()

    # --- Personnes ---
    people: list[tuple[User, float, str]] = []
    names = [(f, la) for f in FIRST for la in LAST]
    rnd.shuffle(names)
    used = 0
    for team_name, (prop, jobs, _) in TEAMS.items():
        for i in range(SIZES[team_name]):
            first, last = names[used]
            used += 1
            role = "lead" if i == 0 else "member"
            if team_name == "Direction":
                role = "manager"
            u = User(
                org_id=org.id,
                team_id=teams[team_name].id,
                email=f"{slugify(first)}.{slugify(last)}.{used}@{DEMO_DOMAIN}",
                name=f"{first} {last}",
                job=jobs[i % len(jobs)],
                role=role,
                password_hash=None,  # comptes fictifs : pas de connexion possible
            )
            session.add(u)
            people.append((u, _clamp(prop + rnd.gauss(0, 0.15), 0.05, 0.98), team_name))

    email = admin_email.lower()
    admin = session.scalar(select(User).where(func.lower(User.email) == email))
    password = admin_password or secrets.token_urlsafe(12)
    if admin is None:
        admin = User(email=email, name=email.split("@")[0].split(".")[0].capitalize())
        session.add(admin)
    admin.org_id, admin.team_id, admin.role = org.id, teams["Direction"].id, "admin"
    admin.is_superadmin, admin.active = True, True
    admin.job = admin.job or "Responsable transformation IA"
    admin.password_hash = hash_password(password)
    session.flush()

    # --- Outils déclarés ---
    for u, prop, team_name in people:
        favs = TEAMS[team_name][2]
        # Le premier outil de prédilection décide de l'adoption ; les suivants sont plus rares.
        for rank, tname in enumerate(favs):
            r = rnd.random() * (1 + rank * 0.6)
            if r > prop:
                continue
            freq = "daily" if r < prop * 0.4 else "weekly" if r < prop * 0.65 else "monthly"
            session.add(ToolUsage(user_id=u.id, tool_id=tools[tname].id, frequency=freq))
        if rnd.random() < 0.3:
            other = rnd.choice(list(tools))
            if other not in favs:
                session.add(ToolUsage(user_id=u.id, tool_id=tools[other].id, frequency="tried"))

    # --- Pulses (12 semaines, adoption qui progresse) ---
    weeks = last_weeks(12)
    for wi, week in enumerate(weeks):
        progress = wi / (len(weeks) - 1)
        current = wi == len(weeks) - 1
        for u, prop, team_name in people:
            answer_p = (0.45 + 0.35 * progress) * (0.7 + 0.4 * prop)
            if current:
                answer_p *= 0.55  # semaine en cours : tout le monde n'a pas encore répondu
            if rnd.random() > answer_p:
                continue
            level = round(_clamp(prop * 3.2 + progress * 1.1 - 0.9 + rnd.gauss(0, 0.45), 0, 4))
            hours = round(_clamp(level * 0.9 + rnd.gauss(0, 0.7), 0, 12) * 2) / 2
            sat = round(_clamp(2.4 + prop * 2 + progress * 0.4 + rnd.gauss(0, 0.6), 1, 5))
            blockers = []
            if prop < 0.6 and rnd.random() < 0.7:
                blockers = rnd.sample(["acces", "formation", "securite", "temps", "regles"], 2)
            elif rnd.random() < 0.3:
                blockers = rnd.sample(["qualite", "temps", "securite", "pertinence"], 1)
            session.add(
                Pulse(
                    user_id=u.id,
                    org_id=org.id,
                    team_id=u.team_id,
                    week=week,
                    usage_level=level,
                    hours_saved=hours,
                    satisfaction=sat,
                    blockers=sorted(blockers),
                    comment=rnd.choice(COMMENTS) if rnd.random() < 0.12 else "",
                )
            )

    # --- Auto-évaluation et quiz ---
    bias = {
        "prompting": 0.3,
        "outils": 0.2,
        "limites": 0.0,
        "donnees": -0.3,
        "automatisation": -0.5,
        "metier": 0.1,
    }
    quizzes = session.scalars(select(Quiz).where(Quiz.org_id.is_(None))).all()
    for u, prop, team_name in people:
        if rnd.random() < 0.82:
            for d in DOMAINS:
                lvl = round(_clamp(prop * 2.6 + bias[d] + rnd.gauss(0, 0.5), 0, 3))
                session.add(SkillAssessment(user_id=u.id, domain=d, level=lvl))
        if quizzes and rnd.random() < 0.65:
            for quiz in rnd.sample(quizzes, rnd.randint(1, len(quizzes))):
                total = len(quiz.questions)
                score = round(_clamp(total * (0.35 + prop * 0.6) + rnd.gauss(0, 0.8), 0, total))
                answers = [
                    q.correct if i < score else (q.correct + 1) % len(q.options)
                    for i, q in enumerate(quiz.questions)
                ]
                session.add(
                    QuizAttempt(
                        quiz_id=quiz.id, user_id=u.id, score=score, total=total, answers=answers
                    )
                )

    # --- Use cases et réactions ---
    now = datetime.now(UTC)
    by_team: dict[str, list[User]] = {}
    for u, _, team_name in people:
        by_team.setdefault(team_name, []).append(u)
    for i, (team_name, title, cat, problem, solution, prompt, tnames, minutes, risk) in enumerate(
        USE_CASES
    ):
        author = rnd.choice(by_team[team_name])
        uc = UseCase(
            org_id=org.id,
            author_id=author.id,
            team_id=author.team_id,
            title=title,
            category=cat,
            problem=problem,
            solution=solution,
            prompt=prompt,
            tools=tnames,
            minutes_saved_per_week=minutes,
            risk=risk,
            status="validated" if i % 3 == 0 else "published",
            created_at=now - timedelta(days=rnd.randint(1, 80)),
        )
        session.add(uc)
        session.flush()
        for u, prop, _ in people:
            if u.id == author.id:
                continue
            if rnd.random() < 0.12 + prop * 0.15:
                session.add(UseCaseReaction(use_case_id=uc.id, user_id=u.id, kind="like"))
            if rnd.random() < 0.04 + prop * 0.1:
                session.add(UseCaseReaction(use_case_id=uc.id, user_id=u.id, kind="adopt"))

    # --- Feedback ---
    for team_name, kind, text, anonymous, status, response in FEEDBACKS:
        author = rnd.choice(by_team[team_name])
        session.add(
            Feedback(
                org_id=org.id,
                author_id=None if anonymous else author.id,
                team_id=teams[team_name].id,
                kind=kind,
                text=text,
                status=status,
                response=response,
                responded_by=admin.id if response else None,
                created_at=now - timedelta(days=rnd.randint(0, 40)),
            )
        )

    session.commit()
    print(f"Démo « {DEMO_NAME} » créée : {len(people)} personnes, {len(USE_CASES)} use cases.")
    print(f"Admin : {email}")
    if not admin_password:
        print(f"Mot de passe : {password}")
