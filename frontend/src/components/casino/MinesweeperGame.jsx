import { useState, useCallback, useEffect } from 'react';
import { api } from '../../services/api';

// Szorzó táblázat - minden biztonságos mező után növekszik
const MULTIPLIER_TABLE = [
  1.0, 1.32, 1.74, 2.30, 3.04, 4.02, 5.30, 7.00, 9.24, 12.20,
  16.10, 21.25, 28.05, 37.03, 48.88, 64.52, 85.17, 112.42, 148.40, 195.88, 258.56
];

// Rácsméret opciók
const GRID_SIZES = [
  { size: 5, label: '5×5' },
  { size: 8, label: '8×8' },
  { size: 10, label: '10×10' },
];

export default function MinesweeperGame({ user, onBalanceUpdate, onNotification }) {
  const [gridSize, setGridSize] = useState(8);
  const [bombs, setBombs] = useState(10);
  const [bet, setBet] = useState(500);
  const [gameState, setGameState] = useState('idle'); // idle, playing, gameover, won
  const [grid, setGrid] = useState([]);
  const [revealedCells, setRevealedCells] = useState(new Set());
  const [bombCells, setBombCells] = useState(new Set());
  const [gemCount, setGemCount] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showAllBombs, setShowAllBombs] = useState(false);

  // Grid inicializálása
  const initializeGrid = useCallback(() => {
    const totalCells = gridSize * gridSize;
    const newGrid = Array(totalCells).fill(null).map((_, index) => ({
      id: index,
      row: Math.floor(index / gridSize),
      col: index % gridSize,
      isRevealed: false,
      isBomb: false,
    }));
    setGrid(newGrid);
    setRevealedCells(new Set());
    setBombCells(new Set());
    setGemCount(0);
    setMultiplier(1.0);
    setShowAllBombs(false);
  }, [gridSize]);

  useEffect(() => {
    // Csak akkor inicializáljuk újra a grid-et, ha a gridSize változik ÉS nincs aktív játék
    // NE tegyük bele a gameState-et a függőségekbe, mert akkor minden gameState változásnál újrafut!
    if (gameState === 'idle') {
      const totalCells = gridSize * gridSize;
      const newGrid = Array(totalCells).fill(null).map((_, index) => ({
        id: index,
        row: Math.floor(index / gridSize),
        col: index % gridSize,
        isRevealed: false,
        isBomb: false,
      }));
      setGrid(newGrid);
      setRevealedCells(new Set());
      setBombCells(new Set());
      setGemCount(0);
      setMultiplier(1.0);
      setShowAllBombs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSize]); // Csak gridSize változásakor, NE gameState!

  // Játék indítása
  const startGame = async () => {
    if (loading || gameState === 'playing') return;
    
    if (Number(user?.balance || 0) < bet) {
      setErrorMessage('Nincs elegendő egyenleg!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (bombs >= gridSize * gridSize) {
      setErrorMessage('Túl sok akna! Az aknák száma kevesebb kell legyen, mint a rács celláinak száma.');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('tipmix_token');
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      // Játék indítása - tét levonása
      const response = await api.post('/casino/mines/start', {
        bet,
        gridSize,
        bombs,
      });

      if (response.data.success) {
        // Grid inicializálása (mindig újrageneráljuk)
        const totalCells = gridSize * gridSize;
        const newGrid = Array(totalCells).fill(null).map((_, index) => ({
          id: index,
          row: Math.floor(index / gridSize),
          col: index % gridSize,
          isRevealed: false,
          isBomb: false,
        }));

        // Aknák véletlenszerű elhelyezése (frontend-ben)
        const bombIndices = new Set();
        while (bombIndices.size < bombs) {
          const randomIndex = Math.floor(Math.random() * totalCells);
          bombIndices.add(randomIndex);
        }

        // Állapotok visszaállítása új játékhoz - minden state-t egyszerre frissítünk
        // Először a grid-et és az aknákat állítjuk be
        setGrid(newGrid);
        setBombCells(bombIndices);
        setRevealedCells(new Set());
        setGemCount(0);
        setMultiplier(1.0);
        setShowAllBombs(false);
        
        console.log('💣 Minesweeper játék indítva:', {
          gridSize,
          bombs,
          totalCells,
          bombIndices: Array.from(bombIndices),
          gridLength: newGrid.length,
        });

        // Egyenleg frissítése (nem blokkoljuk vele a játékot)
        if (onBalanceUpdate) {
          onBalanceUpdate(response.data.newBalance).catch(err => {
            console.error('Balance update error:', err);
          });
        }

        // Loading és gameState beállítása - egyszerre, szinkron módon
        setLoading(false);
        setGameState('playing');
        
        console.log('💣 GameState beállítva: playing (szinkron)');
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || 'Hiba történt a játék indításakor');
      setTimeout(() => setErrorMessage(null), 5000);
      setLoading(false);
    }
  };

  // Cella felfedése
  const revealCell = async (cellId) => {
    if (loading || gameState !== 'playing' || revealedCells.has(cellId)) return;

    setLoading(true);

    try {
      const token = localStorage.getItem('tipmix_token');
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      const isBomb = bombCells.has(cellId);
      
      // Backend hívás
      const response = await api.post('/casino/mines/reveal', {
        bet,
        gridSize,
        bombs,
        cellId,
        gemCount,
        currentMultiplier: multiplier,
        isBomb,
      });

      if (response.data.success) {
        if (isBomb) {
          // Aknára léptünk - játék vége
          setGameState('gameover');
          setShowAllBombs(true);
          setRevealedCells(prev => new Set([...prev, cellId]));

          // Gameover mentése
          try {
            await api.post('/casino/mines/gameover', {
              bet,
              gridSize,
              bombs,
              gemCount,
              multiplier,
              winAmount: 0,
            });
          } catch (err) {
            console.error('Gameover mentés hiba:', err);
          }

          if (onNotification) {
            onNotification(`💣 Aknára léptél! A téted elveszett.`, 'lose');
          }
        } else {
          // Biztonságos mező - szorzó növekedés
          const newGemCount = gemCount + 1;
          const newMultiplier = response.data.newMultiplier;
          
          setGemCount(newGemCount);
          setMultiplier(newMultiplier);
          setRevealedCells(prev => new Set([...prev, cellId]));

          if (onNotification) {
            onNotification(`💎 Biztonságos mező! Szorzó: ${newMultiplier.toFixed(2)}x`, 'info');
          }
        }
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || 'Hiba történt a játék során');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Cashout - nyeremény kivétele
  const cashout = async () => {
    if (loading || gameState !== 'playing' || gemCount === 0) return;

    setLoading(true);

    try {
      const token = localStorage.getItem('tipmix_token');
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
      }

      const winAmount = bet * multiplier;

      const response = await api.post('/casino/mines/cashout', {
        bet,
        gridSize,
        bombs,
        gemCount,
        multiplier,
        winAmount,
      });

      if (response.data.success) {
        setGameState('won');
        setShowAllBombs(true);

        // Egyenleg frissítése
        if (onBalanceUpdate) {
          await onBalanceUpdate(response.data.newBalance);
        }

        if (onNotification) {
          onNotification(
            `🎉 Gratulálok! ${winAmount.toLocaleString('hu-HU')} HUF nyereményt kivettél! (${multiplier.toFixed(2)}x szorzó)`,
            'win'
          );
        }
      }
    } catch (err) {
      setErrorMessage(err?.response?.data?.message || 'Hiba történt a kifizetés során');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Új játék
  const newGame = () => {
    setGameState('idle');
    initializeGrid();
  };

  const getCellContent = (cell) => {
    const isRevealed = revealedCells.has(cell.id);
    const isBomb = bombCells.has(cell.id);
    const showBomb = (isBomb && (showAllBombs || isRevealed)) && gameState !== 'playing';

    if (showBomb) {
      return '💣';
    }
    if (isRevealed && !isBomb) {
      return '💎';
    }
    return '';
  };

  const getCellClassName = (cell) => {
    const isRevealed = revealedCells.has(cell.id);
    const isBomb = bombCells.has(cell.id);
    const showBomb = (isBomb && (showAllBombs || isRevealed)) && gameState !== 'playing';

    let className = 'minesweeper-cell';
    if (isRevealed) {
      if (isBomb) {
        className += ' bomb';
      } else {
        className += ' revealed gem';
      }
    } else if (showBomb) {
      className += ' bomb';
    } else {
      className += ' hidden';
    }
    return className;
  };

  const potentialWin = bet * multiplier;
  const maxBombs = gridSize * gridSize - 1;

  return (
    <div className="minesweeper-game">
      {errorMessage && (
        <div className="minesweeper-error-message">
          {errorMessage}
        </div>
      )}

      <div className="minesweeper-header">
        <h2>💣 Aknakereső</h2>
        <div className="minesweeper-controls">
          <div>
            <label>Rácsméret</label>
            <select
              value={gridSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setGridSize(newSize);
                if (bombs >= newSize * newSize) {
                  setBombs(Math.max(1, Math.floor((newSize * newSize) * 0.2)));
                }
              }}
              disabled={gameState === 'playing' || loading}
              style={{
                padding: '0.5rem 1rem',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '0.5rem',
                color: '#ffffff',
                width: '120px',
              }}
            >
              {GRID_SIZES.map(({ size, label }) => (
                <option key={size} value={size}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Aknák száma</label>
            <input
              type="number"
              min="1"
              max={maxBombs}
              value={bombs}
              onChange={(e) => {
                const newBombs = Math.max(1, Math.min(maxBombs, Number(e.target.value)));
                setBombs(newBombs);
              }}
              disabled={gameState === 'playing' || loading}
            />
          </div>
          <div>
            <label>Tét (HUF)</label>
            <input
              type="number"
              min="100"
              step="100"
              value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              disabled={gameState === 'playing' || loading}
            />
          </div>
          {gameState === 'idle' && (
            <button
              type="button"
              className="minesweeper-start-btn"
              onClick={startGame}
              disabled={loading}
            >
              Játék indítása
            </button>
          )}
          {gameState === 'playing' && (
            <button
              type="button"
              className="minesweeper-cashout-btn"
              onClick={cashout}
              disabled={loading || gemCount === 0}
            >
              Kivét ({potentialWin.toLocaleString('hu-HU')} HUF)
            </button>
          )}
          {(gameState === 'gameover' || gameState === 'won') && (
            <button
              type="button"
              className="minesweeper-new-game-btn"
              onClick={newGame}
            >
              Új játék
            </button>
          )}
        </div>
      </div>

      <div className="minesweeper-info">
        <div>
          <span className="muted-small">Szorzó:</span>
          <strong style={{ color: '#4ade80', fontSize: '1.5rem', marginLeft: '0.5rem' }}>
            {multiplier.toFixed(2)}x
          </strong>
        </div>
        <div>
          <span className="muted-small">Biztonságos mezők:</span>
          <strong style={{ color: '#38bdf8', fontSize: '1.2rem', marginLeft: '0.5rem' }}>
            {gemCount}
          </strong>
        </div>
        <div>
          <span className="muted-small">Potenciális nyeremény:</span>
          <strong style={{ color: '#f59e0b', fontSize: '1.2rem', marginLeft: '0.5rem' }}>
            {potentialWin.toLocaleString('hu-HU')} HUF
          </strong>
        </div>
      </div>

      {gameState === 'gameover' && (
        <div className="game-over-message">
          <p>💣 Aknára léptél! A játék véget ért.</p>
          <p className="muted-small">Tét: {bet.toLocaleString('hu-HU')} HUF</p>
        </div>
      )}

      {gameState === 'won' && (
        <div className="game-won-message">
          <p>🎉 Gratulálok! Sikeresen kivetted a nyereményt!</p>
          <p className="muted-small">
            Nyeremény: {(bet * multiplier).toLocaleString('hu-HU')} HUF ({multiplier.toFixed(2)}x szorzó)
          </p>
        </div>
      )}

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: '#ffffff',
        }}>
          <strong>Debug:</strong> gameState={gameState}, loading={loading ? 'true' : 'false'}, grid.length={grid.length}, revealedCells.size={revealedCells.size}
        </div>
      )}

      {grid.length === 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
          textAlign: 'center',
          color: '#ef4444',
        }}>
          ⚠️ Grid nincs inicializálva! Grid hossza: {grid.length}
        </div>
      )}

      <div
        className="minesweeper-grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          maxWidth: `${gridSize * (gridSize <= 5 ? 60 : gridSize <= 8 ? 50 : 45)}px`,
        }}
      >
        {grid.length > 0 ? grid.map((cell) => {
          const cellSize = gridSize <= 5 ? 50 : gridSize <= 8 ? 45 : 40;
          const fontSize = gridSize <= 5 ? '1.2rem' : gridSize <= 8 ? '1rem' : '0.9rem';
          const isDisabled = gameState !== 'playing' || revealedCells.has(cell.id);
          
          return (
            <button
              key={cell.id}
              type="button"
              className={getCellClassName(cell)}
              onClick={() => {
                if (!isDisabled && !loading) {
                  console.log('💣 Cell clicked:', { cellId: cell.id, isDisabled, loading, gameState, revealed: revealedCells.has(cell.id) });
                  revealCell(cell.id);
                } else {
                  console.log('💣 Cell click blocked:', { cellId: cell.id, isDisabled, loading, gameState, revealed: revealedCells.has(cell.id) });
                }
              }}
              disabled={isDisabled || loading}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                fontSize: fontSize,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {getCellContent(cell)}
            </button>
          );
        }) : (
          <div style={{ gridColumn: `1 / ${gridSize + 1}`, textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
            Grid nincs inicializálva. Kérjük, indítsd újra a játékot.
          </div>
        )}
      </div>

      <div className="minesweeper-stats" style={{ marginTop: '2rem' }}>
        <h3 style={{ color: '#ffffff', marginBottom: '1rem' }}>Statisztika</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}>
            <div className="muted-small">Felfedett mezők</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>
              {revealedCells.size}
            </div>
          </div>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}>
            <div className="muted-small">Akna helyek</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
              {bombs}
            </div>
          </div>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.75rem',
            padding: '1rem',
          }}>
            <div className="muted-small">Biztonságos mezők</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
              {gridSize * gridSize - bombs}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

