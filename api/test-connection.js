// Vercel Serverless Function: POST /api/test-connection
const { createConnector } = require('../src/connectors');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { platform, credentials } = req.body;

        if (!platform || !credentials) {
            return res.status(400).json({
                success: false,
                error: 'Platform and credentials are required'
            });
        }

        const connector = createConnector(platform, credentials);
        const result = await connector.testConnection();

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
};
