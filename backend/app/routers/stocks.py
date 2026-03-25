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
    """保证每次访问都有股票数据：优先从DB取，无数据或太旧则强制刷新"""
    rows = db.execute(select(StockMeta)).scalars().all()

    should_refresh = True
    if rows:
        newest = max((r.updated_at for r in rows if r.updated_at), default=datetime.utcnow() - timedelta(days=999))
        should_refresh = (datetime.utcnow() - newest).total_seconds() >= 24 * 3600

    if should_refresh or len(rows) < 20:  # 少于20条也强制刷新
        print(f"[Stock] 当前数据库有 {len(rows)} 条股票，触发刷新...")
        refresh_stock_meta(db)
        rows = db.execute(select(StockMeta)).scalars().all()
        print(f"[Stock] 刷新后共有 {len(rows)} 条股票")

    if not rows:
        print("[Stock] 数据库仍然为空，使用接口兜底")
        return [
            StockItem(symbol="000001", name="上证指数", industry="指数"),
            StockItem(symbol="600519", name="贵州茅台", industry="白酒"),
            StockItem(symbol="000725", name="京东方A", industry="电子"),
            StockItem(symbol="601318", name="中国平安", industry="保险"),
            StockItem(symbol="600036", name="招商银行", industry="银行"),
        ]

    return [StockItem(symbol=r.symbol, name=r.name, industry=r.industry or "") for r in rows]


@router.get("/info/{symbol}")
def stock_info(symbol: str):
    # 这里预留扩展：可接入更完整基本面接口
    return {"symbol": symbol.zfill(6), "message": "可在此扩展市盈率/市净率等基础信息"}
