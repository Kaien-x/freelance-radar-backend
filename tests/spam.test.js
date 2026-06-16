'use strict';

const { isSpamPost, getSpamAnalysis } = require('../utils/jobFilter');

describe('isSpamPost()', () => {

  // ── Legitimate jobs — must NOT be flagged ──────────────────────────────────

  test('clean React dev job is not spam', () => {
    expect(isSpamPost(
      '[HIRING] React Developer – $50/hr remote contract',
      'We are looking for a skilled React developer with 3+ years of experience to build a SaaS dashboard. Must know TypeScript, Redux, and REST APIs. Fixed 3-month contract, fully remote.'
    )).toBe(false);
  });

  test('clean design job is not spam', () => {
    expect(isSpamPost(
      '[HIRING] UI/UX Designer for mobile app',
      'Small startup needs a UI/UX designer to create wireframes and high-fidelity mockups in Figma. Budget: $2000 fixed. Please share your portfolio.'
    )).toBe(false);
  });

  test('job with reasonable daily rate is not spam', () => {
    expect(isSpamPost(
      '[HIRING] Senior Python developer',
      'Looking for an experienced Python backend developer. Daily rate $200-$300. Remote OK. Skills: Django, PostgreSQL, Docker.'
    )).toBe(false);
  });

  // ── Spam by offsite contact ────────────────────────────────────────────────

  test('flags "dm me first"', () => {
    expect(isSpamPost('[HIRING] Easy job', 'dm me first for details on this amazing opportunity')).toBe(true);
  });

  test('flags "whatsapp me"', () => {
    expect(isSpamPost('[HIRING] Work', 'Whatsapp me to get started. We offer great pay!')).toBe(true);
  });

  test('flags "telegram only"', () => {
    expect(isSpamPost('[HIRING] Online work', 'Apply now! Telegram only. Contact us for job details.')).toBe(true);
  });

  test('flags "send a dm"', () => {
    expect(isSpamPost('[HIRING] Social media work', 'Interested? Send a dm for application details.')).toBe(true);
  });

  // ── Spam by MLM / pyramid signals ─────────────────────────────────────────

  test('flags "passive income opportunity"', () => {
    expect(isSpamPost('[HIRING] Team member needed', 'Join us for a passive income opportunity. Work from home, be your own boss.')).toBe(true);
  });

  test('flags "network marketing"', () => {
    expect(isSpamPost('[HIRING] Marketing rep', 'We are a network marketing company looking for driven individuals.')).toBe(true);
  });

  // ── Spam by unrealistic pay ───────────────────────────────────────────────

  test('flags "earn $500 daily"', () => {
    expect(isSpamPost('[HIRING] Online work', 'You can earn $500 daily working just 2 hours from home!')).toBe(true);
  });

  test('flags high daily pay via regex ($800/day)', () => {
    expect(isSpamPost('[HIRING] Easy job', 'Make $800/day working from home — no experience needed!')).toBe(true);
  });

  test('flags "$5000 per week easily"', () => {
    expect(isSpamPost('[HIRING] Freelancer', '$5000 per week easily, just follow our simple system!')).toBe(true);
  });

  // ── Spam by mass hiring ───────────────────────────────────────────────────

  test('flags "looking for 100 people"', () => {
    expect(isSpamPost('[HIRING] Agents needed', 'We are looking for 100 people to join our team this week.')).toBe(true);
  });

  test('flags hiring regex (hiring 25 workers)', () => {
    expect(isSpamPost('[HIRING] Staff', 'We are currently hiring 25 workers for our online project.')).toBe(true);
  });

  // ── Spam by no-skill claims ───────────────────────────────────────────────

  test('flags "get paid to like photos"', () => {
    expect(isSpamPost('[HIRING] Social media job', 'Get paid to like photos and follow accounts. No experience required!')).toBe(true);
  });

  test('flags "copy paste job earn"', () => {
    expect(isSpamPost('[HIRING] Online work', 'Copy paste job earn $300 daily. Simple task for everyone.')).toBe(true);
  });

  // ── getSpamAnalysis score & signals ───────────────────────────────────────

  test('returns score and signals for spam', () => {
    const result = getSpamAnalysis('[HIRING] Easy money', 'Whatsapp me to earn $500 daily working from home!');
    expect(result.isSpam).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(Array.isArray(result.signals)).toBe(true);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  test('returns low score for clean job', () => {
    const result = getSpamAnalysis(
      '[HIRING] Node.js developer',
      'Need an experienced Node.js developer for a 3-month API project. Budget $5000 fixed. Must have experience with Express and MongoDB.'
    );
    expect(result.isSpam).toBe(false);
    expect(result.score).toBeLessThan(50);
  });

  test('signals are strings', () => {
    const result = getSpamAnalysis('Test', 'dm me first for unlimited income opportunity');
    result.signals.forEach(s => expect(typeof s).toBe('string'));
  });
});
