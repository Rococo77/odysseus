"""Authentication middleware wiring.

Owns everything behind ``AUTH_ENABLED``: the exempt-path rules, the in-memory
API-token cache (so bearer auth doesn't hit the DB on every request), the
trusted-loopback detection that keeps ``LOCALHOST_BYPASS`` / the internal-tool
header safe behind a proxy/tunnel, and the ``AuthMiddleware`` itself.

``app.py`` just calls :func:`configure_auth`.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections import defaultdict
from datetime import datetime

import bcrypt
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

from core.auth import AuthManager
from core.database import ApiToken, SessionLocal
from routes.auth_routes import SESSION_COOKIE

logger = logging.getLogger(__name__)

# Paths reachable without authentication (login flow, health, the SPA shell).
AUTH_EXEMPT_EXACT = {
    "/api/auth/setup",
    "/api/auth/signup",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/status",
    "/api/auth/features",
    "/api/auth/settings",
    "/api/auth/integrations/presets",
    "/api/health",
    "/api/version",
    "/login",
}
AUTH_EXEMPT_PREFIXES = ("/static",)

# Headers that prove a request was forwarded by a proxy/tunnel (cloudflared,
# nginx, Caddy, Tailscale Funnel, …). cloudflared connects to the app FROM
# 127.0.0.1, so without this check every tunneled request would look like
# loopback and could bypass auth.
_PROXY_FWD_HEADERS = (
    "cf-connecting-ip",
    "cf-ray",
    "cf-visitor",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-real-ip",
    "forwarded",
)


def _is_auth_exempt(path: str) -> bool:
    return path in AUTH_EXEMPT_EXACT or any(path.startswith(p) for p in AUTH_EXEMPT_PREFIXES)


def _is_trusted_loopback(request: Request) -> bool:
    """True ONLY for a DIRECT loopback connection with no proxy/tunnel
    forwarding headers. A bare ``client.host in ('127.0.0.1','::1')`` check is
    unsafe behind a Cloudflare tunnel / reverse proxy: those connect from
    loopback, so a remote visitor would otherwise inherit local trust and
    slip past LOCALHOST_BYPASS or spoof the internal-tool path. Odysseus's own
    in-process agent loopback calls carry none of these headers, so they still
    qualify."""
    host = request.client.host if request.client else None
    if host not in ("127.0.0.1", "::1"):
        return False
    for _h in _PROXY_FWD_HEADERS:
        if request.headers.get(_h):
            return False
    return True


def configure_auth(app: FastAPI, auth_manager: AuthManager) -> None:
    """Install the auth middleware on ``app`` (no-op when ``AUTH_ENABLED`` is false)."""
    auth_enabled = os.getenv("AUTH_ENABLED", "true").lower() != "false"
    localhost_bypass = os.getenv("LOCALHOST_BYPASS", "false").lower() == "true"

    if not auth_enabled:
        logger.info("Auth middleware disabled (set AUTH_ENABLED=true to enable)")
        return

    # In-memory token cache: prefix → list[(token_id, token_hash, owner, scopes)]. The DB
    # query was running on every API-bearer request and scanning bcrypt
    # checks linearly. With this cache, we hit the DB only when the cache
    # version bumps (token created/revoked) — see invalidate below, called by
    # routes/api_token_routes.
    token_cache: dict = {}
    token_cache_lock = asyncio.Lock()

    def _token_cache_invalidate():
        app.state.__dict__["_token_cache_dirty"] = True

    app.state.invalidate_token_cache = _token_cache_invalidate
    app.state._token_cache = token_cache
    app.state._token_cache_dirty = True

    def _refresh_token_cache():
        """Rebuild the prefix→[(id,hash)] map from the DB."""
        new_map = defaultdict(list)
        db = SessionLocal()
        try:
            rows = db.query(ApiToken).filter(ApiToken.is_active == True).all()  # noqa: E712
            for r in rows:
                scopes = [
                    s.strip() for s in (getattr(r, "scopes", "") or "chat").split(",") if s.strip()
                ]
                new_map[r.token_prefix].append(
                    (r.id, r.token_hash, getattr(r, "owner", None), scopes)
                )
        finally:
            db.close()
        token_cache.clear()
        token_cache.update(new_map)
        app.state._token_cache_dirty = False

    class AuthMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            path = request.url.path
            if _is_auth_exempt(path):
                return await call_next(request)
            # In-process internal-tool token bypass. Used by the agent
            # tool layer when it HTTP-loopbacks to admin-gated routes
            # (no admin cookie available in that context). Restricted to
            # loopback clients + matching token to keep it locked down.
            try:
                from core.middleware import INTERNAL_TOOL_HEADER, INTERNAL_TOOL_TOKEN as _ITT

                _hdr = request.headers.get(INTERNAL_TOOL_HEADER)
                if _hdr and _hdr == _ITT and _is_trusted_loopback(request):
                    # Impersonation: when the agent's loopback call sets
                    # X-Odysseus-Owner, attribute the request to that user only
                    # if they exist. Authorization checks remain separate; this
                    # is just owner attribution for notes/calendar/etc.
                    _impersonate = (request.headers.get("X-Odysseus-Owner") or "").strip()
                    _auth_mgr = getattr(request.app.state, "auth_manager", None) or auth_manager
                    if _impersonate and _impersonate in getattr(_auth_mgr, "users", {}):
                        request.state.current_user = _impersonate
                    else:
                        request.state.current_user = "internal-tool"
                    request.state.api_token = False
                    return await call_next(request)
            except Exception:
                pass
            # Allow DIRECT localhost requests (internal service calls from
            # heartbeats etc.). Tunnel/proxy-forwarded requests are excluded by
            # _is_trusted_loopback so LOCALHOST_BYPASS can't be abused over a
            # Cloudflare tunnel / reverse proxy. Keep LOCALHOST_BYPASS=false for
            # network-exposed deployments regardless.
            if localhost_bypass and _is_trusted_loopback(request):
                return await call_next(request)
            if not auth_manager.is_configured:
                # No users yet — redirect to login for first-time setup
                if not path.startswith("/api/"):
                    return RedirectResponse(url="/login", status_code=302)
                return JSONResponse(status_code=401, content={"error": "Setup required"})

            # --- Bearer token auth (API tokens for external integrations) ---
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer ody_"):
                raw_token = auth_header[7:]
                # Sanity check: tokens are "ody_" + 43 chars of base64
                if len(raw_token) < 12 or len(raw_token) > 100:
                    return JSONResponse(status_code=401, content={"error": "Invalid API token"})
                prefix = raw_token[:8]
                try:
                    if app.state._token_cache_dirty:
                        async with token_cache_lock:
                            if app.state._token_cache_dirty:
                                await asyncio.to_thread(_refresh_token_cache)
                    candidates = list(token_cache.get(prefix, ()))
                    matched_id = None
                    matched_owner = None
                    matched_scopes = []
                    for tid, thash, owner, scopes in candidates:
                        if bcrypt.checkpw(raw_token.encode(), thash.encode()):
                            matched_id = tid
                            matched_owner = owner
                            matched_scopes = scopes or []
                            break
                    if matched_id:
                        # Update last_used_at off the hot path. Doing it
                        # inline used to keep the request open across an
                        # extra commit; do it fire-and-forget instead.
                        async def _touch_last_used(tid: str):
                            def _do():
                                _db = SessionLocal()
                                try:
                                    _db.query(ApiToken).filter(ApiToken.id == tid).update(
                                        {"last_used_at": datetime.utcnow()}
                                    )
                                    _db.commit()
                                finally:
                                    _db.close()

                            try:
                                await asyncio.to_thread(_do)
                            except Exception:
                                pass

                        asyncio.create_task(_touch_last_used(matched_id))
                        # Keep bearer-token callers out of normal cookie/user
                        # routes. API-aware routes can read api_token_owner.
                        request.state.current_user = "api"
                        request.state.api_token = True
                        request.state.api_token_id = matched_id
                        request.state.api_token_owner = matched_owner
                        request.state.api_token_scopes = matched_scopes
                        return await call_next(request)
                except Exception:
                    logger.warning("API token auth error", exc_info=False)
                # Invalid bearer token — reject immediately
                return JSONResponse(status_code=401, content={"error": "Invalid API token"})

            # --- Cookie-based session auth ---
            token = request.cookies.get(SESSION_COOKIE)
            if not auth_manager.validate_token(token):
                if path.startswith("/api/"):
                    return JSONResponse(status_code=401, content={"error": "Not authenticated"})
                return RedirectResponse(url="/login", status_code=302)

            # Attach current username to request state for downstream routes
            request.state.current_user = auth_manager.get_username_for_token(token)
            request.state.api_token = False
            return await call_next(request)

    app.add_middleware(AuthMiddleware)
    logger.info("Auth middleware enabled (AUTH_ENABLED=true)")
