const express = require('express');
const router  = express.Router();
const claude  = require('../services/claude.service');

// ── POST /api/claude/analyze/framework ───────────────────
router.post('/analyze/framework', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'code is required' });
    const result = await claude.analyzeFramework(code);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── POST /api/claude/analyze/ui ──────────────────────────
router.post('/analyze/ui', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'code is required' });
    const result = await claude.extractUIComponents(code);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── POST /api/claude/analyze/db ──────────────────────────
router.post('/analyze/db', async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: 'code is required' });
    const result = await claude.extractDBQueries(code);
    res.json({ success: true, data: result });
  } catch (err) { next(err); next(err.message); }
});

// ── POST /api/claude/generate ────────────────────────────
router.post('/generate', async (req, res, next) => {
  try {
    const { pages, dbQueries, pattern, testTypes, mode, prsContent, snapshotCoverage, workflows } = req.body;
    if (!pages?.length) return res.status(400).json({ error: 'pages array is required' });

    const result = await claude.generateTests({
      pages, dbQueries: dbQueries || [], pattern,
      testTypes: testTypes || ['e2e', 'positive', 'negative', 'bva'],
      mode: mode || 'first', prsContent, snapshotCoverage, workflows,
    });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;
