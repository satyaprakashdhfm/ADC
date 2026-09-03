/*
 * The Express app: middleware, routes, error handling. It does NOT listen.
 *
 * Split from server.js so the serverless entry (api/index.js) can import a fully configured app
 * without also importing a process that wants to bind a port, seed a database and start a poller.
 * That is what the `if (!process.env.VERCEL)` guard in server.js used to be for, and it is gone.
 *
 * THE ORDER OF THE MIDDLEWARE BELOW IS LOAD-BEARING and must not be tidied:
 *   - the Razorpay webhook takes the RAW body and is mounted BEFORE express.json, or its HMAC is
 *     computed over a re-serialised body and every signature check fails
 *   - the 12mb parser is scoped to /api/petpooja/pushmenu ALONE; a menu push is hundreds of KB and
 *     a 12mb ceiling on the rest of a public API is a cheap memory-exhaustion target
 *   - the rate limiter runs before parseAuth so a flood cannot trigger a DB upsert per request
 */
import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { parseAuth } from './middlewares/auth.middleware.js';
import { noStore } from './middlewares/cache.middleware.js';

import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/products.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/orders.routes.js';
import addressRoutes from './routes/addresses.routes.js';
import couponRoutes from './routes/coupons.routes.js';
import adminRoutes from './routes/admin.routes.js';
import adminAuthRoutes from './routes/adminAuth.routes.js';
import contactRoutes from './routes/contact.routes.js';
import chatRoutes from './routes/chat.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import petpoojaRoutes from './routes/webhooks/petpooja.routes.js';
import hyperlocalRoutes from './routes/webhooks/hyperlocal.routes.js';
import geoRoutes from './routes/geo.routes.js';
import storeRoutes from './routes/store.routes.js';
import whatsappRoutes from './routes/webhooks/whatsapp.routes.js';
import { paymentWebhook } from './routes/webhooks/razorpay.routes.js';
import { paymentCallback } from './routes/orders.routes.js';


const app = express();

// Behind Railway's proxy — trust the first hop so req.ip is the real client IP
// (required for accurate per-IP rate limiting).
app.set('trust proxy', 1);

// Security headers. CSP is disabled (this is a JSON API, not HTML) and CORP is set to
// cross-origin so the browser frontend on another domain can read responses.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

/* Nothing is cacheable by a shared cache unless a route opts in. Mounted before everything that can
   answer a request, so a handler added later inherits the safe default rather than the risky one —
   see cache.middleware.ts for what this is protecting against. */
app.use(noStore);

// CORS: if ALLOWED_ORIGINS is set (comma-separated), lock to those (plus localhost for dev);
// otherwise reflect the request origin (open) so nothing breaks before it's configured.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const corsOrigin = ALLOWED_ORIGINS.length
  ? (origin, cb) => {
      const ok = !origin || ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
      cb(null, ok);
    }
  : true;
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  /* X-Admin-Token belongs here: the dashboard authenticates with it, and a custom header on a
     cross-origin request triggers a preflight that fails unless the header is named in the reply.
     It has not bitten yet only because the browser talks to the frontend's own origin and Next
     rewrites /api server-side, so these never leave as cross-origin requests. That stops being true
     the moment anything calls the backend domain directly. */
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Admin-Token'],
}));

// Razorpay webhook needs the RAW body for signature verification, so mount it with a raw
// parser BEFORE the JSON parser (and before parseAuth — it's authenticated by signature).
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), paymentWebhook);

// WhatsApp's X-Hub-Signature-256 is an HMAC of the RAW BYTES, so this router mounts with a raw
// parser before the JSON one for exactly the reason the Razorpay webhook above does.
app.use('/api/whatsapp', express.raw({ type: '*/*' }), whatsappRoutes);

// Razorpay's redirect callback (browser form POST, not server-to-server) — for in-app browsers
// (Instagram/FB Messenger, Opera Mini, UC) that can't run the normal iframe/popup Checkout.
// Public by design: mounted directly here, NOT through the auth-gated /api/orders router.
app.post('/api/payment-callback/:orderId', express.urlencoded({ extended: false }), paymentCallback);

// Petpooja pushes an ENTIRE restaurant menu — every item, variation, add-on group and tax — in one
// POST. A real menu runs to hundreds of KB, so the 64kb cap below rejected it with a 413 before our
// handler ever saw it, which the dashboard reports only as "Menu trigger failed". Give that one
// router the headroom it needs and leave the rest of the API on the tight default: no storefront
// request has any business being megabytes long.
// Scoped to /pushmenu ALONE, not the whole router. The other Petpooja endpoints take tiny bodies,
// and a 12mb ceiling on a public endpoint is a cheap memory-exhaustion target.
app.use('/api/petpooja/pushmenu', express.json({ limit: '12mb' }));

app.use(express.json({ limit: '64kb' }));

// Baseline per-IP rate limit on the whole API — generous for real browsing, blunts abuse/scraping.
// Runs before parseAuth so floods can't trigger a DB upsert on every request.
app.use('/api', rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', message: 'Too many requests — please slow down.' },
}));

app.use(parseAuth);

app.get('/', (_req, res) => res.json({ status: 'ok', service: 'adc-cookies-backend (node/pg)' }));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
// Outside /api/admin on purpose: everything under that prefix requires an admin session, and the
// endpoints that issue one cannot require it.
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
/* Not behind requireAuth on purpose — a signed-out visitor gets a smaller assistant, not a 401.
   See chat.routes.ts. */
app.use('/api/chat', chatRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/petpooja', petpoojaRoutes);
// Store staff portal. Its own auth scheme (see storeAuth.js), NOT a Supabase role — counter staff
// must never hold a token that /api/admin or a customer's account would also accept.
app.use('/api/store', storeRoutes);
// Shiprocket Hyperlocal tracking. NOT /api/shiprocket — their panel rejects webhook URLs
// containing shiprocket / kartrocket / sr / kr / localhost.
app.use('/api/hyperlocal', hyperlocalRoutes);
// Address search and reverse geocoding — the browser's only route to a geocoder. See routes/geo.js.
app.use('/api/geo', geoRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found', message: 'Resource not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === '23505') { // unique_violation
    return res.status(400).json({ error: 'Already exists', message: 'A record with this value already exists' });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(400).json({ error: 'Cannot delete', message: 'This record is referenced by existing orders and cannot be deleted' });
  }
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message, message });
});

// Export the configured app so Vercel can use it as a serverless function (see api/index.js).

export default app;
