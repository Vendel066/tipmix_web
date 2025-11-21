const express = require('express');
const { pool, query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const COMBO_BONUS_MULTIPLIER = 1.15;

router.post('/', auth(), async (req, res) => {
  const { selections, stake } = req.body;

  if (!Array.isArray(selections) || selections.length < 2) {
    return res.status(400).json({ message: 'Legalább 2 fogadást kell kiválasztani' });
  }

  const numericStake = Number(stake);
  if (!numericStake || numericStake <= 0) {
    return res.status(400).json({ message: 'Érvénytelen tét' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      'SELECT id, balance FROM users WHERE id = ? FOR UPDATE',
      [req.user.id],
    );
    const user = userRows[0];
    if (!user || Number(user.balance) < numericStake) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Nincs elegendő egyenleg' });
    }

    const betIds = [...new Set(selections.map((s) => s.bet_id))];
    const [betRows] = await connection.execute(
      `SELECT id, status FROM bets WHERE id IN (${betIds.map(() => '?').join(',')}) FOR UPDATE`,
      betIds,
    );
    const bets = betRows;
    if (bets.length !== betIds.length || bets.some((bet) => bet.status !== 'OPEN')) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Egy vagy több fogadás nem elérhető' });
    }

    const outcomeIds = selections.map((s) => s.outcome_id);
    const [outcomeRows] = await connection.execute(
      `SELECT id, bet_id, label, odds FROM bet_outcomes WHERE id IN (${outcomeIds.map(() => '?').join(',')})`,
      outcomeIds,
    );
    const outcomes = outcomeRows;
    if (outcomes.length !== outcomeIds.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ message: 'Érvénytelen kimenetek' });
    }

    const totalOdds = outcomes.reduce((acc, outcome) => acc * Number(outcome.odds), 1);
    const bonusOdds = totalOdds * COMBO_BONUS_MULTIPLIER;
    const potentialWin = Number((numericStake * bonusOdds).toFixed(2));

    const [comboResult] = await connection.execute(
      `INSERT INTO bet_combos (user_id, total_stake, total_odds, potential_win, status)
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [req.user.id, numericStake, bonusOdds, potentialWin],
    );
    const comboId = comboResult.insertId;

    for (const selection of selections) {
      const outcome = outcomes.find((o) => o.id === selection.outcome_id);
      if (!outcome) continue;
      await connection.execute(
        `INSERT INTO combo_selections (combo_id, bet_id, outcome_id, selection, odds_snapshot)
         VALUES (?, ?, ?, ?, ?)`,
        [comboId, selection.bet_id, selection.outcome_id, outcome.label, outcome.odds],
      );
    }

    await connection.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ?',
      [numericStake, req.user.id],
    );

    await connection.commit();
    connection.release();
    return res.status(201).json({
      message: 'Kötéses fogadás leadva',
      combo: {
        id: comboId,
        total_odds: bonusOdds,
        potential_win: potentialWin,
      },
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    return res.status(500).json({ message: 'Hiba a fogadás során' });
  }
});

router.get('/me', auth(), async (req, res) => {
  const rows = await query(
    `SELECT bc.id, bc.total_stake, bc.total_odds, bc.potential_win, bc.status, bc.created_at
       FROM bet_combos bc
      WHERE bc.user_id = ?
      ORDER BY bc.created_at DESC`,
    [req.user.id],
  );

  for (const combo of rows) {
    const selections = await query(
      `SELECT cs.bet_id, cs.outcome_id, cs.selection, cs.odds_snapshot,
              b.title AS bet_title
         FROM combo_selections cs
         JOIN bets b ON b.id = cs.bet_id
        WHERE cs.combo_id = ?`,
      [combo.id],
    );
    combo.selections = selections;
  }

  return res.json({ combos: rows });
});

async function checkComboStatus(comboId, connection) {
  const [selections] = await connection.execute(
    `SELECT cs.bet_id, cs.outcome_id, b.status, b.result_outcome_id
       FROM combo_selections cs
       JOIN bets b ON b.id = cs.bet_id
      WHERE cs.combo_id = ?`,
    [comboId],
  );

  if (selections.some((s) => s.status === 'OPEN')) {
    return 'PENDING';
  }

  const allWon = selections.every((s) => s.result_outcome_id === s.outcome_id);
  return allWon ? 'WON' : 'LOST';
}

async function checkCombos(connection) {
  const [pendingCombos] = await connection.execute(
    'SELECT id FROM bet_combos WHERE status = ?',
    ['PENDING'],
  );

  for (const combo of pendingCombos) {
    const newStatus = await checkComboStatus(combo.id, connection);
    if (newStatus !== 'PENDING') {
      await connection.execute('UPDATE bet_combos SET status = ? WHERE id = ?', [newStatus, combo.id]);
      if (newStatus === 'WON') {
        const [comboData] = await connection.execute(
          'SELECT user_id, potential_win FROM bet_combos WHERE id = ?',
          [combo.id],
        );
        if (comboData[0]) {
          await connection.execute(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [comboData[0].potential_win, comboData[0].user_id],
          );
        }
      }
    }
  }
}

router.post('/check', auth(), async (_req, res) => {
  const connection = await pool.getConnection();
  try {
    await checkCombos(connection);
    connection.release();
    return res.json({ message: 'Kötések ellenőrizve' });
  } catch (err) {
    connection.release();
    return res.status(500).json({ message: 'Hiba az ellenőrzés során' });
  }
});

module.exports = { router, checkCombos };

