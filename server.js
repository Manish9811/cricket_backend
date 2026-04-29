const env = require('./src/config/env'); // validates env vars first
const http = require('http');
const express = require('express');
const cors = require('cors');

const routes = require('./src/routes');
const errorHandler = require('./src/middleware/errorHandler');
const initSocket = require('./src/sockets');

const app = express();
const httpServer = http.createServer(app);

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── REST API routes ────────────────────────────────────────────
app.use('/api', routes);

// ── Socket.io ─────────────────────────────────────────────────
const io = initSocket(httpServer);
app.set('io', io); // make io accessible in controllers via req.app.get('io')

// ── Global error handler (must be last) ───────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
});
