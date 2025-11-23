import { useState, useCallback } from 'react';
import { api } from '../../services/api';
import WheelCenterNumber from './WheelCenterNumber';

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

// Tábla elrendezés - VÍZSZINTES (3 sor, 12 oszlop)
// Sor 1: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
// Sor 2: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
// Sor 3: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
const TABLE_LAYOUT = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], // Első sor
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], // Második sor
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34], // Harmadik sor
];

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

export default function RouletteGame({ user, onBalanceUpdate, onNotification }) {
  const [selectedChip, setSelectedChip] = useState(500);
  const [bets, setBets] = useState({}); // { "number": amount, "red": amount, "black": amount, stb. }
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState(null);
  const [finalNumber, setFinalNumber] = useState(null); // A backend-től kapott végső nyerő szám
  const [lastResult, setLastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [winMessage, setWinMessage] = useState(null);
  const [currentRotation, setCurrentRotation] = useState(0); // Jelenlegi forgatási pozíció

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
    // NE töröljük a finalNumber-t, hogy a középső szám továbbra is látható maradjon
    
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
      
      // Biztosítjuk, hogy a token be van állítva
      const token = localStorage.getItem('tipmix_token');
      if (token) {
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        console.log('🎰 Token beállítva az API hívás előtt');
      } else {
        console.error('❌ Nincs token a localStorage-ban!');
        setErrorMessage('Nincs bejelentkezve! Kérjük, jelentkezzen be újra.');
        setIsSpinning(false);
        setLoading(false);
        return;
      }

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
      // Hozzáadjuk az aktuális forgatást, hogy ne ugorjon vissza
      const totalRotation = currentRotation + 1080 + (360 - baseAngle);
      
      console.log(`🎰 Kerék animáció: cél index=${targetIndex}, szög=${baseAngle.toFixed(2)}°, összes forgatás=${totalRotation.toFixed(2)}°`);
      
      // Naplózás - játék kezdés
      console.log(`🎰 Rulett játék kezdve: User ID=${user?.id}, Tétek=${JSON.stringify(formattedBets)}, Összes tét=${totalBet} HUF`);
      
      // Animáció időtartama - változó, addig pörög, amíg a középen lévő szám nem egyezik
      const minSpinDuration = 3000; // Minimum 3 másodperc
      const maxSpinDuration = 5000; // Maximum 5 másodperc
      const spinDuration = minSpinDuration + Math.random() * (maxSpinDuration - minSpinDuration);
      const startTime = Date.now();
      let currentAnimRotation = currentRotation;
      
      const animate = async () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        
        // Ease-out animáció (lassul a végén)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentAnimRotation = currentRotation + (totalRotation - currentRotation) * easeOut;
        
        // Kerék forgatása
        const wheelElement = document.querySelector('.roulette-wheel');
        if (wheelElement) {
          wheelElement.style.transform = `rotate(${currentAnimRotation}deg)`;
        }
        
        // Addig pörög, amíg az animáció nem fejeződik be
        const shouldContinue = progress < 1;
        
        if (shouldContinue) {
          requestAnimationFrame(animate);
        } else {
          // Animáció vége - a kerék a cél számnál van és a középen is a helyes szám van
          setIsSpinning(false);
          // Frissítjük az aktuális forgatást, hogy a következő forgatás innen folytassa
          // A totalRotation már tartalmazza az aktuális pozíciót és az új forgatást
          // Csak a 360 fokon belüli értéket tároljuk, de az animRotation változót használjuk a pontos pozícióhoz
          const finalRotation = currentAnimRotation % 360;
          setCurrentRotation(finalRotation); // Csak a 360 fokon belüli érték
          
          // Biztosítjuk, hogy a kerék a helyes pozícióban maradjon
          const wheelElement = document.querySelector('.roulette-wheel');
          if (wheelElement) {
            wheelElement.style.transform = `rotate(${finalRotation}deg)`;
          }
          
          // Biztosítjuk, hogy a középső szám a finalNumber legyen
          setWinningNumber(finalNum);
          console.log('🎰 FinalNumber beállítása az animáció végén:', finalNum, 'típus:', typeof finalNum);
          setFinalNumber(finalNum); // Biztosítjuk, hogy a középső szám megjelenjen
          
          // Kényszerítjük a re-render-t, hogy a WheelCenterNumber biztosan megkapja az új értéket
          setTimeout(() => {
            console.log('🎰 FinalNumber újra beállítva (setTimeout az animáció után):', finalNum);
            setFinalNumber(finalNum);
          }, 100);
          
          // Eredmény beállítása
          const winAmount = Number(response.data.winAmount) || 0;
          const result = {
            winningNumber: finalNum,
            winAmount: winAmount,
            totalBet: response.data.totalBet,
            newBalance: response.data.newBalance,
          };
          
          // Naplózás
          console.log('🎰 Rulett eredmény:', result);
          console.log(`🎰 Rulett játék vége: User ID=${user?.id}, Nyerő szám=${finalNum}, Nyeremény=${winAmount} HUF, Tét=${response.data.totalBet} HUF`);
          console.log('🎰 Nyerő szám színe:', getNumberColor(finalNum));
          
          setLastResult(result);
          setBets({});
          
          // Nyeremény üzenet megjelenítése - MINDIG megjelenítjük - LÁTVÁNYOSABB
          // Hozzáadjuk a nyertes számot és színét az értesítéshez
          const numberColor = getNumberColor(finalNum);
          const colorText = numberColor === 'green' ? 'Zöld' : numberColor === 'red' ? 'Piros' : 'Fekete';
          
          // ÉRTESÍTÉS KÜLDÉSE - MINDIG KÜLDÜNK, NYERTÉL VAGY NEM NYERTÉL
          let message;
          let notificationType;
          if (winAmount > 0) {
            message = `🎉 GRATULÁLOK! ${winAmount.toLocaleString('hu-HU')} HUF NYEREMÉNY! 🎉 Nyerő szám: ${finalNum} (${colorText})`;
            notificationType = 'win';
          } else {
            message = `❌ SAJNOS MOST NEM NYERT. PRÓBÁLJA ÚJRA! ❌ Nyerő szám: ${finalNum} (${colorText})`;
            notificationType = 'lose';
          }
          
          console.log('🎰 Üzenet beállítása:', message);
          console.log('🎰 Értesítés típusa:', notificationType);
          console.log('🎰 onNotification függvény típusa:', typeof onNotification);
          console.log('🎰 onNotification függvény értéke:', onNotification);
          
          setWinMessage(message);
          
          // Értesítés küldése a parent komponensnek (Casino) - MINDIG
          try {
            if (onNotification && typeof onNotification === 'function') {
              console.log('🎰 Értesítés küldése most:', message, notificationType);
              onNotification(message, notificationType);
              console.log('🎰 Értesítés elküldve!');
            } else {
              console.error('❌ onNotification nincs megadva vagy nem függvény!', { onNotification, type: typeof onNotification });
            }
          } catch (error) {
            console.error('❌ Hiba az értesítés küldése során:', error);
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
            {/* Középső szám komponens - külön komponens, mutatja a nyertes számot */}
            <WheelCenterNumber
              finalNumber={finalNumber !== null && finalNumber !== undefined ? Number(finalNumber) : (lastResult?.winningNumber ?? null)}
              isSpinning={isSpinning}
            />
            <div className="wheel-wrapper">
              <div className={`roulette-wheel ${isSpinning ? 'spinning' : ''}`} style={{ transform: `rotate(${currentRotation}deg)` }}>
                <div className="wheel-center">
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
              {/* Számok táblázat - vízszintes elrendezés (12 oszlop x 3 sor) + 2 to 1 oszlopok */}
              <div className="numbers-grid-with-columns">
                {/* Számok grid */}
                <div className="numbers-grid">
                  {TABLE_LAYOUT.map((row, rowIdx) => 
                    row.map((num, colIdx) => {
                      const color = getNumberColor(num);
                      return (
                        <div
                          key={`${rowIdx}-${colIdx}-${num}`}
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
                    })
                  )}
                </div>

                {/* Oszlop fogadások (2:1) - jobbra, sorok végén */}
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
            </div>

            {/* Dozen fogadások - pontosan a számok grid szerint 4-4 oszlopra */}
            <div className="dozens-bets-wrapper">
              <div className="dozens-bets">
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

