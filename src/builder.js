/**
 * Main Builder
 * Orchestrates the conversion from WooCommerce to HTML5 store
 */

const path = require('path');
const fs = require('fs-extra');
const WooCommerceConnector = require('./importers/woocommerce-connector');
const HtmlGenerator = require('./generators/html-generator');
const PWAGenerator = require('./generators/pwa-generator');
const ImageOptimizer = require('./optimizers/image-optimizer');
const AssetOptimizer = require('./optimizers/asset-optimizer');

class StoreBuilder {
    constructor(config) {
        this.config = {
            outputDir: config.outputDir || path.join(process.cwd(), 'output'),
            templatesDir: config.templatesDir || path.join(__dirname, '../templates'),

            // WooCommerce settings
            siteUrl: config.siteUrl,
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,

            // Store settings
            siteName: config.siteName || 'My Store',
            siteDescription: config.siteDescription || 'Your Online Store',
            currency: config.currency || 'USD',
            currencySymbol: config.currencySymbol || '$',

            // Features
            enableSearch: config.enableSearch !== false,
            enableCart: config.enableCart !== false,
            enableWishlist: config.enableWishlist || false,
            enableReviews: config.enableReviews !== false,
            enablePWA: config.enablePWA !== false,

            // Optimization
            optimizeImages: config.optimizeImages !== false,
            optimizeAssets: config.optimizeAssets !== false,
            generateWebp: config.generateWebp !== false,

            // Theme
            primaryColor: config.primaryColor || '#2563eb',
            theme: config.theme || 'default',

            // Pagination
            productsPerPage: config.productsPerPage || 12,

            ...config
        };

        this.stats = {
            startTime: null,
            endTime: null,
            pagesGenerated: 0,
            imagesOptimized: 0,
            totalSize: 0
        };
    }

    /**
     * Log progress message
     */
    log(message, type = 'info') {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = {
            info: '\x1b[36m[INFO]\x1b[0m',
            success: '\x1b[32m[SUCCESS]\x1b[0m',
            warning: '\x1b[33m[WARNING]\x1b[0m',
            error: '\x1b[31m[ERROR]\x1b[0m'
        }[type] || '[INFO]';

        console.log(`${timestamp} ${prefix} ${message}`);
    }

