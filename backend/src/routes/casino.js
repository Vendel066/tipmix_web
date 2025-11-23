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

module.exports = router;
