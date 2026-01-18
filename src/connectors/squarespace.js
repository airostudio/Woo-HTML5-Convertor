/**
 * Squarespace Platform Connector
 * Connects to Squarespace Commerce API to export store data
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Squarespace Commerce API access
 * - API key from Squarespace Developer settings
 */

const BasePlatformConnector = require('./base-connector');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class SquarespaceConnector extends BasePlatformConnector {
    static platform = 'squarespace';
    static displayName = 'Squarespace';
    static icon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#000" d="M22.655 8.719c-1.802-1.801-4.726-1.801-6.564 0l-7.351 7.35c-.45.45-.45 1.2 0 1.65.45.449 1.2.449 1.65 0l7.351-7.351c.899-.899 2.362-.899 3.264 0 .9.9.9 2.364 0 3.264l-7.239 7.239c.9.899 2.362.899 3.263 0l5.589-5.589c1.836-1.838 1.836-4.763.037-6.563zm-2.475 2.437c-.451-.45-1.201-.45-1.65 0l-7.354 7.389c-.9.899-2.361.899-3.262 0-.45-.45-1.2-.45-1.65 0s-.45 1.2 0 1.649c1.801 1.801 4.726 1.801 6.564 0l7.351-7.35c.449-.487.449-1.239.001-1.688zm-2.439-7.35c-1.801-1.801-4.726-1.801-6.564 0l-7.351 7.351c-.45.449-.45 1.199 0 1.649s1.2.45 1.65 0l7.395-7.351c.9-.899 2.371-.899 3.27 0 .451.45 1.201.45 1.65 0 .421-.487.421-1.199-.029-1.649h-.021zm-2.475 2.437c-.45-.45-1.2-.45-1.65 0l-7.351 7.389c-.899.9-2.363.9-3.265 0-.9-.899-.9-2.363 0-3.264l7.239-7.239c-.9-.9-2.362-.9-3.263 0L1.35 8.719c-1.8 1.8-1.8 4.725 0 6.563 1.801 1.801 4.725 1.801 6.564 0l7.35-7.351c.451-.488.451-1.238 0-1.688h.002z"/></svg>`;

    static credentialFields = [
        {
            name: 'siteUrl',
            label: 'Site URL',
            type: 'url',
            placeholder: 'https://your-site.squarespace.com',
            required: true
        },
        {
            name: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your Squarespace API Key',
            required: true
        }
    ];

    static supportedFeatures = {
        products: true,
        categories: true,
        images: true,
        reviews: false,
        variations: true,
        inventory: true,
        customers: false,
        orders: false
    };

    constructor(config) {
        super(config);

        if (config.apiKey) {
            this.baseUrl = 'https://api.squarespace.com/1.0/commerce';
            this.headers = {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'WooHTML5Converter/2.0'
            };
        }
    }

    async testConnection() {
        try {
            if (!this.baseUrl || !this.headers) {
                return { success: false, error: 'API not configured' };
            }

            // Get inventory to test connection
            const response = await axios.get(`${this.baseUrl}/inventory`, {
                headers: this.headers,
                params: { limit: 1 }
            });

            this.connected = true;

            // Get product count
            const productsResponse = await axios.get(`${this.baseUrl}/products`, {
                headers: this.headers
            });

            return {
                success: true,
                storeName: 'Squarespace Store',
                productCount: productsResponse.data.products?.length || 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    async getStoreInfo() {
        return {
            name: 'Squarespace Store',
            url: this.config.siteUrl,
            currency: 'USD'
        };
    }

    async exportProducts(progressCallback) {
        const products = [];
        let cursor = null;
        let total = 0;
        let hasMore = true;

        while (hasMore) {
            const params = { limit: 100 };
            if (cursor) {
                params.cursor = cursor;
            }

            const response = await axios.get(`${this.baseUrl}/products`, {
                headers: this.headers,
                params
            });

            const pageProducts = (response.data.products || []).map(p => this.normalizeProduct(p));
            products.push(...pageProducts);

            // Update total on first request
            if (total === 0) {
                total = response.data.pagination?.totalCount || pageProducts.length;
            }

            if (progressCallback) {
                progressCallback(products.length, total);
            }

            // Check for next page
            cursor = response.data.pagination?.nextPageCursor;
            hasMore = Boolean(cursor);
        }

        return products;
    }

    async exportCategories() {
        // Squarespace doesn't have a direct categories API
        // Categories are typically page-based in Squarespace
        // Return empty array or implement custom logic
        return [];
    }

    async exportImages(products, outputDir, progressCallback) {
        const imagesDir = path.join(outputDir, 'images');
        await fs.ensureDir(imagesDir);

        const allImages = [];
        products.forEach(p => {
            if (p.images) {
                p.images.forEach(img => {
                    if (img.src && !allImages.find(i => i.src === img.src)) {
                        allImages.push({
                            ...img,
                            productId: p.id,
                            productSlug: p.slug
                        });
                    }
                });
            }
        });

        const downloadedImages = [];
        let downloaded = 0;

        for (const image of allImages) {
            try {
                const urlPath = new URL(image.src).pathname;
                const ext = path.extname(urlPath) || '.jpg';
                const filename = `${image.productSlug}-${image.id}${ext}`;
                const filepath = path.join(imagesDir, filename);

                const response = await axios({
                    method: 'GET',
                    url: image.src,
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                await fs.writeFile(filepath, response.data);

                downloadedImages.push({
                    originalUrl: image.src,
                    localPath: `images/${filename}`,
                    productId: image.productId
                });

                downloaded++;
                if (progressCallback) {
                    progressCallback(downloaded, allImages.length);
                }
            } catch (error) {
                console.error(`Failed to download image: ${image.src}`, error.message);
            }
        }

        return downloadedImages;
    }

    normalizeProduct(product) {
        const defaultVariant = product.variants?.[0] || {};

        return {
            id: product.id,
            name: product.name,
            slug: product.urlSlug || this.slugify(product.name),
            type: product.type || 'PHYSICAL',
            status: product.isVisible ? 'publish' : 'draft',
            description: product.description || '',
            shortDescription: product.excerpt || (product.description ? product.description.substring(0, 200) : ''),
            sku: defaultVariant.sku || product.sku || '',
            price: this.formatPrice(defaultVariant.priceMoney || product.priceMoney),
            regularPrice: this.formatPrice(defaultVariant.priceMoney || product.priceMoney),
            salePrice: product.onSale ? this.formatPrice(defaultVariant.salePriceMoney || product.salePriceMoney) : '',
            onSale: product.onSale || false,
            stockStatus: (defaultVariant.stock?.unlimited || defaultVariant.stock?.quantity > 0) ? 'instock' : 'outofstock',
            stockQuantity: defaultVariant.stock?.quantity || 0,
            manageStock: !defaultVariant.stock?.unlimited,
            categories: (product.tags || []).map((tag, i) => ({
                id: i,
                name: tag,
                slug: this.slugify(tag)
            })),
            tags: (product.tags || []).map((tag, i) => ({
                id: i,
                name: tag,
                slug: this.slugify(tag)
            })),
            images: (product.images || []).map((img, i) => ({
                id: img.id || i,
                src: img.url || img.originalUrl || '',
                alt: img.altText || product.name,
                position: img.orderIndex || i
            })),
            attributes: (product.variantAttributes || []).map(attr => ({
                id: attr.name,
                name: attr.name,
                options: attr.values || [],
                variation: true,
                visible: true
            })),
            variations: (product.variants || []).map(v => ({
                id: v.id,
                sku: v.sku || '',
                price: this.formatPrice(v.priceMoney),
                regularPrice: this.formatPrice(v.priceMoney),
                stockStatus: (v.stock?.unlimited || v.stock?.quantity > 0) ? 'instock' : 'outofstock',
                stockQuantity: v.stock?.quantity || 0,
                attributes: (v.attributes || []).map(attr => ({
                    name: attr.name,
                    option: attr.value
                })),
                image: v.image?.id || null
            })),
            averageRating: '0',
            ratingCount: 0,
            featured: product.isFeatured || false,
            dateCreated: product.createdOn,
            dateModified: product.modifiedOn
        };
    }

    formatPrice(priceMoney) {
        if (!priceMoney) return '0';
        const value = priceMoney.value || priceMoney.amount || 0;
        const currency = priceMoney.currency || 'USD';

        // Squarespace stores prices in cents for some currencies
        if (['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(currency)) {
            return (value / 100).toFixed(2);
        }
        return value.toString();
    }
}

module.exports = SquarespaceConnector;
