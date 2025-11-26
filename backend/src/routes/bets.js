const express = require('express');
const { pool, query } = require('../db');
const { auth, requireAdmin } = require('../middleware/auth');
const { checkCombos } = require('./combos');

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
  // Próbáljuk meg lekérdezni a mezőket, ha hiányoznak, akkor használjunk NULL-t
  let bets;
  try {
    bets = await query(
      `SELECT id, title, description, status, result_outcome_id, created_at, closes_at, 
              COALESCE(parent_bet_id, NULL) as parent_bet_id, 
              COALESCE(minimum_bet, 100.00) as minimum_bet
       FROM bets
      WHERE status = 'OPEN' AND (parent_bet_id IS NULL OR parent_bet_id = 0)
      ORDER BY created_at DESC`,
    );
  } catch (err) {
    // Ha a mezők még nem léteznek, próbáljuk meg anélkül
    if (err.message.includes('Unknown column')) {
      bets = await query(
        `SELECT id, title, description, status, result_outcome_id, created_at, closes_at
         FROM bets
        WHERE status = 'OPEN'
        ORDER BY created_at DESC`,
      );
      // Hozzáadni az alapértelmezett értékeket
      bets = bets.map((bet) => ({ ...bet, parent_bet_id: null, minimum_bet: 100 }));
    } else {
      throw err;
    }
  }
  const enriched = await attachOutcomes(
    bets.map((bet) => ({
      ...bet,
      status: bet.status,
      minimum_bet: Number(bet.minimum_bet) || 100,
    })),
  );
  
  // Hozzáadni a részlet fogadásokat minden fő fogadáshoz
  for (const bet of enriched) {
    let detailBets = [];
    try {
      detailBets = await query(
        `SELECT id, title, description, status, result_outcome_id, created_at, closes_at, 
                COALESCE(minimum_bet, 100.00) as minimum_bet
         FROM bets
        WHERE parent_bet_id = ? AND status = 'OPEN'
        ORDER BY created_at ASC`,
        [bet.id],
      );
    } catch (err) {
      // Ha a parent_bet_id mező még nem létezik, nincs részlet fogadás
      if (!err.message.includes('Unknown column')) {
        throw err;
      }
    }
    if (detailBets.length > 0) {
      const detailBetsEnriched = await attachOutcomes(
        detailBets.map((db) => ({
          ...db,
          status: db.status,
          minimum_bet: Number(db.minimum_bet) || 100,
        })),
      );
      bet.detail_bets = detailBetsEnriched;
    }
  }
  
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
            win.label AS result_label,
            'single' AS bet_type
       FROM user_bets ub
       JOIN bets b ON b.id = ub.bet_id
  LEFT JOIN bet_outcomes win ON win.id = b.result_outcome_id
      WHERE ub.user_id = ?
      ORDER BY ub.created_at DESC`,
    [req.user.id],
  );

  // Hozzáadni a lezárt combo fogadásokat is
  const comboRows = await query(
    `SELECT bc.id,
            CAST(CONCAT('Kötés (', COUNT(cs.id), ' fogadás)') AS CHAR) AS selection,
            bc.total_stake AS stake,
            bc.potential_win,
            bc.status,
            bc.created_at,
            bc.total_odds AS odds_snapshot,
            'Kötéses fogadás' AS title,
            NULL AS result_outcome_id,
            NULL AS result_label,
            'combo' AS bet_type
       FROM bet_combos bc
       JOIN combo_selections cs ON cs.combo_id = bc.id
      WHERE bc.user_id = ?
        AND bc.status IN ('WON', 'LOST')
      GROUP BY bc.id
      ORDER BY bc.created_at DESC`,
    [req.user.id],
  );

  // Hozzáadni a kaszinó játékokat (rulett, stb.)
  const casinoRows = await query(
    `SELECT id,
            game_type,
            bet_amount AS stake,
            win_amount AS potential_win,
            status,
            created_at,
            NULL AS odds_snapshot,
            CASE 
              WHEN game_type = 'ROULETTE' THEN 'Rulett'
              WHEN game_type = 'MINESWEEPER' THEN 'Aknakereső'
              WHEN game_type = 'SLOT' THEN 'Szerencsekerék'
              WHEN game_type = 'BLACKJACK' THEN 'Blackjack'
              ELSE game_type
            END AS title,
            NULL AS result_outcome_id,
            NULL AS result_label,
            'casino' AS bet_type,
            game_data
       FROM casino_games
      WHERE user_id = ?
        AND status IN ('WON', 'LOST')
      ORDER BY created_at DESC
      LIMIT 50`,
    [req.user.id],
  );

  // Formázás a casino játékokhoz
  const formattedCasinoRows = casinoRows.map((row) => {
    let selection = '';
    let resultInfo = '';
    
    if (row.game_type === 'ROULETTE' && row.game_data) {
      try {
        const gameData = typeof row.game_data === 'string' ? JSON.parse(row.game_data) : row.game_data;
        const winningNumber = gameData.winningNumber;
        if (winningNumber !== undefined && winningNumber !== null) {
          // Szám színe meghatározása
          const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
          let color = 'fekete';
          if (winningNumber === 0) {
            color = 'zöld';
          } else if (redNumbers.includes(winningNumber)) {
            color = 'piros';
          }
          
          selection = `Rulett játék`;
          resultInfo = `Nyerő szám: ${winningNumber} (${color})`;
        } else {
          selection = `Rulett játék`;
        }
      } catch (e) {
        console.error('Error parsing game_data:', e);
        selection = `Rulett játék`;
      }
    } else {
      selection = row.title;
    }
    
    return {
      ...row,
      selection: selection || row.title,
      result_label: resultInfo,
    };
  });

  const allBets = [...rows, ...comboRows, ...formattedCasinoRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return res.json({ bets: allBets });
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
            b.title,
            'single' AS bet_type
       FROM user_bets ub
       JOIN bets b ON b.id = ub.bet_id
      WHERE ub.user_id = ?
        AND ub.status = 'PENDING'
      ORDER BY ub.created_at DESC`,
    [req.user.id],
  );

  // Hozzáadni a combo fogadásokat is
  const comboRows = await query(
    `SELECT bc.id,
            CONCAT('Kötés (', COUNT(cs.id), ' fogadás)') AS selection,
            bc.total_stake AS stake,
            bc.potential_win,
            bc.status,
            bc.created_at,
            bc.total_odds AS odds_snapshot,
            'Kötéses fogadás' AS title,
            'combo' AS bet_type
       FROM bet_combos bc
       JOIN combo_selections cs ON cs.combo_id = bc.id
      WHERE bc.user_id = ?
        AND bc.status = 'PENDING'
      GROUP BY bc.id
      ORDER BY bc.created_at DESC`,
    [req.user.id],
  );

  const allBets = [...rows, ...comboRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return res.json({ bets: allBets });
});

