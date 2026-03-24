from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StockMeta
from app.schemas import StockItem
from app.services.sync_service import refresh_stock_meta

router = APIRouter(prefix="/api/stock", tags=["stock"])


@router.get("/list", response_model=list[StockItem])
def stock_list(db: Session = Depends(get_db)):
    rows = db.execute(select(StockMeta)).scalars().all()
    should_refresh = True
    if rows:
        newest = max((r.updated_at for r in rows if r.updated_at), default=datetime.utcnow() - timedelta(days=999))
        should_refresh = (datetime.utcnow() - newest).total_seconds() >= 24 * 3600
    if should_refresh:
        refresh_stock_meta(db)
        rows = db.execute(select(StockMeta)).scalars().all()
    return [StockItem(symbol=r.symbol, name=r.name, industry=r.industry or "") for r in rows]


@router.get("/info/{symbol}")
def stock_info(symbol: str):
    # 这里预留扩展：可接入更完整基本面接口
    return {"symbol": symbol.zfill(6), "message": "可在此扩展市盈率/市净率等基础信息"}
