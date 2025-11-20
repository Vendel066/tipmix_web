const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { isEmail, isPasswordStrong } = require('../utils/validators');
const { auth } = require('../middleware/auth');
const { findUserByEmail, toUserPayload, createToken } = require('../services/userService');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !isEmail(email) || !isPasswordStrong(password)) {
    return res.status(400).json({ message: 'Hibás adatmezők' });
  }

  const existingEmail = await findUserByEmail(email);
  if (existingEmail) {
    return res.status(409).json({ message: 'E-mail cím már foglalt' });
  }

  const existingUsername = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (existingUsername.length) {
    return res.status(409).json({ message: 'Felhasználónév már foglalt' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, email, password_hash, balance, is_admin) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashed, 10000, 0],
  );

  const user = { id: result.insertId, username, email, balance: 10000, is_admin: 0 };
  const token = createToken(user);

  return res.status(201).json({
    token,
    user: toUserPayload(user),
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Hibás belépési adatok' });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ message: 'Hibás belépési adatok' });
  }

  const token = createToken(user);
  return res.json({
    token,
    user: toUserPayload(user),
  });
});

router.get('/profile', auth(), async (req, res) => {
  const [user] = await query(
    'SELECT id, username, email, balance, is_admin, created_at FROM users WHERE id = ?',
    [req.user.id],
  );
  if (!user) {
    return res.status(404).json({ message: 'Felhasználó nem található' });
  }
  return res.json({ user: toUserPayload(user) });
});

module.exports = router;

