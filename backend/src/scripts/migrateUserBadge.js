const { query } = require('../db');

async function migrateUserBadge() {
  try {
    console.log('Migrating users table to add badge column...');
    
    // Add badge column if it doesn't exist
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS badge ENUM('NONE', 'BRONZE', 'SILVER', 'GOLD', 'ADMIN') DEFAULT 'NONE'
    `).catch((err) => {
      // MySQL doesn't support IF NOT EXISTS for ALTER TABLE, so we check differently
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ Badge column already exists');
      } else {
        throw err;
      }
    });
    
    // Try to add the column (will fail if exists, which is fine)
    try {
      await query(`
        ALTER TABLE users 
        ADD COLUMN badge ENUM('NONE', 'BRONZE', 'SILVER', 'GOLD', 'ADMIN') DEFAULT 'NONE'
      `);
      console.log('✓ Badge column added');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ Badge column already exists');
      } else {
        throw err;
      }
    }
    
    // Update existing users' badges based on their deposits
    console.log('Updating existing users\' badges...');
    const users = await query('SELECT id, is_admin FROM users');
    
    for (const user of users) {
      if (user.is_admin) {
        await query('UPDATE users SET badge = ? WHERE id = ?', ['ADMIN', user.id]);
        continue;
      }
      
      // Calculate total deposits
      const depositRows = await query(
        `SELECT COALESCE(SUM(amount), 0) as total_deposits
         FROM transactions
         WHERE user_id = ? AND type = 'DEPOSIT' AND status = 'COMPLETED'`,
        [user.id],
      );
      
      const totalDeposits = Number(depositRows[0]?.total_deposits || 0);
      let badge = 'NONE';
      
      if (totalDeposits >= 1000000) {
        badge = 'GOLD';
      } else if (totalDeposits >= 100000) {
        badge = 'SILVER';
      } else if (totalDeposits >= 20000) {
        badge = 'BRONZE';
      }
      
      await query('UPDATE users SET badge = ? WHERE id = ?', [badge, user.id]);
    }
    
    console.log('✓ Migration completed: Badge column added and existing users updated');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ Migration already applied');
    } else {
      console.error('Migration error:', err);
      throw err;
    }
  }
}

if (require.main === module) {
  migrateUserBadge()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateUserBadge;

