# Reddit Job Aggregation System

## Overview

This is a production-grade Reddit job aggregation system for the FreelanceRadar SaaS platform. It automatically fetches job postings from 10 major Reddit communities, stores them in MongoDB, and exposes them through a scalable API.

## Architecture

### Folder Structure

```
backend-nodejs/
├── services/
│   ├── reddit.service.js       # Reddit API fetching & data extraction
│   ├── cron.service.js         # Cron job scheduling & management
│   ├── upload.service.js       # (existing)
│   └── ai.service.js           # (existing)
├── controllers/
│   ├── reddit.controller.js    # Reddit API endpoints
│   ├── job.controller.js       # (existing)
│   └── ...
├── routes/
│   ├── reddit.routes.js        # Reddit job routes
│   ├── job.routes.js           # (existing)
│   └── ...
├── models/
│   └── Job.model.js            # (Updated with reddit fields)
├── utils/
│   ├── logger.js               # Logging utility
│   ├── asyncHandler.js         # (existing)
│   └── response.util.js        # (existing)
├── logs/
│   └── app.log                 # Automatically created
└── server.js                   # (Updated with Reddit cron job)
```

## Key Components

### 1. Reddit Service (`services/reddit.service.js`)

**Responsibilities:**
- Fetch jobs from 10 Reddit communities
- Extract and parse Reddit post data
- Detect job types and extract skills
- Handle duplicate prevention
- Provide pagination and filtering

**Key Functions:**
- `fetchRedditCommunity()` - Fetches jobs from a single subreddit
- `extractJobsFromPosts()` - Parses Reddit post data
- `fetchAllRedditJobs()` - Main sync function
- `getRedditJobs()` - Fetches jobs with pagination/filtering
- `getRedditStats()` - Returns statistics

**Reddit Communities:**
- r/forhire
- r/slavelabour
- r/RemoteJobs
- r/WorkOnline
- r/freelance
- r/DoneDirtCheap
- r/Hiring
- r/remotejs
- r/webdevjobs
- r/jobs

### 2. Cron Service (`services/cron.service.js`)

**Responsibilities:**
- Schedule automatic Reddit syncs
- Manage cron job lifecycle
- Handle manual trigger for testing

**Key Functions:**
- `initCronJob()` - Initialize cron with custom expression
- `startCronJob()` - Resume cron job
- `stopCronJob()` - Pause cron job
- `triggerSync()` - Manual sync trigger

**Default Schedule:** Every 15 minutes (configurable via `REDDIT_CRON_EXPRESSION`)

### 3. Reddit Controller (`controllers/reddit.controller.js`)

**Endpoints:**
- `GET /api/jobs/reddit` - Fetch Reddit jobs with pagination
- `GET /api/jobs/reddit/:id` - Get single Reddit job
- `GET /api/jobs/reddit/stats` - Get statistics
- `GET /api/jobs/reddit/subreddits` - Get available subreddits
- `GET /api/jobs/reddit/search` - Search jobs
- `GET /api/jobs/reddit/sync/status` - Get sync status
- `POST /api/jobs/reddit/sync` - Manual sync trigger

### 4. Logger (`utils/logger.js`)

**Features:**
- Structured logging to console and file
- Log levels: INFO, WARN, ERROR, DEBUG
- Automatic log file rotation
- Timestamps and context

## Duplicate Prevention

The system uses a **3-tier duplicate prevention strategy**:

### 1. **Unique Index on `redditPostId`**
```javascript
// MongoDB will prevent duplicate insertions at database level
redditPostId: { type: String, unique: true }
```

### 2. **Query-based Check Before Insertion**
```javascript
const existingJob = await Job.findOne({ redditPostId: jobData.redditPostId });
if (existingJob) {
  syncResults.duplicatesSkipped++;
  continue;
}
```

### 3. **Safe Error Handling**
- If duplicate insert fails, error is caught and logged
- Sync continues processing other jobs
- Does not crash the entire operation

## Data Flow

