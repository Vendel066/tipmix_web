import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../services/api';

export default function StockSearch({ onStockSelect }) {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [error, setError] = useState('');

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
    if (!localSearchQuery) {
      setSearchQuery('');
      return;
    }

    const timeoutId = setTimeout(() => {
      setSearchQuery(localSearchQuery);
      loadStocks(localSearchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localSearchQuery, loadStocks]);

  const handleStockClick = useCallback((stock) => {
    if (onStockSelect) {
      onStockSelect(stock);
    }
  }, [onStockSelect]);

  const stockCards = useMemo(() => {
    if (loading && stocks.length === 0) {
      return null;
    }

    if (stocks.length === 0) {
      return (
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
      );
    }

    return (
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
              onClick={() => handleStockClick(stock)}
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
                    handleStockClick(stock);
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
    );
  }, [stocks, loading, handleStockClick]);

  return (
    <div>
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
            placeholder="Keresés részvény szimbólum szerint (pl: AAPL, MSFT, TSLA, RBLX)..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
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
            }}
          />
          {loading && localSearchQuery && (
            <span style={{
              position: 'absolute',
              right: '1rem',
              fontSize: '0.875rem',
              color: 'rgba(226, 232, 240, 0.5)',
              animation: 'spin 1s linear infinite'
            }}>
              ⏳
            </span>
          )}
        </div>
        {!localSearchQuery && (
          <p style={{ marginTop: '0.75rem', color: 'rgba(226, 232, 240, 0.5)', fontSize: '0.875rem', paddingLeft: '0.25rem' }}>
            💡 Alapból a TOP 10 részvény látható. Írj be egy szimbólumot a kereséshez.
          </p>
        )}
        {localSearchQuery && (
          <p style={{ marginTop: '0.75rem', color: 'rgba(226, 232, 240, 0.6)', fontSize: '0.875rem', paddingLeft: '0.25rem' }}>
            📊 Keresés: <strong>{localSearchQuery}</strong> • {loading ? 'Betöltés...' : `${stocks.length} találat`}
          </p>
        )}
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
            {loading && stocks.length === 0 ? 'Betöltés...' : `${stocks.length} részvény`}
          </div>
        </div>
        {loading && stocks.length === 0 ? (
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
            </div>
            <p style={{ 
              color: 'rgba(226, 232, 240, 0.8)',
              fontSize: '1rem',
              margin: 0,
            }}>Részvények betöltése...</p>
          </div>
        ) : (
          stockCards
        )}
      </div>
    </div>
  );
}

