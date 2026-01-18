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
    static icon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#0C6EFC" d="m0 7.354 2.113 9.292h.801a1.54 1.54 0 0 0 1.506-1.218l1.351-6.34a.171.171 0 0 1 .167-.137c.08 0 .15.058.167.137l1.352 6.34a1.54 1.54 0 0 0 1.506 1.218h.805l2.113-9.292h-.565c-.62 0-1.159.43-1.296 1.035l-1.26 5.545-1.106-5.176a1.76 1.76 0 0 0-2.19-1.324c-.639.176-1.113.716-1.251 1.365l-1.094 5.127-1.26-5.537A1.33 1.33 0 0 0 .563 7.354H0zm13.992 0a.951.951 0 0 0-.951.95v8.342h.635a.952.952 0 0 0 .951-.95V7.353h-.635zm1.778 0 3.158 4.66-3.14 4.632h1.325c.368 0 .712-.181.918-.486l1.756-2.59a.12.12 0 0 1 .197 0l1.754 2.59c.206.305.55.486.918.486h1.326l-3.14-4.632L24 7.354h-1.326c-.368 0-.712.181-.918.486l-1.772 2.617a.12.12 0 0 1-.197 0L18.014 7.84a1.108 1.108 0 0 0-.918-.486H15.77z"/></svg>`;

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
