import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function GemGame({ user, onBalanceUpdate }) {
  const [gridSize, setGridSize] = useState(5);
  const [bombs, setBombs] = useState(3);
  const [bet, setBet] = useState(1000);
  const [grid, setGrid] = useState([]);
  const [revealed, setRevealed] = useState(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [multiplier, setMultiplier] = useState(1.0);
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canCashout, setCanCashout] = useState(false);

  // Grid inicializálása amikor a játék elindul vagy a beállítások változnak
  useEffect(() => {
    if (gameStarted && !gameOver) {
      initializeGrid();
    }
  }, [gameStarted, gridSize, bombs]);

  // Amikor a rács mérete változik, állítsuk be a bombák számát is
  useEffect(() => {
    if (bombs >= gridSize * gridSize) {
      setBombs(Math.max(1, Math.floor((gridSize * gridSize) / 3)));
    }
  }, [gridSize]);

  const initializeGrid = () => {
    const newGrid = [];
    for (let i = 0; i < gridSize; i++) {
      const row = [];
      for (let j = 0; j < gridSize; j++) {
        row.push({
          index: i * gridSize + j,
          revealed: false,
          isBomb: false, // Ezt a backend dönti el
          isGem: false,
        });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    setRevealed(new Set());
    setMultiplier(1.0);
    setCanCashout(false);
  };

  const revealCell = async (row, col) => {
    if (gameOver || loading || !gameStarted) return;
    
    const cell = grid[row][col];
    if (cell.revealed) return;

    setLoading(true);
    try {
      // Backend dönti el, hogy bomba vagy gem
      const response = await api.post('/casino/gem/reveal', {
        bet: Number(bet),
        gridSize,
        bombs,
        revealedCount: revealed.size,
        currentMultiplier: multiplier,
      });

      const newGrid = [...grid];
      const newRevealed = new Set(revealed);
      
      if (response.data.isBomb) {
        // Bomba! Játék vége
        newGrid[row][col].revealed = true;
        newGrid[row][col].isBomb = true;
        setGrid(newGrid);
        setGameOver(true);
        setLoading(false);
        // Bomba esetén új játékot indítunk automatikusan (újra levonja a tétet)
        setTimeout(() => {
          restartGame();
        }, 1500);
        return;
      } else {
        // Gem! Folytatjuk
        newGrid[row][col].revealed = true;
        newGrid[row][col].isGem = true;
        newRevealed.add(cell.index);
        setGrid(newGrid);
        setRevealed(newRevealed);
        setMultiplier(response.data.newMultiplier);
        setCanCashout(true);
        // Gem találatnál maradunk a játékban, folytathatjuk
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const cashout = async () => {
    if (revealed.size === 0 || loading) return;
    
    setLoading(true);
    try {
      const response = await api.post('/casino/gem/cashout', {
        bet: Number(bet),
        multiplier,
        revealedCount: revealed.size,
      });
      
      onBalanceUpdate?.(response.data.newBalance);
      alert(`💰 Kifizetve! Nyeremény: ${response.data.winAmount.toLocaleString('hu-HU')} HUF`);
      // Cashout után reseteljük a játékot, de nem indítunk automatikusan új játékot
      resetGame();
    } catch (err) {
      alert(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setGameOver(false);
    setGameStarted(false);
    setRevealed(new Set());
    setMultiplier(1.0);
    setCanCashout(false);
    // Beállítások (gridSize, bombs, bet) maradnak
  };

  const restartGame = async () => {
    // Ugyanazokkal a beállításokkal újraindítja, újra levonja a tétet
    if (Number(user?.balance || 0) < bet) {
      alert('Nincs elegendő egyenleg!');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/casino/gem/start', {
        bet: Number(bet),
        gridSize,
        bombs,
      });
      
      if (response.data.success) {
        onBalanceUpdate?.(response.data.newBalance);
        // Reset és újraindítás
        setGameOver(false);
        setRevealed(new Set());
        setMultiplier(1.0);
        setCanCashout(false);
        // Grid inicializálása közvetlenül
        const newGrid = [];
        for (let i = 0; i < gridSize; i++) {
          const row = [];
          for (let j = 0; j < gridSize; j++) {
            row.push({
              index: i * gridSize + j,
              revealed: false,
              isBomb: false,
              isGem: false,
            });
          }
          newGrid.push(row);
        }
        setGrid(newGrid);
        setGameStarted(true);
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (Number(user?.balance || 0) < bet) {
      alert('Nincs elegendő egyenleg!');
      return;
    }
    if (bombs >= gridSize * gridSize) {
      alert('Túl sok bomba!');
      return;
    }
    
    // Játék indításakor azonnal levonjuk a tétet
    setLoading(true);
    try {
      const response = await api.post('/casino/gem/start', {
        bet: Number(bet),
        gridSize,
        bombs,
      });
      
      if (response.data.success) {
        onBalanceUpdate?.(response.data.newBalance);
        // Először reseteljük, majd beállítjuk a játékot
        setGameOver(false);
        setRevealed(new Set());
        setMultiplier(1.0);
        setCanCashout(false);
        // Grid inicializálása közvetlenül
        const newGrid = [];
        for (let i = 0; i < gridSize; i++) {
          const row = [];
          for (let j = 0; j < gridSize; j++) {
            row.push({
              index: i * gridSize + j,
              revealed: false,
              isBomb: false,
              isGem: false,
            });
          }
          newGrid.push(row);
        }
        setGrid(newGrid);
        setGameStarted(true);
      }
    } catch (err) {
      console.error('Start game error:', err);
      alert(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const potentialWin = Number((bet * multiplier).toFixed(2));

  return (
    <div className="gem-game">
      <div className="gem-header">
        <h2>💎 Gem Kereső</h2>
        <div className="gem-controls">
          {!gameStarted ? (
            <>
              <div>
                <label>Rács mérete</label>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                >
                  <option value={3}>3x3</option>
                  <option value={4}>4x4</option>
                  <option value={5}>5x5</option>
                  <option value={6}>6x6</option>
                  <option value={7}>7x7</option>
                  <option value={8}>8x8</option>
                </select>
              </div>
              <div>
                <label>Bombák száma</label>
                <select
                  value={bombs}
                  onChange={(e) => setBombs(Number(e.target.value))}
                >
                  {Array.from({ length: Math.min(10, gridSize * gridSize - 1) }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      {num} bomba
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Tét (HUF)</label>
                <input
                  type="number"
                  min="500"
                  step="100"
                  value={bet}
                  onChange={(e) => setBet(e.target.value)}
                />
              </div>
              <button type="button" onClick={startGame} disabled={loading}>
                Játék indítása
              </button>
            </>
          ) : (
            <button type="button" onClick={restartGame} disabled={loading}>
              Új játék
            </button>
          )}
        </div>
      </div>

      {gameStarted && (
        <>
          <div className="gem-info">
            <div className="gem-stats">
              <div>
                <span className="label">Talált gem-ek:</span>
                <strong>{revealed.size}</strong>
              </div>
              <div>
                <span className="label">Jelenlegi szorzó:</span>
                <strong className="multiplier">{multiplier.toFixed(2)}x</strong>
              </div>
              <div>
                <span className="label">Várható nyeremény:</span>
                <strong className="potential">{potentialWin.toLocaleString('hu-HU')} HUF</strong>
              </div>
            </div>
            {revealed.size > 0 && !gameOver && (
              <div className="gem-actions">
                <button
                  type="button"
                  className="cashout-btn"
                  onClick={cashout}
                  disabled={loading}
                >
                  💰 Kifizetés ({potentialWin.toLocaleString('hu-HU')} HUF)
                </button>
              </div>
            )}
            {gameOver && (
              <div className="game-over-message">
                <p>💣 Bomba! Játék vége!</p>
                <p className="muted-small">Nyomd meg az "Új játék" gombot, hogy ugyanazokkal a beállításokkal újraindítsd.</p>
              </div>
            )}
          </div>
          <div
            className="gem-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {grid.map((row, i) =>
              row.map((cell, j) => (
                <button
                  key={`${i}-${j}`}
                  type="button"
                  className={`gem-cell ${cell.revealed ? 'revealed' : ''} ${cell.isBomb ? 'bomb' : ''} ${cell.isGem ? 'gem' : ''}`}
                  onClick={() => revealCell(i, j)}
                  disabled={gameOver || loading}
                >
                  {cell.revealed && (
                    <>
                      {cell.isBomb ? (
                        <span>💣</span>
                      ) : cell.isGem ? (
                        <span>💎</span>
                      ) : null}
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

