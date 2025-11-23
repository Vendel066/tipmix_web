// Európai rulett számok sorrendje (ahogy a keréken vannak)
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

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

function getNumberColor(num) {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

export default function WheelCenterNumber({ finalNumber, isSpinning }) {
  // Debug log - mindig loggoljuk, hogy lássuk mi történik
  console.log('🎰 WheelCenterNumber render:', { finalNumber, isSpinning, type: typeof finalNumber, finalNumberValue: finalNumber });
  
  // Csak a nyertes számot jelenítjük meg, amikor az megvan
  // Ellenőrizzük, hogy finalNumber !== null && finalNumber !== undefined
  // Ha 0 a szám, az is érvényes, ezért !== 0 ellenőrzést is kell tenni
  if (finalNumber === null || finalNumber === undefined || finalNumber === '') {
    console.log('🎰 WheelCenterNumber: finalNumber üres, megjelenítünk üres háttért');
    // Ne jelenítsünk meg semmit, ha nincs szám
    return null;
  }

  // Konvertáljuk számmá, ha szükséges
  const numValue = Number(finalNumber);
  if (isNaN(numValue)) {
    console.warn('🎰 WheelCenterNumber: finalNumber nem érvényes szám:', finalNumber);
    return (
      <div className="wheel-center-result-fixed" style={{ zIndex: 1000001 }}>
        <h1 className="wheel-center-number default" style={{ opacity: 0.7 }}>-</h1>
      </div>
    );
  }

  const numberData = ROULETTE_NUMBERS.find(item => item.num === numValue);
  if (!numberData) {
    console.warn('🎰 WheelCenterNumber: szám nem található a ROULETTE_NUMBERS-ben:', numValue);
    return (
      <div className="wheel-center-result-fixed" style={{ zIndex: 1000001 }}>
        <h1 className="wheel-center-number default" style={{ opacity: 0.7 }}>-</h1>
      </div>
    );
  }

  const numColor = getNumberColor(numberData.num);
  console.log('🎰 WheelCenterNumber: megjelenítés SUCCESS:', { num: numberData.num, color: numColor, finalNumber });

  return (
    <div className="wheel-center-result-fixed" style={{ zIndex: 1000001, pointerEvents: 'none' }}>
      <h1 
        className={`wheel-center-number ${numColor}`} 
        style={{ 
          opacity: 1, 
          visibility: 'visible',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '120px',
          height: '120px',
          margin: 0,
          padding: 0
        }}
      >
        {String(numberData.num)}
      </h1>
    </div>
  );
}

