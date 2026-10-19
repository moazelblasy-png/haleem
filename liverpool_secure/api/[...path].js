// Vercel catch-all function for the Express API.
// The Vite frontend remains static; requests under /api/* are forwarded to the
// same Express routes used by local development and Docker deployments.
import app from '../server/index.cjs';

export default app;
