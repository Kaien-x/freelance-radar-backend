const mongoose = require('mongoose');
const Job = require('../models/Job.model');
const { fetchAllRedditJobs } = require('../services/reddit.service');
const logger = require('../utils/logger');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/saas-platform');
    logger.info('MongoDB connected');

    // Delete all existing jobs
    const deleteResult = await Job.deleteMany({});
    logger.info(`Deleted ${deleteResult.deletedCount} existing jobs`);

    // Fetch new jobs from Reddit (only [Hire] and [HIRING] posts)
    logger.info('Starting Reddit job sync...');
    const syncResult = await fetchAllRedditJobs();
    
    logger.info('Sync completed:', syncResult);
    logger.info(`New jobs created: ${syncResult.newJobsCreated}`);
    
    // Disconnect
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
    process.exit(0);
  } catch (error) {
    logger.error('Error:', error);
    process.exit(1);
  }
}

main();
