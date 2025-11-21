import { useCallback } from 'react';
import GemGame from './casino/GemGame';

export default function Casino({ user, onBalanceUpdate, selectedGame, onSelectGame }) {
  // Stabil callback, hogy ne veszítse el a state-et amikor újrarenderelődik
  const handleBalanceUpdate = useCallback(async (newBalance) => {
    if (onBalanceUpdate) {
      await onBalanceUpdate(newBalance);
    }
  }, [onBalanceUpdate]);

  // Biztosítjuk, hogy az onSelectGame mindig létezik
  const handleSelectGame = (gameId) => {
    if (onSelectGame) {
      onSelectGame(gameId);
    }
  };

  const games = [
    {
      id: 'gem',
      name: 'Gem Kereső',
      icon: '💎',
      description: 'Válassz mezőket és kerüld el a bombákat! Minden gem növeli a szorzót. Cashout bármikor!',
      minBet: 500,
    },
  ];

  if (selectedGame) {
    const game = games.find((g) => g.id === selectedGame);
    return (
      <div className="casino-container">
        <button
          type="button"
          className="casino-back-btn"
          onClick={() => handleSelectGame(null)}
        >
          ← Vissza a játékokhoz
        </button>
        {selectedGame === 'gem' && (
          <GemGame user={user} onBalanceUpdate={handleBalanceUpdate} />
        )}
      </div>
    );
  }

  return (
    <div className="casino-container">
      <div className="casino-header">
        <h1>🎰 Kaszinó</h1>
        <p>Válassz egy játékot és kezdj el játszani!</p>
      </div>
      <div className="casino-games-grid">
        {games.map((game) => (
          <div
            key={game.id}
            className="casino-game-card"
            onClick={() => handleSelectGame(game.id)}
          >
            <div className="casino-game-icon">{game.icon}</div>
            <h3>{game.name}</h3>
            <p>{game.description}</p>
            <div className="casino-game-min-bet">
              Minimum tét: {game.minBet.toLocaleString('hu-HU')} HUF
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

