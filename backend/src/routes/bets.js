const express = require('express');
const { pool, query } = require('../db');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function buildInClause(ids = []) {
  if (!ids.length) {
    return { clause: '', params: [] };
  }
  return {
    clause: `(${ids.map(() => '?').join(',')})`,
    params: ids,
  };
}

async function attachOutcomes(bets) {
  if (!bets.length) {
    return [];
  }
  const { clause, params } = buildInClause(bets.map((bet) => bet.id));
  const outcomes = await query(
    `SELECT id, bet_id, label, odds, base_odds, total_stake, order_index
       FROM bet_outcomes
      WHERE bet_id IN ${clause}
      ORDER BY order_index ASC`,
    params,
  );
  const grouped = outcomes.reduce((acc, outcome) => {
    if (!acc[outcome.bet_id]) {
      acc[outcome.bet_id] = [];
    }
    acc[outcome.bet_id].push({
      id: outcome.id,
      label: outcome.label,
      odds: Number(outcome.odds),
      base_odds: Number(outcome.base_odds),
      total_stake: Number(outcome.total_stake),
      order_index: outcome.order_index,
    });
    return acc;
  }, {});

  return bets.map((bet) => ({
    ...bet,
    outcomes: grouped[bet.id] || [],
  }));
}

router.get('/', async (_req, res) => {
  const bets = await query(
    `SELECT id, title, description, status, result_outcome_id, created_at, closes_at
       FROM bets
      WHERE status = 'OPEN'
      ORDER BY created_at DESC`,
  );
  const enriched = await attachOutcomes(
    bets.map((bet) => ({
      ...bet,
      status: bet.status,
    })),
  );
  return res.json({ bets: enriched });
});

router.get('/me/history', auth(), async (req, res) => {
  const rows = await query(
    `SELECT ub.id,
            ub.selection,
            ub.stake,
            ub.potential_win,
            ub.status,
            ub.created_at,
            ub.odds_snapshot,
            b.title,
            b.result_outcome_id,
            win.label AS result_label
       FROM user_bets ub
       JOIN bets b ON b.id = ub.bet_id
  LEFT JOIN bet_outcomes win ON win.id = b.result_outcome_id
      WHERE ub.user_id = ?
      ORDER BY ub.created_at DESC`,
    [req.user.id],
  );
  return res.json({ bets: rows });
});

router.get('/me/active', auth(), async (req, res) => {
  const rows = await query(
    `SELECT ub.id,
            ub.selection,
            ub.stake,
            ub.potential_win,
            ub.status,
            ub.created_at,
            ub.odds_snapshot,
            b.title
       FROM user_bets ub
       JOIN bets b ON b.id = ub.bet_id
      WHERE ub.user_id = ?
        AND ub.status = 'PENDING'
      ORDER BY ub.created_at DESC`,
    [req.user.id],
  );
  return res.json({ bets: rows });
});

router.get('/admin', auth(), requireAdmin, async (_req, res) => {
  const bets = await query(
    `SELECT id, title, description, status, result_outcome_id,
            created_at, closes_at
       FROM bets
      ORDER BY created_at DESC`,
  );
  const enriched = await attachOutcomes(bets);
  return res.json({ bets: enriched });
});

router.post('/', auth(), requireAdmin, async (req, res) => {
  const {
    title,
    description,
    closes_at: closesAt,
    outcomes,
  } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ message: 'A cím megadása kötelező' });
  }

  if (!Array.isArray(outcomes) || outcomes.length < 2 || outcomes.length > 3) {
    return res.status(400).json({ message: '2 vagy 3 kimenetet kell megadni' });
  }

  const sanitizedOutcomes = outcomes.map((outcome, index) => ({
    label: outcome.label?.trim(),
    odds: Number(outcome.odds),
    order_index: index,
  }));

  if (sanitizedOutcomes.some((outcome) => !outcome.label || !outcome.odds || outcome.odds <= 1)) {
    return res.status(400).json({ message: 'Érvényes kimeneti nevek és oddsok szükségesek' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO bets (title, description, closes_at, created_by)
       VALUES (?, ?, ?, ?)`,
      [title, description || '', closesAt || null, req.user.id],
    );

    const betId = result.insertId;
    for (const outcome of sanitizedOutcomes) {
      await connection.execute(
        `INSERT INTO bet_outcomes (bet_id, label, odds, base_odds, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        [betId, outcome.label, outcome.odds, outcome.odds, outcome.order_index],
      );
    }

    await connection.commit();
    const [bet] = await query('SELECT id, title, description, status, result_outcome_id, created_at, closes_at FROM bets WHERE id = ?', [betId]);
    const enriched = await attachOutcomes([bet]);
    return res.status(201).json({ bet: enriched[0] });
  } catch (err) {
    await connection.rollback();
    return res.status(500).json({ message: 'Hiba történt a fogadás létrehozásakor' });
  } finally {
    connection.release();
  }
});

function computeAdjustedOdds(outcomes, selectedId) {
  const decreaseFactor = 0.97;
  const increaseFactor = 1.02;
  const minOdds = 1.05;
  const maxOdds = 25;

  return outcomes.map((outcome) => {
    const factor = outcome.id === selectedId ? decreaseFactor : increaseFactor;
    const updated = Number((Number(outcome.odds) * factor).toFixed(2));
    const clamped = Math.min(Math.max(updated, minOdds), maxOdds);
    return { ...outcome, newOdds: clamped };
  });
}

