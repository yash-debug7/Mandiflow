/**
 * Centralized API and WebSocket configuration for MandiFlow.
 * Used across all frontend components for two-project deployment.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000'
).replace(/\/+$/, '');

export const getWsUrl = (path = '/ws/queue') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    const wsProto = API_BASE_URL.startsWith('https://') ? 'wss:' : 'ws:';
    const host = API_BASE_URL.replace(/^https?:\/\//, '');
    return `${wsProto}//${host}${cleanPath}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
};
