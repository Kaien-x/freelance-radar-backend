'use strict';

/**
 * Pure filtering/classification utilities for Reddit job posts.
 * No DB or network dependencies — safe to import in tests.
 */

// ─── Spam Detection ────────────────────────────────────────────────────────────

const SPAM_PHRASE_SIGNALS = {
  offsite_contact: {
    weight: 55,
    phrases: [
      'send a dm', 'dm me first', 'dm beforehand', 'apply via dm',
      'reach out via dm', 'message me on whatsapp', 'whatsapp me', 'whatsapp only',
      'telegram me', 'telegram only', 'contact via telegram',
      'chat with me first', 'inbox me first', 'kindly dm me',
      'send message first', 'message before applying', 'message me directly',
      'dm for details', 'dm for more info', 'message for more information',
      'contact me directly to apply', 'apply by messaging', 'slide into',
    ],
  },
  mlm_pyramid: {
    weight: 55, // single MLM phrase is sufficient to flag
    phrases: [
      'unlimited earning potential', 'unlimited income', 'passive income opportunity',
      'residual income', 'financial freedom opportunity',
      'downline', 'recruitment bonus', 'refer and earn big',
      'network marketing', 'multi-level marketing', 'mlm opportunity',
      'join our growing network', 'earn while you sleep',
      'time freedom and income', 'work whenever you want and earn',
      'affiliate marketing team unlimited',
    ],
  },
  unrealistic_pay: {
    weight: 50,
    phrases: [
      'earn $500 daily', 'earn $1000 daily', 'earn $500 per day',
      'earn $1000 per day', 'make $500 a day', 'make $1000 a day',
      '$5000 per week easily', '$10000 per month easily',
      'earn hundreds daily', 'earn thousands weekly',
      'high income work from home easy', 'get paid instantly guaranteed',
      'daily payouts guaranteed', 'instant payouts no waiting',
      'earn $200 daily', 'make $300 per day easy',
    ],
  },
  no_skill_scam: {
    weight: 55, // "get paid to like photos" etc. are always spam
    phrases: [
      'no experience needed to earn', 'no skills required to earn',
      'anyone can do this earn', 'get paid to like photos',
      'get paid to watch videos', 'get paid to click ads',
      'get paid to take surveys for money', 'mystery shopper earn',
      'online typing job earn money', 'data entry typing earn daily',
      'copy paste job earn', 'form filling job earn online',
      'ad posting job earn', 'simple online tasks earn money',
    ],
  },
  mass_hiring_scam: {
    weight: 50,
    phrases: [
      'looking for 50 people', 'looking for 80 people', 'looking for 100 people',
      'looking for 200 people', 'hiring 50 people urgently',
      'need 100 workers immediately', 'mass hiring ongoing',
      'bulk hiring this week', 'we need a lot of people to join',
      'hiring hundreds of people',
    ],
  },
  vague_misleading: {
    weight: 25,
    phrases: [
      'we will send further details', 'details will be shared after',
      'more info on dm', 'project details only on chat',
      'algorithmic growth system', 'earn from home easy money',
      'work from anywhere unlimited income',
      'serious inquiries only send dm', 'link in bio to apply',
      'check profile for job details', 'visit profile link for details',
      'apply through the link in our bio', 'see pinned post for details',
    ],
  },
};

const SPAM_PATTERN_SIGNALS = [
  { regex: /\$\d{3,}(?:\.\d{2})?[\s\/]*(?:per\s*)?(?:day|daily)\b/i, label: 'high_daily_pay_claim', weight: 55 },
  { regex: /\bmaking?\s+\$\d{3,}\s*(?:per\s*)?(?:day|daily)\b/i, label: 'daily_pay_pattern', weight: 55 },
  { regex: /looking\s+for\s+\d{2,}\s+(?:people|workers|members|agents)\b/i, label: 'mass_hiring_pattern', weight: 50 },
  { regex: /hiring\s+\d{2,}\s+(?:people|workers|employees|agents)\b/i, label: 'mass_hiring_number', weight: 50 },
  { regex: /!!!+/, label: 'excessive_exclamation', weight: 20 },
  { regex: /\b(?:100|1000)%\s*(?:legit|real|genuine|guaranteed|authentic)\b/i, label: 'legit_guarantee_claim', weight: 30 },
  { regex: /earn\s+\$\d{3,}/i, label: 'earn_high_amount_pattern', weight: 35 },
  { regex: /\bno\s+experience\s+(?:needed|required|necessary)\s+(?:to\s+)?earn\b/i, label: 'no_exp_earn_pattern', weight: 40 },
  { regex: /\bwork\s+(?:from\s+home|at\s+home)\s+(?:and\s+)?earn\s+\$\d+/i, label: 'work_from_home_earn_pattern', weight: 40 },
];

