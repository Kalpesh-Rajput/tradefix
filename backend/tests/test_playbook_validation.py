from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.trade_service import _validate_playbook


def test_missing_playbook_id_is_none():
    db = MagicMock()
    assert _validate_playbook(db, uuid4(), None) is None
    db.get.assert_not_called()


def test_unknown_playbook_raises_400():
    db = MagicMock()
    db.get.return_value = None
    with pytest.raises(HTTPException) as exc:
        _validate_playbook(db, uuid4(), uuid4())
    assert exc.value.status_code == 400


def test_foreign_or_archived_playbook_raises_400():
    db = MagicMock()
    owner = uuid4()
    row = MagicMock()
    row.user_id = uuid4()
    row.is_archived = False
    db.get.return_value = row
    with pytest.raises(HTTPException) as exc:
        _validate_playbook(db, owner, uuid4())
    assert exc.value.status_code == 400

    row.user_id = owner
    row.is_archived = True
    with pytest.raises(HTTPException) as exc:
        _validate_playbook(db, owner, uuid4())
    assert exc.value.status_code == 400


def test_owned_active_playbook_returns_id():
    db = MagicMock()
    owner = uuid4()
    playbook_id = uuid4()
    row = MagicMock()
    row.user_id = owner
    row.is_archived = False
    row.id = playbook_id
    db.get.return_value = row
    assert _validate_playbook(db, owner, playbook_id) == playbook_id
