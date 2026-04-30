import { useRef, useCallback, useState } from 'react';

export interface SystemAudioCaptureState {
  isCapturing: boolean;
  error: string | null;
}

export interface SystemAudioCaptureActions {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export function useSystemAudioCapture(
  onAudioData: (pcmData: ArrayBuffer) => void
): SystemAudioCaptureState & SystemAudioCaptureActions {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const pausedRef = useRef(false);

  const start = useCallback(async () => {
    try {
      setError(null);

      // Check browser support
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('当前浏览器不支持系统音频捕获，请使用 Chrome 或 Edge');
      }

      // Capture system audio via screen sharing API
      // Chrome requires video: true to capture system audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,  // Required by Chrome for audio capture
      });

      // Stop all video tracks immediately - we only need audio
      stream.getVideoTracks().forEach(track => track.stop());

      // Verify audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('未获取到系统音频，请确保在屏幕共享时勾选了"分享音频"选项');
      }

      streamRef.current = stream;

      // Create audio context and worklet
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      await audioContext.resume();

      try {
        await audioContext.audioWorklet.addModule('/worklets/pcm-processor.js');
      } catch {
        await audioContext.audioWorklet.addModule(
          new URL('../worklets/pcm-processor.ts', import.meta.url)
        );
      }

      // Create source from system audio stream
      const sourceNode = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;

      // Create worklet node for PCM processing
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

      workletNode.port.onmessage = (event) => {
        if (pausedRef.current) return;
        onAudioData(event.data);
      };

      workletNodeRef.current = workletNode;

      // Connect: source → worklet (no echo cancellation for system audio)
      sourceNode.connect(workletNode);
      // Don't connect to destination - we don't want to play it back

      // Handle stream end (user stops sharing)
      audioTracks[0].onended = () => {
        stop();
      };

      setIsCapturing(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '系统音频捕获失败';
      // User cancelled the screen share dialog
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('用户取消了屏幕共享');
      } else {
        setError(message);
      }
      throw err;  // Re-throw so caller can handle (e.g., fallback to single-track)
    }
  }, [onAudioData]);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    pausedRef.current = false;
    setIsCapturing(false);
  }, []);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  return {
    isCapturing,
    error,
    start,
    stop,
    pause,
    resume,
  };
}