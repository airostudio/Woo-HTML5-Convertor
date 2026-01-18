/**
 * Platform Connectors Registry
 * Central registry for all supported e-commerce platform connectors
 */

const BasePlatformConnector = require('./base-connector');
const WooCommerceConnector = require('./woocommerce');
const ShopifyConnector = require('./shopify');
const WixConnector = require('./wix');
const SquarespaceConnector = require('./squarespace');

// Registry of all available connectors
const connectors = {
    woocommerce: WooCommerceConnector,
    shopify: ShopifyConnector,
    wix: WixConnector,
    squarespace: SquarespaceConnector
};

/**
 * Get a connector class by platform ID
 * @param {string} platform - Platform identifier
 * @returns {typeof BasePlatformConnector|null}
 */
function getConnector(platform) {
    return connectors[platform.toLowerCase()] || null;
}

/**
 * Create a connector instance
 * @param {string} platform - Platform identifier
 * @param {Object} config - Connector configuration
 * @returns {BasePlatformConnector|null}
 */
function createConnector(platform, config) {
    const ConnectorClass = getConnector(platform);
    if (!ConnectorClass) {
        return null;
    }
    return new ConnectorClass(config);
}

/**
 * Get list of all supported platforms
 * @returns {Array<Object>}
 */
function getSupportedPlatforms() {
    return Object.entries(connectors).map(([id, Connector]) => ({
        id,
        name: Connector.displayName,
        icon: Connector.icon,
        credentialFields: Connector.credentialFields,
        supportedFeatures: Connector.supportedFeatures
    }));
}

/**
 * Register a custom connector
 * @param {string} platformId - Unique platform identifier
 * @param {typeof BasePlatformConnector} ConnectorClass - Connector class extending BasePlatformConnector
 */
function registerConnector(platformId, ConnectorClass) {
    if (!(ConnectorClass.prototype instanceof BasePlatformConnector)) {
        throw new Error('Connector must extend BasePlatformConnector');
    }
    connectors[platformId.toLowerCase()] = ConnectorClass;
}

/**
 * Check if a platform is supported
 * @param {string} platform - Platform identifier
 * @returns {boolean}
 */
function isPlatformSupported(platform) {
    return Boolean(connectors[platform.toLowerCase()]);
}

module.exports = {
    // Base class for extending
    BasePlatformConnector,

    // Specific connectors
    WooCommerceConnector,
    ShopifyConnector,
    WixConnector,
    SquarespaceConnector,

    // Registry functions
    getConnector,
    createConnector,
    getSupportedPlatforms,
    registerConnector,
    isPlatformSupported,

    // Full connectors map
    connectors
};
