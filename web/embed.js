/**
 * Store Converter - Embeddable Widget
 * Drop-in widget for converting e-commerce stores to HTML5
 *
 * Usage:
 * <div id="store-converter"></div>
 * <script src="https://your-domain.com/embed.js"></script>
 * <script>
 *   StoreConverter.init('#store-converter', {
 *     apiEndpoint: 'https://your-api.com',
 *     theme: 'light',
 *     onComplete: (result) => console.log(result)
 *   });
 * </script>
 */

(function(global) {
    'use strict';

    const VERSION = '2.0.0';

    // Default configuration
    const defaultConfig = {
        apiEndpoint: '/api',
        theme: 'light',
        primaryColor: '#2563eb',
        showPlatforms: ['woocommerce', 'shopify', 'wix', 'squarespace'],
        enableDemo: true,
        labels: {
            title: 'Convert Your Store',
            subtitle: 'Transform your e-commerce store into a blazing-fast HTML5 website',
            selectPlatform: 'Select your platform',
            enterCredentials: 'Enter your store credentials',
            configureStore: 'Configure your store',
            selectFeatures: 'Select features',
            converting: 'Converting your store...',
            complete: 'Conversion complete!',
            download: 'Download ZIP',
            preview: 'Preview Store',
            tryDemo: 'Try Demo',
            startOver: 'Start Over'
        },
        onStart: null,
        onProgress: null,
        onComplete: null,
        onError: null
    };

    // Platform definitions
    const platforms = {
        woocommerce: {
            id: 'woocommerce',
            name: 'WooCommerce',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M5.553 19.556c.046-.048 1.148-1.23 2.447-2.628l2.362-2.542.018 2.451c.01 1.348.03 2.469.045 2.491.037.057 3.167.057 3.203 0 .015-.022.036-1.143.046-2.491l.018-2.451 2.362 2.542c1.3 1.398 2.401 2.58 2.447 2.628.077.077.096.078.509.078h.43l-.063-.1c-.035-.055-1.263-1.413-2.73-3.018-1.466-1.605-2.666-2.936-2.666-2.957 0-.022.576-.67 1.28-1.441 1.556-1.704 3.878-4.265 4.043-4.458l.124-.145h-.895l-2.364 2.59c-1.3 1.425-2.384 2.594-2.409 2.6-.024.005-.045-.984-.045-2.198V6.222h-3.27v3.883c0 1.214-.02 2.203-.045 2.198-.025-.006-1.108-1.175-2.409-2.6l-2.364-2.59h-.895l.124.145c.165.193 2.487 2.754 4.044 4.458.703.771 1.279 1.42 1.279 1.44 0 .022-1.2 1.353-2.666 2.958-1.467 1.605-2.695 2.963-2.73 3.018l-.063.1h.43c.413 0 .432-.001.509-.078z"/></svg>',
            color: '#96588a',
            fields: [
                { name: 'siteUrl', label: 'Store URL', type: 'url', placeholder: 'https://your-store.com' },
                { name: 'consumerKey', label: 'Consumer Key', type: 'text', placeholder: 'ck_...' },
                { name: 'consumerSecret', label: 'Consumer Secret', type: 'password', placeholder: 'cs_...' }
            ]
        },
        shopify: {
            id: 'shopify',
            name: 'Shopify',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M15.337 3.415l-.167.048c-.008 0-.017.008-.024.008-.065.024-.13.04-.195.064-.155-.48-.387-.92-.73-1.248-.48-.464-1.096-.688-1.832-.688h-.088c-.024-.032-.056-.056-.08-.08a2.27 2.27 0 0 0-1.6-.616c-1.248.04-2.488.936-3.496 2.52-.704 1.112-1.24 2.504-1.392 3.584l-2.016.624c-.592.184-.616.2-.696.76-.056.424-1.608 12.36-1.608 12.36L14.57 24l7.38-1.6s-3.2-21.68-3.224-21.848a.55.55 0 0 0-.52-.472c-.152-.008-.616.336-.87.336zM12.17 4.81l-.008 1.744-2.848.88c.28-1.08.808-2.152 1.456-2.856.24-.264.584-.56.984-.728.152.296.264.632.416.96zm-1.52-1.568c.32 0 .584.064.8.2-.368.184-.728.472-1.064.832-.864.936-1.528 2.392-1.792 3.792l-2.32.72c.464-2.096 2.272-5.488 4.376-5.544zm.64 10.168s-.792-.416-1.76-.416c-1.424 0-1.496.896-1.496 1.12 0 1.224 3.2 1.696 3.2 4.568 0 2.264-1.432 3.72-3.368 3.72-2.32 0-3.504-1.448-3.504-1.448l.616-2.04s1.216 1.048 2.248 1.048c.672 0 .944-.528.944-.92 0-1.608-2.624-1.68-2.624-4.304 0-2.216 1.584-4.36 4.792-4.36 1.232 0 1.84.352 1.84.352l-.888 2.68z"/></svg>',
            color: '#96bf48',
            fields: [
                { name: 'shopDomain', label: 'Shop Domain', type: 'text', placeholder: 'your-store.myshopify.com' },
                { name: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'shpat_...' }
            ]
        },
        wix: {
            id: 'wix',
            name: 'Wix',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M4.82 8.52c-.62 0-1.16.34-1.7.73-.14-.25-.3-.47-.6-.59-.3-.14-.66-.11-1 .05-.65.28-1.11.84-1.38 1.47-.06.13-.1.27-.13.41l-.01.04v4.67c0 .73.59 1.42 1.32 1.42.73 0 1.32-.69 1.32-1.42V11.9c.15-.14.3-.26.44-.35.13-.08.25-.13.36-.13.1 0 .18.04.24.12.06.08.1.2.1.36v3.4c0 .73.58 1.42 1.31 1.42.73 0 1.32-.69 1.32-1.42V11.9c.16-.14.3-.26.44-.35.13-.08.25-.13.36-.13.1 0 .18.04.24.12.06.08.1.2.1.36v3.4c0 .73.58 1.42 1.31 1.42.73 0 1.32-.69 1.32-1.42v-3.56c0-1.22-.62-2.09-1.86-2.09-.6 0-1.14.31-1.66.67-.24-.43-.65-.67-1.19-.67-.6 0-1.14.31-1.66.67-.24-.43-.65-.67-1.19-.67z"/><path d="M13.28 9.07c-.67 0-1.23.22-1.65.65-.42.43-.64.98-.64 1.65v4.02c0 .73.59 1.42 1.32 1.42.73 0 1.32-.69 1.32-1.42V11.3c0-.2.06-.36.18-.49.12-.13.28-.19.47-.19.19 0 .35.06.47.19.12.13.18.3.18.5v4.08c0 .73.59 1.42 1.32 1.42.73 0 1.32-.69 1.32-1.42v-4.02c0-.67-.21-1.22-.64-1.65-.42-.43-.97-.65-1.65-.65-.31 0-.6.06-.86.18a2.2 2.2 0 0 0-.86-.18z"/><path d="M21.55 8.52c-.31 0-.6.06-.86.18a2.2 2.2 0 0 0-.86-.18c-.67 0-1.22.22-1.65.65-.42.43-.63.98-.63 1.65v4.57c0 .73.58 1.42 1.31 1.42.73 0 1.32-.69 1.32-1.42V11.3c0-.2.06-.36.18-.49.12-.13.28-.19.47-.19.2 0 .35.06.47.19.12.13.18.3.18.5l.01 4.08c0 .73.58 1.42 1.31 1.42.73 0 1.32-.69 1.32-1.42v-4.02c0-.67-.21-1.22-.63-1.65-.43-.43-.98-.65-1.65-.65z"/></svg>',
            color: '#0c6efc',
            fields: [
                { name: 'siteId', label: 'Site ID', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your Wix API Key' },
                { name: 'accountId', label: 'Account ID', type: 'text', placeholder: 'Your Account ID' }
            ]
        },
        squarespace: {
            id: 'squarespace',
            name: 'Squarespace',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5.8 7.2L14 13l3.8 3.8c.4.4.4 1 0 1.4-.4.4-1 .4-1.4 0L12.6 14.4l-3.8 3.8c-.4.4-1 .4-1.4 0-.4-.4-.4-1 0-1.4l3.8-3.8-3.8-3.8c-.4-.4-.4-1 0-1.4.4-.4 1-.4 1.4 0l3.8 3.8 3.8-3.8c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4z"/></svg>',
            color: '#000000',
            fields: [
                { name: 'siteUrl', label: 'Site URL', type: 'url', placeholder: 'https://your-site.squarespace.com' },
                { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Your Squarespace API Key' }
            ]
        }
    };

    class StoreConverterWidget {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            this.config = { ...defaultConfig, ...options };
            this.currentStep = 1;
            this.selectedPlatform = null;
            this.credentials = {};
            this.storeConfig = {
                siteName: 'My Store',
                primaryColor: this.config.primaryColor,
                currency: 'USD'
            };
            this.features = {
                enableSearch: true,
                enableCart: true,
                enablePWA: true,
                optimizeImages: true
            };
            this.conversionId = null;
            this.eventSource = null;

            this.init();
        }

        init() {
            if (!this.container) {
                console.error('StoreConverter: Container element not found');
                return;
            }

            this.injectStyles();
            this.render();
            this.bindEvents();
        }

        injectStyles() {
            if (document.getElementById('store-converter-styles')) return;

            const styles = document.createElement('style');
            styles.id = 'store-converter-styles';
            styles.textContent = this.getStyles();
            document.head.appendChild(styles);
        }

        getStyles() {
            const theme = this.config.theme === 'dark' ? {
                bg: '#1a1a2e',
                bgAlt: '#16213e',
                text: '#eaeaea',
                textMuted: '#a0a0a0',
                border: '#2a2a4a',
                primary: this.config.primaryColor
            } : {
                bg: '#ffffff',
                bgAlt: '#f8fafc',
                text: '#1f2937',
                textMuted: '#6b7280',
                border: '#e5e7eb',
                primary: this.config.primaryColor
            };

            return `
                .sc-widget {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: ${theme.bg};
                    color: ${theme.text};
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    overflow: hidden;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .sc-header {
                    padding: 24px;
                    text-align: center;
                    border-bottom: 1px solid ${theme.border};
                }
                .sc-header h2 {
                    margin: 0 0 8px;
                    font-size: 24px;
                    font-weight: 600;
                }
                .sc-header p {
                    margin: 0;
                    color: ${theme.textMuted};
                    font-size: 14px;
                }
                .sc-body {
                    padding: 24px;
                }
                .sc-step {
                    display: none;
                }
                .sc-step.active {
                    display: block;
                }
                .sc-platforms {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .sc-platform {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 20px;
                    background: ${theme.bgAlt};
                    border: 2px solid ${theme.border};
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .sc-platform:hover {
                    border-color: ${theme.primary};
                }
                .sc-platform.selected {
                    border-color: ${theme.primary};
                    background: ${theme.primary}10;
                }
                .sc-platform-icon {
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sc-platform-icon svg {
                    width: 32px;
                    height: 32px;
                }
                .sc-platform-name {
                    font-weight: 500;
                    font-size: 14px;
                }
                .sc-form-group {
                    margin-bottom: 16px;
                }
                .sc-form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 14px;
                    font-weight: 500;
                }
                .sc-form-group input,
                .sc-form-group select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid ${theme.border};
                    border-radius: 6px;
                    font-size: 14px;
                    background: ${theme.bg};
                    color: ${theme.text};
                    box-sizing: border-box;
                }
                .sc-form-group input:focus,
                .sc-form-group select:focus {
                    outline: none;
                    border-color: ${theme.primary};
                    box-shadow: 0 0 0 3px ${theme.primary}20;
                }
                .sc-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 24px;
                    font-size: 14px;
                    font-weight: 500;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .sc-btn-primary {
                    background: ${theme.primary};
                    color: white;
                }
                .sc-btn-primary:hover {
                    opacity: 0.9;
                }
                .sc-btn-secondary {
                    background: ${theme.bgAlt};
                    color: ${theme.text};
                    border: 1px solid ${theme.border};
                }
                .sc-btn-secondary:hover {
                    background: ${theme.border};
                }
                .sc-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .sc-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 20px;
                }
                .sc-actions .sc-btn {
                    flex: 1;
                }
                .sc-progress {
                    text-align: center;
                    padding: 40px 20px;
                }
                .sc-progress-circle {
                    width: 120px;
                    height: 120px;
                    margin: 0 auto 20px;
                    position: relative;
                }
                .sc-progress-circle svg {
                    transform: rotate(-90deg);
                }
                .sc-progress-bg {
                    fill: none;
                    stroke: ${theme.border};
                    stroke-width: 8;
                }
                .sc-progress-bar {
                    fill: none;
                    stroke: ${theme.primary};
                    stroke-width: 8;
                    stroke-linecap: round;
                    stroke-dasharray: 283;
                    stroke-dashoffset: 283;
                    transition: stroke-dashoffset 0.3s;
                }
                .sc-progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 28px;
                    font-weight: 700;
                }
                .sc-progress-status {
                    font-size: 14px;
                    color: ${theme.textMuted};
                    margin-top: 12px;
                }
                .sc-complete {
                    text-align: center;
                    padding: 40px 20px;
                }
                .sc-complete-icon {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 20px;
                    background: #10b98120;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #10b981;
                }
                .sc-complete h3 {
                    margin: 0 0 8px;
                    font-size: 20px;
                }
                .sc-complete p {
                    margin: 0 0 24px;
                    color: ${theme.textMuted};
                }
                .sc-stats {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-bottom: 24px;
                }
                .sc-stat {
                    background: ${theme.bgAlt};
                    padding: 16px;
                    border-radius: 8px;
                    text-align: center;
                }
                .sc-stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: ${theme.primary};
                }
                .sc-stat-label {
                    font-size: 12px;
                    color: ${theme.textMuted};
                    margin-top: 4px;
                }
                .sc-features {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }
                .sc-feature {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px;
                    background: ${theme.bgAlt};
                    border: 1px solid ${theme.border};
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                }
                .sc-feature input {
                    display: none;
                }
                .sc-feature.checked {
                    border-color: ${theme.primary};
                    background: ${theme.primary}10;
                }
                .sc-feature-check {
                    width: 18px;
                    height: 18px;
                    border: 2px solid ${theme.border};
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sc-feature.checked .sc-feature-check {
                    background: ${theme.primary};
                    border-color: ${theme.primary};
                    color: white;
                }
                .sc-demo-btn {
                    display: block;
                    width: 100%;
                    margin-top: 16px;
                    text-align: center;
                    padding: 12px;
                    background: ${theme.bgAlt};
                    border: 1px dashed ${theme.border};
                    border-radius: 6px;
                    cursor: pointer;
                    color: ${theme.textMuted};
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .sc-demo-btn:hover {
                    border-color: ${theme.primary};
                    color: ${theme.primary};
                }
                .sc-error {
                    background: #fee2e2;
                    color: #991b1b;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 16px;
                    font-size: 14px;
                }
                .sc-spinner {
                    width: 18px;
                    height: 18px;
                    border: 2px solid currentColor;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: sc-spin 0.8s linear infinite;
                }
                @keyframes sc-spin {
                    to { transform: rotate(360deg); }
                }
            `;
        }

        render() {
            this.container.innerHTML = `
                <div class="sc-widget">
                    <div class="sc-header">
                        <h2>${this.config.labels.title}</h2>
                        <p>${this.config.labels.subtitle}</p>
                    </div>
                    <div class="sc-body">
                        <div class="sc-error" style="display: none;"></div>

                        <!-- Step 1: Platform Selection -->
                        <div class="sc-step active" data-step="1">
                            <h3 style="margin: 0 0 16px; font-size: 16px;">${this.config.labels.selectPlatform}</h3>
                            <div class="sc-platforms">
                                ${this.renderPlatforms()}
                            </div>
                            ${this.config.enableDemo ? `
                                <div class="sc-demo-btn" data-action="demo">
                                    ${this.config.labels.tryDemo}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Step 2: Credentials -->
                        <div class="sc-step" data-step="2">
                            <h3 style="margin: 0 0 16px; font-size: 16px;">${this.config.labels.enterCredentials}</h3>
                            <div class="sc-credentials-form"></div>
                            <div class="sc-actions">
                                <button class="sc-btn sc-btn-secondary" data-action="back">Back</button>
                                <button class="sc-btn sc-btn-primary" data-action="test-connection">Test & Continue</button>
                            </div>
                        </div>

                        <!-- Step 3: Configuration -->
                        <div class="sc-step" data-step="3">
                            <h3 style="margin: 0 0 16px; font-size: 16px;">${this.config.labels.configureStore}</h3>
                            <div class="sc-form-group">
                                <label>Store Name</label>
                                <input type="text" name="siteName" value="My Store" />
                            </div>
                            <div class="sc-form-group">
                                <label>Primary Color</label>
                                <input type="color" name="primaryColor" value="${this.config.primaryColor}" />
                            </div>
                            <div class="sc-form-group">
                                <label>Currency</label>
                                <select name="currency">
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (&#8364;)</option>
                                    <option value="GBP">GBP (&#163;)</option>
                                    <option value="CAD">CAD (C$)</option>
                                    <option value="AUD">AUD (A$)</option>
                                </select>
                            </div>
                            <div class="sc-actions">
                                <button class="sc-btn sc-btn-secondary" data-action="back">Back</button>
                                <button class="sc-btn sc-btn-primary" data-action="next">Next</button>
                            </div>
                        </div>

                        <!-- Step 4: Features -->
                        <div class="sc-step" data-step="4">
                            <h3 style="margin: 0 0 16px; font-size: 16px;">${this.config.labels.selectFeatures}</h3>
                            <div class="sc-features">
                                ${this.renderFeatures()}
                            </div>
                            <div class="sc-actions">
                                <button class="sc-btn sc-btn-secondary" data-action="back">Back</button>
                                <button class="sc-btn sc-btn-primary" data-action="convert">Start Conversion</button>
                            </div>
                        </div>

                        <!-- Step 5: Progress -->
                        <div class="sc-step" data-step="5">
                            <div class="sc-progress">
                                <div class="sc-progress-circle">
                                    <svg viewBox="0 0 100 100" width="120" height="120">
                                        <circle class="sc-progress-bg" cx="50" cy="50" r="45" />
                                        <circle class="sc-progress-bar" cx="50" cy="50" r="45" />
                                    </svg>
                                    <div class="sc-progress-text">0%</div>
                                </div>
                                <h3 style="margin: 0;">${this.config.labels.converting}</h3>
                                <p class="sc-progress-status">Initializing...</p>
                            </div>
                        </div>

                        <!-- Step 6: Complete -->
                        <div class="sc-step" data-step="6">
                            <div class="sc-complete">
                                <div class="sc-complete-icon">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                        <polyline points="22 4 12 14.01 9 11.01"/>
                                    </svg>
                                </div>
                                <h3>${this.config.labels.complete}</h3>
                                <p>Your store has been converted successfully.</p>
                                <div class="sc-stats">
                                    <div class="sc-stat">
                                        <div class="sc-stat-value" data-stat="pages">0</div>
                                        <div class="sc-stat-label">Pages</div>
                                    </div>
                                    <div class="sc-stat">
                                        <div class="sc-stat-value" data-stat="products">0</div>
                                        <div class="sc-stat-label">Products</div>
                                    </div>
                                    <div class="sc-stat">
                                        <div class="sc-stat-value" data-stat="images">0</div>
                                        <div class="sc-stat-label">Images</div>
                                    </div>
                                    <div class="sc-stat">
                                        <div class="sc-stat-value" data-stat="size">0 MB</div>
                                        <div class="sc-stat-label">Size</div>
                                    </div>
                                </div>
                                <div class="sc-actions">
                                    <button class="sc-btn sc-btn-primary" data-action="download">${this.config.labels.download}</button>
                                    <button class="sc-btn sc-btn-secondary" data-action="preview">${this.config.labels.preview}</button>
                                </div>
                                <button class="sc-demo-btn" data-action="reset" style="margin-top: 16px;">
                                    ${this.config.labels.startOver}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        renderPlatforms() {
            return this.config.showPlatforms
                .filter(id => platforms[id])
                .map(id => {
                    const platform = platforms[id];
                    return `
                        <div class="sc-platform" data-platform="${id}">
                            <div class="sc-platform-icon" style="color: ${platform.color}">
                                ${platform.icon}
                            </div>
                            <span class="sc-platform-name">${platform.name}</span>
                        </div>
                    `;
                }).join('');
        }

        renderFeatures() {
            const features = [
                { id: 'enableSearch', label: 'Search', checked: true },
                { id: 'enableCart', label: 'Shopping Cart', checked: true },
                { id: 'enablePWA', label: 'PWA Support', checked: true },
                { id: 'optimizeImages', label: 'Image Optimization', checked: true },
                { id: 'enableWishlist', label: 'Wishlist', checked: false },
                { id: 'enableReviews', label: 'Reviews', checked: true }
            ];

            return features.map(f => `
                <label class="sc-feature ${f.checked ? 'checked' : ''}">
                    <input type="checkbox" name="${f.id}" ${f.checked ? 'checked' : ''} />
                    <span class="sc-feature-check">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </span>
                    <span>${f.label}</span>
                </label>
            `).join('');
        }

        bindEvents() {
            // Platform selection
            this.container.querySelectorAll('.sc-platform').forEach(el => {
                el.addEventListener('click', () => this.selectPlatform(el.dataset.platform));
            });

            // Demo button
            this.container.querySelector('[data-action="demo"]')?.addEventListener('click', () => {
                this.selectedPlatform = 'demo';
                this.goToStep(3);
            });

            // Action buttons
            this.container.querySelectorAll('[data-action]').forEach(el => {
                el.addEventListener('click', () => this.handleAction(el.dataset.action));
            });

            // Feature checkboxes
            this.container.querySelectorAll('.sc-feature').forEach(el => {
                el.addEventListener('click', () => {
                    const input = el.querySelector('input');
                    input.checked = !input.checked;
                    el.classList.toggle('checked', input.checked);
                    this.features[input.name] = input.checked;
                });
            });

            // Form inputs
            this.container.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('change', (e) => {
                    if (e.target.closest('.sc-credentials-form')) {
                        this.credentials[e.target.name] = e.target.value;
                    } else {
                        this.storeConfig[e.target.name] = e.target.value;
                    }
                });
            });
        }

        selectPlatform(platformId) {
            this.selectedPlatform = platformId;

            // Update UI
            this.container.querySelectorAll('.sc-platform').forEach(el => {
                el.classList.toggle('selected', el.dataset.platform === platformId);
            });

            // Show credentials form
            this.renderCredentialsForm();
            this.goToStep(2);
        }

        renderCredentialsForm() {
            const platform = platforms[this.selectedPlatform];
            if (!platform) return;

            const formHtml = platform.fields.map(field => `
                <div class="sc-form-group">
                    <label>${field.label}</label>
                    <input
                        type="${field.type}"
                        name="${field.name}"
                        placeholder="${field.placeholder}"
                    />
                </div>
            `).join('');

            this.container.querySelector('.sc-credentials-form').innerHTML = formHtml;

            // Rebind input events
            this.container.querySelectorAll('.sc-credentials-form input').forEach(el => {
                el.addEventListener('change', (e) => {
                    this.credentials[e.target.name] = e.target.value;
                });
            });
        }

        handleAction(action) {
            switch (action) {
                case 'back':
                    this.goToStep(this.currentStep - 1);
                    break;
                case 'next':
                    this.goToStep(this.currentStep + 1);
                    break;
                case 'test-connection':
                    this.testConnection();
                    break;
                case 'convert':
                    this.startConversion();
                    break;
                case 'download':
                    this.downloadResult();
                    break;
                case 'preview':
                    this.previewResult();
                    break;
                case 'reset':
                    this.reset();
                    break;
            }
        }

        goToStep(step) {
            this.currentStep = step;
            this.container.querySelectorAll('.sc-step').forEach(el => {
                el.classList.toggle('active', parseInt(el.dataset.step) === step);
            });
        }

        showError(message) {
            const errorEl = this.container.querySelector('.sc-error');
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            setTimeout(() => errorEl.style.display = 'none', 5000);
        }

        async testConnection() {
            const btn = this.container.querySelector('[data-action="test-connection"]');
            btn.disabled = true;
            btn.innerHTML = '<span class="sc-spinner"></span> Testing...';

            try {
                const response = await fetch(`${this.config.apiEndpoint}/test-connection`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: this.selectedPlatform,
                        ...this.credentials
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this.goToStep(3);
                } else {
                    this.showError(result.error || 'Connection failed');
                }
            } catch (error) {
                this.showError('Network error: ' + error.message);
            }

            btn.disabled = false;
            btn.innerHTML = 'Test & Continue';
        }

        async startConversion() {
            if (this.config.onStart) {
                this.config.onStart({
                    platform: this.selectedPlatform,
                    credentials: this.credentials,
                    config: this.storeConfig,
                    features: this.features
                });
            }

            this.goToStep(5);

            try {
                const response = await fetch(`${this.config.apiEndpoint}/convert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: this.selectedPlatform,
                        mode: this.selectedPlatform === 'demo' ? 'demo' : 'live',
                        ...this.credentials,
                        ...this.storeConfig,
                        ...this.features
                    })
                });

                const result = await response.json();

                if (result.conversionId) {
                    this.conversionId = result.conversionId;
                    this.listenToProgress();
                } else {
                    throw new Error(result.error || 'Failed to start conversion');
                }
            } catch (error) {
                this.showError(error.message);
                this.goToStep(4);

                if (this.config.onError) {
                    this.config.onError(error);
                }
            }
        }

        listenToProgress() {
            this.eventSource = new EventSource(`${this.config.apiEndpoint}/progress/${this.conversionId}`);

            this.eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.updateProgress(data);

                if (this.config.onProgress) {
                    this.config.onProgress(data);
                }
            };

            this.eventSource.addEventListener('complete', (event) => {
                const data = JSON.parse(event.data);
                this.handleComplete(data);
                this.eventSource.close();
            });

            this.eventSource.onerror = () => {
                this.eventSource.close();
                this.pollProgress();
            };
        }

        async pollProgress() {
            const poll = async () => {
                try {
                    const response = await fetch(`${this.config.apiEndpoint}/progress/${this.conversionId}/status`);
                    const data = await response.json();

                    this.updateProgress(data);

                    if (data.status === 'complete') {
                        this.handleComplete(data);
                    } else if (data.status !== 'error') {
                        setTimeout(poll, 1000);
                    }
                } catch (error) {
                    setTimeout(poll, 2000);
                }
            };
            poll();
        }

        updateProgress(data) {
            const progress = data.progress || 0;
            const circumference = 283;
            const offset = circumference - (progress / 100) * circumference;

            this.container.querySelector('.sc-progress-bar').style.strokeDashoffset = offset;
            this.container.querySelector('.sc-progress-text').textContent = `${Math.round(progress)}%`;

            if (data.currentTask) {
                this.container.querySelector('.sc-progress-status').textContent = data.currentTask;
            }
        }

        handleComplete(data) {
            const stats = data.stats || {};

            this.container.querySelector('[data-stat="pages"]').textContent = stats.pages || 0;
            this.container.querySelector('[data-stat="products"]').textContent = stats.products || 0;
            this.container.querySelector('[data-stat="images"]').textContent = stats.images || 0;
            this.container.querySelector('[data-stat="size"]').textContent = this.formatBytes(stats.totalSize || 0);

            this.goToStep(6);

            if (this.config.onComplete) {
                this.config.onComplete({
                    conversionId: this.conversionId,
                    stats
                });
            }
        }

        formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        downloadResult() {
            window.location.href = `${this.config.apiEndpoint}/download/${this.conversionId}`;
        }

        previewResult() {
            window.open(`${this.config.apiEndpoint}/preview/${this.conversionId}`, '_blank');
        }

        reset() {
            this.currentStep = 1;
            this.selectedPlatform = null;
            this.credentials = {};
            this.conversionId = null;

            if (this.eventSource) {
                this.eventSource.close();
            }

            this.render();
            this.bindEvents();
        }
    }

    // Public API
    const StoreConverter = {
        version: VERSION,

        init(container, options) {
            return new StoreConverterWidget(container, options);
        },

        platforms,

        // For programmatic use
        async convert(apiEndpoint, config) {
            const response = await fetch(`${apiEndpoint}/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            return response.json();
        }
    };

    // Export for different module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = StoreConverter;
    } else {
        global.StoreConverter = StoreConverter;
    }

})(typeof window !== 'undefined' ? window : global);
