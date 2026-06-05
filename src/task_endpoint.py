"""Shared resolver for background-task AI endpoint (auto-naming, memory, sorting)."""

from typing import Any, Dict, Optional, Tuple

from src.endpoint_resolver import resolve_endpoint


def resolve_task_endpoint(
    fallback_url: Optional[str] = None,
    fallback_model: Optional[str] = None,
    fallback_headers: Optional[Dict[str, str]] = None,
) -> "Optional[Tuple[str, str, Dict[str, Any]]]":
    """Return (endpoint_url, model, headers) for background tasks.

    Reads task_endpoint_id / task_model from admin settings.
    Falls back to the provided values when the setting is empty or the
    endpoint cannot be resolved.
    """
    resolved: Optional[Tuple[str, str, Dict[str, Any]]] = resolve_endpoint(
        "task", fallback_url, fallback_model, fallback_headers
    )
    return resolved
