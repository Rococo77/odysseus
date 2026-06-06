"""Email HTML rendering & sanitization.

markdown -> email-safe inline HTML, plus an allowlist sanitizer for
user-supplied HTML bodies. Extracted from routes/email_routes.py.
"""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser as _HTMLParser


def _md_to_email_html(text: str) -> str:
    """Render the compose markdown body to a SAFE HTML fragment for the email's
    text/html part. Everything is HTML-escaped FIRST (so a pasted <script> /
    <img onerror=...> can never become live HTML in the recipient's client),
    then the toolbar's formatting is layered on with controlled regex: bold,
    italic, strike, inline code, http(s) links, headings, and bullet/numbered
    lists. Plain-text readers still get the raw markdown via the text/plain part.
    """

    def _inline(s: str) -> str:
        s = html.escape(s)  # escape BEFORE formatting
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
        s = re.sub(r"~~([^~]+)~~", r"<del>\1</del>", s)
        s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
        # links: text + http(s) url only (escape() already neutralised quotes)
        s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', s)
        return s

    parts: list[str] = []
    in_ul = in_ol = False
    for ln in (text or "").split("\n"):
        m_h = re.match(r"^(#{1,3})\s+(.*)$", ln)
        m_ul = re.match(r"^\s*[-*]\s+(.*)$", ln)
        m_ol = re.match(r"^\s*\d+\.\s+(.*)$", ln)
        if m_h:
            if in_ul:
                parts.append("</ul>")
                in_ul = False
            if in_ol:
                parts.append("</ol>")
                in_ol = False
            lvl = len(m_h.group(1))
            parts.append(f"<h{lvl}>{_inline(m_h.group(2))}</h{lvl}>")
        elif m_ul:
            if in_ol:
                parts.append("</ol>")
                in_ol = False
            if not in_ul:
                parts.append("<ul>")
                in_ul = True
            parts.append(f"<li>{_inline(m_ul.group(1))}</li>")
        elif m_ol:
            if in_ul:
                parts.append("</ul>")
                in_ul = False
            if not in_ol:
                parts.append("<ol>")
                in_ol = True
            parts.append(f"<li>{_inline(m_ol.group(1))}</li>")
        else:
            if in_ul:
                parts.append("</ul>")
                in_ul = False
            if in_ol:
                parts.append("</ol>")
                in_ol = False
            parts.append(_inline(ln) + "<br>")
    if in_ul:
        parts.append("</ul>")
    if in_ol:
        parts.append("</ol>")
    return "<html><body>" + "\n".join(parts) + "</body></html>"


# Tags the WYSIWYG email composer may legitimately produce.
_EMAIL_ALLOWED_TAGS = {
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "strike",
    "del",
    "a",
    "br",
    "p",
    "div",
    "ul",
    "ol",
    "li",
    "blockquote",
    "span",
    "h1",
    "h2",
    "h3",
    "code",
    "pre",
}


class _EmailHtmlSanitizer(_HTMLParser):
    """Allowlist sanitizer for WYSIWYG-composed email HTML. Emits only known
    formatting tags (all attributes dropped except a safe href on <a>), escapes
    all text, and discards <script>/<style> content entirely — so client-sent
    HTML can never carry live script/handlers into the recipient's client."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self._skip = 0  # depth inside <script>/<style>

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
            return
        if tag == "br":
            self.out.append("<br>")
            return
        if tag not in _EMAIL_ALLOWED_TAGS:
            return
        if tag == "a":
            href = ""
            for k, v in attrs:
                if k.lower() == "href" and v and re.match(r"^(https?:|mailto:)", v.strip(), re.I):
                    href = v.strip()
            self.out.append(
                f'<a href="{html.escape(href, quote=True)}" target="_blank" rel="noopener noreferrer">'
                if href
                else "<a>"
            )
        else:
            self.out.append(f"<{tag}>")

    def handle_startendtag(self, tag, attrs):
        if tag == "br":
            self.out.append("<br>")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            if self._skip:
                self._skip -= 1
            return
        if tag == "br" or tag not in _EMAIL_ALLOWED_TAGS:
            return
        self.out.append(f"</{tag}>")

    def handle_data(self, data):
        if self._skip:
            return
        self.out.append(html.escape(data))


def _sanitize_email_html(raw: str) -> str:
    """Return a safe <html><body>…</body></html> from client-supplied compose
    HTML, or None if it can't be parsed."""
    p = _EmailHtmlSanitizer()
    try:
        p.feed(raw or "")
        p.close()
    except Exception:
        return None
    inner = "".join(p.out).strip()
    if not inner:
        return None
    return f"<html><body>{inner}</body></html>"
