from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import KlineBar
from app.schemas import KlineRow

router = APIRouter(prefix="/api", tags=["historical"])


def _fmt_date(yyyymmdd: str) -> str:
    if len(yyyymmdd) == 8:
        return f"{yyyymmdd[0:4]}-{yyyymmdd[4:6]}-{yyyymmdd[6:8]}"
    return yyyymmdd


@router.get("/historical", response_model=list[KlineRow])
def historical(
    symbol: str = Query(...),
    start: str | None = None,
    end: str | None = None,
    period: str = Query("daily"),
    db: Session = Depends(get_db),
):
    q = select(KlineBar).where(KlineBar.symbol == symbol.zfill(6), KlineBar.period == period)
    if start:
        q = q.where(KlineBar.trade_date >= start.replace("-", ""))
    if end:
        q = q.where(KlineBar.trade_date <= end.replace("-", ""))
    q = q.order_by(KlineBar.trade_date.asc())
    rows = db.execute(q).scalars().all()
    return [
        KlineRow(
            date=_fmt_date(r.trade_date),
            open=r.open,
            high=r.high,
            low=r.low,
            close=r.close,
            volume=r.volume,
            amount=r.amount,
        )
        for r in rows
    ]