    /**
     * Run the complete build process
     */
    async build(progressCallback) {
        this.stats.startTime = Date.now();
        const progress = progressCallback || ((msg) => this.log(msg));

        try {
            // Step 1: Clean output directory
            progress('Preparing output directory...');
            await this.prepareOutputDir();

            // Step 2: Connect to WooCommerce and export data
            progress('Connecting to WooCommerce...');
            const storeData = await this.exportFromWooCommerce(progress);

            // Step 3: Optimize images
            if (this.config.optimizeImages) {
                progress('Optimizing images...');
                await this.optimizeImages(progress);
            }

            // Step 4: Copy and optimize assets
            progress('Processing assets...');
            await this.processAssets(progress);

            // Step 5: Generate HTML pages
            progress('Generating HTML pages...');
            const pages = await this.generatePages(storeData, progress);

            // Step 6: Generate PWA files
            if (this.config.enablePWA) {
                progress('Generating PWA files...');
                await this.generatePWA(pages);
            }

            // Step 7: Optimize assets
            if (this.config.optimizeAssets) {
                progress('Minifying assets...');
                await this.optimizeAssets(progress);
            }

            // Step 8: Generate sitemap and robots.txt
            progress('Generating sitemap and robots.txt...');
            await this.generateSEOFiles(storeData);

            this.stats.endTime = Date.now();

            // Calculate final stats
            await this.calculateStats();

            progress('Build complete!');
            return this.getStats();

        } catch (error) {
            this.log(`Build failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Prepare output directory
     */
    async prepareOutputDir() {
        await fs.emptyDir(this.config.outputDir);
        await fs.ensureDir(path.join(this.config.outputDir, 'assets/css'));
        await fs.ensureDir(path.join(this.config.outputDir, 'assets/js'));
        await fs.ensureDir(path.join(this.config.outputDir, 'assets/images'));
        await fs.ensureDir(path.join(this.config.outputDir, 'assets/data'));
        await fs.ensureDir(path.join(this.config.outputDir, 'product'));
        await fs.ensureDir(path.join(this.config.outputDir, 'category'));
    }

    /**
     * Export data from WooCommerce
     */
    async exportFromWooCommerce(progress) {
        if (!this.config.siteUrl) {
            // Use sample data if no WooCommerce connection
            progress('No WooCommerce connection configured, using sample data...');
            return this.getSampleData();
        }

        const connector = new WooCommerceConnector({
            siteUrl: this.config.siteUrl,
            consumerKey: this.config.consumerKey,
            consumerSecret: this.config.consumerSecret
        });

        // Test connection
        const connectionTest = await connector.testConnection();
        if (!connectionTest.success) {
            throw new Error(`WooCommerce connection failed: ${connectionTest.error}`);
        }

        progress(`Connected to ${connectionTest.storeName}`);

        // Run full export
        const tempDir = path.join(this.config.outputDir, 'temp');
        const exportData = await connector.runFullExport(tempDir, progress);

        // Move images to final location
        const tempImages = path.join(tempDir, 'images');
        const finalImages = path.join(this.config.outputDir, 'images');

        if (await fs.pathExists(tempImages)) {
            await fs.move(tempImages, finalImages, { overwrite: true });
        }

        // Clean up temp
        await fs.remove(tempDir);

        return exportData;
    }

    /**
     * Get sample data for demo
     */
    getSampleData() {
        return {
            meta: {
                exportDate: new Date().toISOString(),
                version: '1.0.0'
            },
            products: [
                {
                    id: 1,
                    name: 'Sample Product 1',
                    slug: 'sample-product-1',
                    type: 'simple',
                    status: 'publish',
                    featured: true,
                    description: '<p>This is a sample product description with all the details you need.</p>',
                    short_description: 'A great sample product',
                    sku: 'SAMPLE-001',
                    price: '29.99',
                    regular_price: '39.99',
                    sale_price: '29.99',
                    on_sale: true,
                    stock_status: 'instock',
                    stock_quantity: 100,
                    categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }],
                    tags: [{ id: 1, name: 'New', slug: 'new' }],
                    images: [],
                    attributes: [],
                    average_rating: '4.5',
                    rating_count: 12,
                    date_created: new Date().toISOString()
                },
                {
                    id: 2,
                    name: 'Sample Product 2',
                    slug: 'sample-product-2',
                    type: 'simple',
                    status: 'publish',
                    featured: false,
                    description: '<p>Another sample product with great features.</p>',
                    short_description: 'Another great product',
                    sku: 'SAMPLE-002',
                    price: '49.99',
                    regular_price: '49.99',
                    sale_price: '',
                    on_sale: false,
                    stock_status: 'instock',
                    stock_quantity: 50,
                    categories: [{ id: 2, name: 'Clothing', slug: 'clothing' }],
                    tags: [],
                    images: [],
                    attributes: [],
                    average_rating: '4.0',
                    rating_count: 8,
                    date_created: new Date().toISOString()
                },
                {
                    id: 3,
                    name: 'Sample Product 3',
                    slug: 'sample-product-3',
                    type: 'simple',
                    status: 'publish',
                    featured: true,
                    description: '<p>Premium quality sample product.</p>',
                    short_description: 'Premium quality',
                    sku: 'SAMPLE-003',
                    price: '99.99',
                    regular_price: '99.99',
                    sale_price: '',
                    on_sale: false,
                    stock_status: 'instock',
                    stock_quantity: 25,
                    categories: [{ id: 1, name: 'Electronics', slug: 'electronics' }],
                    tags: [{ id: 2, name: 'Premium', slug: 'premium' }],
                    images: [],
                    attributes: [],
                    average_rating: '5.0',
                    rating_count: 5,
                    date_created: new Date().toISOString()
                }
            ],
            categories: [
                { id: 1, name: 'Electronics', slug: 'electronics', parent: 0, count: 2, description: 'Electronic devices and gadgets' },
                { id: 2, name: 'Clothing', slug: 'clothing', parent: 0, count: 1, description: 'Fashion and apparel' }
            ],
            tags: [
                { id: 1, name: 'New', slug: 'new', count: 1 },
                { id: 2, name: 'Premium', slug: 'premium', count: 1 }
            ],
            attributes: [],
            variations: [],
            images: [],
            shipping: [],
            taxes: { rates: [], classes: [] },
            coupons: [],
            paymentGateways: [],
            settings: {}
        };
    }

    /**
     * Optimize images
     */
    async optimizeImages(progress) {
        const imagesDir = path.join(this.config.outputDir, 'images');

        if (!await fs.pathExists(imagesDir)) {
            return;
        }

        const optimizer = new ImageOptimizer({
            quality: 80,
            generateWebp: this.config.generateWebp,
            generateResponsive: true
        });

        const results = await optimizer.optimizeDirectory(
            imagesDir,
            imagesDir,
            progress
        );

        this.stats.imagesOptimized = optimizer.getStats().processed;

        return results;
    }

    /**
     * Process and copy assets
     */
    async processAssets(progress) {
        const templatesAssetsDir = path.join(this.config.templatesDir, 'assets');
        const outputAssetsDir = path.join(this.config.outputDir, 'assets');

        if (await fs.pathExists(templatesAssetsDir)) {
            await fs.copy(templatesAssetsDir, outputAssetsDir, { overwrite: true });
        }
    }

    /**
     * Generate HTML pages
     */
    async generatePages(storeData, progress) {
        const generator = new HtmlGenerator({
            templatesDir: this.config.templatesDir,
            outputDir: this.config.outputDir,
            siteName: this.config.siteName,
            siteDescription: this.config.siteDescription,
            currency: this.config.currency,
            currencySymbol: this.config.currencySymbol,
            productsPerPage: this.config.productsPerPage,
            enableSearch: this.config.enableSearch,
            enableCart: this.config.enableCart,
            enableWishlist: this.config.enableWishlist,
            enableReviews: this.config.enableReviews,
            primaryColor: this.config.primaryColor,
            theme: this.config.theme
        });

        // Load templates
        await generator.loadTemplates();

        // Set store data
        generator.setStoreData(storeData);

        const allPages = [];

        // Generate home page
        progress('Generating home page...');
        allPages.push(await generator.generateHomePage());

        // Generate product pages
        progress('Generating product pages...');
        const productPages = await generator.generateProductPages(progress);
        allPages.push(...productPages);

        // Generate category pages
        progress('Generating category pages...');
        const categoryPages = await generator.generateCategoryPages(progress);
        allPages.push(...categoryPages);

        // Generate static pages
        progress('Generating static pages...');
        const staticPages = await generator.generateStaticPages();
        allPages.push(...staticPages);

        // Generate search index
        progress('Generating search index...');
        await generator.generateSearchIndex();

        this.stats.pagesGenerated = allPages.length;

        return allPages;
    }

    /**
     * Generate PWA files
     */
    async generatePWA(pages) {
        const pwaGenerator = new PWAGenerator({
            siteName: this.config.siteName,
            shortName: this.config.siteName.substring(0, 12),
            description: this.config.siteDescription,
            themeColor: this.config.primaryColor
        });

        await pwaGenerator.writeFiles(this.config.outputDir, pages);
    }

    /**
     * Optimize final assets
     */
    async optimizeAssets(progress) {
        const optimizer = new AssetOptimizer({
            minifyHtml: true,
            minifyCss: true,
            minifyJs: true,
            generateGzip: true
        });

        // Optimize CSS
        const cssDir = path.join(this.config.outputDir, 'assets/css');
        if (await fs.pathExists(cssDir)) {
            const cssFiles = await fs.readdir(cssDir);
            for (const file of cssFiles) {
                if (file.endsWith('.css')) {
                    const filePath = path.join(cssDir, file);
                    await optimizer.optimizeCssFile(filePath, filePath);
                }
            }
        }

        // Optimize JS
        const jsDir = path.join(this.config.outputDir, 'assets/js');
        if (await fs.pathExists(jsDir)) {
            const jsFiles = await fs.readdir(jsDir);
            for (const file of jsFiles) {
                if (file.endsWith('.js')) {
                    const filePath = path.join(jsDir, file);
                    await optimizer.optimizeJsFile(filePath, filePath);
                }
            }
        }

        return optimizer.getStats();
    }

    /**
     * Generate SEO files (sitemap, robots.txt)
     */
    async generateSEOFiles(storeData) {
        const generator = new HtmlGenerator({
            outputDir: this.config.outputDir,
            siteName: this.config.siteName
        });

        generator.setStoreData(storeData);

        const baseUrl = this.config.siteUrl || 'https://example.com';
        await generator.generateSitemap(baseUrl);
        await generator.generateRobotsTxt(baseUrl);
    }

    /**
     * Calculate final statistics
     */
    async calculateStats() {
        // Calculate total size
        const getTotalSize = async (dir) => {
            let total = 0;
            const items = await fs.readdir(dir, { withFileTypes: true });

            for (const item of items) {
                const itemPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    total += await getTotalSize(itemPath);
                } else {
                    const stat = await fs.stat(itemPath);
                    total += stat.size;
                }
            }

            return total;
        };

        this.stats.totalSize = await getTotalSize(this.config.outputDir);
    }

    /**
     * Get build statistics
     */
    getStats() {
        const duration = this.stats.endTime - this.stats.startTime;

        return {
            duration: `${(duration / 1000).toFixed(2)}s`,
            pagesGenerated: this.stats.pagesGenerated,
            imagesOptimized: this.stats.imagesOptimized,
            totalSize: `${(this.stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
            outputDir: this.config.outputDir
        };
    }
}

module.exports = StoreBuilder;

// Allow running directly
if (require.main === module) {
    const builder = new StoreBuilder({
        siteName: 'Demo Store',
        siteDescription: 'A blazing fast HTML5 store'
    });

    builder.build()
        .then(stats => {
            console.log('\n=== Build Complete ===');
            console.log(`Duration: ${stats.duration}`);
            console.log(`Pages: ${stats.pagesGenerated}`);
            console.log(`Images: ${stats.imagesOptimized}`);
            console.log(`Total Size: ${stats.totalSize}`);
            console.log(`Output: ${stats.outputDir}`);
        })
        .catch(err => {
            console.error('Build failed:', err);
            process.exit(1);
        });
}
