const env = require('../config/env');

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = env.NODE_ENV === 'production' ? LOG_LEVELS.warn : LOG_LEVELS.debug;

const timestamp = () => new Date().toISOString();

const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(`[${timestamp()}] [ERROR]`, ...args);
    }
  },
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(`[${timestamp()}] [WARN]`, ...args);
    }
  },
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.info(`[${timestamp()}] [INFO]`, ...args);
    }
  },
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.debug(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },
};

module.exports = logger;
