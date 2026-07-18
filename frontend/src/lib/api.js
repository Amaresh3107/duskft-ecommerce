const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export { BACKEND_URL };
export const API = `${BACKEND_URL}/api`;

export function resolveImageUrl(url) {
  if (!url) return url;
  return /^https?:\/\//.test(url) ? url : `${BACKEND_URL}${url}`;
}

export function getAuthHeaders() {
  const token = localStorage.getItem('kb_admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e))).filter(Boolean).join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
}