router.get('/admin', auth(), requireAdmin, async (_req, res) => {
  let bets;
  try {
    bets = await query(
      `SELECT id, title, description, status, result_outcome_id,
              created_at, closes_at, 
              COALESCE(parent_bet_id, NULL) as parent_bet_id, 
              COALESCE(minimum_bet, 100.00) as minimum_bet
       FROM bets
      ORDER BY created_at DESC`,
    );
  } catch (err) {
    // Ha a mezők még nem léteznek, próbáljuk meg anélkül
    if (err.message.includes('Unknown column')) {
      bets = await query(
        `SELECT id, title, description, status, result_outcome_id, created_at, closes_at
         FROM bets
        ORDER BY created_at DESC`,
      );
      bets = bets.map((bet) => ({ ...bet, parent_bet_id: null, minimum_bet: 100 }));
    } else {
      throw err;
    }
  }
  const enriched = await attachOutcomes(
    bets.map((bet) => ({
      ...bet,
      minimum_bet: Number(bet.minimum_bet) || 100,
    })),
  );
  
  // Hozzáadni a részlet fogadásokat minden fő fogadáshoz
  for (const bet of enriched) {
    if (!bet.parent_bet_id) {
      const detailBets = await query(
        `SELECT id, title, description, status, result_outcome_id, created_at, closes_at, minimum_bet
         FROM bets
        WHERE parent_bet_id = ?
        ORDER BY created_at ASC`,
        [bet.id],
      );
      if (detailBets.length > 0) {
        const detailBetsEnriched = await attachOutcomes(
          detailBets.map((db) => ({
            ...db,
            minimum_bet: Number(db.minimum_bet) || 100,
          })),
        );
        bet.detail_bets = detailBetsEnriched;
      }
    }
  }
  
  return res.json({ bets: enriched });
});

