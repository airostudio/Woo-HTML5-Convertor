/**
 * Store Converter - REST API Server
 * Multi-platform e-commerce to HTML5 converter API
 *
 * Supports: WooCommerce, Shopify, Wix, Squarespace
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');

// Import connectors and builder
const {
    createConnector,
    getSupportedPlatforms,
    isPlatformSupported
} = require('../src/connectors');
const StoreBuilder = require('../src/builder');

const app = express();
const PORT = process.env.PORT || 3002;

// Store active conversions
const conversions = new Map();
const progressClients = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve embed script
app.get('/embed.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'embed.js'));
});

/**
 * Get supported platforms
 */
app.get('/api/platforms', (req, res) => {
    res.json({
        success: true,
        platforms: getSupportedPlatforms()
    });
});

/**
 * Test connection to any platform
 */
app.post('/api/test-connection', async (req, res) => {
    const { platform, ...credentials } = req.body;

    if (!platform) {
        return res.json({ success: false, error: 'Platform not specified' });
    }

    // Demo mode
    if (platform === 'demo') {
        return res.json({
            success: true,
            storeName: 'Demo Store',
            productCount: 8
        });
    }

    if (!isPlatformSupported(platform)) {
        return res.json({ success: false, error: `Platform '${platform}' not supported` });
    }

    try {
        const connector = createConnector(platform, credentials);
        if (!connector) {
            return res.json({ success: false, error: 'Failed to create connector' });
        }

        const result = await connector.testConnection();
        res.json(result);
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Start conversion
 */
app.post('/api/convert', async (req, res) => {
    const {
        platform,
        mode,
        siteName,
        primaryColor,
        currency,
        ...config
    } = req.body;

    const conversionId = uuidv4();
    const outputDir = path.join(__dirname, '..', 'output', conversionId);

    // Initialize conversion state
    conversions.set(conversionId, {
        id: conversionId,
        platform,
        mode: mode || 'live',
        config: {
            siteName: siteName || 'My Store',
            primaryColor: primaryColor || '#2563eb',
            currency: currency || 'USD',
            ...config
        },
        status: 'starting',
        progress: 0,
        currentTask: 'Initializing...',
        tasks: {
            export: 0,
            optimize: 0,
            generate: 0,
            pwa: 0
        },
        stats: {},
        outputDir,
        startTime: Date.now()
    });

    res.json({ conversionId });

    // Start conversion in background
    runConversion(conversionId);
});

/**
 * SSE endpoint for real-time progress
 */
app.get('/api/progress/:conversionId', (req, res) => {
    const { conversionId } = req.params;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    // Send initial state
    const conversion = conversions.get(conversionId);
    if (conversion) {
        res.write(`data: ${JSON.stringify(conversion)}\n\n`);
    }

    // Store client connection
    if (!progressClients.has(conversionId)) {
        progressClients.set(conversionId, []);
    }
    progressClients.get(conversionId).push(res);

    req.on('close', () => {
        const clients = progressClients.get(conversionId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) clients.splice(index, 1);
        }
    });
});

/**
 * Polling endpoint (fallback)
 */
app.get('/api/progress/:conversionId/status', (req, res) => {
    const { conversionId } = req.params;
    const conversion = conversions.get(conversionId);

    if (!conversion) {
        return res.status(404).json({ error: 'Conversion not found' });
    }

    res.json(conversion);
});

/**
 * Download converted site
 */
app.get('/api/download/:conversionId', async (req, res) => {
    const { conversionId } = req.params;
    const conversion = conversions.get(conversionId);

    if (!conversion) {
        return res.status(404).json({ error: 'Conversion not found' });
    }

    if (!await fs.pathExists(conversion.outputDir)) {
        return res.status(404).json({ error: 'Output not found' });
    }

    const filename = `${conversion.config.siteName || 'html5-store'}.zip`
        .replace(/[^a-z0-9.-]/gi, '-');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(conversion.outputDir, false);
    archive.finalize();
});

/**
 * Preview converted site
 */
app.use('/api/preview/:conversionId', (req, res, next) => {
    const { conversionId } = req.params;
    const conversion = conversions.get(conversionId);

    if (!conversion) {
        return res.status(404).send('Conversion not found');
    }

    express.static(conversion.outputDir)(req, res, next);
});

/**
 * Run the conversion process
 */
async function runConversion(conversionId) {
    const conversion = conversions.get(conversionId);
    if (!conversion) return;

    try {
        const { platform, mode, config, outputDir } = conversion;

        // Progress callback
        const progressCallback = (task, progress, message) => {
            updateProgress(conversionId, task, progress, message);
        };

        // Create builder config
        const builderConfig = {
            outputDir,
            siteName: config.siteName,
            siteDescription: config.siteDescription || '',
            primaryColor: config.primaryColor,
            currency: config.currency,
            currencySymbol: getCurrencySymbol(config.currency),
            enableSearch: config.enableSearch !== false,
            enableCart: config.enableCart !== false,
            enableWishlist: config.enableWishlist || false,
            enableReviews: config.enableReviews !== false,
            enablePWA: config.enablePWA !== false,
            optimizeImages: config.optimizeImages !== false,
            ...config
        };

        // Create builder
        const builder = new StoreBuilder(builderConfig);

        // Handle different platforms
        if (mode === 'demo' || platform === 'demo') {
            await runDemoConversion(conversionId, builder, progressCallback);
        } else {
            await runPlatformConversion(conversionId, platform, config, builder, progressCallback);
        }

        // Get final stats
        const stats = await getOutputStats(outputDir);

        // Mark complete
        conversion.status = 'complete';
        conversion.progress = 100;
        conversion.currentTask = 'Conversion complete!';
        conversion.stats = stats;

        sendProgressUpdate(conversionId, conversion);
        sendEvent(conversionId, 'complete', conversion);

    } catch (error) {
        console.error('Conversion error:', error);
        conversion.status = 'error';
        conversion.error = error.message;
        sendEvent(conversionId, 'error', { message: error.message });
    }
}

/**
 * Run demo conversion
 */
async function runDemoConversion(conversionId, builder, progressCallback) {
    progressCallback('export', 0, 'Starting demo conversion...');
    await sleep(200);

    let currentPhase = 'export';
    const wrappedProgress = (message) => {
        if (message.includes('Preparing') || message.includes('sample')) {
            currentPhase = 'export';
            progressCallback('export', 50, message);
        } else if (message.includes('Processing') || message.includes('Optimizing') || message.includes('Minifying')) {
            currentPhase = 'optimize';
            progressCallback('optimize', 50, message);
        } else if (message.includes('Generating') && message.includes('page')) {
            currentPhase = 'generate';
            progressCallback('generate', 50, message);
        } else if (message.includes('PWA')) {
            currentPhase = 'pwa';
            progressCallback('pwa', 50, message);
        } else if (message.includes('complete')) {
            progressCallback(currentPhase, 100, message);
        } else {
            progressCallback(currentPhase, 50, message);
        }
    };

    progressCallback('export', 100, 'Demo data ready');
    progressCallback('generate', 0, 'Generating pages...');

    await builder.build(wrappedProgress);

    progressCallback('generate', 100, 'HTML generation complete');
    progressCallback('optimize', 100, 'Asset optimization complete');
    progressCallback('pwa', 100, 'PWA generation complete');
}

/**
 * Run platform-specific conversion
 */
async function runPlatformConversion(conversionId, platform, config, builder, progressCallback) {
    progressCallback('export', 0, `Connecting to ${platform}...`);

    // Create platform connector
    const connector = createConnector(platform, config);
    if (!connector) {
        throw new Error(`Failed to create ${platform} connector`);
    }

    // Test connection
    const connectionTest = await connector.testConnection();
    if (!connectionTest.success) {
        throw new Error(connectionTest.error || 'Connection failed');
    }

    progressCallback('export', 10, `Connected to ${connectionTest.storeName}`);

    // Export data
    progressCallback('export', 20, 'Exporting categories...');
    const categories = await connector.exportCategories();
    progressCallback('export', 30, `Exported ${categories.length} categories`);

    progressCallback('export', 40, 'Exporting products...');
    const products = await connector.exportProducts((current, total) => {
        const progress = 40 + (current / total) * 40;
        progressCallback('export', progress, `Exporting product ${current}/${total}`);
    });
    progressCallback('export', 85, `Exported ${products.length} products`);

    progressCallback('export', 90, 'Downloading images...');
    await connector.exportImages(products, builder.config.outputDir, (current, total) => {
        const progress = 90 + (current / total) * 10;
        progressCallback('export', progress, `Downloading image ${current}/${total}`);
    });
    progressCallback('export', 100, 'Export complete');

    // Build HTML site
    let currentPhase = 'generate';
    const wrappedProgress = (message) => {
        if (message.includes('Processing') || message.includes('Optimizing') || message.includes('Minifying')) {
            currentPhase = 'optimize';
            progressCallback('optimize', 50, message);
        } else if (message.includes('Generating') && (message.includes('page') || message.includes('HTML'))) {
            progressCallback('generate', 50, message);
        } else if (message.includes('PWA')) {
            progressCallback('pwa', 50, message);
        } else if (message.includes('complete')) {
            progressCallback(currentPhase, 100, message);
        }
    };

    // Override builder data with exported data
    builder.exportedData = { products, categories };

    progressCallback('generate', 0, 'Generating HTML pages...');
    await builder.build(wrappedProgress);

    progressCallback('generate', 100, 'HTML generation complete');
    progressCallback('optimize', 100, 'Asset optimization complete');
    progressCallback('pwa', 100, 'PWA generation complete');
}

/**
 * Update progress
 */
function updateProgress(conversionId, task, progress, message) {
    const conversion = conversions.get(conversionId);
    if (!conversion) return;

    if (task && progress !== undefined) {
        conversion.tasks[task] = progress;
    }

    // Calculate overall progress
    const weights = { export: 0.3, optimize: 0.25, generate: 0.3, pwa: 0.15 };
    let overall = 0;
    for (const [t, w] of Object.entries(weights)) {
        overall += (conversion.tasks[t] || 0) * w;
    }
    conversion.progress = Math.round(overall);

    if (message) {
        conversion.currentTask = message;
        conversion.log = message;
    }

    conversion.status = 'running';
    sendProgressUpdate(conversionId, conversion);
}

/**
 * Send progress to SSE clients
 */
function sendProgressUpdate(conversionId, data) {
    const clients = progressClients.get(conversionId);
    if (!clients) return;

    const message = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (e) {}
    });
}

