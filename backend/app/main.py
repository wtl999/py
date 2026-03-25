import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import historical, market, realtime, stocks, sync, screen
from app.services import ak_client

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Quant Data API", version="0.1.0")
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(historical.router)
app.include_router(realtime.router)
app.include_router(sync.router)
app.include_router(market.router)
app.include_router(screen.router)


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws/realtime")
async def ws_realtime(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            await asyncio.sleep(settings.realtime_push_seconds)
            df = ak_client.fetch_spot_all()
            payload = df.head(100).to_dict(orient="records") if not df.empty else []
            await ws.send_text(json.dumps({"type": "tick", "rows": payload}, ensure_ascii=False))
    except WebSocketDisconnect:
        return
