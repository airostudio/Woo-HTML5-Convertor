// Vercel Serverless Function: POST /api/convert
const { createConnector } = require('../src/connectors');
const { put } = require('@vercel/blob');
const { kv } = require('@vercel/kv');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { Readable } = require('stream');

// Import the converter (we'll create a lightweight version)
const LightweightConverter = require('../src/vercel-converter');

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const conversionId = uuidv4();

    try {
        const { platform, credentials, options = {} } = req.body;

        if (!platform || !credentials) {
            return res.status(400).json({
                success: false,
                error: 'Platform and credentials are required'
            });
        }

        // Initialize conversion state in KV
        await kv.set(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'starting',
            progress: 0,
            stage: 'Initializing',
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 }); // Expire after 1 hour

        // Create connector and fetch products
        const connector = createConnector(platform, credentials);

        // Update status
        await kv.set(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'fetching',
            progress: 10,
            stage: 'Fetching products',
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 });

        // Fetch products from the platform
        const products = await connector.exportProducts((progress) => {
            // Progress callback - we can't update in real-time in serverless
            // but the status endpoint will show the last known state
        });

        // Update status
        await kv.set(`conversion:${conversionId}`, {
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
        const htmlFiles = await converter.convert(products, (progress, stage) => {
            // Progress updates
        });

        // Update status
        await kv.set(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'packaging',
            progress: 80,
            stage: 'Creating download package',
            productCount: products.length,
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 3600 });

        // Create ZIP archive and upload to Vercel Blob
        const zipBuffer = await createZipBuffer(htmlFiles);

        const blob = await put(`conversions/${conversionId}.zip`, zipBuffer, {
            access: 'public',
            contentType: 'application/zip'
        });

        // Update final status
        await kv.set(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'completed',
            progress: 100,
            stage: 'Complete',
            productCount: products.length,
            downloadUrl: blob.url,
            completedAt: Date.now(),
            startedAt: Date.now(),
            platform,
            options
        }, { ex: 86400 }); // Keep for 24 hours

        return res.status(200).json({
            success: true,
            conversionId,
            status: 'completed',
            downloadUrl: blob.url,
            productCount: products.length
        });

    } catch (error) {
        // Update error status
        await kv.set(`conversion:${conversionId}`, {
            id: conversionId,
            status: 'error',
            error: error.message,
            failedAt: Date.now()
        }, { ex: 3600 });

        return res.status(500).json({
            success: false,
            conversionId,
            error: error.message
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
