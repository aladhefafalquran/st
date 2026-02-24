import './config/env'; // validate env first

// Prevent stray unhandled errors (e.g. streamx "Writable stream closed prematurely"
// when a browser disconnects mid-stream) from crashing the whole server process.
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  // Only suppress known benign stream/socket errors; re-throw everything else
  const msg = err.message ?? '';
  if (
    msg.includes('Writable stream closed prematurely') ||
    msg.includes('premature close') ||
    err.code === 'ECONNRESET' ||
    err.code === 'EPIPE'
  ) {
    return; // ignore — client just disconnected
  }
  console.error('[uncaughtException]', err);
  process.exit(1); // still exit on real errors
});
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import tmdbRoutes from './routes/tmdb.routes';
import streamRoutes from './routes/stream.routes';
import subtitleRoutes from './routes/subtitle.routes';
import watchlistRoutes from './routes/watchlist.routes';
import historyRoutes from './routes/history.routes';

const app = express();

// Security headers — allow cross-origin video streaming
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // managed by Cloudflare
  }),
);

// CORS — credentials required for auth cookies + video streaming
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  }),
);

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/subtitles', subtitleRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`[server] Running on port ${env.PORT} (${env.NODE_ENV})`);
});
