-- Tipmix adatbázis teljes setup SQL (összevont fájl)
-- Tartalmazza: tipmix_database.sql + migration_add_bet_details.sql + stocks_setup.sql
-- Futtasd le phpMyAdmin-ban vagy MySQL-ben

-- Adatbázis létrehozása
CREATE DATABASE IF NOT EXISTS `tipmix_app`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tipmix_app`;

-- Táblák törlése (fordított sorrendben a foreign key-ek miatt)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `stock_holdings`;
DROP TABLE IF EXISTS `casino_games`;
DROP TABLE IF EXISTS `combo_selections`;
DROP TABLE IF EXISTS `bet_combos`;
DROP TABLE IF EXISTS `transactions`;
DROP TABLE IF EXISTS `user_bets`;
DROP TABLE IF EXISTS `bet_outcomes`;
DROP TABLE IF EXISTS `bets`;
DROP TABLE IF EXISTS `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- Felhasználók tábla
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `balance` DECIMAL(12,2) DEFAULT 0,
  `is_admin` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fogadások tábla (tartalmazza a parent_bet_id és minimum_bet mezőket)
CREATE TABLE `bets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `status` ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
  `result_outcome_id` INT NULL,
  `closes_at` DATETIME NULL,
  `created_by` INT NULL,
  `parent_bet_id` INT NULL,
  `minimum_bet` DECIMAL(10,2) DEFAULT 100.00,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bets_created_by
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL,
  CONSTRAINT fk_bets_parent_bet
    FOREIGN KEY (`parent_bet_id`) REFERENCES `bets`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index a parent_bet_id-hoz a jobb teljesítményért
CREATE INDEX `idx_bets_parent_bet_id` ON `bets`(`parent_bet_id`);

-- Fogadás kimenetek tábla
CREATE TABLE `bet_outcomes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bet_id` INT NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `odds` DECIMAL(6,2) NOT NULL,
  `base_odds` DECIMAL(6,2) NOT NULL,
  `total_stake` DECIMAL(12,2) DEFAULT 0,
  `order_index` TINYINT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bet_outcomes_bet
    FOREIGN KEY (`bet_id`) REFERENCES `bets`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Felhasználói fogadások tábla
CREATE TABLE `user_bets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `bet_id` INT NOT NULL,
  `outcome_id` INT NOT NULL,
  `selection` VARCHAR(120) NOT NULL,
  `odds_snapshot` DECIMAL(6,2) NOT NULL,
  `stake` DECIMAL(10,2) NOT NULL,
  `potential_win` DECIMAL(12,2) NOT NULL,
  `status` ENUM('PENDING','WON','LOST') DEFAULT 'PENDING',
  `bet_type` ENUM('normal','casino','combo') DEFAULT 'normal',
  `game_type` VARCHAR(50) NULL,
  `game_data` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_bets_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_bets_bet
    FOREIGN KEY (`bet_id`) REFERENCES `bets`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_bets_outcome
    FOREIGN KEY (`outcome_id`) REFERENCES `bet_outcomes`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Eredmény foreign key a bets táblára
ALTER TABLE `bets`
ADD CONSTRAINT fk_bets_result_outcome
FOREIGN KEY (`result_outcome_id`) REFERENCES `bet_outcomes`(`id`)
ON DELETE SET NULL;

-- Tranzakciók tábla (kifizetés/befizetés)
CREATE TABLE `transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `type` ENUM('WITHDRAWAL','DEPOSIT','TRANSFER','STOCK_BUY','STOCK_SELL') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','COMPLETED') DEFAULT 'PENDING',
  `processed_by` INT NULL,
  `processed_at` DATETIME NULL,
  `transfer_to_user_id` INT NULL,
  `transfer_type` VARCHAR(50) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_transactions_processed_by
    FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL,
  CONSTRAINT fk_transactions_transfer_to
    FOREIGN KEY (`transfer_to_user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kötéses fogadások tábla
CREATE TABLE `bet_combos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `total_stake` DECIMAL(10,2) NOT NULL,
  `total_odds` DECIMAL(8,2) NOT NULL,
  `potential_win` DECIMAL(12,2) NOT NULL,
  `status` ENUM('PENDING','WON','LOST') DEFAULT 'PENDING',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bet_combos_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kötéses fogadás kiválasztások tábla
CREATE TABLE `combo_selections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `combo_id` INT NOT NULL,
  `bet_id` INT NOT NULL,
  `outcome_id` INT NOT NULL,
  `selection` VARCHAR(120) NOT NULL,
  `odds_snapshot` DECIMAL(6,2) NOT NULL,
  CONSTRAINT fk_combo_selections_combo
    FOREIGN KEY (`combo_id`) REFERENCES `bet_combos`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_combo_selections_bet
    FOREIGN KEY (`bet_id`) REFERENCES `bets`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_combo_selections_outcome
    FOREIGN KEY (`outcome_id`) REFERENCES `bet_outcomes`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Kaszinó játékok tábla
CREATE TABLE `casino_games` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `game_type` ENUM('MINESWEEPER','SLOT','BLACKJACK','ROULETTE') NOT NULL,
  `bet_amount` DECIMAL(10,2) NOT NULL,
  `win_amount` DECIMAL(12,2) DEFAULT 0,
  `game_data` JSON,
  `status` ENUM('PENDING','WON','LOST') DEFAULT 'PENDING',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_casino_games_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Részvény portfólió tábla
CREATE TABLE `stock_holdings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(10,4) NOT NULL,
  `average_price` DECIMAL(10,2) NOT NULL,
  `total_invested` DECIMAL(12,2) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_stock (`user_id`, `symbol`),
  CONSTRAINT fk_stock_holdings_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Felhasználó badge tábla (ha szükséges)
CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `badge_type` VARCHAR(50) NOT NULL,
  `badge_name` VARCHAR(100) NOT NULL,
  `badge_description` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_badge (`user_id`, `badge_type`),
  CONSTRAINT fk_user_badges_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin felhasználó beszúrása
-- Email: admin@tipmix.local
-- Jelszó: StrongAdminPass123
INSERT INTO `users` (`username`, `email`, `password_hash`, `balance`, `is_admin`)
VALUES (
  'tipmix_admin',
  'admin@tipmix.local',
  '$2b$10$nhyBSncvwBnzp1w0j9/x4uKtZTmb6QNs08QSE4qOfjKZTcS1hyGVu',
  100000.00,
  1
)
ON DUPLICATE KEY UPDATE email = email;

-- Megjegyzések:
-- 1. A részvények közvetlenül a Yahoo Finance API-ból jönnek,
--    ezért nincs szükség stocks táblára az adatbázisban.
--    A stock_holdings tábla a felhasználók részvény portfólióját tárolja.
-- 2. A parent_bet_id mező lehetővé teszi a részlet fogadásokat.
-- 3. A minimum_bet mező minden fogadáshoz beállítható minimum tétet.
-- 4. A user_bets tábla tartalmazza a bet_type és game_type mezőket
--    a kaszinó játékok és kötéses fogadások támogatásához.
-- 5. A transactions tábla tartalmazza a TRANSFER, STOCK_BUY, STOCK_SELL típusokat
--    és a transfer_to_user_id mezőt a felhasználók közötti átutalásokhoz.

