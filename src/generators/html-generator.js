/**
 * HTML5 Store Generator
 * Generates static HTML5 pages from WooCommerce export data
 */

const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

class HtmlGenerator {
    constructor(options = {}) {
        this.options = {
            templatesDir: options.templatesDir || path.join(__dirname, '../../templates'),
            outputDir: options.outputDir || path.join(__dirname, '../../output'),
            siteName: options.siteName || 'My Store',
            siteDescription: options.siteDescription || 'Your Online Store',
            currency: options.currency || 'USD',
            currencySymbol: options.currencySymbol || '$',
            productsPerPage: options.productsPerPage || 12,
            enableSearch: options.enableSearch !== false,
            enableFiltering: options.enableFiltering !== false,
            enableCart: options.enableCart !== false,
            enableWishlist: options.enableWishlist || false,
            enableReviews: options.enableReviews !== false,
            theme: options.theme || 'default',
            primaryColor: options.primaryColor || '#2563eb',
            ...options
        };

        this.storeData = null;
        this.templates = {};

        this.registerHelpers();
    }

    /**
     * Register Handlebars helpers
     */
    registerHelpers() {
        // Format price
        Handlebars.registerHelper('formatPrice', (price) => {
            if (!price) return this.options.currencySymbol + '0.00';
            const num = parseFloat(price);
            return this.options.currencySymbol + num.toFixed(2);
        });

        // Format date
        Handlebars.registerHelper('formatDate', (date) => {
            return new Date(date).toLocaleDateString();
        });

        // Truncate text
        Handlebars.registerHelper('truncate', (text, length) => {
            if (!text) return '';
            const stripped = text.replace(/<[^>]*>/g, '');
            if (stripped.length <= length) return stripped;
            return stripped.substring(0, length) + '...';
        });

        // Generate slug
        Handlebars.registerHelper('slug', (text) => {
            if (!text) return '';
            return text.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        });

        // Check equality
        Handlebars.registerHelper('eq', (a, b) => a === b);

        // Check if in stock
        Handlebars.registerHelper('inStock', (status) => {
            return status === 'instock' || status === true;
        });

        // Generate star rating HTML
        Handlebars.registerHelper('starRating', (rating) => {
            const fullStars = Math.floor(rating);
            const halfStar = rating % 1 >= 0.5;
            const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

            let html = '';
            for (let i = 0; i < fullStars; i++) html += '<span class="star full">★</span>';
            if (halfStar) html += '<span class="star half">★</span>';
            for (let i = 0; i < emptyStars; i++) html += '<span class="star empty">☆</span>';

            return new Handlebars.SafeString(html);
        });

        // JSON stringify for data attributes
        Handlebars.registerHelper('json', (obj) => {
            return JSON.stringify(obj);
        });

        // Loop helper with index
        Handlebars.registerHelper('times', (n, block) => {
            let result = '';
            for (let i = 0; i < n; i++) {
                result += block.fn({ index: i });
            }
            return result;
        });

        // Math operations
        Handlebars.registerHelper('add', (a, b) => a + b);
        Handlebars.registerHelper('subtract', (a, b) => a - b);
        Handlebars.registerHelper('multiply', (a, b) => a * b);
        Handlebars.registerHelper('divide', (a, b) => b !== 0 ? a / b : 0);

        // Array includes
        Handlebars.registerHelper('includes', (arr, value) => {
            return Array.isArray(arr) && arr.includes(value);
        });

        // Get image URL with fallback
        Handlebars.registerHelper('imageUrl', (image, size = 'medium') => {
            if (!image) return 'assets/images/placeholder.jpg';
            if (typeof image === 'string') return image;

            // Check for responsive sizes
            const baseName = path.basename(image.src || '', path.extname(image.src || ''));
            const ext = path.extname(image.src || '');

            if (size === 'thumbnail' && image.src) {
                return image.src.replace(ext, `-thumb${ext}`);
            }
            if (size === 'medium' && image.src) {
                return image.src.replace(ext, `-medium${ext}`);
            }

            return image.src || 'assets/images/placeholder.jpg';
        });

        // Safe HTML
        Handlebars.registerHelper('safeHtml', (html) => {
            return new Handlebars.SafeString(sanitizeHtml(html, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'picture', 'source']),
                allowedAttributes: {
                    ...sanitizeHtml.defaults.allowedAttributes,
                    img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'decoding', 'class'],
                    source: ['srcset', 'type', 'media']
                }
            }));
        });

        // Markdown to HTML
        Handlebars.registerHelper('markdown', (text) => {
            if (!text) return '';
            return new Handlebars.SafeString(marked(text));
        });
    }

    /**
     * Load and compile templates
     */
    async loadTemplates() {
        const templateFiles = [
            'layouts/base.hbs',
            'pages/home.hbs',
            'pages/product.hbs',
            'pages/category.hbs',
            'pages/cart.hbs',
            'pages/checkout.hbs',
            'pages/search.hbs',
            'pages/about.hbs',
            'pages/contact.hbs',
            'pages/404.hbs',
            'partials/header.hbs',
            'partials/footer.hbs',
            'partials/product-card.hbs',
            'partials/product-grid.hbs',
            'partials/breadcrumb.hbs',
            'partials/pagination.hbs',
            'partials/sidebar.hbs',
            'partials/cart-sidebar.hbs',
            'partials/search-modal.hbs'
        ];

        for (const file of templateFiles) {
            const templatePath = path.join(this.options.templatesDir, file);
            if (await fs.pathExists(templatePath)) {
                const content = await fs.readFile(templatePath, 'utf8');
                const name = file.replace('.hbs', '').replace(/\//g, '-');

                if (file.startsWith('partials/')) {
                    Handlebars.registerPartial(name, content);
                }

                this.templates[name] = Handlebars.compile(content);
            }
        }

        return this.templates;
    }

    /**
     * Set store data from WooCommerce export
     */
    setStoreData(data) {
        this.storeData = data;

        // Build category tree
        this.categoryTree = this.buildCategoryTree(data.categories);

        // Build product lookup maps
        this.productsByCategory = new Map();
        this.productsByTag = new Map();

        for (const product of data.products) {
            // By category
            for (const cat of product.categories || []) {
                if (!this.productsByCategory.has(cat.id)) {
                    this.productsByCategory.set(cat.id, []);
                }
                this.productsByCategory.get(cat.id).push(product);
            }

            // By tag
            for (const tag of product.tags || []) {
                if (!this.productsByTag.has(tag.id)) {
                    this.productsByTag.set(tag.id, []);
                }
                this.productsByTag.get(tag.id).push(product);
            }
        }
    }

    /**
     * Build hierarchical category tree
     */
    buildCategoryTree(categories) {
        const tree = [];
        const categoryMap = new Map(categories.map(c => [c.id, { ...c, children: [] }]));

        for (const [id, category] of categoryMap) {
            if (category.parent === 0) {
                tree.push(category);
            } else {
                const parent = categoryMap.get(category.parent);
                if (parent) {
                    parent.children.push(category);
                }
            }
        }

        return tree;
    }

    /**
     * Get common template context
     */
    getCommonContext() {
        return {
            siteName: this.options.siteName,
            siteDescription: this.options.siteDescription,
            currency: this.options.currency,
            currencySymbol: this.options.currencySymbol,
            categories: this.categoryTree,
            allCategories: this.storeData?.categories || [],
            enableSearch: this.options.enableSearch,
            enableCart: this.options.enableCart,
            enableWishlist: this.options.enableWishlist,
            theme: this.options.theme,
            primaryColor: this.options.primaryColor,
            year: new Date().getFullYear()
        };
    }

    /**
     * Generate home page
     */
    async generateHomePage() {
        const featuredProducts = this.storeData.products
            .filter(p => p.featured)
            .slice(0, 8);

        const newProducts = this.storeData.products
            .sort((a, b) => new Date(b.date_created) - new Date(a.date_created))
            .slice(0, 8);

        const onSaleProducts = this.storeData.products
            .filter(p => p.on_sale)
            .slice(0, 8);

        const topCategories = this.storeData.categories
            .filter(c => c.parent === 0)
            .slice(0, 6);

        const context = {
            ...this.getCommonContext(),
            pageTitle: 'Home',
            featuredProducts,
            newProducts,
            onSaleProducts,
            topCategories,
            heroTitle: `Welcome to ${this.options.siteName}`,
            heroSubtitle: this.options.siteDescription
        };

        const html = this.templates['pages-home'](context);
        await this.writePage('index.html', html);

        return 'index.html';
    }

    /**
     * Generate all product pages
     */
    async generateProductPages(progressCallback) {
        const pages = [];

        for (let i = 0; i < this.storeData.products.length; i++) {
            const product = this.storeData.products[i];
            progressCallback?.(`Generating product page ${i + 1}/${this.storeData.products.length}`);

            const relatedProducts = this.storeData.products
                .filter(p => p.id !== product.id &&
                    p.categories?.some(c => product.categories?.some(pc => pc.id === c.id)))
                .slice(0, 4);

            const context = {
                ...this.getCommonContext(),
                pageTitle: product.name,
                product,
                relatedProducts,
                breadcrumbs: this.generateBreadcrumbs(product),
                hasVariations: product.type === 'variable' && product.variationDetails?.length > 0,
                variations: product.variationDetails || [],
                gallery: product.images || [],
                metaDescription: this.truncateText(product.short_description || product.description, 160)
            };

            const html = this.templates['pages-product'](context);
            const filename = `product/${this.slugify(product.name)}-${product.id}.html`;
            await this.writePage(filename, html);
            pages.push(filename);
        }

        return pages;
    }

    /**
     * Generate category pages with pagination
     */
    async generateCategoryPages(progressCallback) {
        const pages = [];

        for (let i = 0; i < this.storeData.categories.length; i++) {
            const category = this.storeData.categories[i];
            progressCallback?.(`Generating category page ${i + 1}/${this.storeData.categories.length}`);

            const products = this.productsByCategory.get(category.id) || [];
            const totalPages = Math.ceil(products.length / this.options.productsPerPage);

            for (let page = 1; page <= Math.max(1, totalPages); page++) {
                const startIdx = (page - 1) * this.options.productsPerPage;
                const pageProducts = products.slice(startIdx, startIdx + this.options.productsPerPage);

                const context = {
                    ...this.getCommonContext(),
                    pageTitle: category.name,
                    category,
                    products: pageProducts,
                    totalProducts: products.length,
                    currentPage: page,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                    nextPageUrl: page < totalPages ? `category/${this.slugify(category.name)}-${category.id}-page-${page + 1}.html` : null,
                    prevPageUrl: page > 1 ? `category/${this.slugify(category.name)}-${category.id}${page > 2 ? `-page-${page - 1}` : ''}.html` : null,
                    breadcrumbs: [
                        { name: 'Home', url: 'index.html' },
                        { name: category.name, url: null }
                    ],
                    subcategories: this.storeData.categories.filter(c => c.parent === category.id)
                };

                const html = this.templates['pages-category'](context);
                const filename = page === 1
                    ? `category/${this.slugify(category.name)}-${category.id}.html`
                    : `category/${this.slugify(category.name)}-${category.id}-page-${page}.html`;

                await this.writePage(filename, html);
                pages.push(filename);
            }
        }

        // Generate all products page
        const allProductsPages = Math.ceil(this.storeData.products.length / this.options.productsPerPage);
        for (let page = 1; page <= Math.max(1, allProductsPages); page++) {
            const startIdx = (page - 1) * this.options.productsPerPage;
            const pageProducts = this.storeData.products.slice(startIdx, startIdx + this.options.productsPerPage);

            const context = {
                ...this.getCommonContext(),
                pageTitle: 'All Products',
                category: { name: 'All Products', description: 'Browse all our products' },
                products: pageProducts,
                totalProducts: this.storeData.products.length,
                currentPage: page,
                totalPages: allProductsPages,
                hasNextPage: page < allProductsPages,
                hasPrevPage: page > 1,
                nextPageUrl: page < allProductsPages ? `products${page > 0 ? `-page-${page + 1}` : ''}.html` : null,
                prevPageUrl: page > 1 ? `products${page > 2 ? `-page-${page - 1}` : ''}.html` : null,
                breadcrumbs: [
                    { name: 'Home', url: 'index.html' },
                    { name: 'Products', url: null }
                ]
            };

            const html = this.templates['pages-category'](context);
            const filename = page === 1 ? 'products.html' : `products-page-${page}.html`;
            await this.writePage(filename, html);
            pages.push(filename);
        }

        return pages;
    }

    /**
     * Generate static pages (cart, checkout, etc.)
     */
    async generateStaticPages() {
        const pages = [];

        // Cart page
        const cartContext = {
            ...this.getCommonContext(),
            pageTitle: 'Shopping Cart',
            breadcrumbs: [
                { name: 'Home', url: 'index.html' },
                { name: 'Cart', url: null }
            ]
        };
        await this.writePage('cart.html', this.templates['pages-cart'](cartContext));
        pages.push('cart.html');

        // Checkout page
        const checkoutContext = {
            ...this.getCommonContext(),
            pageTitle: 'Checkout',
            shipping: this.storeData.shipping || [],
            paymentGateways: this.storeData.paymentGateways || [],
            breadcrumbs: [
                { name: 'Home', url: 'index.html' },
                { name: 'Cart', url: 'cart.html' },
                { name: 'Checkout', url: null }
            ]
        };
        await this.writePage('checkout.html', this.templates['pages-checkout'](checkoutContext));
        pages.push('checkout.html');

        // Search page
        const searchContext = {
            ...this.getCommonContext(),
            pageTitle: 'Search',
            breadcrumbs: [
                { name: 'Home', url: 'index.html' },
                { name: 'Search', url: null }
            ]
        };
        await this.writePage('search.html', this.templates['pages-search'](searchContext));
        pages.push('search.html');

        // 404 page
        const notFoundContext = {
            ...this.getCommonContext(),
            pageTitle: 'Page Not Found'
        };
        await this.writePage('404.html', this.templates['pages-404'](notFoundContext));
        pages.push('404.html');

        return pages;
    }

    /**
     * Generate search index for client-side search
     */
    async generateSearchIndex() {
        const searchIndex = this.storeData.products.map(p => ({
            id: p.id,
            name: p.name,
            slug: this.slugify(p.name),
            sku: p.sku || '',
            price: p.price,
            salePrice: p.sale_price,
            categories: (p.categories || []).map(c => c.name).join(' '),
            tags: (p.tags || []).map(t => t.name).join(' '),
            description: this.truncateText(p.short_description || p.description || '', 200),
            image: p.images?.[0]?.src || null,
            url: `product/${this.slugify(p.name)}-${p.id}.html`,
            inStock: p.stock_status === 'instock'
        }));

        const indexPath = path.join(this.options.outputDir, 'assets/data/search-index.json');
        await fs.ensureDir(path.dirname(indexPath));
        await fs.writeJson(indexPath, searchIndex);

        return searchIndex;
    }

    /**
     * Generate sitemap.xml
     */
    async generateSitemap(baseUrl) {
        const urls = [
            { loc: baseUrl, priority: '1.0', changefreq: 'daily' },
            { loc: `${baseUrl}/products.html`, priority: '0.9', changefreq: 'daily' }
        ];

        // Add product pages
        for (const product of this.storeData.products) {
            urls.push({
                loc: `${baseUrl}/product/${this.slugify(product.name)}-${product.id}.html`,
                priority: '0.8',
                changefreq: 'weekly',
                lastmod: product.date_modified
            });
        }

        // Add category pages
        for (const category of this.storeData.categories) {
            urls.push({
                loc: `${baseUrl}/category/${this.slugify(category.name)}-${category.id}.html`,
                priority: '0.7',
                changefreq: 'weekly'
            });
        }

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <priority>${url.priority}</priority>
    <changefreq>${url.changefreq}</changefreq>
    ${url.lastmod ? `<lastmod>${new Date(url.lastmod).toISOString().split('T')[0]}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

        await this.writePage('sitemap.xml', sitemap);
        return sitemap;
    }

    /**
     * Generate robots.txt
     */
    async generateRobotsTxt(baseUrl) {
        const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;

        await this.writePage('robots.txt', robots);
        return robots;
    }

    /**
     * Write page to output directory
     */
    async writePage(filename, content) {
        const outputPath = path.join(this.options.outputDir, filename);
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, content);
        return outputPath;
    }

    /**
     * Generate breadcrumbs for a product
     */
    generateBreadcrumbs(product) {
        const crumbs = [{ name: 'Home', url: 'index.html' }];

        if (product.categories?.length > 0) {
            const cat = product.categories[0];
            crumbs.push({
                name: cat.name,
                url: `category/${this.slugify(cat.name)}-${cat.id}.html`
            });
        }

        crumbs.push({ name: product.name, url: null });
        return crumbs;
    }

    /**
     * Helper: Create URL-friendly slug
     */
    slugify(text) {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    /**
     * Helper: Truncate text
     */
    truncateText(text, length) {
        if (!text) return '';
        const stripped = text.replace(/<[^>]*>/g, '');
        if (stripped.length <= length) return stripped;
        return stripped.substring(0, length).trim() + '...';
    }
}

module.exports = HtmlGenerator;
