SpeechBrain ECAPA-TDNN 在项目中**适配成本很低**，只需要**封装一层简单的服务**即可。以下是完整的适配方案：

## 一、快速适配架构（3层封装）

```
┌─────────────────┐
│   您的业务代码   │
└────────┬────────┘
         │ 调用简单接口
┌────────▼────────┐
│  声纹服务封装层  │ ← 重点实现
│ - 向量提取      │
│ - 相似度比较    │
│ - 角色聚类      │
└────────┬────────┘
         │
┌────────▼────────┐
│ SpeechBrain模型 │
└─────────────────┘
```

## 二、核心封装代码（可直接复制使用）

### 1. **基础封装类**（最常用）

```python
# speaker_recognizer.py
import torch
import numpy as np
from speechbrain.inference.speaker import EncoderClassifier
from typing import List, Tuple, Optional
import pickle
from pathlib import Path

class SpeakerRecognizer:
    """声纹识别封装类 - 适配面试场景"""
    
    def __init__(self, device='cpu', model_cache_dir='./model_cache'):
        """
        初始化声纹模型
        :param device: 'cpu' 或 'cuda'
        :param model_cache_dir: 模型缓存目录（避免重复下载）
        """
        self.device = device
        self.model = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir=model_cache_dir,
            run_opts={"device": device}
        )
        self.speaker_db = {}  # 存储已注册说话人 {id: embedding}
        
    def extract_embedding(self, audio_path: str) -> np.ndarray:
        """
        提取声纹向量
        :param audio_path: 音频文件路径
        :return: 192维向量
        """
        signal = self.model.load_audio(audio_path)
        with torch.no_grad():
            embedding = self.model.encode_batch(signal)
        return embedding.squeeze().cpu().numpy()
    
    def register_speaker(self, speaker_id: str, audio_path: str):
        """注册说话人（如：面试官）"""
        embedding = self.extract_embedding(audio_path)
        self.speaker_db[speaker_id] = embedding
        print(f"✅ 已注册: {speaker_id}")
    
    def verify_speaker(self, audio_path: str, threshold=0.6) -> Tuple[str, float]:
        """
        验证说话人身份
        :return: (匹配的speaker_id, 相似度)
        """
        if not self.speaker_db:
            raise ValueError("请先注册至少一个说话人")
        
        query_emb = self.extract_embedding(audio_path)
        best_match = None
        best_score = -1
        
        for sid, ref_emb in self.speaker_db.items():
            score = self._cosine_similarity(query_emb, ref_emb)
            if score > best_score:
                best_score = score
                best_match = sid
        
        if best_score > threshold:
            return best_match, best_score
        return "unknown", best_score
    
    def compare_two_speakers(self, audio1: str, audio2: str) -> float:
        """比较两段音频是否是同一个人"""
        emb1 = self.extract_embedding(audio1)
        emb2 = self.extract_embedding(audio2)
        return self._cosine_similarity(emb1, emb2)
    
    @staticmethod
    def _cosine_similarity(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    def save_db(self, path='speaker_db.pkl'):
        """保存注册数据库"""
        with open(path, 'wb') as f:
            pickle.dump(self.speaker_db, f)
    
    def load_db(self, path='speaker_db.pkl'):
        """加载注册数据库"""
        with open(path, 'rb') as f:
            self.speaker_db = pickle.load(f)
```

### 2. **面试场景专用封装**（自动区分角色）

```python
# interview_analyzer.py
from pyannote.audio import Pipeline
from pyannote.audio import Audio
from sklearn.cluster import AgglomerativeClustering
import numpy as np
from speaker_recognizer import SpeakerRecognizer

class InterviewAnalyzer:
    """面试音频分析器 - 自动区分面试官/面试者"""
    
    def __init__(self):
        self.speaker_rec = SpeakerRecognizer()
        # 可选：使用GPU加速分离（如果没有GPU会自动用CPU）
        self.diarization = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=None  # 公开模型不需要token
        )
        
    def analyze_interview(self, audio_path: str, interviewer_ref: str = None):
        """
        分析面试音频
        :param audio_path: 面试录音文件
        :param interviewer_ref: 面试官参考音频（可选，不提供则自动聚类）
        :return: 分析结果字典
        """
        # 1. 说话人分离
        print("🔍 正在分离说话人...")
        diarization = self.diarization(audio_path)
        
        # 2. 提取每个片段的声纹向量
        print("🎤 提取声纹特征...")
        segments = []
        audio_loader = Audio()
        
        for segment, _, speaker in diarization.itertracks(yield_label=True):
            waveform, _ = audio_loader.crop(audio_path, segment)
            emb = self.speaker_rec.model.encode_batch(waveform)
            segments.append({
                'start': segment.start,
                'end': segment.end,
                'speaker_id': speaker,
                'embedding': emb.squeeze().cpu().numpy(),
                'duration': segment.end - segment.start
            })
        
        # 3. 角色识别
        print("👥 识别角色...")
        if interviewer_ref:
            # 有参考音频：直接匹配
            interviewer_emb = self.speaker_rec.extract_embedding(interviewer_ref)
            for seg in segments:
                sim = self.speaker_rec._cosine_similarity(seg['embedding'], interviewer_emb)
                seg['role'] = '面试官' if sim > 0.6 else '面试者'
        else:
            # 无参考音频：基于说话时长聚类（面试官通常说话更多）
            segments = self._auto_role_assignment(segments)
        
        # 4. 统计分析
        result = self._generate_report(segments, audio_path)
        return result
    
    def _auto_role_assignment(self, segments):
        """基于说话时长自动分配角色（假设面试官说话更多）"""
        # 统计每个说话人的总时长
        speaker_duration = {}
        for seg in segments:
            speaker_duration[seg['speaker_id']] = speaker_duration.get(seg['speaker_id'], 0) + seg['duration']
        
        # 说话时长最多的标记为面试官
        main_speaker = max(speaker_duration, key=speaker_duration.get)
        for seg in segments:
            seg['role'] = '面试官' if seg['speaker_id'] == main_speaker else '面试者'
        return segments
    
    def _generate_report(self, segments, audio_path):
        """生成分析报告"""
        # 统计各角色时长
        interviewer_time = sum(s['duration'] for s in segments if s['role'] == '面试官')
        candidate_time = sum(s['duration'] for s in segments if s['role'] == '面试者')
        
        # 统计话轮数
        turns = []
        last_role = None
        for seg in segments:
            if seg['role'] != last_role:
                turns.append(seg['role'])
                last_role = seg['role']
        
        return {
            'total_duration': sum(s['duration'] for s in segments),
            'interviewer_duration': interviewer_time,
            'candidate_duration': candidate_time,
            'interviewer_ratio': interviewer_time / (interviewer_time + candidate_time),
            'total_turns': len(turns),
            'speaker_segments': segments,
            'turn_sequence': turns
        }

# 使用示例
if __name__ == "__main__":
    analyzer = InterviewAnalyzer()
    
    # 方式1：提供面试官参考音频（最准确）
    result = analyzer.analyze_interview(
        audio_path="interview.mp3",
        interviewer_ref="interviewer_ref.wav"  # 提前录制的面试官声音
    )
    
    # 方式2：自动识别（无需参考）
    # result = analyzer.analyze_interview("interview.mp3")
    
    print(f"面试官说话: {result['interviewer_duration']:.1f}秒")
    print(f"面试者说话: {result['candidate_duration']:.1f}秒")
    print(f"对话轮次: {result['total_turns']}")
```

