"""
声纹识别 - 使用 SpeechBrain ECAPA-TDNN 模型
"""
import logging
import os
import json
from pathlib import Path
from typing import Dict, List, Optional
import numpy as np

logger = logging.getLogger(__name__)

# 声纹存储目录
VOICEPRINT_DIR = Path("data/voiceprints")
VOICEPRINT_DIR.mkdir(parents=True, exist_ok=True)

# 模型缓存目录
MODEL_CACHE_DIR = Path("model_cache/ecapa")


class SpeakerRecognizer:
    """SpeechBrain ECAPA-TDNN 声纹识别器"""

    def __init__(self):
        self.provider = "ecapa"
        self.speaker_db: Dict[str, dict] = {}
        self._model = None
        self._device = None
        self._init_model()

    def _init_model(self):
        """初始化 ECAPA-TDNN 模型"""
        try:
            import torch
            # 设置环境变量，禁止符号链接
            os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

            from speechbrain.inference.speaker import EncoderClassifier

            # 检测设备
            if torch.cuda.is_available():
                self._device = "cuda"
                logger.info("[ECAPA] Using GPU: %s", torch.cuda.get_device_name(0))
            else:
                self._device = "cpu"
                logger.info("[ECAPA] Using CPU")

            # 加载模型（不指定 savedir，直接使用 HuggingFace 缓存）
            logger.info("[ECAPA] Loading spkrec-ecapa-voxceleb model...")
            self._model = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
            )

            # 手动移到设备上
            self._model.device = self._device
            if hasattr(self._model, 'mods'):
                for mod in self._model.mods.values():
                    if hasattr(mod, 'to'):
                        mod.to(self._device)

            logger.info("[ECAPA] Model loaded successfully on %s!", self._device)

        except Exception as e:
            logger.error("[ECAPA] Model init failed: %s", e)
            import traceback
            traceback.print_exc()
            self._model = None

    def _load_and_preprocess(self, audio_path: str):
        """加载并预处理音频"""
        import torch
        import torchaudio

        # 加载音频
        signal, sr = torchaudio.load(audio_path)

        # 转单声道
        if signal.shape[0] > 1:
            signal = torch.mean(signal, dim=0, keepdim=True)

        # 重采样到 16kHz
        if sr != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)
            signal = resampler(signal)

        return signal

    def extract_embedding(self, audio_path: str) -> np.ndarray:
        """提取 192 维声纹嵌入向量"""
        if self._model is None:
            raise RuntimeError("ECAPA 模型未加载")

        import torch

        try:
            signal = self._load_and_preprocess(audio_path)

            with torch.no_grad():
                embedding = self._model.encode_batch(signal)

            # squeeze 并转为 numpy
            embedding = embedding.squeeze().cpu().numpy()

            # 归一化
            embedding = embedding / np.linalg.norm(embedding)

            logger.info("[ECAPA] Extracted embedding: shape=%s, norm=%.4f",
                        embedding.shape, np.linalg.norm(embedding))

            return embedding

        except Exception as e:
            logger.error("[ECAPA] Extract failed: %s", e)
            raise

    def compare_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """计算余弦相似度"""
        # 已经归一化了，直接点积
        score = float(np.dot(emb1, emb2))
        # 不 clamp，允许负值表示方向相反
        logger.debug("[ECAPA] similarity raw: %.4f", score)
        return score

    def register_speaker(self, voice_id: str, role: str, name: str, audio_path: str, session_id: str):
        """注册说话人"""
        embedding = self.extract_embedding(audio_path)

        self.speaker_db[voice_id] = {
            "voice_id": voice_id,
            "role": role,
            "name": name,
            "session_id": session_id,
            "embedding": embedding.tolist(),
            "provider": self.provider,
        }

        logger.info("[ECAPA] Registered: voice_id=%s role=%s name=%s embedding_len=%d",
                    voice_id, role, name, len(embedding))

        return {"success": True, "voice_id": voice_id}

    def identify_speaker(self, audio_path: str, session_id: str, threshold: float = 0.56) -> dict:
        """识别说话人"""
        query_emb = self.extract_embedding(audio_path)

        # 获取当前会话的声纹
        session_voiceprints = {
            k: v for k, v in self.speaker_db.items()
            if v.get("session_id") == session_id
        }

        if not session_voiceprints:
            logger.info("[ECAPA] No voiceprints for session=%s", session_id)
            return {"matched": False, "voice_id": None, "role": None, "confidence": 0}

        logger.info("[ECAPA] Comparing %d voiceprints, threshold=%.2f",
                    len(session_voiceprints), threshold)

        best_match = None
        best_score = 0.0

        for voice_id, vp in session_voiceprints.items():
            ref_emb = np.array(vp["embedding"])
            logger.info("[ECAPA] DEBUG: ref_emb shape=%s, norm=%.4f, first5=%s",
                        ref_emb.shape, np.linalg.norm(ref_emb), ref_emb[:5])
            logger.info("[ECAPA] DEBUG: query_emb shape=%s, norm=%.4f, first5=%s",
                        query_emb.shape, np.linalg.norm(query_emb), query_emb[:5])
            score = self.compare_similarity(query_emb, ref_emb)

            logger.info("[ECAPA] Compare: voice_id=%s role=%s name=%s score=%.4f",
                        voice_id, vp["role"], vp["name"], score)

            if score > best_score:
                best_score = score
                best_match = vp

        logger.info("[ECAPA] Best: score=%.4f >= threshold=%.2f ? %s",
                    best_score, threshold, best_score >= threshold)

        if best_match and best_score >= threshold:
            logger.info("[ECAPA] MATCHED: role=%s confidence=%.4f", best_match["role"], best_score)
            return {
                "matched": True,
                "voice_id": best_match["voice_id"],
                "role": best_match["role"],
                "name": best_match["name"],
                "confidence": best_score,
                "provider": self.provider,
            }
        else:
            logger.info("[ECAPA] NOT MATCHED -> candidate, confidence=%.4f", best_score)
            return {
                "matched": False,
                "voice_id": None,
                "role": None,
                "confidence": best_score,
                "provider": self.provider,
            }

    def get_session_voiceprints(self, session_id: str) -> List[dict]:
        """获取指定会话的声纹"""
        return [
            {"voice_id": k, "role": v["role"], "name": v["name"]}
            for k, v in self.speaker_db.items()
            if v.get("session_id") == session_id
        ]

    def delete_voiceprint(self, voice_id: str) -> bool:
        """删除声纹"""
        if voice_id in self.speaker_db:
            del self.speaker_db[voice_id]
            return True
        return False

    def clear_session_voiceprints(self, session_id: str) -> int:
        """清除指定会话的声纹"""
        to_delete = [k for k, v in self.speaker_db.items() if v.get("session_id") == session_id]
        for voice_id in to_delete:
            del self.speaker_db[voice_id]
        return len(to_delete)


# 全局识别器
_recognizer: Optional[SpeakerRecognizer] = None


def get_default_recognizer() -> SpeakerRecognizer:
    """获取默认声纹识别器"""
    global _recognizer
    if _recognizer is None:
        _recognizer = SpeakerRecognizer()
    return _recognizer


def get_current_provider() -> str:
    return "ecapa"


def set_recognizer_provider(provider: str):
    pass


class SpeakerRecognizerFactory:
    @classmethod
    def get_recognizer(cls, provider: str = "ecapa") -> SpeakerRecognizer:
        return get_default_recognizer()

    @classmethod
    def get_available_providers(cls) -> List[dict]:
        return [
            {
                "id": "ecapa",
                "name": "ECAPA-TDNN",
                "description": "SpeechBrain 192维声纹模型，准确度高",
                "available": True
            }
        ]