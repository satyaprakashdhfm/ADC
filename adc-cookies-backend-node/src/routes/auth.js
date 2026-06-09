import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getOne, nowIso } from '../db.js';
import { generateToken } from '../jwt.js';
import { ApiError } from '../middleware.js';

const router = Router();

function authResponse(user) {
  return { token: generateToken(user.email, user.role), email: user.email, name: user.name, role: user.role };
}

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !phone || !password) throw new ApiError('name, email, phone and password are required');

  const exists = await getOne('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists) throw new ApiError('Email already registered');

  const hash = await bcrypt.hash(password, 10);
  const ts = nowIso();
  const user = await getOne(
    `INSERT INTO users (name, email, phone, password, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'CUSTOMER', $5, $6) RETURNING *`,
    [name, email, phone, hash, ts, ts]
  );
  res.json(authResponse(user));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !(await bcrypt.compare(password || '', user.password))) {
    throw new ApiError('Invalid email or password');
  }
  res.json(authResponse(user));
});

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user || !(await bcrypt.compare(password || '', user.password)) || user.role !== 'ADMIN') {
    throw new ApiError('Invalid credentials or insufficient permissions');
  }
  res.json(authResponse(user));
});

export default router;
