'use strict';

const { scoreJobForUser, matchJobsToUser, normalizeSkill } = require('../utils/jobMatcher');

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const baseUser = {
  skills:    [{ skill: 'React', level: 'expert' }, { skill: 'Node.js', level: 'intermediate' }, { skill: 'PostgreSQL', level: 'intermediate' }],
  title:     'Full-stack JavaScript developer',
  bio:       'I build scalable web applications using React and Node.js',
  hourlyRate: { min: 50, max: 100 },
};

const recentDate  = new Date(Date.now() - 2 * 3_600_000);   // 2 hours ago
const oldDate     = new Date(Date.now() - 5 * 24 * 3_600_000); // 5 days ago

const perfectJob = {
  _id:             'job1',
  title:           'Senior React + Node.js Developer',
  description:     'We need a full-stack JavaScript developer with React, Node.js and PostgreSQL skills.',
  skills:          ['react', 'node.js', 'postgresql'],
  tags:            ['javascript', 'typescript'],
  experienceLevel: 'expert',
  budget:          { type: 'hourly', min: 60, max: 120 },
  source:          'platform',
  createdAt:       recentDate,
  upvotes:         0,
};

const noMatchJob = {
  _id:             'job2',
  title:           'Solidity Blockchain Developer',
  description:     'Build smart contracts using Solidity on Ethereum.',
  skills:          ['solidity', 'ethereum', 'web3'],
  tags:            ['blockchain', 'nft'],
  experienceLevel: 'expert',
  budget:          { type: 'fixed', min: 5000, max: 20000 },
  source:          'reddit',
  createdAt:       recentDate,
  upvotes:         0,
};

const oldJob = {
  _id:             'job3',
  title:           'React developer needed',
  description:     'React developer for a short project.',
  skills:          ['react'],
  tags:            [],
  experienceLevel: 'intermediate',
  budget:          { type: 'hourly', min: 40, max: 80 },
  source:          'platform',
  createdAt:       oldDate,
  upvotes:         0,
};

// ─── normalizeSkill ────────────────────────────────────────────────────────────

describe('normalizeSkill()', () => {
  test('maps "ml" to "machine learning"', () => {
    expect(normalizeSkill('ml')).toBe('machine learning');
  });

  test('maps "nodejs" to "node.js"', () => {
    expect(normalizeSkill('nodejs')).toBe('node.js');
  });

  test('maps "postgres" to "postgresql"', () => {
    expect(normalizeSkill('postgres')).toBe('postgresql');
  });

  test('passes through unknown skill unchanged', () => {
    expect(normalizeSkill('cobol')).toBe('cobol');
  });

  test('is case-insensitive', () => {
    expect(normalizeSkill('TypeScript')).toBe('typescript');
  });
});

// ─── scoreJobForUser ───────────────────────────────────────────────────────────

