/**
 * API Service — all config parameters flow through here end-to-end
 * appType and language are forwarded to every relevant endpoint.
 */
const BASE = '/api';

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

// ── Claude AI Analysis ────────────────────────────────────────────────────────
export const analyzeFramework = code    => request('POST', '/claude/analyze/framework', { code });
export const analyzeUI        = code    => request('POST', '/claude/analyze/ui',        { code });
export const analyzeDB        = code    => request('POST', '/claude/analyze/db',        { code });
export const generateTests    = payload => request('POST', '/claude/generate',           payload);

// ── Playwright Agent ──────────────────────────────────────────────────────────
export const getLocatorDefaults    = ()     => request('GET', '/agent/locator-defaults');

export const agentAnalyzeFramework = (code, useAI = true) =>
  request('POST', '/agent/analyze-framework', { code, useAI });

/**
 * Discover routes from a live app.
 * appType drives which nav selectors are used (angular/react/vue/web/hybrid/electron)
 */
export const agentDiscover = (baseUrl, maxPages, auth, appType = 'spa', headless = true) =>
  request('POST', '/agent/discover', { baseUrl, maxPages, auth, appType, headless });

/**
 * Crawl discovered pages and extract elements.
 * appType changes wait strategy, extra element selectors and expanded panels.
 */
export const agentCrawl = (baseUrl, paths, locatorConfig, auth, headless, appType = 'spa') =>
  request('POST', '/agent/crawl', { baseUrl, paths, locatorConfig, auth, headless, appType });

/**
 * Generate test files.
 * language controls output format (ts/js/py/java).
 * appType is passed for AI-enhanced generation context.
 * frameworkAnalysis (from Framework Repo agent) shapes POM style + naming.
 */
export const agentGenerate = payload => request('POST', '/agent/generate', payload);

// ── Repositories ──────────────────────────────────────────────────────────────
export const getGitHubTree  = (url, pat, branch)              => request('POST', '/repo/github/tree',  { url, pat, branch });
export const getGitHubFile  = (url, pat, path, branch)        => request('POST', '/repo/github/file',  { url, pat, path, branch });
export const getGitHubFiles = (url, pat, paths, branch)       => request('POST', '/repo/github/files', { url, pat, paths, branch });
export const getAzureTree   = (org, project, repo, pat)       => request('POST', '/repo/azure/tree',   { org, project, repo, pat });
export const getAzureFile   = (org, project, repo, pat, path) => request('POST', '/repo/azure/file',   { org, project, repo, pat, path });

// ── Upload ────────────────────────────────────────────────────────────────────
export async function uploadFiles(files) {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  const res  = await fetch(`${BASE}/repo/upload`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

// ── Export ────────────────────────────────────────────────────────────────────
export async function exportCanvasExcel(canvasData) {
  const res  = await fetch(`${BASE}/export/canvas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(canvasData) });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'testgen-canvas.xlsx'; a.click();
  URL.revokeObjectURL(url);
}

// ── Health ────────────────────────────────────────────────────────────────────
export const checkHealth = () => fetch('http://localhost:3001/health').then(r => r.json());
