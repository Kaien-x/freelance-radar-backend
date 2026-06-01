const axios = require('axios');
const Job = require('../models/Job.model');
const logger = require('../utils/logger');

const REDDIT_COMMUNITIES = [
  'forhire',
  'freelance',
  'WorkOnline',
  'RemoteJobs',
  'remotejs',
  'webdevjobs',
  'reactjs',
  'node',
  'designjobs',
  'HireaWriter',
  'Hiring',
];

const REDDIT_API_TIMEOUT = 10000; // 10 seconds
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36';

/**
 * Fetch jobs from a single Reddit community
 * @param {string} subreddit - Subreddit name
 * @param {number} limit - Number of posts to fetch (max 100)
 * @returns {Promise<Array>} - Array of extracted job data
 */
const fetchRedditCommunity = async (subreddit, limit = 50) => {
  let retries = 3;

  while (retries > 0) {
    try {
      console.log('in fetchRedditCommunity');
      const url = `https://api.reddit.com/r/${subreddit}/new?limit=${limit}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: REDDIT_API_TIMEOUT,
      });

      console.log('====================================');
      console.log('URL:', url);
      console.log('Subreddit:', subreddit);
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers['content-type']);
      console.log('Response:', JSON.stringify(response.data).substring(0, 1000));
      console.log('====================================');

      if (!response.data?.data?.children) {
        logger.warn(`No data received from r/${subreddit}`);
        return [];
      }

      const posts = response.data.data.children.map(item => item.data);
      return extractJobsFromPosts(posts, subreddit);
    } catch (error) {
      retries--;

      // Don't log port closed errors to console
      if (!error.message.includes('port closed') && !error.message.includes('ECONNRESET')) {
        logger.warn(`Failed to fetch Reddit community r/${subreddit} (retries left: ${retries}):`, error.message);
      }

      if (retries === 0) {
        logger.error(`Failed to fetch Reddit community r/${subreddit} after 3 attempts`);
        return [];
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
    }
  }
};

/**
 * Extract job data from Reddit posts
 * @param {Array} posts - Reddit post objects
 * @param {string} subreddit - Subreddit name
 * @returns {Array} - Extracted job data
 */
const extractJobsFromPosts = (posts, subreddit) => {
  return posts
    .filter(post => {
      // Filter out stickied posts, deleted content, and non-self posts
      if (post.stickied || post.removed || !post.selftext || post.author === '[deleted]') {
        return false;
      }

      // Only import posts where the author is offering services (for hire) rather than asking for help or hiring someone
      return isForHirePost(post);
    })
    .map(post => {
      const title = post.title || '';
      const description = post.selftext || '';

      // Detect job type and category from title/description
      const jobType = detectJobType(title, description);
      const category = detectCategory(title, description);

      // Extract potential skills from text
      const skills = extractSkills(title, description);

      return {
        redditPostId: post.id,
        title: title.substring(0, 200),
        description: description.substring(0, 5000), // Limit description length
        subreddit: subreddit,
        author: post.author,
        url: `https://reddit.com${post.permalink}`,
        permalink: post.permalink,
        createdAt: new Date(post.created_utc * 1000),
        upvotes: post.score,
        commentsCount: post.num_comments,
        thumbnail: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : null,
        tags: skills,
        jobType: jobType,
        category: category,
        source: 'reddit',
        redditUrl: `https://reddit.com${post.permalink}`,
      };
    });
};

/**
 * Determine whether a Reddit post is a "hire" offer
 * Only accept posts with "[hire]" or "[hiring]" in the title
 * @param {Object} post - Reddit post object
 * @returns {boolean}
 */
const isForHirePost = (post) => {
  const title = (post.title || '').toLowerCase();
  return title.includes('[hire]') || title.includes('[hiring]');
};

/**
 * Detect job type from title and description
 * @param {string} title - Post title
 * @param {string} description - Post description
 * @returns {string} - Job type
 */
