'use strict';

/**
 * Pure job-matching utilities.
 * No DB or network dependencies — safe to import in tests.
 */

// ─── Skill synonym map ─────────────────────────────────────────────────────────

const SKILL_SYNONYMS = {
  javascript: ['js', 'es6', 'ecmascript', 'es2015', 'es2016', 'es2017'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js'],
  'react native': ['reactnative', 'rn'],
  vue: ['vuejs', 'vue.js', 'vue3', 'vue2', 'nuxt', 'nuxtjs', 'nuxt.js'],
  angular: ['angularjs', 'angular2'],
  'next.js': ['nextjs', 'next js'],
  svelte: ['sveltekit'],
  'node.js': ['nodejs', 'node js', 'node'],
  express: ['expressjs', 'express.js'],
  python: ['py'],
  ruby: ['ruby on rails', 'rails'],
  golang: ['go', 'go lang', 'go language'],
  'spring boot': ['spring', 'spring framework', 'java spring'],
  postgresql: ['postgres', 'psql', 'pg'],
  mongodb: ['mongo'],
  mysql: ['mariadb'],
  aws: ['amazon web services', 'amazon aws'],
  azure: ['microsoft azure'],
  gcp: ['google cloud', 'google cloud platform'],
  docker: ['containerization', 'containers'],
  kubernetes: ['k8s', 'k8'],
  devops: ['ci/cd', 'continuous integration', 'continuous delivery'],
  flutter: ['dart flutter'],
  swift: ['ios swift'],
  kotlin: ['android kotlin'],
  'machine learning': ['ml', 'deep learning', 'tensorflow', 'pytorch'],
  'data science': ['data analysis', 'data analytics', 'business analytics'],
  nlp: ['natural language processing'],
  'ui/ux': ['ux design', 'ui design', 'user experience', 'user interface', 'figma', 'sketch'],
  tailwind: ['tailwindcss', 'tailwind css'],
  bootstrap: ['bootstrap css', 'bootstrap framework'],
  'content writing': ['copywriting', 'blog writing', 'article writing', 'ghostwriting'],
  seo: ['search engine optimization', 'sem', 'search marketing'],
  blockchain: ['web3', 'decentralized', 'web 3'],
  solidity: ['ethereum', 'smart contracts', 'smart contract'],
  wordpress: ['wp', 'woocommerce', 'elementor'],
  shopify: ['shopify store', 'shopify theme'],
  graphql: ['graph ql'],
  elasticsearch: ['elastic', 'elk'],
  redis: ['redis cache'],
};

const buildSynonymMap = () => {
  const map = new Map();
  for (const [canonical, variants] of Object.entries(SKILL_SYNONYMS)) {
    map.set(canonical, canonical);
    for (const variant of variants) {
      if (!map.has(variant)) map.set(variant, canonical);
    }
  }
  return map;
};

const SYNONYM_MAP = buildSynonymMap();

const normalizeSkill = (skill) => {
  const lower = (skill || '').toLowerCase().trim();
  return SYNONYM_MAP.get(lower) || lower;
};

// ─── Experience ordering ───────────────────────────────────────────────────────

const EXP_ORDER = { entry: 1, intermediate: 2, expert: 3 };

// ─── Core scoring ──────────────────────────────────────────────────────────────

/**
 * Score a single job for a single user across six factors.
 * Returns a 0-100 score with a per-factor breakdown.
 *
 * Factor weights:
 *   skills          40
 *   bioRelevance    15
 *   experienceLevel 15
 *   budgetFit       15
 *   recency         10
 *   sourceQuality    5
 *   ─────────────── ───
 *   total          100
 */
const scoreJobForUser = (user, job) => {
  const breakdown = {};

  // ── 1. Skill match (40 pts) ──────────────────────────────────────────────────
  const userSkills = (user.skills || [])
    .map(s => normalizeSkill(typeof s === 'string' ? s : s.skill))
    .filter(Boolean);

  const rawJobSkills = [...(job.skills || []), ...(job.tags || [])];
  const jobSkills = [...new Set(rawJobSkills.map(s => normalizeSkill(s)).filter(Boolean))];

  let skillScore = 0;
  const matchedSkills = [];

  if (jobSkills.length === 0 && userSkills.length > 0) {
    skillScore = 20; // No specific requirements — give partial credit
  } else if (jobSkills.length > 0 && userSkills.length > 0) {
    for (const jSkill of jobSkills) {
      const matched = userSkills.some(uSkill =>
        uSkill === jSkill ||
        uSkill.includes(jSkill) ||
        jSkill.includes(uSkill)
      );
      if (matched) matchedSkills.push(jSkill);
    }
    skillScore = Math.round((matchedSkills.length / jobSkills.length) * 40);
  }
  breakdown.skills = skillScore;

  // ── 2. Bio / title relevance (15 pts) ────────────────────────────────────────
  const userText = `${user.title || ''} ${user.bio || ''}`.toLowerCase();
  const jobText = `${job.title || ''} ${(job.description || '').substring(0, 600)}`.toLowerCase();

  let bioScore = 0;
  if (userText.length > 5 && jobText.length > 5) {
    // Generic words that appear in almost every job ad — exclude to avoid false relevance
    const stopWords = new Set([
      'that', 'this', 'with', 'have', 'from', 'they', 'been', 'will', 'your',
      'more', 'about', 'when', 'make', 'like', 'time', 'just', 'know', 'take',
      'into', 'year', 'need', 'also', 'work', 'hire', 'looking', 'using', 'build',
      'built', 'developer', 'developers', 'development', 'great', 'good', 'best',
      'help', 'high', 'level', 'able', 'skill', 'skills', 'experience', 'experienced',
      'seeking', 'wanted', 'required', 'projects', 'project', 'please', 'apply',
      'contact', 'team', 'company', 'client', 'clients', 'small', 'large', 'start',
      'must', 'should', 'would', 'could', 'tasks', 'task', 'jobs', 'position',
      'role', 'works', 'working', 'smart', 'simple', 'fast', 'quick', 'senior',
      'junior', 'lead', 'strong', 'solid', 'basic', 'full', 'stack', 'based',
    ]);
    const userWords = new Set(
      userText.split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w))
    );
    const jobWords = jobText.split(/\W+/).filter(w => w.length > 3 && !stopWords.has(w));
    const matches = jobWords.filter(w => userWords.has(w)).length;
    bioScore = Math.min(15, Math.round((matches / Math.max(jobWords.length, 1)) * 200));
  }
  breakdown.bioRelevance = bioScore;

  // ── 3. Experience level (15 pts) ─────────────────────────────────────────────
  let expScore = 8; // neutral default when no requirement
  if (job.experienceLevel) {
    const jobExpNum = EXP_ORDER[job.experienceLevel] || 2;
    const skillLevels = (user.skills || [])
      .map(s => EXP_ORDER[(typeof s === 'object' ? s.level : null)] || 2);
    const avgLevel = skillLevels.length > 0
      ? skillLevels.reduce((a, b) => a + b, 0) / skillLevels.length
      : 2;
    const diff = Math.abs(avgLevel - jobExpNum);
    expScore = diff === 0 ? 15 : diff <= 1 ? 9 : 3;
  }
  breakdown.experienceLevel = expScore;

  // ── 4. Budget fit (15 pts) ───────────────────────────────────────────────────
  let budgetScore = 7; // neutral when insufficient data
  const userMinRate = user.hourlyRate?.min || 0;
  const userMaxRate = user.hourlyRate?.max || 0;
  const jobBudgetMin = job.budget?.min || 0;
  const jobBudgetMax = job.budget?.max || 0;

  if (userMinRate > 0 && jobBudgetMin > 0) {
    if (job.budget?.type === 'hourly') {
      const overlaps = userMinRate <= jobBudgetMax && (userMaxRate === 0 || userMaxRate >= jobBudgetMin);
      budgetScore = overlaps ? 15 : 3;
    } else if (job.budget?.type === 'fixed') {
      const worthwhile = jobBudgetMax >= userMinRate * 5;
      budgetScore = worthwhile ? 12 : 4;
    }
  }
  breakdown.budgetFit = budgetScore;

  // ── 5. Recency (10 pts) ──────────────────────────────────────────────────────
  const ageHours = (Date.now() - new Date(job.createdAt).getTime()) / 3_600_000;
  let recencyScore;
  if (ageHours <= 6)        recencyScore = 10;
  else if (ageHours <= 24)  recencyScore = 8;
  else if (ageHours <= 48)  recencyScore = 5;
  else if (ageHours <= 96)  recencyScore = 3;
  else                      recencyScore = 1;
  breakdown.recency = recencyScore;

  // ── 6. Source quality (5 pts) ────────────────────────────────────────────────
  let sourceScore;
  if (job.source === 'platform') sourceScore = 5;
  else if ((job.upvotes || 0) > 10) sourceScore = 4;
  else if ((job.upvotes || 0) > 5)  sourceScore = 3;
  else                               sourceScore = 2;
  breakdown.sourceQuality = sourceScore;

  const total = skillScore + bioScore + expScore + budgetScore + recencyScore + sourceScore;

  return {
    score: Math.min(100, Math.round(total)),
    matchedSkills: [...new Set(matchedSkills)],
    breakdown,
  };
};

/**
 * Score and sort an array of jobs for a user.
 * Handles both Mongoose documents and plain objects.
 */
const matchJobsToUser = (user, jobs) => {
  return jobs
    .map(job => {
      const jobObj = typeof job.toObject === 'function' ? job.toObject() : { ...job };
      const { score, matchedSkills, breakdown } = scoreJobForUser(user, jobObj);
      return { ...jobObj, matchScore: score, matchedSkills, matchBreakdown: breakdown };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
};

module.exports = { normalizeSkill, scoreJobForUser, matchJobsToUser };
