const redis = require('redis');
const logger = require('../utils/logger');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
};

// Create Redis client for general use
const redisClient = redis.createClient(redisConfig);

// Create Redis client for pub/sub
const redisPubClient = redis.createClient(redisConfig);
const redisSubClient = redis.createClient(redisConfig);

// Error handling
redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisPubClient.on('error', (err) => {
  logger.error('Redis Pub Client Error:', err);
});

redisSubClient.on('error', (err) => {
  logger.error('Redis Sub Client Error:', err);
});

// Connection events
redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

redisPubClient.on('connect', () => {
  logger.info('Redis Pub Client Connected');
});

redisSubClient.on('connect', () => {
  logger.info('Redis Sub Client Connected');
});

module.exports = {
  redisClient,
  redisPubClient,
  redisSubClient
};