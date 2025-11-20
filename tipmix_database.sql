-- Tipmix adatbázis teljes setup SQL
-- Futtasd le phpMyAdmin-ban vagy MySQL-ben

-- Adatbázis létrehozása
CREATE DATABASE IF NOT EXISTS `tipmix_app`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tipmix_app`;

-- Táblák törlése (fordított sorrendben a foreign key-ek miatt)
SET FOREIGN_KEY_CHECKS = 0;
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

-- Fogadások tábla
CREATE TABLE `bets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `status` ENUM('OPEN','CLOSED') DEFAULT 'OPEN',
  `result_outcome_id` INT NULL,
  `closes_at` DATETIME NULL,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bets_created_by
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

