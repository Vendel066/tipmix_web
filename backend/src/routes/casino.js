const express = require('express');
const { pool, query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Gem/Bomba játék - játék indítása (tét levonása)
router.post('/gem/start', auth(), async (req, res) => {
  const { bet, gridSize, bombs } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }
    
    if (Number(user.balance) < numericBet) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    // Játék indításakor azonnal levonjuk a tétet
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [
      numericBet,
      req.user.id,
    ]);

    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ message: 'Hiba a játék indításakor' });
  }
});

// Gem/Bomba játék - cella felfedés
router.post('/gem/reveal', auth(), async (req, res) => {
  const { bet, gridSize, bombs, revealedCount, currentMultiplier } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }

    // 50-50% esély bomba vagy gem
    const isBomb = Math.random() < 0.5;
    
    let newMultiplier = Number(currentMultiplier);
    if (!isBomb) {
      // Gem esetén növeljük a szorzót
      // Az első gem után 1.32x, második után 1.74x, harmadik után 2.30x stb.
      // Minden gem után egyre nagyobb növekmény
      if (revealedCount === 0) {
        // Első gem: 1.32x
        newMultiplier = 1.32;
      } else {
        // További gem-ek: növekvő növekmény
        const increments = [0.32, 0.42, 0.56, 0.74, 0.98, 1.28, 1.66, 2.14, 2.74, 3.48];
        const increment = increments[Math.min(revealedCount, increments.length - 1)] || 0.32;
        newMultiplier = Number((currentMultiplier + increment).toFixed(2));
      }
    }

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      isBomb,
      newMultiplier,
      newBalance: Number(user.balance), // A tét már levonva volt a start-nál
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ message: 'Hiba a játék során' });
  }
});

// Gem/Bomba játék - cashout
router.post('/gem/cashout', auth(), async (req, res) => {
  const { bet, multiplier, revealedCount } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];

    const winAmount = Number((numericBet * multiplier).toFixed(2));

    await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
      winAmount,
      req.user.id,
    ]);

    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);

    const [result] = await connection.execute(
      `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
       VALUES (?, 'MINESWEEPER', ?, ?, ?, 'WON')`,
      [
        req.user.id,
        numericBet,
        winAmount,
        JSON.stringify({ multiplier, revealedCount }),
      ],
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      winAmount,
      newBalance,
      gameId: result.insertId,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ message: 'Hiba a kifizetés során' });
  }
});

