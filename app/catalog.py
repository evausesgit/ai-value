"""Listes fermées et contenus par défaut.

Les clés sont dupliquées pour l'affichage dans `web/lib/catalog.ts` : modifier
les deux en même temps.
"""

from __future__ import annotations

ROLES = ["member", "lead", "manager", "admin"]

FREQUENCIES = ["daily", "weekly", "monthly", "tried"]
# Fréquences qui comptent comme « utilisateur actif » dans le taux d'adoption.
ACTIVE_FREQUENCIES = {"daily", "weekly"}

# Ce qu'une campagne peut demander de mettre à jour.
CAMPAIGN_ITEMS = ["tools", "skills", "usecases", "checkin"]

# Ressenti : « En ce moment, à quelle fréquence utilises-tu l'IA ? »
USAGE_LEVELS = {
    0: "Jamais",
    1: "Rarement",
    2: "Chaque semaine",
    3: "Tous les jours",
    4: "Plusieurs fois par jour",
}

BLOCKERS = [
    "acces",  # pas d'accès / de licence
    "formation",  # je ne sais pas bien m'en servir
    "securite",  # doute sur la confidentialité des données
    "qualite",  # résultats pas assez fiables
    "temps",  # pas le temps d'explorer
    "pertinence",  # pas adapté à mon métier
    "regles",  # règles internes floues
]

DOMAINS = [
    "prompting",  # formuler, itérer, donner du contexte
    "outils",  # connaître les outils et quand utiliser lequel
    "limites",  # hallucinations, biais, vérification
    "donnees",  # confidentialité, RGPD, données sensibles
    "automatisation",  # workflows, agents, intégrations
    "metier",  # appliquer l'IA à son propre métier
]
SKILL_LEVELS = {0: "Découverte", 1: "Usage", 2: "Maîtrise", 3: "Référent"}

CATEGORIES = [
    "redaction",
    "code",
    "analyse",
    "recherche",
    "synthese",
    "support",
    "automatisation",
    "creatif",
    "autre",
]

RISKS = ["low", "medium", "high"]

FEEDBACK_KINDS = ["frein", "idee", "formation", "outil", "autre"]
FEEDBACK_STATUSES = ["new", "in_progress", "done"]

DEFAULT_TOOLS: list[tuple[str, str]] = [
    ("ChatGPT", "assistant"),
    ("Claude", "assistant"),
    ("Microsoft Copilot", "assistant"),
    ("Gemini", "assistant"),
    ("Le Chat (Mistral)", "assistant"),
    ("GitHub Copilot", "code"),
    ("Cursor", "code"),
    ("Claude Code", "code"),
    ("Perplexity", "recherche"),
    ("NotebookLM", "recherche"),
    ("Midjourney", "image"),
    ("Notion AI", "productivite"),
]


