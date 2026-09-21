"""Application settings loaded from environment variables via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All environment variable access goes through this class — never os.environ.get() inline."""

    DATABASE_URL: str
    SECRET_KEY: str
    DB_USER: str
    DB_PASSWORD: str

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
