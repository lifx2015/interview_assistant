"""
WebSocket ASR route with voiceprint-based role detection and real-time follow-up analysis.
Supports both single-track (voiceprint) and dual-track (AEC) interview modes.
"""
import asyncio
import json
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import BinaryIO

import numpy as np
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.routers.sessions import ensure_session, get_sessions, touch_session
from backend.services.asr_service import ASRService
from backend.services.aec_service import AECService
from backend.services.llm_service import (
    incremental_analyze_stream,
    interview_evaluation,
    interview_evaluation_stream,
    psychology_analysis_stream,
)
from backend.services.voiceprint_service import voiceprint_service, pcm_file_to_wav

router = APIRouter()
logger = logging.getLogger(__name__)

# 声纹识别用独立线程池，完全不阻塞 asyncio 事件循环
_voiceprint_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="voiceprint")


def _safe_create_task(coro, name: str = "unknown"):
    """Create an asyncio task with automatic exception logging."""
    task = asyncio.create_task(coro)
    def _log_exception(t):
        exc = t.exception()
        if isinstance(exc, asyncio.CancelledError):
            return
        if exc:
            logger.error("[TaskError] %s failed: %s", name, exc, exc_info=exc)
    task.add_done_callback(_log_exception)
    return task


_INCREMENTAL_TIMEOUT = 30.0


class IncrementalTracker:
    """Per-session incremental analysis state tracker with debouncing."""

    def __init__(self, timeout: float = 30.0):
        self._in_flight: dict[str, bool] = {}
        self._pending: dict[str, str] = {}
        self._start_time: dict[str, float] = {}
        self._timeout = timeout

    def is_in_flight(self, session_id: str) -> bool:
        return self._in_flight.get(session_id, False)

    def set_in_flight(self, session_id: str, value: bool):
        self._in_flight[session_id] = value

    def get_pending(self, session_id: str) -> str | None:
        return self._pending.get(session_id)

    def set_pending(self, session_id: str, sentence: str):
        self._pending[session_id] = sentence

    def pop_pending(self, session_id: str) -> str | None:
        return self._pending.pop(session_id, None)

    def get_start_time(self, session_id: str) -> float:
        return self._start_time.get(session_id, 0.0)

    def set_start_time(self, session_id: str, value: float):
        self._start_time[session_id] = value

    def pop_start_time(self, session_id: str):
        self._start_time.pop(session_id, None)

    def cleanup(self, session_id: str):
        self._in_flight.pop(session_id, None)
        self._pending.pop(session_id, None)
        self._start_time.pop(session_id, None)


_tracker = IncrementalTracker()