// Rulett játék - fogadás és forgatás
router.post('/roulette/spin', auth(), async (req, res) => {
  const { bets } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }

    // Összes tét számítása
    const totalBet = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
    
    if (Number(user.balance) < totalBet) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    // Tét levonása
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [
      totalBet,
      req.user.id,
    ]);
    
    // Egyenleg tét levonása után (még nincs hozzáadva a nyeremény)
    const balanceAfterBet = Number(user.balance) - totalBet;

    // Véletlenszerű szám generálása (0-36) - crypto-secure random
    // Math.random() helyett jobb random generátor használata
    const crypto = require('crypto');
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
    const winningNumber = Math.floor(randomValue * 37);
    
    console.log(`🎰 Rulett nyerő szám generálva: ${winningNumber}`);

    // Nyeremény számítása
    let totalWin = 0;
    const winDetails = [];

    console.log(`🎰 Feldolgozás: ${bets.length} tét, nyerő szám: ${winningNumber}`);
    
    bets.forEach((bet) => {
      const amount = Number(bet.amount);
      let won = false;
      let winAmount = 0;

      console.log(`🎰 Tét feldolgozása: type=${bet.type}, value=${bet.value}, amount=${amount}`);

      switch (bet.type) {
        case 'number':
          if (winningNumber === Number(bet.value)) {
            won = true;
            winAmount = amount * 36; // 35:1 odds + eredeti tét = 36x összesen
          }
          break;
        case 'color':
          const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
          const isBlack = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35].includes(winningNumber);
          if ((bet.value === 'red' && isRed) || (bet.value === 'black' && isBlack)) {
            won = true;
            winAmount = amount * 2; // 1:1
          }
          break;
        case 'even':
          if (winningNumber !== 0 && winningNumber % 2 === 0) {
            won = true;
            winAmount = amount * 2; // 1:1
          }
          break;
        case 'odd':
          if (winningNumber !== 0 && winningNumber % 2 === 1) {
            won = true;
            winAmount = amount * 2; // 1:1
          }
          break;
        case 'range':
          if (bet.value === '1-18' && winningNumber >= 1 && winningNumber <= 18) {
            won = true;
            winAmount = amount * 2; // 1:1
          } else if (bet.value === '19-36' && winningNumber >= 19 && winningNumber <= 36) {
            won = true;
            winAmount = amount * 2; // 1:1
          }
          break;
        case 'dozen':
          if (bet.value === 1 && winningNumber >= 1 && winningNumber <= 12) {
            won = true;
            winAmount = amount * 3; // 2:1
          } else if (bet.value === 2 && winningNumber >= 13 && winningNumber <= 24) {
            won = true;
            winAmount = amount * 3; // 2:1
          } else if (bet.value === 3 && winningNumber >= 25 && winningNumber <= 36) {
            won = true;
            winAmount = amount * 3; // 2:1
          }
          break;
        case 'column':
          // Oszlop 1: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
          // Oszlop 2: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
          // Oszlop 3: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
          const column1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
          const column2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
          const column3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
          
          if (bet.value === 1 && column1.includes(winningNumber)) {
            won = true;
            winAmount = amount * 3; // 2:1
          } else if (bet.value === 2 && column2.includes(winningNumber)) {
            won = true;
            winAmount = amount * 3; // 2:1
          } else if (bet.value === 3 && column3.includes(winningNumber)) {
            won = true;
            winAmount = amount * 3; // 2:1
          }
          break;
      }

      if (won) {
        totalWin += winAmount;
        winDetails.push({ bet, winAmount });
        console.log(`🎰 ✅ Nyert tét: type=${bet.type}, value=${bet.value}, nyeremény=${winAmount}`);
      } else {
        console.log(`🎰 ❌ Vesztett tét: type=${bet.type}, value=${bet.value}`);
      }
    });
    
    console.log(`🎰 Összes nyeremény: ${totalWin} HUF`);

    // NE adjuk hozzá a nyereményt azonnal az adatbázishoz!
    // A frontend-ben az animáció végén hívunk egy külön API-t, ami hozzáadja a nyereményt.
    // Itt csak számoljuk ki a végső egyenleget.
    const newBalance = balanceAfterBet + totalWin;
    
    // Az adatbázisban csak a tét van levonva, a nyeremény még nincs hozzáadva

    // Játék mentése az adatbázisba
    const status = totalWin > 0 ? 'WON' : 'LOST';
    const gameData = JSON.stringify({ winningNumber, bets, winDetails });
    
    console.log(`🎰 Adatbázis mentés: user_id=${req.user.id}, bet_amount=${totalBet}, win_amount=${totalWin}, status=${status}`);
    
    await connection.execute(
      `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
       VALUES (?, 'ROULETTE', ?, ?, ?, ?)`,
      [
        req.user.id,
        totalBet,
        totalWin,
        gameData,
        status,
      ],
    );

    await connection.commit();
    connection.release();
    
    console.log(`🎰 Adatbázis mentés sikeres!`);
    
    return res.json({
      success: true,
      winningNumber,
      totalBet,
      winAmount: totalWin,
      newBalance: newBalance, // Tét levonva + nyeremény hozzáadva (számított érték)
      balanceAfterBet: balanceAfterBet, // Egyenleg tét levonása után (adatbázisban lévő érték)
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Roulette spin error:', err);
    return res.status(500).json({ message: 'Hiba a játék során' });
  }
});

// Nyeremény hozzáadása az animáció végén
router.post('/roulette/add-win', auth(), async (req, res) => {
  const { winAmount } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }

    // Nyeremény hozzáadása
    if (winAmount > 0) {
      await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
        winAmount,
        req.user.id,
      ]);
    }

    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Add win error:', err);
    return res.status(500).json({ message: 'Hiba a nyeremény hozzáadása során' });
  }
});

