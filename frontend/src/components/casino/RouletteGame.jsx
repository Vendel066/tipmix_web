import { useState, useCallback } from 'react';
import { api } from '../../services/api';

// Európai rulett számok és színek
const ROULETTE_NUMBERS = [
  { num: 0, color: 'green' },
  { num: 32, color: 'red' },
  { num: 15, color: 'black' },
  { num: 19, color: 'red' },
  { num: 4, color: 'black' },
  { num: 21, color: 'red' },
  { num: 2, color: 'black' },
  { num: 25, color: 'red' },
  { num: 17, color: 'black' },
  { num: 34, color: 'red' },
  { num: 6, color: 'black' },
  { num: 27, color: 'red' },
  { num: 13, color: 'black' },
  { num: 36, color: 'red' },
  { num: 11, color: 'black' },
  { num: 30, color: 'red' },
  { num: 8, color: 'black' },
  { num: 23, color: 'red' },
  { num: 10, color: 'black' },
  { num: 5, color: 'red' },
  { num: 24, color: 'black' },
  { num: 16, color: 'red' },
  { num: 33, color: 'black' },
  { num: 1, color: 'red' },
  { num: 20, color: 'black' },
  { num: 14, color: 'red' },
  { num: 31, color: 'black' },
  { num: 9, color: 'red' },
  { num: 22, color: 'black' },
  { num: 18, color: 'red' },
  { num: 29, color: 'black' },
  { num: 7, color: 'red' },
  { num: 28, color: 'black' },
  { num: 12, color: 'red' },
  { num: 35, color: 'black' },
  { num: 3, color: 'red' },
  { num: 26, color: 'black' },
];

