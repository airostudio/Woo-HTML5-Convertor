/**
 * HTML5 Store - Main JavaScript
 * High-performance, vanilla JavaScript store functionality
 */

(function() {
    'use strict';

    // ==========================================================================
    // Configuration
    // ==========================================================================
    const CONFIG = window.STORE_CONFIG || {
        siteName: 'Store',
        currency: 'USD',
        currencySymbol: '$',
        enableSearch: true,
        enableCart: true,
        enableWishlist: false
    };

    // ==========================================================================
    // Utility Functions
    // ==========================================================================
    const $ = (selector, context = document) => context.querySelector(selector);
    const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

    const formatPrice = (price) => {
        const num = parseFloat(price) || 0;
        return CONFIG.currencySymbol + num.toFixed(2);
    };

    const debounce = (fn, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    };

    const throttle = (fn, limit) => {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // ==========================================================================
    // Storage Manager (localStorage wrapper with fallback)
    // ==========================================================================
    const Storage = {
        isAvailable() {
            try {
                const test = '__storage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        },

        _memoryStorage: {},

        get(key, defaultValue = null) {
            try {
                if (this.isAvailable()) {
                    const item = localStorage.getItem(key);
                    return item ? JSON.parse(item) : defaultValue;
                }
                return this._memoryStorage[key] || defaultValue;
            } catch (e) {
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                const serialized = JSON.stringify(value);
                if (this.isAvailable()) {
                    localStorage.setItem(key, serialized);
                } else {
                    this._memoryStorage[key] = value;
                }
            } catch (e) {
                console.warn('Storage error:', e);
            }
        },

        remove(key) {
            try {
                if (this.isAvailable()) {
                    localStorage.removeItem(key);
                } else {
                    delete this._memoryStorage[key];
                }
            } catch (e) {
                console.warn('Storage error:', e);
            }
        }
    };

    // ==========================================================================
    // Event Emitter
    // ==========================================================================
    const EventBus = {
        events: {},

        on(event, callback) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(callback);
        },

        off(event, callback) {
            if (this.events[event]) {
                this.events[event] = this.events[event].filter(cb => cb !== callback);
            }
        },

        emit(event, data) {
            if (this.events[event]) {
                this.events[event].forEach(callback => callback(data));
            }
        }
    };

    // ==========================================================================
    // Cart Manager
    // ==========================================================================
    const Cart = {
        STORAGE_KEY: 'store_cart',

        items: [],

        init() {
            this.items = Storage.get(this.STORAGE_KEY, []);
            this.updateUI();
            this.bindEvents();
        },

        bindEvents() {
            // Add to cart buttons
            document.addEventListener('click', (e) => {
                const addBtn = e.target.closest('[data-action="add-to-cart"]');
                if (addBtn) {
                    e.preventDefault();
                    this.addFromButton(addBtn);
                }
            });

            // Cart item quantity changes
            document.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;

                const action = target.dataset.action;
                const item = target.closest('[data-cart-item]');

                if (action === 'increase-item-qty' && item) {
                    const productId = item.dataset.productId;
                    this.updateQuantity(productId, 1);
                } else if (action === 'decrease-item-qty' && item) {
                    const productId = item.dataset.productId;
                    this.updateQuantity(productId, -1);
                } else if (action === 'remove-item' && item) {
                    const productId = item.dataset.productId;
                    this.removeItem(productId);
                } else if (action === 'clear-cart') {
                    this.clear();
                }
            });

            // Quantity input changes
            document.addEventListener('change', (e) => {
                if (e.target.matches('[data-item-qty]')) {
                    const item = e.target.closest('[data-cart-item]');
                    if (item) {
                        const productId = item.dataset.productId;
                        const newQty = parseInt(e.target.value) || 1;
                        this.setQuantity(productId, newQty);
                    }
                }
            });
        },

        addFromButton(btn) {
            const product = {
                id: btn.dataset.productId,
                name: btn.dataset.productName,
                price: parseFloat(btn.dataset.productPrice) || 0,
                image: btn.dataset.productImage || null,
                variant: btn.dataset.productVariant || null,
                quantity: 1
            };

            // Check for quantity selector on product page
            const qtyInput = $('[data-quantity]');
            if (qtyInput) {
                product.quantity = parseInt(qtyInput.value) || 1;
            }

            // Check for selected variations
            const variations = $$('.variation-option.selected');
            if (variations.length > 0) {
                product.variant = variations.map(v => v.textContent.trim()).join(' / ');
            }

            this.addItem(product);

            // Show feedback
            Toast.show(`${product.name} added to cart!`, 'success');

            // Open cart sidebar
            CartSidebar.open();
        },

        addItem(product) {
            const existingIndex = this.items.findIndex(item =>
                item.id === product.id && item.variant === product.variant
            );

            if (existingIndex > -1) {
                this.items[existingIndex].quantity += product.quantity;
            } else {
                this.items.push(product);
            }

            this.save();
            this.updateUI();
            EventBus.emit('cart:updated', this.items);
        },

        removeItem(productId, variant = null) {
            this.items = this.items.filter(item =>
                !(item.id === productId && (variant === null || item.variant === variant))
            );
            this.save();
            this.updateUI();
            EventBus.emit('cart:updated', this.items);
        },

        updateQuantity(productId, change, variant = null) {
            const item = this.items.find(item =>
                item.id === productId && (variant === null || item.variant === variant)
            );

            if (item) {
                item.quantity = Math.max(1, item.quantity + change);
                this.save();
                this.updateUI();
                EventBus.emit('cart:updated', this.items);
            }
        },

        setQuantity(productId, quantity, variant = null) {
            const item = this.items.find(item =>
                item.id === productId && (variant === null || item.variant === variant)
            );

            if (item) {
                item.quantity = Math.max(1, quantity);
                this.save();
                this.updateUI();
                EventBus.emit('cart:updated', this.items);
            }
        },

        clear() {
            this.items = [];
            this.save();
            this.updateUI();
            EventBus.emit('cart:updated', this.items);
            Toast.show('Cart cleared', 'success');
        },

        getTotal() {
            return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        },

        getItemCount() {
            return this.items.reduce((sum, item) => sum + item.quantity, 0);
        },

        save() {
            Storage.set(this.STORAGE_KEY, this.items);
        },

        updateUI() {
            // Update cart count badges
            $$('[data-cart-count]').forEach(el => {
                el.textContent = this.getItemCount();
            });

            // Update subtotal displays
            $$('[data-cart-subtotal]').forEach(el => {
                el.textContent = formatPrice(this.getTotal());
            });

            // Update cart sidebar items
            this.renderCartSidebar();

            // Update cart page if present
            this.renderCartPage();

            // Update checkout page if present
            this.renderCheckoutPage();
        },

        renderCartSidebar() {
            const container = $('[data-cart-items]');
            const emptyMsg = $('[data-cart-empty]');
            const footer = $('[data-cart-footer]');

            if (!container) return;

            if (this.items.length === 0) {
                if (emptyMsg) emptyMsg.style.display = 'flex';
                if (footer) footer.style.display = 'none';
                $$('[data-cart-item]', container).forEach(el => el.remove());
                return;
            }

            if (emptyMsg) emptyMsg.style.display = 'none';
            if (footer) footer.style.display = 'block';

            // Clear existing items (except empty message)
            $$('[data-cart-item]', container).forEach(el => el.remove());

            // Render items
            this.items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-sidebar-item';
                itemEl.setAttribute('data-cart-item', '');
                itemEl.setAttribute('data-product-id', item.id);

                itemEl.innerHTML = `
                    <img src="${item.image || 'assets/images/placeholder.jpg'}" alt="${item.name}" class="cart-sidebar-item-image">
                    <div class="cart-sidebar-item-info">
                        <span class="cart-sidebar-item-name">${item.name}</span>
                        ${item.variant ? `<span class="cart-sidebar-item-variant">${item.variant}</span>` : ''}
                        <div class="cart-sidebar-item-price">
                            <span class="qty">${item.quantity} x</span>
                            <span>${formatPrice(item.price)}</span>
                        </div>
                    </div>
                    <button class="cart-sidebar-item-remove" data-action="remove-item" aria-label="Remove">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                `;

                container.appendChild(itemEl);
            });
        },

        renderCartPage() {
            const emptyState = $('[data-cart-empty-state]');
            const content = $('[data-cart-content]');
            const itemsList = $('[data-cart-items-list]');

            if (!content || !itemsList) return;

            if (this.items.length === 0) {
                if (emptyState) emptyState.style.display = 'block';
                content.style.display = 'none';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';
            content.style.display = 'block';

            // Clear existing items
            itemsList.innerHTML = '';

            // Render items
            this.items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'cart-item';
                itemEl.setAttribute('data-cart-item', '');
                itemEl.setAttribute('data-product-id', item.id);

                itemEl.innerHTML = `
                    <div class="item-product">
                        <img src="${item.image || 'assets/images/placeholder.jpg'}" alt="${item.name}" class="item-image">
                        <div class="item-details">
                            <a href="product/${item.id}.html" class="item-name">${item.name}</a>
                            ${item.variant ? `<span class="item-variant">${item.variant}</span>` : ''}
                        </div>
                    </div>
                    <div class="item-price">${formatPrice(item.price)}</div>
                    <div class="item-quantity">
                        <button class="qty-btn" data-action="decrease-item-qty">-</button>
                        <input type="number" value="${item.quantity}" min="1" data-item-qty>
                        <button class="qty-btn" data-action="increase-item-qty">+</button>
                    </div>
                    <div class="item-total">${formatPrice(item.price * item.quantity)}</div>
                    <button class="item-remove" data-action="remove-item" aria-label="Remove">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                `;

                itemsList.appendChild(itemEl);
            });

            // Update totals
            $$('[data-cart-total]').forEach(el => {
                el.textContent = formatPrice(this.getTotal());
            });
        },

        renderCheckoutPage() {
            const emptyState = $('[data-checkout-empty]');
            const form = $('[data-checkout-form]');
            const itemsContainer = $('[data-order-items]');

            if (!form) return;

            if (this.items.length === 0) {
                if (emptyState) emptyState.style.display = 'block';
                form.style.display = 'none';
                return;
            }

            if (emptyState) emptyState.style.display = 'none';
            form.style.display = 'block';

            if (itemsContainer) {
                itemsContainer.innerHTML = '';

                this.items.forEach(item => {
                    const itemEl = document.createElement('div');
                    itemEl.className = 'order-item';
                    itemEl.innerHTML = `
                        <img src="${item.image || 'assets/images/placeholder.jpg'}" alt="${item.name}" class="order-item-image">
                        <div class="order-item-details">
                            <span class="order-item-name">${item.name}</span>
                            <span class="order-item-qty">Qty: ${item.quantity}</span>
                        </div>
                        <span class="order-item-price">${formatPrice(item.price * item.quantity)}</span>
                    `;
                    itemsContainer.appendChild(itemEl);
                });
            }

            // Update totals
            $$('[data-checkout-subtotal]').forEach(el => {
                el.textContent = formatPrice(this.getTotal());
            });

            $$('[data-checkout-total]').forEach(el => {
                // Add shipping
                const shippingEl = $('[data-checkout-shipping]');
                const shipping = shippingEl ? parseFloat(shippingEl.textContent.replace(/[^0-9.]/g, '')) || 0 : 0;
                el.textContent = formatPrice(this.getTotal() + shipping);
            });
        }
    };

    // ==========================================================================
    // Cart Sidebar
    // ==========================================================================
    const CartSidebar = {
        sidebar: null,

        init() {
            this.sidebar = $('[data-cart-sidebar]');
            if (!this.sidebar) return;

            this.bindEvents();
        },

        bindEvents() {
            // Toggle cart
            document.addEventListener('click', (e) => {
                const toggle = e.target.closest('[data-action="toggle-cart"]');
                if (toggle) {
                    e.preventDefault();
                    this.toggle();
                }

                const close = e.target.closest('[data-action="close-cart"]');
                if (close) {
                    e.preventDefault();
                    this.close();
                }
            });

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.close();
                }
            });
        },

        isOpen() {
            return this.sidebar?.classList.contains('open');
        },

        open() {
            if (this.sidebar) {
                this.sidebar.classList.add('open');
                this.sidebar.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';
            }
        },

        close() {
            if (this.sidebar) {
                this.sidebar.classList.remove('open');
                this.sidebar.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        },

        toggle() {
            this.isOpen() ? this.close() : this.open();
        }
    };

    // ==========================================================================
    // Search
    // ==========================================================================
    const Search = {
        modal: null,
        input: null,
        results: null,
        searchIndex: null,

        init() {
            this.modal = $('[data-search-modal]');
            this.input = $('[data-search-input]');
            this.results = $('[data-search-results-list]');

            if (!this.modal) return;

            this.bindEvents();
            this.loadSearchIndex();
        },

        bindEvents() {
            // Toggle search modal
            document.addEventListener('click', (e) => {
                const toggle = e.target.closest('[data-action="toggle-search"]');
                if (toggle) {
                    e.preventDefault();
                    this.open();
                }

                const close = e.target.closest('[data-action="close-search"]');
                if (close) {
                    e.preventDefault();
                    this.close();
                }
            });

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.close();
                }

                // Open search with Ctrl/Cmd + K
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    this.open();
                }
            });

            // Live search
            if (this.input) {
                this.input.addEventListener('input', debounce((e) => {
                    this.search(e.target.value);
                }, 300));
            }

            // Search page functionality
            const pageInput = $('[data-search-page-input]');
            if (pageInput) {
                // Get query from URL
                const params = new URLSearchParams(window.location.search);
                const query = params.get('q');

                if (query) {
                    pageInput.value = query;
                    this.loadSearchIndex().then(() => {
                        this.searchPage(query);
                    });
                }

                pageInput.addEventListener('input', debounce((e) => {
                    this.searchPage(e.target.value);
                }, 300));
            }
        },

        async loadSearchIndex() {
            if (this.searchIndex) return this.searchIndex;

            try {
                const response = await fetch('assets/data/search-index.json');
                this.searchIndex = await response.json();
                return this.searchIndex;
            } catch (e) {
                console.warn('Could not load search index:', e);
                this.searchIndex = [];
                return [];
            }
        },

        isOpen() {
            return this.modal?.classList.contains('open');
        },

        open() {
            if (this.modal) {
                this.modal.classList.add('open');
                this.modal.setAttribute('aria-hidden', 'false');
                document.body.style.overflow = 'hidden';

                // Focus input
                setTimeout(() => {
                    if (this.input) this.input.focus();
                }, 100);
            }
        },

        close() {
            if (this.modal) {
                this.modal.classList.remove('open');
                this.modal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = '';
            }
        },

        async search(query) {
            if (!query || query.length < 2) {
                this.showSuggestions();
                return;
            }

            const loading = $('[data-search-loading]');
            const suggestions = $('[data-search-suggestions]');

            if (loading) loading.style.display = 'flex';
            if (suggestions) suggestions.style.display = 'none';

            await this.loadSearchIndex();

            const results = this.performSearch(query);

            if (loading) loading.style.display = 'none';

            this.renderResults(results);
        },

        performSearch(query) {
            const normalizedQuery = query.toLowerCase().trim();
            const words = normalizedQuery.split(/\s+/);

            return this.searchIndex
                .map(product => {
                    const searchText = `${product.name} ${product.sku} ${product.categories} ${product.tags} ${product.description}`.toLowerCase();

                    let score = 0;

                    // Exact name match
                    if (product.name.toLowerCase().includes(normalizedQuery)) {
                        score += 10;
                    }

                    // SKU match
                    if (product.sku && product.sku.toLowerCase() === normalizedQuery) {
                        score += 15;
                    }

                    // Word matches
                    words.forEach(word => {
                        if (searchText.includes(word)) {
                            score += 1;
                        }
                        if (product.name.toLowerCase().includes(word)) {
                            score += 3;
                        }
                    });

                    return { ...product, score };
                })
                .filter(product => product.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
        },

        renderResults(results) {
            if (!this.results) return;

            if (results.length === 0) {
                this.results.innerHTML = `
                    <div class="no-search-results">
                        <p>No products found</p>
                    </div>
                `;
                return;
            }

            this.results.innerHTML = results.map(product => `
                <a href="${product.url}" class="search-result-item">
                    <img src="${product.image || 'assets/images/placeholder.jpg'}" alt="${product.name}" class="search-result-image">
                    <div class="search-result-info">
                        <span class="search-result-name">${product.name}</span>
                        <span class="search-result-price">${formatPrice(product.salePrice || product.price)}</span>
                    </div>
                </a>
            `).join('');
        },

        showSuggestions() {
            const suggestions = $('[data-search-suggestions]');
            if (suggestions) suggestions.style.display = 'block';
            if (this.results) this.results.innerHTML = '';
        },

        async searchPage(query) {
            const info = $('[data-search-info]');
            const noResults = $('[data-no-results]');
            const toolbar = $('[data-search-toolbar]');
            const grid = $('[data-search-results-grid]');
            const categories = $('[data-popular-categories]');

            if (!query || query.length < 2) {
                if (info) info.style.display = 'none';
                if (noResults) noResults.style.display = 'none';
                if (toolbar) toolbar.style.display = 'none';
                if (grid) grid.innerHTML = '';
                if (categories) categories.style.display = 'block';
                return;
            }

            await this.loadSearchIndex();
            const results = this.performSearch(query);

            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('q', query);
            window.history.replaceState({}, '', url);

            // Update UI
            if (categories) categories.style.display = 'none';

            $('[data-search-query]')?.textContent && ($('[data-search-query]').textContent = query);
            $('[data-results-count]')?.textContent && ($('[data-results-count]').textContent = results.length);

            if (results.length === 0) {
                if (info) info.style.display = 'none';
                if (noResults) noResults.style.display = 'block';
                if (toolbar) toolbar.style.display = 'none';
                if (grid) grid.innerHTML = '';
            } else {
                if (info) info.style.display = 'block';
                if (noResults) noResults.style.display = 'none';
                if (toolbar) toolbar.style.display = 'flex';

                if (grid) {
                    grid.innerHTML = results.map(product => `
                        <article class="product-card">
                            <a href="${product.url}" class="product-card-link">
                                <div class="product-image-wrapper">
                                    ${product.image
                                        ? `<img src="${product.image}" alt="${product.name}" loading="lazy" class="product-image">`
                                        : `<div class="product-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`
                                    }
                                </div>
                                <div class="product-info">
                                    <h3 class="product-title">${product.name}</h3>
                                    <div class="product-price">
                                        ${product.salePrice
                                            ? `<span class="price-regular strikethrough">${formatPrice(product.price)}</span><span class="price-sale">${formatPrice(product.salePrice)}</span>`
                                            : `<span class="price-regular">${formatPrice(product.price)}</span>`
                                        }
                                    </div>
                                </div>
                            </a>
                            <div class="product-actions">
                                ${product.inStock
                                    ? `<button class="btn btn-primary add-to-cart" data-action="add-to-cart" data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-image="${product.image || ''}">Add to Cart</button>`
                                    : `<button class="btn btn-secondary" disabled>Out of Stock</button>`
                                }
                            </div>
                        </article>
                    `).join('');
                }
            }

            $('[data-results-summary]')?.textContent && ($('[data-results-summary]').textContent = `Showing ${results.length} results`);
        }
    };

    // ==========================================================================
    // Wishlist
    // ==========================================================================
    const Wishlist = {
        STORAGE_KEY: 'store_wishlist',
        items: [],

        init() {
            if (!CONFIG.enableWishlist) return;

            this.items = Storage.get(this.STORAGE_KEY, []);
            this.updateUI();
            this.bindEvents();
        },

        bindEvents() {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="toggle-wishlist"]');
                if (btn) {
                    e.preventDefault();
                    const productId = btn.dataset.productId;
                    this.toggle(productId);
                }
            });
        },

        toggle(productId) {
            const index = this.items.indexOf(productId);

            if (index > -1) {
                this.items.splice(index, 1);
                Toast.show('Removed from wishlist', 'success');
            } else {
                this.items.push(productId);
                Toast.show('Added to wishlist', 'success');
            }

            this.save();
            this.updateUI();
        },

        save() {
            Storage.set(this.STORAGE_KEY, this.items);
        },

        updateUI() {
            // Update count
            $$('[data-wishlist-count]').forEach(el => {
                el.textContent = this.items.length;
            });

            // Update buttons
            $$('[data-action="toggle-wishlist"]').forEach(btn => {
                const productId = btn.dataset.productId;
                const isInWishlist = this.items.includes(productId);

                btn.classList.toggle('active', isInWishlist);
                btn.setAttribute('aria-pressed', isInWishlist);
            });
        }
    };

    // ==========================================================================
    // Toast Notifications
    // ==========================================================================
    const Toast = {
        container: null,

        init() {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        },

        show(message, type = 'info', duration = 3000) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <span>${message}</span>
                <button onclick="this.parentElement.remove()" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;

            this.container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    };

    // ==========================================================================
    // Product Page
    // ==========================================================================
    const ProductPage = {
        init() {
            this.initGallery();
            this.initQuantity();
            this.initVariations();
            this.initTabs();
            this.initShare();
        },

        initGallery() {
            const thumbs = $$('.gallery-thumb');
            const mainImage = $('#main-image');

            if (!thumbs.length || !mainImage) return;

            thumbs.forEach(thumb => {
                thumb.addEventListener('click', () => {
                    const newSrc = thumb.dataset.image;
                    mainImage.src = newSrc;

                    thumbs.forEach(t => t.classList.remove('active'));
                    thumb.classList.add('active');
                });
            });
        },

        initQuantity() {
            const qtyInput = $('[data-quantity]');
            if (!qtyInput) return;

            document.addEventListener('click', (e) => {
                if (e.target.matches('[data-action="increase-qty"]')) {
                    qtyInput.value = Math.min(parseInt(qtyInput.value) + 1, parseInt(qtyInput.max) || 99);
                }
                if (e.target.matches('[data-action="decrease-qty"]')) {
                    qtyInput.value = Math.max(parseInt(qtyInput.value) - 1, 1);
                }
            });
        },

        initVariations() {
            const variationsContainer = $('[data-variations]');
            if (!variationsContainer) return;

            const options = $$('.variation-option');

            options.forEach(option => {
                option.addEventListener('click', () => {
                    const group = option.closest('.variation-group');
                    $$('.variation-option', group).forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');

                    // Update price if variations have different prices
                    this.updateVariationPrice();
                });
            });
        },

        updateVariationPrice() {
            // This would update price based on selected variation
            // Implementation depends on how variation data is stored
        },

        initTabs() {
            const tabs = $$('.tab-btn');
            const panels = $$('.tab-panel');

            if (!tabs.length) return;

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.dataset.tab;

                    tabs.forEach(t => {
                        t.classList.remove('active');
                        t.setAttribute('aria-selected', 'false');
                    });

                    panels.forEach(p => p.classList.remove('active'));

                    tab.classList.add('active');
                    tab.setAttribute('aria-selected', 'true');

                    const targetPanel = $(`#${targetId}`);
                    if (targetPanel) targetPanel.classList.add('active');
                });
            });
        },

        initShare() {
            document.addEventListener('click', (e) => {
                if (e.target.closest('[data-action="copy-link"]')) {
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        Toast.show('Link copied to clipboard!', 'success');
                    });
                }
            });
        }
    };

    // ==========================================================================
    // Shop Page (filtering, sorting)
    // ==========================================================================
    const ShopPage = {
        products: [],

        init() {
            const grid = $('[data-products-grid]');
            if (!grid) return;

            // Get products data
            const productsData = grid.dataset.products;
            if (productsData) {
                try {
                    this.products = JSON.parse(productsData);
                } catch (e) {
                    this.products = [];
                }
            }

            this.initSorting();
            this.initFiltering();
            this.initViewToggle();
            this.initSidebar();
        },

        initSorting() {
            const sortSelect = $('[data-sort-select]');
            if (!sortSelect) return;

            sortSelect.addEventListener('change', () => {
                this.sortProducts(sortSelect.value);
            });
        },

        sortProducts(method) {
            let sorted = [...this.products];

            switch (method) {
                case 'price-low':
                    sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                    break;
                case 'price-high':
                    sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
                    break;
                case 'name-az':
                    sorted.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'name-za':
                    sorted.sort((a, b) => b.name.localeCompare(a.name));
                    break;
                case 'newest':
                    sorted.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));
                    break;
                case 'rating':
                    sorted.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
                    break;
            }

            this.renderProducts(sorted);
        },

        initFiltering() {
            // Price filter
            const applyPriceBtn = $('[data-action="apply-price-filter"]');
            if (applyPriceBtn) {
                applyPriceBtn.addEventListener('click', () => {
                    this.applyFilters();
                });
            }

            // Stock filter
            const stockCheckbox = $('[data-filter-in-stock]');
            const saleCheckbox = $('[data-filter-on-sale]');

            [stockCheckbox, saleCheckbox].forEach(checkbox => {
                if (checkbox) {
                    checkbox.addEventListener('change', () => {
                        this.applyFilters();
                    });
                }
            });
        },

        applyFilters() {
            const minPrice = parseFloat($('[data-filter-min-price]')?.value) || 0;
            const maxPrice = parseFloat($('[data-filter-max-price]')?.value) || Infinity;
            const inStockOnly = $('[data-filter-in-stock]')?.checked || false;
            const onSaleOnly = $('[data-filter-on-sale]')?.checked || false;

            const filtered = this.products.filter(product => {
                const price = parseFloat(product.price);

                if (price < minPrice || price > maxPrice) return false;
                if (inStockOnly && product.stock_status !== 'instock') return false;
                if (onSaleOnly && !product.on_sale) return false;

                return true;
            });

            this.renderProducts(filtered);

            // Update count
            const countEl = $('[data-showing-count]');
            if (countEl) countEl.textContent = filtered.length;
        },

        renderProducts(products) {
            const grid = $('[data-products-grid]');
            if (!grid) return;

            if (products.length === 0) {
                grid.innerHTML = `
                    <div class="no-products">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"/>
                            <path d="m21 21-4.3-4.3"/>
                        </svg>
                        <h3>No products found</h3>
                        <p>Try adjusting your filters</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = products.map(product => `
                <article class="product-card">
                    <a href="product/${this.slugify(product.name)}-${product.id}.html" class="product-card-link">
                        <div class="product-image-wrapper">
                            ${product.images && product.images[0]
                                ? `<img src="${product.images[0].src}" alt="${product.name}" loading="lazy" class="product-image">`
                                : `<div class="product-image-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`
                            }
                            ${product.on_sale ? '<span class="product-badge sale">Sale</span>' : ''}
                        </div>
                        <div class="product-info">
                            ${product.categories && product.categories[0] ? `<span class="product-category">${product.categories[0].name}</span>` : ''}
                            <h3 class="product-title">${product.name}</h3>
                            <div class="product-price">
                                ${product.on_sale
                                    ? `<span class="price-regular strikethrough">${formatPrice(product.regular_price)}</span><span class="price-sale">${formatPrice(product.sale_price)}</span>`
                                    : `<span class="price-regular">${formatPrice(product.price)}</span>`
                                }
                            </div>
                        </div>
                    </a>
                    <div class="product-actions">
                        ${product.stock_status === 'instock'
                            ? `<button class="btn btn-primary add-to-cart" data-action="add-to-cart" data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-image="${product.images?.[0]?.src || ''}">Add to Cart</button>`
                            : `<button class="btn btn-secondary" disabled>Out of Stock</button>`
                        }
                    </div>
                </article>
            `).join('');
        },

        slugify(text) {
            return text.toString().toLowerCase().trim()
                .replace(/[\s_]+/g, '-')
                .replace(/[^\w\-]+/g, '')
                .replace(/\-\-+/g, '-');
        },

        initViewToggle() {
            const viewBtns = $$('[data-view]');
            const grid = $('[data-products-grid]');

            if (!viewBtns.length || !grid) return;

            viewBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    viewBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    if (btn.dataset.view === 'list') {
                        grid.classList.add('list-view');
                    } else {
                        grid.classList.remove('list-view');
                    }
                });
            });
        },

        initSidebar() {
            const toggleBtn = $('[data-action="toggle-sidebar"]');
            const sidebar = $('[data-sidebar]');

            if (!toggleBtn || !sidebar) return;

            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });

            // Close sidebar on overlay click (mobile)
            document.addEventListener('click', (e) => {
                if (sidebar.classList.contains('open') &&
                    !e.target.closest('[data-sidebar]') &&
                    !e.target.closest('[data-action="toggle-sidebar"]')) {
                    sidebar.classList.remove('open');
                }
            });
        }
    };

    // ==========================================================================
    // Checkout
    // ==========================================================================
    const Checkout = {
        init() {
            const form = $('[data-checkout-form]');
            if (!form) return;

            this.initShippingMethods();
            this.initPaymentMethods();
            this.initFormSubmission();
        },

        initShippingMethods() {
            const methods = $$('[name="shipping_method"]');

            methods.forEach(method => {
                method.addEventListener('change', () => {
                    this.updateTotals();
                });
            });
        },

        initPaymentMethods() {
            const methods = $$('[name="payment_method"]');
            const cardDetails = $('[data-card-details]');

            methods.forEach(method => {
                method.addEventListener('change', () => {
                    if (cardDetails) {
                        cardDetails.style.display = method.value === 'card' ? 'block' : 'none';
                    }
                });
            });
        },

        updateTotals() {
            const selectedShipping = $('[name="shipping_method"]:checked');
            const shippingEl = $('[data-checkout-shipping]');
            const totalEl = $('[data-checkout-total]');

            if (!selectedShipping) return;

            const shippingPrice = selectedShipping.closest('.shipping-option')
                .querySelector('.option-price').textContent;

            const shippingAmount = parseFloat(shippingPrice.replace(/[^0-9.]/g, '')) || 0;

            if (shippingEl) {
                shippingEl.textContent = formatPrice(shippingAmount);
            }

            if (totalEl) {
                const subtotal = Cart.getTotal();
                totalEl.textContent = formatPrice(subtotal + shippingAmount);
            }
        },

        initFormSubmission() {
            const form = $('[data-checkout-form]');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const submitBtn = $('[data-place-order]');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner"></span> Processing...';

                // Simulate order processing
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Show confirmation
                const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
                const email = $('[name="email"]').value;

                form.style.display = 'none';

                const confirmation = $('[data-order-confirmation]');
                if (confirmation) {
                    confirmation.style.display = 'block';
                    $('[data-order-number]').textContent = orderNumber;
                    $('[data-customer-email]').textContent = email;
                }

                // Clear cart
                Cart.clear();

                // Save order to local storage for order history
                const orders = Storage.get('store_orders', []);
                orders.push({
                    id: orderNumber,
                    date: new Date().toISOString(),
                    items: Cart.items,
                    total: Cart.getTotal(),
                    status: 'processing'
                });
                Storage.set('store_orders', orders);
            });
        }
    };

    // ==========================================================================
    // Mobile Navigation
    // ==========================================================================
    const MobileNav = {
        init() {
            const toggle = $('.mobile-menu-toggle');
            const nav = $('.nav-menu');

            if (!toggle || !nav) return;

            toggle.addEventListener('click', () => {
                const isOpen = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', !isOpen);
                nav.classList.toggle('open');
            });
        }
    };

    // ==========================================================================
    // Lazy Loading Images
    // ==========================================================================
    const LazyLoad = {
        init() {
            if ('loading' in HTMLImageElement.prototype) {
                // Native lazy loading supported
                $$('img[loading="lazy"]').forEach(img => {
                    img.src = img.dataset.src || img.src;
                });
            } else {
                // Fallback with Intersection Observer
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src || img.src;
                            observer.unobserve(img);
                        }
                    });
                });

                $$('img[loading="lazy"]').forEach(img => observer.observe(img));
            }
        }
    };

    // ==========================================================================
    // Initialize
    // ==========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        Toast.init();
        Cart.init();
        CartSidebar.init();
        Search.init();
        Wishlist.init();
        ProductPage.init();
        ShopPage.init();
        Checkout.init();
        MobileNav.init();
        LazyLoad.init();

        console.log('Store initialized');
    });

    // Expose for debugging
    window.Store = {
        Cart,
        Search,
        Wishlist,
        EventBus,
        CONFIG
    };
})();
