from fastapi import APIRouter

from app.services import ak_client

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/index")
def market_index():
    df = ak_client.fetch_index_spot()
    if df.empty:
        return []
    rows = []
    for _, r in df.head(20).iterrows():
        rows.append(
            {
                "code": str(r.get("代码", r.get("symbol", ""))),
                "name": str(r.get("名称", r.get("name", ""))),
                "price": float(r.get("最新价", r.get("price", 0)) or 0),
                "change_pct": float(r.get("涨跌幅", r.get("pct", 0)) or 0),
            }
        )
    return rows
