const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: process.env.PORT || 5000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tipmix_app',
  },
  jwtSecret: process.env.JWT_SECRET || 'super-secret-fallback',
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@tipmix.local',
    username: process.env.ADMIN_USERNAME || 'tipmix_admin',
    password: process.env.ADMIN_PASSWORD || 'StrongAdminPass123',
    balance: Number(process.env.ADMIN_INITIAL_BALANCE) || 100000,
  },
};

module.exports = config;

