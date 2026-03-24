import uuid
from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import KlineBar, StockMeta, SyncTaskRecord
from app.services import ak_client


def create_task(db: Session) -> str:
    task_id = uuid.uuid4().hex
    db.add(SyncTaskRecord(task_id=task_id, status="queued"))
    db.commit()
    return task_id


def refresh_stock_meta(db: Session) -> int:
    df = ak_client.fetch_stock_list()
    if df.empty:
        return 0

    code_col = "code" if "code" in df.columns else df.columns[0]
    name_col = "name" if "name" in df.columns else df.columns[1]
    count = 0
    for _, row in df.iterrows():
        symbol = str(row[code_col]).zfill(6)
        name = str(row[name_col])
        existing = db.execute(select(StockMeta).where(StockMeta.symbol == symbol)).scalar_one_or_none()
        if existing:
            existing.name = name
            existing.updated_at = datetime.utcnow()
        else:
            db.add(StockMeta(symbol=symbol, name=name, industry=""))
        count += 1
    db.commit()
    return count


def _normalize_hist(df: pd.DataFrame) -> list[dict]:
    if df is None or df.empty:
        return []
    col_map = {"日期": "date", "开盘": "open", "最高": "high", "最低": "low", "收盘": "close", "成交量": "volume", "成交额": "amount"}
    normalized = df.rename(columns=col_map)
    out: list[dict] = []
    for _, r in normalized.iterrows():
        trade_date = str(r.get("date", "")).replace("-", "")[:8]
        if not trade_date:
            continue
        out.append(
            {
                "trade_date": trade_date,
                "open": float(r.get("open", 0) or 0),
                "high": float(r.get("high", 0) or 0),
                "low": float(r.get("low", 0) or 0),
                "close": float(r.get("close", 0) or 0),
                "volume": float(r.get("volume", 0) or 0),
                "amount": float(r.get("amount", 0) or 0),
            }
        )
    return out


def upsert_kline(db: Session, symbol: str, period: str, rows: list[dict]) -> int:
    if not rows:
        return 0
    payload = [{"symbol": symbol, "period": period, **r} for r in rows]
    stmt = sqlite_insert(KlineBar).values(payload)
    stmt = stmt.on_conflict_do_update(
        index_elements=["symbol", "period", "trade_date"],
        set_={
            "open": stmt.excluded.open,
            "high": stmt.excluded.high,
            "low": stmt.excluded.low,
            "close": stmt.excluded.close,
            "volume": stmt.excluded.volume,
            "amount": stmt.excluded.amount,
        },
    )
    db.execute(stmt)
    return len(payload)


def run_sync_job(db: Session, task_id: str, symbols: list[str], start: str, end: str, period: str) -> None:
    task = db.get(SyncTaskRecord, task_id)
    if not task:
        return
    task.status = "running"
    task.total = len(symbols)
    task.updated_at = datetime.utcnow()
    db.commit()

    done = 0
    failed = 0
    for symbol in symbols:
        task.current_symbol = symbol
        task.updated_at = datetime.utcnow()
        db.commit()
        try:
            hist_df = ak_client.fetch_hist(symbol, start, end, period)
            rows = _normalize_hist(hist_df)
            upsert_kline(db, symbol, period, rows)
            db.commit()
            done += 1
        except Exception as ex:
            failed += 1
            task.message = f"{symbol}: {ex}"
            db.commit()
        task.done = done
        task.failed = failed
        task.updated_at = datetime.utcnow()
        db.commit()

    task.status = "done" if failed == 0 else "done_with_errors"
    task.current_symbol = ""
    task.updated_at = datetime.utcnow()
    db.commit()
