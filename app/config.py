from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://aivalue:aivalue@127.0.0.1:5432/aivalue"

    # Jeton partagé proxy Next ↔ API : l'API n'est jamais exposée, mais si ce
    # jeton est défini, toute requête sans lui est refusée (défense en profondeur).
    internal_api_token: str = ""

    # Cookie de session (posé par l'API, relayé tel quel par Next).
    session_cookie: str = "aivalue_session"
    session_days: int = 30
    cookie_secure: bool = False

    invite_days: int = 14

    # En dessous de ce nombre de répondants, les agrégats de ressenti (satisfaction,
    # freins, verbatims) d'une équipe sont masqués : personne n'est identifiable.
    min_group_size: int = 3


settings = Settings()
