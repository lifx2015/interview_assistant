import { useRef, useCallback, useState } from 'react';
import { encodePCM } from '../utils/audioUtils';

interface UseAudioCaptureOptions {
  onAudioData: (data: ArrayBuffer) => void;
  bufferSize?: number;
}

export function useAudioCapture({ onAudioData, bufferSize = 4096 }: UseAudioCaptureOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
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

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!activeRef.current) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const pcmBuffer = encodePCM(float32, audioContext.sampleRate);
        onAudioData(pcmBuffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      activeRef.current = true;
      setIsCapturing(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [onAudioData, bufferSize]);

  const stop = useCallback(() => {
    activeRef.current = false;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    processorRef.current = null;
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
