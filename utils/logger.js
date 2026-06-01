const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getTimestamp = () => new Date().toISOString();

const formatMessage = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const msg = data ? `${message} ${JSON.stringify(data)}` : message;
  return `[${timestamp}] [${level}] ${msg}`;
};

const writeToFile = (level, message, data = null) => {
  try {
    const logFile = path.join(logsDir, 'app.log');
    const logMessage = formatMessage(level, message, data) + '\n';
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
};

const logger = {
  info: (message, data = null) => {
    console.log(formatMessage('INFO', message, data));
    writeToFile('INFO', message, data);
  },

  warn: (message, data = null) => {
    console.warn(formatMessage('WARN', message, data));
    writeToFile('WARN', message, data);
  },

  error: (message, data = null) => {
    console.error(formatMessage('ERROR', message, data));
    writeToFile('ERROR', message, data);
  },

  debug: (message, data = null) => {
    if (process.env.DEBUG === 'true') {
      console.log(formatMessage('DEBUG', message, data));
      writeToFile('DEBUG', message, data);
    }
  },
};

module.exports = logger;
