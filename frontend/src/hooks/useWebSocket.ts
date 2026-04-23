import { useRef, useCallback, useState, useEffect } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onBinaryMessage?: (data: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (e: Event) => void;
}

export type WSStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useWebSocket({
  url,
  onMessage,
  onBinaryMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wasConnectedRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setError(null);
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      wasConnectedRef.current = true;
      setStatus('connected');
      setError(null);
      onOpen?.();
    };

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        onBinaryMessage?.(e.data);
      } else {
        try {
          const parsed = JSON.parse(e.data);
          onMessage?.(parsed);
        } catch {
          onMessage?.(e.data);
        }
      }
    };

    ws.onclose = () => {
      if (wasConnectedRef.current) {
        setStatus('error');
        setError('与服务器的连接已断开');
      } else {
        setStatus('disconnected');
      }
      onClose?.();
    };

    ws.onerror = () => {
      const msg = 'WebSocket 连接失败';
      setStatus('error');
      setError(msg);
      onError?.(new Event(msg));
    };
  }, [url, onMessage, onBinaryMessage, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    wasConnectedRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
    setError(null);
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendBinary = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    if (status === 'error') setStatus('disconnected');
  }, [status]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return { status, error, connect, disconnect, send, sendBinary, clearError };
}
