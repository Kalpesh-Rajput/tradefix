from datetime import date
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.services.progress_tracker_service import reevaluate_dates


def test_reevaluate_dates_only_unique_days_not_span():
    db = MagicMock()
    db.scalars.return_value.all.return_value = []
    user = MagicMock()
    user.id = uuid4()

    with (
        patch("app.services.progress_tracker_service.get_or_create_settings") as settings,
        patch("app.services.progress_tracker_service.evaluate_day") as evaluate_day,
    ):
        reevaluate_dates(db, user, [date(2026, 1, 1), date(2026, 12, 31), date(2026, 1, 1)])
        settings.assert_called_once()
        days = [call.args[2] for call in evaluate_day.call_args_list]
        assert days == [date(2026, 1, 1), date(2026, 12, 31)]
        assert evaluate_day.call_count == 2


def test_reevaluate_dates_empty_is_noop():
    db = MagicMock()
    user = MagicMock()
    with patch("app.services.progress_tracker_service.evaluate_day") as evaluate_day:
        reevaluate_dates(db, user, [])
        evaluate_day.assert_not_called()
