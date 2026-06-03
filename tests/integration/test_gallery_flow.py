"""Critical flow: gallery upload → library listing.

Exercises routes/gallery_routes.py through the real app + DB, including the
multipart upload path (hash dedup, EXIF, persistence).
"""

import io

import pytest

pytestmark = pytest.mark.integration


def _png_bytes(color=(255, 0, 0)):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color).save(buf, format="PNG")
    return buf.getvalue()


def test_library_empty_shape(client):
    r = client.get("/api/gallery/library")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "total" in body
    assert isinstance(body["items"], list)


def test_upload_then_appears_in_library(client):
    before = client.get("/api/gallery/library").json()["total"]

    up = client.post(
        "/api/gallery/upload",
        files={"file": ("pic.png", _png_bytes(), "image/png")},
    )
    assert up.status_code == 200, up.text
    assert up.json()["ok"] is True
    image_id = up.json()["id"]

    after = client.get("/api/gallery/library").json()
    assert after["total"] == before + 1
    assert any(item["id"] == image_id for item in after["items"])


def test_upload_rejects_missing_file(client):
    r = client.post("/api/gallery/upload", data={"album_id": "x"})
    assert r.status_code == 400
