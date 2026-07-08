'use strict';
require('dotenv').config();
const mongoose    = require('mongoose');
require('../models/User.model');
const ActivityLog = require('../models/ActivityLog.model');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const total       = await ActivityLog.countDocuments();
  const logins      = await ActivityLog.countDocuments({ event: 'login' });
  const pageViews   = await ActivityLog.countDocuments({ event: 'page_view' });
  const uniqueUsers = await ActivityLog.distinct('user');

  const byPage = await ActivityLog.aggregate([
    { $match: { event: 'page_view' } },
    { $group: { _id: '$page', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const byMethod = await ActivityLog.aggregate([
    { $match: { event: 'login' } },
    { $group: { _id: '$meta.method', count: { $sum: 1 } } }
  ]);

  const recent = await ActivityLog.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('user', 'name email')
    .lean();

  console.log('\n=== ActivityLog Stats (since June 20) ===');
  console.log('Total events:  ', total);
  console.log('Unique users:  ', uniqueUsers.length);
  console.log('Logins:        ', logins);
  console.log('Page views:    ', pageViews);

  console.log('\nPage breakdown:');
  byPage.forEach(p => console.log(`  ${p.count}x  ${p._id}`));

  console.log('\nLogin methods:');
  byMethod.forEach(m => console.log(`  ${m.count}x  ${m._id}`));

  console.log('\nLast 10 events:');
  recent.forEach(r => console.log(
    ' ', new Date(r.createdAt).toISOString().slice(0, 16),
    '|', r.event.padEnd(10),
    '|', (r.page || r.meta?.method || '').padEnd(12),
    '|', r.user?.email || 'unknown'
  ));

  await mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });
