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
    static icon = `<svg viewBox="0 0 24 24" fill="#0C6EFC"><path d="M21.718 6.486c-.353-.188-.737-.282-1.152-.282-.65 0-1.24.207-1.77.622-.245-.518-.698-.778-1.36-.778-.603 0-1.158.222-1.665.667l.063-3.36C15.834 1.452 14.455.002 12.552.002c-1.087 0-2.07.509-2.813 1.354-.207-.08-.433-.12-.68-.12-.554 0-1.062.192-1.523.577-.254-.38-.62-.577-1.098-.577-.442 0-.84.163-1.195.49-.355.325-.59.75-.706 1.274L3.05 10.93c-.107.504-.01.953.293 1.346.302.393.72.59 1.254.59.487 0 .917-.177 1.29-.53.374-.354.62-.8.737-1.338l.817-3.868c.033-.16.1-.288.2-.384.1-.096.212-.144.338-.144.138 0 .246.048.326.144.08.096.1.224.063.384l-1.287 6.053c-.107.504-.013.956.282 1.357.295.4.717.6 1.268.6.492 0 .928-.18 1.31-.54.38-.36.63-.813.75-1.357l.74-3.504c.233.076.483.114.75.114.758 0 1.404-.273 1.94-.82.535-.545.87-1.232 1.004-2.06l.28-1.71c.054-.325.013-.604-.124-.838-.137-.234-.366-.39-.687-.47l.282-1.51c.024-.14.073-.25.147-.33.074-.08.163-.12.267-.12.138 0 .247.048.327.144.08.096.1.224.063.384l-1.17 6.214c-.106.503-.013.953.28 1.35.294.396.716.594 1.266.594.497 0 .935-.178 1.313-.535.38-.356.627-.802.743-1.34l.75-3.99c.033-.16.1-.288.2-.384.1-.096.213-.144.34-.144.137 0 .246.05.326.15.08.1.1.23.063.39l-1.16 6.16c-.11.51-.02.96.27 1.36.29.4.71.6 1.26.6.49 0 .93-.18 1.31-.53.38-.36.63-.8.75-1.34l.89-4.76c.11-.5.01-.95-.29-1.35-.3-.4-.72-.6-1.26-.6z"/></svg>`;

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
