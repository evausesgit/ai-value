from __future__ import annotations

from datetime import UTC, date, datetime, timedelta


def week_of(d: date) -> date:
    """Lundi de la semaine de `d` : clé des pulses."""
    return d - timedelta(days=d.weekday())


def current_week() -> date:
    return week_of(datetime.now(UTC).date())


def last_weeks(n: int) -> list[date]:
    """Les `n` dernières semaines (lundis), de la plus ancienne à la courante."""
    cur = current_week()
    return [cur - timedelta(weeks=i) for i in range(n - 1, -1, -1)]
