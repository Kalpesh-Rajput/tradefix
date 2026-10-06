from app.services.masters_service import pack_moods, parse_moods, parse_went_well


def test_parse_went_well_list_dedupes():
    assert parse_went_well(["Followed Plan", " followed plan ", "Good Entry"]) == ["Followed Plan", "Good Entry"]


def test_parse_went_well_legacy_string():
    assert parse_went_well("Followed Plan, Patient Entry") == ["Followed Plan", "Patient Entry"]


def test_parse_went_well_empty():
    assert parse_went_well(None) == []
    assert parse_went_well("") == []
    assert parse_went_well(["", "  "]) == []


def test_parse_moods_list_dedupes():
    assert parse_moods(["Calm", " calm ", "Focused"]) == ["Calm", "Focused"]


def test_parse_moods_legacy_string():
    assert parse_moods("Calm, Confident") == ["Calm", "Confident"]


def test_pack_moods_prefers_list_and_writes_summary():
    extra, summary, labels = pack_moods({"moods": ["Calm", "Focused"], "display_status": "open"}, "Ignored", from_list=True)
    assert labels == ["Calm", "Focused"]
    assert summary == "Calm, Focused"
    assert extra["display_status"] == "open"
    assert extra["moods"] == ["Calm", "Focused"]


def test_pack_moods_from_legacy_string():
    extra, summary, labels = pack_moods({}, "Tired, Anxious", from_list=False)
    assert labels == ["Tired", "Anxious"]
    assert summary == "Tired, Anxious"
    assert extra["moods"] == labels


def test_pack_moods_clears():
    extra, summary, labels = pack_moods({"moods": []}, "Calm", from_list=True)
    assert labels == []
    assert summary is None
    assert extra["moods"] == []
