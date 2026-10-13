from pydantic import ValidationError

from app.schemas.auth import UserUpdateRequest
from app.schemas.custom_theme import CustomThemesDocument, stored_document


def _theme(name: str = "Desk", color: str = "#112233") -> dict:
    return {
        "id": "ct_0123456789ab",
        "name": name,
        "base_theme_id": "tradefix-purple",
        "mode": "light",
        "schema_version": 1,
        "tokens": {"primary": color},
    }


def test_custom_theme_document_accepts_colors():
    document = CustomThemesDocument.model_validate({"revision": 0, "themes": [_theme()]})
    stored = stored_document({"revision": 0, "themes": []}, document)
    assert stored["revision"] == 1
    assert stored["themes"][0]["tokens"]["primary"] == "#112233"


def test_custom_theme_rejects_bad_color_and_builtin_id():
    try:
        CustomThemesDocument.model_validate({"revision": 0, "themes": [_theme(color="javascript:alert(1)")]})
    except ValidationError:
        pass
    else:
        raise AssertionError("bad color was accepted")

    payload = _theme()
    payload["id"] = "tradefix-purple"
    try:
        CustomThemesDocument.model_validate({"revision": 0, "themes": [payload]})
    except ValidationError:
        pass
    else:
        raise AssertionError("built-in id was accepted")


def test_stale_revision_is_rejected():
    document = CustomThemesDocument.model_validate({"revision": 1, "themes": [_theme()]})
    try:
        stored_document({"revision": 2, "themes": []}, document)
    except ValueError as exc:
        assert str(exc) == "revision"
    else:
        raise AssertionError("stale revision was accepted")


def test_profile_theme_field_accepts_custom_id():
    updated = UserUpdateRequest.model_validate({"theme": "ct_0123456789ab"})
    assert updated.theme == "ct_0123456789ab"


def test_duplicate_names_are_rejected():
    first = _theme("Shared")
    second = _theme("shared")
    second["id"] = "ct_abcdefabcdef"
    try:
        CustomThemesDocument.model_validate({"revision": 0, "themes": [first, second]})
    except ValidationError:
        pass
    else:
        raise AssertionError("duplicate names were accepted")
