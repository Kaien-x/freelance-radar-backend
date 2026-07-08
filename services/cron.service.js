'use strict';

const cron   = require('node-cron');
const logger = require('../utils/logger');
const { matchingRuns, savedSearchAlerts } = require('../utils/metrics');

// ─── Lazy imports (avoid circular deps at module load time) ───────────────────

const getModels = () => ({
  Job:         require('../models/Job.model'),
  User:        require('../models/User.model'),
  SavedSearch: require('../models/SavedSearch.model'),
});

const getServices = () => ({
  fetchAllRedditJobs:  require('./reddit.service').fetchAllRedditJobs,
  reprocessRecentSpam: require('./reddit.service').reprocessRecentSpam,
  matchJobsToUser:     require('./ai.service').matchJobsToUser,
  sendJobMatchAlert:   require('./email.service').sendJobMatchAlert,
  sendSavedSearchAlert: require('./email.service').sendSavedSearchAlert,
  sendWeeklyDigest:    require('./email.service').sendWeeklyDigest,
});

// ─── Task: match new jobs to active users ─────────────────────────────────────

/**
 * For every active jobseeker who has enabled job-match alerts, score jobs
 * created in the last `windowMinutes` and send an email for any with
 * matchScore >= alertThreshold.
 */
const matchNewJobsToAllUsers = async (windowMinutes = 6) => {
  const { Job, User }          = getModels();
  const { matchJobsToUser, sendJobMatchAlert } = getServices();

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const newJobs = await Job.find({
    status:    'open',
    isSpam:    { $ne: true },
    createdAt: { $gte: since },
  }).lean();

  if (!newJobs.length) {
    logger.debug('matchNewJobsToAllUsers: no new jobs in window');
    return { usersProcessed: 0, alertsSent: 0 };
  }

  const users = await User.find({
    role:                     'jobseeker',
    isActive:                 true,
    isEmailVerified:          true,
    'skills.0':               { $exists: true },
    'emailAlerts.jobMatches': true,
    plan:                     { $in: ['pro', 'agency'] },
  }).lean();

  if (!users.length) return { usersProcessed: 0, alertsSent: 0 };

  let alertsSent = 0;
  const MATCH_THRESHOLD = 65;

  for (const user of users) {
    try {
      const scored = matchJobsToUser(user, newJobs).filter(j => j.matchScore >= MATCH_THRESHOLD);
      if (scored.length === 0) continue;

      await sendJobMatchAlert(user.email, user.name, scored.slice(0, 5));
      alertsSent++;
      // Brief pause to avoid hammering the SMTP server
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      logger.error(`Job-match alert failed for ${user.email}:`, err.message);
    }
  }

  matchingRuns.inc();
  logger.info(`matchNewJobsToAllUsers: ${users.length} users, ${alertsSent} alerts sent`);
  return { usersProcessed: users.length, alertsSent };
};

// ─── Task: saved search notifications ─────────────────────────────────────────

/**
 * Build a Mongoose query object from a SavedSearch.filters document.
 */
const buildSavedSearchQuery = (filters) => {
  const query = { status: 'open', isSpam: { $ne: true } };
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  query.createdAt = { $gte: sevenDaysAgo };

  if (filters.search) {
    query.$or = [
      { title:       { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } },
    ];
  }
  if (filters.category)        query.category        = { $regex: filters.category, $options: 'i' };
  if (filters.skills?.length)  query.$or             = [...(query.$or || []), { skills: { $in: filters.skills.map(s => new RegExp(s, 'i')) } }, { tags: { $in: filters.skills.map(s => new RegExp(s, 'i')) } }];
  if (filters.experienceLevel) query.experienceLevel  = filters.experienceLevel;
  if (filters.budgetType)      query['budget.type']   = filters.budgetType;
  if (filters.minBudget)       query['budget.min']    = { $gte: Number(filters.minBudget) };
  if (filters.maxBudget)       query['budget.max']    = { $lte: Number(filters.maxBudget) };
  if (filters.source)          query.source           = filters.source;
  if (filters.subreddit)       query.subreddit        = filters.subreddit;

  return query;
};

const notifySavedSearches = async (windowMinutes = 6) => {
  const { Job, User, SavedSearch } = getModels();
  const { sendSavedSearchAlert }   = getServices();

  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const activeSearches = await SavedSearch.find({ notificationsEnabled: true }).lean();
  if (!activeSearches.length) return { checked: 0, alertsSent: 0 };

  let alertsSent = 0;

  for (const search of activeSearches) {
    try {
      const user = await User.findById(search.userId).select('email name isActive isEmailVerified plan').lean();
      if (!user || !user.isActive || !user.isEmailVerified) continue;
      if (!['pro', 'agency'].includes(user.plan)) continue;

      const query  = buildSavedSearchQuery(search.filters);
      query.createdAt = { ...query.createdAt, $gte: since };

      const jobs = await Job.find(query).sort({ createdAt: -1 }).limit(5).lean();
      if (!jobs.length) continue;

      await sendSavedSearchAlert(user.email, user.name, search.name, jobs);
      await SavedSearch.findByIdAndUpdate(search._id, { lastNotifiedAt: new Date() });
      savedSearchAlerts.inc();
      alertsSent++;
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      logger.error(`Saved-search alert failed for search ${search._id}:`, err.message);
    }
  }

  logger.info(`notifySavedSearches: ${activeSearches.length} searches checked, ${alertsSent} alerts sent`);
  return { checked: activeSearches.length, alertsSent };
};

// ─── Task: weekly digest (free plan) ──────────────────────────────────────────

/**
 * Send every eligible free user their top job matches from the last 7 days.
 * Eligible: active verified jobseeker with skills and weeklyDigest enabled,
 * not already sent a digest in the last 6 days (guards against double-sends
 * if the server restarts on digest day).
 */
