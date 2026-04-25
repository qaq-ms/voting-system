import { useState, useEffect, useCallback, useMemo } from 'react';

export function useEventSource(url, onEvent, options = {}) {
  const { autoConnect = true, reconnectInterval = 3000, maxRetries = 10 } = options;
  const esRef = useState(null);
  const retryRef = useState({ count: 0, timer: null });
  const onEventRef = useState(onEvent);
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!autoConnect) return;

    let es = null;
    let reconnectTimer = null;
    let retryCount = 0;

    const connect = () => {
      if (es) return;
      
      console.log('[SSE] Connecting to', url);
      setStatus('connecting');
      
      try {
        es = new EventSource(url);
        
        es.addEventListener('open', () => {
          console.log('[SSE] Connected successfully');
          setStatus('connected');
          retryCount = 0;
        });

        es.addEventListener('poll:created', (e) => {
          console.log('[SSE] Received poll:created', e.data);
          const data = JSON.parse(e.data);
          onEventRef.current?.('poll:created', data);
        });

        es.addEventListener('poll:status_changed', (e) => {
          console.log('[SSE] Received poll:status_changed', e.data);
          const data = JSON.parse(e.data);
          onEventRef.current?.('poll:status_changed', data);
        });

        es.addEventListener('user:deleted', (e) => {
          console.log('[SSE] Received user:deleted', e.data);
          const data = JSON.parse(e.data);
          onEventRef.current?.('user:deleted', data);
        });

        es.addEventListener('error', (err) => {
          console.error('[SSE] Error event:', err);
          setStatus('error');
          es.close();
          es = null;

          if (retryCount < maxRetries && reconnectInterval > 0) {
            retryCount++;
            console.log(`[SSE] Retry ${retryCount}/${maxRetries} in ${reconnectInterval}ms`);
            reconnectTimer = setTimeout(connect, reconnectInterval);
          } else {
            console.error('[SSE] Max retries reached');
            onEventRef.current?.('sse:max_retries', { retryCount });
          }
        });

        es.onmessage = (e) => {
          console.log('[SSE] onmessage:', e.data);
          const data = JSON.parse(e.data);
          onEventRef.current?.('message', data);
        };
      } catch (err) {
        console.error('[SSE] Failed to create:', err);
        setStatus('error');
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) {
        console.log('[SSE] Closing connection');
        es.close();
        es = null;
      }
      setStatus('disconnected');
    };
  }, [url, autoConnect, reconnectInterval, maxRetries]);

  return { status };
}