// Mines játék - játék indítása (tét levonása)
router.post('/mines/start', auth(), async (req, res) => {
  const { bet, gridSize, bombs } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }
    
    if (Number(user.balance) < numericBet) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    if (bombs >= gridSize * gridSize) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Túl sok akna! Az aknák száma kevesebb kell legyen, mint a rács celláinak száma.' });
    }

    // Játék indításakor azonnal levonjuk a tétet
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [
      numericBet,
      req.user.id,
    ]);

    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Mines start error:', err);
    return res.status(500).json({ message: 'Hiba a játék indításakor' });
  }
});

// Mines játék - cella felfedés
router.post('/mines/reveal', auth(), async (req, res) => {
  const { bet, gridSize, bombs, cellId, gemCount, currentMultiplier, isBomb } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }

    // Ha aknára léptünk, nem számoljuk a szorzót
    if (isBomb) {
      await connection.commit();
      connection.release();
      return res.json({
        success: true,
        isBomb: true,
        newMultiplier: currentMultiplier,
        newBalance: Number(user.balance),
      });
    }

    // Gyémántot találtunk - számoljuk az új szorzót
    const multiplierTable = [1.0, 1.32, 1.74, 2.30, 3.04, 4.02, 5.30, 7.00, 9.24, 12.20, 16.10, 21.25, 28.05, 37.03, 48.88, 64.52, 85.17, 112.42, 148.40, 195.88, 258.56];
    const newGemCount = gemCount + 1;
    const newMultiplier = multiplierTable[Math.min(newGemCount, multiplierTable.length - 1)] || multiplierTable[multiplierTable.length - 1];
    
    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      isBomb: false,
      newMultiplier: Number(newMultiplier.toFixed(2)),
      newBalance: Number(user.balance),
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Mines reveal error:', err);
    return res.status(500).json({ message: 'Hiba a játék során' });
  }
});

// Mines játék - cashout
router.post('/mines/cashout', auth(), async (req, res) => {
  const { bet, gridSize, bombs, gemCount, multiplier, winAmount } = req.body;
  const numericBet = Number(bet);
  const numericWinAmount = Number(winAmount);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];

    // Nyeremény hozzáadása
    await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
      numericWinAmount,
      req.user.id,
    ]);

    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);

    // Játék mentése az adatbázisba
    const [result] = await connection.execute(
      `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
       VALUES (?, 'MINESWEEPER', ?, ?, ?, 'WON')`,
      [
        req.user.id,
        numericBet,
        numericWinAmount,
        JSON.stringify({ gridSize, bombs, gemCount, multiplier }),
      ],
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      winAmount: numericWinAmount,
      newBalance,
      gameId: result.insertId,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Mines cashout error:', err);
    return res.status(500).json({ message: 'Hiba a kifizetés során' });
  }
});

// Mines játék - gameover (aknára lépés)
router.post('/mines/gameover', auth(), async (req, res) => {
  const { bet, gridSize, bombs, gemCount, multiplier, winAmount } = req.body;
  const numericBet = Number(bet);
  const numericWinAmount = Number(winAmount) || 0;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Játék mentése az adatbázisba (veszteség)
    const [result] = await connection.execute(
      `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
       VALUES (?, 'MINESWEEPER', ?, ?, ?, 'LOST')`,
      [
        req.user.id,
        numericBet,
        numericWinAmount,
        JSON.stringify({ gridSize, bombs, gemCount, multiplier }),
      ],
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      gameId: result.insertId,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Mines gameover error:', err);
    return res.status(500).json({ message: 'Hiba a játék mentése során' });
  }
});

// Játék előzmények
router.get('/history', auth(), async (req, res) => {
  const rows = await query(
    `SELECT id, game_type, bet_amount, win_amount, status, created_at, game_data
       FROM casino_games
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50`,
    [req.user.id],
  );
  return res.json({ games: rows });
});

