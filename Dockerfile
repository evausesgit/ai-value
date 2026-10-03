# API AI Value (FastAPI). La config et les secrets arrivent par variables
# d'environnement (cf. .env.example). Les migrations sont jouées au démarrage.

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN useradd -m -u 1001 app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY alembic ./alembic
COPY scripts ./scripts
COPY alembic.ini ./

ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8820

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8820 --proxy-headers"]
