/**
 * Script to migrate categories of existing Reddit jobs in MongoDB
 * 
 * Usage:
 * node utils/migrateCategories.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const logger = require('./logger');
const Job = require('../models/Job.model');
const { detectCategory } = require('../services/reddit.service');

const runMigration = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for category migration');

    // Fetch all jobs with source 'reddit'
    const redditJobs = await Job.find({ source: 'reddit' });
    logger.info(`Found ${redditJobs.length} Reddit jobs to check`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const job of redditJobs) {
      const oldCategory = job.category || 'General';
      let newCategory = detectCategory(job.title, job.description);

      if (Array.isArray(newCategory)) {
        // Use the first detected category, fallback to 'General' if empty
        newCategory = newCategory.length > 0 ? newCategory[0] : 'General';
      }

      if (oldCategory !== newCategory) {
        job.category = newCategory;
        await job.save();
        updatedCount++;
        logger.info(`Updated: "${job.title.substring(0, 40)}..." -> "${newCategory}" (was "${oldCategory}")`);
      } else {
        skippedCount++;
      }
    }

    logger.info('Migration finished successfully!');
    logger.info(`Summary: Updated ${updatedCount} jobs, skipped ${skippedCount} jobs.`);
    
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error.message);
    process.exit(1);
  }
};

runMigration();
