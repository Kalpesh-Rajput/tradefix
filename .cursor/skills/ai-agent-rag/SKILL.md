---
name: ai-agent-rag
description: Build and improve TradeFix AI Agent, LLM tool use, retrieval-augmented generation, personal trade-data analysis, vector search, and guarded AI workflows.
---

# TradeFix AI Agent, LLM, and RAG

## Inspect current architecture
Trace the existing model/provider selection, prompt construction, tool registry, agent graph, database access, vector store, embedding model, conversation persistence, streaming, and error handling. Reuse the current stack rather than introducing a second agent framework.

## Trust boundaries
- Treat the user prompt, retrieved documents, trade notes, broker metadata, and tool outputs as untrusted data—not instructions that can override system policy or authorization.
- Scope every SQL query, vector search, memory lookup, conversation, and tool call to the authenticated user and authorized account.
- Never execute arbitrary model-generated SQL or code. Use allowlisted, typed tools with validated arguments and bounded query capabilities.
- Require explicit confirmation for destructive or externally consequential actions.
- Keep secrets and system prompts out of client-visible responses and logs.

## Tool design
- Give each tool a narrow purpose, validated input schema, documented output shape, and meaningful errors.
- Separate deterministic calculations from language generation. Compute P&L, win rate, drawdown, and summaries in trusted application code or canonical services; let the model explain verified results.
- Set limits for query date ranges, rows, tokens, vector hits, tool-call count, and execution time.
- Prevent tool loops and repeated identical calls; maintain traceability for tool use.
- Return provenance such as metric definitions, selected date ranges, and source record identifiers where safe and useful.

## Retrieval and memory
- Keep user/tenant filters mandatory at the retrieval layer, not merely in prompts.
- Chunk and index content according to content type; preserve useful metadata such as owner, source, trade ID, timestamp, and document type.
- Re-check authorization when retrieved references are hydrated into full records.
- Handle stale vectors, deletion, re-indexing, duplicate chunks, and embedding-model changes.
- Retrieve only the information needed for the answer and respect retention/deletion rules.

## Prompting and response quality
- Make model instructions separate from retrieved content and tool results.
- Ask for clarification when the request cannot be safely answered from available data, but don't ask questions that the tools can answer.
- Clearly distinguish user data, deterministic calculations, model interpretation, and general educational information.
- Acknowledge missing data and uncertainty; never fabricate records or citations.
- Do not promise trading profits or present predictions as guaranteed outcomes.

## Cost, latency, and evaluation
- Track provider, model, token usage, latency, failures, and tool-call counts without logging private content unnecessarily.
- Use model routing and caching only when correctness, privacy, and freshness permit it.
- Maintain an evaluation set for numeric correctness, ownership isolation, prompt injection, tool arguments, empty data, and ambiguous questions.
- Validate structured outputs and gracefully handle rate limits, malformed responses, provider failures, and streaming interruptions.