// ========== BLACKJACK JÁTÉK ==========

// Kártyapakli generálása és keverése
function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  
  // Keverés - Fisher-Yates algoritmus
  const crypto = require('crypto');
  for (let i = deck.length - 1; i > 0; i--) {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xFFFFFFFF;
    const j = Math.floor(randomValue * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

// Kártya értékének kiszámítása
function getCardValue(card, currentHandValue = 0) {
  if (card.rank === 'A') {
    // Ha az ász hozzáadásával túllépi a 21-et, akkor 1, különben 11
    return currentHandValue + 11 > 21 ? 1 : 11;
  }
  if (['J', 'Q', 'K'].includes(card.rank)) {
    return 10;
  }
  return parseInt(card.rank, 10);
}

// Kéz értékének kiszámítása (kezeli az ászok változó értékét)
function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;
  
  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }
  
  // Csökkentjük az ászok értékét, ha túl sok lenne
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

// Blackjack ellenőrzés (A + 10 értékű lap = 21)
function isBlackjack(hand) {
  if (hand.length !== 2) return false;
  const values = hand.map(card => {
    if (card.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    if (card.rank === '10') return 10;
    return 0;
  });
  return values.reduce((a, b) => a + b, 0) === 21;
}

// Játék indítása - tét levonása és kezdő lapok osztása
router.post('/blackjack/start', auth(), async (req, res) => {
  const { bet } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }
    
    if (Number(user.balance) < numericBet) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    if (numericBet < 1000) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'A minimum tét 1000 HUF' });
    }

    // Tét levonása
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [
      numericBet,
      req.user.id,
    ]);

    // Új pakli generálása
    const deck = createDeck();
    
    // Kezdő lapok osztása: játékos 2 lap, osztó 2 lap (1 felfedve)
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);
    const playerBlackjack = isBlackjack(playerHand);
    const dealerBlackjack = isBlackjack(dealerHand);
    
    // Ha mindkét félnek van blackjack, akkor push (visszatérítés)
    let gameStatus = 'playing';
    let winAmount = 0;
    
    if (playerBlackjack && dealerBlackjack) {
      gameStatus = 'push';
      winAmount = numericBet; // Visszatérítés
      await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
        winAmount,
        req.user.id,
      ]);
    } else if (playerBlackjack) {
      // Játékos blackjack - 2.5x nyeremény (3:2 odds)
      gameStatus = 'player_blackjack';
      winAmount = Math.floor(numericBet * 2.5);
      await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
        winAmount,
        req.user.id,
      ]);
    }
    
    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);
    
    // Játék adatok elmentése (ha véget ért)
    let gameId = null;
    if (gameStatus !== 'playing') {
      const [result] = await connection.execute(
        `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
         VALUES (?, 'BLACKJACK', ?, ?, ?, ?)`,
        [
          req.user.id,
          numericBet,
          winAmount,
          JSON.stringify({
            playerHand,
            dealerHand,
            playerValue,
            dealerValue,
            playerBlackjack,
            dealerBlackjack,
            gameStatus,
          }),
          gameStatus === 'player_blackjack' ? 'WON' : 'PUSH',
        ],
      );
      gameId = result.insertId;
    }

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
      gameId,
      deck: deck.map(card => ({ suit: card.suit, rank: card.rank })), // Visszaadjuk a maradék paklit
      playerHand: playerHand.map(card => ({ suit: card.suit, rank: card.rank })),
      dealerHand: dealerHand.map(card => ({ suit: card.suit, rank: card.rank })), // Mindkét lapot visszaadjuk, a frontend rejti el a másodikat
      playerValue,
      dealerValue: getCardValue(dealerHand[0]), // Csak az első lap értékét mutatjuk
      playerBlackjack,
      dealerBlackjack: false, // Nem mutatjuk, hogy van-e dealer blackjack
      gameStatus,
      winAmount,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Blackjack start error:', err);
    return res.status(500).json({ message: 'Hiba a játék indításakor' });
  }
});

