const express = require('express');
const router  = express.Router();
const XLSX    = require('xlsx');

// ── POST /api/export/canvas ──────────────────────────────
router.post('/canvas', (req, res, next) => {
  try {
    const { nodes = [], edges = [], workflows = [] } = req.body;
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      nodes.map(n => ({ ID: n.id, Label: n.label, Type: n.type, X: Math.round(n.x), Y: Math.round(n.y) }))
    ), 'Nodes');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      edges.map(e => ({ ID: e.id, From: e.from, To: e.to }))
    ), 'Edges');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      workflows.map(w => ({ ID: w.id, Name: w.name, Nodes: (w.nodes || []).join(', '), Created: w.createdAt }))
    ), 'Workflows');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="testgen-canvas.xlsx"');
    res.send(buf);
  } catch (err) { next(err); }
});

// ── POST /api/export/tests ───────────────────────────────
// Returns a JSON array; client assembles into individual .ts downloads
router.post('/tests', (req, res, next) => {
  try {
    const { files = [] } = req.body;
    if (!files.length) return res.status(400).json({ error: 'files[] is required' });
    res.json({ success: true, files });
  } catch (err) { next(err); }
});

module.exports = router;