describe('scoreJobForUser()', () => {
  test('perfect match scores high (>= 70)', () => {
    const { score } = scoreJobForUser(baseUser, perfectJob);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  test('no-match job scores low (< 35)', () => {
    const { score } = scoreJobForUser(baseUser, noMatchJob);
    expect(score).toBeLessThan(35);
  });

  test('old job scores lower than recent identical job', () => {
    const recentScore = scoreJobForUser(baseUser, perfectJob).score;
    const oldScore    = scoreJobForUser(baseUser, { ...perfectJob, createdAt: oldDate }).score;
    expect(recentScore).toBeGreaterThan(oldScore);
  });

  test('matched skills are returned', () => {
    const { matchedSkills } = scoreJobForUser(baseUser, perfectJob);
    expect(matchedSkills.length).toBeGreaterThan(0);
  });

  test('breakdown contains all six factors', () => {
    const { breakdown } = scoreJobForUser(baseUser, perfectJob);
    expect(breakdown).toHaveProperty('skills');
    expect(breakdown).toHaveProperty('bioRelevance');
    expect(breakdown).toHaveProperty('experienceLevel');
    expect(breakdown).toHaveProperty('budgetFit');
    expect(breakdown).toHaveProperty('recency');
    expect(breakdown).toHaveProperty('sourceQuality');
  });

  test('score is capped at 100', () => {
    const { score } = scoreJobForUser(baseUser, perfectJob);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('score is non-negative', () => {
    const { score } = scoreJobForUser(baseUser, noMatchJob);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('user with no skills gets skill score 0', () => {
    const userNoSkills = { ...baseUser, skills: [] };
    const { breakdown } = scoreJobForUser(userNoSkills, perfectJob);
    expect(breakdown.skills).toBe(0);
  });

  test('job with no skills listed gives neutral skill score (20)', () => {
    const jobNoSkills = { ...perfectJob, skills: [], tags: [] };
    const { breakdown } = scoreJobForUser(baseUser, jobNoSkills);
    expect(breakdown.skills).toBe(20);
  });

  test('platform source scores higher than low-upvote reddit', () => {
    const platformScore = scoreJobForUser(baseUser, { ...perfectJob, source: 'platform' }).breakdown.sourceQuality;
    const redditScore   = scoreJobForUser(baseUser, { ...perfectJob, source: 'reddit', upvotes: 0 }).breakdown.sourceQuality;
    expect(platformScore).toBeGreaterThan(redditScore);
  });

  test('overlapping hourly budget gives full budget score (15)', () => {
    const { breakdown } = scoreJobForUser(baseUser, perfectJob); // user $50-100, job $60-120 => overlap
    expect(breakdown.budgetFit).toBe(15);
  });

  test('non-overlapping hourly budget gives low score (3)', () => {
    const cheapJob = { ...perfectJob, budget: { type: 'hourly', min: 10, max: 20 } };
    const { breakdown } = scoreJobForUser(baseUser, cheapJob);
    expect(breakdown.budgetFit).toBe(3);
  });
});

// ─── matchJobsToUser ───────────────────────────────────────────────────────────

describe('matchJobsToUser()', () => {
  test('returns array sorted by matchScore descending', () => {
    const results = matchJobsToUser(baseUser, [noMatchJob, perfectJob, oldJob]);
    expect(results[0].matchScore).toBeGreaterThanOrEqual(results[1].matchScore);
    expect(results[1].matchScore).toBeGreaterThanOrEqual(results[2].matchScore);
  });

  test('best matching job is first', () => {
    const results = matchJobsToUser(baseUser, [noMatchJob, perfectJob]);
    expect(results[0]._id).toBe(perfectJob._id);
  });

  test('matchScore is attached to each result', () => {
    const results = matchJobsToUser(baseUser, [perfectJob]);
    expect(typeof results[0].matchScore).toBe('number');
  });

  test('matchedSkills is attached to each result', () => {
    const results = matchJobsToUser(baseUser, [perfectJob]);
    expect(Array.isArray(results[0].matchedSkills)).toBe(true);
  });

  test('matchBreakdown is attached to each result', () => {
    const results = matchJobsToUser(baseUser, [perfectJob]);
    expect(results[0].matchBreakdown).toBeDefined();
  });

  test('handles empty jobs array', () => {
    expect(matchJobsToUser(baseUser, [])).toEqual([]);
  });

  test('handles mongoose documents with toObject()', () => {
    const mockDoc = { ...perfectJob, toObject: () => ({ ...perfectJob }) };
    const results = matchJobsToUser(baseUser, [mockDoc]);
    expect(results[0].matchScore).toBeGreaterThan(0);
  });

  test('synonym skill matching: user has "react", job lists "reactjs"', () => {
    const user    = { ...baseUser, skills: [{ skill: 'react', level: 'expert' }] };
    const job     = { ...perfectJob, skills: ['reactjs'], tags: [] };
    const results = matchJobsToUser(user, [job]);
    expect(results[0].matchedSkills).toContain('react');
  });
});
