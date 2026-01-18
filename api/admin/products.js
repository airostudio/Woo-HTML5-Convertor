// Vercel Serverless Function: /api/admin/products
// Product CRUD for admin

const { verifyToken } = require('./auth');
const { v4: uuidv4 } = require('uuid');

// In-memory store fallback
const productsStore = new Map();

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    const isValid = await verifyToken(token);
    if (!isValid) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { id } = req.query;

        // GET - List products or get single product
        if (req.method === 'GET') {
            if (id) {
                let product = null;
                try {
                    const { kv } = require('@vercel/kv');
                    product = await kv.get(`product:${id}`);
                } catch (e) {
                    product = productsStore.get(id);
                }

                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }

                return res.status(200).json({ product });
            }

            // List all products
            let products = [];
            try {
                const { kv } = require('@vercel/kv');
                const keys = await kv.keys('product:*');
                for (const key of keys) {
                    const product = await kv.get(key);
                    if (product) products.push(product);
                }
            } catch (e) {
                products = Array.from(productsStore.values());
            }

            // Sort by date descending
            products.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            return res.status(200).json({
                products,
                total: products.length
            });
        }

        // POST - Create new product
        if (req.method === 'POST') {
            const { name, description, price, salePrice, images, categories, stock, sku, status } = req.body;

            if (!name || !price) {
                return res.status(400).json({ error: 'Name and price are required' });
            }

            const productId = uuidv4();
            const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

            const product = {
                id: productId,
                name,
                slug,
                description: description || '',
                price: parseFloat(price),
                regularPrice: parseFloat(price),
                salePrice: salePrice ? parseFloat(salePrice) : null,
                images: images || [],
                categories: categories || [],
                stock: stock || 0,
                sku: sku || '',
                status: status || 'publish',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            try {
                const { kv } = require('@vercel/kv');
                await kv.set(`product:${productId}`, product, { ex: 86400 * 365 });
            } catch (e) {
                productsStore.set(productId, product);
            }

            return res.status(201).json({ product });
        }

        // PUT - Update product
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID required' });
            }

            let existingProduct = null;
            try {
                const { kv } = require('@vercel/kv');
                existingProduct = await kv.get(`product:${id}`);
            } catch (e) {
                existingProduct = productsStore.get(id);
            }

            if (!existingProduct) {
                return res.status(404).json({ error: 'Product not found' });
            }

            const { name, description, price, salePrice, images, categories, stock, sku, status } = req.body;

            const updatedProduct = {
                ...existingProduct,
                name: name || existingProduct.name,
                slug: name ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') : existingProduct.slug,
                description: description !== undefined ? description : existingProduct.description,
                price: price !== undefined ? parseFloat(price) : existingProduct.price,
                regularPrice: price !== undefined ? parseFloat(price) : existingProduct.regularPrice,
                salePrice: salePrice !== undefined ? (salePrice ? parseFloat(salePrice) : null) : existingProduct.salePrice,
                images: images !== undefined ? images : existingProduct.images,
                categories: categories !== undefined ? categories : existingProduct.categories,
                stock: stock !== undefined ? stock : existingProduct.stock,
                sku: sku !== undefined ? sku : existingProduct.sku,
                status: status !== undefined ? status : existingProduct.status,
                updatedAt: Date.now()
            };

            try {
                const { kv } = require('@vercel/kv');
                await kv.set(`product:${id}`, updatedProduct, { ex: 86400 * 365 });
            } catch (e) {
                productsStore.set(id, updatedProduct);
            }

            return res.status(200).json({ product: updatedProduct });
        }

        // DELETE - Delete product
        if (req.method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ error: 'Product ID required' });
            }

            try {
                const { kv } = require('@vercel/kv');
                await kv.del(`product:${id}`);
            } catch (e) {
                productsStore.delete(id);
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Products error:', error);
        return res.status(500).json({ error: error.message });
    }
};
