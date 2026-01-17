/**
 * Asset Optimizer
 * Minifies and compresses CSS, JavaScript, and HTML
 */

const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');
const fs = require('fs-extra');
const path = require('path');
const pako = require('pako');

class AssetOptimizer {
    constructor(options = {}) {
        this.options = {
            minifyHtml: options.minifyHtml !== false,
            minifyCss: options.minifyCss !== false,
            minifyJs: options.minifyJs !== false,
            generateGzip: options.generateGzip !== false,
            generateBrotli: options.generateBrotli || false,
            inlineCriticalCss: options.inlineCriticalCss !== false,
            criticalCssThreshold: options.criticalCssThreshold || 14000, // 14KB
            ...options
        };

        this.cleanCss = new CleanCSS({
            level: {
                1: {
                    specialComments: 0
                },
                2: {
                    mergeMedia: true,
                    removeEmpty: true,
                    removeDuplicateFontRules: true,
                    removeDuplicateMediaBlocks: true,
                    removeDuplicateRules: true,
                    restructureRules: true
                }
            }
        });

        this.htmlMinifyOptions = {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
            minifyCSS: true,
            minifyJS: true,
            sortAttributes: true,
            sortClassName: true
        };

        this.jsMinifyOptions = {
            compress: {
                dead_code: true,
                drop_console: false,
                drop_debugger: true,
                keep_classnames: false,
                keep_fnames: false,
                passes: 2
            },
            mangle: {
                toplevel: true
            },
            format: {
                comments: false
            }
        };

        this.stats = {
            htmlFiles: 0,
            cssFiles: 0,
            jsFiles: 0,
            totalOriginalSize: 0,
            totalOptimizedSize: 0
        };
    }

    /**
     * Minify HTML content
     */
    async minifyHtmlContent(html) {
        if (!this.options.minifyHtml) return html;

        try {
            return await minifyHtml(html, this.htmlMinifyOptions);
        } catch (error) {
            console.warn('HTML minification failed:', error.message);
            return html;
        }
    }

    /**
     * Minify CSS content
     */
    minifyCssContent(css) {
        if (!this.options.minifyCss) return css;

        try {
            const result = this.cleanCss.minify(css);
            if (result.errors.length > 0) {
                console.warn('CSS minification errors:', result.errors);
            }
            return result.styles;
        } catch (error) {
            console.warn('CSS minification failed:', error.message);
            return css;
        }
    }

    /**
     * Minify JavaScript content
     */
    async minifyJsContent(js) {
        if (!this.options.minifyJs) return js;

        try {
            const result = await minifyJs(js, this.jsMinifyOptions);
            return result.code;
        } catch (error) {
            console.warn('JS minification failed:', error.message);
            return js;
        }
    }

    /**
     * Generate gzipped version of a file
     */
    async generateGzipped(content, outputPath) {
        if (!this.options.generateGzip) return null;

        try {
            const compressed = pako.gzip(content, { level: 9 });
            const gzipPath = `${outputPath}.gz`;
            await fs.writeFile(gzipPath, compressed);
            return {
                path: gzipPath,
                originalSize: content.length,
                compressedSize: compressed.length,
                ratio: ((1 - compressed.length / content.length) * 100).toFixed(2)
            };
        } catch (error) {
            console.warn('Gzip compression failed:', error.message);
            return null;
        }
    }

    /**
     * Optimize HTML file
     */
    async optimizeHtmlFile(inputPath, outputPath) {
        const original = await fs.readFile(inputPath, 'utf8');
        const minified = await this.minifyHtmlContent(original);

        this.stats.htmlFiles++;
        this.stats.totalOriginalSize += original.length;
        this.stats.totalOptimizedSize += minified.length;

        await fs.writeFile(outputPath, minified);
        await this.generateGzipped(minified, outputPath);

        return {
            original: original.length,
            minified: minified.length,
            savings: ((1 - minified.length / original.length) * 100).toFixed(2)
        };
    }

    /**
     * Optimize CSS file
     */
    async optimizeCssFile(inputPath, outputPath) {
        const original = await fs.readFile(inputPath, 'utf8');
        const minified = this.minifyCssContent(original);

        this.stats.cssFiles++;
        this.stats.totalOriginalSize += original.length;
        this.stats.totalOptimizedSize += minified.length;

        await fs.writeFile(outputPath, minified);
        await this.generateGzipped(minified, outputPath);

        return {
            original: original.length,
            minified: minified.length,
            savings: ((1 - minified.length / original.length) * 100).toFixed(2)
        };
    }

    /**
     * Optimize JavaScript file
     */
    async optimizeJsFile(inputPath, outputPath) {
        const original = await fs.readFile(inputPath, 'utf8');
        const minified = await this.minifyJsContent(original);

        this.stats.jsFiles++;
        this.stats.totalOriginalSize += original.length;
        this.stats.totalOptimizedSize += minified.length;

        await fs.writeFile(outputPath, minified);
        await this.generateGzipped(minified, outputPath);

        return {
            original: original.length,
            minified: minified.length,
            savings: ((1 - minified.length / original.length) * 100).toFixed(2)
        };
    }

    /**
     * Extract critical CSS for above-the-fold content
     */
    extractCriticalCss(fullCss, selectors) {
        // Simple critical CSS extraction based on selectors
        const criticalRules = [];
        const cssRules = fullCss.match(/[^{}]+\{[^{}]*\}/g) || [];

        for (const rule of cssRules) {
            const selector = rule.split('{')[0].trim();
            if (selectors.some(s => selector.includes(s))) {
                criticalRules.push(rule);
            }
        }

        return criticalRules.join('\n');
    }

    /**
     * Get optimization statistics
     */
    getStats() {
        const savings = this.stats.totalOriginalSize - this.stats.totalOptimizedSize;
        const savingsPercent = this.stats.totalOriginalSize > 0
            ? ((savings / this.stats.totalOriginalSize) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            savings,
            savingsPercent: `${savingsPercent}%`,
            originalSizeKB: (this.stats.totalOriginalSize / 1024).toFixed(2),
            optimizedSizeKB: (this.stats.totalOptimizedSize / 1024).toFixed(2)
        };
    }
}

module.exports = AssetOptimizer;
