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

        // Generate cart page
        progressCallback && progressCallback(93, 'Generating cart page');
        files['cart.html'] = await this.generateCartPage();

        // Generate checkout page
        progressCallback && progressCallback(96, 'Generating checkout page');
        files['checkout.html'] = await this.generateCheckoutPage();

        // Generate order confirmation page
        progressCallback && progressCallback(96, 'Generating confirmation page');
        files['order-confirmation.html'] = await this.generateOrderConfirmationPage();

        // Generate admin dashboard
        progressCallback && progressCallback(98, 'Generating admin dashboard');
        files['admin/index.html'] = await this.generateAdminDashboard();
        files['admin/login.html'] = await this.generateAdminLogin();

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

            /* Image Gallery */
            .product-gallery { position: relative; }
            .gallery-main { margin-bottom: 16px; }
            .gallery-main img { width: 100%; border-radius: 12px; aspect-ratio: 1; object-fit: cover; }
            .gallery-thumbnails { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
            .gallery-thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid transparent; opacity: 0.6; transition: all 0.2s; }
            .gallery-thumb:hover { opacity: 1; }
            .gallery-thumb.active { border-color: var(--primary); opacity: 1; }

            .product-info h1 { font-size: 32px; margin-bottom: 16px; }
            .product-info .price { font-size: 28px; font-weight: 700; color: var(--primary); margin-bottom: 24px; }
            .product-info .description { color: var(--text-muted); margin-bottom: 24px; }

            /* Quantity Selector */
            .quantity-selector { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
            .quantity-selector label { font-weight: 500; }
            .qty-btn { width: 36px; height: 36px; border: 1px solid var(--border); background: var(--bg); border-radius: 8px; font-size: 18px; cursor: pointer; transition: all 0.2s; }
            .qty-btn:hover { background: var(--bg-alt); border-color: var(--primary); }
            .quantity-selector input { width: 60px; height: 36px; text-align: center; border: 1px solid var(--border); border-radius: 8px; font-size: 16px; }

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
            .btn-large { width: 100%; padding: 18px; font-size: 18px; }
            .btn-secondary { background: var(--bg-alt); color: var(--text); border: 1px solid var(--border); }
            .btn-secondary:hover { background: var(--border); }
            .btn-danger { background: var(--error); }
            .btn-danger:hover { background: #dc2626; }

            /* Cart Page */
            .cart-page { padding: 48px 0; }
            .cart-page h1 { font-size: 32px; margin-bottom: 32px; }
            .cart-empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
            .cart-empty h2 { margin-bottom: 16px; color: var(--text); }
            .cart-items { margin-bottom: 32px; }
            .cart-item { display: grid; grid-template-columns: 100px 1fr auto auto; gap: 20px; align-items: center; padding: 20px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 16px; }
            .cart-item img { width: 100px; height: 100px; object-fit: cover; border-radius: 8px; }
            .cart-item-info h3 { font-size: 18px; margin-bottom: 4px; }
            .cart-item-info .price { color: var(--primary); font-weight: 600; }
            .cart-item-qty { display: flex; align-items: center; gap: 8px; }
            .cart-item-qty button { width: 32px; height: 32px; border: 1px solid var(--border); background: var(--bg); border-radius: 6px; cursor: pointer; }
            .cart-item-qty span { width: 40px; text-align: center; font-weight: 500; }
            .cart-item-total { font-size: 18px; font-weight: 700; min-width: 100px; text-align: right; }
            .cart-item-remove { color: var(--error); cursor: pointer; padding: 8px; }

            /* Cart Summary */
            .cart-summary { background: var(--bg-alt); border-radius: 12px; padding: 24px; max-width: 400px; margin-left: auto; }
            .cart-summary h3 { font-size: 20px; margin-bottom: 20px; }
            .summary-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
            .summary-row:last-of-type { border-bottom: none; }
            .summary-row.total { font-size: 20px; font-weight: 700; margin-top: 12px; padding-top: 16px; border-top: 2px solid var(--border); }

            /* Checkout Page */
            .checkout-page { padding: 48px 0; }
            .checkout-grid { display: grid; grid-template-columns: 1fr 400px; gap: 48px; }
            .checkout-form h2 { font-size: 24px; margin-bottom: 24px; }
            .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .form-group { margin-bottom: 20px; }
            .form-group label { display: block; font-weight: 500; margin-bottom: 8px; }
            .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 16px; }
            .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
            #card-element { padding: 14px; border: 1px solid var(--border); border-radius: 8px; background: white; }
            .order-summary { background: var(--bg-alt); border-radius: 12px; padding: 24px; position: sticky; top: 100px; }
            .order-items { max-height: 300px; overflow-y: auto; margin-bottom: 20px; }
            .order-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
            .order-item img { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; }
            .order-item-details { flex: 1; }
            .order-item-name { font-weight: 500; }
            .order-item-qty { color: var(--text-muted); font-size: 14px; }
            .order-item-price { font-weight: 600; }

            /* Alerts */
            .alert { padding: 16px; border-radius: 8px; margin-bottom: 20px; }
            .alert-error { background: #fef2f2; color: var(--error); border: 1px solid #fecaca; }
            .alert-success { background: #f0fdf4; color: var(--success); border: 1px solid #bbf7d0; }

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
                .cart-item { grid-template-columns: 80px 1fr; }
                .cart-item-total { grid-column: 2; text-align: left; }
                .checkout-grid { grid-template-columns: 1fr; }
                .form-row { grid-template-columns: 1fr; }
            }
        `;

        if (this.options.minify) {
            return new CleanCSS({ level: 2 }).minify(css).styles;
        }
        return css;
    }

    async generateJS() {
        // Get Stripe key from options or use placeholder
        const stripeKey = this.options.stripePublishableKey || 'pk_test_REPLACE_WITH_YOUR_KEY';

        const js = `
            // Store functionality
            (function() {
                'use strict';

                const CURRENCY = '${this.options.currency || '$'}';
                const STRIPE_KEY = '${stripeKey}';
                const API_URL = window.STORE_API_URL || '';

                // Cart functionality
                const Cart = {
                    items: JSON.parse(localStorage.getItem('cart') || '[]'),

                    add(product, quantity = 1) {
                        const existing = this.items.find(i => i.id === product.id);
                        if (existing) {
                            existing.quantity += quantity;
                        } else {
                            this.items.push({ ...product, quantity });
                        }
                        this.save();
                        this.updateUI();
                        this.showNotification('Added to cart!');
                    },

                    remove(productId) {
                        this.items = this.items.filter(i => i.id !== productId);
                        this.save();
                        this.updateUI();
                        if (window.renderCartPage) window.renderCartPage();
                    },

                    updateQuantity(productId, quantity) {
                        const item = this.items.find(i => i.id === productId);
                        if (item) {
                            item.quantity = Math.max(1, quantity);
                            this.save();
                            this.updateUI();
                            if (window.renderCartPage) window.renderCartPage();
                        }
                    },

                    clear() {
                        this.items = [];
                        this.save();
                        this.updateUI();
                    },

                    save() {
                        localStorage.setItem('cart', JSON.stringify(this.items));
                    },

                    getSubtotal() {
                        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    },

                    getItemCount() {
                        return this.items.reduce((sum, i) => sum + i.quantity, 0);
                    },

                    updateUI() {
                        const badges = document.querySelectorAll('#cart-count');
                        badges.forEach(badge => {
                            badge.textContent = this.getItemCount();
                        });
                    },

                    showNotification(message) {
                        const existing = document.querySelector('.cart-notification');
                        if (existing) existing.remove();

                        const notif = document.createElement('div');
                        notif.className = 'cart-notification';
                        notif.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#10b981;color:white;padding:16px 24px;border-radius:8px;font-weight:500;z-index:9999;animation:slideIn 0.3s ease;';
                        notif.textContent = message;
                        document.body.appendChild(notif);
                        setTimeout(() => notif.remove(), 2000);
                    }
                };

                // Image Gallery
                function initGallery() {
                    const mainImage = document.getElementById('main-image');
                    const thumbs = document.querySelectorAll('.gallery-thumb');

                    thumbs.forEach(thumb => {
                        thumb.addEventListener('click', () => {
                            mainImage.src = thumb.src;
                            thumbs.forEach(t => t.classList.remove('active'));
                            thumb.classList.add('active');
                        });
                    });
                }

                // Quantity Selector
                function initQuantitySelector() {
                    document.querySelectorAll('.qty-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const input = document.getElementById('quantity');
                            if (!input) return;
                            let val = parseInt(input.value) || 1;
                            if (btn.dataset.action === 'increase') val++;
                            else if (btn.dataset.action === 'decrease' && val > 1) val--;
                            input.value = val;
                        });
                    });
                }

                // Add to cart with quantity
                function initAddToCart() {
                    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const product = JSON.parse(btn.dataset.product);
                            const qtyInput = document.getElementById('quantity');
                            const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
                            Cart.add(product, quantity);
                            btn.textContent = 'Added!';
                            setTimeout(() => { btn.textContent = 'Add to Cart'; }, 1500);
                        });
                    });
                }

                // Format price
                function formatPrice(amount) {
                    return CURRENCY + amount.toFixed(2);
                }

                // Cart Page Renderer
                window.renderCartPage = function() {
                    const container = document.getElementById('cart-container');
                    if (!container) return;

                    if (Cart.items.length === 0) {
                        container.innerHTML = '<div class="cart-empty"><h2>Your cart is empty</h2><p>Add some products to get started!</p><a href="index.html" class="btn">Continue Shopping</a></div>';
                        return;
                    }

                    const itemsHtml = Cart.items.map(item => \`
                        <div class="cart-item" data-id="\${item.id}">
                            <img src="\${item.image}" alt="\${item.name}">
                            <div class="cart-item-info">
                                <h3>\${item.name}</h3>
                                <div class="price">\${formatPrice(item.price)}</div>
                            </div>
                            <div class="cart-item-qty">
                                <button onclick="Cart.updateQuantity(\${item.id}, \${item.quantity - 1})">-</button>
                                <span>\${item.quantity}</span>
                                <button onclick="Cart.updateQuantity(\${item.id}, \${item.quantity + 1})">+</button>
                            </div>
                            <div class="cart-item-total">\${formatPrice(item.price * item.quantity)}</div>
                            <span class="cart-item-remove" onclick="Cart.remove(\${item.id})">✕</span>
                        </div>
                    \`).join('');

                    const subtotal = Cart.getSubtotal();
                    const shipping = subtotal > 50 ? 0 : 5.99;
                    const total = subtotal + shipping;

                    container.innerHTML = \`
                        <div class="cart-items">\${itemsHtml}</div>
                        <div class="cart-summary">
                            <h3>Order Summary</h3>
                            <div class="summary-row"><span>Subtotal</span><span>\${formatPrice(subtotal)}</span></div>
                            <div class="summary-row"><span>Shipping</span><span>\${shipping === 0 ? 'FREE' : formatPrice(shipping)}</span></div>
                            <div class="summary-row total"><span>Total</span><span>\${formatPrice(total)}</span></div>
                            <a href="checkout.html" class="btn btn-large" style="margin-top:20px;display:block;text-align:center;">Proceed to Checkout</a>
                        </div>
                    \`;
                };

                // Checkout Page
                window.initCheckout = async function() {
                    const container = document.getElementById('checkout-container');
                    if (!container || Cart.items.length === 0) {
                        if (container) container.innerHTML = '<div class="cart-empty"><h2>Your cart is empty</h2><a href="index.html" class="btn">Continue Shopping</a></div>';
                        return;
                    }

                    // Render order summary
                    const orderItemsHtml = Cart.items.map(item => \`
                        <div class="order-item">
                            <img src="\${item.image}" alt="\${item.name}">
                            <div class="order-item-details">
                                <div class="order-item-name">\${item.name}</div>
                                <div class="order-item-qty">Qty: \${item.quantity}</div>
                            </div>
                            <div class="order-item-price">\${formatPrice(item.price * item.quantity)}</div>
                        </div>
                    \`).join('');

                    const subtotal = Cart.getSubtotal();
                    const shipping = subtotal > 50 ? 0 : 5.99;
                    const total = subtotal + shipping;

                    document.getElementById('order-items').innerHTML = orderItemsHtml;
                    document.getElementById('order-subtotal').textContent = formatPrice(subtotal);
                    document.getElementById('order-shipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
                    document.getElementById('order-total').textContent = formatPrice(total);

                    // Initialize Stripe
                    if (typeof Stripe !== 'undefined' && STRIPE_KEY && !STRIPE_KEY.includes('REPLACE')) {
                        const stripe = Stripe(STRIPE_KEY);
                        const elements = stripe.elements();
                        const cardElement = elements.create('card', {
                            style: {
                                base: { fontSize: '16px', color: '#1a1a1a' }
                            }
                        });
                        cardElement.mount('#card-element');

                        document.getElementById('checkout-form').addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const btn = document.getElementById('pay-btn');
                            btn.disabled = true;
                            btn.textContent = 'Processing...';

                            try {
                                // Create payment intent via API
                                const response = await fetch(API_URL + '/api/create-payment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        items: Cart.items,
                                        shipping: {
                                            name: document.getElementById('name').value,
                                            email: document.getElementById('email').value,
                                            address: document.getElementById('address').value,
                                            city: document.getElementById('city').value,
                                            postal: document.getElementById('postal').value,
                                            country: document.getElementById('country').value
                                        }
                                    })
                                });

                                const { clientSecret, error } = await response.json();
                                if (error) throw new Error(error);

                                const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                                    payment_method: {
                                        card: cardElement,
                                        billing_details: {
                                            name: document.getElementById('name').value,
                                            email: document.getElementById('email').value
                                        }
                                    }
                                });

                                if (stripeError) throw new Error(stripeError.message);

                                // Success
                                Cart.clear();
                                window.location.href = 'order-confirmation.html?order=' + paymentIntent.id;
                            } catch (err) {
                                document.getElementById('card-errors').textContent = err.message;
                                btn.disabled = false;
                                btn.textContent = 'Pay ' + formatPrice(total);
                            }
                        });

                        document.getElementById('pay-btn').textContent = 'Pay ' + formatPrice(total);
                    } else {
                        document.getElementById('card-element').innerHTML = '<p style="color:#ef4444;">Stripe is not configured. Please set up payment processing.</p>';
                        document.getElementById('pay-btn').disabled = true;
                    }
                };

                // Initialize on page load
                document.addEventListener('DOMContentLoaded', () => {
                    Cart.updateUI();
                    initGallery();
                    initQuantitySelector();
                    initAddToCart();
                    if (document.getElementById('cart-container')) window.renderCartPage();
                    if (document.getElementById('checkout-container')) window.initCheckout();
                });

                window.Cart = Cart;

                // Add notification animation
                const style = document.createElement('style');
                style.textContent = '@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
                document.head.appendChild(style);
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
        const images = product.images && product.images.length > 0
            ? product.images
            : [{ src: 'https://via.placeholder.com/600x600', alt: product.name }];

        // Generate image gallery HTML
        const mainImage = images[0];
        const thumbnailsHtml = images.length > 1 ? `
            <div class="gallery-thumbnails">
                ${images.map((img, i) => `
                    <img src="${img.src}"
                         alt="${this.escapeHtml(img.alt || product.name)}"
                         class="gallery-thumb ${i === 0 ? 'active' : ''}"
                         data-index="${i}"
                         loading="lazy">
                `).join('')}
            </div>
        ` : '';

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
                <a href="../cart.html">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <main class="container">
        <div class="product-detail">
            <div class="product-gallery">
                <div class="gallery-main">
                    <img id="main-image" src="${mainImage.src}"
                         alt="${this.escapeHtml(mainImage.alt || product.name)}"
                         loading="lazy">
                </div>
                ${thumbnailsHtml}
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
                <div class="quantity-selector">
                    <label>Quantity:</label>
                    <button class="qty-btn" data-action="decrease">-</button>
                    <input type="number" id="quantity" value="1" min="1" max="99">
                    <button class="qty-btn" data-action="increase">+</button>
                </div>
                <button class="btn btn-large" data-add-to-cart data-product='${JSON.stringify({
                    id: product.id,
                    name: product.name,
                    price: parseFloat(displayPrice),
                    image: mainImage.src,
                    images: images.map(img => img.src)
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

    async generateCartPage() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shopping Cart | ${this.escapeHtml(this.options.siteName)}</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header>
        <div class="container">
            <a href="index.html" class="logo">${this.escapeHtml(this.options.siteName)}</a>
            <nav>
                <a href="index.html">Shop</a>
                <a href="cart.html">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <main class="container cart-page">
        <h1>Shopping Cart</h1>
        <div id="cart-container"></div>
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

    async generateCheckoutPage() {
        const stripeKey = this.options.stripePublishableKey || '';
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Checkout | ${this.escapeHtml(this.options.siteName)}</title>
    <link rel="stylesheet" href="css/styles.css">
    <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
    <header>
        <div class="container">
            <a href="index.html" class="logo">${this.escapeHtml(this.options.siteName)}</a>
            <nav>
                <a href="index.html">Shop</a>
                <a href="cart.html">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <main class="container checkout-page">
        <h1>Checkout</h1>
        <div id="checkout-container">
            <div class="checkout-grid">
                <div class="checkout-form">
                    <form id="checkout-form">
                        <h2>Shipping Information</h2>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="name">Full Name</label>
                                <input type="text" id="name" required>
                            </div>
                            <div class="form-group">
                                <label for="email">Email</label>
                                <input type="email" id="email" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="address">Address</label>
                            <input type="text" id="address" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="city">City</label>
                                <input type="text" id="city" required>
                            </div>
                            <div class="form-group">
                                <label for="postal">Postal Code</label>
                                <input type="text" id="postal" required>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="country">Country</label>
                            <select id="country" required>
                                <option value="">Select Country</option>
                                <option value="US">United States</option>
                                <option value="CA">Canada</option>
                                <option value="GB">United Kingdom</option>
                                <option value="AU">Australia</option>
                                <option value="DE">Germany</option>
                                <option value="FR">France</option>
                                <option value="JP">Japan</option>
                            </select>
                        </div>

                        <h2>Payment</h2>
                        <div class="form-group">
                            <label>Card Details</label>
                            <div id="card-element"></div>
                            <div id="card-errors" class="alert alert-error" style="display:none;margin-top:10px;"></div>
                        </div>

                        <button type="submit" id="pay-btn" class="btn btn-large">Pay Now</button>
                    </form>
                </div>

                <div class="order-summary">
                    <h3>Order Summary</h3>
                    <div id="order-items" class="order-items"></div>
                    <div class="summary-row"><span>Subtotal</span><span id="order-subtotal"></span></div>
                    <div class="summary-row"><span>Shipping</span><span id="order-shipping"></span></div>
                    <div class="summary-row total"><span>Total</span><span id="order-total"></span></div>
                </div>
            </div>
        </div>
    </main>

    <footer>
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(this.options.siteName)}. All rights reserved.</p>
        </div>
    </footer>

    <script src="js/app.js"></script>
    <script>
        document.getElementById('card-errors').style.display = 'none';
        document.getElementById('checkout-form').addEventListener('submit', function(e) {
            var errors = document.getElementById('card-errors');
            if (errors.textContent) {
                errors.style.display = 'block';
            }
        });
    </script>
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

    async generateOrderConfirmationPage() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmed | ${this.escapeHtml(this.options.siteName)}</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header>
        <div class="container">
            <a href="index.html" class="logo">${this.escapeHtml(this.options.siteName)}</a>
            <nav>
                <a href="index.html">Shop</a>
                <a href="cart.html">Cart (<span id="cart-count">0</span>)</a>
            </nav>
        </div>
    </header>

    <main class="container">
        <div style="text-align:center;padding:80px 20px;">
            <div style="font-size:64px;margin-bottom:24px;">✅</div>
            <h1 style="font-size:36px;margin-bottom:16px;">Thank You for Your Order!</h1>
            <p style="font-size:18px;color:#6b7280;margin-bottom:8px;">Your order has been confirmed and is being processed.</p>
            <p style="color:#6b7280;margin-bottom:32px;">Order ID: <strong id="order-id"></strong></p>
            <p style="color:#6b7280;margin-bottom:32px;">A confirmation email will be sent to your email address.</p>
            <a href="index.html" class="btn">Continue Shopping</a>
        </div>
    </main>

    <footer>
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(this.options.siteName)}. All rights reserved.</p>
        </div>
    </footer>

    <script src="js/app.js"></script>
    <script>
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('order');
        if (orderId) {
            document.getElementById('order-id').textContent = orderId;
        }
    </script>
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

    async generateAdminLogin() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login | ${this.escapeHtml(this.options.siteName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .login-card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
        .login-card h1 { font-size: 24px; margin-bottom: 8px; color: #1a1a1a; }
        .login-card p { color: #6b7280; margin-bottom: 24px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 8px; }
        .form-group input { width: 100%; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 16px; }
        .form-group input:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
        .btn { width: 100%; padding: 14px; background: #7c3aed; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
        .btn:hover { background: #6d28d9; }
        .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
    </style>
</head>
<body>
    <div class="login-card">
        <h1>Admin Login</h1>
        <p>Enter your password to access the dashboard</p>
        <div class="error" id="error"></div>
        <form id="login-form">
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" required placeholder="Enter admin password">
            </div>
            <button type="submit" class="btn">Login</button>
        </form>
    </div>
    <script>
        const API = window.STORE_API_URL || '';
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('error');
            errorEl.style.display = 'none';
            try {
                const res = await fetch(API + '/api/admin/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'login', password })
                });
                const data = await res.json();
                if (data.token) {
                    localStorage.setItem('adminToken', data.token);
                    window.location.href = 'index.html';
                } else {
                    throw new Error(data.error || 'Login failed');
                }
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.style.display = 'block';
            }
        });
        // Redirect if already logged in
        if (localStorage.getItem('adminToken')) {
            window.location.href = 'index.html';
        }
    </script>
</body>
</html>`;
        return html;
    }

    async generateAdminDashboard() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard | ${this.escapeHtml(this.options.siteName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; }
        .admin-layout { display: flex; min-height: 100vh; }
        .sidebar { width: 250px; background: #1e1b4b; color: white; padding: 20px 0; }
        .sidebar-header { padding: 0 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; }
        .sidebar-header h1 { font-size: 20px; }
        .sidebar-nav a { display: flex; align-items: center; padding: 12px 20px; color: rgba(255,255,255,0.7); text-decoration: none; transition: all 0.2s; }
        .sidebar-nav a:hover, .sidebar-nav a.active { background: rgba(255,255,255,0.1); color: white; }
        .sidebar-nav a span { margin-left: 12px; }
        .main-content { flex: 1; padding: 24px; }
        .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .page-header h2 { font-size: 28px; color: #1a1a1a; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 32px; }
        .stat-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .stat-card h3 { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
        .stat-card .value { font-size: 32px; font-weight: 700; color: #1a1a1a; }
        .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
        .card-header { padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .card-header h3 { font-size: 18px; }
        .card-body { padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { font-weight: 600; color: #6b7280; font-size: 12px; text-transform: uppercase; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge-success { background: #d1fae5; color: #059669; }
        .badge-warning { background: #fef3c7; color: #d97706; }
        .badge-error { background: #fee2e2; color: #dc2626; }
        .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; }
        .btn-primary { background: #7c3aed; color: white; }
        .btn-primary:hover { background: #6d28d9; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }
        .btn-danger { background: #dc2626; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000; }
        .modal.active { display: flex; }
        .modal-content { background: white; padding: 32px; border-radius: 12px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 8px; font-size: 14px; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; }
        .form-group textarea { min-height: 100px; resize: vertical; }
        @media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 768px) { .sidebar { display: none; } .stats-grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="admin-layout">
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>Admin Panel</h1>
            </div>
            <nav class="sidebar-nav">
                <a href="#" class="active" data-tab="dashboard">📊 <span>Dashboard</span></a>
                <a href="#" data-tab="orders">📦 <span>Orders</span></a>
                <a href="#" data-tab="products">🛍️ <span>Products</span></a>
                <a href="#" data-tab="settings">⚙️ <span>Settings</span></a>
                <a href="#" id="logout">🚪 <span>Logout</span></a>
            </nav>
        </aside>
        <main class="main-content">
            <!-- Dashboard Tab -->
            <div id="dashboard" class="tab-content active">
                <div class="page-header"><h2>Dashboard</h2></div>
                <div class="stats-grid">
                    <div class="stat-card"><h3>Total Orders</h3><div class="value" id="stat-orders">0</div></div>
                    <div class="stat-card"><h3>Total Revenue</h3><div class="value" id="stat-revenue">$0</div></div>
                    <div class="stat-card"><h3>Products</h3><div class="value" id="stat-products">0</div></div>
                    <div class="stat-card"><h3>Platform Fees</h3><div class="value" id="stat-fees">$0</div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3>Recent Orders</h3></div>
                    <div class="card-body"><table id="recent-orders"><thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead><tbody></tbody></table></div>
                </div>
            </div>

            <!-- Orders Tab -->
            <div id="orders" class="tab-content">
                <div class="page-header"><h2>Orders</h2></div>
                <div class="card">
                    <div class="card-body"><table id="orders-table"><thead><tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
                </div>
            </div>

            <!-- Products Tab -->
            <div id="products" class="tab-content">
                <div class="page-header"><h2>Products</h2><button class="btn btn-primary" onclick="openProductModal()">+ Add Product</button></div>
                <div class="card">
                    <div class="card-body"><table id="products-table"><thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody></tbody></table></div>
                </div>
            </div>

            <!-- Settings Tab -->
            <div id="settings" class="tab-content">
                <div class="page-header"><h2>Settings</h2></div>
                <div class="card">
                    <div class="card-header"><h3>Store Settings</h3></div>
                    <div class="card-body">
                        <div class="form-group"><label>Store Name</label><input type="text" id="setting-name" value="${this.escapeHtml(this.options.siteName)}"></div>
                        <div class="form-group"><label>Stripe Publishable Key</label><input type="text" id="setting-stripe-pk" placeholder="pk_..."></div>
                        <div class="form-group"><label>Stripe Secret Key</label><input type="password" id="setting-stripe-sk" placeholder="sk_..."></div>
                        <button class="btn btn-primary">Save Settings</button>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Product Modal -->
    <div class="modal" id="product-modal">
        <div class="modal-content">
            <div class="modal-header"><h3 id="modal-title">Add Product</h3><button class="modal-close" onclick="closeProductModal()">&times;</button></div>
            <form id="product-form">
                <input type="hidden" id="product-id">
                <div class="form-group"><label>Name</label><input type="text" id="product-name" required></div>
                <div class="form-group"><label>Description</label><textarea id="product-description"></textarea></div>
                <div class="form-group"><label>Price</label><input type="number" id="product-price" step="0.01" required></div>
                <div class="form-group"><label>Sale Price</label><input type="number" id="product-sale-price" step="0.01"></div>
                <div class="form-group"><label>Stock</label><input type="number" id="product-stock" value="0"></div>
                <div class="form-group"><label>Image URL</label><input type="url" id="product-image" placeholder="https://..."></div>
                <div class="form-group"><label>Status</label><select id="product-status"><option value="publish">Published</option><option value="draft">Draft</option></select></div>
                <button type="submit" class="btn btn-primary" style="width:100%">Save Product</button>
            </form>
        </div>
    </div>

    <!-- Order Detail Modal -->
    <div class="modal" id="order-modal">
        <div class="modal-content">
            <div class="modal-header"><h3>Order Details</h3><button class="modal-close" onclick="closeOrderModal()">&times;</button></div>
            <div id="order-details"></div>
        </div>
    </div>

    <script>
        const API = window.STORE_API_URL || '';
        const TOKEN = localStorage.getItem('adminToken');

        // Check auth
        if (!TOKEN) { window.location.href = 'login.html'; }

        // API helper
        async function api(endpoint, options = {}) {
            const res = await fetch(API + endpoint, {
                ...options,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN, ...options.headers }
            });
            if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = 'login.html'; }
            return res.json();
        }

        // Tab navigation
        document.querySelectorAll('[data-tab]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById(link.dataset.tab).classList.add('active');
                if (link.dataset.tab === 'orders') loadOrders();
                if (link.dataset.tab === 'products') loadProducts();
            });
        });

        // Logout
        document.getElementById('logout').addEventListener('click', async (e) => {
            e.preventDefault();
            await api('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: 'logout', token: TOKEN }) });
            localStorage.removeItem('adminToken');
            window.location.href = 'login.html';
        });

        // Load dashboard stats
        async function loadDashboard() {
            try {
                const ordersData = await api('/api/admin/orders');
                const productsData = await api('/api/admin/products');
                const orders = ordersData.orders || [];
                const products = productsData.products || [];

                const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
                const fees = orders.reduce((sum, o) => sum + (o.platformFee || 0), 0);

                document.getElementById('stat-orders').textContent = orders.length;
                document.getElementById('stat-revenue').textContent = '$' + revenue.toFixed(2);
                document.getElementById('stat-products').textContent = products.length;
                document.getElementById('stat-fees').textContent = '$' + fees.toFixed(2);

                // Recent orders
                const tbody = document.querySelector('#recent-orders tbody');
                tbody.innerHTML = orders.slice(0, 5).map(o => \`
                    <tr>
                        <td>\${o.id?.substring(0, 8) || 'N/A'}</td>
                        <td>\${o.shipping?.name || 'Guest'}</td>
                        <td>$\${(o.total || 0).toFixed(2)}</td>
                        <td><span class="badge badge-\${o.status === 'completed' ? 'success' : o.status === 'refunded' ? 'error' : 'warning'}">\${o.status || 'pending'}</span></td>
                        <td>\${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                \`).join('');
            } catch (e) { console.error('Dashboard error:', e); }
        }

        // Load orders
        async function loadOrders() {
            try {
                const data = await api('/api/admin/orders');
                const tbody = document.querySelector('#orders-table tbody');
                tbody.innerHTML = (data.orders || []).map(o => \`
                    <tr>
                        <td>\${o.id?.substring(0, 8) || 'N/A'}</td>
                        <td>\${o.shipping?.email || 'N/A'}</td>
                        <td>\${o.items?.length || 0} items</td>
                        <td>$\${(o.total || 0).toFixed(2)}</td>
                        <td><span class="badge badge-\${o.status === 'completed' ? 'success' : o.status === 'refunded' ? 'error' : 'warning'}">\${o.status || 'pending'}</span></td>
                        <td>\${o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm" onclick="viewOrder('\${o.id}')">View</button>
                            \${o.status !== 'refunded' ? '<button class="btn btn-sm btn-danger" onclick="refundOrder(\\'' + o.id + '\\')">Refund</button>' : ''}
                        </td>
                    </tr>
                \`).join('');
            } catch (e) { console.error('Orders error:', e); }
        }

        // Load products
        async function loadProducts() {
            try {
                const data = await api('/api/admin/products');
                const tbody = document.querySelector('#products-table tbody');
                tbody.innerHTML = (data.products || []).map(p => \`
                    <tr>
                        <td><img src="\${p.images?.[0]?.src || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>
                        <td>\${p.name}</td>
                        <td>$\${(p.price || 0).toFixed(2)}</td>
                        <td>\${p.stock || 0}</td>
                        <td><span class="badge badge-\${p.status === 'publish' ? 'success' : 'warning'}">\${p.status}</span></td>
                        <td>
                            <button class="btn btn-sm" onclick="editProduct('\${p.id}')">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProduct('\${p.id}')">Delete</button>
                        </td>
                    </tr>
                \`).join('');
            } catch (e) { console.error('Products error:', e); }
        }

        // Product modal
        function openProductModal(product = null) {
            document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
            document.getElementById('product-id').value = product?.id || '';
            document.getElementById('product-name').value = product?.name || '';
            document.getElementById('product-description').value = product?.description || '';
            document.getElementById('product-price').value = product?.price || '';
            document.getElementById('product-sale-price').value = product?.salePrice || '';
            document.getElementById('product-stock').value = product?.stock || 0;
            document.getElementById('product-image').value = product?.images?.[0]?.src || '';
            document.getElementById('product-status').value = product?.status || 'publish';
            document.getElementById('product-modal').classList.add('active');
        }
        function closeProductModal() { document.getElementById('product-modal').classList.remove('active'); }

        // Save product
        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('product-id').value;
            const data = {
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                salePrice: document.getElementById('product-sale-price').value ? parseFloat(document.getElementById('product-sale-price').value) : null,
                stock: parseInt(document.getElementById('product-stock').value),
                images: document.getElementById('product-image').value ? [{ src: document.getElementById('product-image').value }] : [],
                status: document.getElementById('product-status').value
            };
            await api('/api/admin/products' + (id ? '?id=' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
            closeProductModal();
            loadProducts();
        });

        async function editProduct(id) {
            const data = await api('/api/admin/products?id=' + id);
            if (data.product) openProductModal(data.product);
        }

        async function deleteProduct(id) {
            if (confirm('Delete this product?')) {
                await api('/api/admin/products?id=' + id, { method: 'DELETE' });
                loadProducts();
            }
        }

        // Order modal
        async function viewOrder(id) {
            const data = await api('/api/admin/orders?id=' + id);
            const o = data.order;
            if (!o) return;
            document.getElementById('order-details').innerHTML = \`
                <p><strong>Order ID:</strong> \${o.id}</p>
                <p><strong>Status:</strong> \${o.status}</p>
                <p><strong>Customer:</strong> \${o.shipping?.name || 'N/A'}</p>
                <p><strong>Email:</strong> \${o.shipping?.email || 'N/A'}</p>
                <p><strong>Address:</strong> \${o.shipping?.address || ''}, \${o.shipping?.city || ''} \${o.shipping?.postal || ''}</p>
                <hr style="margin:16px 0;">
                <p><strong>Items:</strong></p>
                <ul>\${(o.items || []).map(i => '<li>' + i.name + ' x' + i.quantity + ' - $' + (i.price * i.quantity).toFixed(2) + '</li>').join('')}</ul>
                <hr style="margin:16px 0;">
                <p><strong>Subtotal:</strong> $\${(o.subtotal || 0).toFixed(2)}</p>
                <p><strong>Shipping:</strong> $\${(o.shippingCost || 0).toFixed(2)}</p>
                <p><strong>Total:</strong> $\${(o.total || 0).toFixed(2)}</p>
                <p><strong>Platform Fee:</strong> $\${(o.platformFee || 0).toFixed(2)}</p>
            \`;
            document.getElementById('order-modal').classList.add('active');
        }
        function closeOrderModal() { document.getElementById('order-modal').classList.remove('active'); }

        async function refundOrder(id) {
            if (confirm('Process full refund for this order?')) {
                try {
                    await api('/api/admin/refunds', { method: 'POST', body: JSON.stringify({ paymentIntentId: id }) });
                    alert('Refund processed successfully');
                    loadOrders();
                    loadDashboard();
                } catch (e) { alert('Refund failed: ' + e.message); }
            }
        }

        // Initialize
        loadDashboard();
    </script>
</body>
</html>`;
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
