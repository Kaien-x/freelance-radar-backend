'use strict';

const logger = require('./logger');

// No-op mock used when Redis is unavailable
const noopRedis = {
  connect:  async () => {},
  quit:     async () => {},
  on:       () => {},
  get:      async () => null,
  set:      async () => {},
  setEx:    async () => {},
  del:      async () => {},
  multi:    () => ({ incr: () => {}, pexpire: () => {}, exec: async () => [0] }),
};

// redis package is optional — fall back to no-op mock when not installed
let createClient;
try {
  createClient = require('redis').createClient;
} catch {
  createClient = null;
}

let redis;

if (!createClient) {
  // Package not installed at all
  logger.warn('redis package not installed — using in-memory no-op mock');
  redis = noopRedis;
} else {
  // Package installed — attempt one connection, no retries
  redis = createClient({
    socket: {
      host:              process.env.REDIS_HOST || 'localhost',
      port:              parseInt(process.env.REDIS_PORT || '6379', 10),
      connectTimeout:    3000,
      reconnectStrategy: false,   // do NOT keep retrying — Redis is optional
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });

  // Suppress the error event so Node doesn't crash; we handle it in connect()
  redis.on('error', () => {});

  (async () => {
    try {
      await redis.connect();
      logger.info('Redis connected — caching enabled');
    } catch {
      // Redis unavailable — swap every method to the no-op so callers degrade
      // gracefully without a single code change elsewhere in the app.
      logger.warn('Redis unavailable — running without cache (no impact on functionality)');
      Object.assign(redis, noopRedis);
    }
  })();
}

module.exports = redis;