router.post('/', auth(), requireAdmin, async (req, res) => {
  const {
    title,
    description,
    closes_at: closesAt,
    outcomes,
    parent_bet_id: parentBetId,
    minimum_bet: minimumBet,
    detail_bets: detailBets,
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

  const numericMinimumBet = minimumBet ? Number(minimumBet) : 100;
  if (numericMinimumBet < 0) {
    return res.status(400).json({ message: 'A minimum tét nem lehet negatív' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Ha van parent_bet_id, ellenőrizni hogy létezik-e
    if (parentBetId) {
      const [parentBet] = await connection.execute(
        'SELECT id FROM bets WHERE id = ?',
        [parentBetId],
      );
      if (!parentBet.length) {
        throw new Error('PARENT_NOT_FOUND');
      }
    }

    let result;
    try {
      [result] = await connection.execute(
        `INSERT INTO bets (title, description, closes_at, created_by, parent_bet_id, minimum_bet)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description || '', closesAt || null, req.user.id, parentBetId || null, numericMinimumBet],
      );
    } catch (err) {
      // Ha a mezők még nem léteznek, próbáljuk meg anélkül
      if (err.message.includes('Unknown column')) {
        [result] = await connection.execute(
          `INSERT INTO bets (title, description, closes_at, created_by)
           VALUES (?, ?, ?, ?)`,
          [title, description || '', closesAt || null, req.user.id],
        );
      } else {
        throw err;
      }
    }

    const betId = result.insertId;
    for (const outcome of sanitizedOutcomes) {
      await connection.execute(
        `INSERT INTO bet_outcomes (bet_id, label, odds, base_odds, order_index)
         VALUES (?, ?, ?, ?, ?)`,
        [betId, outcome.label, outcome.odds, outcome.odds, outcome.order_index],
      );
    }

    // Ha van részlet fogadás, azt is létrehozni
    if (Array.isArray(detailBets) && detailBets.length > 0 && !parentBetId) {
      for (const detailBet of detailBets) {
        if (!detailBet.title || !Array.isArray(detailBet.outcomes) || detailBet.outcomes.length < 2) {
          continue;
        }
        
        const detailOutcomes = detailBet.outcomes.map((outcome, index) => ({
          label: outcome.label?.trim(),
          odds: Number(outcome.odds),
          order_index: index,
        }));

        if (detailOutcomes.some((outcome) => !outcome.label || !outcome.odds || outcome.odds <= 1)) {
          continue;
        }

        const detailMinimumBet = detailBet.minimum_bet ? Number(detailBet.minimum_bet) : 100;
        let detailResult;
        try {
          [detailResult] = await connection.execute(
            `INSERT INTO bets (title, description, closes_at, created_by, parent_bet_id, minimum_bet)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [detailBet.title, detailBet.description || '', detailBet.closes_at || null, req.user.id, betId, detailMinimumBet],
          );
        } catch (err) {
          // Ha a mezők még nem léteznek, próbáljuk meg anélkül
          if (err.message.includes('Unknown column')) {
            [detailResult] = await connection.execute(
              `INSERT INTO bets (title, description, closes_at, created_by)
               VALUES (?, ?, ?, ?)`,
              [detailBet.title, detailBet.description || '', detailBet.closes_at || null, req.user.id],
            );
          } else {
            throw err;
          }
        }

        const detailBetId = detailResult.insertId;
        for (const outcome of detailOutcomes) {
          await connection.execute(
            `INSERT INTO bet_outcomes (bet_id, label, odds, base_odds, order_index)
             VALUES (?, ?, ?, ?, ?)`,
            [detailBetId, outcome.label, outcome.odds, outcome.odds, outcome.order_index],
          );
        }
      }
    }

    await connection.commit();
    connection.release();
    
    // Lekérdezés a transaction után (új kapcsolat)
    let betRows;
    try {
      betRows = await query(
        'SELECT id, title, description, status, result_outcome_id, created_at, closes_at, COALESCE(parent_bet_id, NULL) as parent_bet_id, COALESCE(minimum_bet, 100.00) as minimum_bet FROM bets WHERE id = ?',
        [betId],
      );
    } catch (err) {
      if (err.message.includes('Unknown column')) {
        betRows = await query(
          'SELECT id, title, description, status, result_outcome_id, created_at, closes_at FROM bets WHERE id = ?',
          [betId],
        );
        betRows = betRows.map((b) => ({ ...b, parent_bet_id: null, minimum_bet: 100 }));
      } else {
        throw err;
      }
    }
    
    const enriched = await attachOutcomes(
      betRows.map((b) => ({
        ...b,
        minimum_bet: Number(b.minimum_bet) || 100,
      })),
    );
    
    // Hozzáadni a részlet fogadásokat, ha van
    const resultBet = enriched[0];
    if (resultBet && !resultBet.parent_bet_id) {
      let detailBets = [];
      try {
        detailBets = await query(
          `SELECT id, title, description, status, result_outcome_id, created_at, closes_at, COALESCE(minimum_bet, 100.00) as minimum_bet
           FROM bets
          WHERE parent_bet_id = ? AND status = 'OPEN'
          ORDER BY created_at ASC`,
          [resultBet.id],
        );
      } catch (err) {
        if (!err.message.includes('Unknown column')) {
          throw err;
        }
      }
      
      if (detailBets.length > 0) {
        const detailBetsEnriched = await attachOutcomes(
          detailBets.map((db) => ({
            ...db,
            status: db.status,
            minimum_bet: Number(db.minimum_bet) || 100,
          })),
        );
        resultBet.detail_bets = detailBetsEnriched;
      }
    }
    
    return res.status(201).json({ bet: resultBet });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    if (err.message === 'PARENT_NOT_FOUND') {
      return res.status(400).json({ message: 'A szülő fogadás nem található' });
    }
    console.error('Fogadás létrehozási hiba:', err);
    return res.status(500).json({ message: 'Hiba történt a fogadás létrehozásakor: ' + err.message });
  } finally {
    if (connection) {
      connection.release();
    }
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
  let minimumBet = 100;
  try {
    await connection.beginTransaction();

    let betRows;
    try {
      [betRows] = await connection.execute(
        `SELECT id, title, status, COALESCE(minimum_bet, 100.00) as minimum_bet
         FROM bets
        WHERE id = ?
        FOR UPDATE`,
        [betId],
      );
    } catch (err) {
      // Ha a minimum_bet mező még nem létezik
      if (err.message.includes('Unknown column')) {
        [betRows] = await connection.execute(
          `SELECT id, title, status
           FROM bets
          WHERE id = ?
          FOR UPDATE`,
          [betId],
        );
        betRows[0].minimum_bet = 100;
      } else {
        throw err;
      }
    }
    const bet = betRows[0];
    if (!bet || bet.status !== 'OPEN') {
      throw new Error('NOT_AVAILABLE');
    }

    minimumBet = Number(bet.minimum_bet) || 100;
    if (numericStake < minimumBet) {
      throw new Error('BELOW_MINIMUM');
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
      BELOW_MINIMUM: { status: 400, message: `A minimum tét ${minimumBet} Ft` },
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

    // Automatikusan ellenőrizni a combo fogadásokat
    if (checkCombos) {
      await checkCombos(connection);
    }

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

