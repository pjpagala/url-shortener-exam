import express, { ErrorRequestHandler } from 'express';
import { registerRoutes } from './routes';
import { initDatabase } from './database/db';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

initDatabase();
registerRoutes(app);

/**
 * Enhancement (E): global error handler — normalises any unhandled Express
 * errors into a consistent JSON response. Must be registered after all routes
 * and have exactly 4 parameters so Express recognises it as an error handler.
 */
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};

app.use(errorHandler);

export { app };