/**
 * Send named event
 */
function sendEvent(conversionId, eventName, data) {
    const clients = progressClients.get(conversionId);
    if (!clients) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (e) {}
    });
}

/**
 * Get output stats
 */
async function getOutputStats(outputDir) {
    const stats = { pages: 0, products: 0, images: 0, totalSize: 0 };

    if (!await fs.pathExists(outputDir)) return stats;

    const walk = async (dir) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const fp = path.join(dir, file);
            const stat = await fs.stat(fp);

            if (stat.isDirectory()) {
                await walk(fp);
            } else {
                stats.totalSize += stat.size;
                if (file.endsWith('.html')) {
                    stats.pages++;
                    if (fp.includes('/product/')) stats.products++;
                } else if (/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(file)) {
                    stats.images++;
                }
            }
        }
    };

    await walk(outputDir);
    return stats;
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency) {
    const symbols = {
        'USD': '$', 'EUR': '\u20AC', 'GBP': '\u00A3', 'JPY': '\u00A5',
        'AUD': 'A$', 'CAD': 'C$', 'CHF': 'CHF', 'CNY': '\u00A5',
        'INR': '\u20B9', 'BRL': 'R$'
    };
    return symbols[currency] || '$';
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Start server
app.listen(PORT, () => {
    console.log(`
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  Store Converter API Server                   \u2502
\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524
\u2502  Server:  http://localhost:${PORT}              \u2502
\u2502  Embed:   http://localhost:${PORT}/embed.js     \u2502
\u2502                                               \u2502
\u2502  Supported Platforms:                        \u2502
\u2502  - WooCommerce                               \u2502
\u2502  - Shopify                                   \u2502
\u2502  - Wix                                       \u2502
\u2502  - Squarespace                               \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    `);
});

module.exports = app;
