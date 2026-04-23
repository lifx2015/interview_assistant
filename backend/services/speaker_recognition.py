"""
声纹识别抽象层 - 支持多种声纹识别渠道
"""
import abc
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import numpy as np


class SpeakerRecognizer(abc.ABC):
    """声纹识别抽象基类"""

    def __init__(self, provider: str):
        self.provider = provider
        self.speaker_db: Dict[str, dict] = {}

    @abc.abstractmethod
    def extract_embedding(self, audio_path: str) -> np.ndarray:
        """提取声纹向量"""
        pass

    @abc.abstractmethod
    def compare_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """比较两个声纹向量的相似度"""
        pass

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
        return {"success": True, "voice_id": voice_id}

    def identify_speaker(self, audio_path: str, session_id: str, threshold: float = 0.6) -> dict:
        """识别说话人"""
        query_emb = self.extract_embedding(audio_path)

        # 获取当前会话的声纹
        session_voiceprints = {
            k: v for k, v in self.speaker_db.items()
            if v.get("session_id") == session_id
        }

        if not session_voiceprints:
            return {
                "matched": False,
                "voice_id": None,
                "role": None,
                "confidence": 0,
                "message": "No voiceprints registered for this session"
            }

        best_match = None
        best_score = 0

        for voice_id, vp in session_voiceprints.items():
            ref_emb = np.array(vp["embedding"])
            score = self.compare_similarity(query_emb, ref_emb)

            if score > best_score:
                best_score = score
                best_match = vp

        if best_match and best_score >= threshold:
            return {
                "matched": True,
                "voice_id": best_match["voice_id"],
                "role": best_match["role"],
                "name": best_match["name"],
                "confidence": best_score,
                "provider": self.provider,
            }
        else:
            return {
                "matched": False,
                "voice_id": None,
                "role": None,
                "confidence": best_score,
                "message": "No match found",
                "provider": self.provider,
            }

    def get_session_voiceprints(self, session_id: str) -> List[dict]:
        """获取指定会话的所有声纹"""
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
        """清除指定会话的所有声纹"""
        to_delete = [
            k for k, v in self.speaker_db.items()
            if v.get("session_id") == session_id
        ]
        for voice_id in to_delete:
            del self.speaker_db[voice_id]
        return len(to_delete)


class SimpleSpeakerRecognizer(SpeakerRecognizer):
    """简单声纹识别器（基于音频特征哈希）- 作为备用方案"""

    def __init__(self):
        super().__init__("simple")

    def extract_embedding(self, audio_path: str) -> np.ndarray:
        """提取简单的音频特征"""
        # 读取音频文件
        with open(audio_path, 'rb') as f:
            audio_data = f.read()

        # 简单的特征提取：分块计算能量和频谱特征
        chunk_size = 3200
        features = []

        for i in range(0, min(len(audio_data), chunk_size * 10), chunk_size):
            chunk = audio_data[i:i + chunk_size]
            if len(chunk) < chunk_size:
                chunk = chunk + b'\x00' * (chunk_size - len(chunk))

            # 计算能量特征
            energy = sum(abs(b - 128) for b in chunk) / len(chunk)
            # 计算简单的频谱特征（基于字节分布）
            byte_counts = [chunk.count(i) for i in range(256)]
            # 取前20个频率最高的字节值
            top_bytes = sorted(range(256), key=lambda x: byte_counts[x], reverse=True)[:20]

            features.extend([energy / 255.0] + [b / 255.0 for b in top_bytes])

        # 填充到固定长度
        target_length = 128
        if len(features) < target_length:
            features = features + [0.0] * (target_length - len(features))
        else:
            features = features[:target_length]

        return np.array(features, dtype=np.float32)

    def compare_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """使用余弦相似度比较"""
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))


