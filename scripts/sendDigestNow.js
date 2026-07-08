'use strict';

/**
 * Manually trigger the weekly digest for all eligible users.
 * Run: node scripts/sendDigestNow.js
 *
 * Note: users who received a digest in the last 6 days are skipped
 * (weeklyDigestLastSentAt guard). To force a resend for testing,
 * clear that field first in MongoDB.
 */

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('MongoDB connected — sending weekly digests…\n');

  const { sendWeeklyDigests } = require('../services/cron.service');
  const result = await sendWeeklyDigests();

  console.log('\nResult:', JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
