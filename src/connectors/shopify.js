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
    static icon = `<svg viewBox="0 0 24 24" fill="#96bf48"><path d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.756c-.022-.142-.153-.236-.295-.236-.143 0-2.07-.044-2.07-.044s-1.362-1.319-1.531-1.488c-.047-.044-.098-.066-.151-.076l-.569 17.161zm-2.615-17.82c-.066-.023-1.277-.37-1.277-.37s-.887-3.104-1.086-3.663c-.199-.559-.666-.514-.666-.514s-.892-.022-1.563.044c.077.23.177.517.277.858.188.642.397 1.382.397 1.382s-1.22.374-1.22.374c-.022.01-1.81.555-1.81.555l1.399 9.433 2.07.666s-.022-.656-.022-.656c0-.623.044-1.544.177-2.333.133-.79.354-1.456.665-2.001.31-.546.731-.968 1.241-1.258.51-.29 1.108-.435 1.772-.435.543 0 .996.113 1.351.335.354.223.618.535.79.935.172.4.258.867.258 1.4 0 .334-.034.658-.103.969-.07.31-.178.6-.326.868-.149.268-.343.502-.583.701-.24.199-.52.35-.84.455.25.078.475.196.673.356.199.16.366.358.502.594.136.236.241.506.314.81.073.303.11.63.11.98 0 .511-.088.99-.264 1.436-.176.447-.435.839-.777 1.177-.342.339-.766.606-1.27.802-.505.196-1.087.294-1.746.294-.513 0-.983-.057-1.409-.17-.427-.114-.8-.285-1.12-.514-.32-.23-.58-.514-.778-.854-.199-.34-.324-.733-.375-1.18l1.763-.27c.04.286.118.53.233.734.115.204.263.37.444.497.181.127.393.22.635.277.241.058.508.087.8.087.316 0 .59-.044.824-.13.234-.087.428-.207.582-.36.153-.153.269-.335.346-.546.077-.21.116-.44.116-.688 0-.27-.038-.508-.113-.712-.075-.204-.185-.375-.33-.513-.145-.138-.327-.243-.546-.314-.219-.07-.472-.106-.76-.106h-.64v-1.39h.56c.265 0 .495-.032.69-.096.196-.064.358-.156.487-.277.128-.12.224-.268.287-.444.063-.176.095-.375.095-.598 0-.421-.113-.749-.338-.984-.226-.235-.55-.353-.973-.353-.297 0-.556.052-.778.155-.222.103-.408.245-.558.426-.15.18-.263.393-.34.637-.077.243-.116.506-.116.787l-1.742.138c.033-.467.127-.892.282-1.275.154-.384.37-.713.647-.987.277-.275.613-.487 1.008-.637.395-.15.847-.225 1.357-.225.422 0 .81.054 1.162.162.353.108.658.268.915.48.257.212.458.474.602.787.145.312.217.67.217 1.073 0 .416-.083.79-.248 1.123-.165.333-.423.604-.773.812z"/></svg>`;

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
