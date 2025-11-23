import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

// Token beállítása az alkalmazás indításakor, ha van localStorage-ben
const initialToken = localStorage.getItem('tipmix_token');
if (initialToken) {
  api.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
}

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    // Biztosítjuk, hogy a localStorage-ban is legyen
    localStorage.setItem('tipmix_token', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem('tipmix_token');
  }
}

// Response interceptor - token hibák kezelése
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token lejárt vagy érvénytelen
      const token = localStorage.getItem('tipmix_token');
      if (token) {
        // Token törlése és újratöltés
        localStorage.removeItem('tipmix_token');
        setAuthToken(null);
        // Oldal újratöltése hogy újra bejelentkezzen
        if (window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }
    return Promise.reject(error);
  }
);

