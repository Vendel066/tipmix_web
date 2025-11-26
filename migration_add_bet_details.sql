-- Migráció: Részlet fogadások és minimum bet támogatás
-- Futtasd le az adatbázisban

USE `tipmix_app`;

-- Hozzáadni a parent_bet_id mezőt (részlet fogadásokhoz)
ALTER TABLE `bets`
ADD COLUMN `parent_bet_id` INT NULL AFTER `created_by`,
ADD CONSTRAINT `fk_bets_parent_bet`
  FOREIGN KEY (`parent_bet_id`) REFERENCES `bets`(`id`)
  ON DELETE CASCADE;

-- Hozzáadni a minimum_bet mezőt
ALTER TABLE `bets`
ADD COLUMN `minimum_bet` DECIMAL(10,2) DEFAULT 100.00 AFTER `parent_bet_id`;

-- Index hozzáadása a parent_bet_id-hoz a jobb teljesítményért
CREATE INDEX `idx_bets_parent_bet_id` ON `bets`(`parent_bet_id`);

