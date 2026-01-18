// Vercel Serverless Function: GET /api/download/[id]
// Downloads the converted ZIP file

// Shared memory storage reference
let memoryStorage = null;

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Download ID is required'
            });
        }

        // Try to get from memory storage first (local dev)
        try {
            const convertModule = require('../convert');
            memoryStorage = convertModule.memoryStorage;
        } catch (e) {
            // Module not available
        }

        if (memoryStorage && memoryStorage.blobs.has(id)) {
            const buffer = memoryStorage.blobs.get(id);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="store-${id}.zip"`);
            res.setHeader('Content-Length', buffer.length);
            return res.send(buffer);
        }

        // Try Vercel KV to get the download URL
        try {
            const { kv } = require('@vercel/kv');
            const conversion = await kv.get(`conversion:${id}`);

            if (conversion && conversion.downloadUrl) {
                // Redirect to the Blob URL
                return res.redirect(302, conversion.downloadUrl);
            }
        } catch (e) {
            // KV not available
        }

        return res.status(404).json({
            success: false,
            error: 'Download not found. It may have expired.'
        });

    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to download file'
        });
    }
};
