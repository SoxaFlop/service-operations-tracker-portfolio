/**
 * index.ts — Server Entry Point
 *
 * Configures and starts the Express application:
 *   - CORS restricted to a configured browser origin
 *   - JSON body parsing with a 20MB limit to support file attachments
 *   - API route mounting
 *   - Static file serving for the React frontend
 *   - Starts the SLA cron job scheduler
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import { prisma } from './db.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import clientRoutes from './routes/clients.js';
import settingsRoutes from './routes/settings.js';
import analyticsRoutes from './routes/analytics.js';
import proposalRoutes from './routes/proposals.js';
import budgetQuoteRoutes from './routes/budget-quotes.js';
import { startCron } from './cron.js';

// ─── App Setup ────────────────────────────────────────────────────────────────

const app = express();

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const corsOptions = {
  origin: corsOrigin,
  credentials: true,
};

app.use(cors(corsOptions));

// 20MB limit to support base64-encoded file uploads in order documents
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/budget-quotes', budgetQuoteRoutes);

// ─── Static Frontend (Production) ────────────────────────────────────────────

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// Catch-all: serve the React SPA for any unknown route
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  startCron();
});
