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

// Helper function to calculate and update badge
async function calculateAndUpdateBadge(userId, isAdmin) {
  if (isAdmin) {
    await query('UPDATE users SET badge = ? WHERE id = ?', ['ADMIN', userId]);
    return 'ADMIN';
  }
  
  // Számoljuk a teljes befizetett összeget (COMPLETED DEPOSIT tranzakciók)
  const depositRows = await query(
    `SELECT COALESCE(SUM(amount), 0) as total_deposits
     FROM transactions
     WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'COMPLETED'`,
    [userId],
  );
  
  const totalDeposits = Number(depositRows[0]?.total_deposits || 0);
  let badge = 'NONE';
  
  if (totalDeposits >= 1000000) {
    badge = 'GOLD';
  } else if (totalDeposits >= 100000) {
    badge = 'SILVER';
  } else if (totalDeposits >= 20000) {
    badge = 'BRONZE';
  }
  
  // Update badge in database
  await query('UPDATE users SET badge = ? WHERE id = ?', [badge, userId]);
  return badge;
}

// Badge információk lekérdezése
router.get('/badge', auth(), async (req, res) => {
  try {
    // Admin badge ellenőrzése
    const isAdmin = Boolean(req.user.is_admin);
    
    // Try to get badge from database first
    let badge = null;
    try {
      const userRows = await query('SELECT badge FROM users WHERE id = ?', [req.user.id]);
      badge = userRows[0]?.badge || null;
    } catch (err) {
      // If badge column doesn't exist yet, calculate it
      if (err.message.includes('Unknown column')) {
        badge = null;
      } else {
        throw err;
      }
    }
    
    // If badge is not in DB or needs recalculation, calculate it
    if (!badge || badge === 'NONE') {
      badge = await calculateAndUpdateBadge(req.user.id, isAdmin);
    }
    
    // Számoljuk a teljes befizetett összeget (COMPLETED DEPOSIT tranzakciók)
    const depositRows = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_deposits
       FROM transactions
       WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'COMPLETED'`,
      [req.user.id],
    );
    
    const totalDeposits = Number(depositRows[0]?.total_deposits || 0);
    
    // Ha admin, akkor ADMIN badge-et adunk
    if (isAdmin) {
      return res.json({
        badge: 'ADMIN',
        badgeLevel: 999, // Legmagasabb szint
        totalDeposits,
        nextBadge: null,
        isAdmin: true,
      });
    }
    
    // Badge szint meghatározása (nem admin esetén)
    let badgeLevel = 0;
    let nextBadge = null;
    
    if (badge === 'GOLD') {
      badgeLevel = 3;
      nextBadge = null; // Nincs magasabb szint
    } else if (badge === 'SILVER') {
      badgeLevel = 2;
      nextBadge = { name: 'GOLD', amount: 1000000, remaining: 1000000 - totalDeposits };
    } else if (badge === 'BRONZE') {
      badgeLevel = 1;
      nextBadge = { name: 'SILVER', amount: 100000, remaining: 100000 - totalDeposits };
    } else {
      nextBadge = { name: 'BRONZE', amount: 20000, remaining: 20000 - totalDeposits };
    }
    
    return res.json({
      badge: badge === 'NONE' ? null : badge,
      badgeLevel,
      totalDeposits,
      nextBadge,
      isAdmin: false,
    });
  } catch (err) {
    console.error('Badge calculation error:', err);
    return res.status(500).json({ message: 'Hiba a badge számítás során' });
  }
});

// Felhasználók keresése pénz küldéshez (előbb kell lennie, hogy ne ütközzön az /admin/:id/reject route-tal)
router.get('/users/search', auth(), async (req, res) => {
  try {
    const { q } = req.query;
    console.log('User search request:', { q, userId: req.user.id });
    
    if (!q || q.trim().length < 2) {
      return res.json({ users: [] });
    }

    const trimmedQuery = q.trim();
    const searchTerm = `%${trimmedQuery}%`;
    
    // Keresés TRIM és LOWER használatával, és pontos egyezést is próbálunk
    // Először pontos egyezést keresünk (email vagy username)
    let users = await query(
      `SELECT id, username, email 
       FROM users 
       WHERE (LOWER(TRIM(email)) = LOWER(?) OR LOWER(TRIM(username)) = LOWER(?)) 
       AND id != ?`,
      [trimmedQuery, trimmedQuery, req.user.id],
    );

    console.log(`User search (exact): query="${trimmedQuery}", found ${users.length} users`);
    
    // Ha nincs pontos egyezés, akkor LIKE keresést próbálunk
    if (users.length === 0) {
      users = await query(
        `SELECT id, username, email 
         FROM users 
         WHERE (LOWER(TRIM(username)) LIKE LOWER(?) OR LOWER(TRIM(email)) LIKE LOWER(?)) 
         AND id != ?
         ORDER BY username ASC
         LIMIT 10`,
        [searchTerm, searchTerm, req.user.id],
      );
      console.log(`User search (LIKE): query="${trimmedQuery}", searchTerm="${searchTerm}", found ${users.length} users`);
    }

    // Debug: nézzük meg, milyen felhasználók vannak az adatbázisban
    if (users.length === 0) {
      const allUsers = await query(
        `SELECT id, username, email FROM users WHERE id != ? LIMIT 5`,
        [req.user.id],
      );
      console.log('Sample users in database:', allUsers);
    }

    return res.json({ users });
  } catch (err) {
    console.error('User search error:', err);
    return res.status(500).json({ message: 'Hiba a keresés során' });
  }
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
    
    // Update user badge if deposit was approved
    if (transaction.type === 'DEPOSIT') {
      try {
        const [userRows] = await connection.execute('SELECT is_admin FROM users WHERE id = ?', [transaction.user_id]);
        const isAdmin = Boolean(userRows[0]?.[0]?.is_admin);
        
        // Calculate total deposits for badge update (within transaction)
        const [depositRows] = await connection.execute(
          `SELECT COALESCE(SUM(amount), 0) as total_deposits
           FROM transactions
           WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'COMPLETED'`,
          [transaction.user_id],
        );
        
        const totalDeposits = Number(depositRows[0]?.[0]?.total_deposits || 0);
        let badge = 'NONE';
        
        if (isAdmin) {
          badge = 'ADMIN';
        } else if (totalDeposits >= 1000000) {
          badge = 'GOLD';
        } else if (totalDeposits >= 100000) {
          badge = 'SILVER';
        } else if (totalDeposits >= 20000) {
          badge = 'BRONZE';
        }
        
        await connection.execute('UPDATE users SET badge = ? WHERE id = ?', [badge, transaction.user_id]);
      } catch (err) {
        // If badge column doesn't exist yet, just log it
        if (err.message && err.message.includes('Unknown column')) {
          console.log('Badge column not available yet, skipping badge update');
        } else {
          console.error('Error updating badge:', err);
          // Don't throw, just log the error
        }
      }
    }

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

// Pénz küldése felhasználótól felhasználónak
router.post('/transfer', auth(), async (req, res) => {
  const { recipientId, amount, message } = req.body;
  const numericAmount = Number(amount);
  const recipientIdNum = Number(recipientId);

  if (!recipientIdNum || !numericAmount || numericAmount <= 0) {
    return res.status(400).json({ message: 'Érvénytelen adatok' });
  }

  if (recipientIdNum === req.user.id) {
    return res.status(400).json({ message: 'Nem küldhetsz pénzt saját magadnak' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Küldő egyenleg ellenőrzése
    const [senderRows] = await connection.execute(
      'SELECT id, balance, username FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const sender = senderRows[0];
    if (!sender) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Felhasználó nem található' });
    }

    if (Number(sender.balance) < numericAmount) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    // Fogadó ellenőrzése
    const [recipientRows] = await connection.execute(
      'SELECT id, username FROM users WHERE id = ? FOR UPDATE',
      [recipientIdNum],
    );
    const recipient = recipientRows[0];
    if (!recipient) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: 'Fogadó felhasználó nem található' });
    }

    // Egyenlegek frissítése
    await connection.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [numericAmount, req.user.id],
    );
    await connection.execute(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [numericAmount, recipientIdNum],
    );

    // Tranzakció rögzítése
    try {
      await connection.execute(
        `INSERT INTO transactions (user_id, type, amount, status, processed_by, processed_at)
         VALUES (?, 'TRANSFER_OUT', ?, 'COMPLETED', ?, NOW())`,
        [req.user.id, numericAmount, req.user.id],
      );
      await connection.execute(
        `INSERT INTO transactions (user_id, type, amount, status, processed_by, processed_at)
         VALUES (?, 'TRANSFER_IN', ?, 'COMPLETED', ?, NOW())`,
        [recipientIdNum, numericAmount, req.user.id],
      );
    } catch (txErr) {
      // Ha a TRANSFER típusok még nincsenek az adatbázisban, csak logoljuk, de folytatjuk
      if (txErr.message && txErr.message.includes('Unknown column') || 
          (txErr.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD')) {
        console.warn('TRANSFER types not available in transactions table. Run migration: db:migrate:transfer-types');
      } else {
        throw txErr;
      }
    }

    await connection.commit();
    connection.release();

    return res.json({
      message: `${numericAmount.toLocaleString('hu-HU')} HUF sikeresen elküldve ${recipient.username} felhasználónak`,
      newBalance: Number(sender.balance) - numericAmount,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Transfer error:', err);
    return res.status(500).json({ message: 'Hiba a pénz küldése során' });
  }
});

module.exports = router;