// Tábla elrendezés (3 oszlop, 12 sor)
// Oszlop 1: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
// Oszlop 2: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
// Oszlop 3: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
const TABLE_LAYOUT = [
  [3, 6, 9],
  [2, 5, 8],
  [1, 4, 7],
  [12, 11, 10],
  [15, 14, 13],
  [18, 17, 16],
  [21, 20, 19],
  [24, 23, 22],
  [27, 26, 25],
  [30, 29, 28],
  [33, 32, 31],
  [36, 35, 34],
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

export default function RouletteGame({ user, onBalanceUpdate }) {
  const [selectedChip, setSelectedChip] = useState(500);
  const [bets, setBets] = useState({}); // { "number": amount, "red": amount, "black": amount, stb. }
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState(null);
  const [finalNumber, setFinalNumber] = useState(null); // A backend-től kapott végső nyerő szám
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [winMessage, setWinMessage] = useState(null);

  const chipValues = [500, 1000, 5000];

  const handlePlaceBet = useCallback((betType, value) => {
    if (isSpinning || loading) return;
    
    if (Number(user?.balance || 0) < selectedChip) {
      setErrorMessage('Nincs elegendő egyenleg!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setErrorMessage(null);
    const key = `${betType}_${value}`;
    setBets((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + selectedChip,
    }));
  }, [selectedChip, isSpinning, loading, user]);

  const clearBets = () => {
    if (isSpinning || loading) return;
    setBets({});
  };

  const spin = async () => {
    if (isSpinning || loading) return;
    
    const totalBet = Object.values(bets).reduce((sum, amount) => sum + amount, 0);
    if (totalBet === 0) {
      setErrorMessage('Először helyezz el tétet!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    if (Number(user?.balance || 0) < totalBet) {
      setErrorMessage('Nincs elegendő egyenleg!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setErrorMessage(null);
    setWinMessage(null);
    setLoading(true);
    setIsSpinning(true);
    // NE null-ra állítsuk, mert akkor nem jelenik meg a szám!
    // setWinningNumber(null);
    // setFinalNumber(null); // NE null-ra, mert akkor nem jelenik meg!
    setLastResult(null);
    
    // Tét azonnali levonása (a backend-ben történik, de itt is frissítjük az egyenleget)
    // A backend-ben már levonódik a tét, szóval csak frissítjük a balance-t

    try {
      // Bet formázása a backend számára
      const formattedBets = Object.entries(bets).map(([key, amount]) => {
        const [type, ...valueParts] = key.split('_');
        const valueStr = valueParts.join('_'); // Visszaállítjuk az eredeti értéket (pl. '1-18', '19-36')
        
        let value;
        // String értékek (pl. 'red', 'black', '1-18', '19-36')
        if (valueStr === 'red' || valueStr === 'black' || valueStr === '1-18' || valueStr === '19-36') {
          value = valueStr;
        }
        // Boolean értékek (pl. 'true' -> even/odd esetén nincs érték szükséges)
        else if (valueStr === 'true' || valueStr === 'false') {
          value = null; // even/odd esetén nincs érték
        }
        // Szám értékek
        else {
          const numValue = Number(valueStr);
          value = isNaN(numValue) ? null : numValue;
        }
        
        return { type, value, amount };
      });

      console.log('🎰 Formázott tétek:', formattedBets);

      const response = await api.post('/casino/roulette/spin', {
        bets: formattedBets,
      });
      
      console.log('🎰 Backend válasz:', response.data);

      // Végleges szám a backend-től
      const finalNum = response.data.winningNumber;
      console.log('🎰 Backend generált szám:', finalNum);
      console.log('🎰 Backend válasz teljes:', response.data);
      
      // Azonnal beállítjuk a finalNumber state-et, hogy a render részben elérhető legyen
      console.log('🎰 FinalNumber beállítása:', finalNum, 'típus:', typeof finalNum);
      setFinalNumber(finalNum);
      setWinningNumber(finalNum);
      
      // Kényszerítjük a re-render-t
      setTimeout(() => {
        console.log('🎰 FinalNumber újra beállítva (setTimeout):', finalNum);
        setFinalNumber(finalNum);
      }, 50);
      
      // TÉT AZONNALI LEVONÁSA - amikor elindítjuk a pörgést
      // A backend-ben már levonva van a tét, de a nyeremény még NINCS hozzáadva az adatbázishoz.
      // Azonnal frissítjük az egyenleget balanceAfterBet-re (tét levonva)
      if (response.data.balanceAfterBet !== undefined && onBalanceUpdate) {
        try {
          console.log('🎰 Tét levonása azonnal:', response.data.balanceAfterBet);
          await onBalanceUpdate(response.data.balanceAfterBet);
        } catch (err) {
          console.error('Balance update error (tét levonása):', err);
        }
      }
      
      // Kerék animáció: a generált számhoz forgatunk
      // Kiszámoljuk, hogy hány fokot kell forgatni, hogy a szám a tetején legyen
      const targetIndex = ROULETTE_NUMBERS.findIndex(item => item.num === finalNum);
      if (targetIndex === -1) {
        console.error('Hiba: nem található a szám a keréken:', finalNum);
        setIsSpinning(false);
        setLoading(false);
        return;
      }
      
      // Minden szám 360/37 fokkal van eltolva
      // A nyíl a tetején van (0 fok), szóval a cél számot a tetejére kell forgatni
      const baseAngle = targetIndex * (360 / 37);
      // 3 teljes kör (1080 fok) + extra, hogy a cél szám a tetején legyen
      const totalRotation = 1080 + (360 - baseAngle);
      
      console.log(`🎰 Kerék animáció: cél index=${targetIndex}, szög=${baseAngle.toFixed(2)}°, forgatás=${totalRotation.toFixed(2)}°`);
      
      // Animáció időtartama - változó, addig pörög, amíg a középen lévő szám nem egyezik
      const minSpinDuration = 3000; // Minimum 3 másodperc
      const maxSpinDuration = 5000; // Maximum 5 másodperc
      const spinDuration = minSpinDuration + Math.random() * (maxSpinDuration - minSpinDuration);
      const startTime = Date.now();
      let currentRotation = 0;
      
      const animate = async () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        
        // Ease-out animáció (lassul a végén)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentRotation = totalRotation * easeOut;
        
        // Kerék forgatása
        const wheelElement = document.querySelector('.roulette-wheel');
        if (wheelElement) {
          wheelElement.style.transform = `rotate(${currentRotation}deg)`;
        }
        
        // A középső szám mindig a nyerő számot mutatja (finalNumber)
        // Nem frissítjük az animáció során, mert már be van állítva a finalNumber-ra
        // setWinningNumber(finalNumber); // Már be van állítva, nem kell újra beállítani
        
        // Addig pörög, amíg az animáció nem fejeződik be
        const shouldContinue = progress < 1;
        
        if (shouldContinue) {
          requestAnimationFrame(animate);
        } else {
          // Animáció vége - a kerék a cél számnál van és a középen is a helyes szám van
          setIsSpinning(false);
          // Biztosítjuk, hogy a középső szám a finalNumber legyen
          setWinningNumber(finalNum);
          
          // Eredmény beállítása
          const winAmount = Number(response.data.winAmount) || 0;
          const result = {
            winningNumber: finalNum,
            winAmount: winAmount,
            totalBet: response.data.totalBet,
            newBalance: response.data.newBalance,
          };
          
          console.log('🎰 Rulett eredmény:', result);
          console.log('🎰 Nyerő szám:', finalNum);
          console.log('🎰 Nyerő szám színe:', getNumberColor(finalNum));
          console.log('🎰 Nyeremény összeg:', winAmount);
          console.log('🎰 Total bet:', response.data.totalBet);
          
          setLastResult(result);
          setBets({});
          
          // Nyeremény üzenet megjelenítése - MINDIG megjelenítjük
          if (winAmount > 0) {
            const message = `🎉 Gratulálok! Ön ${winAmount.toLocaleString('hu-HU')} HUF-ot nyert!`;
            console.log('🎰 Üzenet beállítása (nyert):', message);
            setWinMessage(message);
            setTimeout(() => {
              console.log('🎰 Üzenet törlése (nyert)');
              setWinMessage(null);
            }, 10000);
          } else {
            const message = `❌ Sajnos most nem nyert. Próbálja újra!`;
            console.log('🎰 Üzenet beállítása (vesztett):', message);
            setWinMessage(message);
            setTimeout(() => {
              console.log('🎰 Üzenet törlése (vesztett)');
              setWinMessage(null);
            }, 10000);
          }
          
          // NYEREMÉNY HOZZÁADÁSA - CSAK AZ ANIMÁCIÓ VÉGÉN, amikor a kerék megállt!
          // A tét már levonva van, most hozzáadjuk a nyereményt az adatbázishoz
          // winAmount már deklarálva van fent
          if (winAmount > 0) {
            try {
              console.log('🎰 Nyeremény hozzáadása az animáció végén:', winAmount);
              const winResponse = await api.post('/casino/roulette/add-win', { winAmount });
              console.log('🎰 Nyeremény hozzáadva, új egyenleg:', winResponse.data.newBalance);
              
              // Frissítjük az egyenleget
              if (onBalanceUpdate) {
                await onBalanceUpdate(winResponse.data.newBalance);
              }
            } catch (err) {
              console.error('Balance update error (nyeremény hozzáadása):', err);
            }
          } else {
            // Ha nem nyert, akkor is frissítjük az egyenleget (csak a tét van levonva)
            if (onBalanceUpdate) {
              await onBalanceUpdate(response.data.balanceAfterBet);
            }
          }
          setLoading(false);
        }
      };
      
      requestAnimationFrame(animate);
    } catch (err) {
      setIsSpinning(false);
      setLoading(false);
      setErrorMessage(err?.response?.data?.message || 'Hiba történt a játék során');
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const getBetAmount = (betType, value) => {
    const key = `${betType}_${value}`;
    return bets[key] || 0;
  };

  return (
    <div className="roulette-game">
      {errorMessage && (
        <div className={`roulette-error-message ${errorMessage.includes('Gratulálok') ? 'win-message' : ''}`}>
          {errorMessage}
        </div>
      )}
      {winMessage && (
        <div className="roulette-result-message">
          <h2 className={winMessage.includes('Gratulálok') ? 'win' : 'lose'}>
            {winMessage}
          </h2>
        </div>
      )}
      <div className="roulette-controls">
        <div className="chip-selector">
          <label>Tét választó:</label>
          {chipValues.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip-btn ${selectedChip === value ? 'active' : ''}`}
              onClick={() => setSelectedChip(value)}
              disabled={isSpinning || loading}
            >
              {value.toLocaleString('hu-HU')} HUF
            </button>
          ))}
        </div>
        {lastResult && (
          <div className="winning-number-display">
            <label>Nyerő szám:</label>
            <div className={`winning-number-chip ${getNumberColor(lastResult.winningNumber)}`}>
              {lastResult.winningNumber}
            </div>
          </div>
        )}
        <div className="roulette-actions">
          <button
            type="button"
            className="clear-bets-btn"
            onClick={clearBets}
            disabled={isSpinning || loading || Object.keys(bets).length === 0}
          >
            Tétek törlése
          </button>
          <button
            type="button"
            className="spin-btn"
            onClick={spin}
            disabled={isSpinning || loading || Object.keys(bets).length === 0}
          >
            {isSpinning ? 'Forgatás...' : 'Forgatás'}
          </button>
        </div>
      </div>

      <div className="roulette-container">
        <div className="roulette-wheel-section">
          <div className="wheel-container">
            <div className="wheel-wrapper">
              <div className={`roulette-wheel ${isSpinning ? 'spinning' : ''}`} style={!isSpinning ? { transform: 'rotate(0deg)' } : {}}>
                <div className="wheel-center">
                  {/* Nyerő szám a középen */}
                  <div className="wheel-center-result">
                    {(() => {
                      // Először a finalNumber-t nézzük, aztán a winningNumber-t, végül a lastResult-ot
                      const displayNum = finalNumber !== null ? finalNumber : (winningNumber !== null ? winningNumber : (lastResult?.winningNumber ?? null));
                      const numColor = displayNum !== null ? getNumberColor(displayNum) : 'default';
                      const displayText = displayNum !== null ? String(displayNum) : '-';
                      return (
                        <h1 className={`wheel-center-number ${numColor}`}>
                          {displayText}
                        </h1>
                      );
                    })()}
                  </div>
                  <div className="wheel-numbers-container">
                    {ROULETTE_NUMBERS.map((item, idx) => {
                      // Számoljuk ki a szöget (0-tól kezdve, óramutató járásával ellentétes irányba)
                      // A 0 a tetején van, ezért -90 fokkal kezdjük
                      const angleDeg = idx * (360 / 37) - 90;
                      const angleRad = angleDeg * (Math.PI / 180);
                      
                      // A számok a kerék legszélén legyenek
                      // A kerék 450px, szóval a középpont 225px
                      // A kerék belső sugara: 225px - 15px (border) = 210px
                      // A számok legyenek a legszélén, de még a keréken belül
                      // 32px átmérőjű számok, szóval 16px sugár
                      // Radius: 210px - 16px = 194px (számok középpontja)
                      const radius = 194;
                      const centerX = 225; // 450 / 2
                      const centerY = 225; // 450 / 2
                      
                      // Pontos pozíció számítás
                      const x = centerX + Math.cos(angleRad) * radius;
                      const y = centerY + Math.sin(angleRad) * radius;
                      
                      return (
                        <div
                          key={`wheel-num-${idx}-${item.num}`}
                          className={`wheel-number ${item.color} ${winningNumber === item.num && !isSpinning ? 'winning' : ''}`}
                          style={{
                            position: 'absolute',
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: 'translate(-50%, -50%)',
                            transformOrigin: 'center center',
                            zIndex: 10 + idx, // Minden számnak külön z-index, hogy ne legyenek egymás alatt
                            pointerEvents: 'none', // Ne zavarják egymást
                          }}
                        >
                          <span className="wheel-num-text">
                            {item.num}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="wheel-pointer"></div>
            </div>
            {winningNumber !== null && !isSpinning && (
              <div className="winning-result-display">
                <div className={`winning-number-badge ${getNumberColor(winningNumber)}`}>
                  <div className="winning-label">Nyerő szám</div>
                  <div className="winning-value">{winningNumber}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="roulette-table-section">
          <div className="roulette-table">
            {/* 0 mező - felül középen */}
            <div className="zero-row">
              <div
                className={`table-cell zero ${getBetAmount('number', 0) > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('number', 0)}
              >
                <div className="cell-number">0</div>
                {getBetAmount('number', 0) > 0 && (
                  <div className="bet-chip">{getBetAmount('number', 0).toLocaleString('hu-HU')}</div>
                )}
              </div>
            </div>

            {/* Számok és oszlop fogadások */}
            <div className="main-table-area">
              {/* Számok táblázat */}
              <div className="numbers-grid">
                {TABLE_LAYOUT.map((row, rowIdx) => (
                  <div key={rowIdx} className="table-row">
                    {row.map((num) => {
                      const color = getNumberColor(num);
                      return (
                        <div
                          key={num}
                          className={`table-cell number ${color} ${getBetAmount('number', num) > 0 ? 'has-bet' : ''}`}
                          onClick={() => handlePlaceBet('number', num)}
                        >
                          <div className="cell-number">{num}</div>
                          {getBetAmount('number', num) > 0 && (
                            <div className="bet-chip">
                              {getBetAmount('number', num).toLocaleString('hu-HU')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Oszlop fogadások (2:1) - jobb oldalon */}
              <div className="column-bets">
                <div
                  className={`table-cell column ${getBetAmount('column', 1) > 0 ? 'has-bet' : ''}`}
                  onClick={() => handlePlaceBet('column', 1)}
                >
                  2 to 1
                  {getBetAmount('column', 1) > 0 && (
                    <div className="bet-chip">{getBetAmount('column', 1).toLocaleString('hu-HU')}</div>
                  )}
                </div>
                <div
                  className={`table-cell column ${getBetAmount('column', 2) > 0 ? 'has-bet' : ''}`}
                  onClick={() => handlePlaceBet('column', 2)}
                >
                  2 to 1
                  {getBetAmount('column', 2) > 0 && (
                    <div className="bet-chip">{getBetAmount('column', 2).toLocaleString('hu-HU')}</div>
                  )}
                </div>
                <div
                  className={`table-cell column ${getBetAmount('column', 3) > 0 ? 'has-bet' : ''}`}
                  onClick={() => handlePlaceBet('column', 3)}
                >
                  2 to 1
                  {getBetAmount('column', 3) > 0 && (
                    <div className="bet-chip">{getBetAmount('column', 3).toLocaleString('hu-HU')}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Dozen fogadások */}
            <div className="dozen-bets">
              <div
                className={`table-cell dozen ${getBetAmount('dozen', 1) > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('dozen', 1)}
              >
                1st 12
                {getBetAmount('dozen', 1) > 0 && (
                  <div className="bet-chip">{getBetAmount('dozen', 1).toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell dozen ${getBetAmount('dozen', 2) > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('dozen', 2)}
              >
                2nd 12
                {getBetAmount('dozen', 2) > 0 && (
                  <div className="bet-chip">{getBetAmount('dozen', 2).toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell dozen ${getBetAmount('dozen', 3) > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('dozen', 3)}
              >
                3rd 12
                {getBetAmount('dozen', 3) > 0 && (
                  <div className="bet-chip">{getBetAmount('dozen', 3).toLocaleString('hu-HU')}</div>
                )}
              </div>
            </div>

            {/* Outside bets */}
            <div className="outside-bets">
              <div
                className={`table-cell outside ${getBetAmount('range', '1-18') > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('range', '1-18')}
              >
                1 to 18
                {getBetAmount('range', '1-18') > 0 && (
                  <div className="bet-chip">{getBetAmount('range', '1-18').toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell outside ${getBetAmount('even', true) > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('even', true)}
              >
                EVEN
                {getBetAmount('even', true) > 0 && (
                  <div className="bet-chip">{getBetAmount('even', true).toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell outside red-bet ${getBetAmount('color', 'red') > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('color', 'red')}
              >
                <span className="red-diamond">◆</span>
                {getBetAmount('color', 'red') > 0 && (
                  <div className="bet-chip">{getBetAmount('color', 'red').toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell outside black-bet ${getBetAmount('color', 'black') > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('color', 'black')}
              >
                <span className="black-diamond">◆</span>
                {getBetAmount('color', 'black') > 0 && (
                  <div className="bet-chip">{getBetAmount('color', 'black').toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell outside ${getBetAmount('odd', true) > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('odd', true)}
              >
                ODD
                {getBetAmount('odd', true) > 0 && (
                  <div className="bet-chip">{getBetAmount('odd', true).toLocaleString('hu-HU')}</div>
                )}
              </div>
              <div
                className={`table-cell outside ${getBetAmount('range', '19-36') > 0 ? 'has-bet' : ''}`}
                onClick={() => handlePlaceBet('range', '19-36')}
              >
                19 to 36
                {getBetAmount('range', '19-36') > 0 && (
                  <div className="bet-chip">{getBetAmount('range', '19-36').toLocaleString('hu-HU')}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Eredmény megjelenítés - mindig látható legyen */}
      {lastResult && (
        <div className="roulette-result-panel">
          <div className="result-header">
            <h3>🎉 Játék eredménye</h3>
          </div>
          <div className="result-content">
            <div className="result-main">
              <div className="result-label">Nyerő szám</div>
              <div className={`result-number-large ${getNumberColor(lastResult.winningNumber)}`}>
                {lastResult.winningNumber}
              </div>
              <div className="result-color-info">
                Szín: {getNumberColor(lastResult.winningNumber) === 'green' ? 'Zöld' : getNumberColor(lastResult.winningNumber) === 'red' ? 'Piros' : 'Fekete'}
              </div>
            </div>
            <div className="result-details">
              <div className="result-detail-item">
                <span className="detail-label">Összes tét:</span>
                <span className="detail-value">{lastResult.totalBet.toLocaleString('hu-HU')} HUF</span>
              </div>
              <div className={`result-detail-item ${lastResult.winAmount > 0 ? 'win' : 'loss'}`}>
                <span className="detail-label">Nyeremény:</span>
                <span className="detail-value highlight">
                  {lastResult.winAmount > 0 ? '+' : ''}{lastResult.winAmount.toLocaleString('hu-HU')} HUF
                </span>
              </div>
              <div className="result-detail-item">
                <span className="detail-label">Új egyenleg:</span>
                <span className="detail-value">{lastResult.newBalance.toLocaleString('hu-HU')} HUF</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Gyors eredmény megjelenítés a kerék alatt */}
      {winningNumber !== null && !isSpinning && (
        <div className="roulette-quick-result">
          <div className="quick-result-label">Nyerő szám:</div>
          <div className={`quick-result-number ${getNumberColor(winningNumber)}`}>
            {winningNumber}
          </div>
        </div>
      )}
    </div>
  );
}

