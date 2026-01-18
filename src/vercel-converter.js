/**
 * Lightweight Converter for Vercel Serverless
 * Generates HTML files in memory without filesystem dependencies
 */

const Handlebars = require('handlebars');
const { minify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJS } = require('terser');

class LightweightConverter {
    constructor(options = {}) {
        this.options = {
            siteName: options.siteName || 'My Store',
            currency: options.currency || '$',
            minify: options.minify !== false,
            ...options
        };
        this.setupTemplates();
    }

    setupTemplates() {
        // Register Handlebars helpers
        Handlebars.registerHelper('formatPrice', (price) => {
            return this.options.currency + parseFloat(price || 0).toFixed(2);
        });

        Handlebars.registerHelper('truncate', (str, len) => {
            if (!str) return '';
            return str.length > len ? str.substring(0, len) + '...' : str;
        });

        Handlebars.registerHelper('json', (obj) => {
            return JSON.stringify(obj);
        });
    }

    // Normalize product to handle both camelCase and snake_case
    normalizeProduct(p) {
        return {
            id: p.id,
            name: p.name,
            slug: p.slug || this.slugify(p.name),
            description: p.description || '',
            shortDescription: p.shortDescription || p.short_description || '',
            price: p.price || '0',
            regularPrice: p.regularPrice || p.regular_price || p.price || '0',
            salePrice: p.salePrice || p.sale_price || '',
            images: p.images || [],
            categories: p.categories || []
        };
    }

    async convert(products, progressCallback) {
        const files = {};

        // Normalize all products first
        const normalizedProducts = products.map(p => this.normalizeProduct(p));

        // Generate CSS
        progressCallback && progressCallback(45, 'Generating styles');
        files['css/styles.css'] = await this.generateCSS();

        // Generate JavaScript
        progressCallback && progressCallback(50, 'Generating scripts');
        files['js/app.js'] = await this.generateJS();

        // Generate product pages
        const total = normalizedProducts.length;
        for (let i = 0; i < normalizedProducts.length; i++) {
            const product = normalizedProducts[i];
            const progress = 50 + Math.floor((i / total) * 30);
            progressCallback && progressCallback(progress, `Generating product ${i + 1}/${total}`);

            const slug = product.slug;
            files[`products/${slug}.html`] = await this.generateProductPage(product);
        }

        // Generate index/catalog page
        progressCallback && progressCallback(85, 'Generating catalog');
        files['index.html'] = await this.generateCatalogPage(normalizedProducts);

        // Generate category pages
        progressCallback && progressCallback(90, 'Generating categories');
        const categories = this.extractCategories(normalizedProducts);
        for (const category of categories) {
            const categoryProducts = normalizedProducts.filter(p =>
                p.categories && p.categories.some(c => c.name === category.name)
            );
            const slug = this.slugify(category.name);
            files[`categories/${slug}.html`] = await this.generateCategoryPage(category, categoryProducts);
        }

        return files;
    }

