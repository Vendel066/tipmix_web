import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function PaymentAdminPanel() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/payments/admin/pending');
      setTransactions(res.data.transactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleApprove = async (id) => {
    try {
      await api.post(`/payments/admin/${id}/approve`);
      await loadTransactions();
    } catch (err) {
      alert(err?.response?.data?.message || 'Hiba történt');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/payments/admin/${id}/reject`);
      await loadTransactions();
    } catch (err) {
      alert(err?.response?.data?.message || 'Hiba történt');
    }
  };

  if (loading) {
    return <div className="inline-loader"><div className="loader tiny" /><span>Betöltés...</span></div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin felület</p>
          <h3>Kifizetés/Befizetés kérések</h3>
          <p className="muted-small">Jóváhagyás vagy elutasítás.</p>
        </div>
        <button type="button" onClick={loadTransactions}>
          Frissítés
        </button>
      </div>

      <div className="admin-bet-list">
        {transactions.length ? (
          transactions.map((tx) => (
            <div key={tx.id} className="admin-bet-row">
              <div>
                <strong>{tx.username} ({tx.email})</strong>
                <p className="muted-small">
                  {tx.type === 'WITHDRAWAL' ? 'Kifizetés' : 'Befizetés'}: {Number(tx.amount).toLocaleString('hu-HU')} HUF
                </p>
                <p className="muted-small">Kérve: {new Date(tx.created_at).toLocaleString('hu-HU')}</p>
              </div>
              <div className="admin-bet-actions">
                <button type="button" onClick={() => handleApprove(tx.id)}>
                  Elfogad
                </button>
                <button type="button" className="danger" onClick={() => handleReject(tx.id)}>
                  Elutasít
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Nincs függőben lévő kérés.</p>
        )}
      </div>
    </div>
  );
}

