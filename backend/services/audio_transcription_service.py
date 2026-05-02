import asyncio
import json
import logging
import os
import subprocess
import tempfile
import time
import uuid

import dashscope
from dashscope.audio.asr.transcribe import Transcribe
from dashscope import Generation

from backend.config import settings
from backend.prompts.audio_transcription import AUDIO_QA_PARSE_PROMPT
from backend.services.llm_service import _extract_json, interview_evaluation, psychology_analysis_stream

logger = logging.getLogger(__name__)

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac", ".wma"}
MAX_AUDIO_SIZE = 500 * 1024 * 1024  # 500MB

# Lazy-loaded Qwen3-ASR model singleton
_qwen3_asr_model = None
_qwen3_asr_loading = False


def _get_qwen3_asr_model():
    """Lazy-load Qwen3-ASR model. Returns None if not available."""
    global _qwen3_asr_model, _qwen3_asr_loading

    if _qwen3_asr_model is not None:
        return _qwen3_asr_model

    if _qwen3_asr_loading:
        return None

    model_path = settings.qwen3_asr_model_path
    if not model_path or not os.path.isdir(model_path):
        logger.info("[Qwen3-ASR] Model path not found: %s", model_path)
        return None

    try:
        import torch
        from qwen_asr import Qwen3ASRModel

        # Reduce CUDA memory fragmentation
        os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

        _qwen3_asr_loading = True
        logger.info("[Qwen3-ASR] Loading model from %s ...", model_path)

        _qwen3_asr_model = Qwen3ASRModel.from_pretrained(
            model_path,
            dtype=torch.float16,
            device_map="cuda:0",
            max_inference_batch_size=1,
            max_new_tokens=1024,
        )

        logger.info("[Qwen3-ASR] Model loaded successfully")
        _qwen3_asr_loading = False
        return _qwen3_asr_model
    except Exception as e:
        logger.warning("[Qwen3-ASR] Failed to load model: %s", e)
        _qwen3_asr_loading = False
        return None


def _split_wav_by_duration(wav_path: str, chunk_seconds: int = 120) -> list[str]:
    """Split a WAV file into chunks of chunk_seconds using ffmpeg.

    Returns list of temp WAV file paths. Caller is responsible for cleanup.
    """
    import soundfile as sf

    info = sf.info(wav_path)
    total_seconds = info.duration
    if total_seconds <= chunk_seconds:
        return [wav_path]

    tmp_dir = tempfile.mkdtemp(prefix="asr_chunk_")
    chunk_paths = []
    for start in range(0, int(total_seconds), chunk_seconds):
        chunk_path = os.path.join(tmp_dir, f"chunk_{start}.wav")
        cmd = [
            "ffmpeg", "-y", "-i", wav_path,
            "-ss", str(start), "-t", str(chunk_seconds),
            "-ar", "16000", "-ac", "1", "-f", "wav", chunk_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode == 0 and os.path.isfile(chunk_path):
            chunk_paths.append(chunk_path)
        else:
            logger.warning("[Qwen3-ASR] Failed to split chunk at %ds: %s", start, r.stderr[:200])

    return chunk_paths if chunk_paths else [wav_path]


def transcribe_file_local(wav_path: str) -> dict:
    """Transcribe a WAV file using local Qwen3-ASR model.

    Splits long audio into 2-minute chunks to fit 8GB VRAM.
    Returns dict with 'text' (full transcript) and 'sentences' list.
    Raises RuntimeError if model is unavailable or transcription fails.
    """
    model = _get_qwen3_asr_model()
    if model is None:
        raise RuntimeError("Qwen3-ASR 模型不可用")

    chunk_paths = _split_wav_by_duration(wav_path, chunk_seconds=120)

    all_text_parts = []
    all_sentences = []

    for i, chunk_path in enumerate(chunk_paths):
        logger.info("[Qwen3-ASR] Transcribing chunk %d/%d: %s", i + 1, len(chunk_paths), chunk_path)
        results = model.transcribe(audio=chunk_path, language=None)
        if not results:
            logger.warning("[Qwen3-ASR] Chunk %d returned empty result", i + 1)
            continue

        text = results[0].text
        if text:
            all_text_parts.append(text)
            all_sentences.append({"text": text})

        # Free GPU memory between chunks
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception:
            pass

    if not all_text_parts:
        raise RuntimeError("Qwen3-ASR 转录结果为空")

    full_text = "".join(all_text_parts)
    logger.info("[Qwen3-ASR] Transcribed %d chunks, total text_len=%d", len(chunk_paths), len(full_text))

    return {"text": full_text, "sentences": all_sentences, "engine": "qwen3-asr-local"}


def transcribe_file_dashscope(wav_path: str) -> dict:
    """Transcribe a WAV file using DashScope Transcribe API (fallback).

    Returns dict with 'text' (full transcript) and 'sentences' list.
    """
    resp = Transcribe.call(
        model="paraformer-16k-1",
        file=wav_path,
    )

    if resp.status_code != 200:
        raise RuntimeError(f"Transcribe API error: {resp.status_code} - {resp.message}")

    output = resp.output
    if not output:
        raise RuntimeError("Transcribe API returned empty output")

    results = output.get("results", []) if isinstance(output, dict) else []
    if not results and hasattr(output, "results"):
        results = output.results

    sentences = []
    full_text_parts = []

    for item in results:
        if isinstance(item, dict):
            text = item.get("text", "")
            sentences.append(item)
        elif hasattr(item, "text"):
            text = item.text
            sentences.append({"text": text})
        else:
            continue
        if text:
            full_text_parts.append(text)

    full_text = "".join(full_text_parts)
    if not full_text:
        raw = resp.output if isinstance(resp.output, str) else str(resp.output)
        if raw and raw.strip():
            full_text = raw.strip()
            sentences = [{"text": full_text}]

    return {"text": full_text, "sentences": sentences, "engine": "dashscope"}


def convert_to_wav(input_path: str, output_path: str) -> str:
    """Convert any audio file to 16kHz mono WAV using ffmpeg."""
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ar", "16000", "-ac", "1", "-f", "wav",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg conversion failed: {result.stderr[:500]}")
    return output_path


