-- Poker játék adatbázis struktúra
-- Futtasd le phpMyAdmin-ban vagy MySQL-ben

USE `tipmix_app`;

-- Poker lobbik tábla
CREATE TABLE IF NOT EXISTS `poker_lobbies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(10) NOT NULL UNIQUE,
  `created_by` INT NOT NULL,
  `min_buy_in` DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
  `max_players` TINYINT NOT NULL DEFAULT 9,
  `current_players` TINYINT NOT NULL DEFAULT 0,
  `status` ENUM('WAITING','PLAYING','FINISHED') DEFAULT 'WAITING',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_poker_lobbies_created_by
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  INDEX idx_poker_lobbies_status (`status`),
  INDEX idx_poker_lobbies_code (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Poker játékosok tábla (lobbiban lévő játékosok)
CREATE TABLE IF NOT EXISTS `poker_players` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lobby_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `chips` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `position` TINYINT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `is_online` TINYINT(1) DEFAULT 1,
  `joined_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `left_at` DATETIME NULL,
  UNIQUE KEY unique_lobby_user (`lobby_id`, `user_id`),
  CONSTRAINT fk_poker_players_lobby
    FOREIGN KEY (`lobby_id`) REFERENCES `poker_lobbies`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_poker_players_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  INDEX idx_poker_players_lobby (`lobby_id`),
  INDEX idx_poker_players_user (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Poker játékok tábla (aktív játék egy lobbiban)
CREATE TABLE IF NOT EXISTS `poker_games` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `lobby_id` INT NOT NULL,
  `pot` DECIMAL(10,2) DEFAULT 0,
  `current_bet` DECIMAL(10,2) DEFAULT 0,
  `dealer_position` TINYINT NULL,
  `small_blind` DECIMAL(10,2) DEFAULT 50.00,
  `big_blind` DECIMAL(10,2) DEFAULT 100.00,
  `game_state` ENUM('PREFLOP','FLOP','TURN','RIVER','SHOWDOWN','FINISHED') DEFAULT 'PREFLOP',
  `community_cards` JSON NULL,
  `deck` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_poker_games_lobby
    FOREIGN KEY (`lobby_id`) REFERENCES `poker_lobbies`(`id`)
    ON DELETE CASCADE,
  INDEX idx_poker_games_lobby (`lobby_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Poker játékos lapjai tábla
CREATE TABLE IF NOT EXISTS `poker_hands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `game_id` INT NOT NULL,
  `player_id` INT NOT NULL,
  `cards` JSON NOT NULL,
  `hand_value` VARCHAR(50) NULL,
  `is_folded` TINYINT(1) DEFAULT 0,
  `bet_amount` DECIMAL(10,2) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_poker_hands_game
    FOREIGN KEY (`game_id`) REFERENCES `poker_games`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_poker_hands_player
    FOREIGN KEY (`player_id`) REFERENCES `poker_players`(`id`)
    ON DELETE CASCADE,
  INDEX idx_poker_hands_game (`game_id`),
  INDEX idx_poker_hands_player (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tournament tábla (későbbiekhez)
CREATE TABLE IF NOT EXISTS `poker_tournaments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `buy_in` DECIMAL(10,2) NOT NULL,
  `prize_pool` DECIMAL(12,2) DEFAULT 0,
  `max_players` INT NOT NULL DEFAULT 100,
  `current_players` INT NOT NULL DEFAULT 0,
  `status` ENUM('REGISTRATION','RUNNING','FINISHED') DEFAULT 'REGISTRATION',
  `start_time` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_poker_tournaments_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tournament játékosok tábla
CREATE TABLE IF NOT EXISTS `poker_tournament_players` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tournament_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `chips` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `position` INT NULL,
  `is_eliminated` TINYINT(1) DEFAULT 0,
  `registered_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_poker_tournament_players_tournament
    FOREIGN KEY (`tournament_id`) REFERENCES `poker_tournaments`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT fk_poker_tournament_players_user
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE,
  UNIQUE KEY unique_tournament_user (`tournament_id`, `user_id`),
  INDEX idx_poker_tournament_players_tournament (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
