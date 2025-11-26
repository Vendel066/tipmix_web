import { useState } from 'react';
import { api } from '../services/api';
import StockSearch from './StockSearch';
import '../App.css';

const USD_TO_HUF = 360;

export default function Investment({ user, onBalanceUpdate }) {
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  // Vásárlás
  const handleBuy = async () => {
    const numericQuantity = parseFloat(quantity);
    if (!selectedStock || isNaN(numericQuantity) || numericQuantity <= 0) {
      setError('Válassz részvényt és adj meg érvényes mennyiséget (nagyobb mint 0)!');
      return;
    }

    setBuying(true);
    setError('');

    try {
      // Ellenőrizzük, hogy van-e token
      const token = localStorage.getItem('tipmix_token');
      if (!token) {
        setError('Nincs bejelentkezve. Kérlek jelentkezz be újra.');
        setBuying(false);
        return;
      }

      const response = await api.post('/investment/buy', {
        symbol: selectedStock.symbol,
        quantity: parseFloat(quantity),
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (onBalanceUpdate) {
        await onBalanceUpdate(response.data.newBalance);
      }

      setSelectedStock(null);
      setQuantity('1');
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Hiba történt a vásárlás során');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ 
          marginBottom: '0.5rem',
          fontSize: '2rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Befektetés
        </h2>
        <p style={{ color: 'rgba(226, 232, 240, 0.6)', fontSize: '0.95rem' }}>
          Fedezd fel és vásárolj részvényeket valós idejű árfolyamokkal
        </p>
      </div>

      {/* Részvény kereső komponens */}
      <StockSearch onStockSelect={setSelectedStock} />

      {/* Vásárlás modal */}
      {selectedStock && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '1.5rem',
            padding: '2.5rem',
            maxWidth: '500px',
            width: '100%',
            position: 'relative',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'slideUp 0.3s ease'
          }}>
            <button
              type="button"
              onClick={() => {
                setSelectedStock(null);
                setError('');
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }}
            >
              ×
            </button>

            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                {selectedStock.logo_url && (
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '1rem',
                    background: 'rgba(30, 41, 59, 0.6)',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(148, 163, 184, 0.1)'
                  }}>
                    <img 
                      src={selectedStock.logo_url} 
                      alt={selectedStock.symbol}
                      onError={(e) => e.target.style.display = 'none'}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )}
                <div>
                  <h3 style={{ 
                    marginBottom: '0.25rem',
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#ffffff'
                  }}>
                    {selectedStock.symbol}
                  </h3>
                  <p style={{ 
                    color: 'rgba(226, 232, 240, 0.6)',
                    fontSize: '0.95rem'
                  }}>
                    {selectedStock.name}
                  </p>
                </div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ color: 'rgba(226, 232, 240, 0.7)', fontSize: '0.9rem' }}>Jelenlegi ár</span>
                <span style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  color: '#38bdf8'
                }}>
                  {selectedStock.price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.75rem',
                color: 'rgba(226, 232, 240, 0.8)',
                fontWeight: '500'
              }}>
                Mennyiség
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setQuantity(value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '2px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '0.75rem',
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(56, 189, 248, 0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(56, 189, 248, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '1.25rem', 
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(99, 102, 241, 0.1))',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              borderRadius: '0.75rem'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ 
                  color: 'rgba(226, 232, 240, 0.7)',
                  fontSize: '0.95rem'
                }}>
                  Összeg (HUF)
                </span>
                <strong style={{ 
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#38bdf8'
                }}>
                  {(() => {
                    const qty = parseFloat(quantity) || 0;
                    return Math.round(selectedStock.price * qty * USD_TO_HUF).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
                  })()}
                </strong>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.75rem',
                color: '#ef4444',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleBuy}
              disabled={buying}
              style={{
                width: '100%',
                padding: '1.25rem',
                background: buying 
                  ? 'rgba(59, 130, 246, 0.5)' 
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: '0.75rem',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '1.1rem',
                cursor: buying ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: buying ? 'none' : '0 8px 24px rgba(59, 130, 246, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!buying) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!buying) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)';
                }
              }}
            >
              {buying ? '⏳ Feldolgozás...' : '✅ Vásárlás megerősítése'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

