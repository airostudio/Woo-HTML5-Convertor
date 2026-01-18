// Vercel Serverless Function: POST /api/admin/auth
// Simple admin authentication

const crypto = require('crypto');

// In production, use environment variables
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// In-memory token store (use KV in production)
const tokenStore = new Map();

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

    try {
        const { action, password, token } = req.body;

        // Login action
        if (action === 'login') {
            if (!password) {
                return res.status(400).json({ error: 'Password required' });
            }

            // If no admin password is set, use default (should be changed in production!)
            const defaultHash = hashPassword('admin123');
            const expectedHash = ADMIN_PASSWORD_HASH || defaultHash;
            const providedHash = hashPassword(password);

            if (providedHash !== expectedHash) {
                return res.status(401).json({ error: 'Invalid password' });
            }

            // Generate session token
            const sessionToken = generateToken();
            const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

            // Try to store in KV, fallback to memory
            try {
                const { kv } = require('@vercel/kv');
                await kv.set(`admin:session:${sessionToken}`, {
                    createdAt: Date.now(),
                    expiresAt
                }, { ex: 86400 });
            } catch (e) {
                tokenStore.set(sessionToken, { expiresAt });
            }

            return res.status(200).json({
                success: true,
                token: sessionToken,
                expiresAt
            });
        }

        // Verify token action
        if (action === 'verify') {
            if (!token) {
                return res.status(401).json({ error: 'Token required', valid: false });
            }

            let session = null;

            // Try KV first
            try {
                const { kv } = require('@vercel/kv');
                session = await kv.get(`admin:session:${token}`);
            } catch (e) {
                session = tokenStore.get(token);
            }

            if (!session || session.expiresAt < Date.now()) {
                return res.status(401).json({ error: 'Invalid or expired token', valid: false });
            }

            return res.status(200).json({ valid: true });
        }

        // Logout action
        if (action === 'logout') {
            if (token) {
                try {
                    const { kv } = require('@vercel/kv');
                    await kv.del(`admin:session:${token}`);
                } catch (e) {
                    tokenStore.delete(token);
                }
            }
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid action' });

    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

// Export for use by other admin endpoints
module.exports.verifyToken = async function(token) {
    if (!token) return false;

    try {
        const { kv } = require('@vercel/kv');
        const session = await kv.get(`admin:session:${token}`);
        return session && session.expiresAt > Date.now();
    } catch (e) {
        const session = tokenStore.get(token);
        return session && session.expiresAt > Date.now();
    }
};
