// Vercel Serverless Function: GET /api/status/[id]
const { kv } = require('@vercel/kv');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Conversion ID is required'
            });
        }

        const conversion = await kv.get(`conversion:${id}`);

        if (!conversion) {
            return res.status(404).json({
                success: false,
                error: 'Conversion not found'
            });
        }

        return res.status(200).json({
            success: true,
            ...conversion
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
