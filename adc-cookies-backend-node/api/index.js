// Vercel serverless entry — re-exports the Express app. The vercel.json rewrite sends
// every request here, and Express does its own /api/... routing from the original URL.
import app from '../src/server.js';

export default app;
