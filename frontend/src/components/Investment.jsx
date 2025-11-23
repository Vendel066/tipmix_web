import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

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
  const loadStocks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/investment/stocks', {
        params: searchQuery ? { search: searchQuery } : {}
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
  }, [searchQuery]);

  useEffect(() => {
    loadStocks();

    // Árfolyamok frissítése 10 másodpercenként (csak ha nincs keresés)
    const interval = setInterval(() => {
      if (!searchQuery) {
        loadStocks();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [loadStocks, searchQuery]);

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
      const response = await api.post('/investment/buy', {
        symbol: selectedStock.symbol,
        quantity: parseFloat(quantity),
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loader" />
        <p>Betöltés...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '2rem' }}>Befektetés</h2>

      {error && (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '0.5rem',
          color: '#ef4444',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Kereső mező */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Keresés részvény szimbólum szerint (pl: AAPL, MSFT)..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
          }}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.5rem',
            color: '#ffffff',
            fontSize: '1rem'
          }}
        />
        {!searchQuery && (
          <p style={{ marginTop: '0.5rem', color: 'rgba(226, 232, 240, 0.6)', fontSize: '0.875rem' }}>
            Alapból a TOP 10 részvény látható. Írj be egy szimbólumot a kereséshez (pl: AAPL, MSFT, TSLA).
          </p>
        )}
      </div>

      {/* Részvények táblázat */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Részvények ({stocks.length})</h3>
        {stocks.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(226, 232, 240, 0.7)' }}>
            Nincsenek elérhető részvények.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(15, 23, 42, 0.95)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.8)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Szimbólum</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Név</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Ár (USD)</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Változás (%)</th>
                <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Művelet</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => {
                const changePercent = stock.change_percent || 0;
                const isPositive = changePercent >= 0;

                return (
                  <tr key={stock.symbol} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>{stock.symbol}</td>
                    <td style={{ padding: '1rem', color: 'rgba(226, 232, 240, 0.7)' }}>{stock.name}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {stock.symbol === 'BTC' 
                        ? stock.price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                        : stock.price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
                      }
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: isPositive ? '#10b981' : '#ef4444' }}>
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedStock(stock)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                          border: 'none',
                          borderRadius: '0.5rem',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        Vásárlás
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => {
                setSelectedStock(null);
                setError('');
              }}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                color: '#ef4444',
                cursor: 'pointer'
              }}
            >
              ×
            </button>

            <h3 style={{ marginBottom: '1rem' }}>Részvény vásárlás</h3>
            <p style={{ marginBottom: '1rem', color: 'rgba(226, 232, 240, 0.7)' }}>
              <strong>{selectedStock.name} ({selectedStock.symbol})</strong>
            </p>
            <p style={{ marginBottom: '1.5rem', color: 'rgba(226, 232, 240, 0.7)' }}>
              Ár: {selectedStock.price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Mennyiség</label>
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
                  padding: '0.75rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#ffffff'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Összeg (HUF):</span>
                <strong>
                  {(() => {
                    const qty = parseFloat(quantity) || 0;
                    return Math.round(selectedStock.price * qty * USD_TO_HUF).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
                  })()}
                </strong>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '0.75rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.5rem',
                color: '#ef4444',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleBuy}
              disabled={buying}
              style={{
                width: '100%',
                padding: '1rem',
                background: buying ? 'rgba(59, 130, 246, 0.5)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#ffffff',
                fontWeight: '600',
                cursor: buying ? 'not-allowed' : 'pointer'
              }}
            >
              {buying ? 'Feldolgozás...' : 'Vásárlás'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

