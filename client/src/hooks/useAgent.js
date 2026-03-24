import { useState, useCallback } from 'react';
import * as api from '../services/api';

export function useAgent() {
  const [logs,      setLogs]      = useState([]);
  const [analysis,  setAnalysis]  = useState({});
  const [canvas,    setCanvas]    = useState({ nodes: [], edges: [], workflows: [] });
  const [snapshots, setSnapshots] = useState([]);
  const [initDone,  setInitDone]  = useState(false);
  const [serverOk,  setServerOk]  = useState(null);

  const addLog = useCallback((type, msg) => {
    const time = new Date().toLocaleTimeString('en', { hour12: false });
    setLogs(ls => [...ls.slice(-199), { type, msg, time }]);
  }, []);

  const checkServer = useCallback(async () => {
    try {
      const h = await api.checkHealth();
      setServerOk(h.apiKeyConfigured);
      addLog('ok', `Server ready — API key ${h.apiKeyConfigured ? 'configured ✓' : 'MISSING (Claude AI features disabled)'}`);
      return h;
    } catch {
      setServerOk(false);
      addLog('err', 'Cannot reach server at http://localhost:3001');
      return null;
    }
  }, [addLog]);

  /**
   * initAgent — logs which agents will fire and what language is selected.
   * Does NOT call APIs — actual agent execution happens in AnalyzeTab.
   */
  const initAgent = useCallback((config) => {
    setInitDone(true);
    const panels   = config.panels   || {};
    const language = config.language || 'typescript';
    const langMap  = { typescript: '🔷 TypeScript', javascript: '🟨 JavaScript', python: '🐍 Python', java: '☕ Java' };

    addLog('ok', '━━━━━━ AGENT INITIALIZED ━━━━━━');
    addLog('info', `Output language: ${langMap[language] || language}`);

    // Report which agents are active
    const agentMap = [
      { key: 'autRepo',         icon: '🏗', name: 'Framework Reader',   detail: 'will extract design patterns from your existing Playwright framework' },
      { key: 'uiRepo',          icon: '🎭', name: 'Browser Crawler',    detail: `will crawl ${config.agentBaseUrl || config.baseURL || '(URL not set)'} — pages: ${(config.crawlPaths || ['/']).join(', ')}` },
      { key: 'dbRepo',          icon: '🗄', name: 'DB Analyzer',        detail: 'will extract DB queries for assertion validation' },
      { key: 'locatorPatterns', icon: '🎯', name: 'Pattern Engine',     detail: `${(config.locatorPatterns || []).filter(p => p.enabled).length} locator patterns active` },
    ];

    let activeCount = 0;
    agentMap.forEach(({ key, icon, name, detail }) => {
      if (panels[key]) {
        addLog('ok', `  ${icon} ${name}: ACTIVE — ${detail}`);
        activeCount++;
      } else {
        addLog('warn', `  ${icon} ${name}: disabled`);
      }
    });

    if (activeCount === 0) {
      addLog('warn', '⚠ No agents enabled — enable panels in CONFIG before running analysis');
    } else {
      addLog('ok', `${activeCount} agent(s) ready — proceed to ANALYZE tab`);
    }

    if (config.locatorPriority) {
      const enabled = config.locatorPriority.filter(r => r.enabled !== false);
      addLog('info', `Fallback locator chain (${enabled.length} active): ${enabled.map(r => r.label).join(' → ')}`);
    }
  }, [addLog]);

  const saveSnapshot = useCallback((data) => {
    const snap = { id: `snap_${Date.now()}`, createdAt: new Date().toLocaleString(), ...data };
    setSnapshots(ss => [...ss, snap]);
    addLog('ok', `Snapshot saved → ${snap.id}`);
    return snap;
  }, [addLog]);

  return {
    logs, addLog,
    analysis, setAnalysis,
    canvas,   setCanvas,
    snapshots, setSnapshots,
    initDone, initAgent,
    serverOk, checkServer,
    saveSnapshot,
  };
}
