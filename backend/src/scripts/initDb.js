/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const config = require('../config');

async function resetSchema() {
  await query('SET FOREIGN_KEY_CHECKS = 0;');
  await query('DROP TABLE IF EXISTS stock_holdings;');
  await query('DROP TABLE IF EXISTS stocks;');
  await query('DROP TABLE IF EXISTS casino_games;');
  await query('DROP TABLE IF EXISTS bet_combos;');
  await query('DROP TABLE IF EXISTS combo_selections;');
  await query('DROP TABLE IF EXISTS transactions;');
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
      parent_bet_id INT NULL,
      minimum_bet DECIMAL(10,2) DEFAULT 100.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_bet_id) REFERENCES bets(id) ON DELETE CASCADE
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

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('WITHDRAWAL','DEPOSIT') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      status ENUM('PENDING','APPROVED','REJECTED','COMPLETED') DEFAULT 'PENDING',
      processed_by INT NULL,
      processed_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bet_combos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total_stake DECIMAL(10,2) NOT NULL,
      total_odds DECIMAL(8,2) NOT NULL,
      potential_win DECIMAL(12,2) NOT NULL,
      status ENUM('PENDING','WON','LOST') DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS combo_selections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      combo_id INT NOT NULL,
      bet_id INT NOT NULL,
      outcome_id INT NOT NULL,
      selection VARCHAR(120) NOT NULL,
      odds_snapshot DECIMAL(6,2) NOT NULL,
      FOREIGN KEY (combo_id) REFERENCES bet_combos(id) ON DELETE CASCADE,
      FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE,
      FOREIGN KEY (outcome_id) REFERENCES bet_outcomes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS casino_games (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      game_type ENUM('MINESWEEPER','SLOT','BLACKJACK') NOT NULL,
      bet_amount DECIMAL(10,2) NOT NULL,
      win_amount DECIMAL(12,2) DEFAULT 0,
      game_data JSON,
      status ENUM('PENDING','WON','LOST') DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      symbol VARCHAR(10) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      change_percent DECIMAL(5,2) DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS stock_holdings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,4) NOT NULL,
      average_price DECIMAL(10,2) NOT NULL,
      total_invested DECIMAL(12,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_stock (user_id, symbol)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function seedStocks() {
  const stocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 175.50 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.80 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.90 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.20 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 145.30 },
    { symbol: 'META', name: 'Meta Platforms', price: 312.40 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 485.60 },
    { symbol: 'BTC', name: 'Bitcoin', price: 43250.00 },
  ];

  for (const stock of stocks) {
    await query(
      `INSERT INTO stocks (symbol, name, price, change_percent) 
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price)`,
      [stock.symbol, stock.name, stock.price]
    );
  }
  console.log('Részvények inicializálva');
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
    await seedStocks();
    await ensureAdminUser();
    console.log('Adatbázis setup kész ✅');
    process.exit(0);
  } catch (err) {
    console.error('Adatbázis setup hiba', err);
    process.exit(1);
  }
}

bootstrap();

