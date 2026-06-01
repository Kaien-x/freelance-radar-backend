/**
 * Reddit Job Sync Testing Utility
 * 
 * Usage examples:
 * node utils/testRedditSync.js          # Run full sync
 * node utils/testRedditSync.js forhire  # Fetch from specific subreddit
 * 
 * This is useful for:
 * - Testing the sync process
 * - Debugging issues
 * - Manual data refresh
 * - Development testing
 */

const mongoose = require('mongoose');
require('dotenv').config();

const logger = require('./logger');
const { fetchRedditCommunity, fetchAllRedditJobs, detectCategory } = require('../services/reddit.service');
const Job = require('../models/Job.model');

const testSpecificCommunity = async (subreddit) => {
  try {
    logger.info(`Testing Reddit fetch for r/${subreddit}`);
    
    const jobs = await fetchRedditCommunity(subreddit, 10);
    
    logger.info(`Fetched ${jobs.length} jobs from r/${subreddit}`);
    
    if (jobs.length > 0) {
      logger.info('Sample job:', jobs[0]);
      
      // Show skills extraction
      logger.info(`Extracted skills: ${jobs[0].tags?.join(', ') || 'none'}`);
      logger.info(`Detected job type: ${jobs[0].jobType}`);
      logger.info(`Detected category: ${jobs[0].category}`);
    }
    
    return jobs;
  } catch (error) {
    logger.error(`Error testing r/${subreddit}`, error.message);
    throw error;
  }
};

const testFullSync = async () => {
  try {
    logger.info('Starting full Reddit sync test');
    const results = await fetchAllRedditJobs();
    
    logger.info('Sync test results:', {
      communitiesFetched: results.communitiesFetched,
      totalPostsFetched: results.totalPostsFetched,
      newJobsCreated: results.newJobsCreated,
      duplicatesSkipped: results.duplicatesSkipped,
      errors: results.errors,
      durationMs: results.durationMs,
    });
    
    // Auto-update categories for all existing jobs in the database
    logger.info('Auto-updating categories for all existing Reddit jobs in database...');
    const existingJobs = await Job.find({ source: 'reddit' });
    let updatedCount = 0;
    
    for (const job of existingJobs) {
      const oldCategory = job.category || 'General';
      const newCategory = detectCategory(job.title, job.description);
      
      if (oldCategory !== newCategory) {
        job.category = newCategory;
        await job.save();
        updatedCount++;
      }
    }
    
    logger.info(`Auto-update finished: Updated ${updatedCount} existing jobs with their correct categories.`);
    
    return results;
  } catch (error) {
    logger.error('Error during full sync test', error.message);
    throw error;
  }
};

const showDatabaseStatistics = async () => {
  try {
    const totalJobs = await Job.countDocuments();
    const redditJobs = await Job.countDocuments({ source: 'reddit' });
    const subredditStats = await Job.aggregate([
      { $match: { source: 'reddit' } },
      { $group: { _id: '$subreddit', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    logger.info('Database Statistics:', {
      totalJobs,
      redditJobs,
      subredditStats,
    });
  } catch (error) {
    logger.error('Error fetching database statistics', error.message);
  }
};

const main = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    const args = process.argv.slice(2);
    const command = args[0];

    if (command && command !== 'stats') {
      // Test specific community
      const subreddit = command;
      await testSpecificCommunity(subreddit);
    } else if (command === 'stats') {
      // Show statistics
      await showDatabaseStatistics();
    } else {
      // Run full sync test
      await testFullSync();
    }

    await showDatabaseStatistics();
    
    logger.info('Test completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Test failed', error.message);
    process.exit(1);
  }
};

main();
