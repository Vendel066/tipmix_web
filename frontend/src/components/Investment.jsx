import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import '../App.css';

const USD_TO_HUF = 360;

export default function Investment({ user, onBalanceUpdate }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Részvények betöltése
  const loadStocks = useCallback(async (search = '') => {
    try {
      setLoading(true);
      const response = await api.get('/investment/stocks', {
        params: search ? { search: search } : {}
      });
      const stocksData = response.data.stocks || [];
      // Árak számként kezelése
      const processedStocks = stocksData.map(stock => ({
        ...stock,
        price: Number(stock.price),
        change_percent: Number(stock.change_percent || 0)
      }));
      setStocks(processedStocks);
      setError('');
    } catch (err) {
      console.error('Részvények betöltési hiba:', err);
      setError('Nem sikerült betölteni a részvényeket');
    } finally {
      setLoading(false);
    }
  }, []);

  // Kezdeti betöltés és automatikus frissítés (csak ha nincs keresés)
  useEffect(() => {
    if (!searchQuery) {
      loadStocks();
      
      // Árfolyamok frissítése 10 másodpercenként
      const interval = setInterval(() => {
        loadStocks();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [searchQuery, loadStocks]);

  // Keresés debounce - 500ms késleltetéssel
  useEffect(() => {
    if (!searchQuery) {
      return;
    }

    const timeoutId = setTimeout(() => {
      loadStocks(searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, loadStocks]);

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

  if (loading) {
    return (
      <div style={{ 
        padding: '4rem 2rem', 
        textAlign: 'center',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem'
      }}>
        <div style={{
          position: 'relative',
          width: '64px',
          height: '64px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '4px solid rgba(148, 163, 184, 0.2)',
            borderTopColor: '#38bdf8',
            borderRightColor: '#6366f1',
            animation: 'spin 1s linear infinite',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.2), transparent)',
            animation: 'pulse 2s ease-in-out infinite'
          }} />
        </div>
        <p style={{ 
          color: 'rgba(226, 232, 240, 0.8)',
          fontSize: '1rem',
          margin: 0,
          animation: 'fadeIn 0.5s ease-in'
        }}>Részvények betöltése...</p>
      </div>
    );
  }

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

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.75rem',
          color: '#ef4444',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Kereső mező */}
      <div style={{ 
        marginBottom: '2rem',
        position: 'relative'
      }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{
            position: 'absolute',
            left: '1rem',
            fontSize: '1.25rem',
            color: 'rgba(226, 232, 240, 0.5)'
          }}>🔍</span>
          <input
            type="text"
            placeholder="Keresés részvény szimbólum szerint (pl: AAPL, MSFT, TSLA)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '1rem 1rem 1rem 3rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '2px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '1rem',
              color: '#ffffff',
              fontSize: '1rem',
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
              if (e.target.value.trim()) {
                loadStocks(e.target.value.trim());
              }
            }}
          />
        </div>
        {!searchQuery && (
          <p style={{ marginTop: '0.75rem', color: 'rgba(226, 232, 240, 0.5)', fontSize: '0.875rem', paddingLeft: '0.25rem' }}>
            💡 Alapból a TOP 10 részvény látható. Írj be egy szimbólumot a kereséshez.
          </p>
        )}
        {searchQuery && (
          <p style={{ marginTop: '0.75rem', color: 'rgba(226, 232, 240, 0.6)', fontSize: '0.875rem', paddingLeft: '0.25rem' }}>
            📊 Keresés: <strong>{searchQuery}</strong> • {stocks.length} találat
          </p>
        )}
      </div>

      {/* Részvények grid */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600',
            color: '#ffffff'
          }}>
            Részvények
          </h3>
          <div style={{
            padding: '0.5rem 1rem',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '999px',
            fontSize: '0.875rem',
            color: '#38bdf8',
            fontWeight: '500'
          }}>
            {stocks.length} részvény
          </div>
        </div>
        {stocks.length === 0 ? (
          <div style={{ 
            padding: '4rem 2rem', 
            textAlign: 'center', 
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '1rem',
            color: 'rgba(226, 232, 240, 0.6)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
            <p style={{ fontSize: '1.1rem' }}>Nincsenek elérhető részvények.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem'
          }}>
            {stocks.map((stock) => {
              const changePercent = stock.change_percent || 0;
              const isPositive = changePercent >= 0;

              return (
                <div
                  key={stock.symbol}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => setSelectedStock(stock)}
                >
                  {/* Gradient overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '100px',
                    height: '100px',
                    background: isPositive 
                      ? 'radial-gradient(circle, rgba(16, 185, 129, 0.1), transparent)' 
                      : 'radial-gradient(circle, rgba(239, 68, 68, 0.1), transparent)',
                    borderRadius: '50%',
                    transform: 'translate(30%, -30%)'
                  }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      {stock.logo_url && (
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '0.75rem',
                          background: 'rgba(30, 41, 59, 0.6)',
                          padding: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                          <img 
                            src={stock.logo_url} 
                            alt={stock.symbol}
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
                        <div style={{ 
                          fontSize: '1.25rem', 
                          fontWeight: '700',
                          color: '#ffffff',
                          marginBottom: '0.25rem'
                        }}>
                          {stock.symbol}
                        </div>
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: 'rgba(226, 232, 240, 0.6)',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {stock.name}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      background: isPositive 
                        ? 'rgba(16, 185, 129, 0.15)' 
                        : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: isPositive ? '#10b981' : '#ef4444',
                      whiteSpace: 'nowrap'
                    }}>
                      {isPositive ? '↑' : '↓'} {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(148, 163, 184, 0.1)'
                  }}>
                    <div>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'rgba(226, 232, 240, 0.5)',
                        marginBottom: '0.25rem'
                      }}>
                        Jelenlegi ár
                      </div>
                      <div style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: '700',
                        color: '#ffffff'
                      }}>
                        {stock.symbol.includes('BTC') || stock.symbol.includes('USD')
                          ? stock.price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                          : stock.price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
                        }
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStock(stock);
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        border: 'none',
                        borderRadius: '0.75rem',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                      }}
                    >
                      Vásárlás →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