const detectJobType = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes('freelance') || text.includes('gig')) return 'freelance';
  if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) return 'remote';
  if (text.includes('part-time') || text.includes('part time')) return 'part-time';
  if (text.includes('full-time') || text.includes('full time')) return 'full-time';
  if (text.includes('contract') || text.includes('project-based')) return 'contract';

  return 'freelance'; // Default to freelance
};

/**
 * Detect job category from title and description
 * @param {string} title - Post title
 * @param {string} description - Post description
 * @returns {string} - Detected category
 */
const detectCategory = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  const matchesKeyword = (text, keyword) => {
    if (keyword.length <= 3) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(text);
    }
    return text.includes(keyword);
  };

  const categoryMap = [
    {
      category: 'Web Development',
      weight: 1,
      keywords: [
        'website', 'web app', 'webapp', 'frontend', 'front-end', 'front end',
        'backend', 'back-end', 'back end', 'full stack', 'fullstack', 'full-stack',
        'html', 'css', 'javascript', 'react', 'vue', 'angular', 'next.js', 'nextjs',
        'nuxt', 'svelte', 'wordpress', 'shopify', 'woocommerce', 'landing page',
        'web developer', 'web dev', 'php', 'laravel', 'codeigniter', 'web application'
      ]
    },
    {
      category: 'Mobile Development',
      weight: 1,
      keywords: [
        'mobile app', 'ios app', 'android app', 'react native', 'flutter',
        'swift', 'kotlin', 'xamarin', 'mobile developer', 'mobile dev',
        'app development', 'iphone app', 'ipad app', 'android development',
        'ios development', 'cross platform app'
      ]
    },
    {
      category: 'Design / UI/UX',
      weight: 1,
      keywords: [
        'ui/ux', 'ui ux', 'ux design', 'ui design', 'figma', 'sketch',
        'adobe xd', 'graphic design', 'logo design', 'logo creation', 'branding',
        'illustration', 'photoshop', 'illustrator', 'web design', 'designer',
        'creative design', 'mockup', 'wireframe', 'prototype', 'visual design',
        'brand identity', 'print design', 'poster design', 'banner design',
        'canva', 'indesign', 'typography'
      ]
    },
    {
      category: 'Data Science / AI',
      weight: 1.5,
      keywords: [
        'machine learning', 'deep learning', 'data science', 'data analyst',
        'data engineer', 'artificial intelligence', 'natural language processing',
        'tensorflow', 'pytorch', 'computer vision', 'neural network', 'ai model',
        'large language model', 'llm', 'gpt', 'nlp', 'predictive model',
        'data visualization', 'statistical analysis', 'r programming',
        'pandas', 'numpy', 'scikit', 'jupyter', 'tableau', 'power bi',
        'business intelligence', 'bi developer', 'data pipeline'
      ]
    },
    {
      category: 'AI Training / Data Labeling',
      weight: 2,
      keywords: [
        'ai trainer', 'data labeling', 'data annotation', 'image annotation',
        'dataset', 'rlhf', 'training data', 'annotate', 'ai training',
        'content moderation', 'image review', 'photo review', 'label images',
        'label data', 'data collection', 'model training', 'feedback training',
        'human feedback', 'ai evaluation', 'llm evaluation', 'prompt evaluation'
      ]
    },
    {
      category: 'DevOps / Cloud',
      weight: 1.5,
      keywords: [
        'devops', 'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes',
        'ci/cd', 'cicd', 'terraform', 'ansible', 'cloud infrastructure',
        'sysadmin', 'server admin', 'linux admin', 'cloud engineer',
        'cloud architect', 'devsecops', 'jenkins', 'github actions',
        'cloud migration', 'infrastructure as code', 'site reliability',
        'sre', 'load balancer', 'nginx', 'apache'
      ]
    },
    {
      category: 'Database / Backend',
      weight: 1,
      keywords: [
        'postgresql', 'mongodb', 'mysql', 'redis', 'api development',
        'rest api', 'graphql', 'microservices', 'node.js', 'express.js',
        'django', 'flask', 'spring boot', 'laravel', 'database design',
        'database optimization', 'sql server', 'oracle database', 'firebase',
        'supabase', 'prisma', 'sequelize', 'backend developer', 'api integration',
        'websocket', 'grpc', 'backend development'
      ]
    },
    {
      category: 'Data / Automation',
      weight: 1,
      keywords: [
        'excel', 'spreadsheet', 'pdf conversion', 'data extraction',
        'automation', 'python script', 'web scraping', 'scraping', 'csv',
        'google sheets', 'data processing', 'data migration', 'etl',
        'convert pdf', 'pdf to excel', 'pdf to word', 'data cleaning',
        'data formatting', 'macro', 'vba', 'zapier', 'make.com', 'n8n',
        'workflow automation', 'task automation', 'rpa', 'selenium',
        'puppeteer', 'playwright', 'beautifulsoup'
      ]
    },
    {
      category: 'Blockchain / Web3',
      weight: 2,
      keywords: [
        'blockchain', 'ethereum', 'solidity', 'web3', 'smart contract',
        'cryptocurrency', 'nft', 'defi', 'dapp', 'solana', 'polygon',
        'binance smart chain', 'hardhat', 'truffle', 'metamask', 'dao',
        'tokenomics', 'crypto wallet', 'web3.js', 'ethers.js'
      ]
    },
    {
      category: 'Content Writing',
      weight: 1,
      keywords: [
        'content writing', 'copywriting', 'blog post', 'article writing',
        'ghostwriting', 'technical writing', 'content creator', 'proofreading',
        'copy editor', 'content writer', 'science communicator',
        'technical communicator', 'newsletter writing', 'social media content',
        'script writing', 'speech writing', 'grant writing', 'press release',
        'ebook writing', 'white paper', 'case study writing', 'product description',
        'creative writing', 'storytelling', 'journalism'
      ]
    },
    {
      category: 'SEO / Digital Marketing',
      weight: 1,
      keywords: [
        'search engine optimization', 'digital marketing', 'social media marketing',
        'google ads', 'facebook ads', 'pay per click', 'email marketing',
        'growth hacking', 'seo audit', 'link building', 'keyword research',
        'content marketing', 'affiliate marketing', 'influencer marketing',
        'tiktok marketing', 'instagram marketing', 'youtube marketing',
        'marketing strategy', 'brand marketing', 'ppc campaign',
        'conversion rate', 'a/b testing', 'marketing funnel'
      ]
    },
    {
      category: 'Video / Animation',
      weight: 1,
      keywords: [
        'video editing', 'video production', 'motion graphics', 'after effects',
        'premiere pro', 'davinci resolve', 'vfx', '3d animation', '2d animation',
        'animation', 'video creator', 'youtube video', 'short form video',
        'reels editing', 'tiktok video', 'explainer video', 'whiteboard animation',
        'character animation', 'blender', 'cinema 4d', 'video ads',
        'product video', 'documentary', 'video thumbnail'
      ]
    },
    {
      category: 'Game Development',
      weight: 1.5,
      keywords: [
        'game development', 'unity', 'unreal engine', 'godot', 'game design',
        'game art', 'game programmer', 'game dev', 'mobile game', 'pc game',
        'multiplayer game', 'game mechanics', 'level design', 'game ui',
        'roblox', 'minecraft mod', 'game testing', 'game assets'
      ]
    },
    {
      category: 'Cybersecurity',
      weight: 2,
      keywords: [
        'cybersecurity', 'penetration testing', 'pentest', 'infosec',
        'vulnerability assessment', 'ethical hacking', 'security audit',
        'cyber security', 'bug bounty', 'network security', 'firewall',
        'security engineer', 'ctf', 'malware analysis', 'reverse engineering',
        'owasp', 'security testing', 'code review security'
      ]
    },
    {
      category: 'QA / Testing',
      weight: 1.5,
      keywords: [
        'quality assurance', 'software testing', 'manual testing',
        'automated testing', 'test cases', 'bug reporting', 'qa engineer',
        'account testing', 'app testing', 'website testing', 'usability testing',
        'regression testing', 'selenium testing', 'cypress', 'playwright testing',
        'test automation', 'qa analyst', 'performance testing', 'load testing'
      ]
    },
    {
      category: 'Virtual Assistant',
      weight: 1,
      keywords: [
        'virtual assistant', 'admin support', 'administrative assistant',
        'personal assistant', 'executive assistant', 'calendar management',
        'email management', 'customer support', 'customer service',
        'live chat support', 'helpdesk', 'data entry', 'online research',
        'lead generation', 'cold calling', 'appointment setting'
      ]
    },
    {
      category: 'E-commerce',
      weight: 1,
      keywords: [
        'ecommerce', 'online store', 'magento', 'amazon seller', 'dropshipping',
        'product listing', 'etsy', 'ebay', 'amazon fba', 'shopify store',
        'product photography', 'product research', 'inventory management',
        'marketplace', 'online marketplace', 'store setup', 'woocommerce store'
      ]
    },
    {
      category: 'Project Management',
      weight: 1,
      keywords: [
        'project management', 'project manager', 'scrum', 'agile', 'jira',
        'product manager', 'product management', 'product owner', 'sprint',
        'roadmap', 'stakeholder', 'trello', 'asana', 'notion', 'monday.com',
        'delivery manager', 'programme manager', 'pmo'
      ]
    },
  ];

  // Score each category
  const scores = categoryMap.map(({ category, keywords, weight }) => {
    const matchCount = keywords.filter(keyword =>
      matchesKeyword(text, keyword)
    ).length;

    return {
      category,
      score: matchCount * weight
    };
  }).filter(item => item.score > 0);

  if (scores.length === 0) return ['General'];

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const topScore = scores[0].score;

  // Return top category + any within 50% of top score, max 2
  const topCategories = scores
    .filter(item => item.score >= topScore * 0.5)
    .slice(0, 2)
    .map(item => item.category);

  return topCategories;
};

