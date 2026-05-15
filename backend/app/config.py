"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings object — all values sourced from .env or environment."""

    anthropic_api_key: str
    tavily_api_key: str
    database_url: str = "sqlite+aiosqlite:///./data/app.db"
    claude_model: str = "claude-sonnet-4-6"
    max_tokens: int = 4096
    backend_cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
