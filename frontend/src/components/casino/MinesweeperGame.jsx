import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function MinesweeperGame({ user, onBalanceUpdate }) {
  const [gridSize] = useState(8);
  const [mines] = useState(10);
  const [grid, setGrid] = useState([]);
  const [revealed, setRevealed] = useState(new Set());
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [bet, setBet] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (gameStarted && !gameOver && !won) {
      initializeGrid();
    }
  }, [gameStarted]);

  const initializeGrid = () => {
    const newGrid = [];
    const minePositions = new Set();
    
    // Véletlenszerűen helyezzük el az aknákat
    while (minePositions.size < mines) {
      const pos = Math.floor(Math.random() * gridSize * gridSize);
      minePositions.add(pos);
    }

    for (let i = 0; i < gridSize; i++) {
      const row = [];
      for (let j = 0; j < gridSize; j++) {
        const index = i * gridSize + j;
        const isMine = minePositions.has(index);
        let adjacentMines = 0;
        
        if (!isMine) {
          // Számoljuk meg a szomszédos aknákat
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
              if (di === 0 && dj === 0) continue;
              const ni = i + di;
              const nj = j + dj;
              if (ni >= 0 && ni < gridSize && nj >= 0 && nj < gridSize) {
                const neighborIndex = ni * gridSize + nj;
                if (minePositions.has(neighborIndex)) {
                  adjacentMines++;
                }
              }
            }
          }
        }
        
        row.push({
          isMine,
          adjacentMines,
          revealed: false,
          index,
        });
      }
      newGrid.push(row);
    }
    
    setGrid(newGrid);
    setRevealed(new Set());
  };

  const revealCell = (row, col) => {
    if (gameOver || won || loading) return;
    
    const cell = grid[row][col];
    if (cell.revealed) return;

    const newGrid = [...grid];
    const newRevealed = new Set(revealed);

    if (cell.isMine) {
      // Akna! Játék vége
      newGrid[row][col].revealed = true;
      setGrid(newGrid);
      setGameOver(true);
      return;
    }

    // Rekurzív felfedés (ha nincs szomszédos akna)
    const revealRecursive = (r, c) => {
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return;
      const currentCell = newGrid[r][c];
      const key = `${r}-${c}`;
      
      if (currentCell.revealed || currentCell.isMine) return;
      
      currentCell.revealed = true;
      newRevealed.add(currentCell.index);
      
      if (currentCell.adjacentMines === 0) {
        // Ha nincs szomszédos akna, felfedjük a szomszédokat is
        for (let di = -1; di <= 1; di++) {
          for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;
            revealRecursive(r + di, c + dj);
          }
        }
      }
    };

    revealRecursive(row, col);
    setGrid(newGrid);
    setRevealed(newRevealed);

    // Ellenőrizzük, hogy minden nem-akna mező felfedve van-e
    const totalCells = gridSize * gridSize;
    const nonMineCells = totalCells - mines;
    if (newRevealed.size >= nonMineCells) {
      setWon(true);
      handleWin(newRevealed);
    }
  };

  const handleWin = async (finalRevealed) => {
    setLoading(true);
    try {
      const response = await api.post('/casino/minesweeper/play', {
        bet: Number(bet),
        gridSize,
        mines,
        revealed: Array.from(finalRevealed),
      });
      onBalanceUpdate?.(response.data.newBalance);
      alert(`Gratulálok! Nyeremény: ${response.data.winAmount.toLocaleString('hu-HU')} HUF`);
      resetGame();
    } catch (err) {
      alert(err?.response?.data?.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const resetGame = () => {
    setGameOver(false);
    setWon(false);
    setGameStarted(false);
    setRevealed(new Set());
  };

  const startGame = () => {
    if (Number(user?.balance || 0) < bet) {
      alert('Nincs elegendő egyenleg!');
      return;
    }
    setGameStarted(true);
    initializeGrid();
  };

  const getCellColor = (adjacentMines) => {
    const colors = ['', '#4ade80', '#60a5fa', '#f59e0b', '#ef4444', '#dc2626', '#991b1b', '#7f1d1d', '#581c1c'];
    return colors[adjacentMines] || '#000';
  };

  return (
    <div className="minesweeper-game">
      <div className="minesweeper-header">
        <h2>💣 Akna Kereső</h2>
        <div className="minesweeper-controls">
          <div>
            <label>Tét (HUF)</label>
            <input
              type="number"
              min="500"
              step="100"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              disabled={gameStarted}
            />
          </div>
          {!gameStarted ? (
            <button type="button" onClick={startGame} disabled={loading}>
              Játék indítása
            </button>
          ) : (
            <button type="button" onClick={resetGame} disabled={loading}>
              Új játék
            </button>
          )}
        </div>
      </div>

      {gameStarted && (
        <>
          <div className="minesweeper-info">
            <div>Felfedett mezők: {revealed.size}</div>
            <div>Aknák: {mines}</div>
            {gameOver && <div className="game-over">💥 Játék vége! Aknára léptél!</div>}
            {won && <div className="game-won">🎉 Gratulálok! Minden mezőt felfedeztél!</div>}
          </div>
          <div
            className="minesweeper-grid"
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {grid.map((row, i) =>
              row.map((cell, j) => (
                <button
                  key={`${i}-${j}`}
                  type="button"
                  className={`minesweeper-cell ${cell.revealed ? 'revealed' : ''} ${cell.isMine && cell.revealed ? 'mine' : ''}`}
                  onClick={() => revealCell(i, j)}
                  disabled={gameOver || won}
                >
                  {cell.revealed && (
                    <>
                      {cell.isMine ? (
                        <span>💣</span>
                      ) : (
                        <span style={{ color: getCellColor(cell.adjacentMines) }}>
                          {cell.adjacentMines > 0 ? cell.adjacentMines : ''}
                        </span>
                      )}
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

