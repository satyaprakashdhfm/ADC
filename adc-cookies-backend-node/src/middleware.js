import { verifyToken } from './jwt.js';

/* Mirrors JwtAuthFilter: reads "Authorization: Bearer <token>" and, if valid,
   attaches { email, role } to req.user. */
export function parseAuth(req, _res, next) {
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    const result = verifyToken(header.substring(7));
    if (result.valid) {
      req.user = { email: result.email, role: result.role };
    }
  }
  next();
}

// Equivalent to Spring's anyRequest().authenticated()
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  next();
}

// Equivalent to .requestMatchers("/api/admin/**").hasRole("ADMIN")
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  next();
}

// Lets services throw new ApiError(msg) to produce a 400, like Spring's RuntimeException handler.
export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
