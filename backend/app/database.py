from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def _ensure_sqlite_path() -> None:
    if settings.database_url.startswith("sqlite:///"):
        sqlite_file = Path(settings.database_url.replace("sqlite:///", "", 1))
        sqlite_file.parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_path()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
