"""Administration en ligne de commande.

    python -m scripts.admin create-org "Nom de la boîte" --admin-email x@y.fr
        → crée l'organisation et affiche le lien d'invitation du premier admin
    python -m scripts.admin create-user email@x.fr --org-slug acme --role admin \
        [--superadmin] [--password ...]     (mot de passe généré si absent)
    python -m scripts.admin demo --admin-email eva@x.fr [--password ...]
        → organisation de démonstration remplie (idempotent : ne fait rien si elle existe)
"""

from __future__ import annotations

import argparse
import os
import secrets

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Org, Team, User
from app.provisioning import create_invite, create_org, ensure_library
from app.security import hash_password


def _base_url() -> str:
    return os.environ.get("PUBLIC_URL", "https://aivalue.ia-do-it.com").rstrip("/")


def cmd_create_org(args: argparse.Namespace) -> None:
    with SessionLocal() as session:
        org = create_org(session, args.name)
        _, token = create_invite(session, org_id=org.id, role="admin", email=args.admin_email)
        session.commit()
        print(f"Organisation « {org.name} » créée (slug {org.slug}).")
        print(f"Invitation admin : {_base_url()}/invitation/{token}")


def cmd_create_user(args: argparse.Namespace) -> None:
    password = args.password or secrets.token_urlsafe(12)
    with SessionLocal() as session:
        org = session.scalar(select(Org).where(Org.slug == args.org_slug))
        if org is None:
            raise SystemExit(f"Organisation inconnue : {args.org_slug}")
        team = None
        if args.team:
            team = session.scalar(select(Team).where(Team.org_id == org.id, Team.name == args.team))
        email = args.email.lower()
        user = session.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            user = User(org_id=org.id, email=email)
            session.add(user)
        user.org_id = org.id
        user.team_id = team.id if team else user.team_id
        user.name = args.name or user.name or email.split("@")[0]
        user.role = args.role
        user.is_superadmin = args.superadmin or user.is_superadmin
        user.password_hash = hash_password(password)
        user.active = True
        session.commit()
    print(f"Compte {email} prêt ({args.role}{', superadmin' if args.superadmin else ''}).")
    if not args.password:
        print(f"Mot de passe : {password}")


def cmd_demo(args: argparse.Namespace) -> None:
    from scripts.demo_data import DEMO_NAME, seed_demo, seed_demo_campaigns

    with SessionLocal() as session:
        ensure_library(session)
        org = session.scalar(select(Org).where(Org.name == DEMO_NAME))
        if org is None:
            seed_demo(session, admin_email=args.admin_email, admin_password=args.password)
            return
        # Démo existante : on complète seulement ce qui manque (campagnes).
        email = args.admin_email.lower()
        requester = session.scalar(select(User).where(func.lower(User.email) == email))
        n = seed_demo_campaigns(session, org, requester)
        session.commit()
        print(f"Démo déjà présente : {n} campagne(s) ajoutée(s).")


def main() -> None:
    parser = argparse.ArgumentParser(prog="scripts.admin")
    sub = parser.add_subparsers(required=True)

    p = sub.add_parser("create-org")
    p.add_argument("name")
    p.add_argument("--admin-email")
    p.set_defaults(func=cmd_create_org)

    p = sub.add_parser("create-user")
    p.add_argument("email")
    p.add_argument("--org-slug", required=True)
    p.add_argument("--role", default="member", choices=["member", "lead", "manager", "admin"])
    p.add_argument("--team")
    p.add_argument("--name")
    p.add_argument("--password")
    p.add_argument("--superadmin", action="store_true")
    p.set_defaults(func=cmd_create_user)

    p = sub.add_parser("demo")
    p.add_argument("--admin-email", required=True)
    p.add_argument("--password")
    p.set_defaults(func=cmd_demo)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
