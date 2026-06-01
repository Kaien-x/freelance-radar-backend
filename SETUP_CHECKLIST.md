# Reddit Job Aggregation System - Setup Checklist

## ✅ Pre-Deployment Checklist

### Step 1: Install Dependencies
- [ ] Run `npm install` in `backend-nodejs/` directory
- [ ] Verify `node-cron` is installed: `npm list node-cron`

### Step 2: Environment Configuration
- [ ] Copy `.env.example` settings to your `.env` file
- [ ] Add `REDDIT_CRON_EXPRESSION=*/15 * * * *` (or your preferred schedule)
- [ ] Verify `MONGODB_URI` is set correctly
- [ ] Verify `JWT_SECRET` is configured
- [ ] Verify `FRONTEND_URL` is correct

### Step 3: Database Preparation
- [ ] Run `node utils/createIndexes.js` to create MongoDB indexes
- [ ] Verify indexes created: Check MongoDB logs or use MongoDB Compass
- [ ] (Optional) Clear any existing Reddit duplicates if doing fresh start

### Step 4: Test Setup
- [ ] Start server: `npm run dev`
- [ ] Check console for: "Reddit sync cron job initialized"
- [ ] Verify no MongoDB connection errors
- [ ] Verify no module import errors

### Step 5: Test Reddit Sync
- [ ] Run manual test: `node utils/testRedditSync.js`
- [ ] Verify jobs were fetched and stored
- [ ] Run stats: `node utils/testRedditSync.js stats`
- [ ] Check job counts in database

### Step 6: Test APIs
- [ ] Test fetch API: `curl http://localhost:5000/api/jobs/reddit`
- [ ] Test stats API: `curl http://localhost:5000/api/jobs/reddit/stats`
- [ ] Test search API: `curl http://localhost:5000/api/jobs/reddit/search?q=python`
- [ ] Verify responses are correct JSON

### Step 7: Monitor First Sync
- [ ] Check `logs/app.log` for sync progress
- [ ] Verify first automatic sync triggers (in 15 minutes)
- [ ] Check MongoDB for new job records
- [ ] Verify no duplicate jobs are created

### Step 8: Frontend Integration (Optional)
- [ ] Update frontend to call `/api/jobs/reddit` endpoint
- [ ] Add Reddit jobs to job feed
- [ ] Test pagination, filtering, search
- [ ] Style Reddit job cards

### Step 9: Production Deployment
- [ ] Set `NODE_ENV=production`
- [ ] Configure `REDDIT_CRON_EXPRESSION` for production (e.g., `0 */6 * * *` for every 6 hours)
- [ ] Monitor logs for first week
- [ ] Set up log rotation if needed
- [ ] Consider backup of MongoDB

### Step 10: Documentation
- [ ] Share `REDDIT_JOB_AGGREGATION.md` with team
- [ ] Share `IMPLEMENTATION_SUMMARY.md` with team
- [ ] Document any custom modifications
- [ ] Add to project README

---

## 🔧 Quick Command Reference

```bash
# Install dependencies
npm install

# Create MongoDB indexes
node utils/createIndexes.js

# Start development server
npm run dev

# Test full Reddit sync
node utils/testRedditSync.js

# Test specific subreddit
node utils/testRedditSync.js forhire

# View database statistics
node utils/testRedditSync.js stats

# View logs (live)
tail -f logs/app.log

# Test APIs
curl http://localhost:5000/api/jobs/reddit
curl http://localhost:5000/api/jobs/reddit/stats
curl http://localhost:5000/api/jobs/reddit/search?q=python
```

---

## 📋 Files Included

| File | Purpose |
|------|---------|
| `services/reddit.service.js` | Fetch and process Reddit jobs |
| `services/cron.service.js` | Automatic sync scheduling |
| `controllers/reddit.controller.js` | API endpoint handlers |
| `routes/reddit.routes.js` | API route definitions |
| `utils/logger.js` | Structured logging |
| `utils/createIndexes.js` | MongoDB index creation |
| `utils/testRedditSync.js` | Testing utility |
| `REDDIT_JOB_AGGREGATION.md` | Detailed documentation |
| `IMPLEMENTATION_SUMMARY.md` | Implementation overview |
| `SETUP_CHECKLIST.md` | This file |

---

## 🆘 Troubleshooting Quick Fixes

### Error: Cannot find module 'node-cron'
**Fix:** Run `npm install node-cron`

### Error: MongoDB connection failed
**Fix:** Verify `MONGODB_URI` in `.env` and MongoDB is running

### Cron job not starting
**Fix:** Check `logs/app.log` for errors, verify `REDDIT_CRON_EXPRESSION` format

### Duplicates appearing
**Fix:** Run `node utils/createIndexes.js` to ensure unique index exists

### API returns 404
**Fix:** Verify routes are registered in `server.js` (check for `/api/jobs/reddit`)

### Slow queries
**Fix:** Run `node utils/createIndexes.js` to create recommended indexes

---

## 📊 Expected Results

### After First Sync
- [ ] 500+ jobs in database (10 communities × 50 posts)
- [ ] Jobs from all 10 subreddits
- [ ] Skills auto-detected
- [ ] Job types identified
- [ ] No duplicates

### API Response Format
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "jobs": [...],
    "total": 245,
    "pages": 21,
    "currentPage": 1,
    "pageSize": 12
  }
}
```

---

## 🎯 Success Criteria

- [ ] ✅ Server starts without errors
- [ ] ✅ Cron job initializes successfully
- [ ] ✅ First sync completes successfully
- [ ] ✅ No duplicate jobs after second sync
- [ ] ✅ All APIs return correct responses
- [ ] ✅ Logs show successful syncs every 15 minutes
- [ ] ✅ Frontend can display Reddit jobs
- [ ] ✅ Search and filtering work
- [ ] ✅ Performance is acceptable (<100ms responses)
- [ ] ✅ No errors in production for 24 hours

---

## 📞 Support Resources

1. **Full Documentation**: Read `REDDIT_JOB_AGGREGATION.md`
2. **Implementation Details**: Read `IMPLEMENTATION_SUMMARY.md`
3. **Logs**: Check `logs/app.log` for detailed execution logs
4. **Testing**: Use `node utils/testRedditSync.js` for debugging
5. **Code Comments**: Review service files for inline documentation

---

## ✨ You're All Set!

Your Reddit job aggregation system is ready to deploy. Follow the checklist above and you'll have a production-ready system aggregating jobs from 10 Reddit communities automatically.

**Happy deploying!** 🚀
