/**
 * Image Optimizer
 * Compresses and optimizes images for web performance
 * Generates WebP versions and responsive image sizes
 */

const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

class ImageOptimizer {
    constructor(options = {}) {
        this.options = {
            quality: options.quality || 80,
            webpQuality: options.webpQuality || 82,
            avifQuality: options.avifQuality || 65,
            maxWidth: options.maxWidth || 2000,
            generateWebp: options.generateWebp !== false,
            generateAvif: options.generateAvif || false,
            generateResponsive: options.generateResponsive !== false,
            responsiveSizes: options.responsiveSizes || [320, 640, 960, 1280, 1920],
            thumbnailSize: options.thumbnailSize || 150,
            mediumSize: options.mediumSize || 600,
            progressive: options.progressive !== false,
            stripMetadata: options.stripMetadata !== false,
            lazyPlaceholder: options.lazyPlaceholder !== false,
            placeholderSize: options.placeholderSize || 20
        };

        this.stats = {
            processed: 0,
            skipped: 0,
            totalOriginalSize: 0,
            totalOptimizedSize: 0,
            webpGenerated: 0,
            avifGenerated: 0
        };
    }

    /**
     * Optimize a single image
     */
    async optimizeImage(inputPath, outputDir) {
        const filename = path.basename(inputPath);
        const ext = path.extname(filename).toLowerCase();
        const baseName = path.basename(filename, ext);

        // Skip non-image files
        if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            this.stats.skipped++;
            return null;
        }

        const results = {
            original: inputPath,
            optimized: null,
            webp: null,
            avif: null,
            thumbnail: null,
            medium: null,
            responsive: [],
            placeholder: null,
            sizes: {}
        };

        try {
            const originalBuffer = await fs.readFile(inputPath);
            const originalSize = originalBuffer.length;
            this.stats.totalOriginalSize += originalSize;

            // Get image metadata
            const metadata = await sharp(originalBuffer).metadata();

            // Create base sharp instance
            let pipeline = sharp(originalBuffer);

            // Strip metadata if configured
            if (this.options.stripMetadata) {
                pipeline = pipeline.rotate(); // Auto-rotate based on EXIF then strip
            }

            // Resize if larger than max width
            if (metadata.width > this.options.maxWidth) {
                pipeline = pipeline.resize(this.options.maxWidth, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                });
            }

            // Optimize based on format
            let optimizedBuffer;
            const outputPath = path.join(outputDir, filename);

            if (ext === '.png') {
                optimizedBuffer = await pipeline
                    .png({
                        compressionLevel: 9,
                        palette: true,
                        quality: this.options.quality
                    })
                    .toBuffer();
            } else if (ext === '.gif') {
                // For GIF, just copy (sharp has limited GIF support)
                optimizedBuffer = originalBuffer;
            } else {
                // JPEG optimization
                optimizedBuffer = await pipeline
                    .jpeg({
                        quality: this.options.quality,
                        progressive: this.options.progressive,
                        mozjpeg: true
                    })
                    .toBuffer();
            }

            await fs.writeFile(outputPath, optimizedBuffer);
            results.optimized = outputPath;
            results.sizes.optimized = optimizedBuffer.length;
            this.stats.totalOptimizedSize += optimizedBuffer.length;