const SPAM_THRESHOLD = 50;

/**
 * Returns detailed spam analysis for a post.
 * @param {string} title
 * @param {string} description
 * @returns {{ isSpam: boolean, score: number, signals: string[] }}
 */
const getSpamAnalysis = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  const signals = [];
  let score = 0;

  // Phrase-based: one match per category is enough to add that category's weight
  for (const [category, { weight, phrases }] of Object.entries(SPAM_PHRASE_SIGNALS)) {
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        signals.push(`${category}:${phrase}`);
        score += weight;
        break;
      }
    }
  }

  // Pattern-based: each independent pattern adds its own weight
  for (const { regex, label, weight } of SPAM_PATTERN_SIGNALS) {
    if (regex.test(text)) {
      signals.push(label);
      score += weight;
    }
  }

  return { isSpam: score >= SPAM_THRESHOLD, score, signals };
};

/**
 * Simple boolean spam check — backward-compatible with existing usage.
 */
const isSpamPost = (title, description) => getSpamAnalysis(title, description).isSpam;

// ─── Job Classification ────────────────────────────────────────────────────────

// ─── Body scoring signals ──────────────────────────────────────────────────────
// Phrases in the post BODY that strongly suggest the author IS the freelancer.
const FREELANCER_BODY_SIGNALS = [
  // Self-identification
  "i'm a ", 'i am a ', "i'm an ", 'i am an ',
  'i am a freelancer', "i'm a freelancer",
  'i am a developer', "i'm a developer",
  'i am a designer', "i'm a designer",
  'i am an artist', "i'm an artist",
  'i am a writer', "i'm a writer",
  'i am a video editor', "i'm a video editor",
  // Self-promotion
  'my portfolio', 'my work', 'my rates', 'my pricing',
  'my hourly rate', 'my rate is', 'my skills include',
  'i specialize in', 'i offer ', 'i provide ',
  'i have been working', 'i have experience in', 'i have worked with',
  'years of experience', 'year of experience',
  'check out my', 'see my work', 'view my portfolio',
  'my github', 'my linkedin', 'my behance', 'my dribbble', 'my upwork',
  // Looking for work
  'looking for new clients', 'looking for projects',
  'available for new projects', 'available immediately',
  'taking on new projects', 'taking new clients',
  'open to new opportunities', 'seeking new opportunities',
  'feel free to dm', 'feel free to message',
  'you can reach me', 'reach me at',
  'hire me', 'please hire', 'would love to work with you',
  // Education / status
  'i recently graduated', 'i just graduated', 'i graduated',
  'i am currently studying', 'i am a student',
  'i am self-taught', "i'm self-taught",
  'entry level', 'junior developer', 'junior designer',
];

