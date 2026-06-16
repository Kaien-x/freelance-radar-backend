'use strict';

const Parser = require('rss-parser');
const axios  = require('axios');

const Job         = require('../models/Job.model');
const redisClient = require('../utils/redis');
const logger      = require('../utils/logger');
const {
  redditJobsFetched,
  redditJobsInserted,
  redditJobsFiltered,
  redditSyncErrors,
  spamDetected,
} = require('../utils/metrics');
const {
  getSpamAnalysis,
  isSpamPost,
  isForHirePost,
  detectJobType,
  detectCategory,
  extractSkills,
} = require('../utils/jobFilter');

// ─── Subreddit list ────────────────────────────────────────────────────────────

// Hardcoded fallback — used when DB is empty or unreachable
const DEFAULT_SUBREDDITS = [
  // ── Core Freelance Job Boards ──────────────────────────────────────────────
  'forhire',            // #1 dedicated freelance board — [Hiring]/[For Hire] tags
  'freelance',          // general freelancing community with job posts
  'slavelabour',        // quick paid tasks — [Task] tagged posts
  'hiring',             // general hiring board
  'WorkOnline',         // remote/online work opportunities (global)
  'remotejobs',         // remote-only job listings (global)
  'jobbit',             // structured tech job board with [Hiring] tags

  // ── Web & Software Development ────────────────────────────────────────────
  'webdev',             // web development hiring posts
  'webdesign',          // web design client requests
  'Wordpress',          // WordPress dev/design jobs
  'shopify',            // Shopify development jobs
  'gamedev',            // game development jobs
  'androiddev',         // Android development jobs
  'iOSProgramming',     // iOS development jobs
  'unity3d',            // Unity engine jobs
  'unrealengine',       // Unreal Engine jobs
  'godot',              // Godot engine jobs
  'devops',             // DevOps/cloud engineering jobs
  'netsec',             // cybersecurity/pentesting jobs
  'ethdev',             // Ethereum/Web3/blockchain development

  // ── Design & Visual Creative ──────────────────────────────────────────────
  'graphic_design',     // graphic design jobs
  'logodesign',         // logo & branding commissions
  'UI_Design',          // UI/UX design jobs
  'MotionDesign',       // motion graphics jobs
  'VideoEditing',       // video editing jobs
  'Filmmakers',         // video production/filmmaking jobs
  '3Dmodeling',         // 3D modeling jobs
  'blender',            // Blender 3D paid work
  'animation',          // animation jobs
  'artcommissions',     // art commission requests from clients
  'Illustrators',       // illustration commissions
  'photography',        // photography hire requests

  // ── Writing & Content ─────────────────────────────────────────────────────
  'HireaWriter',        // dedicated writing jobs board
  'copywriting',        // copywriting jobs
  'freelanceWriters',   // freelance writing job posts
  'technicalwriting',   // technical writing jobs
  'content_marketing',  // content marketing jobs

  // ── Audio, Music & Voice ──────────────────────────────────────────────────
  'VoiceActing',        // voice-over and voice acting paid jobs
  'sounddesign',        // sound design/SFX jobs
  'WeAreTheMusicMakers', // music production jobs
  'podcasting',         // podcast editing/production jobs

  // ── Data, AI & Analytics ─────────────────────────────────────────────────
  'datascience',        // data science jobs
  'MachineLearning',    // ML/AI jobs
  'dataengineering',    // data engineering jobs

  // ── Marketing & Growth ────────────────────────────────────────────────────
  'DigitalMarketing',   // digital marketing jobs
  'SEO',                // SEO specialist jobs
  'socialmedia',        // social media management jobs
  'PPC',                // paid ads/PPC jobs

  // ── Productivity & Automation ─────────────────────────────────────────────
  'Excel',              // Excel/VBA automation jobs
  'sheets',             // Google Sheets automation jobs

  // ── Translation & Language ────────────────────────────────────────────────
  'translators',        // translation jobs (global, all languages)

  // ── Virtual Assistant & Admin ─────────────────────────────────────────────
  'VirtualAssistant',   // virtual assistant jobs (global)

  // ── Business & Startups ───────────────────────────────────────────────────
  'startups',           // startup hiring posts
  'Entrepreneur',       // entrepreneur hiring posts
];

let REDDIT_COMMUNITIES = [];

const loadSubreddits = async () => {
  if (REDDIT_COMMUNITIES.length) return REDDIT_COMMUNITIES;

  // 1. Try Redis cache (optional — don't let Redis failure block the DB lookup)
  try {
    const cached = await redisClient.get('subreddit_list');
    if (cached) {
      REDDIT_COMMUNITIES = JSON.parse(cached);
      return REDDIT_COMMUNITIES;
    }
  } catch {
    logger.warn('Redis unavailable for subreddit cache — falling back to DB');
  }

  // 2. Load from MongoDB, fall back to hardcoded defaults if DB is empty or fails
  try {
    const SubredditMeta = require('../models/SubredditMeta');
    const docs = await SubredditMeta.find().sort({ lastChecked: -1 });
    REDDIT_COMMUNITIES = docs.length ? docs.map(d => d.name) : DEFAULT_SUBREDDITS;
    try { await redisClient.setEx('subreddit_list', 3600, JSON.stringify(REDDIT_COMMUNITIES)); } catch {}
  } catch (e) {
    logger.error('Failed to load subreddits from DB, using defaults:', e.message);
    REDDIT_COMMUNITIES = DEFAULT_SUBREDDITS;
  }

  return REDDIT_COMMUNITIES;
};

