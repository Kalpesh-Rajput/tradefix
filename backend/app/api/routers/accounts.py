import csv
import io
import logging
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.account import Account
from app.models.trade import Trade
from app.models.user import User
from app.schemas.account import AccountCreate, AccountResponse, AccountUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _ensure_default(db: Session, user_id: uuid.UUID) -> Account | None:
    """Ensure at least one default account exists for the user."""
    accounts = list(db.scalars(select(Account).where(Account.user_id == user_id).order_by(Account.created_at.asc())))
    if not accounts:
        return None
    if not any(a.is_default for a in accounts):
        accounts[0].is_default = True
        db.commit()
        db.refresh(accounts[0])
    return next(a for a in accounts if a.is_default)


def get_default_account(db: Session, user: User) -> Account:
    account = db.scalar(
        select(Account).where(Account.user_id == user.id, Account.is_default.is_(True))
    )
    if account:
        return account

    account = db.scalar(select(Account).where(Account.user_id == user.id).order_by(Account.created_at.asc()))
    if account:
        account.is_default = True
        db.commit()
        db.refresh(account)
        return account

    account = Account(
        user_id=user.id,
        name="Main Account",
        is_default=True,
        initial_balance=Decimal("10000"),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def _trade_counts(db: Session, user_id: uuid.UUID) -> dict[uuid.UUID, int]:
    rows = db.execute(
        select(Trade.account_id, func.count(Trade.id))
        .where(Trade.user_id == user_id)
        .group_by(Trade.account_id)
    ).all()
    return {account_id: count for account_id, count in rows}


def _to_response(account: Account, trade_count: int = 0) -> AccountResponse:
    return AccountResponse(
        id=account.id,
        name=account.name,
        description=account.description,
        base_currency=account.base_currency,
        initial_balance=account.initial_balance,
        pnl_display_mode=account.pnl_display_mode,
        default_fee_per_trade=account.default_fee_per_trade,
        is_default=account.is_default,
        trade_count=trade_count,
    )


def _owned_account(db: Session, account_id: uuid.UUID, user: User) -> Account:
    account = db.get(Account, account_id)
    if not account or account.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


def _set_as_default(db: Session, account: Account) -> None:
    db.execute(
        update(Account)
        .where(Account.user_id == account.user_id, Account.id != account.id)
        .values(is_default=False)
    )
    account.is_default = True


@router.get("", response_model=list[AccountResponse])
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_default(db, current_user.id)
    accounts = list(
        db.scalars(
            select(Account).where(Account.user_id == current_user.id).order_by(Account.created_at.asc())
        )
    )
    counts = _trade_counts(db, current_user.id)
    return [_to_response(a, counts.get(a.id, 0)) for a in accounts]


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = list(db.scalars(select(Account).where(Account.user_id == current_user.id)))
    make_default = payload.is_default or len(existing) == 0

    account = Account(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        base_currency=payload.base_currency,
        initial_balance=payload.initial_balance,
        pnl_display_mode=payload.pnl_display_mode,
        default_fee_per_trade=payload.default_fee_per_trade,
        is_default=False,
    )
    db.add(account)
    db.flush()

    if make_default:
        _set_as_default(db, account)

    db.commit()
    db.refresh(account)
    logger.info("account_created user=%s account=%s", current_user.id, account.id)
    return _to_response(account, 0)


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _owned_account(db, account_id, current_user)
    counts = _trade_counts(db, current_user.id)
    return _to_response(account, counts.get(account.id, 0))


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: uuid.UUID,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _owned_account(db, account_id, current_user)
    data = payload.model_dump(exclude_unset=True)

    make_default = data.pop("is_default", None)
    for key, value in data.items():
        setattr(account, key, value)

    if make_default is True:
        _set_as_default(db, account)
    elif make_default is False and account.is_default:
        # Cannot unset default without selecting another — keep current
        pass

    db.commit()
    db.refresh(account)
    counts = _trade_counts(db, current_user.id)
    logger.info("account_updated user=%s account=%s", current_user.id, account.id)
    return _to_response(account, counts.get(account.id, 0))


@router.post("/{account_id}/set-default", response_model=AccountResponse)
def set_default_account(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _owned_account(db, account_id, current_user)
    _set_as_default(db, account)
    db.commit()
    db.refresh(account)
    counts = _trade_counts(db, current_user.id)
    return _to_response(account, counts.get(account.id, 0))


@router.get("/{account_id}/export")
def export_trade_history(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _owned_account(db, account_id, current_user)
    trades = list(
        db.scalars(
            select(Trade)
            .where(Trade.user_id == current_user.id, Trade.account_id == account.id)
            .order_by(Trade.opened_at.desc())
        )
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "symbol",
            "side",
            "quantity",
            "entry_price",
            "exit_price",
            "opened_at",
            "closed_at",
            "fees",
            "setup_tag",
            "notes",
            "status",
            "pnl",
            "asset_type",
        ]
    )
    for t in trades:
        writer.writerow(
            [
                t.symbol,
                t.side.value if hasattr(t.side, "value") else t.side,
                t.quantity,
                t.entry_price,
                t.exit_price if t.exit_price is not None else "",
                t.opened_at.isoformat() if t.opened_at else "",
                t.closed_at.isoformat() if t.closed_at else "",
                t.fees if t.fees is not None else 0,
                t.setup_tag or "",
                (t.notes or "").replace("\n", " ").strip(),
                t.status.value if hasattr(t.status, "value") else t.status,
                t.pnl if t.pnl is not None else "",
                t.asset_type.value if hasattr(t.asset_type, "value") else t.asset_type,
            ]
        )

    buffer.seek(0)
    filename = f"{account.name.replace(' ', '_').lower()}_trades.csv"
    logger.info("account_export user=%s account=%s trades=%s", current_user.id, account.id, len(trades))
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _owned_account(db, account_id, current_user)
    accounts = list(db.scalars(select(Account).where(Account.user_id == current_user.id)))
    if len(accounts) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your only account",
        )

    was_default = account.is_default
    db.delete(account)
    db.flush()

    if was_default:
        remaining = db.scalar(
            select(Account).where(Account.user_id == current_user.id).order_by(Account.created_at.asc())
        )
        if remaining:
            remaining.is_default = True

    db.commit()
    logger.info("account_deleted user=%s account=%s", current_user.id, account_id)
    return None
