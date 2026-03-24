/**
 * Agent Routes — all config params forwarded end-to-end
 *
 * Every parameter the user configures flows through:
 *   appType    → playwright.agent (profile selection)
 *   language   → testgen.service  (output language)
 *   auth       → playwright.agent (form login)
 *   headless   → playwright.agent
 *   maxPages   → playwright.agent (BFS depth)
 *   locatorConfig (priority + userPatterns) → playwright.agent
 *   frameworkAnalysis → testgen.service (POM/test style matching)
 */

const express = require('express');
const router  = express.Router();

const { crawlPages, discoverRoutes }            = require('../services/playwright.agent');
const { generateAll }                           = require('../services/testgen.service');
const { getDefaultPriority }                    = require('../services/locator.engine');
const { analyzeFrameworkPatterns, quickAnalyze }= require('../services/framework.analyzer');

const VALID_LANGUAGES = ['typescript', 'javascript', 'python', 'java'];
const VALID_APP_TYPES = ['spa', 'spa-angular', 'spa-react', 'spa-vue', 'web', 'hybrid', 'electron'];

const resolveLanguage = lang =>
  VALID_LANGUAGES.includes(lang) ? lang : 'typescript';

const resolveAppType = type =>
  VALID_APP_TYPES.includes(type) ? type : 'spa';

// ── GET /api/agent/locator-defaults ──────────────────────────────────────────
router.get('/locator-defaults', (req, res) => {
  res.json({ success: true, data: getDefaultPriority() });
});

// ── POST /api/agent/analyze-framework ────────────────────────────────────────
router.post('/analyze-framework', async (req, res, next) => {
  const { code, useAI = true } = req.body;
  if (!code?.trim()) return res.status(400).json({ error: 'code is required' });
  try {
    const result = (useAI && process.env.ANTHROPIC_API_KEY)
      ? await analyzeFrameworkPatterns(code)
      : quickAnalyze(code);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[analyze-framework]', err.message);
    res.json({ success: true, data: quickAnalyze(code), warning: err.message });
  }
});

// ── POST /api/agent/discover ──────────────────────────────────────────────────
router.post('/discover', async (req, res, next) => {
  const {
    baseUrl,
    maxPages = 50,
    auth,
    headless = true,
    appType  = 'spa',   // ← NEW: used to select nav selectors profile
  } = req.body;

  if (!baseUrl) return res.status(400).json({ error: 'baseUrl is required' });

  const logs  = [];
  const onLog = (level, msg) => {
    logs.push({ level, msg, ts: Date.now() });
    console.log(`[discover][${level}] ${msg}`);
  };

  try {
    const routes = await discoverRoutes({
      baseUrl,
      maxPages,
      auth,
      headless,
      appType: resolveAppType(appType),
      onLog,
    });
    res.json({ success: true, data: { routes, logs } });
  } catch (err) { next(err); }
});

// ── POST /api/agent/crawl ─────────────────────────────────────────────────────
router.post('/crawl', async (req, res, next) => {
  const {
    baseUrl,
    paths         = ['/'],
    locatorConfig,
    auth,
    headless      = true,
    appType       = 'spa',   // ← NEW
  } = req.body;

  if (!baseUrl) return res.status(400).json({ error: 'baseUrl is required' });

  const effectiveLocator = {
    priority:     locatorConfig?.priority     || getDefaultPriority(),
    userPatterns: locatorConfig?.userPatterns || [],
  };

  const logs  = [];
  const pages = [];
  const onLog      = (l, m) => { logs.push({ level: l, msg: m, ts: Date.now() }); console.log(`[crawl][${l}] ${m}`); };
  const onPageDone = p => pages.push(p);

  try {
    await crawlPages({
      baseUrl,
      paths,
      locatorConfig: effectiveLocator,
      auth,
      headless,
      appType: resolveAppType(appType),   // ← forwarded to agent
      onLog,
      onPageDone,
    });
    res.json({ success: true, data: { pages, logs } });
  } catch (err) { next(err); }
});

// ── POST /api/agent/generate ──────────────────────────────────────────────────
router.post('/generate', async (req, res, next) => {
  const {
    pages,
    testTypes         = ['e2e', 'positive', 'negative', 'bva'],
    language,          // ← required from client
    appType,           // ← used by AI path; template path uses frameworkAnalysis
    frameworkAnalysis = null,
    pattern           = {},
    mode              = 'first',
    prsContent,
    useAI             = false,
  } = req.body;

  if (!pages?.length) return res.status(400).json({ error: 'pages[] is required' });

  const lang    = resolveLanguage(language);
  const appProf = resolveAppType(appType);

  console.log(`[generate] language=${lang} appType=${appProf} testTypes=${testTypes.join(',')}`);

  try {
    if (useAI && process.env.ANTHROPIC_API_KEY) {
      const claude = require('../services/claude.service');
      const result = await claude.generateTests({
        pages, dbQueries: [], pattern, testTypes, mode, prsContent,
        language: lang, appType: appProf,
      });
      return res.json({ success: true, data: result, source: 'ai', language: lang });
    }

    const result = generateAll({ pages, testTypes, language: lang, frameworkAnalysis, pattern, appType: appProf });
    res.json({ success: true, data: result, source: 'template', language: lang, appType: appProf });
  } catch (err) { next(err); }
});

module.exports = router;
