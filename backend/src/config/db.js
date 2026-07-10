const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

/**
 * Establish connection to MongoDB.
 * Reconnect logic and pooling is managed automatically by Mongoose.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    // Exit process with failure
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = connectDB;
