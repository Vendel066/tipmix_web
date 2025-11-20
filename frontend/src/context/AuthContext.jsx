import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { api, setAuthToken } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('tipmix_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/profile');
      setUser(data.user);
    } catch (err) {
      setToken(null);
      localStorage.removeItem('tipmix_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      loadProfile();
    } else {
      setAuthToken(null);
    }
  }, [token, loadProfile]);

  const handleAuth = useCallback(async (endpoint, payload) => {
    const { data } = await api.post(`/auth/${endpoint}`, payload);
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('tipmix_token', data.token);
    setAuthToken(data.token);
    return data.user;
  }, []);

  const login = useCallback((payload) => handleAuth('login', payload), [handleAuth]);
  const register = useCallback((payload) => handleAuth('register', payload), [handleAuth]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('tipmix_token');
    setAuthToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshProfile: loadProfile,
    }),
    [user, token, loading, login, register, logout, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

