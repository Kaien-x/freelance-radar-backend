const cron = require('node-cron');
const { fetchAllRedditJobs } = require('./reddit.service');
const logger = require('../utils/logger');

let cronJob = null;

/**
 * Initialize cron job for Reddit sync
 * Runs every 15 minutes by default
 * Format: cronExpression like "0/15 * * * *" for every 15 minutes
 * Parameters: (minute hour day-of-month month day-of-week)
 */
const initCronJob = (cronExpression = '*/15 * * * *') => {
  try {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    cronJob = cron.schedule(cronExpression, async () => {
      logger.info('Cron job triggered: Starting Reddit job sync');
      try {
        const results = await fetchAllRedditJobs();
        logger.info('Cron job completed', results);
      } catch (error) {
        logger.error('Cron job failed', error.message);
      }
    });

    logger.info(`Cron job initialized with expression: ${cronExpression}`);
    return cronJob;
  } catch (error) {
    logger.error('Failed to initialize cron job:', error.message);
    throw error;
  }
};

/**
 * Start the cron job if it's paused
 */
const startCronJob = () => {
  if (cronJob) {
    cronJob.start();
    logger.info('Cron job started');
  }
};

/**
 * Stop/pause the cron job
 */
const stopCronJob = () => {
  if (cronJob) {
    cronJob.stop();
    logger.info('Cron job stopped');
  }
};

/**
 * Manually trigger Reddit job sync (for testing or immediate refresh)
 */
const triggerSync = async () => {
  logger.info('Manual sync triggered');
  try {
    const results = await fetchAllRedditJobs();
    logger.info('Manual sync completed', results);
    return results;
  } catch (error) {
    logger.error('Manual sync failed', error.message);
    throw error;
  }
};

module.exports = {
  initCronJob,
  startCronJob,
  stopCronJob,
  triggerSync,
};
