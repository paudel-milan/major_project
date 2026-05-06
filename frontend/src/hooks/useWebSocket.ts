import { useState, useEffect, useRef, useCallback } from 'react';
import type { WSEvent, BuildStatus } from '../types';

const WS_URL = `ws://${window.location.host}/ws`;

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>({ status: 'idle' });
  const [shouldReload, setShouldReload] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const listenersRef = useRef<Map<string, Set<(data: Record<string, unknown>) => void>>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[WS] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSEvent = JSON.parse(event.data);

        // Handle build events
        switch (msg.event) {
          case 'build_start':
            setBuildStatus({ status: 'building', projectId: msg.data.projectId as string });
            break;
          case 'build_complete':
            setBuildStatus({
              status: 'ready',
              projectId: msg.data.projectId as string,
              duration: msg.data.duration as number,
            });
            break;
          case 'build_error':
            setBuildStatus({
              status: 'error',
              projectId: msg.data.projectId as string,
              error: msg.data.error as string,
            });
            break;
          case 'reload':
            setShouldReload(prev => prev + 1);
            break;
        }

        // Notify registered listeners
        const listeners = listenersRef.current.get(msg.event);
        if (listeners) {
          listeners.forEach(fn => fn(msg.data));
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[WS] Disconnected, reconnecting in 3s...');
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: string, handler: (data: Record<string, unknown>) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);
    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return { isConnected, buildStatus, shouldReload, on };
}