// Phrases in the post BODY that strongly suggest the author IS the client hiring.
const CLIENT_BODY_SIGNALS = [
  // Describing a project/need
  'we are looking for', 'i am looking for a', "i'm looking for a",
  'we need someone', 'looking to hire', 'want to hire',
  'we are a company', 'we are a startup', 'our company', 'our team', 'our startup',
  'our project', 'our product', 'our app', 'our website', 'our platform',
  // Budget / payment
  'budget:', 'budget is', 'our budget', 'budget range', 'total budget',
  'project budget', 'fixed budget', 'hourly rate:', 'hourly budget',
  'we will pay', 'payment:', 'compensation:', 'we offer payment',
  'paid in', 'pay via', 'payment via', 'payment through',
  // Requirements and deliverables
  'requirements:', 'deliverables:', 'deadline:', 'timeline:',
  'what we need:', 'what you\'ll do', 'responsibilities:',
  'you will be responsible', 'you must have', 'you should have',
  'ideal candidate', 'required skills', 'must have experience',
  // Call to action (client asking freelancer to apply)
  'please send', 'send us your', 'send me your', 'submit your',
  'please dm', 'please message', 'interested? dm', 'dm if interested',
  'if interested', 'if you are interested', 'apply here', 'apply at',
  'contact us', 'reach out to us', 'reach out if',
  'drop your portfolio', 'share your portfolio', 'include portfolio',
  // Project details
  'job description', 'project description', 'project details',
  'scope of work', 'project scope', 'the project involves',
  'we are building', 'we are developing', 'we are creating',
  'help us build', 'help us create', 'help us develop',
];

/**
 * Returns true only when a CLIENT is looking to hire a freelancer.
 * Checks both the post title AND body content to confirm intent.
 */
const isForHirePost = (post) => {
  const title = (post.title    || '').toLowerCase();
  const body  = (post.selftext || '').toLowerCase();

  // ── STEP 1: Hard title exclusions — freelancer advertising themselves ──────
  // These title patterns ALWAYS mean the author is the one looking for work.
  const titleExclusions = [
    '[for hire]', 'for hire]',
    'available for hire', 'available for work', 'available for freelance',
    'looking for work', 'looking for a job', 'looking for employment',
    'looking for clients', 'looking for projects', 'looking for opportunities',
    'looking for new opportunities', 'looking for my first',
    'anyone hiring', 'is anyone hiring', 'anyone need a', 'anyone need an',
    'does anyone need', 'do you need a', 'could use some work',
    'open to work', 'open to opportunities', 'open for work',
    'taking on clients', 'taking new clients',
    'hire me', 'please hire me',
    'am looking for', "i'm looking for work", "i am looking for work",
    'i am a freelance', "i'm a freelance",
    '[portfolio]', 'portfolio post',
    'just graduated', 'recent graduate', 'fresh graduate', 'new graduate',
    'entry level looking', 'junior looking', 'beginner looking',
  ];
  if (titleExclusions.some(p => title.includes(p))) return false;

  // ── STEP 2: Hard body exclusions — body confirms it's a freelancer post ───
  // Even if the title looks like a client post, body can override.
  const bodyExclusionCount = FREELANCER_BODY_SIGNALS.filter(s => body.includes(s)).length;
  const bodyClientCount    = CLIENT_BODY_SIGNALS.filter(s => body.includes(s)).length;

  // If body has 2+ more freelancer signals than client signals → reject
  if (bodyExclusionCount >= 2 && bodyExclusionCount > bodyClientCount) return false;

  // ── STEP 3: Client bracket tags in title (highly reliable) ───────────────
  const clientTags = [
    '[hiring]', '[task]',
    '[job]', '[paid]', '[paid gig]', '[gig]',
    '[commission]', '[comm]',
    '[project]', '[contract]', '[request]',
  ];
  if (clientTags.some(tag => title.includes(tag))) return true;

  // ── STEP 4: Client phrases in title ──────────────────────────────────────
  const clientTitlePhrases = [
    'looking for a developer', 'looking for a designer', 'looking for a writer',
    'looking for a freelancer', 'looking for an artist', 'looking for a programmer',
    'looking for a video editor', 'looking for a photographer', 'looking for an editor',
    'looking for a voice', 'looking for an animator', 'looking for a 3d',
    'looking for someone to build', 'looking for someone to create',
    'looking for someone to develop', 'looking for someone to design',
    'looking for someone to help', 'looking for someone to manage',
    'looking for a skilled', 'looking for an experienced',
    'looking for a react', 'looking for a node', 'looking for a python',
    'looking for a unity', 'looking for a web', 'looking for a mobile',
    'looking for a wordpress', 'looking for a shopify',
    'looking to hire', 'want to hire', 'wants to hire',
    'need a developer', 'need a designer', 'need a writer', 'need a freelancer',
    'need a programmer', 'need an artist', 'need a video editor', 'need an editor',
    'need a photographer', 'need a voice actor', 'need an animator',
    'need a 3d', 'need a logo', 'need a website', 'need an app', 'need a mobile app',
    'need a react', 'need a node', 'need a python',
    'need someone to build', 'need someone to create', 'need someone to develop',
    'need someone to design', 'need someone to help', 'need someone to make',
    'seeking a developer', 'seeking a designer', 'seeking a writer',
    'seeking a freelancer', 'seeking an artist', 'seeking a programmer',
    'hiring a developer', 'hiring a designer', 'hiring a writer',
    'hiring a programmer', 'hiring an artist', 'hiring a video editor',
    'we are hiring', "we're hiring", 'currently hiring', 'now hiring',
    'developer wanted', 'designer wanted', 'writer wanted', 'editor wanted',
    'freelancer wanted', 'artist wanted', 'animator wanted', 'programmer wanted',
    'developer needed', 'designer needed', 'writer needed', 'editor needed',
    'freelancer needed', 'help wanted',
    'open position', 'job opening', 'job opportunity', 'job posting',
    'remote position', 'freelance position', 'contract position', 'contract role',
    'we need a developer', 'we need a designer', 'we need a writer',
    'we need a programmer', 'we need an artist', 'we need a freelancer',
    'i need a developer', 'i need a designer', 'i need a writer',
    'i need a logo', 'i need a website', 'i need an app',
    'commissions open', 'commission open', 'taking commissions',
    'paid commission', 'paid opportunity', 'paid gig', 'paid project',
    'co-founder wanted', 'cofounder wanted', 'co-founder needed',
  ];
  if (clientTitlePhrases.some(phrase => title.includes(phrase))) return true;

  // ── STEP 5: Budget bracket in title ──────────────────────────────────────
  if (/\[\s*\$\d+/.test(title)) return true;

  // ── STEP 6: Body-only rescue — vague title but body clearly shows a client
  // Require at least 2 client signals in body with no freelancer signals
  if (bodyClientCount >= 2 && bodyExclusionCount === 0) return true;

  return false;
};

const detectJobType = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('freelance') || text.includes('gig')) return 'freelance';
  if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) return 'remote';
  if (text.includes('part-time') || text.includes('part time')) return 'part-time';
  if (text.includes('full-time') || text.includes('full time')) return 'full-time';
  if (text.includes('contract') || text.includes('project-based')) return 'contract';
  return 'freelance';
};

