from uuid import uuid4

from app.services.ai.rag.store import cosine_similarity, _lexical_score, _query_tokens
from app.services.ai.tools.filters import sanitize_tool_args


def test_cosine_and_lexical_ranking():
    query = "breakout fomo early entry"
    tokens = _query_tokens(query)
    own = "Breakout notes: I keep entering early from FOMO before confirmation."
    other = "Unrelated grocery list and weather comments."
    assert _lexical_score(own, tokens) > _lexical_score(other, tokens)
    left = [1.0, 0.2, 0.0]
    right = [1.0, 0.1, 0.0]
    noise = [0.0, 0.0, 1.0]
    assert cosine_similarity(left, right) > cosine_similarity(left, noise)


def test_user_id_cannot_be_injected_into_rag_args():
    cleaned = sanitize_tool_args({"user_id": str(uuid4()), "query": "mistakes"})
    assert cleaned == {"query": "mistakes"}