class ASRSessionHandler:
    """Encapsulates all per-session state and logic for the ASR WebSocket endpoint."""

    VOICEPRINT_MIN_BYTES = 96000
    VOICEPRINT_CHUNK_ENERGY_THRESHOLD = 30
    VOICEPRINT_SWITCH_CONFIRM_COUNT = 2
    INTERVIEWER_CONFIDENCE_THRESHOLD = 0.50

    def __init__(self, websocket: WebSocket, session_id: str):
        self.ws = websocket
        self.session_id = session_id
        self.session = ensure_session(session_id)
        touch_session(session_id)

        self.session_mode: str = "dual-track"
        self.asr = ASRService()
        self.interviewer_asr: ASRService | None = None
        self.candidate_asr: ASRService | None = None
        self.aec_service: AECService | None = None
        self.asr_started = False

        self.result_queue: asyncio.Queue = asyncio.Queue()
        self.loop: asyncio.AbstractEventLoop | None = None

        self.current_role = "candidate"
        self.interviewer_text: list[str] = []
        self.candidate_text: list[str] = []
        self.conversation_history: list[dict] = []

        self.has_candidate_spoken_this_round = False
        self.main_question = ""
        self.current_question = ""
        self.follow_up_questions: list[str] = []

        self.pending_sentences: list[dict] = []
        self.voiceprint_identifying = False
        self.voiceprint_registered = False
        self.voiceprint_enabled = False

        self.recent_audio_chunks: list[bytes] = []
        self.voiceprint_accumulated_bytes = 0
        self.voiceprint_switch_count = 0

        # Dual-track audio buffers for voiceprint cross-verification
        self.dual_track_audio_buffers: dict[str, bytearray] = {
            "interviewer": bytearray(),
            "candidate": bytearray(),
        }

        self.job_requirement: dict | None = None
        self.psychology_in_flight = False

        self.forward_task: asyncio.Task | None = None

        # Recording state
        self._recording_dir = Path("data/recordings")
        self._recording_files: dict[str, BinaryIO] = {}   # role -> open PCM file handle
        self._recording_tmp_paths: dict[str, str] = {}     # role -> temp PCM file path
        self._recording_initialized = False

    # ── Recording ───────────────────────────────────────────

    def _init_recording(self):
        """Lazily open temp PCM files for recording on first audio chunk."""
        if self._recording_initialized:
            return
        self._recording_dir.mkdir(parents=True, exist_ok=True)
        try:
            if self.session_mode == "dual-track":
                for role in ("interviewer", "candidate"):
                    tf = tempfile.NamedTemporaryFile(
                        suffix=".pcm", delete=False, dir=str(self._recording_dir)
                    )
                    self._recording_files[role] = tf
                    self._recording_tmp_paths[role] = tf.name
            else:
                tf = tempfile.NamedTemporaryFile(
                    suffix=".pcm", delete=False, dir=str(self._recording_dir)
                )
                self._recording_files["full"] = tf
                self._recording_tmp_paths["full"] = tf.name
            self._recording_initialized = True
            logger.info("[Recording] Initialized for session %s, mode=%s",
                        self.session_id, self.session_mode)
        except Exception as e:
            logger.error("[Recording] Failed to init: %s", e)

    def _write_recording(self, role_key: str, pcm_data: bytes):
        """Append PCM data to the recording file for the given role."""
        f = self._recording_files.get(role_key)
        if f:
            try:
                f.write(pcm_data)
            except Exception as e:
                logger.error("[Recording] Write error: %s", e)

    def _finalize_recording(self):
        """Close temp PCM files, merge into a single WAV, store path in session."""
        if not self._recording_initialized:
            return
        recording_paths = []
        try:
            # Close all file handles first
            for role, f in self._recording_files.items():
                try:
                    f.close()
                except Exception:
                    pass

            if self.session_mode == "dual-track" and len(self._recording_tmp_paths) == 2:
                # Merge interviewer + candidate PCM into one mono WAV
                int_path = self._recording_tmp_paths.get("interviewer")
                can_path = self._recording_tmp_paths.get("candidate")
                if int_path and can_path:
                    int_size = os.path.getsize(int_path) if os.path.exists(int_path) else 0
                    can_size = os.path.getsize(can_path) if os.path.exists(can_path) else 0
                    if int_size > 0 or can_size > 0:
                        wav_name = f"{self.session_id}_full.wav"
                        wav_path = str(self._recording_dir / wav_name)
                        self._merge_pcm_to_wav(int_path, can_path, wav_path)
                        recording_paths.append(wav_path)
                        total_duration = max(int_size, can_size) / 32000
                        logger.info("[Recording] Merged dual-track: %.1fs, %s", total_duration, wav_path)
                # Clean up temp files
                for tmp_path in self._recording_tmp_paths.values():
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
            else:
                # Single-track: convert the single PCM to WAV
                for role, tmp_path in self._recording_tmp_paths.items():
                    if not os.path.exists(tmp_path):
                        continue
                    pcm_size = os.path.getsize(tmp_path)
                    if pcm_size == 0:
                        os.remove(tmp_path)
                        continue
                    wav_name = f"{self.session_id}_full.wav"
                    wav_path = str(self._recording_dir / wav_name)
                    pcm_file_to_wav(tmp_path, wav_path)
                    os.remove(tmp_path)
                    recording_paths.append(wav_path)
                    duration = pcm_size / 32000
                    logger.info("[Recording] Saved %s: %.1fs, %s", role, duration, wav_path)

            self.session["recording_paths"] = recording_paths
        except Exception as e:
            logger.error("[Recording] Finalize error: %s", e)
        finally:
            self._recording_files.clear()
            self._recording_tmp_paths.clear()
            self._recording_initialized = False

    @staticmethod
    def _merge_pcm_to_wav(interviewer_pcm_path: str, candidate_pcm_path: str, wav_path: str,
                          sample_rate: int = 16000, sample_width: int = 2):
        """Merge two mono PCM streams into a single mono WAV by interleaving."""
        import wave
        int_data = b""
        can_data = b""
        if os.path.exists(interviewer_pcm_path):
            with open(interviewer_pcm_path, 'rb') as f:
                int_data = f.read()
        if os.path.exists(candidate_pcm_path):
            with open(candidate_pcm_path, 'rb') as f:
                can_data = f.read()

        max_len = max(len(int_data), len(can_data))
        # Pad shorter stream with silence (zeros)
        int_data = int_data.ljust(max_len, b'\x00')
        can_data = can_data.ljust(max_len, b'\x00')

        # Mix by averaging samples (prevents clipping)
        int_arr = np.frombuffer(int_data, dtype=np.int16)
        can_arr = np.frombuffer(can_data, dtype=np.int16)
        mixed = ((int_arr.astype(np.int32) + can_arr.astype(np.int32)) // 2).astype(np.int16)

        with wave.open(wav_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(sample_width)
            wf.setframerate(sample_rate)
            wf.writeframes(mixed.tobytes())

    def _cleanup_recording(self):
        """Clean up temp files on abnormal exit (no WAV conversion)."""
        for f in self._recording_files.values():
            try:
                f.close()
            except Exception:
                pass
        for tmp_path in self._recording_tmp_paths.values():
            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass
        self._recording_files.clear()
        self._recording_tmp_paths.clear()
        self._recording_initialized = False

    # ── ASR lifecycle ──────────────────────────────────────

    def stop_asr(self):
        if self.session_mode == "dual-track":
            if self.interviewer_asr:
                try: self.interviewer_asr.stop()
                except Exception: pass
            if self.candidate_asr:
                try: self.candidate_asr.stop()
                except Exception: pass
        else:
            if self.asr_started:
                try: self.asr.stop()
                except Exception: pass
        self.asr_started = False

    def start_asr(self):
        if self.session_mode == "dual-track":
            if not self.asr_started:
                self.candidate_asr.start(
                    on_partial=self._on_candidate_partial,
                    on_sentence=self._on_candidate_sentence,
                    on_error=self._on_error,
                )
                self.interviewer_asr.start(
                    on_partial=self._on_interviewer_partial,
                    on_sentence=self._on_interviewer_sentence,
                    on_error=self._on_error,
                )
                self.asr_started = True
                logger.info("[ASR] Dual-track ASR started")
        else:
            if not self.asr_started:
                try:
                    self.asr.start(
                        on_partial=self._on_partial,
                        on_sentence=self._on_sentence,
                        on_error=self._on_error,
                    )
                    self.asr_started = True
                    logger.info("[ASR] Started")
                except Exception as e:
                    logger.error("[ASR] Failed to start: %s", e)

    # ── State reset helpers ────────────────────────────────

    def reset_voiceprint_state(self, clear_chunks: bool = True):
        self.voiceprint_accumulated_bytes = 0
        if clear_chunks:
            self.recent_audio_chunks = []

    def reset_round_state(self):
        self.has_candidate_spoken_this_round = False
        self.main_question = ""
        self.follow_up_questions = []
        self.current_question = ""
        self.reset_voiceprint_state()

    # ── ASR callbacks (single-track) ───────────────────────

    def _on_partial(self, text: str, sentence_id: int):
        partial_time = time.monotonic()
        logger.debug("[TIMING] on_partial callback: text_len=%d, time=%.3f", len(text), partial_time)
        asyncio.run_coroutine_threadsafe(
            self.result_queue.put({
                "type": "partial",
                "text": text,
                "sentence_id": sentence_id,
                "role": self.current_role,
            }),
            self.loop,
        )

    def _on_sentence(self, text: str, sentence_id: int):
        sentence_time = time.monotonic()
        logger.info("[TIMING] on_sentence: text='%s' time=%.3f, voiceprint_identifying=%s, voiceprint_enabled=%s",
                    text[:50] if text else "", sentence_time, self.voiceprint_identifying, self.voiceprint_enabled)

        if self.voiceprint_enabled:
            self.pending_sentences.append({
                "text": text,
                "sentence_id": sentence_id,
                "timestamp": sentence_time,
            })
            asyncio.run_coroutine_threadsafe(
                self.result_queue.put({
                    "type": "sentence_pending",
                    "text": text,
                    "sentence_id": sentence_id,
                }),
                self.loop,
            )
        else:
            asyncio.run_coroutine_threadsafe(
                self.result_queue.put({
                    "type": "sentence_confirmed",
                    "text": text,
                    "sentence_id": sentence_id,
                    "role": self.current_role,
                }),
                self.loop,
            )

    def _on_error(self, msg: str):
        asyncio.run_coroutine_threadsafe(
            self.result_queue.put({"type": "error", "data": msg}),
            self.loop,
        )

    # ── ASR callbacks (dual-track) ─────────────────────────

    def _on_interviewer_partial(self, text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            self.result_queue.put({
                "type": "partial", "text": text,
                "sentence_id": sentence_id, "role": "interviewer",
            }),
            self.loop,
        )

    def _on_interviewer_sentence(self, text: str, sentence_id: int):
        if self.session_mode == "dual-track" and self.voiceprint_enabled:
            asyncio.run_coroutine_threadsafe(
                self.result_queue.put({
                    "type": "sentence_pending", "text": text,
                    "sentence_id": sentence_id, "role": "interviewer",
                    "source": "dual-track",
                }),
                self.loop,
            )
        else:
            asyncio.run_coroutine_threadsafe(
                self.result_queue.put({
                    "type": "sentence", "text": text,
                    "sentence_id": sentence_id, "role": "interviewer",
                }),
                self.loop,
            )

    def _on_candidate_partial(self, text: str, sentence_id: int):
        asyncio.run_coroutine_threadsafe(
            self.result_queue.put({
                "type": "partial", "text": text,
                "sentence_id": sentence_id, "role": "candidate",
            }),
            self.loop,
        )

    def _on_candidate_sentence(self, text: str, sentence_id: int):
        if self.session_mode == "dual-track" and self.voiceprint_enabled:
            asyncio.run_coroutine_threadsafe(
                self.result_queue.put({
                    "type": "sentence_pending", "text": text,
                    "sentence_id": sentence_id, "role": "candidate",
                    "source": "dual-track",
                }),
                self.loop,
            )
        else:
            asyncio.run_coroutine_threadsafe(
                self.result_queue.put({
                    "type": "sentence", "text": text,
                    "sentence_id": sentence_id, "role": "candidate",
                }),
                self.loop,
            )

    # ── Voiceprint identification ──────────────────────────

    async def run_voiceprint_identification(self, audio_data: bytes):
        logger.info("[VOICEPRINT-TASK] START audio_len=%d, pending_sentences=%d",
                    len(audio_data), len(self.pending_sentences))
        self.voiceprint_identifying = True

        def do_identification():
            logger.info("[VOICEPRINT-THREAD] Running identification...")
            try:
                result = voiceprint_service.identify_speaker(
                    audio_data=audio_data,
                    threshold=self.INTERVIEWER_CONFIDENCE_THRESHOLD,
                )
                logger.info("[VOICEPRINT-THREAD] Result: matched=%s role=%s confidence=%.2f",
                            result.get("matched"), result.get("role"), result.get("confidence", 0))
                return result
            except Exception as e:
                logger.error("[VOICEPRINT-THREAD] FAILED: %s", e)
                return None

        try:
            result = await asyncio.get_running_loop().run_in_executor(_voiceprint_executor, do_identification)
        except Exception as e:
            logger.error("[VOICEPRINT-TASK] Executor failed: %s", e)
            self.voiceprint_identifying = False
            return

        if result is None:
            logger.warning("[VOICEPRINT-TASK] No result, using current_role=%s", self.current_role)
        else:
            matched = bool(result.get("matched"))
            confidence = float(result.get("confidence", 0.0) or 0.0)

            if matched and result.get("role") == "interviewer" and confidence >= self.INTERVIEWER_CONFIDENCE_THRESHOLD:
                detected_role = "interviewer"
            else:
                detected_role = "candidate"

            HIGH_CONFIDENCE = 0.55
            if detected_role != self.current_role:
                if confidence >= HIGH_CONFIDENCE:
                    logger.info("[VOICEPRINT-TASK] HIGH CONFIDENCE switch: %s -> %s (confidence=%.2f)",
                                self.current_role, detected_role, confidence)
                    self.current_role = detected_role
                    self.voiceprint_switch_count = 0
                    await self.ws.send_json({
                        "type": "role_switched",
                        "role": self.current_role,
                        "detected_by": "voiceprint",
                        "confidence": confidence,
                    })
                else:
                    self.voiceprint_switch_count += 1
                    logger.info("[VOICEPRINT-TASK] Switch attempt %d/%d: %s -> %s (confidence=%.2f)",
                                self.voiceprint_switch_count, self.VOICEPRINT_SWITCH_CONFIRM_COUNT,
                                self.current_role, detected_role, confidence)

                    if self.voiceprint_switch_count >= self.VOICEPRINT_SWITCH_CONFIRM_COUNT:
                        logger.info("[VOICEPRINT-TASK] ROLE CHANGE CONFIRMED: %s -> %s", self.current_role, detected_role)
                        self.current_role = detected_role
                        self.voiceprint_switch_count = 0
                        await self.ws.send_json({
                            "type": "role_switched",
                            "role": self.current_role,
                            "detected_by": "voiceprint",
                            "confidence": confidence,
                        })
            else:
                self.voiceprint_switch_count = 0

        confirmed_role = self.current_role
        logger.info("[VOICEPRINT-TASK] Confirming %d pending sentences as role=%s",
                    len(self.pending_sentences), confirmed_role)

        for sent in self.pending_sentences:
            await self.result_queue.put({
                "type": "sentence_confirmed",
                "text": sent["text"],
                "sentence_id": sent["sentence_id"],
                "role": confirmed_role,
            })

        self.pending_sentences.clear()
        self.voiceprint_identifying = False
        logger.info("[VOICEPRINT-TASK] END")

    # ── Incremental analysis ───────────────────────────────

    async def run_incremental_analysis(self, sentence: str):
        if _tracker.is_in_flight(self.session_id):
            start_time = _tracker.get_start_time(self.session_id)
            if time.monotonic() - start_time > _INCREMENTAL_TIMEOUT:
                _tracker.set_in_flight(self.session_id, False)
                _tracker.pop_start_time(self.session_id)
            else:
                _tracker.set_pending(self.session_id, sentence)
                return

        _tracker.set_in_flight(self.session_id, True)
        _tracker.set_start_time(self.session_id, time.monotonic())
        try:
            await self._do_incremental_analysis(sentence)
            pending = _tracker.pop_pending(self.session_id)
            if pending:
                await self.run_incremental_analysis(pending)
        finally:
            _tracker.set_in_flight(self.session_id, False)
            _tracker.pop_start_time(self.session_id)

    async def _do_incremental_analysis(self, sentence: str):
        accumulated = "".join(self.candidate_text)
        resume_ctx = self.session.get("resume_text", "")

        question_context = self.current_question
        if self.follow_up_questions:
            question_context += "\n[追问] " + " ".join(self.follow_up_questions[-3:])
        if not question_context.strip():
            fallback_answer = accumulated[-300:] if accumulated else sentence
            question_context = f"[当前问题上下文缺失]\n[候选人当前回答片段] {fallback_answer}"

        try:
            async for chunk in incremental_analyze_stream(
                resume_context=resume_ctx,
                current_sentence=sentence,
                accumulated_answer=accumulated,
                current_question=question_context,
                conversation_history=self.conversation_history,
            ):
                await self.ws.send_json({"type": "follow_up_stream", "data": chunk})
            await self.ws.send_json({"type": "follow_up_complete"})
        except Exception as e:
            logger.exception("Incremental analysis failed")
            await self.ws.send_json({"type": "error", "data": f"Incremental analysis failed: {str(e)}"})

    # ── Psychology analysis ────────────────────────────────

    async def run_psychology_analysis(self, sentence: str):
        if self.psychology_in_flight:
            return
        self.psychology_in_flight = True
        try:
            accumulated = "".join(self.candidate_text)
            resume_ctx = self.session.get("resume_text", "")

            question_context = self.current_question
            if self.follow_up_questions:
                question_context += "\n[追问] " + " ".join(self.follow_up_questions[-3:])

            await self.ws.send_json({"type": "psychology_start"})
            async for chunk in psychology_analysis_stream(
                resume_context=resume_ctx,
                current_question=question_context,
                recent_sentences=sentence,
                accumulated_answer=accumulated,
            ):
                await self.ws.send_json({"type": "psychology_stream", "data": chunk})
            await self.ws.send_json({"type": "psychology_complete"})
        except Exception:
            logger.exception("Psychology analysis failed")
        finally:
            self.psychology_in_flight = False

    # ── Manual trigger variants (bypass in-flight guards) ──

    async def _run_manual_incremental(self, sentence: str):
        """Manual trigger: always runs, bypasses in-flight debounce."""
        try:
            await self._do_incremental_analysis(sentence)
        except Exception as e:
            logger.exception("Manual incremental analysis failed")
            await self.ws.send_json({"type": "error", "data": f"追问分析失败: {str(e)}"})

    async def _run_manual_psychology(self, sentence: str):
        """Manual trigger: always runs, bypasses in-flight guard."""
        try:
            accumulated = "".join(self.candidate_text)
            resume_ctx = self.session.get("resume_text", "")

            question_context = self.current_question
            if self.follow_up_questions:
                question_context += "\n[追问] " + " ".join(self.follow_up_questions[-3:])
            if not question_context.strip():
                fallback_answer = accumulated[-300:] if accumulated else sentence
                question_context = f"[当前问题上下文缺失]\n[候选人当前回答片段] {fallback_answer}"

            async for chunk in psychology_analysis_stream(
                resume_context=resume_ctx,
                current_question=question_context,
                recent_sentences=sentence,
                accumulated_answer=accumulated,
            ):
                await self.ws.send_json({"type": "psychology_stream", "data": chunk})
            await self.ws.send_json({"type": "psychology_complete"})
        except Exception:
            logger.exception("Manual psychology analysis failed")

    # ── Text routing helper ────────────────────────────────

    def _append_text_by_role(self, role: str, text: str):
        """Append confirmed text to the correct role buffer and update round state."""
        if role == "interviewer":
            self.interviewer_text.append(text)
            if self.has_candidate_spoken_this_round:
                self.follow_up_questions.append(text)
            else:
                self.main_question += text
            self.current_question = self.main_question
        else:
            self.candidate_text.append(text)
            self.has_candidate_spoken_this_round = True

    # ── Dual-track voiceprint verification ─────────────────

    async def _verify_dual_track_sentence(self, item: dict):
        """Verify a dual-track sentence's role via voiceprint, correcting crosstalk."""
        tagged_role = item["role"]
        text = item["text"]
        sentence_id = item["sentence_id"]

        audio_data = self._get_recent_audio_for_role(tagged_role)
        if not audio_data or len(audio_data) < self.VOICEPRINT_MIN_BYTES:
            # Not enough audio for voiceprint, trust the tag
            logger.debug("[DUAL-TRACK] Insufficient audio for voiceprint (%d bytes), trusting tag=%s",
                         len(audio_data) if audio_data else 0, tagged_role)
            await self.ws.send_json({
                "type": "sentence", "text": text,
                "sentence_id": sentence_id, "role": tagged_role,
            })
            self._append_text_by_role(tagged_role, text)
            return

        # Run voiceprint identification
        verified_role = await self._run_dual_track_voiceprint(audio_data, tagged_role)

        if verified_role != tagged_role:
            logger.warning("[DUAL-TRACK] Role mismatch: tagged=%s, verified=%s, text='%s'",
                           tagged_role, verified_role, text[:50])

        await self.ws.send_json({
            "type": "sentence", "text": text,
            "sentence_id": sentence_id, "role": verified_role,
        })
        self._append_text_by_role(verified_role, text)

    def _get_recent_audio_for_role(self, role: str) -> bytes:
        """Get recent audio bytes for voiceprint verification."""
        buf = self.dual_track_audio_buffers.get(role, bytearray())
        return bytes(buf)

    async def _run_dual_track_voiceprint(self, audio_data: bytes, tagged_role: str) -> str:
        """Run voiceprint identification and return the verified role."""
        def do_identification():
            try:
                result = voiceprint_service.identify_speaker(
                    audio_data=audio_data,
                    threshold=self.INTERVIEWER_CONFIDENCE_THRESHOLD,
                )
                logger.info("[DUAL-TRACK-VOICEPRINT] tagged=%s, matched=%s, role=%s, confidence=%.2f",
                            tagged_role, result.get("matched"), result.get("role"),
                            result.get("confidence", 0))
                return result
            except Exception as e:
                logger.error("[DUAL-TRACK-VOICEPRINT] Failed: %s", e)
                return None

        try:
            result = await asyncio.get_running_loop().run_in_executor(
                _voiceprint_executor, do_identification
            )
        except Exception as e:
            logger.error("[DUAL-TRACK-VOICEPRINT] Executor failed: %s", e)
            return tagged_role

        if result and result.get("matched"):
            return result["role"]

        # No confident match — trust the original tag
        return tagged_role

    # ── Forward results task ───────────────────────────────

    async def _forward_results(self):
        logger.info("[FORWARD] Task started")
        try:
            while True:
                item = await self.result_queue.get()
                forward_time = time.monotonic()
                logger.debug("[TIMING] forward_results: type=%s role=%s source=%s time=%.3f",
                             item["type"], item.get("role"), item.get("source"), forward_time)

                if item["type"] == "error":
                    await self.ws.send_json(item)
                    continue

                # Dual-track voiceprint verification
                if item["type"] == "sentence_pending" and item.get("source") == "dual-track":
                    _safe_create_task(
                        self._verify_dual_track_sentence(item),
                        "dual_track_voiceprint_verify"
                    )
                    continue

                await self.ws.send_json(item)
                send_time = time.monotonic() - forward_time
                logger.debug("[TIMING] websocket.send_json took %.3fms", send_time * 1000)

                if item["type"] not in ("sentence", "sentence_confirmed"):
                    continue

                self._append_text_by_role(item["role"], item["text"])
        except asyncio.CancelledError:
            logger.info("[ForwardResults] Task cancelled")
        except Exception as e:
            logger.error("[ForwardResults] Task error: %s", e)

    # ── Binary message handling ────────────────────────────

    async def _handle_binary(self, audio_data: bytes):
        if len(audio_data) == 0:
            return

        self._init_recording()

        if self.session_mode == "dual-track":
            role_byte = audio_data[0]
            pcm_data = audio_data[1:]

            if not self.asr_started:
                self.start_asr()

            # Max buffer: 6 seconds of 16kHz 16-bit audio = 192000 bytes
            MAX_AUDIO_BUFFER = 192000

            if role_byte == 0x01:
                # Buffer for voiceprint cross-verification
                self.dual_track_audio_buffers["interviewer"].extend(pcm_data)
                if len(self.dual_track_audio_buffers["interviewer"]) > MAX_AUDIO_BUFFER:
                    self.dual_track_audio_buffers["interviewer"] = \
                        self.dual_track_audio_buffers["interviewer"][-MAX_AUDIO_BUFFER:]

                # Feed to AEC buffer
                self.aec_service.feed_mic(pcm_data)

                if self.asr_started:
                    if AECService.is_available():
                        # AEC available: process buffered mic audio through AEC
                        cleaned_chunks = self.aec_service.process_available()
                        if cleaned_chunks:
                            for chunk in cleaned_chunks:
                                self.interviewer_asr.send_audio(chunk)
                                self._write_recording("interviewer", chunk)
                        # If no AEC output yet (waiting for sys audio), audio stays buffered
                    else:
                        # No AEC: send mic audio directly
                        self.interviewer_asr.send_audio(pcm_data)
                        self._write_recording("interviewer", pcm_data)
            elif role_byte == 0x02:
                # Buffer for voiceprint cross-verification
                self.dual_track_audio_buffers["candidate"].extend(pcm_data)
                if len(self.dual_track_audio_buffers["candidate"]) > MAX_AUDIO_BUFFER:
                    self.dual_track_audio_buffers["candidate"] = \
                        self.dual_track_audio_buffers["candidate"][-MAX_AUDIO_BUFFER:]

                # System audio → candidate ASR directly
                self.candidate_asr.send_audio(pcm_data)
                # Feed to AEC buffer as reference
                self.aec_service.feed_sys(pcm_data)
                self._write_recording("candidate", pcm_data)
        else:
            audio_len = len(audio_data)
            recv_time = time.monotonic()
            logger.debug("[TIMING] recv audio: len=%d, time=%.3f", audio_len, recv_time)

            self.start_asr()
            try:
                asr_send_start = time.monotonic()
                self.asr.send_audio(audio_data)
                asr_send_time = time.monotonic() - asr_send_start
                logger.debug("[TIMING] asr.send took %.3fms", asr_send_time * 1000)
            except Exception as e:
                logger.error("[ASR] Failed to send: %s", e)

            self._write_recording("full", audio_data)

            if self.voiceprint_enabled:
                _samples = np.frombuffer(audio_data, dtype=np.int16)
                _chunk_energy = np.abs(_samples).mean()

                if _chunk_energy >= self.VOICEPRINT_CHUNK_ENERGY_THRESHOLD:
                    self.recent_audio_chunks.append(audio_data)
                    self.voiceprint_accumulated_bytes += audio_len
                    if self.voiceprint_accumulated_bytes % 32000 < audio_len:
                        logger.info("[VOICEPRINT] Accumulated %.1fs effective audio (chunk_energy=%.0f)",
                                    self.voiceprint_accumulated_bytes / 32000, _chunk_energy)

                if self.voiceprint_accumulated_bytes >= self.VOICEPRINT_MIN_BYTES:
                    combined_audio = b"".join(self.recent_audio_chunks)
                    logger.info("[VOICEPRINT] Trigger with %.1fs effective audio, current_role=%s",
                                self.voiceprint_accumulated_bytes / 32000, self.current_role)
                    _safe_create_task(self.run_voiceprint_identification(combined_audio), "voiceprint_identification")
                    self.recent_audio_chunks = []
                    self.voiceprint_accumulated_bytes = 0

    # ── Control message handling ───────────────────────────

    async def _handle_control(self, msg: dict):
        action = msg.get("action", "")

        if action == "set_mode":
            self.session_mode = msg.get("mode", "single-track")
            logger.info("[WebSocket] Mode set to: %s", self.session_mode)
            self.session["mode"] = self.session_mode

            self.stop_asr()
            self.voiceprint_enabled = self.voiceprint_registered

            if self.session_mode == "dual-track":
                self.interviewer_asr = ASRService()
                self.candidate_asr = ASRService()
                self.aec_service = AECService()

                if self.voiceprint_registered:
                    await self.ws.send_json({
                        "type": "voiceprint_status",
                        "enabled": True,
                        "message": "双轨模式声纹交叉验证已启用",
                    })

                await self.ws.send_json({
                    "type": "mode_status",
                    "mode": "dual-track",
                    "message": "双轨模式已启用，角色由音频源自动区分" + ("，声纹交叉验证已启用" if self.voiceprint_registered else ""),
                    "aec_available": AECService.is_available(),
                })
            else:
                await self.ws.send_json({
                    "type": "voiceprint_status",
                    "enabled": self.voiceprint_registered,
                    "message": f"声纹识别已启用（已注册面试官声纹）" if self.voiceprint_registered else "请先在声纹管理页面注册面试官声纹"
                })
                await self.ws.send_json({
                    "type": "mode_status",
                    "mode": "single-track",
                    "message": "单轨模式已启用，角色由声纹识别区分",
                })

        elif action == "set_job_requirement":
            self.job_requirement = msg.get("job_requirement")

        elif action == "trigger_follow_up":
            accumulated = "".join(self.candidate_text)
            if accumulated.strip():
                last_sentence = self.candidate_text[-1] if self.candidate_text else accumulated[-200:]
                # Clear previous follow-up result before starting new analysis
                await self.ws.send_json({"type": "follow_up_clear"})
                _safe_create_task(self._run_manual_incremental(last_sentence), "incremental_analysis")

        elif action == "trigger_psychology":
            accumulated = "".join(self.candidate_text)
            if accumulated.strip():
                last_sentence = self.candidate_text[-1] if self.candidate_text else accumulated[-200:]
                # Clear previous psychology result before starting new analysis
                await self.ws.send_json({"type": "psychology_start"})
                _safe_create_task(self._run_manual_psychology(last_sentence), "psychology_analysis")

        elif action == "answer_complete":
            self.stop_asr()
            _tracker.cleanup(self.session_id)

            full_answer = "".join(self.candidate_text)
            full_question = "".join(self.interviewer_text)
            self.candidate_text.clear()
            self.interviewer_text.clear()
            self.reset_round_state()

            self.conversation_history.append({"question": full_question, "answer": full_answer})
            await self.ws.send_json({"type": "follow_up_clear"})

            self.session["qa_history"].append({"question": full_question, "answer": full_answer})
            await self.ws.send_json({
                "type": "answer_complete_ack",
                "question": full_question,
                "answer": full_answer,
            })

        elif action == "pause":
            self.stop_asr()

        elif action == "resume":
            self.start_asr()

        elif action == "stop":
            self.stop_asr()
            self.reset_voiceprint_state()
            _tracker.cleanup(self.session_id)
            self._finalize_recording()

            resume_ctx = self.session.get("resume_text", "")
            qa = self.session.get("qa_history", [])

            if qa:
                await self.ws.send_json({"type": "evaluation_start"})
                try:
                    result = await interview_evaluation(
                        resume_context=resume_ctx,
                        qa_history=qa,
                        job_requirement=self.job_requirement,
                    )
                    await self.ws.send_json({"type": "evaluation_result", "data": result})
                except Exception as e:
                    logger.error("Evaluation failed: %s", e)
                    await self.ws.send_json({"type": "evaluation_error", "data": str(e)})
                await self.ws.send_json({"type": "evaluation_complete"})

            return True  # signal to break the message loop

        return False

    # ── Session init ───────────────────────────────────────

    async def _init_session(self):
        try:
            voiceprints = await voiceprint_service.get_global_voiceprints()
            self.voiceprint_registered = len(voiceprints) > 0
            logger.info("[Voiceprint] Check: registered=%d", len(voiceprints))

            await self.ws.send_json({
                "type": "voiceprint_status",
                "enabled": self.voiceprint_registered,
                "message": f"声纹识别已启用（已注册 {len(voiceprints)} 个面试官声纹）" if self.voiceprint_registered else "请先在声纹管理页面注册面试官声纹"
            })
        except Exception as e:
            logger.error("[Voiceprint] Check failed: %s", e)
            self.voiceprint_registered = False

        self.voiceprint_enabled = self.session_mode == "single-track" and self.voiceprint_registered

        if self.session_mode != "single-track":
            await self.ws.send_json({
                "type": "mode_status",
                "mode": "dual-track",
                "message": "双轨模式已启用，角色由音频源自动区分",
                "aec_available": AECService.is_available(),
            })

    # ── Cleanup ────────────────────────────────────────────

    def _cleanup(self):
        self.stop_asr()
        self._cleanup_recording()
        if self.session_mode == "dual-track" and self.aec_service:
            self.aec_service.reset()
        if self.forward_task is not None:
            self.forward_task.cancel()
        _tracker.cleanup(self.session_id)

    # ── Main run loop ──────────────────────────────────────

    async def run(self):
        try:
            await self.ws.accept()
            logger.info("[WebSocket] Connected: session_id=%s", self.session_id)
        except Exception as e:
            logger.error("[WebSocket] Failed to accept: %s", e)
            return

        self.loop = asyncio.get_running_loop()
        await self._init_session()

        try:
            self.forward_task = _safe_create_task(self._forward_results(), "forward_results")
            logger.info("[WebSocket] Starting main loop for session %s", self.session_id)

            while True:
                try:
                    raw = await self.ws.receive()
                    logger.debug("[WebSocket] Received raw message type: %s", list(raw.keys()))
                except Exception as e:
                    logger.error("[WebSocket] Error receiving message: %s", e)
                    break

                if "bytes" in raw and raw["bytes"]:
                    await self._handle_binary(raw["bytes"])
                    continue

                if "text" not in raw or not raw["text"]:
                    continue

                msg = json.loads(raw["text"])
                if msg.get("type") != "control":
                    continue

                should_stop = await self._handle_control(msg)
                if should_stop:
                    break

        except WebSocketDisconnect:
            logger.debug("[WebSocket] Client disconnected normally")
        except RuntimeError as e:
            if "disconnect" in str(e).lower():
                logger.error("[WebSocket] Connection closed: %s", e)
            else:
                logger.error("[WebSocket] Unexpected RuntimeError: %s", e)
        finally:
            self._cleanup()


@router.websocket("/ws/asr/{session_id}")
async def asr_websocket(websocket: WebSocket, session_id: str):
    handler = ASRSessionHandler(websocket, session_id)
    await handler.run()


@router.websocket("/ws/voiceprint-enroll")
async def voiceprint_enroll_websocket(websocket: WebSocket):
    """独立的声纹注册 WebSocket，不需要面试 session。
    前端声纹管理页面使用此连接，通过 AudioWorklet Int16 PCM 流注册声纹，
    确保注册和识别使用完全相同的音频通道。
    """
    try:
        await websocket.accept()
        logger.info("[VoiceprintEnroll-WS] Connected")
    except Exception as e:
        logger.error("[VoiceprintEnroll-WS] Failed to accept: %s", e)
        return

    CHUNK_ENERGY_THRESHOLD = 30
    ENROLL_MIN_BYTES = 96000  # 3秒有效语音

    enrolling = False
    enroll_name = ""
    enroll_chunks: list[bytes] = []
    enroll_bytes = 0

    try:
        while True:
            try:
                raw = await websocket.receive()
            except Exception as e:
                logger.error("[VoiceprintEnroll-WS] Receive error: %s", e)
                break

            # 处理二进制音频数据
            if "bytes" in raw and raw["bytes"]:
                audio_data = raw["bytes"]
                audio_len = len(audio_data)

                if not enrolling:
                    continue

                _samples = np.frombuffer(audio_data, dtype=np.int16)
                _chunk_energy = np.abs(_samples).mean()

                if _chunk_energy >= CHUNK_ENERGY_THRESHOLD:
                    enroll_chunks.append(audio_data)
                    enroll_bytes += audio_len
                    logger.info("[VoiceprintEnroll-WS] Accumulated %.1fs effective audio (energy=%.0f)",
                                enroll_bytes / 32000, _chunk_energy)

                if enroll_bytes >= ENROLL_MIN_BYTES:
                    enroll_audio = b"".join(enroll_chunks)
                    voice_id = f"interviewer_{int(time.time() * 1000)}"

                    try:
                        result = await voiceprint_service.enroll_voiceprint(
                            voice_id=voice_id,
                            name=enroll_name,
                            audio_data=enroll_audio,
                            role="interviewer",
                            session_id="global_interviewers",
                        )
                        if result.get("success"):
                            await websocket.send_json({
                                "type": "voiceprint_enroll_result",
                                "success": True,
                                "voice_id": voice_id,
                                "message": f"声纹注册成功：{enroll_name}",
                            })
                            logger.info("[VoiceprintEnroll-WS] Success: voice_id=%s", voice_id)
                        else:
                            await websocket.send_json({
                                "type": "voiceprint_enroll_result",
                                "success": False,
                                "message": f"声纹注册失败：{result.get('error', '未知错误')}",
                            })
                    except Exception as e:
                        await websocket.send_json({
                            "type": "voiceprint_enroll_result",
                            "success": False,
                            "message": f"声纹注册异常：{e}",
                        })

                    enrolling = False
                    enroll_chunks = []
                    enroll_bytes = 0

                continue

            # 处理文本控制消息
            if "text" not in raw or not raw["text"]:
                continue

            try:
                msg = json.loads(raw["text"])
            except Exception:
                continue

            if msg.get("type") == "control" and msg.get("action") == "enroll_voiceprint":
                enroll_name = msg.get("name", "面试官")
                enrolling = True
                enroll_chunks = []
                enroll_bytes = 0
                logger.info("[VoiceprintEnroll-WS] Start enrolling: name=%s", enroll_name)
                await websocket.send_json({
                    "type": "voiceprint_enroll_start",
                    "message": f"请说话，正在注册声纹：{enroll_name}",
                })

    except WebSocketDisconnect:
        logger.debug("[VoiceprintEnroll-WS] Client disconnected normally")
    except RuntimeError as e:
        if "disconnect" in str(e).lower():
            logger.info("[VoiceprintEnroll-WS] Connection closed: %s", e)
        else:
            logger.error("[VoiceprintEnroll-WS] Unexpected RuntimeError: %s", e)
    finally:
        logger.info("[VoiceprintEnroll-WS] Connection ended")
