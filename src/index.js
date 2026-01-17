/**
 * Woo-HTML5-Convertor
 * Convert WooCommerce stores to blazing-fast HTML5 static sites
 */

const StoreBuilder = require('./builder');
const WooCommerceConnector = require('./importers/woocommerce-connector');
const HtmlGenerator = require('./generators/html-generator');
const PWAGenerator = require('./generators/pwa-generator');
const ImageOptimizer = require('./optimizers/image-optimizer');
const AssetOptimizer = require('./optimizers/asset-optimizer');

module.exports = {
    StoreBuilder,
    WooCommerceConnector,
    HtmlGenerator,
    PWAGenerator,
    ImageOptimizer,
    AssetOptimizer,

    /**
     * Quick convert function
     * @param {Object} config - Configuration options
     * @returns {Promise<Object>} Build statistics
     */
    async convert(config) {
        const builder = new StoreBuilder(config);
        return builder.build();
    },

    /**
     * Test WooCommerce connection
     * @param {Object} config - Connection config (siteUrl, consumerKey, consumerSecret)
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection(config) {
        const connector = new WooCommerceConnector(config);
        return connector.testConnection();
    }
};
