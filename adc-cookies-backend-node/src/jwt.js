import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRATION_MS } from './config/env.js';

export function generateToken(email, role) {
  return jwt.sign({ role }, JWT_SECRET, {
    subject: email,
    expiresIn: Math.floor(JWT_EXPIRATION_MS / 1000),
    algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, email: decoded.sub, role: decoded.role };
  } catch {
    return { valid: false };
  }
}