// Lap húzása (Hit)
router.post('/blackjack/hit', auth(), async (req, res) => {
  const { deck, playerHand, dealerHand, bet } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }

    // Új lap húzása
    const currentDeck = deck.map(c => ({ suit: c.suit, rank: c.rank }));
    if (currentDeck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'A pakli üres' });
    }
    
    const newCard = currentDeck.pop();
    const newPlayerHand = [...playerHand, newCard];
    const playerValue = calculateHandValue(newPlayerHand);
    
    let gameStatus = 'playing';
    let winAmount = 0;
    let finalDealerHand = dealerHand;
    let finalDealerValue = 0;
    
    // Ha a játékos túllépi a 21-et (bust), akkor vesztett
    if (playerValue > 21) {
      gameStatus = 'player_bust';
      finalDealerHand = dealerHand; // Dealer lapjai maradnak rejtve
      finalDealerValue = calculateHandValue(dealerHand);
      
      // Játék mentése
      const [result] = await connection.execute(
        `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
         VALUES (?, 'BLACKJACK', ?, ?, ?, 'LOST')`,
        [
          req.user.id,
          numericBet,
          0,
          JSON.stringify({
            playerHand: newPlayerHand,
            dealerHand,
            playerValue,
            dealerValue: finalDealerValue,
            gameStatus,
          }),
        ],
      );
      
      await connection.commit();
      connection.release();
      
      return res.json({
        success: true,
        newBalance: Number(user.balance),
        gameId: result.insertId,
        playerHand: newPlayerHand,
        dealerHand,
        playerValue,
        dealerValue: finalDealerValue,
        gameStatus,
        winAmount: 0,
        deck: currentDeck,
      });
    }
    
    // Frissített egyenleg (nincs változás, még játszik)
    const newBalance = Number(user.balance);
    
    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
      playerHand: newPlayerHand,
      dealerHand,
      playerValue,
      dealerValue: calculateHandValue(dealerHand),
      gameStatus,
      deck: currentDeck,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Blackjack hit error:', err);
    return res.status(500).json({ message: 'Hiba a lap húzása során' });
  }
});

// Stand (megállás) - osztó játszik
router.post('/blackjack/stand', auth(), async (req, res) => {
  const { deck, playerHand, dealerHand, bet } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }

    // Osztó lapjainak kijátszása
    const currentDeck = deck.map(c => ({ suit: c.suit, rank: c.rank }));
    const fullDealerHand = [...dealerHand];
    
    // Osztó húz addig, amíg 17-nél kisebb az értéke (vagy puha 17-nél)
    while (true) {
      const dealerValue = calculateHandValue(fullDealerHand);
      // Osztó megáll, ha 17 vagy több
      if (dealerValue >= 17) {
        break;
      }
      
      // Ha nincs több lap, vége
      if (currentDeck.length === 0) {
        break;
      }
      
      // Új lap húzása
      const newCard = currentDeck.pop();
      fullDealerHand.push(newCard);
    }
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(fullDealerHand);
    
    // Eredmény meghatározása
    let gameStatus = '';
    let winAmount = 0;
    
    if (dealerValue > 21) {
      // Dealer bust - játékos nyert
      gameStatus = 'dealer_bust';
      winAmount = numericBet * 2; // 1:1 odds
    } else if (playerValue > dealerValue) {
      // Játékos értéke nagyobb
      gameStatus = 'player_win';
      winAmount = numericBet * 2; // 1:1 odds
    } else if (playerValue < dealerValue) {
      // Dealer értéke nagyobb
      gameStatus = 'dealer_win';
      winAmount = 0;
    } else {
      // Döntetlen (push)
      gameStatus = 'push';
      winAmount = numericBet; // Visszatérítés
    }
    
    // Nyeremény hozzáadása
    if (winAmount > 0) {
      await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
        winAmount,
        req.user.id,
      ]);
    }
    
    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);
    
    // Játék mentése
    const [result] = await connection.execute(
      `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
       VALUES (?, 'BLACKJACK', ?, ?, ?, ?)`,
      [
        req.user.id,
        numericBet,
        winAmount,
        JSON.stringify({
          playerHand,
          dealerHand: fullDealerHand,
          playerValue,
          dealerValue,
          gameStatus,
        }),
        winAmount > 0 ? 'WON' : 'LOST',
      ],
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
      gameId: result.insertId,
      playerHand,
      dealerHand: fullDealerHand,
      playerValue,
      dealerValue,
      gameStatus,
      winAmount,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Blackjack stand error:', err);
    return res.status(500).json({ message: 'Hiba a stand során' });
  }
});

