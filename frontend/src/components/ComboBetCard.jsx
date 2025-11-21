import { useState, useMemo } from 'react';
import { api } from '../services/api';

export default function ComboBetCard({ bets, onSuccess }) {
  const [selections, setSelections] = useState({});
  const [stake, setStake] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleToggleSelection = (betId, outcomeId, outcomeLabel, odds) => {
    setSelections((prev) => {
      const key = `${betId}-${outcomeId}`;
      if (prev[key]) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: { betId, outcomeId, label: outcomeLabel, odds: Number(odds) },
      };
    });
    setError('');
  };

  const totalOdds = useMemo(() => {
    const values = Object.values(selections);
    if (values.length < 2) return 0;
    return values.reduce((acc, sel) => acc * sel.odds, 1) * 1.15;
  }, [selections]);

  const potentialWin = useMemo(() => {
    if (totalOdds === 0) return 0;
    return Number((stake * totalOdds).toFixed(2));
  }, [stake, totalOdds]);

  const formattedPotential = useMemo(() => {
    if (!potentialWin) return null;
    return potentialWin.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 });
  }, [potentialWin]);

  const handleSubmit = async () => {
    const selectionArray = Object.values(selections);
    if (selectionArray.length < 2) {
      setError('Legalább 2 fogadást kell kiválasztani');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.post('/combos', {
        selections: selectionArray.map((s) => ({ bet_id: s.betId, outcome_id: s.outcomeId })),
        stake: Number(stake),
      });
      onSuccess?.('Kötéses fogadás leadva!');
      setSelections({});
      setStake(2000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="combo-bet-card">
      <div className="combo-bet-header">
        <h3>Kötéses fogadás</h3>
        <p className="muted-small">Válassz ki legalább 2 fogadást és add le együtt (15% bónusz szorzó)</p>
      </div>

      <div className="combo-bets-grid">
        {bets.map((bet) => (
          <div key={bet.id} className="combo-bet-item">
            <div className="combo-bet-title">
              <strong>{bet.title}</strong>
            </div>
            <div className="combo-bet-outcomes">
              {bet.outcomes?.map((outcome) => {
                const key = `${bet.id}-${outcome.id}`;
                const isSelected = Boolean(selections[key]);
                return (
                  <button
                    key={outcome.id}
                    type="button"
                    className={isSelected ? 'active' : ''}
                    onClick={() => handleToggleSelection(bet.id, outcome.id, outcome.label, outcome.odds)}
                  >
                    <span>{outcome.label}</span>
                    <strong>{Number(outcome.odds).toFixed(2)}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(selections).length >= 2 && (
        <div className="combo-summary">
          <div className="combo-summary-row">
            <span>Kiválasztott fogadások:</span>
            <strong>{Object.keys(selections).length}</strong>
          </div>
          <div className="combo-summary-row">
            <span>Összesített szorzó (15% bónusszal):</span>
            <strong>{totalOdds.toFixed(2)}</strong>
          </div>
        </div>
      )}

      <div className="combo-bet-action">
        <div>
          <label>Tét</label>
          <input
            type="number"
            min="100"
            step="100"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
        </div>
        {Object.keys(selections).length >= 2 && (
          <div className="potential">
            <p className="muted-small">Várható nyeremény</p>
            <strong>{formattedPotential || '—'}</strong>
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || Object.keys(selections).length < 2}
        >
          {loading ? 'Küldés...' : 'Kötés leadása'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

