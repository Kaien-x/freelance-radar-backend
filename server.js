const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const logger = require('./utils/logger');
const { initCronJob, triggerSync } = require('./services/cron.service');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));

// Global middleware (but will not interfere with file uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', require('express').static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/jobs/reddit', require('./routes/reddit.routes')); // Reddit jobs routes (must be BEFORE /api/jobs)
app.use('/api/jobs', require('./routes/job.routes'));
app.use('/api/proposals', require('./routes/proposal.routes'));
app.use('/api/applications', require('./routes/application.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/check-apis', require('./routes/check-api'));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Global error handler triggered', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ success: false, message: err.message || 'Server error' });
});

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    logger.info('MongoDB connected');

    try {
      const cronExpression = process.env.REDDIT_CRON_EXPRESSION || '*/15 * * * *';

      initCronJob(cronExpression);

      // Run immediately when server starts
      await triggerSync();

      logger.info(`Reddit sync cron job initialized: ${cronExpression}`);
    } catch (cronError) {
      logger.error('Failed to initialize Reddit cron job', cronError.message);
    }

    app.listen(process.env.PORT || 5000, () => {
      logger.info(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    logger.error('MongoDB connection error', err.message);
    process.exit(1);
  });
