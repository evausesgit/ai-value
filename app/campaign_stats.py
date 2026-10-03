"""Agrégats d'une campagne (ou d'un sous-ensemble de ses participants).

Partagé par les résultats de campagne et les courbes d'évolution des tableaux
de bord. Satisfaction, freins et verbatims sont masqués sous `min_group_size`
répondants : personne n'est identifiable.
"""

from __future__ import annotations

from collections import Counter
from statistics import mean

from app.catalog import DOMAINS
from app.config import settings
from app.models import CampaignParticipant


def _avg(values: list[float], digits: int = 2) -> float | None:
    return round(mean(values), digits) if values else None


def _pct(num: int, den: int) -> float | None:
    return round(100 * num / den, 1) if den else None


def summarize(participants: list[CampaignParticipant], with_comments: bool = False) -> dict:
    done = [p for p in participants if p.completed_at is not None]
    n = len(done)
    enough = n >= settings.min_group_size
    by_domain = {d: [p.skills[d] for p in done if d in (p.skills or {})] for d in DOMAINS}
    all_levels = [lv for levels in by_domain.values() for lv in levels]
    checkin = [p for p in done if p.satisfaction is not None]
    enough_checkin = len(checkin) >= settings.min_group_size
    out = {
        "targeted": len(participants),
        "respondents": n,
        "participation": _pct(n, len(participants)),
        "adoption_pct": _pct(sum(1 for p in done if p.active_tools > 0), n),
        "active_tools_avg": _avg([p.active_tools for p in done], 1),
        "skills_avg": _avg(all_levels),
        "skills": {d: _avg(v) for d, v in by_domain.items()},
        "usecases": sum(p.usecases for p in done),
        "hours_saved": round(sum(p.minutes_saved for p in done) / 60, 1),
        "hours_saved_avg": _avg([p.minutes_saved / 60 for p in done], 1),
        "satisfaction": _avg([p.satisfaction for p in checkin]) if enough_checkin else None,
        "usage_level": _avg([p.usage_level for p in checkin if p.usage_level is not None])
        if enough_checkin
        else None,
        "checkin_respondents": len(checkin),
        "blockers": [
            {"blocker": b, "count": c}
            for b, c in Counter(b for p in checkin for b in (p.blockers or [])).most_common()
        ]
        if enough_checkin
        else None,
    }
    tools = Counter(
        name for p in done for name, freq in (p.tools or {}).items() if freq in ("daily", "weekly")
    )
    out["tools"] = [{"tool": t, "active": c} for t, c in tools.most_common()] if enough else None
    if with_comments:
        out["comments"] = [p.comment for p in checkin if p.comment] if enough_checkin else None
    return out
