"""Hard request-timeout middleware.

If a single request takes longer than ``REQUEST_HARD_TIMEOUT`` it is aborted
with a 504 instead of holding the event loop hostage. Whitelisted paths
(streaming, long-running shell exec, research, large uploads, diffusion
proxies) are exempt because they legitimately stay open — without this a single
hung ``subprocess.run`` or missing-timeout ``httpx`` call would lock up the
server for everyone.
"""

from __future__ import annotations

import asyncio
import os

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

REQUEST_HARD_TIMEOUT = float(os.getenv("REQUEST_HARD_TIMEOUT", "45"))

# Path prefixes exempt from the hard timeout — these stream or run for minutes.
TIMEOUT_EXEMPT_PREFIXES = (
    "/api/chat",  # streaming
    "/api/shell/stream",  # SSE
    "/api/research",  # multi-minute jobs
    "/api/model/download",  # tmux setup may run pip installs
    "/api/model/probe",  # SSE; iterates models with up to 8s timeout each
    "/api/model-endpoints",  # /probe sub-route also iterates models
    "/api/cookbook/setup",  # remote pacman/apt installs
    "/api/upload",  # large files
    "/api/image",  # diffusion proxies (inpaint/harmonize/upscale/etc.) — own 120s httpx timeout
)


class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        path = request.url.path or ""
        if any(path.startswith(p) for p in TIMEOUT_EXEMPT_PREFIXES):
            return await call_next(request)
        try:
            return await asyncio.wait_for(call_next(request), timeout=REQUEST_HARD_TIMEOUT)
        except asyncio.TimeoutError:
            return JSONResponse(
                {"detail": f"Request exceeded {REQUEST_HARD_TIMEOUT:.0f}s timeout"},
                status_code=504,
            )


def add_request_timeout(app: FastAPI) -> None:
    """Register the hard request-timeout middleware on ``app``."""
    app.add_middleware(RequestTimeoutMiddleware)