    async generateCSS() {
        const css = `
            :root {
                --primary: #2563eb;
                --primary-dark: #1d4ed8;
                --text: #1a1a1a;
                --text-muted: #6b7280;
                --bg: #ffffff;
                --bg-alt: #f9fafb;
                --border: #e5e7eb;
                --success: #10b981;
                --error: #ef4444;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: var(--text);
                background: var(--bg);
            }

            .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }

            /* Header */
            header {
                background: var(--bg);
                border-bottom: 1px solid var(--border);
                padding: 16px 0;
                position: sticky;
                top: 0;
                z-index: 100;
            }

            header .container {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .logo { font-size: 24px; font-weight: 700; color: var(--primary); text-decoration: none; }

            nav a {
                margin-left: 24px;
                color: var(--text);
                text-decoration: none;
                transition: color 0.2s;
            }

            nav a:hover { color: var(--primary); }

            /* Product Grid */
            .products-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 24px;
                padding: 40px 0;
            }

            .product-card {
                background: var(--bg);
                border: 1px solid var(--border);
                border-radius: 12px;
                overflow: hidden;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .product-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 24px rgba(0,0,0,0.1);
            }

            .product-card img {
                width: 100%;
                height: 200px;
                object-fit: cover;
            }

            .product-card-body { padding: 16px; }
            .product-card h3 { font-size: 16px; margin-bottom: 8px; }
            .product-card .price { font-size: 18px; font-weight: 700; color: var(--primary); }
            .product-card .price del { color: var(--text-muted); font-weight: 400; margin-right: 8px; }

            /* Product Detail */
            .product-detail {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 48px;
                padding: 48px 0;
            }

            .product-gallery img {
                width: 100%;
                border-radius: 12px;
            }

            .product-info h1 { font-size: 32px; margin-bottom: 16px; }
            .product-info .price { font-size: 28px; font-weight: 700; color: var(--primary); margin-bottom: 24px; }
            .product-info .description { color: var(--text-muted); margin-bottom: 24px; }

            .btn {
                display: inline-block;
                padding: 14px 28px;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                text-decoration: none;
                transition: background 0.2s;
            }

            .btn:hover { background: var(--primary-dark); }

            /* Footer */
            footer {
                background: var(--bg-alt);
                border-top: 1px solid var(--border);
                padding: 40px 0;
                margin-top: 60px;
                text-align: center;
                color: var(--text-muted);
            }

            /* Hero */
            .hero {
                background: linear-gradient(135deg, var(--primary), var(--primary-dark));
                color: white;
                padding: 80px 0;
                text-align: center;
            }

            .hero h1 { font-size: 48px; margin-bottom: 16px; }
            .hero p { font-size: 20px; opacity: 0.9; }

            /* Responsive */
            @media (max-width: 768px) {
                .product-detail { grid-template-columns: 1fr; gap: 24px; }
                .hero h1 { font-size: 32px; }
                .product-info h1 { font-size: 24px; }
            }
        `;

        if (this.options.minify) {
            return new CleanCSS({ level: 2 }).minify(css).styles;
        }
        return css;
    }

    async generateJS() {
        const js = `
            // Store functionality
            (function() {
                'use strict';

                // Cart functionality
                const Cart = {
                    items: JSON.parse(localStorage.getItem('cart') || '[]'),

                    add(product) {
                        const existing = this.items.find(i => i.id === product.id);
                        if (existing) {
                            existing.quantity++;
                        } else {
                            this.items.push({ ...product, quantity: 1 });
                        }
                        this.save();
                        this.updateUI();
                    },

                    remove(productId) {
                        this.items = this.items.filter(i => i.id !== productId);
                        this.save();
                        this.updateUI();
                    },

                    save() {
                        localStorage.setItem('cart', JSON.stringify(this.items));
                    },

                    getTotal() {
                        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    },

                    updateUI() {
                        const badge = document.getElementById('cart-count');
                        if (badge) {
                            badge.textContent = this.items.reduce((sum, i) => sum + i.quantity, 0);
                        }
                    }
                };

                // Initialize
                Cart.updateUI();

                // Add to cart buttons
                document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const product = JSON.parse(btn.dataset.product);
                        Cart.add(product);
                        btn.textContent = 'Added!';
                        setTimeout(() => { btn.textContent = 'Add to Cart'; }, 1500);
                    });
                });

                window.Cart = Cart;
            })();
        `;

        if (this.options.minify) {
            const result = await minifyJS(js);
            return result.code;
        }
        return js;
    }

    async generateProductPage(product) {
        const displayPrice = product.salePrice || product.price || product.regularPrice || '0.00';
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(product.name)} | ${this.escapeHtml(this.options.siteName)}</title>
    <meta name="description" content="${this.escapeHtml(this.stripHtml(product.shortDescription || product.description || '').substring(0, 160))}">
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    <header>
        <div class="container">
            <a href="../index.html" class="logo">${this.escapeHtml(this.options.siteName)}</a>
            <nav>
                <a href="../index.html">Shop</a>
                <a href="#">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <main class="container">
        <div class="product-detail">
            <div class="product-gallery">
                <img src="${product.images && product.images[0] ? product.images[0].src : 'https://via.placeholder.com/600x600'}"
                     alt="${this.escapeHtml(product.name)}"
                     loading="lazy">
            </div>
            <div class="product-info">
                <h1>${this.escapeHtml(product.name)}</h1>
                <div class="price">
                    ${product.salePrice ? `<del>${this.options.currency}${product.regularPrice}</del>` : ''}
                    ${this.options.currency}${displayPrice}
                </div>
                <div class="description">
                    ${product.description || product.shortDescription || 'No description available.'}
                </div>
                <button class="btn" data-add-to-cart data-product='${JSON.stringify({
                    id: product.id,
                    name: product.name,
                    price: parseFloat(displayPrice),
                    image: product.images && product.images[0] ? product.images[0].src : ''
                }).replace(/'/g, "&#39;")}'>
                    Add to Cart
                </button>
            </div>
        </div>
    </main>

    <footer>
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(this.options.siteName)}. All rights reserved.</p>
        </div>
    </footer>

    <script src="../js/app.js"></script>
