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
        .sc-progress { display: none; text-align: center; padding: 40px 0; }
        .sc-progress.active { display: block; }
        .sc-spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: sc-spin 1s linear infinite; margin: 0 auto 16px; }
        @keyframes sc-spin { to { transform: rotate(360deg); } }
        .sc-progress-text { color: #666; }
        .sc-progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; margin-top: 16px; overflow: hidden; }
        .sc-progress-fill { height: 100%; background: #3b82f6; transition: width 0.3s; }
        .sc-result { display: none; text-align: center; padding: 40px 0; }
        .sc-result.active { display: block; }
        .sc-result-icon { font-size: 48px; margin-bottom: 16px; }
        .sc-result-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
        .sc-error { color: #dc2626; background: #fef2f2; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: none; }
        .sc-error.active { display: block; }
    \`;

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
                            <div class="sc-spinner"></div>
                            <p class="sc-progress-text" id="sc-progress-text">Starting conversion...</p>
                            <div class="sc-progress-bar">
                                <div class="sc-progress-fill" id="sc-progress-fill" style="width: 0%"></div>
                            </div>
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

            try {
                const response = await fetch(this.options.apiEndpoint + '/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: this.selectedPlatform.id,
                        credentials
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.showResult(data);
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
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