            // Generate WebP version
            if (this.options.generateWebp && ext !== '.gif') {
                const webpPath = path.join(outputDir, `${baseName}.webp`);
                const webpBuffer = await sharp(originalBuffer)
                    .resize(this.options.maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
                    .webp({ quality: this.options.webpQuality })
                    .toBuffer();

                await fs.writeFile(webpPath, webpBuffer);
                results.webp = webpPath;
                results.sizes.webp = webpBuffer.length;
                this.stats.webpGenerated++;
            }

            // Generate AVIF version (next-gen format)
            if (this.options.generateAvif && ext !== '.gif') {
                try {
                    const avifPath = path.join(outputDir, `${baseName}.avif`);
                    const avifBuffer = await sharp(originalBuffer)
                        .resize(this.options.maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
                        .avif({ quality: this.options.avifQuality })
                        .toBuffer();

                    await fs.writeFile(avifPath, avifBuffer);
                    results.avif = avifPath;
                    results.sizes.avif = avifBuffer.length;
                    this.stats.avifGenerated++;
                } catch (e) {
                    // AVIF might not be supported
                }
            }

            // Generate thumbnail
            const thumbPath = path.join(outputDir, `${baseName}-thumb${ext}`);
            const thumbBuffer = await sharp(originalBuffer)
                .resize(this.options.thumbnailSize, this.options.thumbnailSize, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 75 })
                .toBuffer();

            await fs.writeFile(thumbPath, thumbBuffer);
            results.thumbnail = thumbPath;
            results.sizes.thumbnail = thumbBuffer.length;

            // Generate medium size
            const mediumPath = path.join(outputDir, `${baseName}-medium${ext}`);
            const mediumBuffer = await sharp(originalBuffer)
                .resize(this.options.mediumSize, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .jpeg({ quality: this.options.quality })
                .toBuffer();

            await fs.writeFile(mediumPath, mediumBuffer);
            results.medium = mediumPath;
            results.sizes.medium = mediumBuffer.length;

            // Generate responsive sizes
            if (this.options.generateResponsive && ext !== '.gif') {
                for (const width of this.options.responsiveSizes) {
                    if (width < metadata.width) {
                        const responsivePath = path.join(outputDir, `${baseName}-${width}w${ext}`);
                        const responsiveBuffer = await sharp(originalBuffer)
                            .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
                            .jpeg({ quality: this.options.quality, progressive: true })
                            .toBuffer();

                        await fs.writeFile(responsivePath, responsiveBuffer);

                        // Also generate WebP for responsive
                        if (this.options.generateWebp) {
                            const responsiveWebpPath = path.join(outputDir, `${baseName}-${width}w.webp`);
                            const responsiveWebpBuffer = await sharp(originalBuffer)
                                .resize(width, null, { withoutEnlargement: true, fit: 'inside' })
                                .webp({ quality: this.options.webpQuality })
                                .toBuffer();
                            await fs.writeFile(responsiveWebpPath, responsiveWebpBuffer);
                        }

                        results.responsive.push({
                            width,
                            path: responsivePath,
                            size: responsiveBuffer.length
                        });
                    }
                }
            }

            // Generate lazy loading placeholder (tiny blurred version)
            if (this.options.lazyPlaceholder && ext !== '.gif') {
                const placeholderPath = path.join(outputDir, `${baseName}-placeholder.jpg`);
                const placeholderBuffer = await sharp(originalBuffer)
                    .resize(this.options.placeholderSize, null, { fit: 'inside' })
                    .blur(1)
                    .jpeg({ quality: 20 })
                    .toBuffer();

                await fs.writeFile(placeholderPath, placeholderBuffer);
                results.placeholder = placeholderPath;

                // Also generate base64 inline placeholder
                results.placeholderBase64 = `data:image/jpeg;base64,${placeholderBuffer.toString('base64')}`;
            }

            this.stats.processed++;
            return results;

        } catch (error) {
            console.error(`Error optimizing ${inputPath}:`, error.message);
            this.stats.skipped++;
            return null;
        }
    }

    /**
     * Optimize all images in a directory
     */
    async optimizeDirectory(inputDir, outputDir, progressCallback) {
        await fs.ensureDir(outputDir);

        const imageFiles = await glob('**/*.{jpg,jpeg,png,gif,webp}', {
            cwd: inputDir,
            nocase: true
        });

        const results = [];
        const total = imageFiles.length;

        for (let i = 0; i < total; i++) {
            const file = imageFiles[i];
            progressCallback?.(`Optimizing image ${i + 1}/${total}: ${file}`);

            const inputPath = path.join(inputDir, file);
            const fileOutputDir = path.join(outputDir, path.dirname(file));
            await fs.ensureDir(fileOutputDir);

            const result = await this.optimizeImage(inputPath, fileOutputDir);
            if (result) {
                results.push({
                    ...result,
                    relativePath: file
                });
            }
        }

        return results;
    }

    /**
     * Generate srcset string for responsive images
     */
    static generateSrcset(basePath, sizes, format = 'jpg') {
        const ext = format === 'webp' ? '.webp' : path.extname(basePath);
        const baseName = path.basename(basePath, path.extname(basePath));
        const dir = path.dirname(basePath);

        return sizes
            .map(size => `${dir}/${baseName}-${size}w${ext} ${size}w`)
            .join(', ');
    }

    /**
     * Generate picture element HTML for optimal loading
     */
    static generatePictureElement(imagePath, alt, sizes = '100vw', lazyLoad = true) {
        const ext = path.extname(imagePath);
        const baseName = path.basename(imagePath, ext);
        const dir = path.dirname(imagePath);

        const webpSrcset = `${dir}/${baseName}.webp`;
        const fallbackSrc = imagePath;

        const loadingAttr = lazyLoad ? 'loading="lazy"' : '';
        const decodingAttr = 'decoding="async"';

        return `
<picture>
    <source srcset="${webpSrcset}" type="image/webp">
    <img src="${fallbackSrc}" alt="${alt}" ${loadingAttr} ${decodingAttr} sizes="${sizes}">
</picture>`.trim();
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
            originalSizeMB: (this.stats.totalOriginalSize / 1024 / 1024).toFixed(2),
            optimizedSizeMB: (this.stats.totalOptimizedSize / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            processed: 0,
            skipped: 0,
            totalOriginalSize: 0,
            totalOptimizedSize: 0,
            webpGenerated: 0,
            avifGenerated: 0
        };
    }
}

module.exports = ImageOptimizer;
