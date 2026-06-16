'use strict';

const redis  = require('./redis');
const logger = require('./logger');

/**
 * Token-bucket rate limiter backed by Redis.
 * Falls back to always-allow when Redis is unavailable.
 *
 * @param {string} key       - Unique limiter key (e.g. 'redditSync')
 * @param {number} maxTokens - Max operations per interval
 * @param {number} intervalMs
 * @returns {Promise<boolean>}
 */
const acquireToken = async (key, maxTokens = 30, intervalMs = 60000) => {
  try {
    const tokenKey = `rate:${key}`;
    const multi = redis.multi();
    multi.incr(tokenKey);
    multi.pexpire(tokenKey, intervalMs);
    const [count] = await multi.exec();

    if (count > maxTokens) {
      logger.warn(`Rate limit exceeded for ${key}: ${count}/${maxTokens}`);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('Rate limiter error:', err.message);
    return true; // fail-open
  }
};

module.exports = { acquireToken };
