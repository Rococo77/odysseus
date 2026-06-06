"""Calendar-event classification actions and heuristics.

Part of the src.builtin_actions package.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Tuple
from ._base import TaskNoop

logger = logging.getLogger(__name__)


_TYPE_COLORS = {
    "work": "#5b8abf",  # blue
    "personal": "#a07ae0",  # purple
    "health": "#e06c75",  # red
    "travel": "#e5a33a",  # orange
    "meal": "#d8b974",  # tan
    "social": "#82c882",  # green
    "admin": "#888888",  # gray
    "other": "#6b9cb5",  # default
}


_HEURISTIC_TYPES = {
    "health": [
        "doctor",
        "dentist",
        "clinic",
        "hospital",
        "appointment",
        "checkup",
        "therapy",
        "physio",
        "chiropract",
        "vaccine",
        "blood test",
        "xray",
        "scan",
        "surgery",
    ],
    "travel": [
        "flight",
        "airport",
        "train",
        "shinkansen",
        "boarding",
        "uber",
        "taxi",
        "trip",
        "hotel",
        "airbnb",
        "depart",
        "arrival",
        "check-in",
        "checkout",
    ],
    "meal": [
        "lunch",
        "dinner",
        "breakfast",
        "brunch",
        "coffee",
        "drinks",
        "restaurant",
        "reservation",
        "bar",
        "cafe",
    ],
    "social": [
        "birthday",
        "party",
        "hangout",
        "wedding",
        "date with",
        "drinks with",
        "anniversary",
        "baby shower",
        "graduation",
        "picnic",
        "bbq",
    ],
    "admin": [
        "bill",
        "renewal",
        "tax",
        "deadline",
        "filing",
        "submit",
        "due date",
        "registration",
        "license",
        "passport",
        "visa",
        "form",
    ],
    "work": [
        "meeting",
        "standup",
        "sync",
        "1:1",
        "1on1",
        "review",
        "interview",
        "demo",
        "presentation",
        "kickoff",
        "retro",
        "all-hands",
        "town hall",
        "call with",
        "client",
        "deck",
    ],
}


_HEURISTIC_HIGH = [
    "flight",
    "interview",
    "wedding",
    "surgery",
    "exam",
    "deadline",
    "court",
    "presentation",
    "demo",
    "kickoff",
    "launch",
]


_HEURISTIC_CRITICAL = ["surgery", "court", "wedding day", "funeral", "delivery date"]


def _classify_event_heuristic(summary: str) -> tuple:
    """Quick heuristic classification — returns (event_type, importance) or (None, None) if unclear."""
    s = (summary or "").lower()
    etype = None
    for t, kws in _HEURISTIC_TYPES.items():
        if any(k in s for k in kws):
            etype = t
            break
    if any(k in s for k in _HEURISTIC_CRITICAL):
        return etype, "critical"
    if any(k in s for k in _HEURISTIC_HIGH):
        return etype, "high"
    return etype, None


async def action_classify_events(owner: str, **kwargs) -> Tuple[str, bool]:
    """Hybrid classification of upcoming calendar events: fast heuristic for
    obvious cases, LLM fallback for ambiguous ones. Assigns event_type +
    importance + color. Re-classifies anything not already set."""
    try:
        from datetime import timedelta
        from core.database import SessionLocal, CalendarEvent
        from src.endpoint_resolver import resolve_endpoint
        from src.llm_core import llm_call_async
        import re as _re, json as _json

        db = SessionLocal()
        try:
            now = datetime.utcnow()
            horizon = now + timedelta(days=30)
            events = (
                db.query(CalendarEvent)
                .filter(
                    CalendarEvent.dtstart >= now,
                    CalendarEvent.dtstart <= horizon,
                    CalendarEvent.status != "cancelled",
                )
                .all()
            )
            if not events:
                return "No upcoming events to classify", True

            llm_url, llm_model, llm_headers = resolve_endpoint("utility")
            if not llm_url:
                llm_url, llm_model, llm_headers = resolve_endpoint("default")
            llm_available = bool(llm_url and llm_model)

            # Pull user memories so the LLM has personal context (relationships,
            # job, hobbies). Helps it know e.g. "<name> is your spouse" so their
            # events are personal/social, not work.
            _memory_context = ""
            try:
                from core.database import Memory as _Mem

                _mems = db.query(_Mem).filter(_Mem.owner == owner).limit(60).all() if owner else []
                if _mems:
                    _lines = []
                    for m in _mems:
                        c = (m.content or "").strip()
                        if c:
                            _lines.append(f"- {c[:200]}")
                    if _lines:
                        _memory_context = (
                            "USER CONTEXT (relationships, work, life):\n"
                            + "\n".join(_lines[:40])
                            + "\n\n"
                        )
            except Exception as _me:
                logger.debug(f"Could not load memory for classify: {_me}")

            classified_h = 0
            classified_llm = 0
            failed = 0
            unchanged = 0
            # Pass 1: heuristic for obvious cases, collect ambiguous for LLM batch
            llm_queue = []  # list of CalendarEvent objects needing LLM
            for ev in events:
                if ev.event_type and ev.importance and ev.importance != "normal":
                    unchanged += 1
                    continue
                etype, importance = _classify_event_heuristic(ev.summary or "")
                if etype and importance:
                    ev.event_type = etype
                    ev.color = _TYPE_COLORS.get(etype)
                    ev.importance = importance
                    classified_h += 1
                    continue
                # Apply partial heuristic; queue for LLM to fill missing
                if etype:
                    ev.event_type = etype
                    ev.color = _TYPE_COLORS.get(etype)
                if llm_available:
                    llm_queue.append(ev)
                elif etype:
                    classified_h += 1
            # Persist heuristic results before LLM pass (in case LLM is slow/unavailable)
            try:
                db.commit()
            except Exception:
                pass

            # Pass 2: batch LLM classification (10 events per call)
            BATCH = 10
            for i in range(0, len(llm_queue), BATCH):
                batch = llm_queue[i : i + BATCH]
                items = [
                    {
                        "i": idx,
                        "title": (ev.summary or "")[:120],
                        "when": ev.dtstart.isoformat() if ev.dtstart else "",
                        "loc": (ev.location or "")[:80],
                    }
                    for idx, ev in enumerate(batch)
                ]
                prompt = (
                    _memory_context
                    + "Classify these calendar events using the USER CONTEXT above (people they know, "
                    "their job, hobbies). Return ONLY a raw JSON array, no prose, no markdown.\n"
                    'Each item: {"i": <index>, "type": "work|personal|health|travel|meal|social|admin|other", '
                    '"importance": "low|normal|high|critical"}\n\n'
                    "Type guidance:\n"
                    "- personal = family, partner, kids, pets, errands, home stuff\n"
                    "- social = friends, parties, birthdays, hangouts\n"
                    "- work = the user's own job/career commitments only (not their partner's)\n"
                    "- health = doctor, gym, therapy\n"
                    "- travel = flights, trips, hotels\n"
                    "- meal = lunch/dinner/coffee specifically\n"
                    "- admin = bills, taxes, paperwork\n"
                    "- other = anything else\n\n"
                    "Importance guide: critical = surgery/court/wedding day; high = flight/interview/big presentation/exam; "
                    "normal = regular meetings/appointments; low = recurring routine.\n\n"
                    f"EVENTS: {_json.dumps(items)}"
                )
                try:
                    raw = await llm_call_async(
                        url=llm_url,
                        model=llm_model,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.1,
                        max_tokens=16384,
                        headers=llm_headers,
                        timeout=180,
                    )
                    from src.text_helpers import strip_think as _st

                    raw = _st(raw or "", prose=False, prompt_echo=False)
                    raw = _re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=_re.MULTILINE).strip()
                    m = _re.search(r"\[.*\]", raw, _re.DOTALL)
                    if not m:
                        logger.warning(f"[classify-llm] no JSON array in response: {raw[:300]!r}")
                        failed += len(batch)
                        continue
                    arr = _json.loads(m.group())
                    by_idx = {x.get("i"): x for x in arr if isinstance(x, dict)}
                    for idx, ev in enumerate(batch):
                        x = by_idx.get(idx)
                        if not x:
                            failed += 1
                            continue
                        t = (x.get("type") or "other").lower()
                        imp = (x.get("importance") or "normal").lower()
                        if t in _TYPE_COLORS:
                            ev.event_type = t
                            ev.color = _TYPE_COLORS[t]
                        if imp in ("low", "normal", "high", "critical"):
                            ev.importance = imp
                        classified_llm += 1
                        logger.info(f"[classify-llm] '{ev.summary}' → type={t} importance={imp}")
                except Exception as e:
                    logger.warning(f"[classify-llm] batch failed: {e}")
                    failed += len(batch)
                # Commit after each batch so partial progress persists
                try:
                    db.commit()
                except Exception as ce:
                    logger.warning(f"[classify-llm] commit failed: {ce}")
            # Final commit covers heuristic-only updates from pass 1
            db.commit()
            parts = [f"Scanned {len(events)} upcoming event(s)"]
            if classified_h:
                parts.append(f"{classified_h} via heuristic")
            if classified_llm:
                parts.append(f"{classified_llm} via LLM")
            if unchanged:
                parts.append(f"{unchanged} already set (skipped)")
            if failed:
                parts.append(f"{failed} LLM failed")
            return " · ".join(parts), True
        finally:
            db.close()
    except Exception as e:
        logger.error(f"classify_events action failed: {e}")
        return str(e), False


async def action_ping_events(owner: str, **kwargs) -> Tuple[str, bool]:
    """Calendar event reminders are now dispatched by Notes."""
    raise TaskNoop("calendar event reminders are handled by Notes")
