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
          {bets.map((bet) => {
            // Kaszinó játékok esetén külön formázás
            const isCasino = bet.bet_type === 'casino';
            const isCombo = bet.bet_type === 'combo';
            const isRoulette = isCasino && bet.game_type === 'ROULETTE';
            const isMines = isCasino && bet.game_type === 'MINESWEEPER';
            
            // Rulett esetén a nyeremény a win_amount, nem a potential_win
            const displayWin = isCasino ? (bet.potential_win || 0) : bet.potential_win;
            
            // Mines játék adatok kinyerése
            let minesInfo = '';
            if (isMines && bet.game_data) {
              try {
                const gameData = typeof bet.game_data === 'string' ? JSON.parse(bet.game_data) : bet.game_data;
                if (gameData.gemCount !== undefined && gameData.multiplier !== undefined) {
                  minesInfo = `${gameData.gemCount} gyémánt, ${gameData.multiplier.toFixed(2)}x szorzó`;
                }
              } catch (e) {
                console.error('Error parsing game_data:', e);
              }
            }
            
            // Biztosítjuk, hogy minden mező string legyen
            const safeString = (value, defaultValue = '') => {
              if (value === null || value === undefined) return defaultValue;
              if (typeof value === 'string') return value;
              if (typeof value === 'object') {
                // Ha Buffer objektum (MySQL-től jön, bár a backend-en már CAST-oltuk), dekódoljuk UTF-8-ba
                if (value.type === 'Buffer' && Array.isArray(value.data)) {
                  try {
                    // UTF-8 dekódolás TextDecoder-rel, ha elérhető
                    if (typeof TextDecoder !== 'undefined') {
                      const bytes = new Uint8Array(value.data.map(b => b < 0 ? b + 256 : b));
                      return new TextDecoder('utf-8').decode(bytes);
                    }
                    // Fallback: egyszerű dekódolás
                    const bytes = value.data.map(b => b < 0 ? b + 256 : b);
                    return String.fromCharCode(...bytes);
                  } catch {
                    return defaultValue;
                  }
                }
                // Ha más objektum, próbáljuk meg JSON stringgé alakítani
                try {
                  return JSON.stringify(value);
                } catch {
                  return defaultValue;
                }
              }
              return String(value);
            };
            
            const titleText = safeString(bet.title, 'Fogadás');
            const selectionText = safeString(bet.selection, '');
            const resultLabelText = safeString(bet.result_label, '');
            
            return (
              <tr key={bet.id} className={isCasino ? 'casino-bet' : isCombo ? 'combo-bet' : ''}>
                <td>
                  <strong>{titleText}</strong>
                  <p className="muted-small">
                    {isRoulette ? (
                      <>
                        {resultLabelText || 'Rulett játék'}
                        {bet.status === 'WON' && ' 🎉'}
                        {bet.status === 'LOST' && ' ❌'}
                      </>
                    ) : isMines ? (
                      <>
                        {minesInfo || 'Mines játék'}
                        {bet.status === 'WON' && ' 🎉'}
                        {bet.status === 'LOST' && ' ❌'}
                      </>
                    ) : isCombo ? (
                      <>
                        {selectionText || 'Kötéses fogadás'}
                        {bet.status === 'WON' && ' 🎉'}
                        {bet.status === 'LOST' && ' ❌'}
                      </>
                    ) : (
                      <>
                        Tipp: {selectionText} {resultLabelText && `| Eredmény: ${resultLabelText}`}
                      </>
                    )}
                  </p>
                </td>
                <td>{Number(bet.stake).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}</td>
                <td>
                  {isCasino ? (
                    <span className="muted-small">-</span>
                  ) : isCombo ? (
                    <span>{Number(bet.odds_snapshot || 0).toFixed(2)} (15% bónusszal)</span>
                  ) : (
                    Number(bet.odds_snapshot || 0).toFixed(2)
                  )}
                </td>
                <td>
                  {isCasino ? (
                    <span className={bet.status === 'WON' ? 'win-amount' : 'lose-amount'}>
                      {Number(displayWin).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}
                    </span>
                  ) : (
                    <span className={bet.status === 'WON' ? 'win-amount' : bet.status === 'LOST' ? 'lose-amount' : ''}>
                      {Number(bet.potential_win).toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`status-pill ${bet.status.toLowerCase()}`}>
                    {statusLabel[bet.status]}
                  </span>
                </td>
                <td>{new Date(bet.created_at).toLocaleString('hu-HU')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