### Sync Flow

```
Server Startup
    ↓
Initialize Cron Job
    ↓
Every 15 minutes (configurable)
    ↓
Fetch from 10 Reddit communities
    ↓
Extract job data from posts
    ↓
Check for duplicates (by redditPostId)
    ↓
Insert new jobs only
    ↓
Log results and statistics
    ↓
Repeat
```

### API Flow

```
Frontend Request
    ↓
GET /api/jobs/reddit?page=1&limit=12&subreddit=forhire
    ↓
Controller validates query params
    ↓
Service builds MongoDB query
    ↓
Execute query with pagination
    ↓
Return results with metadata
    ↓
Frontend displays jobs
```

## Installation & Setup

### 1. Install Dependencies

```bash
npm install node-cron
```

(Already added to `package.json`)

### 2. Update Environment Variables

Add to your `.env` file:

```env
REDDIT_CRON_EXPRESSION=*/15 * * * *
DEBUG=false
```

### 3. MongoDB Index

The system automatically uses MongoDB's unique constraint on `redditPostId`. Optional: Add index for faster queries:

```javascript
// Run once in MongoDB shell or script
db.jobs.createIndex({ redditPostId: 1 }, { unique: true })
db.jobs.createIndex({ source: 1, createdAt: -1 })
db.jobs.createIndex({ subreddit: 1, createdAt: -1 })
```

### 4. Start Server

```bash
npm run dev
```

You should see:
```
[2024-01-15T10:30:00.000Z] [INFO] MongoDB connected
[2024-01-15T10:30:00.500Z] [INFO] Cron job initialized with expression: */15 * * * *
[2024-01-15T10:30:01.000Z] [INFO] Server running on port 5000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDDIT_CRON_EXPRESSION` | `*/15 * * * *` | Cron expression for sync schedule |
| `DEBUG` | `false` | Enable debug logging |
| `PORT` | `5000` | Server port |
| `MONGODB_URI` | - | MongoDB connection string |
| `JWT_SECRET` | - | JWT signing secret |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |

## Cron Expressions

Common cron expression examples:

```
*/15 * * * *     → Every 15 minutes
*/30 * * * *     → Every 30 minutes
0 * * * *       → Every hour
0 */6 * * *     → Every 6 hours
0 0 * * *       → Every day at midnight
0 3 * * *       → Every day at 3 AM
0 9-17 * * 1-5  → Every hour 9-5, Mon-Fri
```

Format: `minute hour day-of-month month day-of-week`

## Logging

Logs are written to `logs/app.log` with timestamps:

```
[2024-01-15T10:30:00.000Z] [INFO] Starting Reddit job sync...
[2024-01-15T10:30:02.500Z] [INFO] Fetching r/forhire...
[2024-01-15T10:30:15.000Z] [INFO] Reddit job sync completed { ... }
```

## API Examples

### Fetch Reddit Jobs

```bash
curl "http://localhost:5000/api/jobs/reddit?page=1&limit=12&sortBy=newest"
```

