const express = require('express');
const JobPost = require('../models/JobPost');
const JobMatch = require('../models/JobMatch');
const auth = require('../middleware/auth');

const router = express.Router();

// Get job matches for user
router.get('/', auth, async (req, res) => {
  try {
    const { dismissed = 'false', limit = 20, offset = 0 } = req.query;

    const isDismissed = dismissed === 'true';
    const matches = await JobMatch.findByUserId(
      req.user.id,
      isDismissed,
      parseInt(limit),
      parseInt(offset)
    );
    const allJobs = await Job.getAllJobs();

    // Filter to only include jobs from the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filteredMatches = matches.filter(match => {
      const postedDate = new Date(match.posted_at);
      return postedDate >= sevenDaysAgo;
    });

    res.json({
      allJobs,
      matches: filteredMatches.map(match => ({
        id: match.id,
        job_post: {
          id: match.job_post_id,
          reddit_post_id: match.reddit_post_id,
          subreddit: match.subreddit,
          title: match.title,
          body: match.body,
          url: match.url,
          posted_at: match.posted_at
        },
        match_score: match.match_score,
        dismissed: match.dismissed,
        created_at: match.created_at
      }))
    });
  } catch (error) {
    console.error('Get job matches error:', error);
    res.status(500).json({ error: 'Failed to get job matches' });
  }
});

// Dismiss a job match
router.post('/:matchId/dismiss', auth, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await JobMatch.dismiss(parseInt(matchId));
    
    if (!match) {
      return res.status(404).json({ error: 'Job match not found' });
    }

    res.json({
      message: 'Job match dismissed',
      match: {
        id: match.id,
        dismissed: true
      }
    });
  } catch (error) {
    console.error('Dismiss job match error:', error);
    res.status(500).json({ error: 'Failed to dismiss job match' });
  }
});

// Refresh job matches (fetch new jobs and create matches)
router.post('/refresh', auth, async (req, res) => {
  try {
    // Get unmatched jobs for user
    const unmatchedJobs = await JobMatch.getUnmatchedJobsForUser(req.user.id, 50);
    
    // This would normally call the AI matching service
    // For now, we'll create simple matches with random scores
    const newMatches = [];
    
    for (const job of unmatchedJobs) {
      // Simulate AI matching score between 0.5 and 0.95
      const matchScore = 0.5 + Math.random() * 0.45;
      
      const match = await JobMatch.create(req.user.id, job.id, matchScore);
      newMatches.push({
        id: match.id,
        job_post: {
          id: job.id,
          reddit_post_id: job.reddit_post_id,
          subreddit: job.subreddit,
          title: job.title,
          body: job.body,
          url: job.url,
          posted_at: job.posted_at
        },
        match_score: match.match_score,
        dismissed: false,
        created_at: match.created_at
      });
    }

    res.json({
      message: 'Job matches refreshed',
      new_matches: newMatches
    });
  } catch (error) {
    console.error('Refresh job matches error:', error);
    res.status(500).json({ error: 'Failed to refresh job matches' });
  }
});

// Get top job matches for user
router.get('/top', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const matches = await JobMatch.getTopMatches(req.user.id, parseInt(limit));

    // Filter to only include jobs from the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filteredMatches = matches.filter(match => {
      const postedDate = new Date(match.posted_at);
      return postedDate >= sevenDaysAgo;
    });

    res.json({
      matches: filteredMatches.map(match => ({
        id: match.id,
        job_post: {
          id: match.job_post_id,
          reddit_post_id: match.reddit_post_id,
          subreddit: match.subreddit,
          title: match.title,
          body: match.body,
          url: match.url,
          posted_at: match.posted_at
        },
        match_score: match.match_score,
        dismissed: match.dismissed,
        created_at: match.created_at
      }))
    });
  } catch (error) {
    console.error('Get top matches error:', error);
    res.status(500).json({ error: 'Failed to get top matches' });
  }
});

// Get all job posts (for admin/debug purposes)
router.get('/posts', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, search, subreddit } = req.query;

    let jobs;

    if (search) {
      jobs = await JobPost.search(search, parseInt(limit), parseInt(offset));
    } else if (subreddit) {
      jobs = await JobPost.getBySubreddit(subreddit, parseInt(limit), parseInt(offset));
    } else {
      jobs = await JobPost.getAll(parseInt(limit), parseInt(offset));
    }

    // Filter to only include jobs from the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filteredJobs = jobs.filter(job => {
      const postedDate = new Date(job.posted_at);
      return postedDate >= sevenDaysAgo;
    });

    res.json({
      jobs: filteredJobs.map(job => ({
        id: job.id,
        reddit_post_id: job.reddit_post_id,
        subreddit: job.subreddit,
        title: job.title,
        body: job.body,
        url: job.url,
        posted_at: job.posted_at,
        created_at: job.created_at
      }))
    });
  } catch (error) {
    console.error('Get job posts error:', error);
    res.status(500).json({ error: 'Failed to get job posts' });
  }
});

// Get recent job posts
router.get('/posts/recent', auth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const jobs = await JobPost.getRecent(parseInt(limit));

    // Filter to only include jobs from the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filteredJobs = jobs.filter(job => {
      const postedDate = new Date(job.posted_at);
      return postedDate >= sevenDaysAgo;
    });

    res.json({
      jobs: filteredJobs.map(job => ({
        id: job.id,
        reddit_post_id: job.reddit_post_id,
        subreddit: job.subreddit,
        title: job.title,
        body: job.body,
        url: job.url,
        posted_at: job.posted_at,
        created_at: job.created_at
      }))
    });
  } catch (error) {
    console.error('Get recent jobs error:', error);
    res.status(500).json({ error: 'Failed to get recent jobs' });
  }
});

module.exports = router;
