/* eslint-disable no-console */
const { query, pool } = require('../db');

async function checkColumnExists(tableName, columnName) {
  try {
    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ? 
       AND COLUMN_NAME = ?`,
      [tableName, columnName],
    );
    return rows.length > 0;
  } catch (err) {
    console.error(`Hiba a ${columnName} mező ellenőrzésekor:`, err.message);
    return false;
  }
}

async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
  const exists = await checkColumnExists(tableName, columnName);
  if (!exists) {
    try {
      await query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`✅ ${columnName} mező hozzáadva a ${tableName} táblához`);
      return true;
    } catch (err) {
      console.error(`❌ Hiba a ${columnName} mező hozzáadásakor:`, err.message);
      return false;
    }
  } else {
    console.log(`ℹ️  ${columnName} mező már létezik a ${tableName} táblában`);
    return false;
  }
}

async function addForeignKeyIfNotExists(tableName, constraintName, columnName, referencedTable, referencedColumn) {
  try {
    // Ellenőrizzük, hogy létezik-e már a foreign key
    const [rows] = await pool.execute(
      `SELECT CONSTRAINT_NAME 
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ? 
       AND CONSTRAINT_NAME = ?`,
      [tableName, constraintName],
    );
    
    if (rows.length === 0) {
      await query(
        `ALTER TABLE ${tableName} 
         ADD CONSTRAINT ${constraintName} 
         FOREIGN KEY (${columnName}) 
         REFERENCES ${referencedTable}(${referencedColumn}) 
         ON DELETE CASCADE`,
      );
      console.log(`✅ ${constraintName} foreign key hozzáadva`);
      return true;
    } else {
      console.log(`ℹ️  ${constraintName} foreign key már létezik`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Hiba a ${constraintName} foreign key hozzáadásakor:`, err.message);
    return false;
  }
}

async function addIndexIfNotExists(tableName, indexName, columnName) {
  try {
    const [rows] = await pool.execute(
      `SELECT INDEX_NAME 
       FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = ? 
       AND INDEX_NAME = ?`,
      [tableName, indexName],
    );
    
    if (rows.length === 0) {
      await query(`CREATE INDEX ${indexName} ON ${tableName}(${columnName})`);
      console.log(`✅ ${indexName} index hozzáadva`);
      return true;
    } else {
      console.log(`ℹ️  ${indexName} index már létezik`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Hiba a ${indexName} index hozzáadásakor:`, err.message);
    return false;
  }
}

async function migrate() {
  try {
    console.log('🔄 Bet details migráció indítása...\n');

    // Hozzáadni a parent_bet_id mezőt
    await addColumnIfNotExists('bets', 'parent_bet_id', 'INT NULL AFTER created_by');

    // Hozzáadni a minimum_bet mezőt
    await addColumnIfNotExists('bets', 'minimum_bet', 'DECIMAL(10,2) DEFAULT 100.00 AFTER parent_bet_id');

    // Hozzáadni a foreign key-t, ha a parent_bet_id mező létezik
    const parentBetIdExists = await checkColumnExists('bets', 'parent_bet_id');
    if (parentBetIdExists) {
      await addForeignKeyIfNotExists('bets', 'fk_bets_parent_bet', 'parent_bet_id', 'bets', 'id');
    }

    // Hozzáadni az indexet
    if (parentBetIdExists) {
      await addIndexIfNotExists('bets', 'idx_bets_parent_bet_id', 'parent_bet_id');
    }

    console.log('\n✅ Migráció befejezve!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migrációs hiba:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

migrate();

