"""Traduction des messages d'erreur de l'API.

Les messages sont écrits en français dans le code (langue source) ; le front
envoie `Accept-Language` (langue de l'utilisateur) et le gestionnaire
d'exceptions de app/main.py traduit `detail` à la volée. Ajouter une langue =
ajouter un dictionnaire dans `MESSAGES` (et ses préfixes dans `PREFIXES`).
"""

from __future__ import annotations

import re

LANGS = ["fr", "en"]
DEFAULT_LANG = "fr"

MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "Accès réservé.": "Access restricted.",
        "Accès réservé à la plateforme.": "Restricted to platform administrators.",
        "Appel direct refusé : passer par le proxy.": "Direct call refused: go through the proxy.",
        "Campagne introuvable.": "Campaign not found.",
        "Catégorie inconnue.": "Unknown category.",
        "Cet outil existe déjà.": "This tool already exists.",
        "Cette campagne est close.": "This campaign is closed.",
        "Cette campagne ne demande pas de ressenti.": "This campaign does not ask for a check-in.",
        "Cette campagne ne te concerne pas.": "This campaign is not for you.",
        "Cette équipe existe déjà.": "This team already exists.",
        "Cette invitation est réservée à une autre adresse.": (
            "This invitation is for another email address."
        ),
        "Choisis au moins une chose à mettre à jour.": "Choose at least one thing to update.",
        "Compte désactivé.": "Account disabled.",
        "Connexion requise.": "Please sign in.",
        "Domaine inconnu.": "Unknown domain.",
        "Email ou mot de passe incorrect.": "Incorrect email or password.",
        "Équipe inconnue.": "Unknown team.",
        "Équipe introuvable.": "Team not found.",
        "Feedback introuvable.": "Feedback not found.",
        "Il reste des étapes à valider avant d'envoyer.": (
            "Some steps still need to be confirmed before sending."
        ),
        "Invitation créée par quelqu'un d'autre.": "Invitation created by someone else.",
        "Invitation introuvable.": "Invitation not found.",
        "Invitation invalide ou expirée.": "Invalid or expired invitation.",
        "La date limite est déjà passée.": "The deadline has already passed.",
        "Membre introuvable.": "Member not found.",
        "Mot de passe actuel incorrect.": "Current password is incorrect.",
        "Outil introuvable.": "Tool not found.",
        "Quiz introuvable.": "Quiz not found.",
        "Réponds à toutes les questions.": "Answer all the questions.",
        "Session expirée.": "Session expired.",
        "Seul l'auteur peut modifier ce use case.": "Only the author can edit this use case.",
        "Seul l'auteur peut supprimer ce use case.": "Only the author can delete this use case.",
        "Seul le demandeur ou le management peut gérer cette campagne.": (
            "Only the requester or management can manage this campaign."
        ),
        "Suppression non autorisée.": "Deletion not allowed.",
        "Trop de tentatives, réessaie dans quelques minutes.": (
            "Too many attempts, try again in a few minutes."
        ),
        "Tu ne peux pas retirer tes propres droits d'admin.": (
            "You cannot remove your own admin rights."
        ),
        "Type inconnu.": "Unknown type.",
        "Un compte existe déjà avec cet email : connecte-toi.": (
            "An account already exists with this email: sign in."
        ),
        "Un lead invite uniquement des membres dans son équipe.": (
            "A lead can only invite members into their own team."
        ),
        "Un lead lance une campagne pour son équipe uniquement.": (
            "A lead can only launch a campaign for their own team."
        ),
        "Use case introuvable.": "Use case not found.",
        "Validation réservée au lead de l'équipe ou au management.": (
            "Only the team lead or management can validate."
        ),
    },
}

# Messages paramétrés : (motif source, gabarit cible avec les groupes capturés).
PATTERNS: dict[str, list[tuple[re.Pattern[str], str]]] = {
    "en": [
        (re.compile(r"^Frein inconnu : (.*)$"), r"Unknown blocker: \1"),
        (re.compile(r"^Outil inconnu : (.*)$"), r"Unknown tool: \1"),
        (re.compile(r"^Valeur invalide : (.*)$"), r"Invalid value: \1"),
        (
            re.compile(r"^Question (\d+) : bonne réponse hors des options\.$"),
            r"Question \1: correct answer is not one of the options.",
        ),
    ],
}


def pick_lang(accept_language: str | None) -> str:
    """Première langue connue de l'en-tête Accept-Language, sinon la langue source."""
    for part in (accept_language or "").split(","):
        code = part.split(";")[0].strip().lower()[:2]
        if code in LANGS:
            return code
    return DEFAULT_LANG


def translate(message: str, lang: str) -> str:
    if lang == DEFAULT_LANG:
        return message
    table = MESSAGES.get(lang, {})
    if message in table:
        return table[message]
    for pattern, template in PATTERNS.get(lang, []):
        if pattern.match(message):
            return pattern.sub(template, message)
    return message
