/**
 * Shopify Platform Connector
 * Connects to Shopify Storefront/Admin API to export store data
 *
 * NOTE: This is a stub implementation. Full implementation requires:
 * - Shopify Admin API access token
 * - Proper OAuth flow for app installation
 */

const BasePlatformConnector = require('./base-connector');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class ShopifyConnector extends BasePlatformConnector {
    static platform = 'shopify';
    static displayName = 'Shopify';
    static icon = `<svg viewBox="0 0 109 124" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M95.8 23.4c-.1-.6-.6-1-1.1-1-.5 0-9.3-.2-9.3-.2s-6.2-6-6.9-6.7c-.7-.7-2-.5-2.5-.3 0 0-1.3.4-3.5 1.1-2.1-6-5.7-11.5-12.1-11.5h-.6C57.7 2.1 55.3.8 53.3.8 36.5.8 28.5 21.5 26 32.3c-6.5 2-11.1 3.4-11.7 3.6-3.6 1.1-3.7 1.2-4.2 4.6-.4 2.6-9.8 75.3-9.8 75.3l73.6 13.8 39.8-8.6S96 24 95.8 23.4zM67.5 18.2c-1.7.5-3.6 1.1-5.7 1.8v-1.3c0-3.9-.5-7-1.5-9.4 3.7.5 6.2 4.7 7.2 8.9zm-12.3-8c1.1 2.3 1.8 5.6 1.8 10.1v.7c-3.7 1.2-7.8 2.4-11.8 3.7 2.3-8.8 6.6-13.1 10-14.5zm-5.1-5c.7 0 1.3.2 1.9.7-4.8 2.2-9.9 7.9-12.1 19.2-3.2 1-6.4 2-9.3 2.9C33.5 18.1 40.1 5.2 50.1 5.2z" fill="#95BF47"/><path d="M94.7 22.4c-.5 0-9.3-.2-9.3-.2s-6.2-6-6.9-6.7c-.3-.3-.6-.4-.9-.4l-5.6 114.5 39.8-8.6S96 24 95.8 23.4c-.1-.6-.6-1-1.1-1z" fill="#5E8E3E"/><path d="M60.2 40.4l-4.4 13.1s-3.9-2.1-8.6-2.1c-6.9 0-7.3 4.3-7.3 5.4 0 6 15.5 8.2 15.5 22.2 0 11-6.9 18-16.3 18-11.2 0-16.9-7-16.9-7l3-9.9s5.9 5.1 10.9 5.1c3.3 0 4.6-2.6 4.6-4.5 0-7.8-12.7-8.1-12.7-20.9 0-10.7 7.7-21.1 23.3-21.1 6 0 8.9 1.7 8.9 1.7z" fill="#fff"/></svg>`;

    static credentialFields = [
        {
            name: 'shopDomain',
            label: 'Shop Domain',
            type: 'text',
            placeholder: 'your-store.myshopify.com',
            required: true
        },
        {
            name: 'accessToken',
            label: 'Admin API Access Token',
            type: 'password',
            placeholder: 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            required: true
        }
    ];

    static supportedFeatures = {
        products: true,
        categories: true,  // Collections in Shopify
        images: true,
        reviews: false,    // Requires third-party app
        variations: true,  // Variants in Shopify
        inventory: true,
        customers: false,
        orders: false
    };

    constructor(config) {
        super(config);

        if (config.shopDomain && config.accessToken) {
            this.baseUrl = `https://${config.shopDomain}/admin/api/2024-01`;
            this.headers = {
                'X-Shopify-Access-Token': config.accessToken,
                'Content-Type': 'application/json'
            };
        }
    }

    async testConnection() {
        try {
            if (!this.baseUrl || !this.headers) {
                return { success: false, error: 'API not configured' };
            }

            const response = await axios.get(`${this.baseUrl}/shop.json`, {
                headers: this.headers
            });

            const countResponse = await axios.get(`${this.baseUrl}/products/count.json`, {
                headers: this.headers
            });

            this.connected = true;
            this.storeInfo = {
                name: response.data.shop.name,
                domain: response.data.shop.domain,
                email: response.data.shop.email,
                currency: response.data.shop.currency
            };

            return {
                success: true,
                storeName: this.storeInfo.name,
                productCount: countResponse.data.count
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors || error.message
            };
        }
    }

    async getStoreInfo() {
        if (this.storeInfo) return this.storeInfo;

        try {
            const response = await axios.get(`${this.baseUrl}/shop.json`, {
                headers: this.headers
            });

            this.storeInfo = {
                name: response.data.shop.name,
                domain: response.data.shop.domain,
                email: response.data.shop.email,
                currency: response.data.shop.currency,
                timezone: response.data.shop.timezone,
                country: response.data.shop.country_name
            };

            return this.storeInfo;
        } catch (error) {
            return {
                name: 'Shopify Store',
                domain: this.config.shopDomain,
                currency: 'USD'
            };
        }
    }

    async exportProducts(progressCallback) {
        const products = [];
        let pageInfo = null;
        const limit = 250;
        let total = 0;

        // Get total count first
        try {
            const countResponse = await axios.get(`${this.baseUrl}/products/count.json`, {
                headers: this.headers
            });
            total = countResponse.data.count;
        } catch (error) {
            console.error('Failed to get product count:', error.message);
        }

        // Paginate through all products
        while (true) {
            let url = `${this.baseUrl}/products.json?limit=${limit}`;
            if (pageInfo) {
                url += `&page_info=${pageInfo}`;
            }

            const response = await axios.get(url, { headers: this.headers });

            const pageProducts = response.data.products.map(p => this.normalizeProduct(p));
            products.push(...pageProducts);

            if (progressCallback) {
                progressCallback(products.length, total);
            }

            // Check for next page
            const linkHeader = response.headers.link;
            if (linkHeader && linkHeader.includes('rel="next"')) {
                const match = linkHeader.match(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="next"/);
                pageInfo = match ? match[1] : null;
            } else {
                break;
            }

            if (!pageInfo) break;
        }

        return products;
    }

    async exportCategories() {
        // Shopify uses "collections" instead of categories
        const collections = [];

        // Get custom collections
        try {
            const customResponse = await axios.get(`${this.baseUrl}/custom_collections.json?limit=250`, {
                headers: this.headers
            });
            collections.push(...customResponse.data.custom_collections.map(c => this.normalizeCategory(c)));
        } catch (error) {
            console.error('Failed to get custom collections:', error.message);
        }

        // Get smart collections
        try {
            const smartResponse = await axios.get(`${this.baseUrl}/smart_collections.json?limit=250`, {
                headers: this.headers
            });
            collections.push(...smartResponse.data.smart_collections.map(c => this.normalizeCategory(c)));
        } catch (error) {
            console.error('Failed to get smart collections:', error.message);
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
                const ext = path.extname(new URL(image.src).pathname) || '.jpg';
                const filename = `${image.productSlug}-${image.id}${ext}`.replace(/\?.*$/, '');
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
        // Get the default/first variant for pricing
        const defaultVariant = product.variants?.[0] || {};

        return {
            id: product.id,
            name: product.title,
            slug: product.handle,
            type: product.product_type || 'simple',
            status: product.status === 'active' ? 'publish' : 'draft',
            description: product.body_html || '',
            shortDescription: product.body_html ? product.body_html.substring(0, 200) : '',
            sku: defaultVariant.sku || '',
            price: defaultVariant.price || '0',
            regularPrice: defaultVariant.compare_at_price || defaultVariant.price || '0',
            salePrice: defaultVariant.compare_at_price ? defaultVariant.price : '',
            onSale: Boolean(defaultVariant.compare_at_price && defaultVariant.compare_at_price > defaultVariant.price),
            stockStatus: defaultVariant.inventory_quantity > 0 ? 'instock' : 'outofstock',
            stockQuantity: defaultVariant.inventory_quantity,
            manageStock: defaultVariant.inventory_management === 'shopify',
            categories: [], // Requires separate collection fetch
            tags: product.tags ? product.tags.split(', ').map((t, i) => ({
                id: i,
                name: t,
                slug: this.slugify(t)
            })) : [],
            images: product.images.map((img, i) => ({
                id: img.id,
                src: img.src,
                alt: img.alt || product.title,
                position: img.position || i
            })),
            attributes: product.options.map(opt => ({
                id: opt.id,
                name: opt.name,
                options: opt.values,
                variation: true,
                visible: true
            })),
            variations: product.variants.map(v => ({
                id: v.id,
                sku: v.sku,
                price: v.price,
                regularPrice: v.compare_at_price || v.price,
                stockStatus: v.inventory_quantity > 0 ? 'instock' : 'outofstock',
                stockQuantity: v.inventory_quantity,
                attributes: [
                    v.option1 ? { name: product.options[0]?.name, option: v.option1 } : null,
                    v.option2 ? { name: product.options[1]?.name, option: v.option2 } : null,
                    v.option3 ? { name: product.options[2]?.name, option: v.option3 } : null
                ].filter(Boolean),
                image: v.image_id
            })),
            averageRating: '0',
            ratingCount: 0,
            featured: false,
            vendor: product.vendor,
            dateCreated: product.created_at,
            dateModified: product.updated_at
        };
    }

    normalizeCategory(collection) {
        return {
            id: collection.id,
            name: collection.title,
            slug: collection.handle,
            description: collection.body_html || '',
            parent: 0, // Shopify collections don't have parent hierarchy
            count: collection.products_count || 0,
            image: collection.image?.src || null
        };
    }
}

module.exports = ShopifyConnector;
