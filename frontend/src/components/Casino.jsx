import { useState, useEffect } from 'react';
import RouletteGame from './casino/RouletteGame';
import MinesweeperGame from './casino/MinesweeperGame';

export default function Casino({ user, onBalanceUpdate, onNotification }) {
  // localStorage-ból olvassuk be, hogy ne vesszen el újrarendereléskor
  const [selectedGame, setSelectedGame] = useState(() => {
    return localStorage.getItem('casino_selected_game') || null;
  });
  
  // Mentjük localStorage-ba amikor változik
  useEffect(() => {
    if (selectedGame) {
      localStorage.setItem('casino_selected_game', selectedGame);
    } else {
      localStorage.removeItem('casino_selected_game');
    }
  }, [selectedGame]);
  
  // Értesítés kezelő függvény - továbbítja az App komponensnek
  const handleNotification = (message, type) => {
    console.log('🎰 Casino: Értesítés érkezett, továbbítás az App-nek:', message, type);
    if (onNotification) {
      onNotification(message, type);
    }
  };

  const games = [
    {
      id: 'roulette',
      name: 'Európai Rulett',
      icon: '🎰',
      description: 'Klasszikus rulett játék! Válassz számokat, színeket vagy egyéb kombinációkat és próbáld meg eltalálni a nyerő számot!',
      minBet: 500,
    },
    {
      id: 'minesweeper',
      name: 'Aknakereső',
      icon: '💣',
      description: 'Fedj fel biztonságos mezőket és növeld a szorzódat! De vigyázz, ne lépj aknára! Bármikor kiveheted a nyereményedet.',
      minBet: 100,
    },
  ];

  if (selectedGame) {
    const game = games.find((g) => g.id === selectedGame);
    return (
      <div className="casino-container">
        <button
          type="button"
          className="casino-back-btn"
          onClick={() => setSelectedGame(null)}
        >
          ← Vissza a játékokhoz
        </button>
        {selectedGame === 'roulette' && (
          <RouletteGame 
            user={user} 
            onBalanceUpdate={onBalanceUpdate}
            onNotification={handleNotification}
          />
        )}
        {selectedGame === 'minesweeper' && (
          <MinesweeperGame 
            user={user} 
            onBalanceUpdate={onBalanceUpdate}
            onNotification={handleNotification}
          />
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
            onClick={() => setSelectedGame(game.id)}
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

