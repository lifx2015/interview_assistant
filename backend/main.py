import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routers import resume, interview, ws_asr, voiceprint, question_bank, job_requirement
from backend.services import database
from backend.services.voiceprint_service import voiceprint_service

# 配置日志输出到控制台
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%H:%M:%S",
    force=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时预加载声纹模型和数据
    logger = logging.getLogger("startup")
    logger.info("[Startup] Initializing database...")
    await database.init_db()

    logger.info("[Startup] Loading voiceprints from database...")
    await voiceprint_service.load_voiceprints_from_db()
    logger.info("[Startup] Voiceprints loaded: %d", len(voiceprint_service._recognizer.speaker_db))

    yield

    await database.close_db()


app = FastAPI(title="AI Interview Assistant", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router, prefix="/api")
app.include_router(interview.router, prefix="/api")
app.include_router(voiceprint.router, prefix="/api")
app.include_router(question_bank.router, prefix="/api")
app.include_router(job_requirement.router, prefix="/api")
app.include_router(ws_asr.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