class SpeechBrainRecognizer(SpeakerRecognizer):
    """SpeechBrain ECAPA-TDNN 声纹识别器"""

    def __init__(self, device: str = "cpu", model_cache_dir: str = "./model_cache"):
        super().__init__("speechbrain")
        self.device = device
        self.model_cache_dir = model_cache_dir
        self._model = None
        self._init_model()

    def _init_model(self):
        """初始化 SpeechBrain 模型"""
        try:
            import torch
            from speechbrain.inference.speaker import EncoderClassifier

            # 直接使用本地模型路径
            model_path = os.path.abspath(os.path.join(self.model_cache_dir, "speechbrain_model"))

            if not os.path.exists(model_path):
                print(f"⚠️ 本地模型路径不存在: {model_path}")
                print("将使用简单声纹识别作为备选")
                self._model = None
                return

            # 从本地路径加载模型
            self._model = EncoderClassifier.from_hparams(
                source=model_path,
                run_opts={"device": self.device}
            )
            print(f"✅ SpeechBrain ECAPA-TDNN 模型加载成功 (本地路径: {model_path})")
        except Exception as e:
            print(f"⚠️ SpeechBrain 模型加载失败: {e}")
            print("将使用简单声纹识别作为备选")
            self._model = None

    def _convert_audio(self, audio_path: str) -> str:
        """转换音频为模型支持的格式（16kHz单声道WAV）"""
        import torchaudio

        output_path = audio_path + "_converted.wav"

        try:
            waveform, sr = torchaudio.load(audio_path)

            # 转换为单声道
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)

            # 重采样到 16kHz
            if sr != 16000:
                resampler = torchaudio.transforms.Resample(sr, 16000)
                waveform = resampler(waveform)

            torchaudio.save(output_path, waveform, 16000)
            return output_path
        except Exception as e:
            print(f"音频转换失败: {e}")
            return audio_path

    def extract_embedding(self, audio_path: str) -> np.ndarray:
        """提取 ECAPA-TDNN 声纹向量（192维）"""
        if self._model is None:
            raise RuntimeError("SpeechBrain 模型未加载")

        import torch
        import torchaudio

        try:
            # 直接使用 torchaudio 加载音频
            waveform, sr = torchaudio.load(audio_path)

            # 转换为单声道
            if waveform.shape[0] > 1:
                waveform = torch.mean(waveform, dim=0, keepdim=True)

            # 重采样到 16kHz
            if sr != 16000:
                resampler = torchaudio.transforms.Resample(sr, 16000)
                waveform = resampler(waveform)

            # 提取嵌入向量
            with torch.no_grad():
                embedding = self._model.encode_batch(waveform)

            return embedding.squeeze().cpu().numpy()
        except Exception as e:
            print(f"提取声纹向量失败: {e}")
            raise

    def compare_similarity(self, embedding1: np.ndarray, embedding2: np.ndarray) -> float:
        """计算余弦相似度"""
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(embedding1, embedding2) / (norm1 * norm2))


class SpeakerRecognizerFactory:
    """声纹识别器工厂"""

    _instances: Dict[str, SpeakerRecognizer] = {}

    @classmethod
    def get_recognizer(cls, provider: str = "simple") -> SpeakerRecognizer:
        """获取指定类型的声纹识别器"""
        if provider not in cls._instances:
            if provider == "simple":
                cls._instances[provider] = SimpleSpeakerRecognizer()
            elif provider == "speechbrain":
                cls._instances[provider] = SpeechBrainRecognizer()
            else:
                raise ValueError(f"不支持的声纹识别渠道: {provider}")
        return cls._instances[provider]

    @classmethod
    def get_available_providers(cls) -> List[dict]:
        """获取所有可用的声纹识别渠道"""
        providers = [
            {"id": "simple", "name": "简单声纹识别", "description": "基于音频特征的快速识别，无需额外模型", "available": True},
        ]

        # 检查 SpeechBrain 是否可用
        try:
            import speechbrain
            providers.append({
                "id": "speechbrain",
                "name": "SpeechBrain ECAPA-TDNN",
                "description": "基于深度学习的192维声纹向量，识别更准确",
                "available": True
            })
        except ImportError:
            providers.append({
                "id": "speechbrain",
                "name": "SpeechBrain ECAPA-TDNN",
                "description": "基于深度学习的192维声纹向量，识别更准确",
                "available": False,
                "reason": "未安装 speechbrain 依赖"
            })

        return providers


# 全局默认声纹识别器
_default_recognizer: Optional[SpeakerRecognizer] = None
_current_provider: str = "simple"


def get_default_recognizer() -> SpeakerRecognizer:
    """获取默认声纹识别器"""
    global _default_recognizer, _current_provider
    if _default_recognizer is None:
        _default_recognizer = SpeakerRecognizerFactory.get_recognizer(_current_provider)
    return _default_recognizer


def set_recognizer_provider(provider: str):
    """设置声纹识别渠道"""
    global _default_recognizer, _current_provider
    _current_provider = provider
    _default_recognizer = SpeakerRecognizerFactory.get_recognizer(provider)
    print(f"✅ 已切换到声纹识别渠道: {provider}")


def get_current_provider() -> str:
    """获取当前使用的声纹识别渠道"""
    return _current_provider
