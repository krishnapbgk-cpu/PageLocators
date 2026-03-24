require('dotenv').config({ path: './.env' });

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const claudeRoutes = require('./routes/claude.route');
const agentRoutes  = require('./routes/agent.route');
const repoRoutes   = require('./routes/repo.route');
const exportRoutes = require('./routes/export.route');
const errorHandler = require('./middleware/errorHandler');
const logger       = require('./middleware/logger');

const app  = express();
const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// ── Security ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: isDev ? ['http://localhost:3002','http://localhost:3000/', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'] : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate Limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please wait a moment.' },
});
app.use('/api/', limiter);

// ── Parsing & Logging ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(isDev ? 'dev' : 'combined'));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status: 'ok',
  version: require('../package.json').version,
  timestamp: new Date().toISOString(),
  apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
}));

// ── API Routes ────────────────────────────────────────────
app.use('/api/claude',  claudeRoutes);
app.use('/api/agent',   agentRoutes);
app.use('/api/repo',    repoRoutes);
app.use('/api/export',  exportRoutes);

// ── Serve React build in production ───────────────────────
if (!isDev) {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── Error Handler (must be last) ──────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('\n  ╔═══════════════════════════════════════╗');
  console.log(`  ║  ESF AUTOMATION Agent API → http://localhost:${PORT} ║`);
  console.log('  ╚═══════════════════════════════════════╝\n');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('  ⚠  WARNING: ANTHROPIC_API_KEY not set in .env\n');
  }
});

module.exports = app;
