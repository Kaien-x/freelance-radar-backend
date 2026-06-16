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
app.use('/api/feedback', require('./routes/feedback.routes'));
app.use('/api/saved-searches', require('./routes/savedSearch.routes'));

// Public stats endpoint
app.use('/api/stats', require('./routes/stats.routes'));
// Waitlist (public and admin)
const waitlistRoutes = require('./routes/waitlist.routes');
app.use('/api/waitlist', waitlistRoutes.public);
app.use('/api/admin/waitlist', waitlistRoutes.admin);

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

      // Run immediately on startup, then cron handles subsequent runs
      triggerSync().catch(err => logger.error('Initial sync failed:', err.message));

      logger.info(`Reddit sync cron job initialized: ${cronExpression}`);
    } catch (cronError) {
      logger.error('Failed to initialize Reddit cron job', cronError.message);
    }

    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use. Another process may be running. Kill it or set PORT in .env to a different value.`);
        process.exit(1);
      }
      logger.error('Server error', err.message);
      process.exit(1);
    });
  })
  .catch(err => {
    logger.error('MongoDB connection error', err.message);
    process.exit(1);
  });
