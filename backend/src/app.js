const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const roomRoutes = require('./routes/roomRoutes');
const authRoutes = require('./routes/authRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// ─── Error Handling ──────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
