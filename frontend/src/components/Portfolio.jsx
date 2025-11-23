import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const USD_TO_HUF = 360;

export default function Portfolio({ user, onBalanceUpdate }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);

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
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '2rem' }}>Portfolio Dashboard</h2>

      {/* Összesített statisztikák */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{
          padding: '1.5rem',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '1rem'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'rgba(226, 232, 240, 0.7)', marginBottom: '0.5rem' }}>
            Portfolio érték
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff' }}>
            {totalValue.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '1rem'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'rgba(226, 232, 240, 0.7)', marginBottom: '0.5rem' }}>
            Befektetett összeg
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ffffff' }}>
            {totalInvested.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '1rem'
        }}>
          <div style={{ fontSize: '0.9rem', color: 'rgba(226, 232, 240, 0.7)', marginBottom: '0.5rem' }}>
            Összes profit/veszteség
          </div>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: isPositive ? '#10b981' : '#ef4444' 
          }}>
            {isPositive ? '+' : ''}{totalProfit.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
            {' '}({isPositive ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Részvények táblázat */}
      {holdings.length === 0 ? (
        <div style={{ 
          padding: '3rem', 
          textAlign: 'center', 
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '1rem',
          color: 'rgba(226, 232, 240, 0.7)' 
        }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Még nincs részvényed a portfolióban.</p>
          <p>Vásárolj részvényeket a Befektetés tab-ban!</p>
        </div>
      ) : (
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Részvényeim</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(15, 23, 42, 0.95)', borderRadius: '0.75rem', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.8)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Szimbólum</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Név</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Mennyiség</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Átlagos ár</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Jelenlegi ár</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Befektetett</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Jelenlegi érték</th>
                <th style={{ padding: '1rem', textAlign: 'right', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Profit/Veszteség</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => {
                const currentValue = holding.current_price * holding.quantity * USD_TO_HUF;
                const investedValue = holding.total_invested;
                const profit = currentValue - investedValue;
                const profitPercent = investedValue > 0 ? (profit / investedValue) * 100 : 0;
                const isPositive = profit >= 0;

                return (
                  <tr key={holding.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>{holding.symbol}</td>
                    <td style={{ padding: '1rem', color: 'rgba(226, 232, 240, 0.7)' }}>{holding.name}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>{holding.quantity} db</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {holding.average_price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {holding.current_price.toLocaleString('hu-HU', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {investedValue.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {currentValue.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: isPositive ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                      {isPositive ? '+' : ''}{profit.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })}
                      {' '}({isPositive ? '+' : ''}{profitPercent.toFixed(2)}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

