const mysql = require('mysql2/promise');
const config = require('./config');

// XAMPP MySQL socket elérési út (csak macOS-on és localhost esetén)
const isLocalhost = config.db.host === 'localhost' || config.db.host === '127.0.0.1';
const socketPath = (process.platform === 'darwin' && isLocalhost)
  ? '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock'
  : undefined;

const poolConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
};

// Csak akkor adjuk hozzá a socketPath-et, ha van értéke
if (socketPath) {
  poolConfig.socketPath = socketPath;
}

const pool = mysql.createPool(poolConfig);

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = {
  pool,
  query,
};

