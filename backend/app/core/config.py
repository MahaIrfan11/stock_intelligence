from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Stock Intelligence API"
    environment: str = "development"
    api_prefix: str = "/api"

    database_url: str = "postgresql+psycopg2://stock:stock@localhost:5432/stock_intelligence"
    cors_origins: str = "http://localhost:5173"

    default_page_size: int = 20
    max_page_size: int = 100

    # Opportunity rule parameters (see docs in README)
    opp_lookback_days: int = 180
    opp_min_sample: int = 3
    opp_discount_threshold: float = 0.15

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
