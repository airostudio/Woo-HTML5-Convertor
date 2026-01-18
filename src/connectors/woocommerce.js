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
    static icon = `<svg viewBox="-0.5 9 25 5.5" xmlns="http://www.w3.org/2000/svg"><path fill="#7f54b3" d="M.754 9.58a.754.754 0 00-.754.758v2.525c0 .42.339.758.758.758h3.135l1.431.799-.326-.799h2.373a.757.757 0 00.758-.758v-2.525a.757.757 0 00-.758-.758H.754zm2.709.445h.03c.065.001.124.023.179.067a.26.26 0 01.103.19.29.29 0 01-.033.16c-.13.239-.236.64-.322 1.199-.083.541-.114.965-.094 1.267a.392.392 0 01-.039.219.213.213 0 01-.176.12c-.086.006-.177-.034-.263-.124-.31-.316-.555-.788-.735-1.416-.216.425-.375.744-.478.957-.196.376-.363.568-.502.578-.09.007-.166-.069-.233-.228-.17-.436-.352-1.277-.548-2.524a.297.297 0 01.054-.222c.047-.064.116-.095.21-.102.169-.013.265.065.288.238.103.695.217 1.284.336 1.766l.727-1.387c.066-.126.15-.192.25-.199.146-.01.237.083.273.28.083.441.188.817.315 1.136.086-.844.233-1.453.44-1.828a.255.255 0 01.218-.147zm1.293.36c.056 0 .116.006.18.02.232.05.411.177.53.386.107.18.161.395.161.654 0 .343-.087.654-.26.94-.2.332-.459.5-.781.5a.88.88 0 01-.18-.022.763.763 0 01-.531-.384 1.287 1.287 0 01-.158-.659c0-.342.085-.655.258-.937.202-.333.462-.498.78-.498zm2.084 0c.056 0 .116.006.18.02.236.05.411.177.53.386.107.18.16.395.16.654 0 .343-.086.654-.259.94-.2.332-.459.5-.781.5a.88.88 0 01-.18-.022.763.763 0 01-.531-.384 1.287 1.287 0 01-.16-.659c0-.342.087-.655.26-.937.202-.333.462-.498.78-.498zm4.437.047c-.305 0-.546.102-.718.304-.173.203-.256.49-.256.856 0 .395.086.697.256.906.17.21.418.316.744.316.315 0 .559-.107.728-.316.17-.21.256-.504.256-.883s-.087-.673-.26-.879c-.176-.202-.424-.304-.75-.304zm-1.466.002a1.13 1.13 0 00-.84.326c-.223.22-.332.499-.332.838 0 .362.108.658.328.88.22.223.505.336.861.336.103 0 .22-.016.346-.052v-.54c-.117.034-.216.051-.303.051a.545.545 0 01-.422-.177c-.106-.12-.16-.278-.16-.48 0-.19.053-.348.156-.468a.498.498 0 01.397-.181c.103 0 .212.015.332.049v-.537a1.394 1.394 0 00-.363-.045zm12.414 0a1.135 1.135 0 00-.84.326c-.223.22-.332.499-.332.838 0 .362.108.658.328.88.22.223.506.336.861.336.103 0 .22-.016.346-.052v-.54c-.116.034-.216.051-.303.051a.545.545 0 01-.422-.177c-.106-.12-.16-.278-.16-.48 0-.19.053-.348.156-.468a.498.498 0 01.397-.181c.103 0 .212.015.332.049v-.537a1.394 1.394 0 00-.363-.045zm-9.598.06l-.29 2.264h.579l.156-1.559.395 1.559h.412l.379-1.555.164 1.555h.603l-.304-2.264h-.791l-.12.508c-.03.13-.06.264-.087.4l-.067.352a29.97 29.97 0 00-.258-1.26h-.771zm2.768 0l-.29 2.264h.579l.156-1.559.396 1.559h.412l.375-1.555.165 1.555h.603l-.305-2.264h-.789l-.119.508c-.03.13-.06.264-.086.4l-.066.352c-.063-.352-.15-.771-.26-1.26h-.771zm3.988 0v2.264h.611v-1.031h.012l.494 1.03h.645l-.489-1.019a.61.61 0 00.37-.552.598.598 0 00-.25-.506c-.167-.123-.394-.186-.68-.186h-.713zm3.377 0v2.264H24v-.483h-.63v-.414h.54v-.468h-.54v-.416h.626v-.483H22.76zm-4.793.004v2.264h1.24v-.483h-.627v-.416h.541v-.468h-.54v-.415h.622v-.482h-1.236zm2.025.432c.146.003.25.025.313.072.063.046.091.12.091.227 0 .156-.135.236-.404.24v-.54zm-15.22.011c-.104 0-.205.069-.301.211a1.078 1.078 0 00-.2.639c0 .096.02.2.06.303.049.13.117.198.196.215.083.016.173-.02.27-.106.123-.11.205-.273.252-.492.016-.077.023-.16.023-.246 0-.097-.02-.2-.06-.303-.05-.13-.116-.198-.196-.215a.246.246 0 00-.045-.006zm2.083 0c-.103 0-.204.069-.3.211a1.078 1.078 0 00-.2.639c0 .096.02.2.06.303.049.13.117.198.196.215.083.016.173-.02.27-.106.123-.11.205-.273.252-.492.013-.077.023-.16.023-.246 0-.097-.02-.2-.06-.303-.05-.13-.116-.198-.196-.215a.246.246 0 00-.045-.006zm4.428.006c.233 0 .354.218.354.66-.004.273-.038.46-.098.553a.293.293 0 01-.262.139.266.266 0 01-.242-.139c-.056-.093-.084-.28-.084-.562 0-.436.11-.65.332-.65Z"/></svg>`;

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
