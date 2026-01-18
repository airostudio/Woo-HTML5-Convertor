// Vercel Serverless Function: GET /api/platforms
const { getSupportedPlatforms } = require('../src/connectors');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const platforms = getSupportedPlatforms();
        return res.status(200).json({
            success: true,
            platforms
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
