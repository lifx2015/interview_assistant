"""
AEC (Acoustic Echo Cancellation) service for dual-track interview mode.
Uses pyaec (Speex MDF algorithm via Rust/ctypes) to remove candidate echo
from the microphone stream using system audio as reference.
"""
import logging
import numpy as np

logger = logging.getLogger(__name__)

_AEC_AVAILABLE = False
try:
    from pyaec import Aec
    _AEC_AVAILABLE = True
    logger.info("[AEC] pyaec available, AEC enabled")
except ImportError:
    logger.warning("[AEC] pyaec not available, dual-track mode will run without AEC")


class AECService:
    """Stream-oriented AEC that buffers mic and system audio, processes
    aligned 160-sample (10ms) frames, and returns echo-cancelled PCM."""

    FRAME_SIZE = 160       # samples per frame (10ms at 16kHz)
    FILTER_LENGTH = 2048   # covers ~128ms echo tail
    SAMPLE_RATE = 16000
    BYTES_PER_FRAME = FRAME_SIZE * 2  # int16 = 2 bytes per sample

    def __init__(self):
        if _AEC_AVAILABLE:
            self.aec = Aec(
                frame_size=self.FRAME_SIZE,
                filter_length=self.FILTER_LENGTH,
                sample_rate=self.SAMPLE_RATE,
                enable_preprocess=True,
            )
        else:
            self.aec = None
        self.mic_buffer = bytearray()
        self.sys_buffer = bytearray()

    def feed_mic(self, pcm_bytes: bytes):
        self.mic_buffer.extend(pcm_bytes)

    def feed_sys(self, pcm_bytes: bytes):
        self.sys_buffer.extend(pcm_bytes)

    def drain_mic(self) -> bytes:
        """Drain all buffered mic audio as a single chunk (for interviewer ASR).
        Used when AEC is not available or when passing through mic audio directly."""
        data = bytes(self.mic_buffer)
        self.mic_buffer.clear()
        # Also drain matching amount of sys audio to keep buffers aligned
        drain_len = min(len(self.sys_buffer), len(data))
        if drain_len > 0:
            del self.sys_buffer[:drain_len]
        return data

    def process_available(self) -> list[bytes]:
        """Process aligned frames with AEC. Returns echo-cancelled mic PCM list.
        Only called when AEC is actually available; requires both mic and sys
        buffers to have data for alignment."""
        results = []
        if self.aec is None:
            # No AEC: drain mic as one chunk instead of per-frame slicing
            if self.mic_buffer:
                results.append(bytes(self.mic_buffer))
                self.mic_buffer.clear()
                # Drain matching sys audio
                if self.sys_buffer:
                    self.sys_buffer.clear()
            return results

        while len(self.mic_buffer) >= self.BYTES_PER_FRAME and len(self.sys_buffer) >= self.BYTES_PER_FRAME:
            mic_frame_bytes = bytes(self.mic_buffer[:self.BYTES_PER_FRAME])
            sys_frame_bytes = bytes(self.sys_buffer[:self.BYTES_PER_FRAME])
            del self.mic_buffer[:self.BYTES_PER_FRAME]
            del self.sys_buffer[:self.BYTES_PER_FRAME]

            mic_samples = np.frombuffer(mic_frame_bytes, dtype=np.int16).tolist()
            sys_samples = np.frombuffer(sys_frame_bytes, dtype=np.int16).tolist()

            cleaned = self.aec.cancel_echo(mic_samples, sys_samples)
            results.append(np.array(cleaned, dtype=np.int16).tobytes())

        return results

    def get_pending_sys_audio(self) -> list[bytes]:
        """Drain system audio frames that have no matching mic frames yet.
        Used to send system audio directly to candidate ASR."""
        results = []
        while len(self.sys_buffer) >= self.BYTES_PER_FRAME:
            frame = bytes(self.sys_buffer[:self.BYTES_PER_FRAME])
            del self.sys_buffer[:self.BYTES_PER_FRAME]
            results.append(frame)
        return results

    def reset(self):
        self.mic_buffer.clear()
        self.sys_buffer.clear()

    @staticmethod
    def is_available() -> bool:
        return _AEC_AVAILABLE
