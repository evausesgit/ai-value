from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import admin, adoption, auth, campaigns, dashboards, feedback, skills, usecases
from app.db import SessionLocal
from app.i18n import pick_lang, translate
from app.provisioning import ensure_library

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Le schéma est géré par Alembic (`alembic upgrade head` au démarrage du conteneur) ;
    # ici on complète seulement la bibliothèque commune de quiz.
    with SessionLocal() as session:
        ensure_library(session)
    yield


app = FastAPI(title="AI Value", lifespan=lifespan)
for module in (auth, adoption, skills, usecases, feedback, campaigns, dashboards, admin):
    app.include_router(module.router)


@app.exception_handler(StarletteHTTPException)
async def translated_http_exception(request: Request, exc: StarletteHTTPException):
    # Messages écrits en français dans le code, traduits selon Accept-Language.
    if isinstance(exc.detail, str):
        exc.detail = translate(exc.detail, pick_lang(request.headers.get("accept-language")))
    return await http_exception_handler(request, exc)


@app.get("/health")
def health():
    return {"ok": True}
