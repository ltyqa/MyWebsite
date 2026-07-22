from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    knowledge_api_keys: str
    knowledge_webhook_secret: str
    github_owner: str = "ltyqa"
    github_token: str = ""
    qdrant_url: str = "http://qdrant:6333"
    knowledge_db: Path = Path("/data/knowledge.sqlite3")
    embedding_model: str = "BAAI/bge-small-zh-v1.5"
    public_site_url: str = "https://ltyqaon.com"
    rate_limit_per_minute: int = 30
    openclaw_base_url: str = ""
    openclaw_token: str = ""
    openclaw_extraction_model: str = "openclaw/default"

    @property
    def api_keys(self) -> set[str]:
        return {value.strip() for value in self.knowledge_api_keys.split(",") if value.strip()}


settings = Settings()
