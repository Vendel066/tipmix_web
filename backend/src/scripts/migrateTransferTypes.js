const { query } = require('../db');

async function migrateTransferTypes() {
  try {
    console.log('Migrating transactions table to add TRANSFER types...');
    
    // Modify ENUM to include TRANSFER_OUT and TRANSFER_IN
    await query(`
      ALTER TABLE transactions 
      MODIFY COLUMN type ENUM('WITHDRAWAL','DEPOSIT','TRANSFER_OUT','TRANSFER_IN') NOT NULL
    `);
    
    console.log('✓ Migration completed: TRANSFER types added to transactions table');
  } catch (err) {
    if (err.code === 'ER_DUPLICATE_ENTRY' || err.message.includes('Duplicate')) {
      console.log('✓ Migration already applied');
    } else if (err.message.includes('Unknown column')) {
      console.log('⚠ Transactions table might not exist yet. Run initDb first.');
    } else {
      console.error('Migration error:', err);
      throw err;
    }
  }
}

if (require.main === module) {
  migrateTransferTypes()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateTransferTypes;

