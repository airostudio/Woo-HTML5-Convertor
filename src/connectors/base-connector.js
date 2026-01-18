/**
 * Base Platform Connector
 * Abstract class for e-commerce platform connectors
 * Extend this class to add support for new platforms
 */

class BasePlatformConnector {
    /**
     * Platform identifier
     * @type {string}
     */
    static platform = 'base';

    /**
     * Human-readable platform name
     * @type {string}
     */
    static displayName = 'Base Platform';

    /**
     * Platform icon (SVG or URL)
     * @type {string}
     */
    static icon = '';

    /**
     * Required credentials fields for this platform
     * @type {Array<{name: string, label: string, type: string, placeholder: string, required: boolean}>}
     */
    static credentialFields = [];

    /**
     * Supported features for this platform
     * @type {Object}
     */
    static supportedFeatures = {
        products: true,
        categories: true,
        images: true,
        reviews: false,
        variations: false,
        inventory: false,
        customers: false,
        orders: false
    };

    constructor(config = {}) {
        this.config = config;
        this.connected = false;
        this.storeInfo = null;
    }

    /**
     * Test connection to the platform
     * @returns {Promise<{success: boolean, storeName?: string, productCount?: number, error?: string}>}
     */
    async testConnection() {
        throw new Error('testConnection() must be implemented by subclass');
    }

    /**
     * Get store information
     * @returns {Promise<Object>}
     */
    async getStoreInfo() {
        throw new Error('getStoreInfo() must be implemented by subclass');
    }

    /**
     * Export all products
     * @param {Function} progressCallback - Progress callback (current, total)
     * @returns {Promise<Array>}
     */
    async exportProducts(progressCallback) {
        throw new Error('exportProducts() must be implemented by subclass');
    }

    /**
     * Export all categories
     * @returns {Promise<Array>}
     */
    async exportCategories() {
        throw new Error('exportCategories() must be implemented by subclass');
    }

    /**
     * Export product images
     * @param {Array} products - Products with image URLs
     * @param {string} outputDir - Directory to save images
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>}
     */
    async exportImages(products, outputDir, progressCallback) {
        throw new Error('exportImages() must be implemented by subclass');
    }

    /**
     * Export product reviews (if supported)
     * @param {Array} productIds - Product IDs to get reviews for
     * @returns {Promise<Array>}
     */
    async exportReviews(productIds) {
        if (!this.constructor.supportedFeatures.reviews) {
            return [];
        }
        throw new Error('exportReviews() must be implemented by subclass');
    }

