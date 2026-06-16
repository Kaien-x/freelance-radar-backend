'use strict';

const logger = require('./logger');

// prom-client is optional — gracefully degrade when not installed
let client;
let register;
try {
  client = require('prom-client');
  register = new client.Registry();
  client.collectDefaultMetrics({ register });
} catch {
  client = null;
  register = null;
}

const makeCounter = (name, help) => {
  if (client && register) {
    try {
      return new client.Counter({ name, help, registers: [register] });
    } catch {
      // already registered (hot-reload in dev)
    }
  }
  return { inc: () => {} };
};

const redditJobsFetched  = makeCounter('reddit_jobs_fetched_total',       'Total Reddit jobs fetched');
const redditJobsInserted = makeCounter('reddit_jobs_inserted_total',       'New Reddit job documents inserted');
const redditJobsFiltered = makeCounter('reddit_jobs_filtered_spam_total',  'Reddit posts filtered as spam during sync');
const redditSyncErrors   = makeCounter('reddit_sync_errors_total',         'Errors during Reddit sync');
const spamDetected       = makeCounter('spam_detected_total',              'Posts identified as spam on reprocess');
const matchingRuns       = makeCounter('matching_runs_total',              'Job-matching cron cycles executed');
const savedSearchAlerts  = makeCounter('saved_search_alerts_sent_total',   'Saved-search notification emails sent');

const getMetrics = async (req, res) => {
  if (!register) {
    return res.status(503).json({
      success: false,
      message: 'Metrics unavailable (prom-client not installed)',
    });
  }
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (err) {
    logger.error('Failed to gather metrics', err);
    res.status(500).send('Metrics collection error');
  }
};

module.exports = {
  redditJobsFetched,
  redditJobsInserted,
  redditJobsFiltered,
  redditSyncErrors,
  spamDetected,
  matchingRuns,
  savedSearchAlerts,
  getMetrics,
};
