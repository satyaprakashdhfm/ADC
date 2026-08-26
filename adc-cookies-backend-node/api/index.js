// Vercel serverless entry — re-exports the Express app. The vercel.json rewrite sends
// every request here, and Express does its own /api/... routing from the original URL.
//
// It imports app.js, not server.js: server.js listens on a port, seeds and starts a poller, none
// of which a serverless invocation should do. That separation is what removed the
// `if (!process.env.VERCEL)` guard that used to wrap the whole of server.js.
import app from '../src/app.js';

export default app;
