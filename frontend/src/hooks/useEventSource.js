import { useEffect, useRef, useCallback, useState } from 'react';

export function useEventSource(url, onEvent, options = {}) {
  const { autoConnect = true, reconnectInterval = 3000, maxRetries = 10 } = options;
  const eventSourceRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const retryCountRef = useRef(0);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    try {
      setStatus('connecting');
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener('open', () => {
        console.log('[SSE] Connected');
        setStatus('connected');
        retryCountRef.current = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      });

      es.addEventListener('poll:created', (e) => {
        const data = JSON.parse(e.data);
        onEventRef.current?.('poll:created', data);
      });

      es.addEventListener('poll:status_changed', (e) => {
        const data = JSON.parse(e.data);
        onEventRef.current?.('poll:status_changed', data);
      });

      es.addEventListener('error', (err) => {
        console.error('[SSE] Connection error:', err);
        setStatus('disconnected');
        es.close();
        eventSourceRef.current = null;

        if (retryCountRef.current < maxRetries && reconnectInterval > 0) {
          retryCountRef.current++;
          console.log(`[SSE] Retry ${retryCountRef.current}/${maxRetries} in ${reconnectInterval}ms`);
          reconnectTimerRef.current = setTimeout(connect, reconnectInterval);
        } else if (retryCountRef.current >= maxRetries) {
          console.error('[SSE] Max retries reached');
          onEventRef.current?.('sse:max_retries', {
            message: '实时同步连接失败次数过多，将使用定时轮询同步',
            retryCount: retryCountRef.current
          });
        }
      });

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        onEventRef.current?.('message', data);
      };
    } catch (err) {
      console.error('[SSE] Failed to create connection:', err);
      setStatus('error');
    }
  }, [url, reconnectInterval, maxRetries]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { connect, disconnect, status };
}
