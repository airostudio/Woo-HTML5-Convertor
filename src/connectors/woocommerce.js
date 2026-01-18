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
    static icon = `<svg viewBox="0 0 512 210" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="210" rx="30" fill="#7f54b3"/><path d="M115.38 143.57c-6.17 0-11.21-2.15-15.1-6.45-3.89-4.3-5.84-10.18-5.84-17.63 0-7.92 1.98-14.3 5.94-19.16 3.96-4.86 9.09-7.29 15.39-7.29 6.04 0 10.87 2.02 14.49 6.06 3.63 4.04 5.44 9.64 5.44 16.8 0 8.32-1.91 14.93-5.74 19.85-3.83 4.92-9 7.38-15.52 7.38l-.06.44zm1.07-43.37c-3.63 0-6.62 1.72-8.98 5.15-2.35 3.43-3.53 8.08-3.53 13.94 0 5.6 1.14 10.03 3.43 13.3 2.29 3.27 5.24 4.9 8.88 4.9 3.76 0 6.81-1.72 9.13-5.15 2.32-3.43 3.48-8.14 3.48-14.13 0-5.47-1.12-9.83-3.38-13.06-2.25-3.23-5.27-4.85-9.03-4.95zM177.38 143.57c-6.17 0-11.21-2.15-15.1-6.45-3.89-4.3-5.84-10.18-5.84-17.63 0-7.92 1.98-14.3 5.94-19.16 3.96-4.86 9.09-7.29 15.39-7.29 6.04 0 10.87 2.02 14.49 6.06 3.63 4.04 5.44 9.64 5.44 16.8 0 8.32-1.91 14.93-5.74 19.85-3.83 4.92-9 7.38-15.52 7.38l-.06.44zm1.07-43.37c-3.63 0-6.62 1.72-8.98 5.15-2.35 3.43-3.53 8.08-3.53 13.94 0 5.6 1.14 10.03 3.43 13.3 2.29 3.27 5.24 4.9 8.88 4.9 3.76 0 6.81-1.72 9.13-5.15 2.32-3.43 3.48-8.14 3.48-14.13 0-5.47-1.12-9.83-3.38-13.06-2.25-3.23-5.27-4.85-9.03-4.95zM80.83 94.35l-10.64 48.08h-8.05L52.3 103.8l-9.64 38.63h-8.05l-10.84-48.08h8.64l6.84 38.82 9.64-38.82h8.25l9.84 38.82 6.64-38.82h7.21zM244.85 125.5c0 5.87-1.58 10.53-4.75 13.99-3.17 3.46-7.35 5.19-12.55 5.19-3.37 0-6.35-.77-8.93-2.32-2.59-1.55-4.59-3.78-6.01-6.7-1.42-2.92-2.13-6.29-2.13-10.11 0-5.94 1.55-10.64 4.65-14.08 3.1-3.44 7.25-5.17 12.45-5.17 5.07 0 9.15 1.74 12.26 5.22 3.11 3.48 4.66 8.14 4.66 13.99h.35zm-26.06.05c0 4.17.87 7.41 2.62 9.72 1.74 2.31 4.17 3.46 7.29 3.46 3.17 0 5.62-1.15 7.34-3.46 1.72-2.31 2.57-5.55 2.57-9.72 0-4.1-.86-7.31-2.57-9.62-1.72-2.31-4.15-3.46-7.29-3.46-3.17 0-5.62 1.16-7.34 3.48-1.72 2.33-2.57 5.52-2.57 9.6h-.05z" fill="#fff"/></svg>`;

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
