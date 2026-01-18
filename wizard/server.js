/**
 * Wizard Server - WooCommerce to HTML5 Converter
 * Express server for the conversion wizard UI
 */

const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');

// Import converter modules
const StoreBuilder = require('../src/builder');
const WooCommerceConnector = require('../src/importers/woocommerce-connector');

const app = express();
const PORT = process.env.PORT || 3001;

// Store active conversions and their progress
const conversions = new Map();
const progressClients = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the wizard UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Test WooCommerce connection
 */
app.post('/api/test-connection', async (req, res) => {
    const { siteUrl, consumerKey, consumerSecret } = req.body;

    if (!siteUrl || !consumerKey || !consumerSecret) {
        return res.json({
            success: false,
            error: 'Missing required fields'
        });
    }

    try {
        const connector = new WooCommerceConnector({
            siteUrl,
            consumerKey,
            consumerSecret
        });

        const result = await connector.testConnection();

        res.json({
            success: result.success,
            productCount: result.productCount || 0,
            error: result.error
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Start a new conversion
 */
app.post('/api/convert', async (req, res) => {
    const config = req.body;
    const conversionId = uuidv4();
    const outputDir = path.join(__dirname, '..', 'output', conversionId);

    // Initialize conversion state
    conversions.set(conversionId, {
        id: conversionId,
        config,
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
    runConversion(conversionId, config, outputDir);
});

/**
 * Server-Sent Events for real-time progress
 */
app.get('/api/progress/:conversionId', (req, res) => {
    const { conversionId } = req.params;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
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

    // Handle client disconnect
    req.on('close', () => {
        const clients = progressClients.get(conversionId);
        if (clients) {
            const index = clients.indexOf(res);
            if (index > -1) {
                clients.splice(index, 1);
            }
        }
    });
});

/**
 * Polling endpoint for progress (fallback)
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
 * Download converted site as ZIP
 */
app.get('/api/download/:conversionId', async (req, res) => {
    const { conversionId } = req.params;
    const conversion = conversions.get(conversionId);

    if (!conversion) {
        return res.status(404).json({ error: 'Conversion not found' });
    }

    const outputDir = conversion.outputDir;

    if (!await fs.pathExists(outputDir)) {
        return res.status(404).json({ error: 'Output directory not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${conversion.config.siteName || 'html5-store'}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(outputDir, false);
    archive.finalize();
});

/**
 * Preview converted site
 */
app.use('/preview/:conversionId', (req, res, next) => {
    const { conversionId } = req.params;
    const conversion = conversions.get(conversionId);

    if (!conversion) {
        return res.status(404).send('Conversion not found');
    }

    express.static(conversion.outputDir)(req, res, next);
});

/**
 * Preview default output (for demo mode)
 */
app.use('/preview', express.static(path.join(__dirname, '..', 'output')));

/**
 * Run the conversion process
 */
async function runConversion(conversionId, config, outputDir) {
    const conversion = conversions.get(conversionId);

    try {
        // Prepare builder config
        const builderConfig = {
            siteName: config.siteName || 'My Store',
            siteDescription: config.siteDescription || '',
            siteUrl: config.siteUrl || '',
            outputDir,
            primaryColor: config.primaryColor || '#2563eb',
            currency: config.currency || 'USD',
            currencySymbol: getCurrencySymbol(config.currency),
            productsPerPage: 12,
            enableSearch: config.enableSearch !== false,
            enableCart: config.enableCart !== false,
            enableWishlist: config.enableWishlist || false,
            enableReviews: config.enableReviews !== false,
            enablePWA: config.enablePWA !== false,
            optimizeImages: config.optimizeImages !== false,
            generateWebp: config.generateWebp !== false,
            theme: 'default',
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret
        };

        // Create progress callback
        const progressCallback = (task, progress, message) => {
            updateProgress(conversionId, task, progress, message);
        };

        // Create builder with progress tracking
        const builder = new StoreBuilder(builderConfig);

        // Check if demo mode
        if (config.mode === 'demo') {
            await runDemoConversion(conversionId, builder, progressCallback);
        } else {
            await runLiveConversion(conversionId, builder, progressCallback);
        }

        // Get final stats
        const stats = await getOutputStats(outputDir);

        // Mark as complete
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
    // Use builder's build method with custom progress tracking
    progressCallback('export', 0, 'Starting demo conversion...');
    await sleep(200);

    // Create a wrapped progress callback that maps to our task structure
    let currentPhase = 'export';
    const wrappedProgress = (message) => {
        // Detect phase changes from message content
        if (message.includes('Preparing') || message.includes('sample data')) {
            currentPhase = 'export';
            progressCallback('export', 50, message);
        } else if (message.includes('Processing assets') || message.includes('Optimizing') || message.includes('Minifying')) {
            currentPhase = 'optimize';
            progressCallback('optimize', 50, message);
        } else if (message.includes('Generating') && message.includes('page')) {
            currentPhase = 'generate';
            progressCallback('generate', 50, message);
        } else if (message.includes('PWA')) {
            currentPhase = 'pwa';
            progressCallback('pwa', 50, message);
        } else if (message.includes('sitemap') || message.includes('robots')) {
            progressCallback('generate', 90, message);
        } else if (message.includes('complete')) {
            progressCallback(currentPhase, 100, message);
        } else {
            progressCallback(currentPhase, 50, message);
        }
    };

    progressCallback('export', 100, 'Demo data ready');
    progressCallback('generate', 0, 'Generating pages...');

    // Run the build
    await builder.build(wrappedProgress);

    progressCallback('generate', 100, 'HTML generation complete');
    progressCallback('optimize', 100, 'Asset optimization complete');
    progressCallback('pwa', 100, 'PWA generation complete');
}

/**
 * Run live WooCommerce conversion
 */
async function runLiveConversion(conversionId, builder, progressCallback) {
    // Use builder's build method with progress tracking
    progressCallback('export', 0, 'Starting WooCommerce conversion...');

    // Create a wrapped progress callback that maps to our task structure
    let currentPhase = 'export';
    let exportProgress = 0;
    let generateProgress = 0;
    let optimizeProgress = 0;
    let pwaProgress = 0;

    const wrappedProgress = (message) => {
        // Detect phase changes from message content
        if (message.includes('Connecting') || message.includes('Connected') || message.includes('Exporting') || message.includes('Export')) {
            currentPhase = 'export';
            exportProgress = Math.min(exportProgress + 15, 100);
            progressCallback('export', exportProgress, message);
        } else if (message.includes('Processing assets') || message.includes('Optimizing') || message.includes('Minifying')) {
            currentPhase = 'optimize';
            optimizeProgress = Math.min(optimizeProgress + 25, 100);
            progressCallback('optimize', optimizeProgress, message);
        } else if (message.includes('Generating') && (message.includes('page') || message.includes('HTML') || message.includes('search') || message.includes('sitemap'))) {
            currentPhase = 'generate';
            generateProgress = Math.min(generateProgress + 15, 100);
            progressCallback('generate', generateProgress, message);
        } else if (message.includes('PWA')) {
            currentPhase = 'pwa';
            pwaProgress = Math.min(pwaProgress + 50, 100);
            progressCallback('pwa', pwaProgress, message);
        } else if (message.includes('complete') || message.includes('Complete')) {
            progressCallback(currentPhase, 100, message);
        } else {
            progressCallback(currentPhase, 50, message);
        }
    };

    // Run the build
    await builder.build(wrappedProgress);

    progressCallback('export', 100, 'Export complete');
    progressCallback('generate', 100, 'HTML generation complete');
    progressCallback('optimize', 100, 'Asset optimization complete');
    progressCallback('pwa', 100, 'PWA generation complete');
}

/**
 * Update progress for a conversion
 */
function updateProgress(conversionId, task, progress, message) {
    const conversion = conversions.get(conversionId);
    if (!conversion) return;

    // Update task progress
    if (task && progress !== undefined) {
        conversion.tasks[task] = progress;
    }

    // Calculate overall progress
    const taskWeights = { export: 0.3, optimize: 0.25, generate: 0.3, pwa: 0.15 };
    let overallProgress = 0;
    for (const [t, weight] of Object.entries(taskWeights)) {
        overallProgress += (conversion.tasks[t] || 0) * weight;
    }
    conversion.progress = Math.round(overallProgress);

    // Update current task message
    if (message) {
        conversion.currentTask = message;
        conversion.log = message;
    }

    conversion.status = 'running';
    sendProgressUpdate(conversionId, conversion);
}

/**
 * Send progress update to all connected clients
 */
function sendProgressUpdate(conversionId, data) {
    const clients = progressClients.get(conversionId);
    if (!clients) return;

    const message = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (e) {
            // Client disconnected
        }
    });
}

/**
 * Send named event to clients
 */
function sendEvent(conversionId, eventName, data) {
    const clients = progressClients.get(conversionId);
    if (!clients) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.write(message);
        } catch (e) {
            // Client disconnected
        }
    });
}

/**
 * Get output directory statistics
 */
async function getOutputStats(outputDir) {
    const stats = {
        pages: 0,
        products: 0,
        images: 0,
        totalSize: 0
    };

    if (!await fs.pathExists(outputDir)) {
        return stats;
    }

    const walkDir = async (dir) => {
        const files = await fs.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                await walkDir(filePath);
            } else {
                stats.totalSize += stat.size;

                if (file.endsWith('.html')) {
                    stats.pages++;
                    if (filePath.includes('/products/')) {
                        stats.products++;
                    }
                } else if (/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(file)) {
                    stats.images++;
                }
            }
        }
    };

    await walkDir(outputDir);
    return stats;
}

/**
 * Generate demo products
 */
function generateDemoProducts() {
    const products = [
        {
            id: 1,
            name: 'Premium Wireless Headphones',
            slug: 'premium-wireless-headphones',
            description: 'Experience crystal-clear audio with our premium wireless headphones. Features active noise cancellation, 30-hour battery life, and premium comfort.',
            shortDescription: 'Premium wireless headphones with ANC',
            price: '199.99',
            regularPrice: '249.99',
            salePrice: '199.99',
            onSale: true,
            images: [{ src: 'https://via.placeholder.com/800x800/2563eb/ffffff?text=Headphones', alt: 'Premium Wireless Headphones' }],
            categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }],
            averageRating: '4.8',
            ratingCount: 124,
            stockStatus: 'instock',
            featured: true
        },
        {
            id: 2,
            name: 'Smart Watch Pro',
            slug: 'smart-watch-pro',
            description: 'Stay connected with the Smart Watch Pro. Track your fitness, receive notifications, and more with this stylish smartwatch.',
            shortDescription: 'Advanced smartwatch with fitness tracking',
            price: '299.99',
            regularPrice: '299.99',
            images: [{ src: 'https://via.placeholder.com/800x800/10b981/ffffff?text=SmartWatch', alt: 'Smart Watch Pro' }],
            categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }],
            averageRating: '4.6',
            ratingCount: 89,
            stockStatus: 'instock',
            featured: true
        },
        {
            id: 3,
            name: 'Organic Cotton T-Shirt',
            slug: 'organic-cotton-tshirt',
            description: 'Comfortable and sustainable organic cotton t-shirt. Perfect for everyday wear.',
            shortDescription: '100% organic cotton t-shirt',
            price: '29.99',
            regularPrice: '29.99',
            images: [{ src: 'https://via.placeholder.com/800x800/8b5cf6/ffffff?text=T-Shirt', alt: 'Organic Cotton T-Shirt' }],
            categories: [{ id: 2, name: 'Clothing', slug: 'clothing' }],
            averageRating: '4.5',
            ratingCount: 56,
            stockStatus: 'instock'
        },
        {
            id: 4,
            name: 'Leather Messenger Bag',
            slug: 'leather-messenger-bag',
            description: 'Handcrafted genuine leather messenger bag. Perfect for work or travel.',
            shortDescription: 'Genuine leather messenger bag',
            price: '149.99',
            regularPrice: '179.99',
            salePrice: '149.99',
            onSale: true,
            images: [{ src: 'https://via.placeholder.com/800x800/f59e0b/ffffff?text=Bag', alt: 'Leather Messenger Bag' }],
            categories: [{ id: 3, name: 'Accessories', slug: 'accessories' }],
            averageRating: '4.9',
            ratingCount: 42,
            stockStatus: 'instock'
        },
        {
            id: 5,
            name: 'Stainless Steel Water Bottle',
            slug: 'stainless-steel-water-bottle',
            description: 'Keep your drinks cold for 24 hours or hot for 12 hours with this premium stainless steel water bottle.',
            shortDescription: 'Insulated stainless steel bottle',
            price: '34.99',
            regularPrice: '34.99',
            images: [{ src: 'https://via.placeholder.com/800x800/ef4444/ffffff?text=Bottle', alt: 'Stainless Steel Water Bottle' }],
            categories: [{ id: 4, name: 'Home & Living', slug: 'home-living' }],
            averageRating: '4.7',
            ratingCount: 78,
            stockStatus: 'instock'
        },
        {
            id: 6,
            name: 'Bluetooth Speaker',
            slug: 'bluetooth-speaker',
            description: 'Portable Bluetooth speaker with 360-degree sound and 20-hour battery life.',
            shortDescription: 'Portable wireless speaker',
            price: '79.99',
            regularPrice: '99.99',
            salePrice: '79.99',
            onSale: true,
            images: [{ src: 'https://via.placeholder.com/800x800/06b6d4/ffffff?text=Speaker', alt: 'Bluetooth Speaker' }],
            categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }],
            averageRating: '4.4',
            ratingCount: 156,
            stockStatus: 'instock',
            featured: true
        },
        {
            id: 7,
            name: 'Running Shoes',
            slug: 'running-shoes',
            description: 'Lightweight and responsive running shoes designed for maximum performance.',
            shortDescription: 'Performance running shoes',
            price: '129.99',
            regularPrice: '129.99',
            images: [{ src: 'https://via.placeholder.com/800x800/ec4899/ffffff?text=Shoes', alt: 'Running Shoes' }],
            categories: [{ id: 2, name: 'Clothing', slug: 'clothing' }],
            averageRating: '4.6',
            ratingCount: 203,
            stockStatus: 'instock'
        },
        {
            id: 8,
            name: 'Desk Lamp LED',
            slug: 'desk-lamp-led',
            description: 'Modern LED desk lamp with adjustable brightness and color temperature.',
            shortDescription: 'Adjustable LED desk lamp',
            price: '49.99',
            regularPrice: '49.99',
            images: [{ src: 'https://via.placeholder.com/800x800/84cc16/ffffff?text=Lamp', alt: 'Desk Lamp LED' }],
            categories: [{ id: 4, name: 'Home & Living', slug: 'home-living' }],
            averageRating: '4.3',
            ratingCount: 67,
            stockStatus: 'instock'
        }
    ];

    return products;
}

