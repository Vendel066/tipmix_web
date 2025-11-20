import { useEffect, useMemo, useState } from 'react';

export default function BetCard({ bet, onPlaceBet, disabled }) {
  const [selectionId, setSelectionId] = useState(null);
  const [stake, setStake] = useState(2000);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (bet.outcomes?.length) {
      setSelectionId(bet.outcomes[0].id);
    }
  }, [bet.outcomes]);

  const selectedOutcome = useMemo(
    () => bet.outcomes?.find((outcome) => outcome.id === selectionId) || bet.outcomes?.[0],
    [bet.outcomes, selectionId],
  );

  const formattedPotential = useMemo(() => {
    if (!selectedOutcome) {
      return null;
    }
    const potential = Number(stake || 0) * Number(selectedOutcome.odds || 0);
    return potential
      ? potential.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })
      : null;
  }, [stake, selectedOutcome]);

  const handleSubmit = async () => {
    if (!selectionId) return;
    setLoading(true);
    setMessage('');
    try {
      await onPlaceBet(bet.id, selectionId, Number(stake));
      setMessage('Fogadás leadva ✅');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Nem sikerült leadni a fogadást.';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bet-card">
      <div className="bet-card__badge">
        <span>Nyitott</span>
      </div>
      <div className="bet-card__body">
        <div className="bet-card__info">
          <h3>{bet.title}</h3>
          {bet.description && <p>{bet.description}</p>}
        </div>
        <div className="bet-card__options modern">
          {bet.outcomes?.map((outcome) => (
            <button
              key={outcome.id}
              type="button"
              className={selectionId === outcome.id ? 'active' : ''}
              onClick={() => setSelectionId(outcome.id)}
            >
              <span>{outcome.label}</span>
              <strong>{Number(outcome.odds).toFixed(2)}</strong>
            </button>
          ))}
        </div>
        <div className="bet-card__action modern">
          <div>
            <label>Tét</label>
            <input
              type="number"
              min="100"
              step="100"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
            />
          </div>
          <div className="potential">
            <p className="muted-small">Várható nyeremény</p>
            <strong>{formattedPotential || '—'}</strong>
          </div>
          <button type="button" onClick={handleSubmit} disabled={loading || disabled}>
            {loading ? 'Küldés...' : 'Fogadás'}
          </button>
        </div>
      </div>
      {bet.closes_at && (
        <div className="bet-card__footer">
          <p>Leadási határidő: {new Date(bet.closes_at).toLocaleString()}</p>
        </div>
      )}
      {message && <p className="form-feedback subtle">{message}</p>}
    </div>
  );
}