/**
 * Check if a post is likely spam
 * @param {string} title 
 * @param {string} description 
 * @returns {boolean}
 */
const isSpamPost = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  const spamSignals = [
    'send a dm', 'dm me first', 'dm beforehand',
    'algorithmic growth', 'send message first',
    'whatsapp me', 'earn from home easy',
    'no experience needed earn', 'make money fast',
    'looking for 50 people', 'looking for 80 people',
    'looking for 100 people', 'we will send further details'
  ];

  return spamSignals.some(signal => text.includes(signal));
};

/**
 * Extract potential skills from text
 * @param {string} title - Post title
 * @param {string} description - Post description
 * @returns {Array} - Array of detected skills
 */
const extractSkills = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  const skillKeywords = [
    'python', 'javascript', 'typescript', 'node.js', 'react', 'vue', 'angular',
    'java', 'c++', 'c#', '.net', 'php', 'ruby', 'golang', 'rust', 'swift',
    'kotlin', 'dart', 'flask', 'django', 'spring', 'express', 'fastapi',
    'postgresql', 'mongodb', 'mysql', 'redis', 'aws', 'azure', 'gcp',
    'docker', 'kubernetes', 'git', 'linux', 'windows', 'macos',
    'html', 'css', 'sass', 'tailwind', 'bootstrap', 'webpack', 'vite',
    'graphql', 'rest', 'api', 'microservices', 'devops', 'ci/cd',
    'machine learning', 'ai', 'deep learning', 'tensorflow', 'pytorch',
    'data science', 'analytics', 'sql', 'etl', 'hadoop', 'spark',
    'android', 'ios', 'react native', 'flutter', 'xamarin',
    'blockchain', 'ethereum', 'solidity', 'web3', 'crypto',
    'figma', 'ui/ux', 'design', 'photoshop', 'illustrator',
    'content writing', 'copywriting', 'seo', 'social media', 'marketing',
    'project management', 'agile', 'scrum', 'jira',
  ];

  const skills = [];
  for (const skill of skillKeywords) {
    if (text.includes(skill) && !skills.includes(skill)) {
      skills.push(skill);
    }
  }

  return skills.slice(0, 10); // Limit to 10 skills
};