async def transcribe_file(wav_path: str) -> dict:
    """Transcribe audio file: try local Qwen3-ASR first, fallback to DashScope API."""
    loop = asyncio.get_running_loop()

    # Try local Qwen3-ASR first
    try:
        logger.info("[Transcribe] Trying local Qwen3-ASR ...")
        result = await loop.run_in_executor(None, transcribe_file_local, wav_path)
        logger.info("[Transcribe] Local Qwen3-ASR succeeded")
        return result
    except Exception as e:
        logger.warning("[Transcribe] Local Qwen3-ASR failed: %s, falling back to DashScope", e)

    # Fallback to DashScope API
    try:
        logger.info("[Transcribe] Using DashScope API fallback ...")
        result = await loop.run_in_executor(None, transcribe_file_dashscope, wav_path)
        logger.info("[Transcribe] DashScope API succeeded")
        return result
    except Exception as e:
        logger.error("[Transcribe] DashScope API also failed: %s", e)
        raise RuntimeError(f"语音转录失败: 本地模型和云端 API 均不可用 ({e})")


async def parse_transcript_to_qa(
    transcript_text: str,
    resume_context: str | None = None,
) -> dict:
    """Use LLM to parse transcript text into role-labeled QA pairs."""
    prompt = AUDIO_QA_PARSE_PROMPT.format(
        transcript_text=transcript_text,
        resume_context=resume_context or "无简历信息",
    )

    loop = asyncio.get_running_loop()
    resp = await loop.run_in_executor(
        None,
        lambda: Generation.call(
            model=settings.llm_model,
            messages=[{"role": "user", "content": prompt}],
            result_format="message",
        ),
    )

    if resp is None or resp.output is None or not resp.output.choices:
        raise ValueError("LLM 解析转录文本失败")

    content = resp.output.choices[0].message.content
    if not content:
        raise ValueError("LLM 返回空内容")

    data = _extract_json(content)

    if "transcript" not in data:
        data["transcript"] = []
    if "qa_history" not in data:
        data["qa_history"] = []
    if "candidate_summary" not in data:
        data["candidate_summary"] = {"name": "", "summary": ""}

    return data


