import { useRef, useCallback, useState } from 'react';

interface UseAudioCaptureOptions {
  onAudioData: (data: ArrayBuffer) => void;
}

const WORKLET_URL = new URL('../worklets/pcm-processor.ts', import.meta.url);

export function useAudioCapture({ onAudioData }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const activeRef = useRef(false);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule(WORKLET_URL);

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        if (!activeRef.current) return;
        onAudioData(e.data);
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      activeRef.current = true;
      setIsCapturing(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [onAudioData]);

  const stop = useCallback(() => {
    activeRef.current = false;
    workletNodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    workletNodeRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setIsCapturing(false);
  }, []);

  const pause = useCallback(() => {
    activeRef.current = false;
  }, []);

  const resume = useCallback(() => {
    activeRef.current = true;
  }, []);

  return { isCapturing, error, start, stop, pause, resume };
}
