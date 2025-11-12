const IORedis = require('ioredis');

let redisClient;

const getRedisClient = () => {
    if (!redisClient) {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
        redisClient = new IORedis(redisUrl, {
            lazyConnect: false,
            maxRetriesPerRequest: 2
        });

        redisClient.on('connect', () => {
            console.log('✅ Redis connected');
        });

        redisClient.on('error', (error) => {
            console.error('❌ Redis connection error:', error.message);
        });
    }

    return redisClient;
};

module.exports = getRedisClient;
