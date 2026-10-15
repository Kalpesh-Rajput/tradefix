"""Every Settings field has a matching name in backend/.env.example."""

from pathlib import Path

from app.core.config import Settings

EXAMPLE = Path(__file__).resolve().parents[1] / ".env.example"


def test_every_setting_is_in_the_example():
    text = EXAMPLE.read_text(encoding="utf-8").upper()
    missing = [name for name in Settings.model_fields if name.upper() not in text]
    assert missing == []
