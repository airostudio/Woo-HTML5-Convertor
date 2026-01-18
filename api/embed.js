// Vercel Serverless Function: GET /api/embed
// Serves the embeddable widget JavaScript

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const embedScript = `
(function() {
    'use strict';

    const API_BASE = window.STORE_CONVERTER_API || '';

    // Styles
    const styles = \`
        .sc-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; }
        .sc-widget * { box-sizing: border-box; }
        .sc-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); padding: 24px; }
        .sc-title { font-size: 24px; font-weight: 600; margin: 0 0 8px; color: #1a1a1a; }
        .sc-subtitle { color: #666; margin: 0 0 24px; }
        .sc-platforms { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        .sc-platform { border: 2px solid #e5e7eb; border-radius: 8px; padding: 16px; cursor: pointer; transition: all 0.2s; text-align: center; }
        .sc-platform:hover { border-color: #3b82f6; background: #f8fafc; }
        .sc-platform.selected { border-color: #3b82f6; background: #eff6ff; }
        .sc-platform-icon { width: 48px; height: 48px; margin: 0 auto 8px; }
        .sc-platform-name { font-weight: 500; color: #1a1a1a; }
        .sc-form { display: none; }
        .sc-form.active { display: block; }
        .sc-field { margin-bottom: 16px; }
        .sc-label { display: block; font-weight: 500; margin-bottom: 6px; color: #374151; }
        .sc-input { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
        .sc-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
        .sc-btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .sc-btn-primary { background: #3b82f6; color: white; }
        .sc-btn-primary:hover { background: #2563eb; }
        .sc-btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }

        /* Enhanced Progress Styles */
        .sc-progress { display: none; padding: 24px 0; }
        .sc-progress.active { display: block; }

        .sc-progress-header { display: flex; align-items: center; margin-bottom: 20px; }
        .sc-progress-icon { width: 48px; height: 48px; margin-right: 16px; position: relative; }
        .sc-progress-ring { width: 48px; height: 48px; }
        .sc-progress-ring-circle { fill: none; stroke: #e5e7eb; stroke-width: 4; }
        .sc-progress-ring-progress { fill: none; stroke: #3b82f6; stroke-width: 4; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 0.3s; }
        .sc-progress-percent { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; font-weight: 600; color: #3b82f6; }

        .sc-progress-info { flex: 1; }
        .sc-progress-stage { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
        .sc-progress-status { font-size: 14px; color: #666; }

        /* Main Progress Bar */
        .sc-main-progress { margin-bottom: 24px; }
        .sc-main-progress-label { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #666; }
        .sc-main-progress-bar { height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; }
        .sc-main-progress-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 5px; transition: width 0.3s ease; position: relative; }
        .sc-main-progress-fill::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: sc-shimmer 1.5s infinite; }
        @keyframes sc-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* Sub-task Progress */
        .sc-subtasks { background: #f9fafb; border-radius: 8px; padding: 16px; }
        .sc-subtasks-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }

        .sc-subtask { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .sc-subtask:last-child { border-bottom: none; }
        .sc-subtask-icon { width: 20px; height: 20px; margin-right: 12px; display: flex; align-items: center; justify-content: center; }
        .sc-subtask-spinner { width: 16px; height: 16px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: sc-spin 0.8s linear infinite; }
        .sc-subtask-check { color: #10b981; font-size: 16px; }
        .sc-subtask-pending { width: 8px; height: 8px; background: #d1d5db; border-radius: 50%; }
        .sc-subtask-info { flex: 1; }
        .sc-subtask-name { font-size: 14px; color: #374151; font-weight: 500; }
        .sc-subtask-detail { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .sc-subtask-progress { width: 60px; }
        .sc-subtask-bar { height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden; }
        .sc-subtask-fill { height: 100%; background: #3b82f6; transition: width 0.3s; }

        @keyframes sc-spin { to { transform: rotate(360deg); } }
        @keyframes sc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        .sc-subtask.active .sc-subtask-name { color: #1a1a1a; }
        .sc-subtask.completed .sc-subtask-name { color: #10b981; }
        .sc-subtask.pending .sc-subtask-name { color: #9ca3af; }

        /* Live Log */
        .sc-live-log { margin-top: 16px; background: #1a1a1a; border-radius: 8px; padding: 12px; max-height: 120px; overflow-y: auto; }
        .sc-log-entry { font-family: 'Monaco', 'Menlo', monospace; font-size: 11px; color: #10b981; padding: 2px 0; animation: sc-fade-in 0.3s ease; }
        .sc-log-entry.info { color: #3b82f6; }
        .sc-log-entry.warn { color: #f59e0b; }
        .sc-log-entry.error { color: #ef4444; }
        .sc-log-time { color: #6b7280; margin-right: 8px; }
        @keyframes sc-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

        .sc-result { display: none; text-align: center; padding: 40px 0; }
        .sc-result.active { display: block; }
        .sc-result-icon { font-size: 48px; margin-bottom: 16px; }
        .sc-result-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .sc-error { color: #dc2626; background: #fef2f2; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: none; }
        .sc-error.active { display: block; }
    \`;

    // Conversion stages with sub-tasks
    const CONVERSION_STAGES = [
        {
            id: 'connect',
            name: 'Connecting to Store',
            subtasks: [
                { id: 'auth', name: 'Authenticating', detail: 'Validating API credentials' },
                { id: 'fetch-info', name: 'Fetching store info', detail: 'Getting store metadata' }
            ]
        },
        {
            id: 'export',
            name: 'Exporting Data',
            subtasks: [
                { id: 'products', name: 'Fetching products', detail: 'Downloading product catalog' },
                { id: 'categories', name: 'Fetching categories', detail: 'Organizing product categories' },
                { id: 'images', name: 'Processing images', detail: 'Optimizing product images' }
            ]
        },
        {
            id: 'generate',
            name: 'Generating HTML',
            subtasks: [
                { id: 'templates', name: 'Building templates', detail: 'Creating page layouts' },
                { id: 'pages', name: 'Generating pages', detail: 'Creating product pages' },
                { id: 'styles', name: 'Compiling styles', detail: 'Optimizing CSS' },
                { id: 'scripts', name: 'Bundling scripts', detail: 'Minifying JavaScript' }
            ]
        },
        {
            id: 'package',
            name: 'Packaging',
            subtasks: [
                { id: 'compress', name: 'Compressing files', detail: 'Creating ZIP archive' },
                { id: 'upload', name: 'Preparing download', detail: 'Finalizing package' }
            ]
        }
    ];

    class StoreConverterWidget {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            this.options = {
                apiEndpoint: options.apiEndpoint || API_BASE || '/api',
                theme: options.theme || 'light',
                primaryColor: options.primaryColor || '#3b82f6',
                onComplete: options.onComplete || null,
                onError: options.onError || null
            };
            this.selectedPlatform = null;
            this.platforms = [];
            this.currentStage = 0;
            this.currentSubtask = 0;
            this.logs = [];
            this.init();
        }

        async init() {
            this.injectStyles();
            this.render();
            await this.loadPlatforms();
        }

        injectStyles() {
            if (!document.getElementById('sc-styles')) {
                const style = document.createElement('style');
                style.id = 'sc-styles';
                style.textContent = styles.replace(/#3b82f6/g, this.options.primaryColor);
                document.head.appendChild(style);
            }
        }

        render() {
            this.container.innerHTML = \`
                <div class="sc-widget">
                    <div class="sc-card">
                        <h2 class="sc-title">Convert Your Store</h2>
                        <p class="sc-subtitle">Transform your online store into a blazing-fast HTML5 site</p>
                        <div class="sc-error" id="sc-error"></div>
                        <div id="sc-platform-select">
                            <div class="sc-platforms" id="sc-platforms"></div>
                        </div>
                        <div class="sc-form" id="sc-credentials-form"></div>
                        <div class="sc-progress" id="sc-progress">
                            <div class="sc-progress-header">
                                <div class="sc-progress-icon">
                                    <svg class="sc-progress-ring" viewBox="0 0 48 48">
                                        <circle class="sc-progress-ring-circle" cx="24" cy="24" r="20"/>
                                        <circle class="sc-progress-ring-progress" id="sc-ring-progress" cx="24" cy="24" r="20"
                                                stroke-dasharray="125.6" stroke-dashoffset="125.6"/>
                                    </svg>
                                    <span class="sc-progress-percent" id="sc-progress-percent">0%</span>
                                </div>
                                <div class="sc-progress-info">
                                    <div class="sc-progress-stage" id="sc-progress-stage">Initializing...</div>
                                    <div class="sc-progress-status" id="sc-progress-status">Please wait while we set things up</div>
                                </div>
                            </div>

                            <div class="sc-main-progress">
                                <div class="sc-main-progress-label">
                                    <span>Overall Progress</span>
                                    <span id="sc-progress-label">0%</span>
                                </div>
                                <div class="sc-main-progress-bar">
                                    <div class="sc-main-progress-fill" id="sc-main-fill" style="width: 0%"></div>
                                </div>
                            </div>

                            <div class="sc-subtasks">
                                <div class="sc-subtasks-title">Current Tasks</div>
                                <div id="sc-subtasks-list"></div>
                            </div>

                            <div class="sc-live-log" id="sc-live-log"></div>
                        </div>
                        <div class="sc-result" id="sc-result">
                            <div class="sc-result-icon">✅</div>
                            <h3 class="sc-result-title">Conversion Complete!</h3>
                            <p id="sc-result-text"></p>
                            <button class="sc-btn sc-btn-primary" id="sc-download-btn">Download Files</button>
                        </div>
                    </div>
                </div>
            \`;
        }

        async loadPlatforms() {
            try {
                const response = await fetch(this.options.apiEndpoint + '/platforms');
                const data = await response.json();
                if (data.success) {
                    this.platforms = data.platforms;
                    this.renderPlatforms();
                }
            } catch (error) {
                this.showError('Failed to load platforms: ' + error.message);
            }
        }

        renderPlatforms() {
            const container = document.getElementById('sc-platforms');
            container.innerHTML = this.platforms.map(p => \`
                <div class="sc-platform" data-platform="\${p.id}">
                    <div class="sc-platform-icon">\${p.icon}</div>
                    <div class="sc-platform-name">\${p.name}</div>
                </div>
            \`).join('');

            container.querySelectorAll('.sc-platform').forEach(el => {
                el.addEventListener('click', () => this.selectPlatform(el.dataset.platform));
            });
        }

        selectPlatform(platformId) {
            this.selectedPlatform = this.platforms.find(p => p.id === platformId);
            document.querySelectorAll('.sc-platform').forEach(el => {
                el.classList.toggle('selected', el.dataset.platform === platformId);
            });
            this.renderCredentialsForm();
        }

        renderCredentialsForm() {
            const form = document.getElementById('sc-credentials-form');
            form.classList.add('active');
            form.innerHTML = \`
                \${this.selectedPlatform.credentialFields.map(field => \`
                    <div class="sc-field">
                        <label class="sc-label">\${field.label}</label>
                        <input class="sc-input" type="\${field.type}" id="sc-\${field.name}"
                               placeholder="\${field.placeholder}" \${field.required ? 'required' : ''}>
                    </div>
                \`).join('')}
                <button class="sc-btn sc-btn-primary" id="sc-convert-btn">Convert Store</button>
            \`;

            document.getElementById('sc-convert-btn').addEventListener('click', () => this.startConversion());
        }

        addLog(message, type = 'info') {
            const time = new Date().toLocaleTimeString();
            const logContainer = document.getElementById('sc-live-log');
            const entry = document.createElement('div');
            entry.className = 'sc-log-entry ' + type;
            entry.innerHTML = '<span class="sc-log-time">[' + time + ']</span>' + message;
            logContainer.appendChild(entry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        updateProgress(percent, stage, status) {
            // Update circular progress
            const ring = document.getElementById('sc-ring-progress');
            const circumference = 125.6;
            const offset = circumference - (percent / 100) * circumference;
            ring.style.strokeDashoffset = offset;

            // Update percent text
            document.getElementById('sc-progress-percent').textContent = percent + '%';
            document.getElementById('sc-progress-label').textContent = percent + '%';

            // Update main progress bar
            document.getElementById('sc-main-fill').style.width = percent + '%';

            // Update stage text
            if (stage) {
                document.getElementById('sc-progress-stage').textContent = stage;
            }
            if (status) {
                document.getElementById('sc-progress-status').textContent = status;
            }
        }

        renderSubtasks(stageIndex, subtaskIndex) {
            const stage = CONVERSION_STAGES[stageIndex];
            if (!stage) return;

            const container = document.getElementById('sc-subtasks-list');
            container.innerHTML = stage.subtasks.map((subtask, i) => {
                let statusClass = 'pending';
                let icon = '<div class="sc-subtask-pending"></div>';
                let progress = 0;

                if (i < subtaskIndex) {
                    statusClass = 'completed';
                    icon = '<span class="sc-subtask-check">✓</span>';
                    progress = 100;
                } else if (i === subtaskIndex) {
                    statusClass = 'active';
                    icon = '<div class="sc-subtask-spinner"></div>';
                    progress = 50;
                }

                return \`
                    <div class="sc-subtask \${statusClass}">
                        <div class="sc-subtask-icon">\${icon}</div>
                        <div class="sc-subtask-info">
                            <div class="sc-subtask-name">\${subtask.name}</div>
                            <div class="sc-subtask-detail">\${subtask.detail}</div>
                        </div>
                        <div class="sc-subtask-progress">
                            <div class="sc-subtask-bar">
                                <div class="sc-subtask-fill" style="width: \${progress}%"></div>
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        async simulateProgress() {
            const totalStages = CONVERSION_STAGES.length;
            let overallProgress = 0;

            for (let s = 0; s < totalStages; s++) {
                const stage = CONVERSION_STAGES[s];
                const stageWeight = 100 / totalStages;

                this.updateProgress(overallProgress, stage.name, 'Processing...');
                this.addLog('Starting: ' + stage.name);

                for (let t = 0; t < stage.subtasks.length; t++) {
                    const subtask = stage.subtasks[t];
                    this.renderSubtasks(s, t);
                    this.addLog('→ ' + subtask.name + '...');

                    // Simulate subtask progress
                    const subtaskWeight = stageWeight / stage.subtasks.length;
                    for (let p = 0; p <= 100; p += 20) {
                        await this.sleep(100 + Math.random() * 200);
                        const taskProgress = overallProgress + (subtaskWeight * (t + p/100));
                        this.updateProgress(Math.round(taskProgress), stage.name, subtask.detail);
                    }

                    this.addLog('✓ ' + subtask.name + ' complete');
                }

                overallProgress += stageWeight;
            }

            this.updateProgress(100, 'Complete', 'All tasks finished');
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async startConversion() {
            const credentials = {};
            this.selectedPlatform.credentialFields.forEach(field => {
                credentials[field.name] = document.getElementById('sc-' + field.name).value;
            });

            // Validate
            for (const field of this.selectedPlatform.credentialFields) {
                if (field.required && !credentials[field.name]) {
                    this.showError(field.label + ' is required');
                    return;
                }
            }

            this.hideError();
            document.getElementById('sc-platform-select').style.display = 'none';
            document.getElementById('sc-credentials-form').classList.remove('active');
            document.getElementById('sc-progress').classList.add('active');

            // Initialize progress UI
            this.renderSubtasks(0, 0);
            this.addLog('Initializing conversion for ' + this.selectedPlatform.name + '...', 'info');

            try {
                // Start progress simulation in parallel with actual conversion
                const progressPromise = this.simulateProgress();

                const response = await fetch(this.options.apiEndpoint + '/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: this.selectedPlatform.id,
                        credentials
                    })
                });

                const data = await response.json();

                // Wait for progress animation to catch up
                await progressPromise;

                if (data.success) {
                    this.addLog('Conversion completed successfully!', 'info');
                    this.showResult(data);
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                this.addLog('Error: ' + error.message, 'error');
                document.getElementById('sc-progress').classList.remove('active');
                document.getElementById('sc-platform-select').style.display = 'block';
                document.getElementById('sc-credentials-form').classList.add('active');
                this.showError('Conversion failed: ' + error.message);
                if (this.options.onError) this.options.onError(error);
            }
        }

        showResult(data) {
            document.getElementById('sc-progress').classList.remove('active');
            document.getElementById('sc-result').classList.add('active');
            document.getElementById('sc-result-text').textContent =
                'Successfully converted ' + data.productCount + ' products';

            document.getElementById('sc-download-btn').addEventListener('click', () => {
                window.open(data.downloadUrl, '_blank');
            });

            if (this.options.onComplete) this.options.onComplete(data);
        }

        showError(message) {
            const el = document.getElementById('sc-error');
            el.textContent = message;
            el.classList.add('active');
        }

        hideError() {
            document.getElementById('sc-error').classList.remove('active');
        }
    }

    // Global API
    window.StoreConverter = {
        init: function(container, options) {
            return new StoreConverterWidget(container, options);
        }
    };
})();
`;

    res.send(embedScript);
};
