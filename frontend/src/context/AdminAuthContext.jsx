import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API, formatApiErrorDetail } from '../lib/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('admin_token', token);
    else localStorage.removeItem('admin_token');
  }, [token]);

  // Validate the cached session against the server once on load (covers
  // expired tokens, revoked accounts, or a role that changed since login).
  // /auth/me always returns an authoritative `role`, unlike the login
  // response for customer accounts.
  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data.role !== 'admin' && data.role !== 'staff') throw new Error('not staff');
        setUser(data);
        localStorage.setItem('admin_user', JSON.stringify(data));
      })
      .catch(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
      })
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, accountType: 'staff' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
    if (data.user.role !== 'admin' && data.user.role !== 'staff') {
      throw new Error('That account does not have admin/staff access.');
    }
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ token, user, login, logout, ready, isAuthenticated: !!token, isAdmin: user?.role === 'admin' }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

export function adminAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
