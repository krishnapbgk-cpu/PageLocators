/**
 * AnalyzeTab — Runs agents in sequence, forwarding ALL config params:
 *   appType     → drives Playwright profile (nav selectors, wait strategy)
 *   language    → stored in analysis for GenerateTab
 *   auth        → form-login credentials
 *   headless    → browser mode
 *   locatorConfig (priority + userPatterns)
 *   frameworkAnalysis (from Step 1)
 */
import { useState } from 'react';
import { LogStream, ProgressBar, StatGrid, Alert, Spinner } from '../shared/index.jsx';
import * as api from '../../services/api.js';
import { DEFAULT_LOCATOR_PRIORITY, LANGUAGE_OPTIONS } from '../../constants.js';

const VIEWS = ['components', 'framework', 'db'];

const STRATEGY_COLORS = {
  testid: '#06b6d4', css: '#f59e0b', aria: '#10b981', role: '#8b5cf6',
  placeholder: '#3b82f6', text: '#ec4899', xpath: '#ef4444',
  'user-pattern': '#8b5cf6', attribute: '#f59e0b', id: '#10b981',
};

const APP_TYPE_LABELS = {
  spa: 'SPA', 'spa-angular': 'Angular', 'spa-react': 'React',
  'spa-vue': 'Vue', web: 'Web', hybrid: 'Hybrid', electron: 'Electron',
};

async function resolveCode(repo) {
  if (!repo) return '';
  if (repo.source === 'local') return JSON.stringify((repo.files || []).filter(f => f?.content));
  if (repo.source === 'github') {
    if (!repo.url) return '';
    const tree  = await api.getGitHubTree(repo.url, repo.pat, repo.branch);
    const paths = tree.files.slice(0, 20).map(f => f.path);
    const files = await api.getGitHubFiles(repo.url, repo.pat, paths, repo.branch);
    return Object.values(files.files).join('\n\n');
  }
  if (repo.source === 'azure') {
    if (!repo.org || !repo.project || !repo.repo || !repo.pat) return '';
    const tree  = await api.getAzureTree(repo.org, repo.project, repo.repo, repo.pat);
    const chunk = tree.files.filter(f => /\.(ts|js|tsx|jsx)$/.test(f.path)).slice(0, 15);
    const results = await Promise.all(chunk.map(f =>
      api.getAzureFile(repo.org, repo.project, repo.repo, repo.pat, f.path)));
    return JSON.stringify(results);
  }
  return '';
}

function PageScreenshot({ screenshot, name }) {
  if (!screenshot) return null;
  return (
    <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 8 }}>
      <img src={`data:image/jpeg;base64,${screenshot}`} alt={name}
        style={{ width: '100%', maxHeight: 130, objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.7))', fontSize: 9, fontFamily: 'JetBrains Mono', color: '#aaa', padding: '3px 8px' }}>
        🎭 {name}
      </div>
    </div>
  );
}

