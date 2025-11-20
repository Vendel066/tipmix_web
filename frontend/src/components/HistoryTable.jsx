const statusLabel = {
  PENDING: 'Folyamatban',
  WON: 'Nyert',
  LOST: 'Veszített',
};

export default function HistoryTable({ bets, variant = 'history' }) {
  if (!bets.length) {
    return (
      <div className="history-table empty">
        <p>{variant === 'history' ? 'Még nincs lezárt fogadásod.' : 'Jelenleg nincs aktív fogadásod.'}</p>
      </div>
    );
  }

  return (
    <div className="history-table">
      <table>
        <thead>
          <tr>
            <th>Esemény</th>
            <th>Tét</th>
            <th>Odds</th>
            <th>Várható nyeremény</th>
            <th>Státusz</th>
            <th>Dátum</th>
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => (
            <tr key={bet.id}>
              <td>
                <strong>{bet.title}</strong>
                <p className="muted-small">
                  Tipp: {bet.selection} {bet.result_label && `| Eredmény: ${bet.result_label}`}
                </p>
              </td>
              <td>{Number(bet.stake).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}</td>
              <td>{Number(bet.odds_snapshot || 0).toFixed(2)}</td>
              <td>{Number(bet.potential_win).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}</td>
              <td>
                <span className={`status-pill ${bet.status.toLowerCase()}`}>{statusLabel[bet.status]}</span>
              </td>
              <td>{new Date(bet.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