### 3. **HTTP服务封装**（供其他语言调用）

```python
# api_server.py
from flask import Flask, request, jsonify
from speaker_recognizer import SpeakerRecognizer
import tempfile
import os

app = Flask(__name__)
recognizer = SpeakerRecognizer()

@app.route('/extract', methods=['POST'])
def extract_embedding():
    """提取声纹向量API"""
    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        audio_file.save(tmp.name)
        embedding = recognizer.extract_embedding(tmp.name)
        os.unlink(tmp.name)
    
    return jsonify({
        'embedding': embedding.tolist(),
        'dimension': len(embedding)
    })

@app.route('/verify', methods=['POST'])
def verify():
    """验证身份API"""
    ref_file = request.files['reference']
    test_file = request.files['test']
    
    with tempfile.NamedTemporaryFile(suffix='.wav') as ref_tmp:
        ref_file.save(ref_tmp.name)
        with tempfile.NamedTemporaryFile(suffix='.wav') as test_tmp:
            test_file.save(test_tmp.name)
            similarity = recognizer.compare_two_speakers(ref_tmp.name, test_tmp.name)
    
    return jsonify({
        'similarity': similarity,
        'is_same_person': similarity > 0.6
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## 三、项目适配检查清单

### ✅ 必做项（5分钟）

1. **安装依赖**
```bash
pip install speechbrain torchaudio pyannote.audio numpy scikit-learn
```

2. **首次运行（自动下载模型）**
```python
# 首次运行会下载约20MB模型文件
from speaker_recognizer import SpeakerRecognizer
model = SpeakerRecognizer()  # 自动下载到 ./model_cache
```

3. **准备面试官参考音频**
```python
# 录制5-10秒面试官清晰语音
recognizer.register_speaker("interviewer", "interviewer_ref.wav")
recognizer.save_db("interview_speakers.pkl")
```

### ⚙️ 可选项（根据需求）

| 适配需求 | 解决方案 | 工作量 |
|---------|---------|--------|
| **批量处理** | 添加批处理接口 | 1小时 |
| **实时流处理** | 改用 `speechbrain.lobes.VAD` | 1天 |
| **提高准确率** | 微调模型（用面试数据） | 1周 |
| **降低延迟** | 模型量化（INT8） | 2小时 |
| **Web界面** | Gradio快速搭建 | 2小时 |

## 四、常见问题适配

### Q1: 音频格式不兼容？
```python
# 统一转换为16kHz单声道
import torchaudio
def convert_audio(input_path, output_path):
    waveform, sr = torchaudio.load(input_path)
    if sr != 16000:
        resampler = torchaudio.transforms.Resample(sr, 16000)
        waveform = resampler(waveform)
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    torchaudio.save(output_path, waveform, 16000)
```

### Q2: 处理时间太长？
```python
# 使用GPU加速（如果有）
recognizer = SpeakerRecognizer(device='cuda')  # 只需改这一个参数

# 或使用更小的模型（牺牲一点精度）
# model = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb", 
#                                        run_opts={"device":"cpu", "jit":True})  # JIT加速
```

### Q3: 多人面试（3人以上）？
```python
# 修改 InterviewAnalyzer 的聚类逻辑
from sklearn.cluster import DBSCAN

embeddings = [seg['embedding'] for seg in segments]
clustering = DBSCAN(eps=0.5, min_samples=2).fit(embeddings)
for i, seg in enumerate(segments):
    seg['cluster_id'] = clustering.labels_[i]
```

## 五、性能优化建议

| 优化点 | 代码修改 | 效果 |
|--------|---------|------|
| **模型缓存** | 已内置 | 避免重复下载 |
| **批处理** | `model.encode_batch(batch_audios)` | 提速3-5倍 |
| **提前过滤静音** | 用 `webrtcvad` 过滤 | 减少50%计算 |
| **多线程处理** | `concurrent.futures.ThreadPoolExecutor` | 提速2-4倍 |
