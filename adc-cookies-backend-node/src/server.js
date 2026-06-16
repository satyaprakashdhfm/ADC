import 'express-async-errors';
import express from 'express';
import cors from 'cors';

import { PORT, IS_VERCEL } from './config/env.js';
import { parseAuth } from './middleware.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import addressRoutes from './routes/addresses.js';
import couponRoutes from './routes/coupons.js';
import adminRoutes from './routes/admin.js';
import contactRoutes from './routes/contact.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*', 'Authorization', 'Content-Type'],
}));

app.use(express.json());
app.use(parseAuth);

app.get('/', (_req, res) => res.json({ status: 'ok', service: 'adc-cookies-backend' }));

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
  if (err.code === 'P2002') {
    return res.status(400).json({ error: 'Already exists', message: 'A record with this value already exists' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Cannot delete', message: 'This record is referenced by existing orders and cannot be deleted' });
  }
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message, message });
});

export default app;

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`ADC Cookies backend listening on http://localhost:${PORT}`);
  });
}
