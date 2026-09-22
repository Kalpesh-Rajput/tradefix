"""OpenAI-compatible chat client for Groq or OpenRouter.

Business logic must not hardcode a model id or provider URL.
Read AI_PROVIDER plus GROQ_* / OPENROUTER_* from settings.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None
_client_key: tuple[str, str] | None = None
_embedding_client: OpenAI | None = None
_embedding_client_key: tuple[str, str] | None = None


def get_client() -> OpenAI:
    """Chat completions client for the active AI_PROVIDER."""
    global _client, _client_key
    key = (settings.ai_base_url, settings.ai_api_key or "missing-key")
    if _client is None or _client_key != key:
        _client = OpenAI(
            base_url=settings.ai_base_url,
            api_key=key[1],
            timeout=20.0,
            max_retries=0,
        )
        _client_key = key
    return _client


def get_embedding_client() -> OpenAI:
    """Embeddings stay on OpenRouter when an embedding model is configured."""
    global _embedding_client, _embedding_client_key
    key = (settings.openrouter_base_url, settings.openrouter_api_key or "missing-key")
    if _embedding_client is None or _embedding_client_key != key:
        _embedding_client = OpenAI(
            base_url=settings.openrouter_base_url,
            api_key=key[1],
        )
        _embedding_client_key = key
    return _embedding_client


class AiNotConfiguredError(Exception):
    pass


class AiProviderError(Exception):
    def __init__(self, message: str, code: str = "provider_error"):
        super().__init__(message)
        self.code = code


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class TokenUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


@dataclass
class ChatResult:
    content: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    usage: TokenUsage = field(default_factory=TokenUsage)
    finish_reason: str | None = None


class AIModelProvider(Protocol):
    def is_configured(self) -> bool: ...

    @property
    def model_id(self) -> str: ...

    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        *,
        temperature: float = 0.4,
        max_tokens: int = 800,
        tool_choice: str | None = None,
    ) -> ChatResult: ...


def _extra_headers() -> dict[str, str]:
    if settings.active_ai_provider != "openrouter":
        return {}
    return {
        "HTTP-Referer": settings.frontend_origin.split(",")[0].strip() or settings.frontend_origin,
        "X-Title": settings.app_name,
    }


def _parse_tool_calls(message: Any) -> list[ToolCall]:
    out: list[ToolCall] = []
    raw_calls = getattr(message, "tool_calls", None) or []
    for tc in raw_calls:
        fn = getattr(tc, "function", None)
        if fn is None:
            continue
        name = getattr(fn, "name", "") or ""
        raw_args = getattr(fn, "arguments", None) or "{}"
        args: dict[str, Any]
        if isinstance(raw_args, dict):
            args = raw_args
        else:
            try:
                parsed = json.loads(raw_args)
                args = parsed if isinstance(parsed, dict) else {"_raw": raw_args}
            except json.JSONDecodeError:
                args = {"_raw": str(raw_args)}
        out.append(ToolCall(id=getattr(tc, "id", "") or name, name=name, arguments=args))
    return out


def _usage_from_response(response: Any) -> TokenUsage:
    usage = getattr(response, "usage", None)
    if usage is None:
        return TokenUsage()
    prompt = getattr(usage, "prompt_tokens", None)
    completion = getattr(usage, "completion_tokens", None)
    total = getattr(usage, "total_tokens", None)
    return TokenUsage(
        input_tokens=prompt if isinstance(prompt, int) else None,
        output_tokens=completion if isinstance(completion, int) else None,
        total_tokens=total if isinstance(total, int) else None,
    )


def _result_from_tool_failure(exc: APIStatusError) -> ChatResult | None:
    """Groq returns 400 when a model emits a tool call with tool_choice none.

    The failed generation is still a usable tool call, so keep the chat going.
    """
    body = getattr(exc, "body", None)
    if not isinstance(body, dict):
        return None
    err = body.get("error")
    if not isinstance(err, dict) or err.get("code") != "tool_use_failed":
        return None
    failed = err.get("failed_generation")
    if not isinstance(failed, str) or not failed.strip():
        return None
    return ChatResult(content=failed.strip(), tool_calls=[])


class CompatibleChatProvider:
    def is_configured(self) -> bool:
        return bool(settings.ai_api_key)

    @property
    def model_id(self) -> str:
        return settings.ai_model

    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        *,
        temperature: float = 0.4,
        max_tokens: int = 800,
        tool_choice: str | None = None,
    ) -> ChatResult:
        if not self.is_configured():
            raise AiNotConfiguredError(
                f"{settings.ai_key_name} is not set. Add it to your backend .env."
            )
        kwargs: dict[str, Any] = {
            "model": settings.ai_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        headers = _extra_headers()
        if headers:
            kwargs["extra_headers"] = headers
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = tool_choice or "auto"
        try:
            response = get_client().chat.completions.create(**kwargs)
        except RateLimitError as exc:
            raise AiProviderError("The AI provider is rate limited. Please try again shortly.", "rate_limit") from exc
        except APITimeoutError as exc:
            raise AiProviderError("The AI provider timed out. Please try again.", "timeout") from exc
        except APIConnectionError as exc:
            raise AiProviderError("The AI provider is unavailable. Please try again.", "unavailable") from exc
        except APIStatusError as exc:
            recovered = _result_from_tool_failure(exc)
            if recovered is not None:
                logger.warning("Recovered a provider tool_use_failed response as a tool call")
                return recovered
            status = getattr(exc, "status_code", None)
            if status == 429:
                raise AiProviderError("The AI provider is rate limited. Please try again shortly.", "rate_limit") from exc
            if status == 404:
                raise AiProviderError(
                    "The configured AI model is not available. Update GROQ_MODEL or OPENROUTER_MODEL.",
                    "model_not_found",
                ) from exc
            raise AiProviderError("The AI provider returned an invalid response.", "invalid_response") from exc
        except Exception as exc:  # noqa: BLE001
            logger.exception("%s chat failed", settings.active_ai_provider)
            raise AiProviderError("The AI provider is unavailable. Please try again.", "unavailable") from exc

        choice = response.choices[0] if response.choices else None
        if choice is None:
            raise AiProviderError("The AI provider returned an empty response.", "invalid_response")
        message = choice.message
        content = message.content if isinstance(message.content, str) else None
        if not (content and content.strip()):
            reasoning = getattr(message, "reasoning", None)
            if isinstance(reasoning, str) and reasoning.strip():
                content = reasoning.strip()
        return ChatResult(
            content=content,
            tool_calls=_parse_tool_calls(message),
            usage=_usage_from_response(response),
            finish_reason=getattr(choice, "finish_reason", None),
        )


OpenRouterProvider = CompatibleChatProvider

_provider: CompatibleChatProvider | None = None
_provider_key: tuple[str, str, str] | None = None


def get_provider() -> CompatibleChatProvider:
    global _provider, _provider_key
    key = (settings.active_ai_provider, settings.ai_base_url, settings.ai_model)
    if _provider is None or _provider_key != key:
        _provider = CompatibleChatProvider()
        _provider_key = key
    return _provider


def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str:
    result = get_provider().chat(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.6,
        max_tokens=max_tokens,
    )
    return (result.content or "").strip()
