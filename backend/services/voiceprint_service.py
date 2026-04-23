"""
声纹识别服务 - 支持多种声纹识别渠道
元数据存储在 SQLite，音频文件存储在 data/voiceprints/
"""
import os
import hashlib
import io
import wave
from pathlib import Path
from typing import Optional, Dict, Tuple

from backend.services.speaker_recognition import (
    get_default_recognizer,
    SpeakerRecognizerFactory,
    set_recognizer_provider,
    get_current_provider,
)
from backend.services import database

# 声纹音频文件存储目录
VOICEPRINT_DIR = Path("data/voiceprints")
VOICEPRINT_DIR.mkdir(parents=True, exist_ok=True)

# 全局面试官声纹会话ID
GLOBAL_INTERVIEWER_SESSION = "global_interviewers"


def pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000, sample_width: int = 2, channels: int = 1) -> bytes:
    """Wrap raw PCM bytes in a WAV header."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_data)
    return buf.getvalue()


class VoiceprintService:
    """声纹识别服务 - 元数据存 SQLite，音频文件存磁盘"""

    def __init__(self):
        self._recognizer = get_default_recognizer()
        self._identification_cache: Dict[str, Tuple[str, Optional[str], float]] = {}
        self._cache_max_size = 1000

    def _get_audio_fingerprint(self, audio_data: bytes) -> str:
        return hashlib.md5(audio_data[:32000]).hexdigest()

    def _add_to_cache(self, audio_data: bytes, role: str, voice_id: Optional[str], confidence: float):
        fingerprint = self._get_audio_fingerprint(audio_data)
        if len(self._identification_cache) >= self._cache_max_size:
            keys = list(self._identification_cache.keys())[:self._cache_max_size // 2]
            for key in keys:
                del self._identification_cache[key]
        self._identification_cache[fingerprint] = (role, voice_id, confidence)

    def _get_from_cache(self, audio_data: bytes) -> Optional[Tuple[str, Optional[str], float]]:
        fingerprint = self._get_audio_fingerprint(audio_data)
        return self._identification_cache.get(fingerprint)

    def set_provider(self, provider: str) -> dict:
        try:
            set_recognizer_provider(provider)
            self._recognizer = get_default_recognizer()
            return {"success": True, "provider": provider, "message": f"已切换到 {provider} 声纹识别"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_provider_info(self) -> dict:
        return {
            "current_provider": get_current_provider(),
            "available_providers": SpeakerRecognizerFactory.get_available_providers(),
        }

    async def enroll_voiceprint(
        self,
        voice_id: str,
        name: str,
        audio_data: bytes,
        role: str = "interviewer",
        session_id: str = None,
    ) -> dict:
        if session_id is None:
            session_id = GLOBAL_INTERVIEWER_SESSION

        try:
            wav_data = pcm_to_wav(audio_data)
            audio_file = VOICEPRINT_DIR / f"{voice_id}.wav"
            with open(audio_file, 'wb') as f:
                f.write(wav_data)

            result = self._recognizer.register_speaker(
                voice_id=voice_id,
                role=role,
                name=name,
                audio_path=str(audio_file),
                session_id=session_id,
            )

            if result["success"]:
                sample_duration = len(audio_data) / 32000
                await database.save_voiceprint(
                    voice_id=voice_id,
                    role=role,
                    name=name,
                    session_id=session_id,
                    audio_file=str(audio_file),
                    provider=self._recognizer.provider,
                    sample_duration=sample_duration,
                )
                return {
                    "success": True,
                    "voice_id": voice_id,
                    "provider": self._recognizer.provider,
                    "sample_duration": sample_duration,
                }
            else:
                return result

        except Exception as e:
            return {"success": False, "error": str(e)}

    def identify_speaker(
        self,
        audio_data: bytes,
        threshold: float = 0.6,
        use_cache: bool = True,
    ) -> dict:
        if use_cache:
            cached = self._get_from_cache(audio_data)
            if cached:
                role, voice_id, confidence = cached
                return {
                    "matched": role == "interviewer",
                    "voice_id": voice_id,
                    "role": role,
                    "confidence": confidence,
                    "provider": self._recognizer.provider,
                    "cached": True,
                }

        try:
            wav_data = pcm_to_wav(audio_data)
            temp_file = VOICEPRINT_DIR / f"temp_{hashlib.md5(audio_data).hexdigest()}.wav"
            with open(temp_file, 'wb') as f:
                f.write(wav_data)

            result = self._recognizer.identify_speaker(
                audio_path=str(temp_file),
                session_id=GLOBAL_INTERVIEWER_SESSION,
                threshold=threshold,
            )

            if temp_file.exists():
                temp_file.unlink()

            if result.get("matched") and result.get("role") == "interviewer":
                if use_cache:
                    self._add_to_cache(audio_data, "interviewer", result.get("voice_id"), result.get("confidence", 0))
                return {
                    "matched": True,
                    "voice_id": result.get("voice_id"),
                    "role": "interviewer",
                    "name": result.get("name"),
                    "confidence": result.get("confidence"),
                    "provider": result.get("provider"),
                }
            else:
                if use_cache:
                    self._add_to_cache(audio_data, "candidate", None, result.get("confidence", 0))
                return {
                    "matched": False,
                    "voice_id": None,
                    "role": "candidate",
                    "confidence": result.get("confidence", 0),
                    "message": "识别为候选人（面试者）",
                    "provider": self._recognizer.provider,
                }

        except Exception as e:
            return {"matched": False, "role": "unknown", "error": str(e)}

    async def get_global_voiceprints(self) -> list:
        rows = await database.list_voiceprints(session_id=GLOBAL_INTERVIEWER_SESSION)
        return [
            {"voice_id": r["voice_id"], "role": r["role"], "name": r["name"], "provider": r.get("provider", "unknown")}
            for r in rows
        ]

    def clear_cache(self):
        self._identification_cache.clear()

    async def get_session_voiceprints(self, session_id: str = None) -> list:
        target_session = session_id or GLOBAL_INTERVIEWER_SESSION
        rows = await database.list_voiceprints(session_id=target_session)
        return [
            {"voice_id": r["voice_id"], "role": r["role"], "name": r["name"], "provider": r.get("provider", "unknown")}
            for r in rows
        ]

    async def delete_voiceprint(self, voice_id: str) -> bool:
        # Get audio file path before deleting from DB
        rows = await database.list_voiceprints()
        audio_file = None
        for r in rows:
            if r["voice_id"] == voice_id:
                audio_file = r.get("audio_file")
                break

        success = await database.delete_voiceprint_db(voice_id)
        if success and audio_file and os.path.exists(audio_file):
            os.remove(audio_file)
        return success

    async def clear_session_voiceprints(self, session_id: str = None) -> int:
        target_session = session_id or GLOBAL_INTERVIEWER_SESSION
        rows = await database.list_voiceprints(session_id=target_session)
        for r in rows:
            audio_file = r.get("audio_file")
            if audio_file and os.path.exists(audio_file):
                os.remove(audio_file)
        return await database.clear_voiceprints_db(target_session)


# 全局声纹服务实例
voiceprint_service = VoiceprintService()