const sendWeeklyDigests = async () => {
  const { Job, User } = getModels();
  const { matchJobsToUser, sendWeeklyDigest } = getServices();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sixDaysAgo   = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);

  const weekJobs = await Job.find({
    status:    'open',
    isSpam:    { $ne: true },
    createdAt: { $gte: sevenDaysAgo },
  }).lean();

  if (!weekJobs.length) {
    logger.info('sendWeeklyDigests: no jobs this week, skipping');
    return { usersProcessed: 0, digestsSent: 0 };
  }

  const users = await User.find({
    role:            'jobseeker',
    isActive:        true,
    isEmailVerified: true,
    'skills.0':      { $exists: true },
    'emailAlerts.weeklyDigest': { $ne: false },
    $or: [
      { weeklyDigestLastSentAt: null },
      { weeklyDigestLastSentAt: { $lt: sixDaysAgo } },
    ],
  }).lean();

  if (!users.length) return { usersProcessed: 0, digestsSent: 0 };

  const DIGEST_THRESHOLD = 40; // lenient — weekly digest should rarely be empty
  let digestsSent = 0;

  for (const user of users) {
    try {
      const scored = matchJobsToUser(user, weekJobs)
        .filter(j => j.matchScore >= DIGEST_THRESHOLD)
        .slice(0, 5);
      if (!scored.length) continue;

      await sendWeeklyDigest(user.email, user.name, scored, user._id);
      await User.findByIdAndUpdate(user._id, { weeklyDigestLastSentAt: new Date() });
      digestsSent++;
      await new Promise(r => setTimeout(r, 300)); // pace SMTP
    } catch (err) {
      logger.error(`Weekly digest failed for ${user.email}:`, err.message);
    }
  }

  logger.info(`sendWeeklyDigests: ${users.length} eligible users, ${digestsSent} digests sent`);
  return { usersProcessed: users.length, digestsSent };
};

// ─── Manual trigger ────────────────────────────────────────────────────────────

const triggerSync = async () => {
  logger.info('Manual sync triggered');
  const { fetchAllRedditJobs } = getServices();
  return fetchAllRedditJobs();
};

// ─── Cron initialization ───────────────────────────────────────────────────────

let cronJob = null;
let weeklyDigestJob = null;
let isCycleRunning = false;

/**
 * Run one full cron cycle:
 *  1. Fetch new Reddit jobs
 *  2. Re-check recent posts for spam that slipped through initial filter
 *  3. Match new jobs to users (send alerts where score >= threshold)
 *  4. Notify saved searches with new matching jobs
 */
const runCronCycle = async () => {
  // Prevent overlapping cycles — if retries push a cycle past the cron interval,
  // skip the next tick rather than doubling the request load on Reddit
  if (isCycleRunning) {
    logger.warn('Cron cycle skipped — previous cycle still running');
    return;
  }

  isCycleRunning = true;
  logger.info('Cron cycle starting…');
  const { fetchAllRedditJobs, reprocessRecentSpam } = getServices();

  // Windows must cover the full cron interval (15 min) plus a small buffer,
  // otherwise jobs created between ticks are never matched or alerted
  const [syncResult, spamResult, matchResult, savedResult] = await Promise.allSettled([
    fetchAllRedditJobs(),
    reprocessRecentSpam(20),
    matchNewJobsToAllUsers(16),
    notifySavedSearches(16),
  ]);

  const summary = {
    sync:         syncResult.status  === 'fulfilled' ? syncResult.value  : { error: syncResult.reason?.message },
    spamReprocess: spamResult.status === 'fulfilled' ? spamResult.value  : { error: spamResult.reason?.message },
    matching:     matchResult.status === 'fulfilled' ? matchResult.value : { error: matchResult.reason?.message },
    savedSearches: savedResult.status === 'fulfilled' ? savedResult.value : { error: savedResult.reason?.message },
  };

  isCycleRunning = false;
  logger.info('Cron cycle complete', summary);
  return summary;
};

const initCronJob = (cronExpression = '*/15 * * * *') => {
  try {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    cronJob = cron.schedule(cronExpression, async () => {
      try {
        await runCronCycle();
      } catch (err) {
        logger.error('Cron cycle failed with unhandled error:', err.message);
      }
    });

    logger.info(`Cron job initialized: "${cronExpression}"`);

    // Weekly digest — Monday 6:30 PM IST = 9 AM US East / 2 PM UK,
    // when both audiences are at their inbox. Override with WEEKLY_DIGEST_CRON.
    const digestExpression = process.env.WEEKLY_DIGEST_CRON || '30 18 * * 1';
    if (cron.validate(digestExpression)) {
      weeklyDigestJob = cron.schedule(digestExpression, async () => {
        try {
          await sendWeeklyDigests();
        } catch (err) {
          logger.error('Weekly digest run failed:', err.message);
        }
      });
      logger.info(`Weekly digest cron initialized: "${digestExpression}"`);
    } else {
      logger.error(`Invalid WEEKLY_DIGEST_CRON expression: ${digestExpression}`);
    }

    return cronJob;
  } catch (err) {
    logger.error('Failed to initialize cron job:', err.message);
    throw err;
  }
};

const startCronJob = () => {
  if (cronJob) { cronJob.start(); logger.info('Cron job started'); }
};

const stopCronJob = () => {
  if (cronJob) { cronJob.stop(); logger.info('Cron job stopped'); }
};

module.exports = {
  initCronJob,
  startCronJob,
  stopCronJob,
  triggerSync,
  runCronCycle,
  matchNewJobsToAllUsers,
  notifySavedSearches,
  sendWeeklyDigests,
};