/**
 * Generate demo categories
 */
function generateDemoCategories() {
    return [
        { id: 1, name: 'Electronics', slug: 'electronics', count: 3, description: 'Latest gadgets and electronics' },
        { id: 2, name: 'Clothing', slug: 'clothing', count: 2, description: 'Fashion and apparel' },
        { id: 3, name: 'Accessories', slug: 'accessories', count: 1, description: 'Bags, watches, and more' },
        { id: 4, name: 'Home & Living', slug: 'home-living', count: 2, description: 'Home decor and essentials' }
    ];
}

/**
 * Get currency symbol from currency code
 */
function getCurrencySymbol(currency) {
    const symbols = {
        'USD': '$',
        'EUR': '\u20AC',
        'GBP': '\u00A3',
        'JPY': '\u00A5',
        'AUD': 'A$',
        'CAD': 'C$',
        'CHF': 'CHF',
        'CNY': '\u00A5',
        'INR': '\u20B9',
        'BRL': 'R$'
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
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551   WooCommerce to HTML5 Conversion Wizard   \u2551
\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
\u2551                                             \u2551
\u2551   Server running at:                        \u2551
\u2551   http://localhost:${PORT}                       \u2551
\u2551                                             \u2551
\u2551   Open this URL in your browser to start    \u2551
\u2551   converting your WooCommerce store!        \u2551
\u2551                                             \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
    `);
});

module.exports = app;
