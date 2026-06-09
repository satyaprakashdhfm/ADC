import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'adccookies_super_secret_key_2024_minimum_256_bits_long_for_hs256';
// Spring used milliseconds (86400000 = 24h); jsonwebtoken expiresIn wants seconds.
const EXPIRATION_MS = Number(process.env.JWT_EXPIRATION || 86400000);

// Mirrors JwtUtil.generateToken: subject = email, custom claim "role", HS256.
export function generateToken(email, role) {
  return jwt.sign({ role }, SECRET, {
    subject: email,
    expiresIn: Math.floor(EXPIRATION_MS / 1000),
    algorithm: 'HS256',
  });
}

export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET);
    return { valid: true, email: decoded.sub, role: decoded.role };
  } catch {
    return { valid: false };
  }
}
