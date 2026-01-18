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
    static icon = `<svg viewBox="0 0 24 24" fill="#7f54b3"><path d="M2.227 4.857A3.598 3.598 0 0 1 5.458 3h13.084a3.6 3.6 0 0 1 3.233 1.857l.037.075c.053.104.103.21.148.318l-9.842 6.097L2.08 5.175c.045-.108.095-.214.147-.318zM.83 6.754C.33 7.648 0 8.674 0 9.818v6.545c0 2.3 1.526 4.182 3.6 4.636l7.515-7.354zm10.287 8.236l-7.52 7.36h16.806c1.786 0 3.267-1.335 3.544-3.066L13.622 12.86l-2.505 2.13zm12.883-8.67v.002l.002-.001-.002-.001z"/><ellipse cx="6.815" cy="11.37" rx="1.572" ry="2.545" fill="#fff"/><ellipse cx="12" cy="11.37" rx="1.572" ry="2.545" fill="#fff"/><ellipse cx="17.185" cy="11.37" rx="1.572" ry="2.545" fill="#fff"/></svg>`;

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
