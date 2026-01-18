/**
 * WooCommerce Platform Connector
 * Connects to WooCommerce REST API to export store data
 */

const BasePlatformConnector = require('./base-connector');
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class WooCommerceConnector extends BasePlatformConnector {
    static platform = 'woocommerce';
    static displayName = 'WooCommerce';
    static icon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.35 5.37C1.95 5.82 1.58 6.5 1.27 7.42c-.31.91-.47 1.92-.47 3.01 0 1.67.44 3.02 1.33 4.04.89 1.02 2.03 1.53 3.42 1.53.47 0 .94-.05 1.41-.16.47-.11.89-.26 1.26-.44l.57 1.57c-.53.29-1.15.52-1.87.69-.72.17-1.47.25-2.26.25-1.14 0-2.14-.23-3-.68-.86-.45-1.57-1.07-2.13-1.86-.56-.79-.96-1.71-1.21-2.76-.25-1.05-.37-2.17-.37-3.35 0-1.34.18-2.57.53-3.69C.63 4.71 1.12 3.74 1.74 2.92 2.36 2.1 3.11 1.46 4 1c.89-.46 1.91-.69 3.06-.69.89 0 1.7.13 2.43.39.73.26 1.36.64 1.89 1.14.53.5.94 1.12 1.23 1.85.29.73.44 1.56.44 2.49 0 .87-.15 1.66-.44 2.37-.29.71-.7 1.32-1.21 1.83-.51.51-1.12.91-1.83 1.19-.71.28-1.48.42-2.31.42-.71 0-1.32-.13-1.83-.39-.51-.26-.89-.64-1.14-1.14l-.71 2.83c-.24.87-.56 1.57-.96 2.1-.4.53-.83.93-1.29 1.2l-.42-.39c.28-.25.52-.59.72-1.02.2-.43.4-1.01.6-1.74l2.67-10.09c-.29.22-.63.33-1.02.33-.49 0-.9-.18-1.23-.53zM21.35 5.37c-.4.45-.77 1.13-1.08 2.05-.31.91-.47 1.92-.47 3.01 0 1.67.44 3.02 1.33 4.04.89 1.02 2.03 1.53 3.42 1.53.47 0 .94-.05 1.41-.16.47-.11.89-.26 1.26-.44l.57 1.57c-.53.29-1.15.52-1.87.69-.72.17-1.47.25-2.26.25-1.14 0-2.14-.23-3-.68-.86-.45-1.57-1.07-2.13-1.86-.56-.79-.96-1.71-1.21-2.76-.25-1.05-.37-2.17-.37-3.35 0-1.34.18-2.57.53-3.69.35-.12.84-.85 1.46-1.67 2.08-2.49 2.83-3.13 3.72-3.59.89-.46 1.91-.69 3.06-.69.89 0 1.7.13 2.43.39.73.26 1.36.64 1.89 1.14.53.5.94 1.12 1.23 1.85.29.73.44 1.56.44 2.49 0 .87-.15 1.66-.44 2.37-.29.71-.7 1.32-1.21 1.83-.51.51-1.12.91-1.83 1.19-.71.28-1.48.42-2.31.42-.71 0-1.32-.13-1.83-.39-.51-.26-.89-.64-1.14-1.14l-.71 2.83c-.24.87-.56 1.57-.96 2.1-.4.53-.83.93-1.29 1.2l-.42-.39c.28-.25.52-.59.72-1.02.2-.43.4-1.01.6-1.74l2.67-10.09c-.29.22-.63.33-1.02.33-.49 0-.9-.18-1.23-.53z"/></svg>`;

    static credentialFields = [
        {
            name: 'siteUrl',
            label: 'Store URL',
            type: 'url',
            placeholder: 'https://your-store.com',
            required: true
        },
        {
            name: 'consumerKey',
            label: 'Consumer Key',
            type: 'text',
            placeholder: 'ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            required: true
        },
        {
            name: 'consumerSecret',
            label: 'Consumer Secret',
            type: 'password',
            placeholder: 'cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            required: true
        }
    ];

    static supportedFeatures = {
        products: true,
        categories: true,
        images: true,
        reviews: true,
        variations: true,
        inventory: true,
        customers: false,
        orders: false
    };

    constructor(config) {
        super(config);

        if (config.siteUrl && config.consumerKey && config.consumerSecret) {
            this.api = new WooCommerceRestApi({
                url: config.siteUrl,
                consumerKey: config.consumerKey,
                consumerSecret: config.consumerSecret,
                version: 'wc/v3',
                queryStringAuth: true
            });
        }
    }

    async testConnection() {
        try {
            if (!this.api) {
                return { success: false, error: 'API not configured' };
            }

            const response = await this.api.get('');
            const productsResponse = await this.api.get('products', { per_page: 1 });

            this.connected = true;
            this.storeInfo = {
                name: response.data.name || 'WooCommerce Store',
                description: response.data.description || '',
                url: response.data.URL || this.config.siteUrl
            };

            return {
                success: true,
                storeName: this.storeInfo.name,
                productCount: parseInt(productsResponse.headers['x-wp-total'] || '0', 10)
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    async getStoreInfo() {
        if (this.storeInfo) return this.storeInfo;

        try {
            const response = await this.api.get('');
            const settingsResponse = await this.api.get('settings/general');

            const settings = {};
            settingsResponse.data.forEach(s => {
                settings[s.id] = s.value;
            });

            this.storeInfo = {
                name: response.data.name,
                description: response.data.description,
                url: response.data.URL,
                currency: settings.woocommerce_currency || 'USD',
                currencyPosition: settings.woocommerce_currency_pos || 'left'
            };

            return this.storeInfo;
        } catch (error) {
            return {
                name: 'WooCommerce Store',
                url: this.config.siteUrl,
                currency: 'USD'
            };
        }
    }

    async exportProducts(progressCallback) {
        const products = [];
        let page = 1;
        const perPage = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await this.api.get('products', {
                page,
                per_page: perPage,
                status: 'publish'
            });

            const total = parseInt(response.headers['x-wp-total'] || '0', 10);
            const pageProducts = response.data.map(p => this.normalizeProduct(p));
            products.push(...pageProducts);

            if (progressCallback) {
                progressCallback(products.length, total);
            }

            hasMore = response.data.length === perPage;
            page++;
        }

        return products;
    }

    async exportCategories() {
        const categories = [];
        let page = 1;
        const perPage = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await this.api.get('products/categories', {
                page,
                per_page: perPage,
                hide_empty: false
            });

            const pageCategories = response.data.map(c => this.normalizeCategory(c));
            categories.push(...pageCategories);

            hasMore = response.data.length === perPage;
            page++;
        }

        return categories;
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
                const ext = path.extname(new URL(image.src).pathname) || '.jpg';
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

    async exportReviews(productIds) {
        const reviews = [];

        for (const productId of productIds) {
            try {
                const response = await this.api.get('products/reviews', {
                    product: productId,
                    per_page: 100
                });

                reviews.push(...response.data.map(r => ({
                    id: r.id,
                    productId: r.product_id,
                    reviewer: r.reviewer,
                    reviewerEmail: r.reviewer_email,
                    review: r.review,
                    rating: r.rating,
                    verified: r.verified,
                    dateCreated: r.date_created
                })));
            } catch (error) {
                // Skip if reviews not available for this product
            }
        }

        return reviews;
    }

    normalizeProduct(product) {
        return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            type: product.type,
            status: product.status,
            description: product.description,
            shortDescription: product.short_description,
            sku: product.sku,
            price: product.price,
            regularPrice: product.regular_price,
            salePrice: product.sale_price,
            onSale: product.on_sale,
            stockStatus: product.stock_status,
            stockQuantity: product.stock_quantity,
            manageStock: product.manage_stock,
            categories: product.categories.map(c => ({
                id: c.id,
                name: c.name,
                slug: c.slug
            })),
            tags: product.tags.map(t => ({
                id: t.id,
                name: t.name,
                slug: t.slug
            })),
            images: product.images.map(img => ({
                id: img.id,
                src: img.src,
                alt: img.alt || product.name,
                position: img.position || 0
            })),
            attributes: product.attributes.map(attr => ({
                id: attr.id,
                name: attr.name,
                options: attr.options,
                variation: attr.variation,
                visible: attr.visible
            })),
            variations: product.variations || [],
            averageRating: product.average_rating,
            ratingCount: product.rating_count,
            featured: product.featured,
            weight: product.weight,
            dimensions: product.dimensions,
            shippingClass: product.shipping_class,
            dateCreated: product.date_created,
            dateModified: product.date_modified,
            relatedIds: product.related_ids || [],
            upsellIds: product.upsell_ids || [],
            crossSellIds: product.cross_sell_ids || []
        };
    }
}

module.exports = WooCommerceConnector;
