from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="QUANT_", extra="ignore")

    database_url: str = "sqlite:///./data/quant.db"
    cors_origins: str = "http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173"
    sync_default_days: int = 365
    realtime_push_seconds: float = 2.0


settings = Settings()
