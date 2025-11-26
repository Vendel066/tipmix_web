import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export default function TransferModal({ user, onClose, onSuccess }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSelectedUser(null);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const trimmedQuery = searchQuery.trim();
        const response = await api.get(`/payments/users/search?q=${encodeURIComponent(trimmedQuery)}`);
        const users = response.data.users || [];
        console.log(`Search for "${trimmedQuery}": found ${users.length} users`, users);
        setSearchResults(users);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setError('Hiba történt a keresés során');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    // Close results when clicking outside
    const handleClickOutside = (event) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target)) {
        // Don't close if clicking on the input
        if (!event.target.closest('.user-search-input')) {
          setSearchResults([]);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setSearchResults([]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!selectedUser) {
      setError('Válassz ki egy felhasználót');
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Érvénytelen összeg');
      return;
    }

    if (numericAmount > user.balance) {
      setError('Nincs elegendő egyenleg');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await api.post('/payments/transfer', {
        recipientId: selectedUser.id,
        amount: numericAmount,
      });
      onSuccess?.(response.data.message, response.data.newBalance);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Hiba történt a pénz küldése során');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Pénz küldése</h2>
          <button type="button" className="ghost" onClick={onClose}>
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Felhasználó keresése
            <div style={{ position: 'relative' }} ref={resultsRef}>
              <input
                type="text"
                className="user-search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedUser(null);
                  setError(''); // Clear error when searching
                }}
                placeholder="Keresés felhasználónév vagy email alapján (min. 2 karakter)..."
                autoComplete="off"
              />
              {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                <small style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  Írjon be legalább 2 karaktert a kereséshez
                </small>
              )}
              {searching && (
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                  <div className="loader" style={{ width: '16px', height: '16px' }} />
                </div>
              )}
              {!searching && searchQuery.trim().length >= 2 && !selectedUser && (
                <div className="user-search-results">
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="user-search-result-item"
                        onClick={() => handleSelectUser(result)}
                      >
                        <div>
                          <strong>{result.username}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                            {result.email}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="user-search-result-item" style={{ cursor: 'default', opacity: 0.7, padding: '1rem', textAlign: 'center' }}>
                      <div>Nincs találat a "{searchQuery.trim()}" keresésre</div>
                      <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                        Próbálja meg felhasználónévvel vagy email címmel keresni
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </label>

          {selectedUser && (
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <strong>Kiválasztott felhasználó:</strong> {selectedUser.username} ({selectedUser.email})
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setSearchQuery('');
                }}
                style={{ 
                  marginLeft: '0.5rem', 
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#ef4444',
                  cursor: 'pointer'
                }}
              >
                Törlés
              </button>
            </div>
          )}

          <label>
            Összeg (HUF)
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty string or positive integers
                if (value === '' || /^\d+$/.test(value)) {
                  setAmount(value);
                  setError(''); // Clear error when user types
                }
              }}
              placeholder={selectedUser ? "Adja meg az összeget" : "Előbb válasszon felhasználót"}
              required
              disabled={!selectedUser}
              style={{ 
                opacity: selectedUser ? 1 : 0.6,
                cursor: selectedUser ? 'text' : 'not-allowed'
              }}
            />
            {!selectedUser && (
              <small style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                Előbb válasszon ki egy felhasználót a fenti keresőmezőből
              </small>
            )}
          </label>

          {user && (
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(15, 23, 42, 0.5)', 
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Jelenlegi egyenleg:</span>
                <strong>{user.balance.toLocaleString('hu-HU')} HUF</strong>
              </div>
              {amount && Number(amount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                  <span>Maradék egyenleg:</span>
                  <strong style={{ color: Number(amount) > user.balance ? '#ef4444' : '#10b981' }}>
                    {(user.balance - Number(amount)).toLocaleString('hu-HU')} HUF
                  </strong>
                </div>
              )}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="ghost" onClick={onClose} disabled={loading}>
              Mégse
            </button>
            <button type="submit" disabled={loading || !selectedUser || !amount || Number(amount) <= 0}>
              {loading ? 'Küldés...' : 'Küldés'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

