/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const config = require('../config');

async function resetSchema() {
  await query('SET FOREIGN_KEY_CHECKS = 0;');
  await query('DROP TABLE IF EXISTS user_bets;');
  await query('DROP TABLE IF EXISTS bet_outcomes;');
  await query('DROP TABLE IF EXISTS bets;');
  await query('SET FOREIGN_KEY_CHECKS = 1;');
}

async function createTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      balance DECIMAL(12,2) DEFAULT 0,
      is_admin TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
      result_outcome_id INT NULL,
      closes_at DATETIME NULL,
      created_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bet_outcomes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bet_id INT NOT NULL,
      label VARCHAR(100) NOT NULL,
      odds DECIMAL(6,2) NOT NULL,
      base_odds DECIMAL(6,2) NOT NULL,
      total_stake DECIMAL(12,2) DEFAULT 0,
      order_index TINYINT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_bets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      bet_id INT NOT NULL,
      outcome_id INT NOT NULL,
      selection VARCHAR(120) NOT NULL,
      odds_snapshot DECIMAL(6,2) NOT NULL,
      stake DECIMAL(10,2) NOT NULL,
      potential_win DECIMAL(12,2) NOT NULL,
      status ENUM('PENDING','WON','LOST') DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE,
      FOREIGN KEY (outcome_id) REFERENCES bet_outcomes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    ALTER TABLE bets
    ADD CONSTRAINT fk_bets_result_outcome
    FOREIGN KEY (result_outcome_id) REFERENCES bet_outcomes(id)
    ON DELETE SET NULL;
  `).catch(() => {});
}

async function ensureAdminUser() {
  const existing = await query('SELECT id FROM users WHERE email = ?', [config.admin.email]);
  if (existing.length) {
    console.log('Admin felhasználó már létezik, lépünk tovább.');
    return;
  }

  const passwordHash = await bcrypt.hash(config.admin.password, 10);
  await query(
    `INSERT INTO users (username, email, password_hash, balance, is_admin)
     VALUES (?, ?, ?, ?, 1)`,
    [config.admin.username, config.admin.email, passwordHash, config.admin.balance],
  );
  console.log(`Admin létrehozva: ${config.admin.email}`);
}

async function bootstrap() {
  try {
    await resetSchema();
    await createTables();
    await ensureAdminUser();
    console.log('Adatbázis setup kész ✅');
    process.exit(0);
  } catch (err) {
    console.error('Adatbázis setup hiba', err);
    process.exit(1);
  }
}

bootstrap();

