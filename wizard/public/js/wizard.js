/**
 * Wizard JavaScript - WooCommerce to HTML5 Converter
 * Handles wizard navigation, form validation, and API interactions
 */

class ConversionWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.config = {
            mode: 'live', // 'live' or 'demo'
            connection: {
                siteUrl: '',
                consumerKey: '',
                consumerSecret: ''
            },
            store: {
                siteName: 'My Store',
                siteDescription: 'Your Online Store - Fast, Modern, Beautiful',
                primaryColor: '#2563eb',
                currency: 'USD',
                currencySymbol: '$'
            },
            features: {
                enableSearch: true,
                enableCart: true,
                enableWishlist: false,
                enableReviews: true,
                enablePWA: true,
                optimizeImages: true,
                generateWebp: true
            }
        };
        this.conversionId = null;
        this.eventSource = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateColorPreview();
    }

    bindEvents() {
        // Main navigation buttons
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');

        if (btnNext) {
            btnNext.addEventListener('click', () => this.nextStep());
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', () => this.prevStep());
        }

        // Mode selection
        document.querySelectorAll('input[name="mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleModeChange(e));
        });

        // Test connection button
        const testBtn = document.getElementById('test-connection');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConnection());
        }

        // WooCommerce connection form submit
        const wooForm = document.getElementById('woo-connection-form');
        if (wooForm) {
            wooForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.testConnection();
            });
        }

        // Demo button
        const demoBtn = document.getElementById('use-demo');
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                this.config.mode = 'demo';
                this.nextStep();
            });
        }

        // Color picker
        const colorPicker = document.getElementById('primary-color');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => this.updateColorPreview(e.target.value));
        }

        // Download button
        const downloadBtn = document.getElementById('download-zip');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadSite());
        }

        // Preview button
        const previewBtn = document.getElementById('preview-store');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewSite());
        }

        // New conversion button
        const newBtn = document.getElementById('start-over');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.resetWizard());
        }

        // Feature checkboxes
        document.querySelectorAll('.feature-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleFeatureChange(e));
        });

        // Feature card checkboxes
        document.querySelectorAll('.feature-card input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleFeatureChange(e));
        });

        // Option tabs (WooCommerce vs Demo)
        document.querySelectorAll('.option-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleOptionTab(e));
        });

        // Accordion toggle
        document.querySelectorAll('.accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                const content = e.currentTarget.nextElementSibling;
                if (content) {
                    content.classList.toggle('open');
                }
            });
        });

        // Toggle password visibility
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = e.currentTarget.closest('.form-group').querySelector('input');
                if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                }
            });
        });
    }

    handleOptionTab(e) {
        const option = e.currentTarget.dataset.option;

        // Update tab buttons
        document.querySelectorAll('.option-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.option === option);
        });

        // Update content
        document.querySelectorAll('.option-content').forEach(content => {
            content.classList.toggle('active', content.dataset.option === option);
        });

        // Update mode
        this.config.mode = option === 'demo' ? 'demo' : 'live';
    }

    handleModeChange(e) {
        this.config.mode = e.target.value;
        const liveConfig = document.getElementById('liveConfig');

        if (this.config.mode === 'demo') {
            liveConfig.style.display = 'none';
        } else {
            liveConfig.style.display = 'block';
        }
    }

    handleFeatureChange(e) {
        const featureMap = {
            'enableSearch': 'enableSearch',
            'enableCart': 'enableCart',
            'enableWishlist': 'enableWishlist',
            'enableReviews': 'enableReviews',
            'enablePWA': 'enablePWA',
            'optimizeImages': 'optimizeImages',
            'generateWebp': 'generateWebp',
            'enableSeo': 'enableSeo',
            'minifyAssets': 'optimizeAssets'
        };

        const feature = featureMap[e.target.name];
        if (feature) {
            this.config.features[feature] = e.target.checked;
        }
    }

    updateColorPreview(color) {
        color = color || document.getElementById('primary-color')?.value || '#2563eb';
        this.config.store.primaryColor = color;

        // Update CSS variable for preview
        document.documentElement.style.setProperty('--primary-color', color);

        // Update any preview elements
        const previewElements = document.querySelectorAll('.color-preview');
        previewElements.forEach(el => {
            el.style.backgroundColor = color;
        });
    }

    async nextStep() {
        // Validate current step before proceeding
        if (!this.validateStep(this.currentStep)) {
            return;
        }

        // Collect data from current step
        this.collectStepData(this.currentStep);

        // Start conversion when moving from step 4 to step 5
        if (this.currentStep === 4) {
            this.startConversion();
            return;
        }

        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateNavButtons();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateNavButtons();
        }
    }

    goToStep(step) {
        if (step >= 1 && step <= this.totalSteps) {
            this.currentStep = step;
            this.showStep(step);
            this.updateProgress();
            this.updateNavButtons();
        }
    }

    updateNavButtons() {
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');

        if (btnPrev) {
            btnPrev.disabled = this.currentStep === 1;
        }

        if (btnNext) {
            // Hide on step 5 and 6
            if (this.currentStep >= 5) {
                btnNext.style.display = 'none';
            } else {
                btnNext.style.display = 'inline-flex';
            }

            // Update button text based on step
            if (this.currentStep === 4) {
                btnNext.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Start Conversion
                `;
            } else {
                btnNext.innerHTML = `
                    Next
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                `;
            }
        }

        // Hide prev on step 5 and 6
        if (btnPrev) {
            if (this.currentStep >= 5) {
                btnPrev.style.display = 'none';
            } else {
                btnPrev.style.display = 'inline-flex';
            }
        }
    }

    showStep(step) {
        // Hide all steps
        document.querySelectorAll('.wizard-step').forEach(s => {
            s.classList.remove('active');
        });

        // Show current step
        const currentStepEl = document.getElementById(`step${step}`);
        if (currentStepEl) {
            currentStepEl.classList.add('active');
        }

        // Update step indicators
        document.querySelectorAll('.step').forEach((s, index) => {
            s.classList.remove('active', 'completed');
            if (index + 1 < step) {
                s.classList.add('completed');
            } else if (index + 1 === step) {
                s.classList.add('active');
            }
        });
    }

    updateProgress() {
        const progress = ((this.currentStep - 1) / (this.totalSteps - 1)) * 100;
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }

    validateStep(step) {
        switch (step) {
            case 1:
                return true; // Welcome step, no validation needed

            case 2:
                return this.validateConnectionStep();

            case 3:
                return this.validateStoreStep();

            case 4:
                return true; // Features step, all optional

            case 5:
                return true; // Progress step

            case 6:
                return true; // Complete step

            default:
                return true;
        }
    }

    validateConnectionStep() {
        if (this.config.mode === 'demo') {
            return true;
        }

        const siteUrl = document.getElementById('site-url')?.value.trim();
        const consumerKey = document.getElementById('consumer-key')?.value.trim();
        const consumerSecret = document.getElementById('consumer-secret')?.value.trim();

        if (!siteUrl) {
            this.showError('Please enter your WooCommerce site URL');
            return false;
        }

        if (!this.isValidUrl(siteUrl)) {
            this.showError('Please enter a valid URL');
            return false;
        }

        if (!consumerKey || !consumerSecret) {
            this.showError('Please enter your WooCommerce API credentials');
            return false;
        }

        return true;
    }

    validateStoreStep() {
        const siteName = document.getElementById('site-name')?.value.trim();

        if (!siteName) {
            this.showError('Please enter a site name');
            return false;
        }

        return true;
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    collectStepData(step) {
        switch (step) {
            case 2:
                if (this.config.mode === 'live') {
                    this.config.connection.siteUrl = document.getElementById('site-url')?.value.trim();
                    this.config.connection.consumerKey = document.getElementById('consumer-key')?.value.trim();
                    this.config.connection.consumerSecret = document.getElementById('consumer-secret')?.value.trim();
                }
                break;

            case 3:
                this.config.store.siteName = document.getElementById('site-name')?.value.trim() || 'My Store';
                this.config.store.siteDescription = document.getElementById('site-description')?.value.trim() || '';
                this.config.store.primaryColor = document.getElementById('primary-color')?.value || '#2563eb';
                this.config.store.currency = document.getElementById('currency')?.value || 'USD';
                break;

            case 4:
                // Features are collected via change events
                break;
        }
    }

    async testConnection() {
        const btn = document.getElementById('test-connection');
        const statusEl = document.getElementById('connection-status');

        if (!this.validateConnectionStep()) {
            return;
        }

        this.collectStepData(2);

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Testing...';
        statusEl.className = 'connection-status';
        statusEl.textContent = '';

        try {
            const response = await fetch('/api/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.config.connection)
            });

            const result = await response.json();

            if (result.success) {
                statusEl.className = 'connection-status success';
                statusEl.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Connection successful! Found ${result.productCount || 0} products.
                `;
            } else {
                statusEl.className = 'connection-status error';
                statusEl.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    Connection failed: ${result.error || 'Unknown error'}
                `;
            }
        } catch (error) {
            statusEl.className = 'connection-status error';
            statusEl.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                Network error: ${error.message}
            `;
        }

        btn.disabled = false;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Test Connection
        `;
    }

    async startConversion() {
        // Show progress step
        this.currentStep = 5;
        this.showStep(5);
        this.updateProgress();
        this.updateNavButtons();

        try {
            // Prepare full config
            const fullConfig = {
                mode: this.config.mode,
                ...this.config.connection,
                ...this.config.store,
                ...this.config.features
            };

            // Start conversion
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fullConfig)
            });

            const result = await response.json();

            if (result.conversionId) {
                this.conversionId = result.conversionId;
                this.listenToProgress(result.conversionId);
            } else {
                throw new Error(result.error || 'Failed to start conversion');
            }
        } catch (error) {
            this.showError(`Conversion failed: ${error.message}`);
            this.goToStep(4);
        }
    }

    listenToProgress(conversionId) {
        // Close existing connection
        if (this.eventSource) {
            this.eventSource.close();
        }

        // Connect to SSE endpoint
        this.eventSource = new EventSource(`/api/progress/${conversionId}`);

        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.updateProgressUI(data);
        };

        this.eventSource.addEventListener('complete', (event) => {
            const data = JSON.parse(event.data);
            this.handleConversionComplete(data);
            this.eventSource.close();
        });

        this.eventSource.addEventListener('error', (event) => {
            if (event.data) {
                const data = JSON.parse(event.data);
                this.showError(`Conversion error: ${data.message}`);
            }
            this.eventSource.close();
        });

        this.eventSource.onerror = () => {
            // Connection error - try polling as fallback
            this.eventSource.close();
            this.pollProgress(conversionId);
        };
    }

    async pollProgress(conversionId) {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/progress/${conversionId}/status`);
                const data = await response.json();

                this.updateProgressUI(data);

                if (data.status === 'complete') {
                    clearInterval(pollInterval);
                    this.handleConversionComplete(data);
                } else if (data.status === 'error') {
                    clearInterval(pollInterval);
                    this.showError(`Conversion failed: ${data.error}`);
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 1000);
    }

    updateProgressUI(data) {
        // Update overall progress circle
        const progressCircle = document.getElementById('progress-circle');
        const progressPercent = document.getElementById('progress-percent');

        if (progressCircle && data.progress !== undefined) {
            // SVG circle with r=45 has circumference of 2*PI*45 = ~283
            const circumference = 283;
            const offset = circumference - (data.progress / 100) * circumference;
            progressCircle.style.strokeDashoffset = offset;
        }
        if (progressPercent) {
            progressPercent.textContent = `${Math.round(data.progress || 0)}%`;
        }

        // Update progress title and message
        const progressTitle = document.getElementById('progress-title');
        const progressMessage = document.getElementById('progress-message');
        if (progressTitle && data.currentTask) {
            progressTitle.textContent = data.currentTask;
        }
        if (progressMessage && data.log) {
            progressMessage.textContent = data.log;
        }

        // Update progress step items based on current task
        this.updateProgressSteps(data);

        // Update individual task progress (fallback UI)
        const taskMap = {
            'export': 'export-progress',
            'optimize': 'optimize-progress',
            'generate': 'generate-progress',
            'pwa': 'pwa-progress'
        };

        for (const [task, elementId] of Object.entries(taskMap)) {
            const element = document.getElementById(elementId);
            if (element && data.tasks && data.tasks[task] !== undefined) {
                element.style.width = `${data.tasks[task]}%`;

                // Update parent task item status
                const taskItem = element.closest('.task-item');
                if (taskItem) {
                    taskItem.classList.remove('pending', 'active', 'completed');
                    if (data.tasks[task] === 0) {
                        taskItem.classList.add('pending');
                    } else if (data.tasks[task] < 100) {
                        taskItem.classList.add('active');
                    } else {
                        taskItem.classList.add('completed');
                    }
                }
            }
        }

        // Update log
        if (data.log) {
            this.addLogEntry(data.log);
        }
    }

    updateProgressSteps(data) {
        const stepMap = {
            'connect': { keywords: ['Connect', 'Initializ'], task: 'export', threshold: 0 },
            'products': { keywords: ['product', 'Product', 'Export'], task: 'export', threshold: 30 },
            'images': { keywords: ['image', 'Image', 'Download'], task: 'export', threshold: 80 },
            'generate': { keywords: ['HTML', 'page', 'Page', 'Generat'], task: 'generate', threshold: 0 },
            'optimize': { keywords: ['Optim', 'Minif', 'Compress'], task: 'optimize', threshold: 0 },
            'pwa': { keywords: ['PWA', 'service', 'manifest'], task: 'pwa', threshold: 0 }
        };

        document.querySelectorAll('.progress-step-item').forEach(item => {
            const stepKey = item.dataset.progressStep;
            const stepConfig = stepMap[stepKey];

            if (!stepConfig) return;

            const taskProgress = data.tasks?.[stepConfig.task] || 0;
            const currentTask = data.currentTask || '';

            // Check if this step is active based on keywords
            const isActive = stepConfig.keywords.some(k => currentTask.includes(k));
            const isCompleted = taskProgress >= 100 ||
                (stepConfig.threshold > 0 && taskProgress > stepConfig.threshold);

            item.classList.remove('pending', 'active', 'completed');

            if (isCompleted) {
                item.classList.add('completed');
            } else if (isActive) {
                item.classList.add('active');
            } else {
                item.classList.add('pending');
            }
        });
    }

    addLogEntry(message) {
        const logContainer = document.getElementById('conversion-log');
        if (!logContainer) return;

        const entry = document.createElement('div');
        entry.className = 'log-entry';

        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;

        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    handleConversionComplete(data) {
        // Update stats
        const stats = data.stats || {};

        document.getElementById('stat-pages').textContent = stats.pages || 0;
        document.getElementById('stat-products').textContent = stats.products || 0;
        document.getElementById('stat-images').textContent = stats.images || 0;
        document.getElementById('stat-size').textContent = this.formatBytes(stats.totalSize || 0);

        // Show completion step
        this.goToStep(6);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async downloadSite() {
        if (!this.conversionId) {
            this.showError('No conversion available for download');
            return;
        }

        try {
            window.location.href = `/api/download/${this.conversionId}`;
        } catch (error) {
            this.showError(`Download failed: ${error.message}`);
        }
    }

    previewSite() {
        if (!this.conversionId) {
            // For demo mode, just open the output folder
            window.open('/preview', '_blank');
        } else {
            window.open(`/preview/${this.conversionId}`, '_blank');
        }
    }

    resetWizard() {
        this.currentStep = 1;
        this.config = {
            mode: 'live',
            connection: {
                siteUrl: '',
                consumerKey: '',
                consumerSecret: ''
            },
            store: {
                siteName: 'My Store',
                siteDescription: 'Your Online Store - Fast, Modern, Beautiful',
                primaryColor: '#2563eb',
                currency: 'USD',
                currencySymbol: '$'
            },
            features: {
                enableSearch: true,
                enableCart: true,
                enableWishlist: false,
                enableReviews: true,
                enablePWA: true,
                optimizeImages: true,
                generateWebp: true
            }
        };
        this.conversionId = null;

        // Reset form fields
        document.querySelectorAll('input[type="text"], input[type="password"], textarea').forEach(input => {
            input.value = '';
        });

        // Reset checkboxes to defaults
        document.getElementById('search').checked = true;
        document.getElementById('cart').checked = true;
        document.getElementById('wishlist').checked = false;
        document.getElementById('reviews').checked = true;
        document.getElementById('pwa').checked = true;
        document.getElementById('imageOptimization').checked = true;
        document.getElementById('webp').checked = true;

        // Reset progress
        document.querySelectorAll('.progress-fill').forEach(bar => {
            bar.style.width = '0%';
        });

        // Clear log
        const logContainer = document.getElementById('conversion-log');
        if (logContainer) {
            logContainer.innerHTML = '';
        }

        // Show first step
        this.showStep(1);
        this.updateProgress();
    }

    showError(message) {
        // Create error toast
        const toast = document.createElement('div');
        toast.className = 'toast error';
        toast.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
}

// Initialize wizard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.wizard = new ConversionWizard();
});