// Double down (duplázás)
router.post('/blackjack/double', auth(), async (req, res) => {
  const { deck, playerHand, dealerHand, bet } = req.body;
  const numericBet = Number(bet);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Felhasználó nem található' });
    }
    
    // Ellenőrizzük, hogy van-e elegendő egyenleg
    if (Number(user.balance) < numericBet) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg a duplázáshoz' });
    }
    
    // Tét duplázása (még egyszer levonjuk)
    await connection.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [
      numericBet,
      req.user.id,
    ]);
    
    const totalBet = numericBet * 2; // Dupla tét
    
    // Új lap húzása
    const currentDeck = deck.map(c => ({ suit: c.suit, rank: c.rank }));
    if (currentDeck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'A pakli üres' });
    }
    
    const newCard = currentDeck.pop();
    const newPlayerHand = [...playerHand, newCard];
    const playerValue = calculateHandValue(newPlayerHand);
    
    // Osztó lapjainak kijátszása (automatikusan)
    const fullDealerHand = [...dealerHand];
    
    while (true) {
      const dealerValue = calculateHandValue(fullDealerHand);
      if (dealerValue >= 17) {
        break;
      }
      if (currentDeck.length === 0) {
        break;
      }
      const newCard = currentDeck.pop();
      fullDealerHand.push(newCard);
    }
    
    const dealerValue = calculateHandValue(fullDealerHand);
    
    // Eredmény meghatározása
    let gameStatus = '';
    let winAmount = 0;
    
    if (playerValue > 21) {
      // Játékos bust
      gameStatus = 'player_bust';
      winAmount = 0;
    } else if (dealerValue > 21) {
      // Dealer bust
      gameStatus = 'dealer_bust';
      winAmount = totalBet * 2; // 1:1 odds a dupla tétre
    } else if (playerValue > dealerValue) {
      // Játékos nyert
      gameStatus = 'player_win';
      winAmount = totalBet * 2; // 1:1 odds a dupla tétre
    } else if (playerValue < dealerValue) {
      // Dealer nyert
      gameStatus = 'dealer_win';
      winAmount = 0;
    } else {
      // Döntetlen
      gameStatus = 'push';
      winAmount = totalBet; // Visszatérítés
    }
    
    // Nyeremény hozzáadása
    if (winAmount > 0) {
      await connection.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [
        winAmount,
        req.user.id,
      ]);
    }
    
    // Frissített egyenleg lekérése
    const [updatedUserRows] = await connection.execute(
      'SELECT balance FROM users WHERE id = ?',
      [req.user.id],
    );
    const newBalance = Number(updatedUserRows[0].balance);
    
    // Játék mentése
    const [result] = await connection.execute(
      `INSERT INTO casino_games (user_id, game_type, bet_amount, win_amount, game_data, status)
       VALUES (?, 'BLACKJACK', ?, ?, ?, ?)`,
      [
        req.user.id,
        totalBet,
        winAmount,
        JSON.stringify({
          playerHand: newPlayerHand,
          dealerHand: fullDealerHand,
          playerValue,
          dealerValue,
          gameStatus,
          doubled: true,
        }),
        winAmount > 0 ? 'WON' : 'LOST',
      ],
    );

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance,
      gameId: result.insertId,
      playerHand: newPlayerHand,
      dealerHand: fullDealerHand,
      playerValue,
      dealerValue,
      gameStatus,
      winAmount,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Blackjack double error:', err);
    return res.status(500).json({ message: 'Hiba a duplázás során' });
  }
});

module.exports = router;