router.post('/:id/place', auth(), async (req, res) => {
  const betId = Number(req.params.id);
  const { outcome_id: outcomeId, stake } = req.body;

  const numericStake = Number(stake);
  if (!numericStake || numericStake <= 0) {
    return res.status(400).json({ message: 'Érvénytelen tét' });
  }
  if (!outcomeId) {
    return res.status(400).json({ message: 'Válassz kimenetet' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [betRows] = await connection.execute(
      `SELECT id, title, status
         FROM bets
        WHERE id = ?
        FOR UPDATE`,
      [betId],
    );
    const bet = betRows[0];
    if (!bet || bet.status !== 'OPEN') {
      throw new Error('NOT_AVAILABLE');
    }

    const [outcomeRows] = await connection.execute(
      'SELECT id, label, odds FROM bet_outcomes WHERE bet_id = ? FOR UPDATE',
      [betId],
    );
    const selectedOutcome = outcomeRows.find((row) => row.id === Number(outcomeId));
    if (!selectedOutcome) {
      throw new Error('OUTCOME_NOT_FOUND');
    }

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user || Number(user.balance) < numericStake) {
      throw new Error('NO_BALANCE');
    }

    const potentialWin = Number((numericStake * Number(selectedOutcome.odds)).toFixed(2));

    await connection.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [numericStake, req.user.id],
    );

    await connection.execute(
      `INSERT INTO user_bets (user_id, bet_id, outcome_id, selection, odds_snapshot, stake, potential_win)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, betId, selectedOutcome.id, selectedOutcome.label, selectedOutcome.odds, numericStake, potentialWin],
    );

    await connection.execute(
      'UPDATE bet_outcomes SET total_stake = total_stake + ? WHERE id = ?',
      [numericStake, selectedOutcome.id],
    );

    const adjusted = computeAdjustedOdds(outcomeRows, selectedOutcome.id);
    for (const outcome of adjusted) {
      await connection.execute('UPDATE bet_outcomes SET odds = ? WHERE id = ?', [outcome.newOdds, outcome.id]);
    }

    await connection.commit();
    return res.status(201).json({
      message: 'Fogadás leadva',
      potentialWin,
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    const map = {
      NOT_AVAILABLE: { status: 400, message: 'A fogadás nem elérhető' },
      OUTCOME_NOT_FOUND: { status: 400, message: 'A kiválasztott opció nem található' },
      NO_BALANCE: { status: 400, message: 'Nincs elegendő egyenleg' },
    };
    if (map[err.message]) {
      return res.status(map[err.message].status).json({ message: map[err.message].message });
    }
    return res.status(500).json({ message: 'Hiba a fogadás során' });
  } finally {
    connection.release();
  }
});

router.post('/:id/close', auth(), requireAdmin, async (req, res) => {
  const betId = Number(req.params.id);
  const { outcome_id: outcomeId } = req.body;

  if (!outcomeId) {
    return res.status(400).json({ message: 'Érvénytelen eredmény' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [betRows] = await connection.execute('SELECT * FROM bets WHERE id = ? FOR UPDATE', [betId]);
    const bet = betRows[0];
    if (!bet || bet.status !== 'OPEN') {
      throw new Error('NOT_AVAILABLE');
    }

    const [outcomeRows] = await connection.execute('SELECT id FROM bet_outcomes WHERE bet_id = ?', [betId]);
    const validOutcome = outcomeRows.some((row) => row.id === Number(outcomeId));
    if (!validOutcome) {
      throw new Error('OUTCOME_NOT_FOUND');
    }

    await connection.execute(
      'UPDATE bets SET status = \'CLOSED\', result_outcome_id = ? WHERE id = ?',
      [outcomeId, betId],
    );

    const [winningBets] = await connection.execute(
      `SELECT ub.id, ub.user_id, ub.potential_win
         FROM user_bets ub
        WHERE ub.bet_id = ? AND ub.outcome_id = ? FOR UPDATE`,
      [betId, outcomeId],
    );

    for (const wager of winningBets) {
      await connection.execute(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [wager.potential_win, wager.user_id],
      );
      await connection.execute(
        'UPDATE user_bets SET status = \'WON\' WHERE id = ?',
        [wager.id],
      );
    }

    await connection.execute(
      `UPDATE user_bets
          SET status = 'LOST'
        WHERE bet_id = ?
          AND outcome_id <> ?`,
      [betId, outcomeId],
    );

    await connection.commit();
    return res.json({ message: 'Fogadás lezárva' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    const map = {
      NOT_AVAILABLE: { status: 400, message: 'Ez a fogadás már lezárt' },
      OUTCOME_NOT_FOUND: { status: 400, message: 'Ismeretlen kimenet' },
    };
    if (map[err.message]) {
      return res.status(map[err.message].status).json({ message: map[err.message].message });
    }
    return res.status(500).json({ message: 'Hiba a lezárás során' });
  } finally {
    connection.release();
  }
});

module.exports = router;