export default function AnalyzeTab({ config, analysis, setAnalysis, initDone, addLog, logs }) {
  const [running,    setRunning]   = useState(false);
  const [progress,   setProgress]  = useState(0);
  const [activeView, setActiveView]= useState('components');

  const panels   = config.panels   || {};
  const language = config.language || 'typescript';
  const appType  = config.appType  || 'spa';
  const langOpt  = LANGUAGE_OPTIONS.find(l => l.value === language) || LANGUAGE_OPTIONS[0];
  const appLabel = APP_TYPE_LABELS[appType] || appType;

  const auth = (config.authUser && config.authPass)
    ? { username: config.authUser, password: config.authPass }
    : null;

  const run = async () => {
    if (!initDone) { addLog('warn', 'Initialize agent in CONFIG tab first'); return; }
    if (!panels.autRepo && !panels.uiRepo && !panels.dbRepo) {
      addLog('warn', 'No agents enabled — enable panels in CONFIG and re-initialize'); return;
    }

    setRunning(true); setProgress(0); setAnalysis({});
    addLog('ok', '━━ ANALYSIS STARTED ━━');
    addLog('info', `Language: ${langOpt.icon} ${langOpt.label} | App type: ${appLabel}`);
    if (auth) addLog('info', `Auth: ${auth.username} (form login)`);

    try {
      let frameworkAnalysis = null;

      // ── Step 1: Framework Reader ────────────────────────────────────────
      if (panels.autRepo) {
        addLog('info', '🏗 [Step 1/3] Framework Reader…');
        setProgress(8);
        try {
          const fwCode = await resolveCode(config.autRepo).catch(() => '');
          if (fwCode && fwCode.length > 50) {
            addLog('info', `   ${fwCode.length} chars of framework code resolved`);
            const res = await api.agentAnalyzeFramework(fwCode, !!process.env?.ANTHROPIC_API_KEY);
            frameworkAnalysis = res.data;
            setAnalysis(a => ({ ...a, framework: frameworkAnalysis }));
            addLog('ok', `   ✓ Framework patterns: ${frameworkAnalysis?.pomStyle} | ${frameworkAnalysis?.importStyle}`);
            addLog('ok', `   Structure → pages: ${frameworkAnalysis?.structure?.pages} | tests: ${frameworkAnalysis?.structure?.tests}`);
          } else {
            addLog('warn', '   Framework code empty — check repo config');
          }
        } catch (err) { addLog('warn', `   Framework step skipped: ${err.message}`); }
        setProgress(25);
      }

      // ── Step 2: Browser Crawler ─────────────────────────────────────────
      if (panels.uiRepo) {
        const baseUrl = config.agentBaseUrl || config.baseURL;
        if (!baseUrl) {
          addLog('warn', '🎭 [Step 2/3] Browser Crawler skipped — no App Base URL');
        } else {
          addLog('info', `🎭 [Step 2/3] Browser Crawler [${appLabel}] → ${baseUrl}`);
          setProgress(30);

          let paths = config.crawlPaths?.length ? config.crawlPaths : ['/'];

          if (config.autoDiscover) {
            addLog('info', `   Auto-discovering routes (max ${config.maxPages || 50}, appType: ${appLabel})…`);
            try {
              const disc = await api.agentDiscover(
                baseUrl,
                config.maxPages || 50,
                auth,
                appType,           // ← appType forwarded
                config.headless !== false,
              );
              paths = disc.data.routes;
              disc.data.logs?.forEach(l => addLog(l.level, `   ${l.msg}`));
              addLog('ok', `   Discovered ${paths.length} routes`);
            } catch (err) {
              addLog('warn', `   Discovery failed: ${err.message} — using configured paths`);
            }
          }

          setProgress(40);
          addLog('info', `   Crawling ${paths.length} page(s): ${paths.join(', ')}`);

          const locatorConfig = {
            priority:     config.locatorPriority || DEFAULT_LOCATOR_PRIORITY,
            userPatterns: panels.locatorPatterns
              ? (config.locatorPatterns || []).filter(p => p.enabled)
              : [],
          };

          const res = await api.agentCrawl(
            baseUrl,
            paths,
            locatorConfig,
            auth,
            config.headless !== false,
            appType,             // ← appType forwarded
          );
          setProgress(75);

          const pages = res.data.pages || [];
          res.data.logs?.forEach(l => addLog(l.level, `   ${l.msg}`));

          const total = pages.reduce((s, p) => s + (p.components?.length || 0), 0);
          setAnalysis(a => ({ ...a, pages, frameworkAnalysis, language, appType }));
          addLog('ok', `   ✓ Crawl done — ${total} elements across ${pages.length} page(s)`);

          const dist = pages.flatMap(p => p.components || []).reduce((acc, c) => {
            acc[c.locatorType] = (acc[c.locatorType] || 0) + 1; return acc;
          }, {});
          addLog('info', `   Locators: ${Object.entries(dist).map(([k, v]) => `${k}(${v})`).join(' · ')}`);
        }
        setProgress(80);
      }

      // ── Step 3: DB Analyzer ─────────────────────────────────────────────
      if (panels.dbRepo) {
        addLog('info', '🗄 [Step 3/3] DB Analyzer…');
        setProgress(85);
        try {
          const dbCode = await resolveCode(config.dbRepo).catch(() => '');
          if (dbCode && dbCode.length > 50) {
            const dbRes   = await api.analyzeDB(dbCode);
            const queries = dbRes.data?.queries || [];
            setAnalysis(a => ({ ...a, dbQueries: queries }));
            addLog('ok', `   ✓ ${queries.length} DB queries extracted`);
          } else {
            addLog('warn', '   DB repo code empty — check repo config');
          }
        } catch (err) { addLog('warn', `   DB step skipped: ${err.message}`); }
        setProgress(95);
      }

      setAnalysis(a => ({ ...a, done: true, runAt: new Date().toLocaleString(), language, appType }));
      setProgress(100);
      addLog('ok', `━━ ANALYSIS COMPLETE — ${langOpt.icon} ${langOpt.label} tests ready ━━`);

    } catch (err) {
      addLog('err', `Analysis error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const pages      = analysis.pages     || [];
  const queries    = analysis.dbQueries || [];
  const fw         = analysis.framework || {};
  const totalComps = pages.reduce((s, p) => s + (p.components?.length || 0), 0);
  const stratDist  = pages.flatMap(p => p.components || []).reduce((acc, c) => {
    acc[c.locatorType] = (acc[c.locatorType] || 0) + 1; return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Toolbar */}
      <div style={{ padding: '8px 14px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>

        <button className="btn btn-primary" onClick={run} disabled={running} style={{ flexShrink: 0 }}>
          {running ? <><Spinner /> RUNNING AGENTS…</> : '▶ RUN AGENTS'}
        </button>

        {/* Active panel pills */}
        {[
          { key: 'autRepo',        icon: '🏗', label: 'Framework',  color: '#06b6d4' },
          { key: 'uiRepo',         icon: '🎭', label: 'Browser',    color: '#f59e0b' },
          { key: 'dbRepo',         icon: '🗄', label: 'DB',         color: '#8b5cf6' },
          { key: 'locatorPatterns',icon: '🎯', label: 'Patterns',   color: '#10b981' },
        ].map(({ key, icon, label, color }) => (
          <span key={key} style={{
            fontSize: 9, fontFamily: 'JetBrains Mono', padding: '2px 8px', borderRadius: 12,
            background: panels[key] ? color + '18' : 'transparent',
            color:      panels[key] ? color : 'var(--muted2)',
            border:     `1px solid ${panels[key] ? color + '44' : 'var(--border)'}`,
            opacity:    panels[key] ? 1 : 0.4,
          }}>{icon} {label}</span>
        ))}

        {/* Config summary */}
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '2px 8px', borderRadius: 12, background: 'rgba(139,92,246,.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,.3)' }}>
          {langOpt.icon} {langOpt.label}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)' }}>
          📱 {appLabel}
        </span>
        {auth && (
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '2px 8px', borderRadius: 12, background: 'rgba(6,182,212,.1)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,.3)' }}>
            🔐 {auth.username}
          </span>
        )}

        {analysis.done && (
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--green)', marginLeft: 'auto' }}>
            ✓ {analysis.runAt}
          </span>
        )}

        <div style={{ display: 'flex', gap: 5, marginLeft: analysis.done ? 0 : 'auto' }}>
          {VIEWS.map(v => (
            <button key={v} className={`btn btn-sm ${activeView === v ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setActiveView(v)}>{v.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {running && <div style={{ padding: '4px 14px 0', flexShrink: 0 }}><ProgressBar value={progress} running label="Running agents…" /></div>}

      {analysis.done && (
        <div style={{ padding: '6px 14px 0', flexShrink: 0 }}>
          <StatGrid stats={[
            { value: pages.length,              label: 'Pages'      },
            { value: totalComps,                label: 'Elements'   },
            { value: queries.length,            label: 'DB Queries' },
            { value: Object.keys(stratDist).length, label: 'Strategies' },
            { value: fw.pomStyle  || '—',       label: 'POM Style'  },
            { value: appLabel,                  label: 'App Type'   },
            { value: langOpt.label,             label: 'Language'   },
          ]} />
        </div>
      )}

      {/* Body */}
      <div className="layout-main" style={{ flex: 1, overflow: 'hidden' }}>

        {/* Log sidebar */}
        <div className="split-left" style={{ padding: '12px 14px' }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Agent Log</div>
          <LogStream logs={logs} />

          {!running && !analysis.done && (
            <div style={{ marginTop: 12, padding: 10, border: '1px solid rgba(6,182,212,.2)', borderRadius: 4, background: 'rgba(6,182,212,.04)', fontSize: 10, fontFamily: 'JetBrains Mono', lineHeight: 1.8 }}>
              <div style={{ color: 'var(--cyan)', fontWeight: 700, marginBottom: 6 }}>AGENT SEQUENCE</div>
              {[
                { key: 'autRepo', step: 1, icon: '🏗', label: 'Framework Reader' },
                { key: 'uiRepo',  step: 2, icon: '🎭', label: 'Browser Crawler'  },
                { key: 'dbRepo',  step: 3, icon: '🗄', label: 'DB Analyzer'      },
              ].map(({ key, step, icon, label }) => (
                <div key={key} style={{ color: panels[key] ? 'var(--green)' : 'var(--muted2)', marginBottom: 3 }}>
                  {panels[key] ? '●' : '○'} {step}. {icon} {label}
                </div>
              ))}
              <div style={{ marginTop: 8, color: 'var(--amber)' }}>
                Profile: {appLabel} | Out: {langOpt.label}
              </div>
              {!initDone && <div style={{ marginTop: 6, color: 'var(--red)' }}>⚠ Initialize agent first</div>}
            </div>
          )}
        </div>

        {/* Data pane */}
        <div className="split-right">

          {/* COMPONENTS VIEW */}
          {activeView === 'components' && (
            <>
              <div className="card-title" style={{ marginBottom: 12 }}>
                🎭 Discovered Elements
                {pages.length > 0 && <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 8 }}>({appLabel} profile)</span>}
              </div>
              {pages.length === 0 && <Alert type="info">Run agents to discover elements.</Alert>}
              {pages.map((page, pi) => (
                <div key={pi} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-cyan">{page.name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted2)' }}>{page.path}</span>
                    {page.title && <span style={{ fontSize: 10, color: 'var(--muted)' }}>"{page.title}"</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--green)' }}>{page.components?.length || 0} elements</span>
                  </div>
                  <PageScreenshot screenshot={page.screenshot} name={page.name} />
                  {/* Strategy distribution badges */}
                  {(() => {
                    const d = (page.components || []).reduce((a, c) => { a[c.locatorType] = (a[c.locatorType] || 0) + 1; return a; }, {});
                    return (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        {Object.entries(d).sort((a, b) => b[1] - a[1]).map(([s, n]) => {
                          const c = STRATEGY_COLORS[s] || '#6b7280';
                          return <span key={s} style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '1px 7px', borderRadius: 12, background: c + '22', color: c, border: `1px solid ${c}44` }}>{s}: {n}</span>;
                        })}
                      </div>
                    );
                  })()}
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Type</th><th>Locator</th><th>Strategy</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(page.components || []).map((c, ci) => {
                        const color = STRATEGY_COLORS[c.locatorType] || '#6b7280';
                        return (
                          <tr key={ci}>
                            <td style={{ color: 'var(--amber)', fontSize: 11 }}>{c.name}</td>
                            <td><span className="badge badge-blue">{c.type}</span></td>
                            <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--green)', fontSize: 10, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.locator}>{c.locator}</td>
                            <td><span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '1px 6px', borderRadius: 12, background: color + '22', color, border: `1px solid ${color}44` }}>{c.locatorType}</span></td>
                            <td style={{ fontSize: 9, color: 'var(--muted2)' }}>{(c.actions || []).slice(0, 3).join(', ')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          )}

          {/* FRAMEWORK VIEW */}
          {activeView === 'framework' && (
            <>
              <div className="card-title" style={{ marginBottom: 12 }}>🏗 Framework Analysis</div>
              {!fw.structure && !fw.naming
                ? <Alert type="info">Enable "Automation Framework Repo" and run agents.</Alert>
                : <>
                    {[
                      { label: 'Folder Structure',   val: fw.structure,      color: '#06b6d4' },
                      { label: 'Naming Conventions', val: fw.naming,         color: '#f59e0b' },
                      { label: 'POM Style',          val: fw.pomStyle,       color: '#10b981' },
                      { label: 'Test Structure',     val: fw.testStructure,  color: '#8b5cf6' },
                      { label: 'Import Style',       val: fw.importStyle,    color: '#ec4899' },
                      { label: 'Fixture Patterns',   val: fw.fixtureUsage,   color: '#3b82f6' },
                    ].filter(r => r.val).map(({ label, val, color }) => (
                      <div key={label} className="card" style={{ marginBottom: 8, border: `1px solid ${color}22` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                        <pre style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--muted2)', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)}
                        </pre>
                      </div>
                    ))}
                    {fw.insights && (
                      <div className="card" style={{ border: '1px solid rgba(6,182,212,.2)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cyan)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Insights</div>
                        <div style={{ fontSize: 11, color: 'var(--muted2)', lineHeight: 1.7 }}>{fw.insights}</div>
                      </div>
                    )}
                  </>
              }
            </>
          )}

          {/* DB VIEW */}
          {activeView === 'db' && (
            <>
              <div className="card-title" style={{ marginBottom: 12 }}>🗄 DB Queries</div>
              {queries.length === 0
                ? <Alert type="info">Enable "Backend / DB Repository" and run agents.</Alert>
                : <table className="data-table">
                    <thead><tr><th>Op</th><th>Table</th><th>UI Action</th><th>Query</th><th>Validation</th></tr></thead>
                    <tbody>
                      {queries.map((q, i) => (
                        <tr key={i}>
                          <td><span className={`badge badge-${q.operation === 'CREATE' ? 'green' : q.operation === 'DELETE' ? 'red' : 'amber'}`}>{q.operation}</span></td>
                          <td style={{ color: 'var(--purple)' }}>{q.table}</td>
                          <td style={{ fontSize: 10, color: 'var(--muted2)' }}>{q.relatedUIAction}</td>
                          <td style={{ fontSize: 10, color: 'var(--cyan)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.query}</td>
                          <td style={{ fontSize: 10, color: 'var(--green)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.validationQuery}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </>
          )}
        </div>
      </div>
    </div>
  );
}
