// Vercel Serverless Function: POST /api/convert
const { createConnector } = require('../src/connectors');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');

// Import the converter
const LightweightConverter = require('../src/vercel-converter');

// In-memory storage fallback for local development
const memoryStorage = {
    conversions: new Map(),
    blobs: new Map()
};

// Helper to get KV (with fallback)
async function kvSet(key, value, options = {}) {
    try {
        // Try Vercel KV first
        const { kv } = require('@vercel/kv');
        await kv.set(key, value, options);
    } catch (e) {
        // Fallback to memory
        memoryStorage.conversions.set(key, value);
    }
}

// Helper to store blob (with fallback)
async function storeBlob(path, buffer) {
    try {
        // Try Vercel Blob first
        const { put } = require('@vercel/blob');
        const blob = await put(path, buffer, {
            access: 'public',
            contentType: 'application/zip'
        });
        return blob.url;
    } catch (e) {
        // Fallback: return base64 data URL for local testing
        const base64 = buffer.toString('base64');
        const id = path.split('/').pop().replace('.zip', '');
        memoryStorage.blobs.set(id, buffer);
        return `/api/download/${id}`;
    }
}

module.exports = async function handler(req, res) {
    // Set CORS and JSON headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const conversionId = uuidv4();

    try {
        const { platform, credentials, options = {} } = req.body || {};

        if (!platform || !credentials) {
            return res.status(400).json({
                success: false,
                error: 'Platform and credentials are required'
            });
        }

        // Validate credentials based on platform
        if (platform === 'woocommerce') {
            if (!credentials.siteUrl || !credentials.consumerKey || !credentials.consumerSecret) {
                return res.status(400).json({
                    success: false,
                    error: 'WooCommerce requires siteUrl, consumerKey, and consumerSecret'
                });
            }
        }

        // Initialize conversion state
        await kvSet(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'starting',
            progress: 0,
            stage: 'Initializing',
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 });

        // Create connector and fetch products
        let connector;
        try {
            connector = createConnector(platform, credentials);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: `Failed to create connector: ${e.message}`
            });
        }

        // Update status
        await kvSet(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'fetching',
            progress: 10,
            stage: 'Fetching products from store',
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 });

        // Fetch products from the platform
        let products;
        try {
            products = await connector.exportProducts(() => {});
        } catch (e) {
            return res.status(400).json({
                success: false,
                conversionId,
                error: `Failed to fetch products: ${e.message}. Please check your credentials and store URL.`
            });
        }

        if (!products || products.length === 0) {
            return res.status(400).json({
                success: false,
                conversionId,
                error: 'No products found in your store. Please add some products first.'
            });
        }

        // Update status
        await kvSet(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'converting',
            progress: 40,
            stage: 'Generating HTML',
            productCount: products.length,
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 });

        // Generate the static site
        const converter = new LightweightConverter(options);
        const htmlFiles = await converter.convert(products, () => {});

        // Update status
        await kvSet(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'packaging',
            progress: 80,
            stage: 'Creating download package',
            productCount: products.length,
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 });

        // Create ZIP archive
        const zipBuffer = await createZipBuffer(htmlFiles);

        // Store the ZIP
        const downloadUrl = await storeBlob(`conversions/${conversionId}.zip`, zipBuffer);

        // Update final status
        await kvSet(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'completed',
            progress: 100,
            stage: 'Complete',
            productCount: products.length,
            downloadUrl,
            completedAt: Date.now(),
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 86400 });

        return res.status(200).json({
            success: true,
            conversionId,
            status: 'completed',
            downloadUrl,
            productCount: products.length
        });

    } catch (error) {
        console.error('Conversion error:', error);

        // Update error status
        await kvSet(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'error',
            error: error.message,
            failedAt: Date.now()
        }, { ex: 3600 });

        return res.status(500).json({
            success: false,
            conversionId,
            error: error.message || 'An unexpected error occurred'
        });
    }
};

async function createZipBuffer(files) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('data', chunk => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        // Add files to archive
        for (const [filename, content] of Object.entries(files)) {
            archive.append(content, { name: filename });
        }

        archive.finalize();
    });
}

// Export memory storage for download endpoint
module.exports.memoryStorage = memoryStorage;
