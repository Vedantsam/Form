const Queue = require('bull');
const getRedisClient = require('../config/redis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const emailQueue = new Queue('emailQueue', redisUrl);

emailQueue.process(async (job) => {
    const { email, fullName } = job.data;

    // Simulate async email sending (replace with real provider)
    console.log(`📧 Sending welcome email to ${fullName} <${email}>`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(`✅ Welcome email sent to ${email}`);
});

emailQueue.on('failed', (job, err) => {
    console.error(`❌ Email job ${job.id} failed:`, err.message);
});

module.exports = emailQueue;
