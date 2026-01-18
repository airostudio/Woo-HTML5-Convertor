// Vercel Serverless Function: POST /api/admin/refunds
// Process refunds via Stripe

const Stripe = require('stripe');
const { verifyToken } = require('./auth');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify admin token
    const token = req.headers.authorization?.replace('Bearer ', '');
    const isValid = await verifyToken(token);
    if (!isValid) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { paymentIntentId, amount, reason } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'Payment Intent ID required' });
        }

        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            return res.status(400).json({ error: 'Stripe not configured' });
        }

        const stripe = new Stripe(stripeSecretKey);

        // Create refund options
        const refundOptions = {
            payment_intent: paymentIntentId,
            reason: reason || 'requested_by_customer'
        };

        // If partial refund, specify amount in cents
        if (amount) {
            refundOptions.amount = Math.round(amount * 100);
        }

        const refund = await stripe.refunds.create(refundOptions);

        // Update order status in KV
        try {
            const { kv } = require('@vercel/kv');
            const order = await kv.get(`order:${paymentIntentId}`);
            if (order) {
                await kv.set(`order:${paymentIntentId}`, {
                    ...order,
                    status: amount ? 'partially_refunded' : 'refunded',
                    refundId: refund.id,
                    refundAmount: refund.amount / 100,
                    refundedAt: Date.now()
                }, { ex: 86400 * 365 });
            }
        } catch (e) {
            console.log('KV not available for order update');
        }

        return res.status(200).json({
            success: true,
            refund: {
                id: refund.id,
                amount: refund.amount / 100,
                status: refund.status,
                currency: refund.currency
            }
        });

    } catch (error) {
        console.error('Refund error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to process refund'
        });
    }
};
