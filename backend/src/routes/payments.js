const express = require('express');
const { pool, query } = require('../db');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const MIN_WITHDRAWAL = 5000;
const MIN_DEPOSIT = 5000;

router.post('/withdraw', auth(), async (req, res) => {
  const { amount } = req.body;
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount < MIN_WITHDRAWAL) {
    return res.status(400).json({ message: `Minimum kifizetés: ${MIN_WITHDRAWAL.toLocaleString('hu-HU')} HUF` });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user || Number(user.balance) < numericAmount) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    await connection.execute(
      `INSERT INTO transactions (user_id, type, amount, status)
       VALUES (?, 'WITHDRAWAL', ?, 'PENDING')`,
      [req.user.id, numericAmount],
    );

    await connection.commit();
    connection.release();
    return res.status(201).json({ message: 'Kifizetési kérelem elküldve. Az admin hamarosan feldolgozza.' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ message: 'Hiba a kérés során' });
  }
});

router.post('/deposit', auth(), async (req, res) => {
  const { amount } = req.body;
  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount < MIN_DEPOSIT) {
    return res.status(400).json({ message: `Minimum befizetés: ${MIN_DEPOSIT.toLocaleString('hu-HU')} HUF` });
  }

  try {
    await query(
      `INSERT INTO transactions (user_id, type, amount, status)
       VALUES (?, 'DEPOSIT', ?, 'PENDING')`,
      [req.user.id, numericAmount],
    );
    return res.status(201).json({ message: 'Befizetési kérelem elküldve. Az admin hamarosan feldolgozza.' });
  } catch (err) {
    return res.status(500).json({ message: 'Hiba a kérés során' });
  }
});

router.get('/me', auth(), async (req, res) => {
  const rows = await query(
    `SELECT id, type, amount, status, created_at, processed_at
       FROM transactions
      WHERE user_id = ?
      ORDER BY created_at DESC`,
    [req.user.id],
  );
  return res.json({ transactions: rows });
});

router.get('/admin/pending', auth(), requireAdmin, async (_req, res) => {
  const rows = await query(
    `SELECT t.id, t.user_id, t.type, t.amount, t.status, t.created_at,
            u.username, u.email
       FROM transactions t
       JOIN users u ON u.id = t.user_id
      WHERE t.status = 'PENDING'
      ORDER BY t.created_at ASC`,
  );
  return res.json({ transactions: rows });
});

router.post('/admin/:id/approve', auth(), requireAdmin, async (req, res) => {
  const transactionId = Number(req.params.id);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [txRows] = await connection.execute(
      'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
      [transactionId],
    );
    const transaction = txRows[0];
    if (!transaction || transaction.status !== 'PENDING') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Érvénytelen tranzakció' });
    }

    if (transaction.type === 'WITHDRAWAL') {
      const [userRows] = await connection.execute(
        'SELECT balance FROM users WHERE id = ? FOR UPDATE',
        [transaction.user_id],
      );
      const user = userRows[0];
      if (Number(user.balance) < Number(transaction.amount)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ message: 'A felhasználónak nincs elegendő egyenlege' });
      }
      await connection.execute(
        'UPDATE users SET balance = balance - ? WHERE id = ?',
        [transaction.amount, transaction.user_id],
      );
    } else if (transaction.type === 'DEPOSIT') {
      await connection.execute(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [transaction.amount, transaction.user_id],
      );
    }

    await connection.execute(
      'UPDATE transactions SET status = ?, processed_by = ?, processed_at = NOW() WHERE id = ?',
      ['COMPLETED', req.user.id, transactionId],
    );

    await connection.commit();
    connection.release();
    return res.json({ message: 'Tranzakció jóváhagyva' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ message: 'Hiba a feldolgozás során' });
  }
});

router.post('/admin/:id/reject', auth(), requireAdmin, async (req, res) => {
  const transactionId = Number(req.params.id);
  try {
    await query(
      'UPDATE transactions SET status = ?, processed_by = ?, processed_at = NOW() WHERE id = ?',
      ['REJECTED', req.user.id, transactionId],
    );
    return res.json({ message: 'Tranzakció elutasítva' });
  } catch (err) {
    return res.status(500).json({ message: 'Hiba a feldolgozás során' });
  }
});

module.exports = router;