const CATEGORY_MAP = [
  { category: 'Web Development', weight: 1, keywords: ['website', 'web app', 'webapp', 'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'fullstack', 'html', 'css', 'javascript', 'react', 'vue', 'angular', 'next.js', 'nextjs', 'nuxt', 'svelte', 'wordpress', 'shopify', 'woocommerce', 'landing page', 'web developer', 'web dev', 'php', 'laravel', 'web application'] },
  { category: 'Mobile Development', weight: 1, keywords: ['mobile app', 'ios app', 'android app', 'react native', 'flutter', 'swift', 'kotlin', 'xamarin', 'mobile developer', 'app development', 'iphone app', 'android development', 'ios development', 'cross platform app'] },
  { category: 'Design / UI/UX', weight: 1, keywords: ['ui/ux', 'ui ux', 'ux design', 'ui design', 'figma', 'sketch', 'adobe xd', 'graphic design', 'logo design', 'branding', 'illustration', 'photoshop', 'illustrator', 'web design', 'designer', 'mockup', 'wireframe', 'prototype', 'visual design', 'brand identity', 'canva', 'typography'] },
  { category: 'Data Science / AI', weight: 1.5, keywords: ['machine learning', 'deep learning', 'data science', 'data analyst', 'data engineer', 'artificial intelligence', 'natural language processing', 'tensorflow', 'pytorch', 'computer vision', 'neural network', 'ai model', 'large language model', 'llm', 'gpt', 'nlp', 'predictive model', 'data visualization', 'statistical analysis', 'r programming', 'pandas', 'numpy', 'scikit', 'jupyter', 'tableau', 'power bi', 'business intelligence', 'data pipeline'] },
  { category: 'AI Training / Data Labeling', weight: 2, keywords: ['ai trainer', 'data labeling', 'data annotation', 'image annotation', 'dataset', 'rlhf', 'training data', 'annotate', 'ai training', 'content moderation', 'image review', 'label images', 'label data', 'data collection', 'model training', 'feedback training', 'human feedback', 'ai evaluation', 'llm evaluation', 'prompt evaluation'] },
  { category: 'DevOps / Cloud', weight: 1.5, keywords: ['devops', 'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'ci/cd', 'cicd', 'terraform', 'ansible', 'cloud infrastructure', 'sysadmin', 'server admin', 'linux admin', 'cloud engineer', 'cloud architect', 'jenkins', 'github actions', 'cloud migration', 'infrastructure as code', 'site reliability', 'sre', 'nginx', 'apache'] },
  { category: 'Database / Backend', weight: 1, keywords: ['postgresql', 'mongodb', 'mysql', 'redis', 'api development', 'rest api', 'graphql', 'microservices', 'node.js', 'express.js', 'django', 'flask', 'spring boot', 'laravel', 'database design', 'database optimization', 'sql server', 'oracle database', 'firebase', 'supabase', 'prisma', 'sequelize', 'backend developer', 'api integration', 'websocket', 'backend development'] },
  { category: 'Data / Automation', weight: 1, keywords: ['excel', 'spreadsheet', 'pdf conversion', 'data extraction', 'automation', 'python script', 'web scraping', 'scraping', 'csv', 'google sheets', 'data processing', 'data migration', 'etl', 'convert pdf', 'data cleaning', 'macro', 'vba', 'zapier', 'make.com', 'n8n', 'workflow automation', 'task automation', 'rpa', 'selenium', 'puppeteer', 'playwright', 'beautifulsoup'] },
  { category: 'Blockchain / Web3', weight: 2, keywords: ['blockchain', 'ethereum', 'solidity', 'web3', 'smart contract', 'cryptocurrency', 'nft', 'defi', 'dapp', 'solana', 'polygon', 'binance smart chain', 'hardhat', 'truffle', 'metamask', 'dao', 'tokenomics', 'crypto wallet', 'web3.js', 'ethers.js'] },
  { category: 'Content Writing', weight: 1, keywords: ['content writing', 'copywriting', 'blog post', 'article writing', 'ghostwriting', 'technical writing', 'content creator', 'proofreading', 'content writer', 'newsletter writing', 'social media content', 'script writing', 'grant writing', 'press release', 'ebook writing', 'white paper', 'case study writing', 'product description', 'creative writing', 'storytelling', 'journalism'] },
  { category: 'SEO / Digital Marketing', weight: 1, keywords: ['search engine optimization', 'digital marketing', 'social media marketing', 'google ads', 'facebook ads', 'pay per click', 'email marketing', 'growth hacking', 'seo audit', 'link building', 'keyword research', 'content marketing', 'affiliate marketing', 'influencer marketing', 'tiktok marketing', 'instagram marketing', 'youtube marketing', 'marketing strategy', 'brand marketing', 'ppc campaign', 'conversion rate', 'a/b testing', 'marketing funnel'] },
  { category: 'Video / Animation', weight: 1, keywords: ['video editing', 'video production', 'motion graphics', 'after effects', 'premiere pro', 'davinci resolve', 'vfx', '3d animation', '2d animation', 'animation', 'video creator', 'youtube video', 'short form video', 'reels editing', 'tiktok video', 'explainer video', 'whiteboard animation', 'character animation', 'blender', 'cinema 4d', 'video ads', 'product video', 'video thumbnail'] },
  { category: 'Game Development', weight: 1.5, keywords: ['game development', 'unity', 'unreal engine', 'godot', 'game design', 'game art', 'game programmer', 'game dev', 'mobile game', 'pc game', 'multiplayer game', 'game mechanics', 'level design', 'game ui', 'roblox', 'minecraft mod', 'game testing', 'game assets'] },
  { category: 'Cybersecurity', weight: 2, keywords: ['cybersecurity', 'penetration testing', 'pentest', 'infosec', 'vulnerability assessment', 'ethical hacking', 'security audit', 'cyber security', 'bug bounty', 'network security', 'firewall', 'security engineer', 'ctf', 'malware analysis', 'reverse engineering', 'owasp', 'security testing', 'code review security'] },
  { category: 'QA / Testing', weight: 1.5, keywords: ['quality assurance', 'software testing', 'manual testing', 'automated testing', 'test cases', 'bug reporting', 'qa engineer', 'account testing', 'app testing', 'website testing', 'usability testing', 'regression testing', 'selenium testing', 'cypress', 'playwright testing', 'test automation', 'qa analyst', 'performance testing', 'load testing'] },
  { category: 'Virtual Assistant', weight: 1, keywords: ['virtual assistant', 'admin support', 'administrative assistant', 'personal assistant', 'executive assistant', 'calendar management', 'email management', 'customer support', 'customer service', 'live chat support', 'helpdesk', 'data entry', 'online research', 'lead generation', 'cold calling', 'appointment setting'] },
  { category: 'E-commerce', weight: 1, keywords: ['ecommerce', 'online store', 'magento', 'amazon seller', 'dropshipping', 'product listing', 'etsy', 'ebay', 'amazon fba', 'shopify store', 'product photography', 'product research', 'inventory management', 'marketplace', 'online marketplace', 'store setup', 'woocommerce store'] },
  { category: 'Project Management', weight: 1, keywords: ['project management', 'project manager', 'scrum', 'agile', 'jira', 'product manager', 'product management', 'product owner', 'sprint', 'roadmap', 'stakeholder', 'trello', 'asana', 'notion', 'monday.com', 'delivery manager', 'programme manager', 'pmo'] },
];

const detectCategory = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  const matchesKeyword = (t, keyword) => {
    if (keyword.length <= 3) return new RegExp(`\\b${keyword}\\b`, 'i').test(t);
    return t.includes(keyword);
  };

  const scores = CATEGORY_MAP.map(({ category, keywords, weight }) => {
    const matchCount = keywords.filter(kw => matchesKeyword(text, kw)).length;
    return { category, score: matchCount * weight };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

  if (scores.length === 0) return 'General';
  return scores[0].category;
};

const SKILL_KEYWORDS = [
  'python', 'javascript', 'typescript', 'node.js', 'react', 'vue', 'angular',
  'java', 'c++', 'c#', '.net', 'php', 'ruby', 'golang', 'rust', 'swift',
  'kotlin', 'dart', 'flask', 'django', 'spring', 'express', 'fastapi',
  'postgresql', 'mongodb', 'mysql', 'redis', 'aws', 'azure', 'gcp',
  'docker', 'kubernetes', 'git', 'linux', 'html', 'css', 'sass', 'tailwind',
  'bootstrap', 'webpack', 'vite', 'graphql', 'rest', 'api', 'microservices',
  'devops', 'ci/cd', 'machine learning', 'ai', 'deep learning', 'tensorflow',
  'pytorch', 'data science', 'analytics', 'sql', 'etl', 'android', 'ios',
  'react native', 'flutter', 'xamarin', 'blockchain', 'ethereum', 'solidity',
  'web3', 'figma', 'ui/ux', 'design', 'photoshop', 'illustrator',
  'content writing', 'copywriting', 'seo', 'social media', 'marketing',
  'project management', 'agile', 'scrum', 'jira', 'shopify', 'wordpress',
];

const extractSkills = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  const skills = [];
  for (const skill of SKILL_KEYWORDS) {
    if (text.includes(skill) && !skills.includes(skill)) skills.push(skill);
    if (skills.length >= 10) break;
  }
  return skills;
};

module.exports = {
  getSpamAnalysis,
  isSpamPost,
  isForHirePost,
  detectJobType,
  detectCategory,
  extractSkills,
};
