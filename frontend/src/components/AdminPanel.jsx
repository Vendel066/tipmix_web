import { useMemo, useState } from 'react';
import BetBuilderModal from './BetBuilderModal';

export default function AdminPanel({ bets, onCreate, onClose }) {
  const [modalOpen, setModalOpen] = useState(false);

  const groupedBets = useMemo(() => {
    const open = bets.filter((bet) => bet.status === 'OPEN');
    const closed = bets.filter((bet) => bet.status === 'CLOSED');
    return { open, closed };
  }, [bets]);

  return (
    <div className="admin-panel">
      <div className="admin-toolbar">
        <div>
          <p className="eyebrow">Admin felület</p>
          <h3>Fogadások kezelése</h3>
          <p className="muted-small">Nyiss új eseményeket vagy zárd le a futókat.</p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)}>
          Új fogadás
        </button>
      </div>

      <div className="admin-bet-list">
        {groupedBets.open.length ? (
          groupedBets.open.map((bet) => (
            <div key={bet.id} className="admin-bet-row">
              <div>
                <strong>{bet.title}</strong>
                <p className="muted-small">
                  {bet.outcomes.map((outcome) => `${outcome.label} ${Number(outcome.odds).toFixed(2)}`).join(' • ')}
                </p>
              </div>
              <div className="admin-bet-actions">
                {bet.outcomes.map((outcome) => (
                  <button key={outcome.id} type="button" onClick={() => onClose(bet.id, outcome.id)}>
                    {outcome.label}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="muted">Nincs aktív fogadás.</p>
        )}
      </div>

      {groupedBets.closed.length > 0 && (
        <div className="admin-history">
          <h4>Lezárt fogadások</h4>
          <div className="admin-bet-list compact">
            {groupedBets.closed.slice(0, 6).map((bet) => (
              <div key={bet.id} className="admin-bet-row small">
                <div>
                  <strong>{bet.title}</strong>
                  <p className="muted-small">Lezárva</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <BetBuilderModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={onCreate} />
    </div>
  );
}

