// Vercel Serverless Function: POST /api/create-payment
// Creates a Stripe PaymentIntent with platform fee

const Stripe = require('stripe');

// Platform fee: 3.9% + Stripe fees (Stripe takes ~2.9% + 30¢)
const PLATFORM_FEE_PERCENT = 3.9;

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { items, shipping, storeConfig } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'No items in cart' });
        }

        // Get Stripe keys from environment or store config
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || storeConfig?.stripeSecretKey;
        const stripeAccountId = storeConfig?.stripeAccountId; // Connected account for marketplace

        if (!stripeSecretKey) {
            return res.status(400).json({
                error: 'Payment not configured. Please set up Stripe in your store settings.'
            });
        }

        const stripe = new Stripe(stripeSecretKey);

        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shippingCost = subtotal > 50 ? 0 : 5.99;
        const total = subtotal + shippingCost;

        // Convert to cents for Stripe
        const amountInCents = Math.round(total * 100);

        // Calculate platform fee (3.9%)
        const platformFeeInCents = Math.round(amountInCents * (PLATFORM_FEE_PERCENT / 100));

        // Build line items description
        const description = items.map(i => `${i.name} x${i.quantity}`).join(', ');

        // Create payment intent options
        const paymentIntentOptions = {
            amount: amountInCents,
            currency: 'usd',
            description: description,
            metadata: {
                items: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, qty: i.quantity, price: i.price }))),
                shipping_name: shipping?.name || '',
                shipping_email: shipping?.email || '',
                shipping_address: shipping?.address || '',
                shipping_city: shipping?.city || '',
                shipping_postal: shipping?.postal || '',
                shipping_country: shipping?.country || '',
                platform_fee_percent: PLATFORM_FEE_PERCENT.toString()
            },
            receipt_email: shipping?.email,
            automatic_payment_methods: {
                enabled: true,
            }
        };

        // If using Stripe Connect (marketplace mode), add application fee
        if (stripeAccountId) {
            paymentIntentOptions.application_fee_amount = platformFeeInCents;
            paymentIntentOptions.transfer_data = {
                destination: stripeAccountId,
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

        // Store order in KV if available
        try {
            const { kv } = require('@vercel/kv');
            await kv.set(`order:${paymentIntent.id}`, {
                id: paymentIntent.id,
                status: 'pending',
                items,
                shipping,
                subtotal,
                shippingCost,
                total,
                platformFee: platformFeeInCents / 100,
                createdAt: Date.now()
            }, { ex: 86400 * 30 }); // Keep for 30 days
        } catch (e) {
            // KV not available, orders won't be persisted
            console.log('KV not available for order storage');
        }

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: total,
            platformFee: platformFeeInCents / 100
        });

    } catch (error) {
        console.error('Payment error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to create payment'
        });
    }
};
