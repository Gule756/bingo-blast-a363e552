import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost/habesha_bingo"
    
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_BOT_USERNAME: str
    
    # Mini App
    MINI_APP_URL: str = "https://your-domain.com"
    
    # Crypto
    NOWPAYMENTS_API_KEY: Optional[str] = None
    TON_API_KEY: Optional[str] = None
    
    # Security
    SECRET_KEY: str = "your-secret-key-here"
    
    # Game Settings
    GULE_TEST_ACCOUNT_ID: int = 123456789  # Gule's test Telegram ID
    
    # Development
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"

settings = Settings()
