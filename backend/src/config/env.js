const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  SOCKET_PING_TIMEOUT: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 60000,
  SOCKET_PING_INTERVAL: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000,
  JWT_SECRET: process.env.JWT_SECRET || 'syncboard-dev-secret-key-change-in-production',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/syncboard',
};

module.exports = env;
