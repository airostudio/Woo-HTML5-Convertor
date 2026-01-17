# Woo-HTML5-Convertor

Convert slow WooCommerce websites to blazing-fast HTML5 static stores.

## Features

- **Lightning Fast**: Static HTML5 pages load instantly with no server processing
- **Complete Store**: Full shopping cart, checkout, search, and filtering
- **PWA Support**: Offline capability with service workers
- **Image Optimization**: Automatic WebP conversion and responsive images
- **SEO Ready**: Sitemap, robots.txt, and structured data
- **Mobile First**: Responsive design that works on all devices
- **No Dependencies**: Pure vanilla JavaScript, no frameworks required

## Performance Benefits

| Metric | WooCommerce | HTML5 Store |
|--------|-------------|-------------|
| Time to First Byte | 500-2000ms | 20-50ms |
| Page Load | 3-8s | 0.5-1.5s |
| Lighthouse Score | 30-60 | 90-100 |
| Server Cost | $20-100/mo | $0-5/mo |

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/Woo-HTML5-Convertor.git
cd Woo-HTML5-Convertor

# Install dependencies
npm install

# Run demo
npm run convert -- demo
```

### Generate Demo Store

```bash
# Generate a demo store with sample products
npx woo-convert demo

# Preview the store
npx serve ./demo-store
```

### Convert WooCommerce Store

```bash
# Interactive mode
npx woo-convert convert -i

# Or with command line options
npx woo-convert convert \
  --url https://your-store.com \
  --key ck_your_consumer_key \
  --secret cs_your_consumer_secret \
  --name "My Store"
```

## CLI Commands

### `woo-convert convert`

Convert a WooCommerce store to HTML5.

```bash
Options:
  -u, --url <url>        WooCommerce site URL
  -k, --key <key>        Consumer Key
  -s, --secret <secret>  Consumer Secret
  -o, --output <dir>     Output directory (default: "./output")
  -n, --name <name>      Store name
  -c, --color <color>    Primary color hex (default: "#2563eb")
  --no-images            Skip image optimization
  --no-pwa               Skip PWA generation
  -i, --interactive      Interactive setup mode
```

### `woo-convert demo`

Generate a demo store with sample data.

```bash
Options:
  -o, --output <dir>  Output directory (default: "./demo-store")
  -n, --name <name>   Store name (default: "Demo Store")
```

### `woo-convert test`

Test connection to WooCommerce store.

```bash
Options:
  -u, --url <url>        WooCommerce site URL
  -k, --key <key>        Consumer Key
  -s, --secret <secret>  Consumer Secret
