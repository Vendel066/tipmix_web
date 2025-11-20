const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const config = require('../config');

async function findUserByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

async function findUserById(id) {
  const rows = await query('SELECT id, username, email, balance, is_admin, created_at FROM users WHERE id = ?', [id]);
  return rows[0];
}

async function createUser({ username, email, password, isAdmin = false, balance = 10000 }) {
  const hashed = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, email, password_hash, balance, is_admin) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashed, balance, isAdmin ? 1 : 0],
  );
  return { id: result.insertId, username, email, balance, is_admin: isAdmin ? 1 : 0 };
}

function toUserPayload(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: Number(user.balance),
    is_admin: Boolean(user.is_admin),
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: Boolean(user.is_admin),
    },
    config.jwtSecret,
    { expiresIn: '12h' },
  );
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  toUserPayload,
  createToken,
};

