require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');

const errorHandler = require('./middlewares/error');
const authRoutes      = require('./routes/auth');
const serviceRoutes   = require('./routes/services');
const bookingRoutes   = require('./routes/bookings');
const adminRoutes     = require('./routes/admin');
const categoryRoutes  = require('./routes/categories');
const locationRoutes  = require('./routes/locations');
const subscriptionRoutes = require('./routes/subscriptions');
const creditRoutes    = require('./routes/credits');
const discountRoutes  = require('./routes/discounts');
const notificationRoutes = require('./routes/notifications');
const chatRoutes      = require('./routes/chat');
const uploadRoutes    = require('./routes/uploads');
const savedRoutes     = require('./routes/saved');
const paymentRoutes   = require('./routes/payment');
const masterRoutes    = require('./routes/master');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));

// Static uploads — created lazily by uploadController.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '7d',
  fallthrough: true,
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',     authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/categories',     categoryRoutes);
app.use('/api/locations',      locationRoutes);
app.use('/api/subscriptions',  subscriptionRoutes);
app.use('/api/credits',        creditRoutes);
app.use('/api/discounts',      discountRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/chat',           chatRoutes);
app.use('/api/uploads',        uploadRoutes);
app.use('/api/saved',          savedRoutes);
app.use('/api/payment',        paymentRoutes);
app.use('/api/master',         masterRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  // Background loop: 60 s reminder dispatcher.
  require('./services/reminderService').start();
});
