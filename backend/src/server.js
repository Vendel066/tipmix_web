const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');
const betRoutes = require('./routes/bets');
const paymentRoutes = require('./routes/payments');
const { router: comboRoutes } = require('./routes/combos');
const casinoRoutes = require('./routes/casino');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/casino', casinoRoutes);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('API error', err);
  res.status(500).json({ message: 'Váratlan hiba történt' });
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend szerver elindult a ${config.port} porton`);
});

