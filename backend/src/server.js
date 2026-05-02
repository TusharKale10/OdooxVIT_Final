require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const errorHandler = require('./middlewares/error');
const authRoutes      = require('./routes/auth');
const serviceRoutes   = require('./routes/services');
const bookingRoutes   = require('./routes/bookings');
const adminRoutes     = require('./routes/admin');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',     authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin',    adminRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
