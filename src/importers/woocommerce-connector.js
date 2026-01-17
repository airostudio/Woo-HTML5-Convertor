/**
 * WooCommerce API Connector
 * Connects to WooCommerce REST API and exports complete store data
 */

const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class WooCommerceConnector {
    constructor(config) {
        this.baseUrl = config.siteUrl.replace(/\/$/, '');
        this.consumerKey = config.consumerKey;
        this.consumerSecret = config.consumerSecret;
        this.version = config.version || 'wc/v3';
        this.timeout = config.timeout || 30000;
        this.perPage = config.perPage || 100;

        this.apiClient = axios.create({
            baseURL: `${this.baseUrl}/wp-json/${this.version}`,
            timeout: this.timeout,
            auth: {
                username: this.consumerKey,
                password: this.consumerSecret
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        this.exportData = {
            meta: {
                exportDate: new Date().toISOString(),
                sourceUrl: this.baseUrl,
                version: '1.0.0'
            },
            products: [],
            categories: [],
            tags: [],
            attributes: [],
            variations: [],
            images: [],
            pages: [],
            settings: {},
            shipping: [],
            taxes: [],
            coupons: [],
            paymentGateways: []
        };
    }

    /**
     * Fetch all pages of a paginated endpoint
     */
    async fetchAllPaginated(endpoint, params = {}) {
        const allItems = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            try {
                const response = await this.apiClient.get(endpoint, {
                    params: {
                        ...params,
                        page,
                        per_page: this.perPage
                    }
                });

                const items = response.data;
                allItems.push(...items);

                // Check if there are more pages
                const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1');
                hasMore = page < totalPages;
                page++;

                // Rate limiting - be nice to the server
                await this.delay(100);
            } catch (error) {
                if (error.response?.status === 400 && page > 1) {
                    // No more pages
                    hasMore = false;
                } else {
                    throw error;
                }
            }
        }

        return allItems;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Export all products including variations
     */
    async exportProducts(progressCallback) {
        progressCallback?.('Fetching products...');

        const products = await this.fetchAllPaginated('/products', {
            status: 'publish'
        });

        // Fetch variations for variable products
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            progressCallback?.(`Processing product ${i + 1}/${products.length}: ${product.name}`);

            if (product.type === 'variable' && product.variations?.length > 0) {
                try {
                    const variations = await this.fetchAllPaginated(
                        `/products/${product.id}/variations`
                    );
                    product.variationDetails = variations;
                    this.exportData.variations.push(...variations.map(v => ({
                        ...v,
                        parentId: product.id
                    })));
                } catch (error) {
                    console.warn(`Failed to fetch variations for product ${product.id}`);
                }
            }

            // Collect images
            if (product.images?.length > 0) {
                this.exportData.images.push(...product.images.map(img => ({
                    ...img,
                    productId: product.id,
                    type: 'product'
                })));
            }
        }

        this.exportData.products = products;
        return products;
    }

    /**
     * Export all categories
     */
    async exportCategories(progressCallback) {
        progressCallback?.('Fetching categories...');

        const categories = await this.fetchAllPaginated('/products/categories', {
            hide_empty: false
        });

        // Collect category images
        categories.forEach(cat => {
            if (cat.image) {
                this.exportData.images.push({
                    ...cat.image,
                    categoryId: cat.id,
                    type: 'category'
                });
            }
        });

        this.exportData.categories = categories;
        return categories;
    }

    /**
     * Export all tags
     */
    async exportTags(progressCallback) {
        progressCallback?.('Fetching tags...');

        const tags = await this.fetchAllPaginated('/products/tags');
        this.exportData.tags = tags;
        return tags;
    }

    /**
     * Export all product attributes
     */
    async exportAttributes(progressCallback) {
        progressCallback?.('Fetching attributes...');

        try {
            const attributes = await this.fetchAllPaginated('/products/attributes');

            // Fetch terms for each attribute
            for (const attr of attributes) {
                try {
                    const terms = await this.fetchAllPaginated(
                        `/products/attributes/${attr.id}/terms`
                    );
                    attr.terms = terms;
                } catch (error) {
                    attr.terms = [];
                }
            }

            this.exportData.attributes = attributes;
            return attributes;
        } catch (error) {
            console.warn('Failed to fetch attributes:', error.message);
            return [];
        }
    }

    /**
     * Export shipping zones and methods
     */
    async exportShipping(progressCallback) {
        progressCallback?.('Fetching shipping settings...');

        try {
            const zones = await this.apiClient.get('/shipping/zones');
            const shippingData = [];

            for (const zone of zones.data) {
                const methods = await this.apiClient.get(
                    `/shipping/zones/${zone.id}/methods`
                );
                const locations = await this.apiClient.get(
                    `/shipping/zones/${zone.id}/locations`
                );

                shippingData.push({
                    ...zone,
                    methods: methods.data,
                    locations: locations.data
                });
            }

            this.exportData.shipping = shippingData;
            return shippingData;
        } catch (error) {
            console.warn('Failed to fetch shipping:', error.message);
            return [];
        }
    }

    /**
     * Export tax settings
     */
    async exportTaxes(progressCallback) {
        progressCallback?.('Fetching tax settings...');

        try {
            const taxes = await this.fetchAllPaginated('/taxes');
            const taxClasses = await this.apiClient.get('/taxes/classes');

            this.exportData.taxes = {
                rates: taxes,
                classes: taxClasses.data
            };
            return this.exportData.taxes;
        } catch (error) {
            console.warn('Failed to fetch taxes:', error.message);
            return { rates: [], classes: [] };
        }
    }

    /**
     * Export coupons
     */
    async exportCoupons(progressCallback) {
        progressCallback?.('Fetching coupons...');

        try {
            const coupons = await this.fetchAllPaginated('/coupons');
            this.exportData.coupons = coupons;
            return coupons;
        } catch (error) {
            console.warn('Failed to fetch coupons:', error.message);
            return [];
        }
    }

    /**
     * Export payment gateway settings
     */
    async exportPaymentGateways(progressCallback) {
        progressCallback?.('Fetching payment gateways...');

        try {
            const gateways = await this.apiClient.get('/payment_gateways');
            this.exportData.paymentGateways = gateways.data.filter(g => g.enabled);
            return this.exportData.paymentGateways;
        } catch (error) {
            console.warn('Failed to fetch payment gateways:', error.message);
            return [];
        }
    }

    /**
     * Export store settings
     */
    async exportSettings(progressCallback) {
        progressCallback?.('Fetching store settings...');

        try {
            const settingsGroups = ['general', 'products', 'tax', 'shipping', 'checkout', 'account'];
            const settings = {};

            for (const group of settingsGroups) {
                try {
                    const response = await this.apiClient.get(`/settings/${group}`);
                    settings[group] = response.data;
                } catch (error) {
                    settings[group] = [];
                }
            }

            this.exportData.settings = settings;
            return settings;
        } catch (error) {
            console.warn('Failed to fetch settings:', error.message);
            return {};
        }
    }

    /**
     * Download all images to local directory
     */
    async downloadImages(outputDir, progressCallback) {
        progressCallback?.('Downloading images...');

        const imagesDir = path.join(outputDir, 'images');
        await fs.ensureDir(imagesDir);

        const downloaded = [];
        const total = this.exportData.images.length;

        for (let i = 0; i < total; i++) {
            const image = this.exportData.images[i];
            progressCallback?.(`Downloading image ${i + 1}/${total}`);

            try {
                const response = await axios.get(image.src, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                const ext = path.extname(new URL(image.src).pathname) || '.jpg';
                const filename = `${image.id}${ext}`;
                const localPath = path.join(imagesDir, filename);

                await fs.writeFile(localPath, response.data);

                downloaded.push({
                    ...image,
                    localPath: `images/${filename}`,
                    originalSrc: image.src
                });

                // Rate limiting
                await this.delay(50);
            } catch (error) {
                console.warn(`Failed to download image ${image.src}:`, error.message);
                downloaded.push({
                    ...image,
                    localPath: null,
                    error: error.message
                });
            }
        }

        return downloaded;
    }

    /**
     * Run complete export
     */
    async runFullExport(outputDir, progressCallback) {
        const startTime = Date.now();

        progressCallback?.('Starting WooCommerce export...');

        // Create output directory
        await fs.ensureDir(outputDir);

        // Export all data types
        await this.exportProducts(progressCallback);
        await this.exportCategories(progressCallback);
        await this.exportTags(progressCallback);
        await this.exportAttributes(progressCallback);
        await this.exportShipping(progressCallback);
        await this.exportTaxes(progressCallback);
        await this.exportCoupons(progressCallback);
        await this.exportPaymentGateways(progressCallback);
        await this.exportSettings(progressCallback);

        // Download images
        const downloadedImages = await this.downloadImages(outputDir, progressCallback);

        // Update image references
        this.updateImageReferences(downloadedImages);

        // Calculate statistics
        this.exportData.meta.statistics = {
            products: this.exportData.products.length,
            categories: this.exportData.categories.length,
            tags: this.exportData.tags.length,
            attributes: this.exportData.attributes.length,
            variations: this.exportData.variations.length,
            images: downloadedImages.filter(i => i.localPath).length,
            exportDuration: Date.now() - startTime
        };

        // Save export data
        const exportPath = path.join(outputDir, 'woo-export.json');
        await fs.writeJson(exportPath, this.exportData, { spaces: 2 });

        progressCallback?.('Export complete!');

        return this.exportData;
    }

    /**
     * Update product and category image references to local paths
     */
    updateImageReferences(downloadedImages) {
        const imageMap = new Map(
            downloadedImages.map(img => [img.id, img])
        );

        // Update product images
        this.exportData.products.forEach(product => {
            if (product.images) {
                product.images = product.images.map(img => {
                    const downloaded = imageMap.get(img.id);
                    return downloaded ? { ...img, src: downloaded.localPath || img.src } : img;
                });
            }
        });

        // Update category images
        this.exportData.categories.forEach(category => {
            if (category.image) {
                const downloaded = imageMap.get(category.image.id);
                if (downloaded) {
                    category.image.src = downloaded.localPath || category.image.src;
                }
            }
        });
    }

    /**
     * Test connection to WooCommerce store
     */
    async testConnection() {
        try {
            const response = await this.apiClient.get('/');
            return {
                success: true,
                storeName: response.data.store?.name || 'Unknown',
                storeUrl: this.baseUrl,
                wcVersion: response.data.version || 'Unknown'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                status: error.response?.status
            };
        }
    }
}

module.exports = WooCommerceConnector;
