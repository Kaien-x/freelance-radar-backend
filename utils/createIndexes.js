/**
 * MongoDB Index Creation for Reddit Jobs
 * Run once after deployment to optimize performance
 * 
 * Usage:
 * node utils/createIndexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('../models/Job.model');
const logger = require('./logger');

const createIndexes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Create indexes
    logger.info('Creating indexes...');

    // Index 1: Unique redditPostId to prevent duplicates
    await Job.collection.createIndex({ redditPostId: 1 }, { unique: true, sparse: true });
    logger.info('Created index on redditPostId (unique)');

    // Index 2: Source and creation date for filtering Reddit jobs
    await Job.collection.createIndex({ source: 1, createdAt: -1 });
    logger.info('Created index on source + createdAt');

    // Index 3: Subreddit for filtering by community
    await Job.collection.createIndex({ subreddit: 1, createdAt: -1 });
    logger.info('Created index on subreddit + createdAt');

    // Index 4: Tags for skill-based search
    await Job.collection.createIndex({ tags: 1 });
    logger.info('Created index on tags');

    // Index 5: Job type
    await Job.collection.createIndex({ jobType: 1 });
    logger.info('Created index on jobType');

    // Index 6: Text search on title and description
    await Job.collection.createIndex({ title: 'text', description: 'text' });
    logger.info('Created text index on title + description');

    // Index 7: Status for filtering open jobs
    await Job.collection.createIndex({ status: 1, createdAt: -1 });
    logger.info('Created index on status + createdAt');

    logger.info('All indexes created successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to create indexes', error.message);
    process.exit(1);
  }
};

createIndexes();
