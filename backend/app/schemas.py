from pydantic import BaseModel, Field


class StockItem(BaseModel):
    symbol: str
    name: str
    industry: str = ""


class KlineRow(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float = 0.0


class SyncRequest(BaseModel):
    symbols: list[str] | None = None
    all_listed: bool = False
    start: str | None = None
    end: str | None = None
    period: str = "daily"
    incremental_days: int | None = None


class SyncStatus(BaseModel):
    task_id: str
    status: str
    total: int
    done: int
    failed: int
    current_symbol: str
    message: str


class RealtimeRequest(BaseModel):
    symbols: str = Field(..., description="comma separated")


class ScreenRequest(BaseModel):
    text: str
    symbols: list[str] = []
    limit: int = 50
    use_db: bool = False