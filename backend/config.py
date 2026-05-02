import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    dashscope_api_key: str = ""
    llm_model: str = "qwen-plus"
    asr_model: str = "fun-asr-realtime"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"]
    database_path: str = "data/interviews.db"
    qwen3_asr_model_path: str = "E:/models/Qwen3-ASR-0.6B"

    model_config = {"env_file": os.path.join(os.path.dirname(__file__), "..", ".env")}


settings = Settings()