Response:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "jobs": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "Looking for React Developer",
        "description": "...",
        "subreddit": "forhire",
        "source": "reddit",
        "upvotes": 42,
        "commentsCount": 8,
        "tags": ["react", "javascript", "web development"],
        "createdAt": "2024-01-15T10:00:00.000Z",
        ...
      }
    ],
    "total": 245,
    "pages": 21,
    "currentPage": 1,
    "pageSize": 12
  }
}
```

### Filter by Subreddit

```bash
curl "http://localhost:5000/api/jobs/reddit?subreddit=forhire&limit=20"
```

### Search Jobs

```bash
curl "http://localhost:5000/api/jobs/reddit/search?q=python&page=1&limit=12"
```

### Get Statistics

```bash
curl "http://localhost:5000/api/jobs/reddit/stats"
```

Response:
```json
{
  "success": true,
  "data": {
    "totalJobs": 1245,
    "jobsBySubreddit": [
      { "_id": "forhire", "count": 350 },
      { "_id": "RemoteJobs", "count": 280 },
      ...
    ],
    "jobsByType": [
      { "_id": "freelance", "count": 600 },
      { "_id": "remote", "count": 400 },
      ...
    ],
    "mostCommonSkills": [
      { "_id": "python", "count": 156 },
      { "_id": "javascript", "count": 142 },
      ...
    ]
  }
}
```

### Manual Sync

```bash
curl -X POST "http://localhost:5000/api/jobs/reddit/sync"
```

## Error Handling

The system handles errors gracefully:

1. **Reddit API Failures** - Individual community failures don't stop the entire sync
2. **Duplicate Inserts** - Caught and logged, doesn't crash the sync
3. **Rate Limiting** - 1-second delay between Reddit API calls
4. **Connection Timeouts** - 10-second timeout per Reddit community request
5. **Invalid Data** - Posts with missing data are filtered out

All errors are logged to `logs/app.log` for debugging.

## Performance Considerations

### Rate Limiting

- **1 second delay** between Reddit community requests
- Prevents rate limiting from Reddit
- Full sync of 10 communities takes ~12-15 seconds

### Database Indexes

For optimal performance, create these indexes:

```javascript
db.jobs.createIndex({ source: 1, createdAt: -1 })
db.jobs.createIndex({ subreddit: 1 })
db.jobs.createIndex({ redditPostId: 1 }, { unique: true })
db.jobs.createIndex({ tags: 1 })
```

### Pagination

- Default limit: 12 jobs per page
- Maximum limit: Configurable (set to 100)
- Uses `.lean()` for faster queries

## Scaling Strategy

### Phase 1: MVP (Current)
- Sync every 15 minutes
- 50 posts per community
- Direct MongoDB queries

### Phase 2: Optimization
- Add Redis caching for popular queries
- Implement pagination cursor
- Add aggregation pipelines

### Phase 3: Advanced
- Queue-based processing (Bull, RabbitMQ)
- Elasticsearch for advanced search
- Real-time WebSocket updates
- Machine learning job categorization

## Maintenance

### Manual Sync for Testing

```javascript
// In Node.js shell
const { triggerSync } = require('./services/cron.service');
await triggerSync();
```

### Clear Old Jobs

```javascript
// Remove Reddit jobs older than 7 days
db.jobs.deleteMany({
  source: 'reddit',
  createdAt: { $lt: new Date(Date.now() - 7*24*60*60*1000) }
})
```

### Monitor Cron Job

Check logs for sync status:

```bash
tail -f logs/app.log | grep "Reddit job sync"
```

## Troubleshooting

### Cron Job Not Running

**Check:**
1. Is the server running? `console.log` should show initialization message
2. Is MongoDB connected?
3. Check `logs/app.log` for errors

### Duplicates Still Being Inserted

**Check:**
1. Is `redditPostId` properly extracted from Reddit data?
2. Run: `db.jobs.createIndex({ redditPostId: 1 }, { unique: true })`
3. Check if posts are being modified between syncs

### Slow Queries

**Fix:**
1. Create recommended indexes (see Performance section)
2. Check MongoDB indexes: `db.jobs.getIndexes()`
3. Monitor query performance: Enable `DEBUG=true`

## Future Enhancements

- [ ] AI-powered job categorization
- [ ] Salary extraction
- [ ] Location parsing
- [ ] Skills auto-tagging
- [ ] Job matching algorithm
- [ ] Real-time WebSocket updates
- [ ] Job recommendations
- [ ] Duplicate job detection across platforms
- [ ] Job quality scoring
- [ ] Expired job archival

## Support & Debugging

For debugging, set `DEBUG=true` in `.env` and check `logs/app.log` for detailed execution logs.

**Common issues:**
- Check MongoDB connection: `mongoose.connection.readyState`
- Check cron status: Look for initialization message in logs
- Verify Reddit API endpoints: Use curl to test directly
- Check for network timeouts: Look for timeout errors in logs

## License

MIT
