import { useState, useCallback } from 'react';

const ToastContainer = ({ toasts, onRemove }) => {
  if (!toasts?.length) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : 'ℹ'}
            </span>
            <div className="toast-text">
              <div className="toast-title">{toast.title}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
          </div>
          <button className="toast-close" onClick={() => onRemove(toast.id)}>×</button>
          {toast.autoClose && (
            <div
              className="toast-progress"
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ title, message, type = 'info', duration = 4000, autoClose = true }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type, duration, autoClose }]);
    if (autoClose && duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((title, message, duration) => {
    return addToast({ title, message, type: 'success', duration });
  }, [addToast]);

  const error = useCallback((title, message, duration) => {
    return addToast({ title, message, type: 'error', duration: duration || 6000 });
  }, [addToast]);

  const info = useCallback((title, message, duration) => {
    return addToast({ title, message, type: 'info', duration });
  }, [addToast]);

  return { toasts, addToast, removeToast, success, error, info };
}

export default ToastContainer;