async def process_audio_upload(
    file_content: bytes,
    filename: str,
    session_id: str | None = None,
    resume_context: str | None = None,
    job_requirement: dict | None = None,
    sessions: dict | None = None,
):
    """Full audio upload pipeline. Yields SSE event dicts.

    Stages: converting → transcribing → parsing → evaluating → psychology → complete
    """
    suffix = os.path.splitext(filename)[1].lower()
    tmp_dir = tempfile.mkdtemp(prefix="audio_upload_")

    try:
        # Stage 1: Convert to WAV
        yield {"stage": "converting", "message": "音频格式转换中..."}

        input_path = os.path.join(tmp_dir, f"input{suffix}")
        wav_path = os.path.join(tmp_dir, "output.wav")

        with open(input_path, "wb") as f:
            f.write(file_content)

        if suffix == ".wav":
            wav_path = input_path
        else:
            await asyncio.get_running_loop().run_in_executor(
                None, convert_to_wav, input_path, wav_path
            )

        # Stage 2: Transcribe (local Qwen3-ASR first, then DashScope fallback)
        yield {"stage": "transcribing", "message": "语音转录中（本地模型）..."}
        transcription = await transcribe_file(wav_path)

        transcript_text = transcription.get("text", "")
        if not transcript_text.strip():
            yield {"stage": "error", "message": "音频转录结果为空，请检查音频文件是否包含有效语音"}
            return

        engine = transcription.get("engine", "unknown")
        logger.info("[AudioUpload] Transcription engine: %s, text length: %d", engine, len(transcript_text))

        # Stage 3: Parse into QA pairs
        yield {"stage": "parsing", "message": "对话解析中..."}
        parsed = await parse_transcript_to_qa(transcript_text, resume_context)

        # Build session
        if session_id and sessions and session_id in sessions:
            pass
        else:
            session_id = str(uuid.uuid4())
            if sessions is not None:
                candidate_summary = parsed.get("candidate_summary", {})
                sessions[session_id] = {
                    "resume_text": resume_context or "",
                    "candidate": {
                        "name": candidate_summary.get("name", ""),
                        "summary": candidate_summary.get("summary", ""),
                        "source": "audio_upload",
                    },
                    "qa_history": [],
                    "_last_access": time.time(),
                }

        # Update session with parsed data
        if sessions is not None and session_id in sessions:
            session = sessions[session_id]
            session["qa_history"] = parsed.get("qa_history", [])
            session["_last_access"] = time.time()

        # Stage 4: Generate evaluation
        qa_history = parsed.get("qa_history", [])
        evaluation_result = None
        evaluation_error = None

        logger.info("[AudioUpload] QA history count: %d", len(qa_history))

        if qa_history:
            yield {"stage": "evaluating", "message": "面试评估生成中..."}
            try:
                logger.info("[AudioUpload] Starting interview evaluation, resume_context length=%d, job_requirement=%s",
                            len(resume_context or ""), job_requirement)
                evaluation_result = await interview_evaluation(
                    resume_context=resume_context or "",
                    qa_history=qa_history,
                    job_requirement=job_requirement,
                )
                logger.info("[AudioUpload] Evaluation succeeded, result keys: %s", list(evaluation_result.keys()) if evaluation_result else "None")
            except Exception as e:
                evaluation_error = str(e)
                logger.error("[AudioUpload] Evaluation failed: %s", e, exc_info=True)
        else:
            logger.warning("[AudioUpload] No QA history found, skipping evaluation")

        # Stage 5: Psychology analysis
        psychology_raw = ""
        if qa_history:
            yield {"stage": "psychology", "message": "心理状态分析中..."}
            # Build context from QA history for psychology analysis
            candidate_answers = [qa.get("answer", "") for qa in qa_history if qa.get("answer")]
            accumulated_answer = " ".join(candidate_answers)
            recent_sentences = candidate_answers[-1] if candidate_answers else ""
            last_question = qa_history[-1].get("question", "") if qa_history else ""

            psych_chunks = []
            async for chunk in psychology_analysis_stream(
                resume_context=resume_context or "",
                current_question=last_question,
                recent_sentences=recent_sentences,
                accumulated_answer=accumulated_answer,
            ):
                psych_chunks.append(chunk)
            psychology_raw = "".join(psych_chunks)

        # Stage 6: Complete
        candidate_summary = parsed.get("candidate_summary", {})
        candidate_data = {
            "name": candidate_summary.get("name", ""),
            "summary": candidate_summary.get("summary", ""),
        }

        if sessions and session_id in sessions:
            existing_candidate = sessions[session_id].get("candidate", {})
            if existing_candidate.get("name"):
                candidate_data = existing_candidate

        yield {
            "stage": "complete",
            "session_id": session_id,
            "candidate": candidate_data,
            "transcript": parsed.get("transcript", []),
            "qa_history": qa_history,
            "evaluation_result": evaluation_result,
            "evaluation_error": evaluation_error,
            "psychology_raw": psychology_raw,
        }

    except Exception as e:
        logger.error("[AudioUpload] Pipeline failed: %s", e, exc_info=True)
        yield {"stage": "error", "message": f"处理失败: {str(e)}"}
    finally:
        import shutil
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass
