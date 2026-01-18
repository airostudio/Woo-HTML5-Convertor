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
    static icon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.337 3.415c-.042-.085-.127-.127-.212-.127-.042 0-1.058.042-1.058.042s-.722-.678-.848-.806c-.085-.127-.254-.085-.339-.085l-.467.127c-.254-.678-.678-1.312-1.44-1.312h-.085C10.633.678 10.295.38 10 .38c-1.777 0-2.625 2.2-2.89 3.32-.678.212-1.185.382-1.227.382-.382.127-.424.127-.466.509-.043.297-1.016 7.787-1.016 7.787L10.38 24l6.112-1.524s-1.1-7.405-1.143-7.745c-.042-.254-.042-.297-.042-.254 0 0 .085-.763.085-1.948 0-1.862-.127-2.54-.212-2.753-.17-.466-.594-.763-1.143-.763-.509 0-1.016.339-1.355.848-.17.254-.297.593-.34 1.016 0 .17 0 .382.044.593.084.424.296.89.678 1.27.339.339.805.55 1.312.55.212 0 .382-.042.551-.085.085.636.17 1.27.212 1.65 0 .127-.085.254-.212.297-.127.042-.678.17-1.1.17-.933 0-1.735-.509-2.158-1.312-.34-.636-.467-1.397-.34-2.2.128-.89.51-1.692 1.102-2.286.593-.636 1.355-.975 2.158-.975.763 0 1.397.424 1.65.933.297.593.254 1.355.127 2.03l.042.042c.085-.59.085-1.185-.042-1.777-.17-.763-.636-1.482-1.524-1.82.212-.763.466-1.777.466-2.413 0-.636-.212-1.143-.593-1.482z"/></svg>`;

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
