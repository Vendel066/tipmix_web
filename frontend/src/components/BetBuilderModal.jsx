import { useState } from 'react';

const defaultOutcome = () => ({ label: '', odds: 1.8 });

export default function BetBuilderModal({ open, onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [optionCount, setOptionCount] = useState(2);
  const [outcomes, setOutcomes] = useState(() => [defaultOutcome(), defaultOutcome(), defaultOutcome()]);
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
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSave({
        title,
        description,
        closes_at: closesAt || null,
        outcomes: visibleOutcomes.map((outcome) => ({
          label: outcome.label,
          odds: Number(outcome.odds),
        })),
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

