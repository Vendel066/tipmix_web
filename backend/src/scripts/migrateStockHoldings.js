/* eslint-disable no-console */
const { query } = require('../db');

async function migrateStockHoldings() {
  try {
    console.log('Stock holdings tábla migráció kezdése...');

    // Ellenőrizzük, hogy létezik-e a tábla
    const tables = await query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'stock_holdings'
    `);

    if (tables.length === 0) {
      console.log('Stock holdings tábla nem létezik, létrehozás...');
      await query(`
        CREATE TABLE stock_holdings (
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
      console.log('✅ Stock holdings tábla létrehozva');
      return;
    }

    // Ellenőrizzük, hogy van-e stock_id oszlop (régi séma)
    const columns = await query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'stock_holdings'
      AND COLUMN_NAME = 'stock_id'
    `);

    if (columns.length > 0) {
      console.log('Régi séma észlelve (stock_id oszlop). Migrálás...');
      
      // Töröljük a régi adatokat, mert nincs mapping a stock_id és symbol között
      console.log('⚠️  Figyelem: A régi stock_holdings adatok törlődnek, mert nincs mapping a stock_id és symbol között');
      await query('DELETE FROM stock_holdings');
      
      // Töröljük a régi foreign key-et (ha van)
      try {
        await query('ALTER TABLE stock_holdings DROP FOREIGN KEY stock_holdings_ibfk_2');
      } catch (err) {
        // Ignoráljuk, ha nem létezik
      }
      
      // Töröljük a régi oszlopokat
      try {
        await query('ALTER TABLE stock_holdings DROP COLUMN stock_id');
      } catch (err) {
        // Ignoráljuk, ha nem létezik
      }
      
      // Hozzáadjuk az új oszlopokat
      const symbolColumn = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'stock_holdings'
        AND COLUMN_NAME = 'symbol'
      `);
      
      if (symbolColumn.length === 0) {
        await query('ALTER TABLE stock_holdings ADD COLUMN symbol VARCHAR(20) NOT NULL AFTER user_id');
      }
      
      const nameColumn = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'stock_holdings'
        AND COLUMN_NAME = 'name'
      `);
      
      if (nameColumn.length === 0) {
        await query('ALTER TABLE stock_holdings ADD COLUMN name VARCHAR(255) NOT NULL AFTER symbol');
      }
      
      // Töröljük a régi unique key-et (ha van)
      try {
        await query('ALTER TABLE stock_holdings DROP INDEX unique_user_stock');
      } catch (err) {
        // Ignoráljuk, ha nem létezik
      }
      
      // Hozzáadjuk az új unique key-et
      try {
        await query('ALTER TABLE stock_holdings ADD UNIQUE KEY unique_user_stock (user_id, symbol)');
      } catch (err) {
        // Ignoráljuk, ha már létezik
      }
      
      console.log('✅ Migráció befejezve');
    } else {
      // Ellenőrizzük, hogy van-e symbol oszlop
      const symbolCheck = await query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'stock_holdings'
        AND COLUMN_NAME = 'symbol'
      `);
      
      if (symbolCheck.length === 0) {
        console.log('Symbol oszlop hiányzik, hozzáadás...');
        await query('ALTER TABLE stock_holdings ADD COLUMN symbol VARCHAR(20) NOT NULL AFTER user_id');
        await query('ALTER TABLE stock_holdings ADD COLUMN name VARCHAR(255) NOT NULL AFTER symbol');
        // Ellenőrizzük, hogy van-e már unique key
        const uniqueKeyCheck = await query(`
          SELECT CONSTRAINT_NAME 
          FROM information_schema.TABLE_CONSTRAINTS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'stock_holdings'
          AND CONSTRAINT_TYPE = 'UNIQUE'
          AND CONSTRAINT_NAME = 'unique_user_stock'
        `);
        if (uniqueKeyCheck.length === 0) {
          await query('ALTER TABLE stock_holdings ADD UNIQUE KEY unique_user_stock (user_id, symbol)');
        }
        console.log('✅ Symbol és name oszlopok hozzáadva');
      } else {
        // Ellenőrizzük, hogy van-e name oszlop
        const nameCheck = await query(`
          SELECT COLUMN_NAME 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'stock_holdings'
          AND COLUMN_NAME = 'name'
        `);
        if (nameCheck.length === 0) {
          console.log('Name oszlop hiányzik, hozzáadás...');
          await query('ALTER TABLE stock_holdings ADD COLUMN name VARCHAR(255) NOT NULL AFTER symbol');
        }
        // Ellenőrizzük a quantity típusát (DECIMAL(10,4) kell legyen)
        const quantityCheck = await query(`
          SELECT COLUMN_TYPE 
          FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'stock_holdings'
          AND COLUMN_NAME = 'quantity'
        `);
        if (quantityCheck.length > 0 && !quantityCheck[0].COLUMN_TYPE.includes('10,4')) {
          console.log('Quantity oszlop típusának frissítése DECIMAL(10,4)-re...');
          await query('ALTER TABLE stock_holdings MODIFY COLUMN quantity DECIMAL(10,4) NOT NULL');
        }
        console.log('✅ Stock holdings tábla már a megfelelő sémával rendelkezik');
      }
    }
  } catch (err) {
    console.error('❌ Migrációs hiba:', err);
    throw err;
  }
}

if (require.main === module) {
  migrateStockHoldings()
    .then(() => {
      console.log('Migráció sikeresen befejezve');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migráció sikertelen:', err);
      process.exit(1);
    });
}

module.exports = { migrateStockHoldings };