/**
 * Fetch all Reddit jobs from configured communities
 * @returns {Promise<Object>} - Sync results with counts
 */
const fetchAllRedditJobs = async () => {
  logger.info('Starting Reddit job sync...');

  const syncResults = {
    startTime: new Date(),
    communitiesFetched: 0,
    totalPostsFetched: 0,
    newJobsCreated: 0,
    duplicatesSkipped: 0,
    errors: [],
  };

  try {
    const allJobs = [];

    // Fetch from all communities sequentially with delays to avoid rate limiting
    for (const subreddit of REDDIT_COMMUNITIES) {
      try {
        logger.info(`Fetching r/${subreddit}...`);
        const jobs = await fetchRedditCommunity(subreddit, 50);

        if (jobs.length > 0) {
          allJobs.push(...jobs);
          syncResults.totalPostsFetched += jobs.length;
        }

        syncResults.communitiesFetched++;

        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg = `Error fetching r/${subreddit}: ${error.message}`;
        logger.error(errorMsg);
        syncResults.errors.push(errorMsg);
      }
    }

    // Process jobs and insert new ones
    for (const jobData of allJobs) {
      try {
        // Check if job already exists by redditPostId
        const existingJob = await Job.findOne({ redditPostId: jobData.redditPostId });

        if (existingJob) {
          syncResults.duplicatesSkipped++;
          continue;
        }

        // Skip spam posts
        if (isSpamPost(jobData.title, jobData.description)) {
          // Optionally count spam skips (not counted in stats)
          continue;
        }

        // Create new job
        await Job.create(jobData);
        syncResults.newJobsCreated++;
      } catch (error) {
        const errorMsg = `Error processing Reddit job: ${error.message}`;
        logger.error(errorMsg);
        syncResults.errors.push(errorMsg);
      }
    }

    syncResults.endTime = new Date();
    syncResults.durationMs = syncResults.endTime - syncResults.startTime;

    logger.info('Reddit job sync completed', syncResults);
    return syncResults;
  } catch (error) {
    logger.error('Fatal error during Reddit job sync:', error.message);
    syncResults.endTime = new Date();
    syncResults.durationMs = syncResults.endTime - syncResults.startTime;
    syncResults.errors.push(`Fatal error: ${error.message}`);
    return syncResults;
  }
};

