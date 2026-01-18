// Vercel Serverless Function: /api/admin/orders
// Order management for admin

const { verifyToken } = require('./auth');

// In-memory store fallback
const ordersStore = new Map();

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

        // GET - List orders or get single order
        if (req.method === 'GET') {
            if (id) {
                // Get single order
                let order = null;
                try {
                    const { kv } = require('@vercel/kv');
                    order = await kv.get(`order:${id}`);
                } catch (e) {
                    order = ordersStore.get(id);
                }

                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                return res.status(200).json({ order });
            }

            // List all orders
            let orders = [];
            try {
                const { kv } = require('@vercel/kv');
                const keys = await kv.keys('order:*');
                for (const key of keys) {
                    const order = await kv.get(key);
                    if (order) orders.push(order);
                }
            } catch (e) {
                orders = Array.from(ordersStore.values());
            }

            // Sort by date descending
            orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            return res.status(200).json({
                orders,
                total: orders.length
            });
        }

        // PUT - Update order status
        if (req.method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Order ID required' });
            }

            const { status, trackingNumber, notes } = req.body;

            let order = null;
            try {
                const { kv } = require('@vercel/kv');
                order = await kv.get(`order:${id}`);
            } catch (e) {
                order = ordersStore.get(id);
            }

            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            // Update order
            const updatedOrder = {
                ...order,
                status: status || order.status,
                trackingNumber: trackingNumber || order.trackingNumber,
                notes: notes || order.notes,
                updatedAt: Date.now()
            };

            try {
                const { kv } = require('@vercel/kv');
                await kv.set(`order:${id}`, updatedOrder, { ex: 86400 * 365 });
            } catch (e) {
                ordersStore.set(id, updatedOrder);
            }

            return res.status(200).json({ order: updatedOrder });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Orders error:', error);
        return res.status(500).json({ error: error.message });
    }
};