// ─── RSS fetching ──────────────────────────────────────────────────────────────

const REDDIT_API_TIMEOUT = 15000;
const RSS_PARSER = new Parser();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchRedditCommunity = async (subreddit, limit = 25, attempt = 1) => {
  try {
    const response = await axios.get(
      `https://www.reddit.com/r/${subreddit}/new/.rss`,
      {
        headers: {
          // Identify as an RSS reader — more honest and less likely to be blocked
          'User-Agent': 'FreelancerRadar/1.0 RSS aggregator (contact: support@freelancerradar.com)',
          Accept: 'application/atom+xml,application/xml,text/xml,*/*',
        },
        timeout: REDDIT_API_TIMEOUT,
      }
    );

    const feed = await RSS_PARSER.parseString(response.data);
    if (!feed?.items?.length) {
      logger.warn(`No RSS items for r/${subreddit}`);
      return [];
    }

    const posts = feed.items.slice(0, limit).map(item => ({
      title:       item.title || '',
      selftext:    item.contentSnippet || item.content || item.summary || '',
      url:         item.link || '',
      author:      item.author || 'unknown',
      created_utc: item.pubDate
        ? Math.floor(new Date(item.pubDate).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      subreddit,
      id:          item.guid?.split('/').pop() || item.id || Math.random().toString(36).slice(2),
      score:       0,
      num_comments: 0,
      thumbnail:   null,
      permalink:   item.link ? new URL(item.link).pathname : '',
    }));

    return extractJobsFromPosts(posts, subreddit);
  } catch (err) {
    const status = err.response?.status;

    // 429 — Reddit is rate-limiting us; back off and retry once
    if (status === 429 && attempt === 1) {
      const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '30', 10);
      const waitMs = Math.max(retryAfter * 1000, 30000); // at least 30s
      logger.warn(`r/${subreddit} rate limited — waiting ${waitMs / 1000}s before retry`);
      await sleep(waitMs);
      return fetchRedditCommunity(subreddit, limit, 2);
    }

    // Only log as ERROR for unexpected failures; 429 after retry is just a warn
    if (status === 429) {
      logger.warn(`r/${subreddit} still rate limited after retry — skipping this cycle`);
    } else {
      logger.error(`r/${subreddit} RSS error`, { message: err.message, status });
    }
    return [];
  }
};

// ─── Post extraction ───────────────────────────────────────────────────────────

const extractJobsFromPosts = (posts, subreddit) =>
  posts
    .filter(post => {
      if (post.stickied || post.removed || !post.selftext || post.author === '[deleted]') return false;
      return isForHirePost(post);
    })
    .map(post => {
      const title       = post.title || '';
      const description = post.selftext || '';

      return {
        redditPostId:  post.id,
        title:         title.substring(0, 200),
        description:   description.substring(0, 5000),
        subreddit,
        author:        post.author,
        url:           `https://reddit.com${post.permalink}`,
        permalink:     post.permalink,
        createdAt:     new Date(post.created_utc * 1000),
        upvotes:       post.score,
        commentsCount: post.num_comments,
        thumbnail:     post.thumbnail?.startsWith('http') ? post.thumbnail : null,
        tags:          extractSkills(title, description),
        jobType:       detectJobType(title, description),
        category:      detectCategory(title, description),
        source:        'reddit',
        redditUrl:     `https://reddit.com${post.permalink}`,
        spamCheckedAt: null,
        isSpam:        false,
        spamScore:     0,
        spamReasons:   [],
      };
    });

// ─── Main sync ─────────────────────────────────────────────────────────────────

