/**
 * PM2 Configuration for Store Converter
 * Run: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [{
    name: 'store-converter-api',
    script: 'web/api-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    }
  }]
};
