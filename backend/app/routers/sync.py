from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import StockMeta, SyncTaskRecord
from app.schemas import SyncRequest, SyncStatus
from app.services import ak_client
from app.services.sync_service import create_task, run_sync_job

router = APIRouter(prefix="/api/sync", tags=["sync"])


def _bg_sync(task_id: str, symbols: list[str], start: str, end: str, period: str) -> None:
    db = SessionLocal()
    try:
        run_sync_job(db, task_id, symbols, start, end, period)
    finally:
        db.close()


def _resolve_symbols(db: Session, body: SyncRequest) -> list[str]:
    if body.symbols:
        return [s.zfill(6) for s in body.symbols]
    if body.all_listed:
        rows = db.execute(select(StockMeta.symbol)).all()
        return [r[0] for r in rows]
    rows = db.execute(select(StockMeta.symbol).limit(100)).all()
    return [r[0] for r in rows]


def _resolve_dates(body: SyncRequest) -> tuple[str, str]:
    if body.start and body.end:
        return body.start.replace("-", ""), body.end.replace("-", "")
    days = body.incremental_days if body.incremental_days else settings.sync_default_days
    return ak_client.default_date_range(days)


@router.post("/historical")
def start_sync(body: SyncRequest, bg: BackgroundTasks, db: Session = Depends(get_db)):
    task_id = create_task(db)
    symbols = _resolve_symbols(db, body)
    start, end = _resolve_dates(body)
    bg.add_task(_bg_sync, task_id, symbols, start, end, body.period)
    return {"task_id": task_id}


@router.get("/status/{task_id}", response_model=SyncStatus)
def sync_status(task_id: str, db: Session = Depends(get_db)):
    rec = db.get(SyncTaskRecord, task_id)
    if not rec:
        return SyncStatus(task_id=task_id, status="unknown", total=0, done=0, failed=0, current_symbol="", message="")
    return SyncStatus(
        task_id=rec.task_id,
        status=rec.status,
        total=rec.total,
        done=rec.done,
        failed=rec.failed,
        current_symbol=rec.current_symbol or "",
        message=rec.message or "",
    )
