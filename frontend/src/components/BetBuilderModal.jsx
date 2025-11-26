import { useState } from 'react';

const defaultOutcome = () => ({ label: '', odds: 1.8 });
const defaultDetailBet = () => ({
  title: '',
  description: '',
  closesAt: '',
  optionCount: 2,
  outcomes: [defaultOutcome(), defaultOutcome(), defaultOutcome()],
  minimum_bet: 100,
});

export default function BetBuilderModal({ open, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [optionCount, setOptionCount] = useState(2);
  const [outcomes, setOutcomes] = useState(() => [defaultOutcome(), defaultOutcome(), defaultOutcome()]);
  const [minimumBet, setMinimumBet] = useState(100);
  const [showDetailBets, setShowDetailBets] = useState(false);
  const [detailBets, setDetailBets] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const visibleOutcomes = outcomes.slice(0, optionCount);

  const updateOutcome = (index, key, value) => {
    setOutcomes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setClosesAt('');
    setOptionCount(2);
    setOutcomes([defaultOutcome(), defaultOutcome(), defaultOutcome()]);
    setMinimumBet(100);
    setShowDetailBets(false);
    setDetailBets([]);
  };

  const addDetailBet = () => {
    setDetailBets([...detailBets, defaultDetailBet()]);
  };

  const removeDetailBet = (index) => {
    setDetailBets(detailBets.filter((_, i) => i !== index));
  };

  const updateDetailBet = (index, key, value) => {
    setDetailBets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updateDetailBetOutcome = (detailIndex, outcomeIndex, key, value) => {
    setDetailBets((prev) => {
      const next = [...prev];
      const outcomes = [...next[detailIndex].outcomes];
      outcomes[outcomeIndex] = { ...outcomes[outcomeIndex], [key]: value };
      next[detailIndex] = { ...next[detailIndex], outcomes };
      return next;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const detailBetsData = detailBets.map((db) => ({
        title: db.title,
        description: db.description,
        closes_at: db.closesAt || null,
        minimum_bet: Number(db.minimum_bet) || 100,
        outcomes: db.outcomes.slice(0, db.optionCount).map((outcome) => ({
          label: outcome.label,
          odds: Number(outcome.odds),
        })),
      }));

      await onSave({
        title,
        description,
        closes_at: closesAt || null,
        minimum_bet: Number(minimumBet) || 100,
        outcomes: visibleOutcomes.map((outcome) => ({
          label: outcome.label,
          odds: Number(outcome.odds),
        })),
        detail_bets: detailBetsData.length > 0 ? detailBetsData : undefined,
      });
      resetForm();
      onClose();
    } catch (err) {
      const message = err?.response?.data?.message || 'Nem sikerült létrehozni a fogadást.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <header>
          <div>
            <p className="eyebrow">Új fogadás</p>
            <h3>Adj meg részleteket</h3>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            bezárás
          </button>
        </header>
        <form onSubmit={handleSave} className="modal-form">
          <label>
            Név
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Leírás
            <textarea value={description} rows={3} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            Határidő
            <input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} />
          </label>
          <label>
            Minimum tét (Ft)
            <input
              type="number"
              min="0"
              step="100"
              value={minimumBet}
              onChange={(event) => setMinimumBet(event.target.value)}
            />
          </label>
          <div className="option-toggle">
            <p>Részlet fogadások hozzáadása</p>
            <button
              type="button"
              className={showDetailBets ? 'active' : ''}
              onClick={() => setShowDetailBets(!showDetailBets)}
            >
              {showDetailBets ? 'Elrejtés' : 'Hozzáadás'}
            </button>
          </div>
          {showDetailBets && (
            <div className="detail-bets-section">
              <div className="detail-bets-header">
                <p className="muted">Részlet fogadások (pl. "Mikor gólt lő", "Hány gólt lő")</p>
                <button type="button" onClick={addDetailBet} className="button-small">
                  + Részlet hozzáadása
                </button>
              </div>
              {detailBets.map((detailBet, detailIndex) => (
                <div key={detailIndex} className="detail-bet-card">
                  <div className="detail-bet-header">
                    <h4>Részlet fogadás {detailIndex + 1}</h4>
                    <button type="button" onClick={() => removeDetailBet(detailIndex)} className="button-ghost">
                      Törlés
                    </button>
                  </div>
                  <label>
                    Név
                    <input
                      value={detailBet.title}
                      onChange={(event) => updateDetailBet(detailIndex, 'title', event.target.value)}
                      placeholder="pl. Mikor gólt lő"
                    />
                  </label>
                  <label>
                    Leírás
                    <textarea
                      value={detailBet.description}
                      rows={2}
                      onChange={(event) => updateDetailBet(detailIndex, 'description', event.target.value)}
                    />
                  </label>
                  <label>
                    Határidő
                    <input
                      type="datetime-local"
                      value={detailBet.closesAt}
                      onChange={(event) => updateDetailBet(detailIndex, 'closesAt', event.target.value)}
                    />
                  </label>
                  <label>
                    Minimum tét (Ft)
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={detailBet.minimum_bet}
                      onChange={(event) => updateDetailBet(detailIndex, 'minimum_bet', event.target.value)}
                    />
                  </label>
                  <div className="option-toggle">
                    <p>Kimenetek száma</p>
                    <div className="chip-group">
                      {[2, 3].map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={detailBet.optionCount === count ? 'active' : ''}
                          onClick={() => updateDetailBet(detailIndex, 'optionCount', count)}
                        >
                          {count} opció
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="outcome-grid">
                    {detailBet.outcomes.slice(0, detailBet.optionCount).map((outcome, outcomeIndex) => (
                      <div key={outcomeIndex} className="outcome-card">
                        <p className="muted">Opció {outcomeIndex + 1}</p>
                        <label>
                          Megnevezés
                          <input
                            value={outcome.label}
                            onChange={(event) => updateDetailBetOutcome(detailIndex, outcomeIndex, 'label', event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Kezdő odds
                          <input
                            type="number"
                            min="1.1"
                            step="0.01"
                            value={outcome.odds}
                            onChange={(event) => updateDetailBetOutcome(detailIndex, outcomeIndex, 'odds', event.target.value)}
                            required
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="option-toggle">
            <p>Kimenetek száma</p>
            <div className="chip-group">
              {[2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={optionCount === count ? 'active' : ''}
                  onClick={() => setOptionCount(count)}
                >
                  {count} opció
                </button>
              ))}
            </div>
          </div>
          <div className="outcome-grid">
            {visibleOutcomes.map((outcome, index) => (
              <div key={index} className="outcome-card">
                <p className="muted">Opció {index + 1}</p>
                <label>
                  Megnevezés
                  <input
                    value={outcome.label}
                    onChange={(event) => updateOutcome(index, 'label', event.target.value)}
                    required
                  />
                </label>
                <label>
                  Kezdő odds
                  <input
                    type="number"
                    min="1.1"
                    step="0.01"
                    value={outcome.odds}
                    onChange={(event) => updateOutcome(index, 'odds', event.target.value)}
                    required
                  />
                </label>
              </div>
            ))}
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Mentés...' : 'Fogadás létrehozása'}
          </button>
        </form>
      </div>
    </div>
  );
}

