"""Static-file serving.

Two concerns live here: the cache-revalidating ``/static`` mount (the legacy
UI ships unversioned ES modules, so browsers must revalidate them), and the
ownership-checked ``/api/generated-image/{filename}`` endpoint.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core.constants import STATIC_DIR

# Generated-image filenames are content hashes with a known media extension.
_FILENAME_RE = re.compile(r"^[a-f0-9]{8,64}\.(png|jpg|jpeg|webp|gif|mp4|mov|webm|mkv|m4v)$")
_MIME_BY_EXT = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "gif": "image/gif",
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
    "mkv": "video/x-matroska",
    "m4v": "video/mp4",
}


class RevalidatingStatic(StaticFiles):
    """Serve static assets normally, but force the browser to REVALIDATE
    source files (.js/.css/.html) on every load instead of serving a stale
    copy from disk cache. The app ships raw ES modules with no build step or
    versioned URLs, so browsers were caching modules across deploys — a code
    change wouldn't appear without a manual hard-refresh. `no-cache` keeps the
    cached bytes but requires a conditional request; unchanged files still
    return a cheap 304 (ETag/Last-Modified are preserved)."""

    async def get_response(self, path, scope):
        resp = await super().get_response(path, scope)
        if path.endswith((".js", ".css", ".html")):
            resp.headers["Cache-Control"] = "no-cache"
        return resp


def mount_static(app: FastAPI) -> None:
    """Mount the revalidating ``/static`` directory."""
    os.makedirs(STATIC_DIR, exist_ok=True)
    app.mount("/static", RevalidatingStatic(directory="static"), name="static")


generated_images_router = APIRouter()


@generated_images_router.get("/api/generated-image/{filename}")
async def serve_generated_image(filename: str, request: Request):
    """Serve generated images from the data directory."""
    if not _FILENAME_RE.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    img_path = Path("data/generated_images") / filename
    if not img_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    # SECURITY: filename is the only key, so anyone who knows / guesses a
    # 12-hex content hash could pull another user's image bytes. Require
    # auth and verify ownership via the gallery row (when one exists).
    try:
        from src.auth_helpers import get_current_user
        from core.database import SessionLocal as _SL, GalleryImage as _GI

        _user = get_current_user(request)
        if _user:
            _db = _SL()
            try:
                _row = _db.query(_GI).filter(_GI.filename == filename).first()
                # Generated-but-not-yet-imported images have no row → allow.
                # Row exists with a different owner → 404 (don't confirm existence).
                if _row is not None and _row.owner and _row.owner != _user:
                    raise HTTPException(status_code=404, detail="Image not found")
            finally:
                _db.close()
    except HTTPException:
        raise
    except Exception:
        pass
    ext = filename.rsplit(".", 1)[-1].lower()
    mime = _MIME_BY_EXT.get(ext, "application/octet-stream")
    # Generated-image filenames are content hashes → the bytes for a given
    # filename never change. Cache them hard so the gallery doesn't
    # re-download every full-size image each time it's opened. `immutable`
    # tells the browser it never needs to revalidate within the max-age.
    return FileResponse(
        str(img_path),
        media_type=mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