</body>
</html>`;

        if (this.options.minify) {
            return await minify(html, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true
            });
        }
        return html;
    }

    async generateCatalogPage(products) {
        const productCards = products.map(product => {
            const displayPrice = product.salePrice || product.price || product.regularPrice || '0.00';
            return `
            <a href="products/${product.slug}.html" class="product-card">
                <img src="${product.images && product.images[0] ? product.images[0].src : 'https://via.placeholder.com/300x200'}"
                     alt="${this.escapeHtml(product.name)}"
                     loading="lazy">
                <div class="product-card-body">
                    <h3>${this.escapeHtml(product.name)}</h3>
                    <div class="price">
                        ${product.salePrice ? `<del>${this.options.currency}${product.regularPrice}</del>` : ''}
                        ${this.options.currency}${displayPrice}
                    </div>
                </div>
            </a>
        `;
        }).join('');

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(this.options.siteName)} | Shop</title>
    <meta name="description" content="Browse our collection of ${products.length} products">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header>
        <div class="container">
            <a href="index.html" class="logo">${this.escapeHtml(this.options.siteName)}</a>
            <nav>
                <a href="index.html">Shop</a>
                <a href="#">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <section class="hero">
        <div class="container">
            <h1>Welcome to ${this.escapeHtml(this.options.siteName)}</h1>
            <p>Discover our collection of ${products.length} amazing products</p>
        </div>
    </section>

    <main class="container">
        <div class="products-grid">
            ${productCards}
        </div>
    </main>

    <footer>
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(this.options.siteName)}. All rights reserved.</p>
        </div>
    </footer>

    <script src="js/app.js"></script>
</body>
</html>`;

        if (this.options.minify) {
            return await minify(html, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true
            });
        }
        return html;
    }

    async generateCategoryPage(category, products) {
        const productCards = products.map(product => {
            const displayPrice = product.salePrice || product.price || product.regularPrice || '0.00';
            return `
            <a href="../products/${product.slug}.html" class="product-card">
                <img src="${product.images && product.images[0] ? product.images[0].src : 'https://via.placeholder.com/300x200'}"
                     alt="${this.escapeHtml(product.name)}"
                     loading="lazy">
                <div class="product-card-body">
                    <h3>${this.escapeHtml(product.name)}</h3>
                    <div class="price">
                        ${product.salePrice ? `<del>${this.options.currency}${product.regularPrice}</del>` : ''}
                        ${this.options.currency}${displayPrice}
                    </div>
                </div>
            </a>
        `;
        }).join('');

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(category.name)} | ${this.escapeHtml(this.options.siteName)}</title>
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    <header>
        <div class="container">
            <a href="../index.html" class="logo">${this.escapeHtml(this.options.siteName)}</a>
            <nav>
                <a href="../index.html">Shop</a>
                <a href="#">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <section class="hero">
        <div class="container">
            <h1>${this.escapeHtml(category.name)}</h1>
            <p>${products.length} products</p>
        </div>
    </section>

    <main class="container">
        <div class="products-grid">
            ${productCards}
        </div>
    </main>

    <footer>
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(this.options.siteName)}. All rights reserved.</p>
        </div>
    </footer>

    <script src="../js/app.js"></script>
</body>
</html>`;

        if (this.options.minify) {
            return await minify(html, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true
            });
        }
        return html;
    }

    extractCategories(products) {
        const categoriesMap = new Map();
        for (const product of products) {
            if (product.categories) {
                for (const cat of product.categories) {
                    if (!categoriesMap.has(cat.id)) {
                        categoriesMap.set(cat.id, cat);
                    }
                }
            }
        }
        return Array.from(categoriesMap.values());
    }

    slugify(text) {
        return (text || 'product')
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    }

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '');
    }
}

module.exports = LightweightConverter;
