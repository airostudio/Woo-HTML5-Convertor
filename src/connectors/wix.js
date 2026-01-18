/**
 * Wix Platform Connector
 * Connects to Wix Stores API to export store data
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Wix Developer account
 * - OAuth app installation flow
 * - Wix Stores API access
 */

const BasePlatformConnector = require('./base-connector');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class WixConnector extends BasePlatformConnector {
    static platform = 'wix';
    static displayName = 'Wix';
    static icon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.82 8.52c-.62 0-1.16.34-1.7.73-.14-.25-.3-.47-.6-.59-.3-.14-.66-.11-1 .05-.65.28-1.11.84-1.38 1.47-.06.13-.1.27-.13.41l-.01.04v4.67c0 .36.14.71.38.97.24.27.58.43.94.45h.04c.36-.02.7-.18.94-.45.25-.26.38-.61.38-.97V11.9c.15-.14.3-.26.44-.35.13-.08.25-.13.36-.13.1 0 .18.04.24.12.06.08.1.2.1.36v3.4c0 .36.13.71.37.97.24.27.58.43.94.45h.04c.36-.02.7-.18.94-.45.24-.26.37-.61.37-.97V11.9c.16-.14.3-.26.44-.35.13-.08.25-.13.36-.13.1 0 .18.04.24.12.06.08.1.2.1.36v3.4c0 .36.13.71.37.97.24.27.58.43.94.45h.05c.36-.02.7-.18.93-.45.25-.26.38-.61.38-.97v-3.56c0-.63-.16-1.14-.49-1.52-.33-.38-.8-.57-1.37-.57-.6 0-1.14.31-1.66.67-.05-.05-.1-.1-.17-.13-.33-.16-.7-.14-1.02.03-.15.08-.3.18-.44.31-.05-.05-.1-.1-.17-.14-.33-.16-.7-.14-1.02.03-.15.08-.3.18-.44.31z"/><path d="M13.14 9.07c-.67 0-1.22.22-1.65.65-.42.43-.64.98-.64 1.65v4.02c0 .36.14.71.38.97.24.27.58.43.94.45h.04c.36-.02.7-.18.94-.45.25-.26.38-.61.38-.97V11.3c0-.2.06-.36.18-.49.12-.13.28-.19.47-.19.19 0 .35.06.47.19.12.13.18.3.18.5v4.08c0 .36.14.71.38.97.24.27.58.43.94.45h.04c.36-.02.7-.18.94-.45.25-.26.38-.61.38-.97v-4.02c0-.67-.21-1.22-.64-1.65-.42-.43-.97-.65-1.65-.65-.31 0-.6.06-.86.18a2.2 2.2 0 0 0-.86-.18z"/><path d="M21.55 8.52c-.31 0-.6.06-.86.18a2.2 2.2 0 0 0-.86-.18c-.67 0-1.22.22-1.65.65-.42.43-.63.98-.63 1.65v4.57c0 .36.13.71.37.97.24.27.58.43.94.45h.05c.36-.02.7-.18.93-.45.25-.26.38-.61.38-.97V11.3c0-.2.06-.36.18-.49.12-.13.28-.19.47-.19.2 0 .35.06.47.19.12.13.18.3.18.5l.01 4.08c0 .36.13.71.37.97.24.27.58.43.94.45h.05c.36-.02.7-.18.93-.45.25-.26.38-.61.38-.97v-4.02c0-.67-.21-1.22-.63-1.65-.43-.43-.98-.65-1.65-.65-.09 0-.17 0-.25.02z"/></svg>`;

    static credentialFields = [
        {
            name: 'siteId',
            label: 'Site ID',
            type: 'text',
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            required: true
        },
        {
            name: 'apiKey',
            label: 'API Key',
            type: 'password',
            placeholder: 'Your Wix API Key',
            required: true
        },
        {
            name: 'accountId',
            label: 'Account ID',
            type: 'text',
            placeholder: 'Your Wix Account ID',
            required: true
        }
    ];

    static supportedFeatures = {
        products: true,
        categories: true,  // Collections in Wix
        images: true,
        reviews: false,
        variations: true,
        inventory: true,
        customers: false,
        orders: false
    };

    constructor(config) {
        super(config);

        if (config.siteId && config.apiKey) {
            this.baseUrl = 'https://www.wixapis.com/stores/v1';
            this.headers = {
                'Authorization': config.apiKey,
                'wix-site-id': config.siteId,
                'wix-account-id': config.accountId || '',
                'Content-Type': 'application/json'
            };
        }
    }

    async testConnection() {
        try {
            if (!this.baseUrl || !this.headers) {
                return { success: false, error: 'API not configured' };
            }

            // Try to get products to test connection
            const response = await axios.post(
                `${this.baseUrl}/products/query`,
                { query: { paging: { limit: 1 } } },
                { headers: this.headers }
            );

            this.connected = true;

            return {
                success: true,
                storeName: 'Wix Store',
                productCount: response.data.totalResults || 0
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    async getStoreInfo() {
        // Wix doesn't have a direct store info endpoint
        // Return basic info from config
        return {
            name: 'Wix Store',
            siteId: this.config.siteId,
            currency: 'USD'
        };
    }

    async exportProducts(progressCallback) {
        const products = [];
        let offset = 0;
        const limit = 100;
        let total = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.post(
                `${this.baseUrl}/products/query`,
                {
                    query: {
                        paging: { limit, offset }
                    },
                    includeVariants: true
                },
                { headers: this.headers }
            );

            if (offset === 0) {
                total = response.data.totalResults || 0;
            }

            const pageProducts = (response.data.products || []).map(p => this.normalizeProduct(p));
            products.push(...pageProducts);

            if (progressCallback) {
                progressCallback(products.length, total);
            }

            hasMore = products.length < total;
            offset += limit;
        }

        return products;
    }

    async exportCategories() {
        const collections = [];

        try {
            const response = await axios.post(
                `${this.baseUrl}/collections/query`,
                { query: { paging: { limit: 100 } } },
                { headers: this.headers }
            );

            const wixCollections = response.data.collections || [];
            collections.push(...wixCollections.map(c => this.normalizeCategory(c)));
        } catch (error) {
            console.error('Failed to get collections:', error.message);
        }

        return collections;
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
                const ext = '.jpg';
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
        const media = product.media?.mainMedia || product.media?.items?.[0] || {};

        return {
            id: product.id,
            name: product.name,
            slug: product.slug || this.slugify(product.name),
            type: product.productType || 'physical',
            status: product.visible ? 'publish' : 'draft',
            description: product.description || '',
            shortDescription: product.description ? product.description.substring(0, 200) : '',
            sku: product.sku || '',
            price: product.price?.price || '0',
            regularPrice: product.price?.discountedPrice ? product.price.price : (product.price?.price || '0'),
            salePrice: product.price?.discountedPrice || '',
            onSale: Boolean(product.price?.discountedPrice),
            stockStatus: product.stock?.inStock ? 'instock' : 'outofstock',
            stockQuantity: product.stock?.quantity || 0,
            manageStock: product.stock?.trackInventory || false,
            categories: (product.collectionIds || []).map(id => ({
                id: id,
                name: '',
                slug: ''
            })),
            tags: [],
            images: (product.media?.items || []).map((item, i) => ({
                id: item.id || i,
                src: item.image?.url || item.url || '',
                alt: item.image?.altText || product.name,
                position: i
            })),
            attributes: (product.productOptions || []).map(opt => ({
                id: opt.name,
                name: opt.name,
                options: (opt.choices || []).map(c => c.value),
                variation: true,
                visible: true
            })),
            variations: (product.variants || []).map(v => ({
                id: v.id,
                sku: v.sku || '',
                price: v.variant?.priceData?.price || product.price?.price || '0',
                regularPrice: v.variant?.priceData?.price || product.price?.price || '0',
                stockStatus: v.stock?.inStock ? 'instock' : 'outofstock',
                stockQuantity: v.stock?.quantity || 0,
                attributes: Object.entries(v.choices || {}).map(([name, value]) => ({
                    name,
                    option: value
                }))
            })),
            averageRating: '0',
            ratingCount: 0,
            featured: false,
            weight: product.weight || 0,
            dateCreated: product.createdDate,
            dateModified: product.lastUpdated
        };
    }

    normalizeCategory(collection) {
        return {
            id: collection.id,
            name: collection.name,
            slug: collection.slug || this.slugify(collection.name),
            description: collection.description || '',
            parent: 0,
            count: collection.numberOfProducts || 0,
            image: collection.media?.mainMedia?.image?.url || null
        };
    }
}

module.exports = WixConnector;
