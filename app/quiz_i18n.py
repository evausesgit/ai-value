"""Traductions de la bibliothèque commune de quiz (app/catalog.py, langue source : fr).

Clé = slug du quiz. Mêmes questions, même ordre, mêmes positions de bonne
réponse : seuls les textes changent. Les quiz créés par une organisation
restent dans la langue où ils ont été écrits.
"""

from __future__ import annotations

QUIZ_TRANSLATIONS: dict[str, dict[str, dict]] = {
    "en": {
        "bases-prompting": {
            "title": "Prompting basics",
            "description": "Write a clear request and get a useful answer the first time.",
            "questions": [
                {
                    "prompt": "Which element most often improves the quality of an answer?",
                    "options": [
                        "Writing in capital letters",
                        "Giving context, the goal and the expected format",
                        "Asking the shortest possible question",
                        "Adding “please”",
                    ],
                    "explanation": "Context + goal + expected format: that is what most "
                    "requests are missing.",
                },
                {
                    "prompt": "You are not happy with the answer. The best reflex?",
                    "options": [
                        "Start a new empty conversation",
                        "Give up, the tool is not made for this",
                        "Explain what is wrong and ask for a new version",
                        "Ask exactly the same question again",
                    ],
                    "explanation": "Iterating by explaining the gap works better than "
                    "starting from scratch.",
                },
                {
                    "prompt": "Why give an example of the expected result?",
                    "options": [
                        "It has no effect",
                        "The model mimics the tone, structure and level of detail",
                        "It is mandatory",
                        "To shorten the answer",
                    ],
                    "explanation": "One or two examples (“few-shot”) strongly shape the output.",
                },
                {
                    "prompt": "For a complex task (a full report), it is better to:",
                    "options": [
                        "Ask for everything in a single message",
                        "Break it down: outline, then each part, then a review",
                        "Ask for the longest possible version",
                        "Use a different tool for each paragraph",
                    ],
                    "explanation": "Working step by step gives more control and better results.",
                },
                {
                    "prompt": "Giving a role (“You are an employment lawyer”) helps to:",
                    "options": [
                        "Nothing, it is a myth",
                        "Steer the vocabulary, level of expertise and point of view",
                        "Guarantee the answer is legally correct",
                        "Get around the tool's rules",
                    ],
                    "explanation": "A role steers the answer but never guarantees accuracy.",
                },
            ],
        },
        "limites-verification": {
            "title": "Limits and verification",
            "description": "Hallucinations, bias, sources: knowing when not to trust.",
            "questions": [
                {
                    "prompt": "What is a “hallucination”?",
                    "options": [
                        "A display bug",
                        "Made-up information presented confidently",
                        "An answer that is too long",
                        "A refusal to answer",
                    ],
                    "explanation": "The model can produce facts, figures or sources that do "
                    "not exist, in a very convincing tone.",
                },
                {
                    "prompt": "The AI cites a study with an author and a year. You:",
                    "options": [
                        "Quote it as is",
                        "Check that it exists and says that",
                        "Ask the AI whether it is sure",
                        "Remove the year to be safe",
                    ],
                    "explanation": "Asking the AI to check itself is not enough: go back to "
                    "the source.",
                },
                {
                    "prompt": "Which task carries the highest risk of error?",
                    "options": [
                        "Rewording a text you provided",
                        "Summarising an attached document",
                        "Giving precise recent figures without a source",
                        "Suggesting title ideas",
                    ],
                    "explanation": "Precise facts that are not in the context are where "
                    "hallucinations happen.",
                },
                {
                    "prompt": "Who is responsible for a deliverable produced with AI help?",
                    "options": [
                        "The tool vendor",
                        "Nobody",
                        "The person who delivers it",
                        "The IT department",
                    ],
                    "explanation": "AI is a tool: responsibility for the result stays human.",
                },
                {
                    "prompt": "Models can reproduce biases because:",
                    "options": [
                        "They are programmed to",
                        "They learn from human data that contains them",
                        "They have no internet access",
                        "That is impossible",
                    ],
                    "explanation": "Biases in training data can show up in answers: be "
                    "careful with HR, hiring and evaluations.",
                },
            ],
        },
        "donnees-confidentialite": {
            "title": "Data and confidentiality",
            "description": "What you can — and cannot — paste into an AI tool.",
            "questions": [
                {
                    "prompt": "Can you paste a customer file with names into a consumer tool?",
                    "options": [
                        "Yes, if it is small",
                        "No, unless the tool is approved by the company for this data",
                        "Yes, if you delete the history afterwards",
                        "Yes, GDPR does not apply to AI",
                    ],
                    "explanation": "Personal data only goes into approved tools (contract, "
                    "hosting, no reuse for training).",
                },
                {
                    "prompt": "The best reflex before sharing an internal document:",
                    "options": [
                        "Anonymise it or remove sensitive details",
                        "Rename the file",
                        "Translate it into English",
                        "Convert it to PDF",
                    ],
                    "explanation": "Remove names, confidential figures and secrets before sharing.",
                },
                {
                    "prompt": "An “enterprise” version of an AI tool usually brings:",
                    "options": [
                        "More creative answers",
                        "Contractual guarantees on how data is used and retained",
                        "Internet access",
                        "No difference",
                    ],
                    "explanation": "The key difference is contractual: no training, "
                    "retention, security.",
                },
                {
                    "prompt": "A colleague shares a prompt that contains a password. You:",
                    "options": [
                        "Reuse it",
                        "Report it so they change the password",
                        "Ignore it",
                        "Put it in a use case",
                    ],
                    "explanation": "An exposed secret must be changed: it may have been stored.",
                },
            ],
        },
        "outils-usages": {
            "title": "Choosing the right tool",
            "description": "Assistant, search, code, images: which tool for which need?",
            "questions": [
                {
                    "prompt": "For a news question with cited sources, the best fit is:",
                    "options": [
                        "An image generator",
                        "An AI search tool (e.g. Perplexity) or a web-enabled assistant",
                        "An assistant without web access",
                        "A spreadsheet",
                    ],
                    "explanation": "Without web access, an assistant does not know recent news.",
                },
                {
                    "prompt": "To summarise a long internal PDF, the most important thing is:",
                    "options": [
                        "That the tool accepts documents and is approved for this data",
                        "That the tool generates images",
                        "That the PDF is in colour",
                        "Nothing in particular",
                    ],
                    "explanation": "The tool must be able to read the document and be "
                    "approved for this data.",
                },
                {
                    "prompt": "A coding assistant (Copilot, Cursor…) is mainly for:",
                    "options": [
                        "Replacing code reviews",
                        "Speeding up writing, exploring and testing — to be reviewed",
                        "Deploying to production",
                        "Managing tickets",
                    ],
                    "explanation": "A real speed gain, but generated code must be reviewed "
                    "and tested.",
                },
                {
                    "prompt": "An AI “agent” differs from a chatbot because it:",
                    "options": [
                        "Speaks several languages",
                        "Chains actions with tools to reach a goal",
                        "Is always free",
                        "Needs no instructions",
                    ],
                    "explanation": "An agent plans and acts (search, write, call tools), "
                    "rather than only answering.",
                },
            ],
        },
    },
}


def localize_quiz(slug: str | None, lang: str) -> dict | None:
    """Traduction d'un quiz de la bibliothèque, ou None (quiz maison / langue source)."""
    if not slug:
        return None
    return QUIZ_TRANSLATIONS.get(lang, {}).get(slug)
