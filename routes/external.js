const express = require('express');
const axios = require('axios');
const router = express.Router();

// GET /api/external/cat-fact - Fetch a random cat fact from catfact.ninja
router.get('/cat-fact', async (req, res) => {
    try {
        const response = await axios.get('https://catfact.ninja/fact');

        res.json({
            success: true,
            source: 'https://catfact.ninja',
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching cat fact:', error.message);

        const status = error.response?.status || 500;
        const message = error.response?.data?.message || 'Failed to fetch cat fact';

        res.status(status).json({
            success: false,
            message,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/external/crypto-price - Fetch current Bitcoin price from Coindesk
router.get('/crypto-price', async (req, res) => {
    try {
        const response = await axios.get('https://api.coindesk.com/v1/bpi/currentprice.json');

        res.json({
            success: true,
            source: 'https://api.coindesk.com',
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching crypto price:', error.message);

        const status = error.response?.status || 500;
        const message = error.response?.data?.message || 'Failed to fetch crypto price';

        res.status(status).json({
            success: false,
            message,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
