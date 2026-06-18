import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { initSchema } from './db.js';
import { seedIfEmpty } from './seed.js';
import { parseAuth } from './middleware.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import addressRoutes from './routes/addresses.js';
import couponRoutes from './routes/coupons.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';

const PORT = Number(process.env.PORT || 8080);

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
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

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
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);

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

// Only run a long-lived server when started directly (local dev) — not on Vercel serverless.
if (!process.env.VERCEL) {
  (async () => {
    await initSchema();
    await seedIfEmpty();
    app.listen(PORT, () => {
      console.log(`ADC Cookies backend listening on http://localhost:${PORT}`);
    });
  })().catch(err => { console.error('Startup failed:', err); process.exit(1); });
}