# Bibliothèque commune de quiz (org_id NULL). `slug` rend l'insertion idempotente.
LIBRARY_QUIZZES: list[dict] = [
    {
        "slug": "bases-prompting",
        "domain": "prompting",
        "title": "Les bases du prompting",
        "description": "Formuler une demande claire et obtenir une réponse utile du premier coup.",
        "questions": [
            {
                "prompt": "Quel élément améliore le plus souvent la qualité d'une réponse ?",
                "options": [
                    "Écrire en majuscules",
                    "Donner le contexte, l'objectif et le format attendu",
                    "Poser la question la plus courte possible",
                    "Ajouter « s'il te plaît »",
                ],
                "correct": 1,
                "explanation": "Contexte + objectif + format attendu : c'est ce qui manque à la "
                "plupart des demandes.",
            },
            {
                "prompt": "La réponse ne te convient pas. Le meilleur réflexe ?",
                "options": [
                    "Recommencer une conversation vide",
                    "Abandonner, l'outil n'est pas fait pour ça",
                    "Préciser ce qui ne va pas et demander une nouvelle version",
                    "Reposer exactement la même question",
                ],
                "correct": 2,
                "explanation": "Itérer en expliquant l'écart est plus efficace que repartir de zéro.",
            },
            {
                "prompt": "Pourquoi donner un exemple du résultat attendu ?",
                "options": [
                    "Ça n'a aucun effet",
                    "Le modèle imite le ton, la structure et le niveau de détail",
                    "C'est obligatoire",
                    "Pour raccourcir la réponse",
                ],
                "correct": 1,
                "explanation": "Un ou deux exemples (« few-shot ») cadrent fortement la sortie.",
            },
            {
                "prompt": "Pour une tâche complexe (rapport complet), mieux vaut :",
                "options": [
                    "Tout demander en un seul message",
                    "Découper : plan, puis chaque partie, puis relecture",
                    "Demander la version la plus longue possible",
                    "Utiliser un outil différent par paragraphe",
                ],
                "correct": 1,
                "explanation": "Découper en étapes donne plus de contrôle et de meilleurs résultats.",
            },
            {
                "prompt": "Donner un rôle (« Tu es juriste en droit social ») sert à :",
                "options": [
                    "Rien, c'est un mythe",
                    "Orienter le vocabulaire, le niveau d'expertise et le point de vue",
                    "Garantir que la réponse est juridiquement exacte",
                    "Contourner les règles de l'outil",
                ],
                "correct": 1,
                "explanation": "Le rôle oriente la réponse, mais ne garantit jamais l'exactitude.",
            },
        ],
    },
    {
        "slug": "limites-verification",
        "domain": "limites",
        "title": "Limites et vérification",
        "description": "Hallucinations, biais, sources : savoir quand ne pas faire confiance.",
        "questions": [
            {
                "prompt": "Qu'est-ce qu'une « hallucination » ?",
                "options": [
                    "Un bug d'affichage",
                    "Une information inventée présentée avec assurance",
                    "Une réponse trop longue",
                    "Un refus de répondre",
                ],
                "correct": 1,
                "explanation": "Le modèle peut produire des faits, chiffres ou sources inexistants, "
                "sur un ton très convaincant.",
            },
            {
                "prompt": "L'IA te cite une étude avec auteur et année. Tu :",
                "options": [
                    "La cites telle quelle",
                    "Vérifies qu'elle existe et dit bien cela",
                    "Demandes à l'IA si elle est sûre",
                    "Supprimes l'année par prudence",
                ],
                "correct": 1,
                "explanation": "Demander à l'IA de se vérifier ne suffit pas : on remonte à la source.",
            },
            {
                "prompt": "Sur quel type de tâche le risque d'erreur est-il le plus élevé ?",
                "options": [
                    "Reformuler un texte fourni",
                    "Résumer un document joint",
                    "Donner des chiffres précis récents sans source fournie",
                    "Proposer des idées de titres",
                ],
                "correct": 2,
                "explanation": "Les faits précis non fournis dans le contexte sont le terrain des "
                "hallucinations.",
            },
            {
                "prompt": "Qui est responsable d'un livrable produit avec l'aide de l'IA ?",
                "options": [
                    "L'éditeur de l'outil",
                    "Personne",
                    "La personne qui le livre",
                    "Le service informatique",
                ],
                "correct": 2,
                "explanation": "L'IA est un outil : la responsabilité du résultat reste humaine.",
            },
            {
                "prompt": "Les modèles peuvent reproduire des biais parce que :",
                "options": [
                    "Ils sont programmés pour",
                    "Ils apprennent à partir de données humaines qui en contiennent",
                    "Ils n'ont pas accès à Internet",
                    "C'est impossible",
                ],
                "correct": 1,
                "explanation": "Les biais des données d'entraînement peuvent ressortir dans les "
                "réponses : vigilance sur RH, recrutement, évaluation.",
            },
        ],
    },
    {
        "slug": "donnees-confidentialite",
        "domain": "donnees",
        "title": "Données et confidentialité",
        "description": "Ce qu'on peut — et ne peut pas — coller dans un outil d'IA.",
        "questions": [
            {
                "prompt": "Peut-on coller un fichier client nominatif dans un outil grand public ?",
                "options": [
                    "Oui, s'il est petit",
                    "Non, sauf outil validé par l'entreprise pour ces données",
                    "Oui, si on supprime l'historique après",
                    "Oui, le RGPD ne s'applique pas à l'IA",
                ],
                "correct": 1,
                "explanation": "Les données personnelles ne vont que dans des outils validés "
                "(contrat, hébergement, non-réutilisation pour l'entraînement).",
            },
            {
                "prompt": "Le meilleur réflexe avant de partager un document interne :",
                "options": [
                    "Anonymiser ou retirer les éléments sensibles",
                    "Changer le nom du fichier",
                    "Le traduire en anglais",
                    "Le convertir en PDF",
                ],
                "correct": 0,
                "explanation": "Retirer noms, chiffres confidentiels et secrets avant de partager.",
            },
            {
                "prompt": "Une version « entreprise » d'un outil d'IA apporte généralement :",
                "options": [
                    "Des réponses plus créatives",
                    "Des garanties contractuelles sur l'usage et la conservation des données",
                    "Un accès à Internet",
                    "Aucune différence",
                ],
                "correct": 1,
                "explanation": "La différence clé est contractuelle : non-entraînement, "
                "conservation, sécurité.",
            },
            {
                "prompt": "Un collègue partage un prompt contenant un mot de passe. Tu :",
                "options": [
                    "Le réutilises",
                    "Le signales pour qu'il change le mot de passe",
                    "L'ignores",
                    "Le mets dans un use case",
                ],
                "correct": 1,
                "explanation": "Un secret exposé doit être changé : il a pu être conservé.",
            },
        ],
    },
    {
        "slug": "outils-usages",
        "domain": "outils",
        "title": "Choisir le bon outil",
        "description": "Assistant, recherche, code, image : quel outil pour quel besoin ?",
        "questions": [
            {
                "prompt": "Pour une question d'actualité avec sources citées, le plus adapté :",
                "options": [
                    "Un générateur d'images",
                    "Un outil de recherche augmentée (ex. Perplexity) ou un assistant web",
                    "Un assistant sans accès web",
                    "Un tableur",
                ],
                "correct": 1,
                "explanation": "Sans accès web, un assistant ne connaît pas l'actualité récente.",
            },
            {
                "prompt": "Pour résumer un long PDF interne, le plus important est :",
                "options": [
                    "Que l'outil accepte des documents et soit autorisé pour ces données",
                    "Que l'outil génère des images",
                    "Que le PDF soit en couleur",
                    "Rien de particulier",
                ],
                "correct": 0,
                "explanation": "Capacité à lire le document + autorisation de l'outil pour ces "
                "données.",
            },
            {
                "prompt": "Un assistant de code (Copilot, Cursor…) sert surtout à :",
                "options": [
                    "Remplacer les revues de code",
                    "Accélérer l'écriture, l'exploration et les tests — à relire",
                    "Déployer en production",
                    "Gérer les tickets",
                ],
                "correct": 1,
                "explanation": "Gain de vitesse réel, mais le code généré se relit et se teste.",
            },
            {
                "prompt": "Un « agent » IA se distingue d'un chatbot parce qu'il :",
                "options": [
                    "Parle plusieurs langues",
                    "Enchaîne des actions avec des outils pour atteindre un objectif",
                    "Est toujours gratuit",
                    "N'a pas besoin de consignes",
                ],
                "correct": 1,
                "explanation": "Un agent planifie et agit (chercher, écrire, appeler des outils), "
                "pas seulement répondre.",
            },
        ],
    },
]
