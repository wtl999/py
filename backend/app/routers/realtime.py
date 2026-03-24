from fastapi import APIRouter, Query

from app.services import ak_client

router = APIRouter(prefix="/api", tags=["realtime"])


@router.get("/realtime")
def realtime(symbols: str = Query(..., description="comma separated symbols")):
    symbol_set = {s.strip().zfill(6) for s in symbols.split(",") if s.strip()}
    df = ak_client.fetch_spot_all()
    if df.empty:
        return []
    if "代码" in df.columns:
        out_df = df[df["代码"].astype(str).isin(symbol_set)]
    else:
        out_df = df
    return out_df.to_dict(orient="records")
