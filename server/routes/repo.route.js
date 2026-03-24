const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const github  = require('../services/github.service');
const azure   = require('../services/azure.service');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── POST /api/repo/github/tree ───────────────────────────
router.post('/github/tree', async (req, res, next) => {
  try {
    const { url, pat, branch } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const files = await github.getFileTree(url, pat, branch || 'main');
    res.json({ success: true, files });
  } catch (err) { next(err); }
});

// ── POST /api/repo/github/file ───────────────────────────
router.post('/github/file', async (req, res, next) => {
  try {
    const { url, pat, path, branch } = req.body;
    if (!url || !path) return res.status(400).json({ error: 'url and path are required' });
    const content = await github.getFileContent(url, pat, path, branch || 'main');
    res.json({ success: true, content });
  } catch (err) { next(err); }
});

// ── POST /api/repo/github/files ──────────────────────────
router.post('/github/files', async (req, res, next) => {
  try {
    const { url, pat, paths, branch } = req.body;
    if (!url || !paths?.length) return res.status(400).json({ error: 'url and paths[] are required' });
    const files = await github.getMultipleFiles(url, pat, paths, branch || 'main');
    res.json({ success: true, files });
  } catch (err) { next(err); }
});

// ── POST /api/repo/azure/tree ────────────────────────────
router.post('/azure/tree', async (req, res, next) => {
  try {
    const { url, org, project, repo, pat } = req.body;
    
    // Support both URL format and separate parameters
    if (url) {
      const files = await azure.getFileTree(url, pat);
      res.json({ success: true, files });
    } else if (org && project && repo && pat) {
      const files = await azure.getFileTree(org, project, repo, pat);
      res.json({ success: true, files });
    } else {
      return res.status(400).json({ error: 'Either url+pat or org+project+repo+pat are required' });
    }
  } catch (err) { next(err); }
});

// ── POST /api/repo/azure/file ────────────────────────────
router.post('/azure/file', async (req, res, next) => {
  try {
    const { url, org, project, repo, pat, path } = req.body;
    
    // Support both URL format and separate parameters
    if (url && path) {
      const content = await azure.getFileContent(url, pat, path);
      res.json({ success: true, content });
    } else if (org && project && repo && pat && path) {
      const content = await azure.getFileContent(org, project, repo, pat, path);
      res.json({ success: true, content });
    } else {
      return res.status(400).json({ error: 'Either url+pat+path or org+project+repo+pat+path are required' });
    }
  } catch (err) { next(err); }
});

// ── POST /api/repo/upload ────────────────────────────────
router.post('/upload', upload.array('files', 50), (req, res) => {
  const files = (req.files || []).map(f => ({
    name:    f.originalname,
    content: f.buffer.toString('utf-8'),
    size:    f.size,
  }));
  res.json({ success: true, files });
});

module.exports = router;