/**
 * Get Reddit jobs with pagination and filtering
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Jobs with pagination info
 */
const getRedditJobs = async (options = {}) => {
  const {
    page = 1,
    limit = 12,
    subreddit = null,
    search = null,
    sortBy = 'newest',
  } = options;

  const query = { source: 'reddit', status: 'open' };

  // Filter to only get jobs from the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  query.createdAt = { $gte: sevenDaysAgo };

  if (subreddit) {
    query.subreddit = subreddit;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
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

    return {
      jobs,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      pageSize: Number(limit),
    };
  } catch (error) {
    logger.error('Error fetching Reddit jobs:', error.message);
    throw error;
  }
};

/**
 * Get Reddit job statistics
 * @returns {Promise<Object>} - Statistics
 */
const getRedditStats = async () => {
  try {
    const [
      totalJobs,
      jobsBySubreddit,
      jobsByType,
      mostCommonSkills,
      latestSync,
    ] = await Promise.all([
      Job.countDocuments({ source: 'reddit' }),
      Job.aggregate([
        { $match: { source: 'reddit' } },
        { $group: { _id: '$subreddit', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Job.aggregate([
        { $match: { source: 'reddit' } },
        { $group: { _id: '$jobType', count: { $sum: 1 } } },
      ]),
      Job.aggregate([
        { $match: { source: 'reddit' } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Get latest sync from logs (if you want to track this)
      Promise.resolve(new Date()),
    ]);

    return {
      totalJobs,
      jobsBySubreddit,
      jobsByType,
      mostCommonSkills,
      latestSyncTime: latestSync,
    };
  } catch (error) {
    logger.error('Error fetching Reddit stats:', error.message);
    throw error;
  }
};

module.exports = {
  fetchAllRedditJobs,
  getRedditJobs,
  getRedditStats,
  REDDIT_COMMUNITIES,
  detectCategory,
};
