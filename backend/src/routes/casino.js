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

    await connection.commit();
    connection.release();

    return res.json({
      success: true,
      newBalance: Number(user.balance) - numericBet,
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
      newBalance: Number(user.balance) + winAmount,
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