```

### `woo-convert init`

Create a configuration file.

### `woo-convert serve [dir]`

Serve the generated store locally.

```bash
Options:
  -p, --port <port>  Port number (default: 3000)
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
WOO_SITE_URL=https://your-store.com
WOO_CONSUMER_KEY=ck_your_consumer_key
WOO_CONSUMER_SECRET=cs_your_consumer_secret
```

### Configuration File

Create `woo-config.json`:

```json
{
  "siteName": "My Store",
  "siteDescription": "Your Online Store",
  "siteUrl": "https://your-store.com",
  "outputDir": "./output",
  "primaryColor": "#2563eb",
  "currency": "USD",
  "currencySymbol": "$",
  "productsPerPage": 12,
  "enableSearch": true,
  "enableCart": true,
  "enableWishlist": false,
  "enablePWA": true,
  "optimizeImages": true,
  "generateWebp": true
}
```

## WooCommerce Setup

1. Go to WooCommerce > Settings > Advanced > REST API
2. Click "Add key"
3. Set Description: "HTML5 Converter"
4. Set User: Select an admin user
5. Set Permissions: "Read"
6. Click "Generate API key"
7. Copy the Consumer Key and Consumer Secret

## Project Structure

```
Woo-HTML5-Convertor/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── importers/
│   │   └── woocommerce-connector.js  # WooCommerce API connector
│   ├── generators/
│   │   ├── html-generator.js         # HTML page generator
│   │   └── pwa-generator.js          # PWA files generator
│   ├── optimizers/
│   │   ├── image-optimizer.js        # Image compression
│   │   └── asset-optimizer.js        # CSS/JS minification
│   └── builder.js          # Main build orchestrator
├── templates/
│   ├── layouts/
│   │   └── base.hbs        # Base HTML template
│   ├── pages/
│   │   ├── home.hbs        # Home page
│   │   ├── product.hbs     # Product detail page
│   │   ├── category.hbs    # Category listing
│   │   ├── cart.hbs        # Shopping cart
│   │   ├── checkout.hbs    # Checkout page
│   │   ├── search.hbs      # Search results
│   │   └── 404.hbs         # Not found page
│   ├── partials/
│   │   ├── header.hbs
│   │   ├── footer.hbs
│   │   ├── product-card.hbs
│   │   └── ...
│   └── assets/
│       ├── css/main.css    # Stylesheet
│       └── js/store.js     # Store functionality
├── output/                 # Generated store (gitignored)
├── package.json
└── README.md
```

## Features in Detail

### Shopping Cart

- Persistent cart using localStorage
- Add/remove/update quantities
- Cart sidebar for quick access
- Full cart page with summary

### Checkout

- Multi-step checkout process
- Shipping method selection
- Payment method selection
- Order confirmation
- Form validation

### Search

- Real-time search with instant results
- Search index generated at build time
- Keyboard shortcut (Ctrl/Cmd + K)
- Search by name, SKU, category, tags

### Filtering & Sorting

- Filter by category
- Filter by price range
- Filter by stock status
- Sort by price, name, date, rating

### PWA Features

- Offline browsing of cached pages
- Install as app on mobile/desktop
- Fast subsequent page loads
- Background sync capability

### Image Optimization

- Automatic WebP conversion
- Responsive image sizes (320, 640, 960, 1280, 1920)
- Lazy loading with blur placeholders
- Thumbnail generation

### SEO

- Clean URLs
- Sitemap.xml generation
- Robots.txt
- Structured data (JSON-LD)
- Open Graph meta tags

## Hosting

The generated store is static HTML and can be hosted anywhere:

### Netlify (Recommended)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --dir=output --prod
```

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd output && vercel
```

### GitHub Pages

1. Push output folder to gh-pages branch
2. Enable GitHub Pages in repository settings

### AWS S3 + CloudFront

```bash
# Sync to S3
aws s3 sync output/ s3://your-bucket-name --delete
```

### Any Static Host

Upload the contents of the `output` folder to any web server.

## Customization

### Custom Styling

Edit `templates/assets/css/main.css` or create a new stylesheet.

CSS variables for theming:

```css
:root {
  --primary: #2563eb;
  --primary-dark: #1d4ed8;
  --text: #1f2937;
  --bg: #ffffff;
  --border: #e5e7eb;
}
```

### Custom Templates

Modify templates in `templates/` folder using Handlebars syntax.

Available helpers:
- `{{formatPrice price}}` - Format currency
- `{{truncate text length}}` - Truncate text
- `{{slug text}}` - URL-friendly slug
- `{{starRating rating}}` - Star rating HTML
- `{{json object}}` - JSON stringify

### Custom JavaScript

Extend `templates/assets/js/store.js` or add new scripts.

Global store object:
```javascript
window.Store.Cart      // Cart management
window.Store.Search    // Search functionality
window.Store.Wishlist  // Wishlist management
window.Store.EventBus  // Event system
```

## API Reference

### StoreBuilder

```javascript
const StoreBuilder = require('./src/builder');

const builder = new StoreBuilder({
  siteUrl: 'https://store.com',
  consumerKey: 'ck_xxx',
  consumerSecret: 'cs_xxx',
  siteName: 'My Store',
  outputDir: './output'
});

const stats = await builder.build((message) => {
  console.log(message);
});
```

### WooCommerceConnector

```javascript
const WooCommerceConnector = require('./src/importers/woocommerce-connector');

const connector = new WooCommerceConnector({
  siteUrl: 'https://store.com',
  consumerKey: 'ck_xxx',
  consumerSecret: 'cs_xxx'
});

// Test connection
const result = await connector.testConnection();

// Export all data
const data = await connector.runFullExport('./temp');
```

### ImageOptimizer

```javascript
const ImageOptimizer = require('./src/optimizers/image-optimizer');

const optimizer = new ImageOptimizer({
  quality: 80,
  generateWebp: true,
  generateResponsive: true
});

await optimizer.optimizeDirectory('./images', './optimized');
console.log(optimizer.getStats());
```

## Troubleshooting

### Connection Failed

- Check WooCommerce REST API is enabled
- Verify Consumer Key and Secret
- Ensure site URL includes https://
- Check if your IP is blocked

### Images Not Loading

- Verify image URLs are accessible
- Check for mixed content (http/https)
- Ensure output directory has write permissions

### Cart Not Working

- Check browser localStorage is enabled
- Clear browser cache
- Verify JavaScript is loading

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- GitHub Issues: Report bugs and feature requests
- Documentation: See this README and inline code comments
