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

        // Generate admin dashboard (with products seeded)
        progressCallback && progressCallback(98, 'Generating admin dashboard');
        files['admin/index.html'] = await this.generateAdminDashboard(normalizedProducts);
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

                // Order storage for local admin
                const Orders = {
                    getAll() {
                        try {
                            return JSON.parse(localStorage.getItem('store_orders') || '[]');
                        } catch { return []; }
                    },
                    save(order) {
                        const orders = this.getAll();
                        orders.unshift(order);
                        localStorage.setItem('store_orders', JSON.stringify(orders));
                    }
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

                    // Get settings for Stripe key
                    let stripeKey = STRIPE_KEY;
                    try {
                        const settings = JSON.parse(localStorage.getItem('store_settings') || '{}');
                        if (settings.stripeKey) stripeKey = settings.stripeKey;
                    } catch {}

                    // Initialize Stripe if configured
                    const stripeConfigured = typeof Stripe !== 'undefined' && stripeKey && !stripeKey.includes('REPLACE') && stripeKey.startsWith('pk_');

                    if (stripeConfigured) {
                        const stripe = Stripe(stripeKey);
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

                                // Save order locally
                                const order = {
                                    id: paymentIntent.id,
                                    items: Cart.items,
                                    customer: {
                                        name: document.getElementById('name').value,
                                        email: document.getElementById('email').value,
                                        address: document.getElementById('address').value,
                                        city: document.getElementById('city').value,
                                        postal: document.getElementById('postal').value,
                                        country: document.getElementById('country').value
                                    },
                                    subtotal: subtotal,
                                    shipping: shipping,
                                    total: total,
                                    status: 'completed',
                                    date: new Date().toISOString()
                                };
                                Orders.save(order);

                                // Success
                                Cart.clear();
                                window.location.href = 'order-confirmation.html?order=' + paymentIntent.id;
                            } catch (err) {
                                document.getElementById('card-errors').textContent = err.message;
                                document.getElementById('card-errors').style.display = 'block';
                                btn.disabled = false;
                                btn.textContent = 'Pay ' + formatPrice(total);
                            }
                        });

                        document.getElementById('pay-btn').textContent = 'Pay ' + formatPrice(total);
                    } else {
                        // Demo mode - no real payment, just save order
                        document.getElementById('card-element').innerHTML = '<div style="padding:16px;background:#f0fdf4;border-radius:8px;color:#166534;"><strong>Demo Mode</strong><br>No payment will be processed. Configure Stripe in Admin Settings for live payments.</div>';

                        document.getElementById('checkout-form').addEventListener('submit', (e) => {
                            e.preventDefault();
                            const btn = document.getElementById('pay-btn');

                            // Validate form
                            const name = document.getElementById('name').value.trim();
                            const email = document.getElementById('email').value.trim();
                            if (!name || !email) {
                                alert('Please fill in your name and email');
                                return;
                            }

                            btn.disabled = true;
                            btn.textContent = 'Processing...';

                            // Generate order ID
                            const orderId = 'demo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

                            // Save order locally
                            const order = {
                                id: orderId,
                                items: Cart.items.map(i => ({...i})),
                                customer: {
                                    name: name,
                                    email: email,
                                    address: document.getElementById('address').value,
                                    city: document.getElementById('city').value,
                                    postal: document.getElementById('postal').value,
                                    country: document.getElementById('country').value
                                },
                                subtotal: subtotal,
                                shipping: shipping,
                                total: total,
                                status: 'pending',
                                date: new Date().toISOString()
                            };
                            Orders.save(order);

                            // Clear cart and redirect
                            Cart.clear();
                            window.location.href = 'order-confirmation.html?order=' + orderId;
                        });

                        document.getElementById('pay-btn').textContent = 'Place Order (Demo) ' + formatPrice(total);
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
        // Default password hash (admin123) - SHA256
        const defaultPasswordHash = '240be518fabd2724ddb6f04eeb9d5b8b25adec5eed5dfd32e5332de3f5fef0d9';

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login | ${this.escapeHtml(this.options.siteName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .login-card { background: white; padding: 48px; border-radius: 16px; box-shadow: 0 25px 50px rgba(0,0,0,0.25); width: 100%; max-width: 420px; }
        .login-card h1 { font-size: 28px; margin-bottom: 8px; color: #1a1a1a; text-align: center; }
        .login-card p { color: #6b7280; margin-bottom: 32px; text-align: center; }
        .form-group { margin-bottom: 24px; }
        .form-group label { display: block; font-weight: 600; margin-bottom: 8px; color: #374151; }
        .form-group input { width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 16px; transition: all 0.2s; }
        .form-group input:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 4px rgba(124,58,237,0.15); }
        .btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(124,58,237,0.4); }
        .error { background: #fef2f2; color: #dc2626; padding: 14px; border-radius: 10px; margin-bottom: 24px; display: none; text-align: center; font-weight: 500; }
        .setup-notice { background: #f0fdf4; color: #166534; padding: 14px; border-radius: 10px; margin-bottom: 24px; text-align: center; font-size: 14px; }
    </style>
</head>
<body>
    <div class="login-card">
        <h1>Store Admin</h1>
        <p>Enter your password to access the dashboard</p>
        <div class="error" id="error"></div>
        <div class="setup-notice" id="setup-notice" style="display:none;">First time? Default password: <strong>admin123</strong></div>
        <form id="login-form">
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" required placeholder="Enter admin password" autocomplete="current-password">
            </div>
            <button type="submit" class="btn">Login to Dashboard</button>
        </form>
    </div>
    <script>
        // Simple SHA256 hash function
        async function sha256(message) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Check if first time setup
        const storedHash = localStorage.getItem('adminPasswordHash');
        if (!storedHash) {
            document.getElementById('setup-notice').style.display = 'block';
        }

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('error');
            errorEl.style.display = 'none';

            try {
                const inputHash = await sha256(password);
                const storedHash = localStorage.getItem('adminPasswordHash') || '${defaultPasswordHash}';

                if (inputHash === storedHash) {
                    // Set session
                    const session = { loggedIn: true, timestamp: Date.now() };
                    sessionStorage.setItem('adminSession', JSON.stringify(session));

                    // Store password hash if first time
                    if (!localStorage.getItem('adminPasswordHash')) {
                        localStorage.setItem('adminPasswordHash', inputHash);
                    }

                    window.location.href = 'index.html';
                } else {
                    throw new Error('Invalid password');
                }
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.style.display = 'block';
            }
        });

        // Redirect if already logged in (session-based)
        const session = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
        if (session.loggedIn && (Date.now() - session.timestamp) < 86400000) {
            window.location.href = 'index.html';
        }
    </script>
</body>
</html>`;
        return html;
    }

    async generateAdminDashboard(products = []) {
        // Serialize products for embedding
        const productsJson = JSON.stringify(products.map(p => ({
            id: p.id || Date.now() + Math.random(),
            name: p.name,
            slug: p.slug,
            description: p.description || '',
            price: parseFloat(p.price) || 0,
            regularPrice: parseFloat(p.regularPrice) || parseFloat(p.price) || 0,
            salePrice: p.salePrice ? parseFloat(p.salePrice) : null,
            images: p.images || [],
            stock: p.stock || 100,
            status: 'publish'
        }))).replace(/</g, '\\x3c').replace(/>/g, '\\x3e');

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard | ${this.escapeHtml(this.options.siteName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f0f1; }
        .admin-layout { display: flex; min-height: 100vh; }
        /* WooCommerce-style sidebar */
        .sidebar { width: 260px; background: #1d2327; color: #f0f0f1; flex-shrink: 0; }
        .sidebar-header { padding: 16px 20px; background: #101517; display: flex; align-items: center; gap: 12px; }
        .sidebar-header .logo { width: 36px; height: 36px; background: linear-gradient(135deg, #7c3aed, #6d28d9); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
        .sidebar-header h1 { font-size: 16px; font-weight: 600; }
        .sidebar-nav { padding: 12px 0; }
        .sidebar-nav a { display: flex; align-items: center; padding: 10px 20px; color: #a7aaad; text-decoration: none; transition: all 0.15s; font-size: 14px; border-left: 4px solid transparent; }
        .sidebar-nav a:hover { background: #2c3338; color: #f0f0f1; }
        .sidebar-nav a.active { background: #2271b1; color: white; border-left-color: #72aee6; }
        .sidebar-nav a svg { width: 20px; height: 20px; margin-right: 12px; opacity: 0.7; }
        .sidebar-nav a.active svg { opacity: 1; }
        .nav-divider { height: 1px; background: #3c434a; margin: 12px 20px; }
        /* Main content */
        .main-content { flex: 1; min-width: 0; }
        .top-bar { background: white; padding: 12px 24px; border-bottom: 1px solid #c3c4c7; display: flex; justify-content: space-between; align-items: center; }
        .top-bar h2 { font-size: 20px; font-weight: 400; color: #1d2327; }
        .page-content { padding: 24px; }
        /* Stats cards */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 20px; border-radius: 4px; border: 1px solid #c3c4c7; }
        .stat-card h3 { font-size: 12px; font-weight: 400; color: #646970; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .stat-card .value { font-size: 28px; font-weight: 600; color: #1d2327; }
        .stat-card .change { font-size: 13px; color: #00a32a; margin-top: 4px; }
        .stat-card .change.negative { color: #d63638; }
        /* Cards */
        .card { background: white; border-radius: 4px; border: 1px solid #c3c4c7; margin-bottom: 20px; }
        .card-header { padding: 16px 20px; border-bottom: 1px solid #c3c4c7; display: flex; justify-content: space-between; align-items: center; }
        .card-header h3 { font-size: 14px; font-weight: 600; color: #1d2327; }
        .card-body { padding: 0; }
        .card-body.padded { padding: 20px; }
        /* Tables */
        table { width: 100%; border-collapse: collapse; }
        th { padding: 12px 16px; text-align: left; font-weight: 400; color: #1d2327; font-size: 14px; border-bottom: 1px solid #c3c4c7; background: #f6f7f7; }
        td { padding: 12px 16px; border-bottom: 1px solid #f0f0f1; font-size: 14px; color: #3c434a; }
        tr:hover { background: #f6f7f7; }
        .empty-state { text-align: center; padding: 48px 20px; color: #646970; }
        /* Badges */
        .badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 12px; font-weight: 500; }
        .badge-success { background: #d4edda; color: #0d6f36; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-error { background: #f8d7da; color: #a02a2b; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        /* Buttons */
        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; text-decoration: none; }
        .btn-primary { background: #2271b1; color: white; }
        .btn-primary:hover { background: #135e96; }
        .btn-secondary { background: #f0f0f1; color: #1d2327; border: 1px solid #8c8f94; }
        .btn-secondary:hover { background: #e0e0e0; }
        .btn-danger { background: #d63638; color: white; }
        .btn-danger:hover { background: #b32d2e; }
        .btn-sm { padding: 5px 10px; font-size: 12px; }
        /* Tab content */
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        /* Modal */
        .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; z-index: 1000; }
        .modal.active { display: flex; }
        .modal-content { background: white; border-radius: 4px; max-width: 600px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
        .modal-header { padding: 16px 20px; border-bottom: 1px solid #c3c4c7; display: flex; justify-content: space-between; align-items: center; }
        .modal-header h3 { font-size: 16px; font-weight: 600; }
        .modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #646970; line-height: 1; }
        .modal-close:hover { color: #d63638; }
        .modal-body { padding: 20px; }
        .modal-footer { padding: 16px 20px; border-top: 1px solid #c3c4c7; display: flex; justify-content: flex-end; gap: 10px; }
        /* Forms */
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 13px; color: #1d2327; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid #8c8f94; border-radius: 4px; font-size: 14px; }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: #2271b1; box-shadow: 0 0 0 1px #2271b1; }
        .form-group textarea { min-height: 120px; resize: vertical; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-hint { font-size: 12px; color: #646970; margin-top: 4px; }
        /* Action buttons in table */
        .action-btns { display: flex; gap: 6px; }
        /* Toast notifications */
        .toast { position: fixed; bottom: 24px; right: 24px; background: #1d2327; color: white; padding: 14px 20px; border-radius: 4px; font-size: 14px; z-index: 9999; animation: slideIn 0.3s ease; }
        .toast.success { background: #00a32a; }
        .toast.error { background: #d63638; }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        /* Responsive */
        @media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 768px) {
            .sidebar { position: fixed; left: -260px; z-index: 100; transition: left 0.3s; }
            .sidebar.open { left: 0; }
            .stats-grid { grid-template-columns: 1fr; }
            .form-row { grid-template-columns: 1fr; }
        }
        /* Import/Export section */
        .data-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="admin-layout">
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="logo">A</div>
                <h1>${this.escapeHtml(this.options.siteName)}</h1>
            </div>
            <nav class="sidebar-nav">
                <a href="#" class="active" data-tab="dashboard">
                    <svg fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm11-1a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                    Dashboard
                </a>
                <a href="#" data-tab="orders">
                    <svg fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>
                    Orders
                </a>
                <a href="#" data-tab="products">
                    <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 2L3 7v11h14V7l-7-5zM7 9h6v2H7V9zm0 4h6v2H7v-2z" clip-rule="evenodd"/></svg>
                    Products
                </a>
                <div class="nav-divider"></div>
                <a href="#" data-tab="settings">
                    <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>
                    Settings
                </a>
                <a href="#" id="logout">
                    <svg fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm9 4a1 1 0 10-2 0v4a1 1 0 102 0V7z" clip-rule="evenodd"/></svg>
                    Logout
                </a>
            </nav>
        </aside>

        <div class="main-content">
            <div class="top-bar">
                <h2 id="page-title">Dashboard</h2>
                <div><a href="../index.html" class="btn btn-secondary" target="_blank">View Store</a></div>
            </div>

            <div class="page-content">
                <!-- Dashboard Tab -->
                <div id="dashboard" class="tab-content active">
                    <div class="stats-grid">
                        <div class="stat-card"><h3>Total Orders</h3><div class="value" id="stat-orders">0</div></div>
                        <div class="stat-card"><h3>Total Revenue</h3><div class="value" id="stat-revenue">$0.00</div></div>
                        <div class="stat-card"><h3>Products</h3><div class="value" id="stat-products">0</div></div>
                        <div class="stat-card"><h3>Avg Order Value</h3><div class="value" id="stat-avg">$0.00</div></div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3>Recent Orders</h3></div>
                        <div class="card-body">
                            <table id="recent-orders">
                                <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Orders Tab -->
                <div id="orders" class="tab-content">
                    <div class="data-actions">
                        <button class="btn btn-secondary" onclick="exportOrders()">Export Orders (CSV)</button>
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <table id="orders-table">
                                <thead><tr><th>Order</th><th>Customer</th><th>Email</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Products Tab -->
                <div id="products" class="tab-content">
                    <div class="data-actions">
                        <button class="btn btn-primary" onclick="openProductModal()">+ Add Product</button>
                        <button class="btn btn-secondary" onclick="exportProducts()">Export (JSON)</button>
                        <button class="btn btn-secondary" onclick="document.getElementById('import-file').click()">Import (JSON)</button>
                        <input type="file" id="import-file" accept=".json" style="display:none" onchange="importProducts(event)">
                    </div>
                    <div class="card">
                        <div class="card-body">
                            <table id="products-table">
                                <thead><tr><th style="width:60px">Image</th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th style="width:140px">Actions</th></tr></thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Settings Tab -->
                <div id="settings" class="tab-content">
                    <div class="card">
                        <div class="card-header"><h3>Store Settings</h3></div>
                        <div class="card-body padded">
                            <form id="settings-form">
                                <div class="form-group">
                                    <label>Store Name</label>
                                    <input type="text" id="setting-name" value="${this.escapeHtml(this.options.siteName)}">
                                </div>
                                <div class="form-group">
                                    <label>Currency Symbol</label>
                                    <input type="text" id="setting-currency" value="${this.escapeHtml(this.options.currency || '$')}" maxlength="3">
                                </div>
                                <div class="form-group">
                                    <label>Stripe Publishable Key</label>
                                    <input type="text" id="setting-stripe-pk" placeholder="pk_live_...">
                                    <div class="form-hint">Used for accepting payments. Get your key from the Stripe dashboard.</div>
                                </div>
                                <button type="submit" class="btn btn-primary">Save Settings</button>
                            </form>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><h3>Security</h3></div>
                        <div class="card-body padded">
                            <form id="password-form">
                                <div class="form-group">
                                    <label>Current Password</label>
                                    <input type="password" id="current-password" required>
                                </div>
                                <div class="form-group">
                                    <label>New Password</label>
                                    <input type="password" id="new-password" required minlength="6">
                                </div>
                                <div class="form-group">
                                    <label>Confirm New Password</label>
                                    <input type="password" id="confirm-password" required>
                                </div>
                                <button type="submit" class="btn btn-primary">Change Password</button>
                            </form>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><h3>Data Management</h3></div>
                        <div class="card-body padded">
                            <p style="margin-bottom:16px;color:#646970;">Export or reset all store data. Use with caution.</p>
                            <div class="data-actions">
                                <button class="btn btn-secondary" onclick="exportAllData()">Export All Data</button>
                                <button class="btn btn-danger" onclick="resetAllData()">Reset All Data</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Product Modal -->
    <div class="modal" id="product-modal">
        <div class="modal-content">
            <div class="modal-header"><h3 id="modal-title">Add Product</h3><button class="modal-close" onclick="closeProductModal()">&times;</button></div>
            <div class="modal-body">
                <form id="product-form">
                    <input type="hidden" id="product-id">
                    <div class="form-group">
                        <label>Product Name *</label>
                        <input type="text" id="product-name" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="product-description" placeholder="Enter product description..."></textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Regular Price *</label>
                            <input type="number" id="product-price" step="0.01" min="0" required>
                        </div>
                        <div class="form-group">
                            <label>Sale Price</label>
                            <input type="number" id="product-sale-price" step="0.01" min="0">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Stock Quantity</label>
                            <input type="number" id="product-stock" value="100" min="0">
                        </div>
                        <div class="form-group">
                            <label>Status</label>
                            <select id="product-status">
                                <option value="publish">Published</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Image URL</label>
                        <input type="url" id="product-image" placeholder="https://example.com/image.jpg">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeProductModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="saveProduct()">Save Product</button>
            </div>
        </div>
    </div>

    <!-- Order Modal -->
    <div class="modal" id="order-modal">
        <div class="modal-content">
            <div class="modal-header"><h3>Order Details</h3><button class="modal-close" onclick="closeOrderModal()">&times;</button></div>
            <div class="modal-body" id="order-details"></div>
            <div class="modal-footer" id="order-actions"></div>
        </div>
    </div>

    <script>
        // ============================================
        // LOCAL STORAGE DATABASE
        // ============================================
        const DB = {
            get(key, defaultValue = []) {
                try {
                    const data = localStorage.getItem('store_' + key);
                    return data ? JSON.parse(data) : defaultValue;
                } catch { return defaultValue; }
            },
            set(key, value) {
                localStorage.setItem('store_' + key, JSON.stringify(value));
            }
        };

        // Seed products from conversion (only if not already seeded)
        const SEED_PRODUCTS = ${productsJson};
        if (!localStorage.getItem('store_seeded')) {
            DB.set('products', SEED_PRODUCTS);
            localStorage.setItem('store_seeded', 'true');
        }

        // ============================================
        // AUTHENTICATION
        // ============================================
        const session = JSON.parse(sessionStorage.getItem('adminSession') || '{}');
        if (!session.loggedIn || (Date.now() - session.timestamp) > 86400000) {
            window.location.href = 'login.html';
        }

        // ============================================
        // TAB NAVIGATION
        // ============================================
        document.querySelectorAll('[data-tab]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                document.getElementById(link.dataset.tab).classList.add('active');
                document.getElementById('page-title').textContent = link.textContent.trim();

                if (link.dataset.tab === 'orders') loadOrders();
                if (link.dataset.tab === 'products') loadProducts();
                if (link.dataset.tab === 'settings') loadSettings();
            });
        });

        // ============================================
        // LOGOUT
        // ============================================
        document.getElementById('logout').addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('adminSession');
            window.location.href = 'login.html';
        });

        // ============================================
        // TOAST NOTIFICATIONS
        // ============================================
        function showToast(message, type = 'success') {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }

        // ============================================
        // DASHBOARD
        // ============================================
        function loadDashboard() {
            const orders = DB.get('orders', []);
            const products = DB.get('products', []);

            const revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
            const avgOrder = orders.length > 0 ? revenue / orders.length : 0;

            document.getElementById('stat-orders').textContent = orders.length;
            document.getElementById('stat-revenue').textContent = '$' + revenue.toFixed(2);
            document.getElementById('stat-products').textContent = products.length;
            document.getElementById('stat-avg').textContent = '$' + avgOrder.toFixed(2);

            // Recent orders
            const tbody = document.querySelector('#recent-orders tbody');
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No orders yet</td></tr>';
            } else {
                tbody.innerHTML = orders.slice(0, 5).map(o => \`
                    <tr>
                        <td>#\${(o.id || '').substring(0, 8)}</td>
                        <td>\${o.customer?.name || 'Guest'}</td>
                        <td>$\${(o.total || 0).toFixed(2)}</td>
                        <td><span class="badge badge-\${o.status === 'completed' ? 'success' : o.status === 'refunded' ? 'error' : 'warning'}">\${o.status || 'pending'}</span></td>
                        <td>\${o.date ? new Date(o.date).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                \`).join('');
            }
        }

        // ============================================
        // ORDERS
        // ============================================
        function loadOrders() {
            const orders = DB.get('orders', []);
            const tbody = document.querySelector('#orders-table tbody');

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No orders yet. Orders will appear here when customers make purchases.</td></tr>';
                return;
            }

            tbody.innerHTML = orders.map(o => \`
                <tr>
                    <td>#\${(o.id || '').substring(0, 8)}</td>
                    <td>\${o.customer?.name || 'Guest'}</td>
                    <td>\${o.customer?.email || 'N/A'}</td>
                    <td>\${o.items?.length || 0} items</td>
                    <td>$\${(o.total || 0).toFixed(2)}</td>
                    <td><span class="badge badge-\${o.status === 'completed' ? 'success' : o.status === 'refunded' ? 'error' : 'warning'}">\${o.status || 'pending'}</span></td>
                    <td>\${o.date ? new Date(o.date).toLocaleDateString() : 'N/A'}</td>
                    <td class="action-btns">
                        <button class="btn btn-sm btn-secondary" onclick="viewOrder('\${o.id}')">View</button>
                        \${o.status !== 'refunded' ? '<button class="btn btn-sm btn-danger" onclick="updateOrderStatus(\\'' + o.id + '\\', \\'refunded\\')">Refund</button>' : ''}
                    </td>
                </tr>
            \`).join('');
        }

        function viewOrder(id) {
            const orders = DB.get('orders', []);
            const o = orders.find(x => x.id === id);
            if (!o) return;

            document.getElementById('order-details').innerHTML = \`
                <div style="margin-bottom:20px;">
                    <p><strong>Order ID:</strong> \${o.id}</p>
                    <p><strong>Date:</strong> \${o.date ? new Date(o.date).toLocaleString() : 'N/A'}</p>
                    <p><strong>Status:</strong> <span class="badge badge-\${o.status === 'completed' ? 'success' : o.status === 'refunded' ? 'error' : 'warning'}">\${o.status}</span></p>
                </div>
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:10px;">Customer</h4>
                    <p>\${o.customer?.name || 'N/A'}</p>
                    <p>\${o.customer?.email || 'N/A'}</p>
                    <p>\${o.customer?.address || ''}</p>
                    <p>\${o.customer?.city || ''} \${o.customer?.postal || ''}</p>
                </div>
                <div style="margin-bottom:20px;">
                    <h4 style="margin-bottom:10px;">Items</h4>
                    <table style="font-size:13px;">
                        <tr><th>Product</th><th>Qty</th><th>Price</th></tr>
                        \${(o.items || []).map(i => '<tr><td>' + i.name + '</td><td>' + i.quantity + '</td><td>$' + (i.price * i.quantity).toFixed(2) + '</td></tr>').join('')}
                    </table>
                </div>
                <div style="border-top:1px solid #e5e7eb;padding-top:16px;">
                    <p><strong>Subtotal:</strong> $\${(o.subtotal || 0).toFixed(2)}</p>
                    <p><strong>Shipping:</strong> $\${(o.shipping || 0).toFixed(2)}</p>
                    <p style="font-size:18px;font-weight:600;margin-top:8px;"><strong>Total:</strong> $\${(o.total || 0).toFixed(2)}</p>
                </div>
            \`;

            document.getElementById('order-actions').innerHTML = o.status !== 'refunded'
                ? '<button class="btn btn-secondary" onclick="closeOrderModal()">Close</button><button class="btn btn-primary" onclick="updateOrderStatus(\\'' + o.id + '\\', \\'completed\\');closeOrderModal();">Mark Completed</button>'
                : '<button class="btn btn-secondary" onclick="closeOrderModal()">Close</button>';

            document.getElementById('order-modal').classList.add('active');
        }

        function closeOrderModal() {
            document.getElementById('order-modal').classList.remove('active');
        }

        function updateOrderStatus(id, status) {
            const orders = DB.get('orders', []);
            const idx = orders.findIndex(x => x.id === id);
            if (idx !== -1) {
                orders[idx].status = status;
                DB.set('orders', orders);
                loadOrders();
                loadDashboard();
                showToast('Order updated to ' + status);
            }
        }

        function exportOrders() {
            const orders = DB.get('orders', []);
            const csv = [
                ['Order ID', 'Date', 'Customer', 'Email', 'Total', 'Status'].join(','),
                ...orders.map(o => [
                    o.id,
                    o.date || '',
                    (o.customer?.name || '').replace(/,/g, ' '),
                    o.customer?.email || '',
                    (o.total || 0).toFixed(2),
                    o.status || ''
                ].join(','))
            ].join('\\n');

            downloadFile(csv, 'orders.csv', 'text/csv');
        }

        // ============================================
        // PRODUCTS
        // ============================================
        function loadProducts() {
            const products = DB.get('products', []);
            const tbody = document.querySelector('#products-table tbody');

            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No products yet. Click "Add Product" to create one.</td></tr>';
                return;
            }

            tbody.innerHTML = products.map(p => \`
                <tr>
                    <td><img src="\${p.images?.[0]?.src || 'https://via.placeholder.com/50x50?text=No+Image'}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>
                    <td><strong>\${escapeHtml(p.name)}</strong></td>
                    <td>\${p.salePrice ? '<del style="color:#999;">$' + p.regularPrice.toFixed(2) + '</del> ' : ''}$\${(p.salePrice || p.price || p.regularPrice || 0).toFixed(2)}</td>
                    <td>\${p.stock || 0}</td>
                    <td><span class="badge badge-\${p.status === 'publish' ? 'success' : 'warning'}">\${p.status === 'publish' ? 'Published' : 'Draft'}</span></td>
                    <td class="action-btns">
                        <button class="btn btn-sm btn-secondary" onclick="editProduct('\${p.id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct('\${p.id}')">Delete</button>
                    </td>
                </tr>
            \`).join('');
        }

        function openProductModal(product = null) {
            document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
            document.getElementById('product-id').value = product?.id || '';
            document.getElementById('product-name').value = product?.name || '';
            document.getElementById('product-description').value = product?.description || '';
            document.getElementById('product-price').value = product?.regularPrice || product?.price || '';
            document.getElementById('product-sale-price').value = product?.salePrice || '';
            document.getElementById('product-stock').value = product?.stock ?? 100;
            document.getElementById('product-image').value = product?.images?.[0]?.src || '';
            document.getElementById('product-status').value = product?.status || 'publish';
            document.getElementById('product-modal').classList.add('active');
        }

        function closeProductModal() {
            document.getElementById('product-modal').classList.remove('active');
        }

        function saveProduct() {
            const id = document.getElementById('product-id').value;
            const name = document.getElementById('product-name').value.trim();
            const price = parseFloat(document.getElementById('product-price').value) || 0;

            if (!name || !price) {
                showToast('Please fill in required fields', 'error');
                return;
            }

            const products = DB.get('products', []);
            const product = {
                id: id || 'prod_' + Date.now(),
                name: name,
                slug: slugify(name),
                description: document.getElementById('product-description').value,
                price: price,
                regularPrice: price,
                salePrice: document.getElementById('product-sale-price').value ? parseFloat(document.getElementById('product-sale-price').value) : null,
                stock: parseInt(document.getElementById('product-stock').value) || 0,
                images: document.getElementById('product-image').value ? [{ src: document.getElementById('product-image').value }] : [],
                status: document.getElementById('product-status').value
            };

            if (id) {
                const idx = products.findIndex(p => p.id === id);
                if (idx !== -1) products[idx] = product;
            } else {
                products.unshift(product);
            }

            DB.set('products', products);
            closeProductModal();
            loadProducts();
            loadDashboard();
            showToast(id ? 'Product updated' : 'Product added');
        }

        function editProduct(id) {
            const products = DB.get('products', []);
            const product = products.find(p => p.id === id);
            if (product) openProductModal(product);
        }

        function deleteProduct(id) {
            if (!confirm('Are you sure you want to delete this product?')) return;
            const products = DB.get('products', []);
            DB.set('products', products.filter(p => p.id !== id));
            loadProducts();
            loadDashboard();
            showToast('Product deleted');
        }

        function exportProducts() {
            const products = DB.get('products', []);
            downloadFile(JSON.stringify(products, null, 2), 'products.json', 'application/json');
        }

        function importProducts(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (!Array.isArray(imported)) throw new Error('Invalid format');

                    const products = DB.get('products', []);
                    const existingIds = new Set(products.map(p => p.id));

                    let added = 0;
                    imported.forEach(p => {
                        if (!existingIds.has(p.id)) {
                            products.push(p);
                            added++;
                        }
                    });

                    DB.set('products', products);
                    loadProducts();
                    loadDashboard();
                    showToast(added + ' products imported');
                } catch (err) {
                    showToast('Failed to import: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }

        // ============================================
        // SETTINGS
        // ============================================
        function loadSettings() {
            const settings = DB.get('settings', {});
            document.getElementById('setting-name').value = settings.storeName || '${this.escapeHtml(this.options.siteName)}';
            document.getElementById('setting-currency').value = settings.currency || '${this.escapeHtml(this.options.currency || '$')}';
            document.getElementById('setting-stripe-pk').value = settings.stripeKey || '';
        }

        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const settings = DB.get('settings', {});
            settings.storeName = document.getElementById('setting-name').value;
            settings.currency = document.getElementById('setting-currency').value;
            settings.stripeKey = document.getElementById('setting-stripe-pk').value;
            DB.set('settings', settings);
            showToast('Settings saved');
        });

        // Password change
        document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const current = document.getElementById('current-password').value;
            const newPass = document.getElementById('new-password').value;
            const confirm = document.getElementById('confirm-password').value;

            if (newPass !== confirm) {
                showToast('Passwords do not match', 'error');
                return;
            }

            const currentHash = await sha256(current);
            const storedHash = localStorage.getItem('adminPasswordHash') || '240be518fabd2724ddb6f04eeb9d5b8b25adec5eed5dfd32e5332de3f5fef0d9';

            if (currentHash !== storedHash) {
                showToast('Current password is incorrect', 'error');
                return;
            }

            const newHash = await sha256(newPass);
            localStorage.setItem('adminPasswordHash', newHash);
            document.getElementById('password-form').reset();
            showToast('Password changed successfully');
        });

        async function sha256(message) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        // Data management
        function exportAllData() {
            const data = {
                products: DB.get('products', []),
                orders: DB.get('orders', []),
                settings: DB.get('settings', {})
            };
            downloadFile(JSON.stringify(data, null, 2), 'store-backup.json', 'application/json');
        }

        function resetAllData() {
            if (!confirm('This will delete ALL data including products and orders. Are you sure?')) return;
            if (!confirm('This action cannot be undone. Type "RESET" in the next prompt to confirm.')) return;
            if (prompt('Type RESET to confirm:') !== 'RESET') {
                showToast('Reset cancelled', 'error');
                return;
            }

            localStorage.removeItem('store_products');
            localStorage.removeItem('store_orders');
            localStorage.removeItem('store_settings');
            localStorage.removeItem('store_seeded');
            showToast('All data has been reset');
            setTimeout(() => location.reload(), 1000);
        }

        // ============================================
        // UTILITIES
        // ============================================
        function slugify(text) {
            return (text || '')
                .toLowerCase()
                .trim()
                .replace(/[^\\w\\s-]/g, '')
                .replace(/\\s+/g, '-')
                .replace(/-+/g, '-');
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function downloadFile(content, filename, type) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        }

        // ============================================
        // INITIALIZE
        // ============================================
        loadDashboard();
        loadSettings();
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
