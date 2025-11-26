export default function TransactionTable({ transactions }) {
  if (!transactions.length) {
    return (
      <div className="history-table empty">
        <p>Még nincs tranzakció.</p>
      </div>
    );
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'WITHDRAWAL':
        return 'Kifizetés';
      case 'DEPOSIT':
        return 'Befizetés';
      case 'TRANSFER_OUT':
        return 'Pénz küldése';
      case 'TRANSFER_IN':
        return 'Pénz fogadása';
      default:
        return type;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'WITHDRAWAL':
        return '📤';
      case 'DEPOSIT':
        return '📥';
      case 'TRANSFER_OUT':
        return '💸';
      case 'TRANSFER_IN':
        return '💰';
      default:
        return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING':
        return 'Folyamatban';
      case 'COMPLETED':
        return 'Befejezve';
      case 'REJECTED':
        return 'Elutasítva';
      default:
        return status;
    }
  };

  return (
    <div className="history-table">
      <table>
        <thead>
          <tr>
            <th>Típus</th>
            <th>Összeg</th>
            <th>Státusz</th>
            <th>Dátum</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td>
                <strong>
                  {getTypeIcon(tx.type)} {getTypeLabel(tx.type)}
                </strong>
              </td>
              <td>
                <span className={tx.type === 'TRANSFER_OUT' || tx.type === 'WITHDRAWAL' ? 'lose-amount' : 'win-amount'}>
                  {tx.type === 'TRANSFER_OUT' || tx.type === 'WITHDRAWAL' ? '-' : '+'}
                  {Number(tx.amount).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}
                </span>
              </td>
              <td>
                <span className={`status-pill ${tx.status.toLowerCase()}`}>
                  {getStatusLabel(tx.status)}
                </span>
              </td>
              <td>{new Date(tx.created_at).toLocaleString('hu-HU')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

