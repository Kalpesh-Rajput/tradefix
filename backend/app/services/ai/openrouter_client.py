"""Thin wrapper around OpenRouter's OpenAI-compatible chat completions API.

OpenRouter (https://openrouter.ai) proxies many models -- including several
free ones (suffixed ":free") -- behind a single OpenAI-compatible endpoint,
so we can reuse the official `openai` Python SDK by pointing it at a
different base_url.
"""

from openai import OpenAI

from app.core.config import settings

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=settings.openrouter_base_url,
            api_key=settings.openrouter_api_key or "missing-key",
        )
    return _client


class AiNotConfiguredError(Exception):
    pass


def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str:
    if not settings.openrouter_api_key:
        raise AiNotConfiguredError(
            "OPENROUTER_API_KEY is not set. Add a free key from https://openrouter.ai/keys to your backend .env."
        )

    client = get_client()
    response = client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=0.6,
        extra_headers={
            "HTTP-Referer": settings.frontend_origin,
            "X-Title": settings.app_name,
        },
    )
    return response.choices[0].message.content.strip()
