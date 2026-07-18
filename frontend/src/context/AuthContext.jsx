import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { API, formatApiErrorDetail } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }, [token]);

  const persistSession = (data) => {
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, accountType: 'customer' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
    // The backend's customer document has no `role` field (only staff/admin
    // accounts in `users` do) — attach it explicitly so role checks in the
    // Portal work correctly.
    data.user = { ...data.user, role: 'customer' };
    persistSession(data);
    return data.user;
  }, []);

  // Temporary: staff/admin login for the throwaway /admin/login page.
  // Uses the same session storage as customer login (auth_token/auth_user) —
  // logging in as staff replaces any active customer session in this browser.
  // This is fine for solo testing but is NOT how Phase 5's real Admin Panel
  // auth should work (separate session key + refresh handling).
  const adminLogin = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, accountType: 'staff' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
    persistSession(data);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(formatApiErrorDetail(data.detail));
    data.user = { ...data.user, role: 'customer' };
    persistSession(data);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }, []);

  // Patches the locally-cached user object (e.g. after a Profile edit) without
  // requiring a fresh login, so header/greeting text updates immediately.
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('auth_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, adminLogin, register, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function customerAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
