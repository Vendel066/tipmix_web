import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const USD_TO_HUF = 360;

export default function Portfolio({ user, onBalanceUpdate }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [sellQuantity, setSellQuantity] = useState('');
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState('');

  // Portfolio betöltése
  const loadPortfolio = useCallback(async () => {
    try {
      const response = await api.get('/investment/portfolio');
      const holdingsData = response.data.holdings || [];
      
      // Árak számként kezelése
      const processedHoldings = holdingsData.map(holding => ({
        ...holding,
        current_price: Number(holding.current_price),
        average_price: Number(holding.average_price),
        quantity: Number(holding.quantity),
        total_invested: Number(holding.total_invested)
      }));
      
      setHoldings(processedHoldings);
      
      // Összesített értékek számítása
      let totalVal = 0;
      let totalInv = 0;
      processedHoldings.forEach(holding => {
        const currentValue = holding.current_price * holding.quantity * USD_TO_HUF;
        totalVal += currentValue;
        totalInv += holding.total_invested;
      });
      
      setTotalValue(totalVal);
      setTotalInvested(totalInv);
    } catch (err) {
      console.error('Portfolio betöltési hiba:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadPortfolio();
      setLoading(false);
    };
    loadData();
    
    // Automatikus frissítés 10 másodpercenként (az árfolyamok változása miatt)
    const interval = setInterval(() => {
      loadPortfolio();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [loadPortfolio]);

  // Eladás
  const handleSell = async () => {
    const numericQuantity = parseFloat(sellQuantity);
    if (!selectedHolding || isNaN(numericQuantity) || numericQuantity <= 0) {
      setError('Adj meg érvényes mennyiséget (nagyobb mint 0)!');
      return;
    }

    if (numericQuantity > selectedHolding.quantity) {
      setError(`Nincs elegendő részvényed. Rendelkezésre álló: ${selectedHolding.quantity}`);
      return;
    }

    setSelling(true);
    setError('');

    try {
      const token = localStorage.getItem('tipmix_token');
      if (!token) {
        setError('Nincs bejelentkezve. Kérlek jelentkezz be újra.');
        setSelling(false);
        return;
      }

      const response = await api.post('/investment/sell', {
        symbol: selectedHolding.symbol,
        quantity: parseFloat(sellQuantity),
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (onBalanceUpdate) {
        await onBalanceUpdate(response.data.newBalance);
      }

      setSelectedHolding(null);
      setSellQuantity('');
      setError('');
      await loadPortfolio(); // Portfolio frissítése
    } catch (err) {
      setError(err?.response?.data?.message || 'Hiba történt az eladás során');
    } finally {
      setSelling(false);
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

  const totalProfit = totalValue - totalInvested;
  const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const isPositive = totalProfit >= 0;

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
          Portfolio Dashboard
        </h2>
        <p style={{ color: 'rgba(226, 232, 240, 0.6)', fontSize: '0.95rem' }}>
          Kövesd nyomon a részvényeid teljesítményét valós időben
        </p>
      </div>

      {/* Összesített statisztikák */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '2.5rem' 
      }}>
        <div style={{
          padding: '2rem',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '1.25rem',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
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
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15), transparent)',
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'rgba(226, 232, 240, 0.6)', 
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>💼</span>
            <span>Portfolio érték</span>
          </div>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#38bdf8',
            lineHeight: '1.2'
          }}>
            {totalValue.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={{
          padding: '2rem',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: '1.25rem',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.15)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(148, 163, 184, 0.1), transparent)',
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ 
            fontSize: '0.875rem', 
            color: 'rgba(226, 232, 240, 0.6)', 
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>💰</span>
            <span>Befektetett összeg</span>
          </div>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: '#ffffff',
            lineHeight: '1.2'
          }}>
            {totalInvested.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={{
          padding: '2rem',
          background: isPositive 
            ? 'rgba(16, 185, 129, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '1.25rem',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = `0 12px 24px ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '120px',
            height: '120px',
            background: isPositive
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.2), transparent)'
              : 'radial-gradient(circle, rgba(239, 68, 68, 0.2), transparent)',
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ 
            fontSize: '0.875rem', 
            color: isPositive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)', 
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '500'
          }}>
            <span>{isPositive ? '📈' : '📉'}</span>
            <span>Összes profit/veszteség</span>
          </div>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '700', 
            color: isPositive ? '#10b981' : '#ef4444',
            lineHeight: '1.2'
          }}>
            {isPositive ? '+' : ''}{totalProfit.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
          </div>
          <div style={{
            marginTop: '0.5rem',
            fontSize: '1rem',
            color: isPositive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)',
            fontWeight: '600'
          }}>
            ({isPositive ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Részvények */}
      {holdings.length === 0 ? (
        <div style={{ 
          padding: '4rem 2rem', 
          textAlign: 'center', 
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '1.25rem',
          color: 'rgba(226, 232, 240, 0.6)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📊</div>
          <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'rgba(226, 232, 240, 0.8)' }}>
            Még nincs részvényed a portfolióban.
          </p>
          <p style={{ fontSize: '0.95rem' }}>Vásárolj részvényeket a Befektetés tab-ban! 🚀</p>
        </div>
      ) : (
        <div>
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
              Részvényeim
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
              {holdings.length} pozíció
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '1.25rem'
          }}>
              {holdings.map((holding) => {
                const currentValue = holding.current_price * holding.quantity * USD_TO_HUF;
                const investedValue = holding.total_invested;
                const profit = currentValue - investedValue;
                const profitPercent = investedValue > 0 ? (profit / investedValue) * 100 : 0;
                const isPositive = profit >= 0;
              const priceChange = ((holding.current_price - holding.average_price) / holding.average_price) * 100;

                return (
                <div
                  key={holding.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: '1.25rem',
                    padding: '1.5rem',
                    transition: 'all 0.3s ease',
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
                >
                  {/* Gradient overlay */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '120px',
                    height: '120px',
                    background: isPositive 
                      ? 'radial-gradient(circle, rgba(16, 185, 129, 0.1), transparent)' 
                      : 'radial-gradient(circle, rgba(239, 68, 68, 0.1), transparent)',
                    borderRadius: '50%',
                    transform: 'translate(30%, -30%)'
                  }} />

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                      {holding.logo_url && (
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '0.75rem',
                          background: 'rgba(30, 41, 59, 0.6)',
                          padding: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(148, 163, 184, 0.1)'
                        }}>
                          <img 
                            src={holding.logo_url} 
                            alt={holding.symbol}
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
                          {holding.symbol}
                        </div>
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: 'rgba(226, 232, 240, 0.6)',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {holding.name}
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
                      {isPositive ? '↑' : '↓'} {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    marginBottom: '1.25rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(226, 232, 240, 0.5)', marginBottom: '0.25rem' }}>
                        Mennyiség
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                        {holding.quantity} db
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(226, 232, 240, 0.5)', marginBottom: '0.25rem' }}>
                        Jelenlegi ár
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#38bdf8' }}>
                      {holding.current_price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(226, 232, 240, 0.5)', marginBottom: '0.25rem' }}>
                        Befektetett
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                      {investedValue.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(226, 232, 240, 0.5)', marginBottom: '0.25rem' }}>
                        Jelenlegi érték
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffffff' }}>
                      {currentValue.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>

                  {/* Profit/Loss */}
                  <div style={{
                    padding: '1rem',
                    background: isPositive 
                      ? 'rgba(16, 185, 129, 0.1)' 
                      : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                    borderRadius: '0.75rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: isPositive ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)',
                      fontWeight: '500'
                    }}>
                      Profit/Veszteség
                    </span>
                    <strong style={{ 
                      fontSize: '1.25rem',
                      color: isPositive ? '#10b981' : '#ef4444',
                      fontWeight: '700'
                    }}>
                      {isPositive ? '+' : ''}{profit.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
                    </strong>
                  </div>

                  {/* Sell Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHolding(holding);
                          setSellQuantity(holding.quantity.toString());
                          setError('');
                        }}
                        style={{
                      width: '100%',
                      padding: '0.875rem',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          border: 'none',
                      borderRadius: '0.75rem',
                          color: '#ffffff',
                          cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                    }}
                  >
                    Eladás →
                      </button>
                </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Eladás modal */}
      {selectedHolding && (
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
                setSelectedHolding(null);
                setSellQuantity('');
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
                {selectedHolding.logo_url && (
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
                      src={selectedHolding.logo_url} 
                      alt={selectedHolding.symbol}
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
                    {selectedHolding.symbol}
                  </h3>
                  <p style={{ 
                    color: 'rgba(226, 232, 240, 0.6)',
                    fontSize: '0.95rem'
                  }}>
                    {selectedHolding.name}
                  </p>
                </div>
              </div>
              <div style={{
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <span style={{ color: 'rgba(226, 232, 240, 0.7)', fontSize: '0.9rem' }}>Rendelkezésre álló</span>
                <span style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  {selectedHolding.quantity} db
                </span>
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
                  {selectedHolding.current_price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
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
                Eladandó mennyiség
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedHolding.quantity}
                value={sellQuantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0 && parseFloat(value) <= selectedHolding.quantity)) {
                    setSellQuantity(value);
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
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
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
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1))',
              border: '1px solid rgba(16, 185, 129, 0.2)',
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
                  Bevétel (HUF)
                </span>
                <strong style={{ 
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#10b981'
                }}>
                  {(() => {
                    const qty = parseFloat(sellQuantity) || 0;
                    return Math.round(selectedHolding.current_price * qty * USD_TO_HUF).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
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
              onClick={handleSell}
              disabled={selling}
              style={{
                width: '100%',
                padding: '1.25rem',
                background: selling 
                  ? 'rgba(239, 68, 68, 0.5)' 
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                borderRadius: '0.75rem',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '1.1rem',
                cursor: selling ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: selling ? 'none' : '0 8px 24px rgba(239, 68, 68, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!selling) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(239, 68, 68, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!selling) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.4)';
                }
              }}
            >
              {selling ? '⏳ Feldolgozás...' : '💰 Eladás megerősítése'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

