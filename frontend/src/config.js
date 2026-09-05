/**
 * Centralized API and WebSocket configuration for MandiFlow.
 * - In local dev (import.meta.env.DEV === true): defaults to http://localhost:8000
 * - In production: defaults to "" (same-origin relative paths) unless VITE_API_URL is explicitly set
 */
const defaultBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? defaultBaseUrl).replace(/\/+$/, '');

export const getWsUrl = (path = '/ws/queue') => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL && (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://'))) {
    const wsProto = API_BASE_URL.startsWith('https://') ? 'wss:' : 'ws:';
    const host = API_BASE_URL.replace(/^https?:\/\//, '');
    return `${wsProto}//${host}${cleanPath}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
};