const fetchAllRedditJobs = async () => {
  logger.info('Starting Reddit job sync…');

  const syncResults = {
    startTime:         new Date(),
    communitiesFetched: 0,
    totalPostsFetched:  0,
    newJobsCreated:     0,
    spamFiltered:       0,
    errors:             [],
  };

  try {
    await loadSubreddits();
    const allJobs = [];

    for (const subreddit of REDDIT_COMMUNITIES) {
      try {
        const jobs = await fetchRedditCommunity(subreddit, 50);
        if (jobs.length) {
          allJobs.push(...jobs);
          syncResults.totalPostsFetched += jobs.length;
        }
        syncResults.communitiesFetched++;
        // 2–3 second delay with jitter — avoids Reddit's bot detection pattern
        await sleep(2000 + Math.floor(Math.random() * 1000));
      } catch (error) {
        const msg = `Error fetching r/${subreddit}: ${error.message}`;
        logger.error(msg);
        syncResults.errors.push(msg);
      }
    }

    redditJobsFetched.inc(allJobs.length);

    const BATCH_SIZE = 200;
    for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
      const batch = allJobs.slice(i, i + BATCH_SIZE);

      // Run spam analysis and attach results
      const cleanBatch = [];
      for (const job of batch) {
        const analysis = getSpamAnalysis(job.title, job.description);
        if (analysis.isSpam) {
          syncResults.spamFiltered++;
          redditJobsFiltered.inc();
        } else {
          job.spamCheckedAt = new Date();
          job.spamScore     = analysis.score;
          job.spamReasons   = analysis.signals;
          cleanBatch.push(job);
        }
      }

      try {
        const inserted = await Job.bulkInsert(cleanBatch);
        redditJobsInserted.inc(inserted);
        syncResults.newJobsCreated += inserted;
      } catch (error) {
        const msg = `Bulk insert error: ${error.message}`;
        logger.error(msg);
        redditSyncErrors.inc();
        syncResults.errors.push(msg);
      }
    }

    syncResults.endTime    = new Date();
    syncResults.durationMs = syncResults.endTime - syncResults.startTime;
    logger.info('Reddit job sync completed', syncResults);
    return syncResults;
  } catch (error) {
    logger.error('Fatal error during Reddit job sync:', error.message);
    syncResults.endTime    = new Date();
    syncResults.durationMs = syncResults.endTime - syncResults.startTime;
    syncResults.errors.push(`Fatal error: ${error.message}`);
    return syncResults;
  }
};

// ─── Spam reprocess (for cron) ─────────────────────────────────────────────────

/**
 * Re-run spam analysis on jobs inserted in the last `windowMinutes` that haven't
 * been checked yet.  Marks confirmed spam as closed so they disappear from feeds.
 */
const reprocessRecentSpam = async (windowMinutes = 15) => {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const jobs  = await Job.find({
    source:       'reddit',
    status:       'open',
    isSpam:       false,
    spamCheckedAt: null,
    createdAt:    { $gte: since },
  }).lean();

  if (!jobs.length) return { checked: 0, flagged: 0 };

  let flagged = 0;
  for (const job of jobs) {
    const analysis = getSpamAnalysis(job.title || '', job.description || '');
    const update = {
      spamCheckedAt: new Date(),
      spamScore:     analysis.score,
      spamReasons:   analysis.signals,
    };
    if (analysis.isSpam) {
      update.isSpam = true;
      update.status = 'closed';
      flagged++;
      spamDetected.inc();
      logger.info(`Spam flagged: "${job.title}" (score ${analysis.score})`, { signals: analysis.signals });
    }
    await Job.findByIdAndUpdate(job._id, update);
  }

  logger.info(`Spam reprocess: checked ${jobs.length}, flagged ${flagged}`);
  return { checked: jobs.length, flagged };
};

// ─── Query helpers ─────────────────────────────────────────────────────────────

const getRedditJobs = async (options = {}) => {
  const { page = 1, limit = 12, subreddit = null, search = null, sortBy = 'newest' } = options;

  const query = {
    source:  'reddit',
    status:  'open',
    isSpam:  { $ne: true },
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  };

  if (subreddit) query.subreddit = subreddit;
  if (search) {
    query.$or = [
      { title:       { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags:        { $in: [new RegExp(search, 'i')] } },
    ];
  }

  const sortMap = {
    newest:   { createdAt: -1 },
    oldest:   { createdAt: 1 },
    trending: { upvotes: -1 },
    comments: { commentsCount: -1 },
  };

  try {
    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort(sortMap[sortBy] || { createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      Job.countDocuments(query),
    ]);

    return { jobs, total, pages: Math.ceil(total / Number(limit)), currentPage: Number(page), pageSize: Number(limit) };
  } catch (error) {
    logger.error('Error fetching Reddit jobs:', error.message);
    throw error;
  }
};

const getRedditStats = async () => {
  try {
    const [totalJobs, jobsBySubreddit, jobsByType, mostCommonSkills] = await Promise.all([
      Job.countDocuments({ source: 'reddit' }),
      Job.aggregate([{ $match: { source: 'reddit' } }, { $group: { _id: '$subreddit', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Job.aggregate([{ $match: { source: 'reddit' } }, { $group: { _id: '$jobType', count: { $sum: 1 } } }]),
      Job.aggregate([{ $match: { source: 'reddit' } }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);
    return { totalJobs, jobsBySubreddit, jobsByType, mostCommonSkills, latestSyncTime: new Date() };
  } catch (error) {
    logger.error('Error fetching Reddit stats:', error.message);
    throw error;
  }
};

module.exports = {
  fetchAllRedditJobs,
  reprocessRecentSpam,
  getRedditJobs,
  getRedditStats,
  REDDIT_COMMUNITIES,
  // re-export pure helpers so controllers can use them without importing jobFilter
  isSpamPost,
  getSpamAnalysis,
  detectCategory,
};
