import { useState } from 'react';
import { api } from '../services/api';

export default function PaymentModal({ type, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isWithdrawal = type === 'withdraw';
  const minAmount = 5000;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (numericAmount < minAmount) {
      setError(`Minimum összeg: ${minAmount.toLocaleString('hu-HU')} HUF`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const endpoint = isWithdrawal ? '/payments/withdraw' : '/payments/deposit';
      await api.post(endpoint, { amount: numericAmount });
      onSuccess?.(`${isWithdrawal ? 'Kifizetési' : 'Befizetési'} kérelem elküldve. Az admin hamarosan feldolgozza.`);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{isWithdrawal ? 'Kifizetés' : 'Befizetés'}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Összeg (HUF)
            <input
              type="number"
              min={minAmount}
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimum ${minAmount.toLocaleString('hu-HU')} HUF`}
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="ghost" onClick={onClose} disabled={loading}>
              Mégse
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Küldés...' : 'Küldés'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

