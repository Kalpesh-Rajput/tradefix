"""Classify a Dukascopy response as a block. This does not retry, solve, or work around the block."""

from __future__ import annotations

_MARKERS = ("awswaf", "x-amzn-waf", "captcha", "challenge-platform", "goku")


def _excerpt(body: bytes) -> str:
    text = body[:300].decode("utf-8", errors="replace").replace("\n", " ").strip()
    return text[:200]


def _markers(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _MARKERS)


def classify_http(status: int, headers: dict, body: bytes) -> tuple[int, str] | None:
    """Return (status, excerpt) when the response is a challenge or block, else None.

    A 202 from the data host is the AWS WAF response seen on this network. HTML where a
    binary candle file was expected is the same kind of block. Ordinary 404s are not.
    """
    header_text = " ".join(f"{key}:{value}" for key, value in headers.items())
    excerpt = _excerpt(body)
    html = body.lstrip()[:1] == b"<" or b"<html" in body[:200].lower() or b"<!doctype" in body[:200].lower()
    if status == 202 or _markers(header_text) or _markers(excerpt) or (html and status in (200, 403)):
        return status, excerpt
    return None


def classify_text(text: str) -> str | None:
    """Return a short excerpt when tool stdout/stderr or a saved file looks like a challenge page."""
    if not text:
        return None
    sample = text[:500]
    if _markers(sample) or "<html" in sample.lower() or "<!doctype" in sample.lower():
        return sample.replace("\n", " ").strip()[:200]
    return None
