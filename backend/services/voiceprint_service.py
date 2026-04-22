"""
声纹识别服务 - 支持多种声纹识别渠道
"""
import os
import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, Tuple

from backend.services.speaker_recognition import (
    get_default_recognizer,
    SpeakerRecognizerFactory,
    set_recognizer_provider,
    get_current_provider,
)

# 声纹数据存储目录
VOICEPRINT_DIR = Path("data/voiceprints")
VOICEPRINT_DIR.mkdir(parents=True, exist_ok=True)

# 全局面试官声纹会话ID
GLOBAL_INTERVIEWER_SESSION = "global_interviewers"


class VoiceprintService:
    """声纹识别服务 - 支持多种后端"""

    def __init__(self):
        self.voiceprints_file = VOICEPRINT_DIR / "voiceprints.json"
        self._voiceprints = self._load_voiceprints()
        self._recognizer = get_default_recognizer()
        # 识别缓存：{audio_fingerprint: (role, voice_id, confidence)}
        self._identification_cache: Dict[str, Tuple[str, Optional[str], float]] = {}
        # 缓存大小限制
        self._cache_max_size = 1000

    def _get_audio_fingerprint(self, audio_data: bytes) -> str:
        """生成音频指纹用于缓存"""
        # 使用音频数据的哈希作为指纹
        return hashlib.md5(audio_data[:32000]).hexdigest()  # 使用前1秒数据

    def _add_to_cache(self, audio_data: bytes, role: str, voice_id: Optional[str], confidence: float):
        """添加识别结果到缓存"""
        fingerprint = self._get_audio_fingerprint(audio_data)
        # 限制缓存大小
        if len(self._identification_cache) >= self._cache_max_size:
            # 移除最旧的条目（简化实现：直接清空一半缓存）
            keys = list(self._identification_cache.keys())[:self._cache_max_size//2]
            for key in keys:
                del self._identification_cache[key]
        self._identification_cache[fingerprint] = (role, voice_id, confidence)

    def _get_from_cache(self, audio_data: bytes) -> Optional[Tuple[str, Optional[str], float]]:
        """从缓存获取识别结果"""
        fingerprint = self._get_audio_fingerprint(audio_data)
        return self._identification_cache.get(fingerprint)

    def _load_voiceprints(self) -> dict:
        """加载已注册的声纹数据"""
        if self.voiceprints_file.exists():
            with open(self.voiceprints_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _save_voiceprints(self):
        """保存声纹数据"""
        with open(self.voiceprints_file, 'w', encoding='utf-8') as f:
            json.dump(self._voiceprints, f, ensure_ascii=False, indent=2)

    def set_provider(self, provider: str) -> dict:
        """设置声纹识别渠道"""
        try:
            set_recognizer_provider(provider)
            self._recognizer = get_default_recognizer()
            return {
                "success": True,
                "provider": provider,
                "message": f"已切换到 {provider} 声纹识别"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_provider_info(self) -> dict:
        """获取当前声纹识别渠道信息"""
        return {
            "current_provider": get_current_provider(),
            "available_providers": SpeakerRecognizerFactory.get_available_providers()
        }

    def enroll_voiceprint(
        self,
        voice_id: str,
        name: str,
        audio_data: bytes,
        role: str = "interviewer",
        session_id: str = None,
    ) -> dict:
        """
        注册声纹（默认录入面试官到全局会话）
        """
        # 使用全局会话ID
        if session_id is None:
            session_id = GLOBAL_INTERVIEWER_SESSION

        try:
            # 保存音频文件
            audio_file = VOICEPRINT_DIR / f"{voice_id}.pcm"
            with open(audio_file, 'wb') as f:
                f.write(audio_data)

            # 使用当前的声纹识别器注册
            result = self._recognizer.register_speaker(
                voice_id=voice_id,
                role=role,
                name=name,
                audio_path=str(audio_file),
                session_id=session_id
            )

            if result["success"]:
                # 保存到本地数据库
                self._voiceprints[voice_id] = {
                    "voice_id": voice_id,
                    "role": role,
                    "name": name,
                    "session_id": session_id,
                    "audio_file": str(audio_file),
                    "provider": self._recognizer.provider,
                    "sample_duration": len(audio_data) / 32000,
                }
                self._save_voiceprints()

                return {
                    "success": True,
                    "voice_id": voice_id,
                    "provider": self._recognizer.provider,
                    "sample_duration": self._voiceprints[voice_id]["sample_duration"]
                }
            else:
                return result

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def identify_speaker(
        self,
        audio_data: bytes,
        threshold: float = 0.6,
        use_cache: bool = True
    ) -> dict:
        """
        识别说话人
        只对比全局面试官声纹，不匹配则自动识别为候选人
        """
        # 检查缓存
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
            # 保存临时音频文件
            temp_file = VOICEPRINT_DIR / f"temp_{hashlib.md5(audio_data).hexdigest()}.pcm"
            with open(temp_file, 'wb') as f:
                f.write(audio_data)

            # 只对比全局面试官声纹
            result = self._recognizer.identify_speaker(
                audio_path=str(temp_file),
                session_id=GLOBAL_INTERVIEWER_SESSION,
                threshold=threshold
            )

            # 清理临时文件
            if temp_file.exists():
                temp_file.unlink()

            # 如果匹配到面试官
            if result.get("matched") and result.get("role") == "interviewer":
                # 添加到缓存
                if use_cache:
                    self._add_to_cache(
                        audio_data,
                        "interviewer",
                        result.get("voice_id"),
                        result.get("confidence", 0)
                    )
                return {
                    "matched": True,
                    "voice_id": result.get("voice_id"),
                    "role": "interviewer",
                    "name": result.get("name"),
                    "confidence": result.get("confidence"),
                    "provider": result.get("provider"),
                }
            else:
                # 未匹配到面试官，自动识别为候选人
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
            return {
                "matched": False,
                "role": "unknown",
                "error": str(e)
            }

    def get_global_voiceprints(self) -> list:
        """获取所有全局面试官声纹"""
        return [
            {"voice_id": k, "role": v["role"], "name": v["name"], "provider": v.get("provider", "unknown")}
            for k, v in self._voiceprints.items()
            if v.get("session_id") == GLOBAL_INTERVIEWER_SESSION
        ]

    def clear_cache(self):
        """清除识别缓存"""
        self._identification_cache.clear()

    def get_session_voiceprints(self, session_id: str = None) -> list:
        """获取指定会话的声纹（默认返回全局面试官声纹）"""
        target_session = session_id or GLOBAL_INTERVIEWER_SESSION
        return [
            {"voice_id": k, "role": v["role"], "name": v["name"], "provider": v.get("provider", "unknown")}
            for k, v in self._voiceprints.items()
            if v.get("session_id") == target_session
        ]

    def delete_voiceprint(self, voice_id: str) -> bool:
        """删除声纹"""
        if voice_id in self._voiceprints:
            vp = self._voiceprints.pop(voice_id)
            # 删除音频文件
            if os.path.exists(vp.get("audio_file", "")):
                os.remove(vp["audio_file"])
            self._save_voiceprints()
            return True
        return False

    def clear_session_voiceprints(self, session_id: str = None) -> int:
        """清除指定会话的所有声纹（默认清除全局面试官声纹）"""
        target_session = session_id or GLOBAL_INTERVIEWER_SESSION
        to_delete = [
            k for k, v in self._voiceprints.items()
            if v.get("session_id") == target_session
        ]
        for voice_id in to_delete:
            self.delete_voiceprint(voice_id)
        return len(to_delete)


# 全局声纹服务实例
voiceprint_service = VoiceprintService()
