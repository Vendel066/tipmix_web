import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const defaultForm = {
  username: '',
  email: '',
  password: '',
};

export default function AuthPanel() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMode = (nextMode) => {
    setMode(nextMode);
    setForm(defaultForm);
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
    } catch (err) {
      console.error('Auth error:', err);
      const message = err?.response?.data?.message || err?.message || 'Hiba történt, próbáld újra.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-panel">
      <div className="auth-card">
        <div className="auth-toggle">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => toggleMode('login')}
          >
            Bejelentkezés
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => toggleMode('register')}
          >
            Regisztráció
          </button>
        </div>
        <form onSubmit={onSubmit}>
          {mode === 'register' && (
            <label>
              Felhasználónév
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={onChange}
                placeholder="pl. tipmixFan"
                required
              />
            </label>
          )}
          <label>
            E-mail cím
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              placeholder="te@pelda.com"
              required
            />
          </label>
          <label>
            Jelszó
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              placeholder="Minimum 6 karakter"
              minLength={6}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Küldés...' : mode === 'login' ? 'Belépés' : 'Fiók létrehozása'}
          </button>
        </form>
      </div>
      <div className="auth-hero-copy">
        <p className="eyebrow">Tipmix Pro</p>
        <h1>Egy helyen a fogadások, statok és admin eszközök</h1>
        <p>
          Hozz létre eseményeket, hívd meg a barátaidat, értékeld a fogadásokat és kövesd, hogyan
          változik az egyenleged valós időben.
        </p>
      </div>
    </div>
  );
}