    /**
     * Run full export process
     * @param {string} outputDir - Output directory for exported data
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>}
     */
    async runFullExport(outputDir, progressCallback) {
        const progress = progressCallback || (() => {});
        const result = {
            meta: {
                platform: this.constructor.platform,
                exportDate: new Date().toISOString(),
                version: '2.0.0'
            },
            products: [],
            categories: [],
            images: [],
            reviews: []
        };

        try {
            // Test connection first
            progress('Testing connection...');
            const connectionTest = await this.testConnection();
            if (!connectionTest.success) {
                throw new Error(connectionTest.error || 'Connection failed');
            }

            // Get store info
            progress('Getting store information...');
            result.storeInfo = await this.getStoreInfo();

            // Export categories
            progress('Exporting categories...');
            result.categories = await this.exportCategories();
            progress(`Exported ${result.categories.length} categories`);

            // Export products
            progress('Exporting products...');
            result.products = await this.exportProducts((current, total) => {
                progress(`Exporting product ${current}/${total}`);
            });
            progress(`Exported ${result.products.length} products`);

            // Export images
            if (outputDir) {
                progress('Downloading images...');
                result.images = await this.exportImages(result.products, outputDir, (current, total) => {
                    progress(`Downloading image ${current}/${total}`);
                });
            }

            // Export reviews if supported
            if (this.constructor.supportedFeatures.reviews) {
                progress('Exporting reviews...');
                const productIds = result.products.map(p => p.id);
                result.reviews = await this.exportReviews(productIds);
                progress(`Exported ${result.reviews.length} reviews`);
            }

            return result;

        } catch (error) {
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    /**
     * Normalize product data to standard format
     * @param {Object} rawProduct - Raw product data from platform
     * @returns {Object} - Normalized product
     */
    normalizeProduct(rawProduct) {
        // Default implementation - override in subclass
        return {
            id: rawProduct.id,
            name: rawProduct.name || rawProduct.title || '',
            slug: rawProduct.slug || rawProduct.handle || this.slugify(rawProduct.name || ''),
            description: rawProduct.description || rawProduct.body_html || '',
            shortDescription: rawProduct.short_description || rawProduct.excerpt || '',
            sku: rawProduct.sku || '',
            price: this.normalizePrice(rawProduct.price),
            regularPrice: this.normalizePrice(rawProduct.regular_price || rawProduct.compare_at_price),
            salePrice: this.normalizePrice(rawProduct.sale_price),
            onSale: Boolean(rawProduct.on_sale || rawProduct.sale_price),
            stockStatus: this.normalizeStockStatus(rawProduct),
            stockQuantity: rawProduct.stock_quantity || rawProduct.inventory_quantity || null,
            categories: this.normalizeCategories(rawProduct),
            tags: this.normalizeTags(rawProduct),
            images: this.normalizeImages(rawProduct),
            attributes: this.normalizeAttributes(rawProduct),
            variations: this.normalizeVariations(rawProduct),
            averageRating: rawProduct.average_rating || rawProduct.rating || '0',
            ratingCount: rawProduct.rating_count || rawProduct.reviews_count || 0,
            featured: Boolean(rawProduct.featured),
            dateCreated: rawProduct.date_created || rawProduct.created_at || new Date().toISOString(),
            dateModified: rawProduct.date_modified || rawProduct.updated_at || new Date().toISOString()
        };
    }

    /**
     * Normalize category data to standard format
     * @param {Object} rawCategory - Raw category data
     * @returns {Object} - Normalized category
     */
    normalizeCategory(rawCategory) {
        return {
            id: rawCategory.id,
            name: rawCategory.name || rawCategory.title || '',
            slug: rawCategory.slug || rawCategory.handle || this.slugify(rawCategory.name || ''),
            description: rawCategory.description || '',
            parent: rawCategory.parent || rawCategory.parent_id || 0,
            count: rawCategory.count || rawCategory.products_count || 0,
            image: rawCategory.image?.src || rawCategory.image || null
        };
    }

    // Helper methods
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    normalizePrice(price) {
        if (!price) return '';
        if (typeof price === 'number') return price.toFixed(2);
        return String(price).replace(/[^0-9.]/g, '');
    }

    normalizeStockStatus(product) {
        if (product.stock_status) return product.stock_status;
        if (product.available === false) return 'outofstock';
        if (product.inventory_quantity === 0) return 'outofstock';
        return 'instock';
    }

    normalizeCategories(product) {
        if (Array.isArray(product.categories)) {
            return product.categories.map(c => ({
                id: c.id,
                name: c.name || c.title || '',
                slug: c.slug || c.handle || ''
            }));
        }
        return [];
    }

    normalizeTags(product) {
        if (Array.isArray(product.tags)) {
            if (typeof product.tags[0] === 'string') {
                return product.tags.map((t, i) => ({
                    id: i,
                    name: t,
                    slug: this.slugify(t)
                }));
            }
            return product.tags.map(t => ({
                id: t.id,
                name: t.name || t.title || '',
                slug: t.slug || t.handle || ''
            }));
        }
        return [];
    }

    normalizeImages(product) {
        const images = product.images || [];
        if (Array.isArray(images)) {
            return images.map((img, i) => ({
                id: img.id || i,
                src: img.src || img.url || img,
                alt: img.alt || img.alt_text || product.name || '',
                position: img.position || i
            }));
        }
        if (product.image) {
            return [{
                id: 0,
                src: product.image.src || product.image,
                alt: product.image.alt || product.name || '',
                position: 0
            }];
        }
        return [];
    }

    normalizeAttributes(product) {
        if (Array.isArray(product.attributes)) {
            return product.attributes.map(attr => ({
                id: attr.id,
                name: attr.name,
                options: attr.options || [],
                variation: attr.variation || false,
                visible: attr.visible !== false
            }));
        }
        if (Array.isArray(product.options)) {
            return product.options.map((opt, i) => ({
                id: i,
                name: opt.name,
                options: opt.values || [],
                variation: true,
                visible: true
            }));
        }
        return [];
    }

    normalizeVariations(product) {
        if (Array.isArray(product.variations)) {
            return product.variations;
        }
        if (Array.isArray(product.variants)) {
            return product.variants.map(v => ({
                id: v.id,
                sku: v.sku || '',
                price: this.normalizePrice(v.price),
                regularPrice: this.normalizePrice(v.compare_at_price),
                stockStatus: v.available ? 'instock' : 'outofstock',
                stockQuantity: v.inventory_quantity || null,
                attributes: this.extractVariantAttributes(v),
                image: v.image_id || v.featured_image || null
            }));
        }
        return [];
    }

    extractVariantAttributes(variant) {
        const attrs = [];
        if (variant.option1) attrs.push({ name: 'option1', option: variant.option1 });
        if (variant.option2) attrs.push({ name: 'option2', option: variant.option2 });
        if (variant.option3) attrs.push({ name: 'option3', option: variant.option3 });
        return attrs;
    }
}

module.exports = BasePlatformConnector;
