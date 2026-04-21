import { useRef, useCallback, useState, useEffect } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onBinaryMessage?: (data: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (e: Event) => void;
}

export type WSStatus = 'disconnected' | 'connecting' | 'connected';

export function useWebSocket({
  url,
  onMessage,
  onBinaryMessage,
  onOpen,
  onClose,
  onError,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
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
      setStatus('disconnected');
      onClose?.();
    };

    ws.onerror = (e) => {
      onError?.(e);
    };
  }, [url, onMessage, onBinaryMessage, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
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

  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { status, connect, disconnect, send, sendBinary };
}
