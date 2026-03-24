/**
 * ConfigTab — Main configuration panel
 *
 * Each of the 4 panels has an enable/disable checkbox in its header.
 * On Initialize Agent, only the ACTIVE (checked) panels trigger their agents.
 *
 * Panels:
 *  1. Automation Framework Repo  — agent reads existing PW framework for design patterns
 *  2. UI / Frontend Repository   — Playwright browser agent crawls the live app
 *  3. Backend / DB Repository    — Claude extracts DB queries for E2E assertions
 *  4. Locator Patterns           — user-defined element-type → XPath/CSS templates
 */
import { useState } from 'react';
import { SourceForm } from '../shared/SourceForm.jsx';
import { Alert, Spinner } from '../shared/index.jsx';
import {
  DEFAULT_PANELS,
  DEFAULT_LOCATOR_PATTERNS,
  DEFAULT_LOCATOR_PRIORITY,
  LOCATOR_STRATEGY_COLORS,
  LANGUAGE_OPTIONS,
} from '../../constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Panel wrapper with enable / disable checkbox header
// ─────────────────────────────────────────────────────────────────────────────
function PanelCard({ panelKey, title, icon, badge, color = 'var(--cyan)', enabled, onToggle, children }) {
  return (
    <div style={{
      borderRadius: 6,
      border: `1px solid ${enabled ? color + '44' : 'var(--border)'}`,
      background: enabled ? `${color}08` : 'rgba(0,0,0,0.1)',
      transition: 'border-color .2s, background .2s',
      overflow: 'hidden',
    }}>
      {/* ── Header row ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: enabled ? `${color}10` : 'rgba(0,0,0,0.12)',
          borderBottom: enabled ? `1px solid ${color}22` : '1px solid transparent',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => onToggle(panelKey)}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => { e.stopPropagation(); onToggle(panelKey); }}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: color, width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          color: enabled ? '#e2e8f0' : 'var(--muted2)', flex: 1,
        }}>
          {title}
        </span>
        {badge && (
          <span style={{
            fontSize: 9, fontFamily: 'JetBrains Mono', padding: '1px 7px',
            borderRadius: 12, background: color + '22', color, border: `1px solid ${color}44`,
          }}>{badge}</span>
        )}
        <span style={{
          fontSize: 9, fontFamily: 'JetBrains Mono', padding: '2px 9px', borderRadius: 12,
          background: enabled ? 'rgba(16,185,129,.15)' : 'rgba(107,114,128,.12)',
          color: enabled ? '#10b981' : 'var(--muted2)',
          border: `1px solid ${enabled ? 'rgba(16,185,129,.3)' : 'rgba(107,114,128,.2)'}`,
          fontWeight: 700, letterSpacing: 1,
        }}>
          {enabled ? 'ACTIVE' : 'DISABLED'}
        </span>
      </div>

      {/* ── Content — only shown when enabled ──────────── */}
      {enabled && (
        <div style={{ padding: 14 }}>
          {children}
        </div>
      )}

      {/* ── Disabled placeholder ───────────────────────── */}
      {!enabled && (
        <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted2)', fontFamily: 'JetBrains Mono', fontStyle: 'italic' }}>
          Panel disabled — enable to activate this agent
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Locator Patterns Table
// ─────────────────────────────────────────────────────────────────────────────
function LocatorPatternsTable({ patterns, onChange }) {
  const [editing, setEditing] = useState(null); // id of row being edited
  const [draft,   setDraft]   = useState({});
  const [newRow,  setNewRow]  = useState({ elementType: '', pattern: '', strategy: 'xpath' });
  const [showAdd, setShowAdd] = useState(false);

  const update = (id, field, val) =>
    onChange(patterns.map(r => r.id === id ? { ...r, [field]: val } : r));

  const toggleEnabled = id =>
    onChange(patterns.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const remove = id => onChange(patterns.filter(r => r.id !== id));

  const startEdit = row => { setEditing(row.id); setDraft({ ...row }); };
  const saveEdit  = () => { onChange(patterns.map(r => r.id === editing ? { ...draft } : r)); setEditing(null); };
  const cancelEdit = () => setEditing(null);

  const addRow = () => {
    if (!newRow.elementType.trim() || !newRow.pattern.trim()) return;
    onChange([...patterns, { ...newRow, id: `custom_${Date.now()}`, enabled: true, custom: true }]);
    setNewRow({ elementType: '', pattern: '', strategy: 'xpath' });
    setShowAdd(false);
  };

  const placeholder_hint = '{text}  {id}  {name}  {placeholder}  {aria-label}  {value}  {class}';

  return (
    <div>
      {/* Placeholder legend */}
      <div style={{
        fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--muted2)',
        padding: '5px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4,
        marginBottom: 10, lineHeight: 1.8,
      }}>
        <strong style={{ color: 'var(--amber)' }}>Available placeholders:</strong>{' '}
        {placeholder_hint.split('  ').map(p => (
          <span key={p} style={{ marginRight: 6, color: 'var(--cyan)', background: 'rgba(6,182,212,.1)', padding: '0 4px', borderRadius: 3 }}>{p}</span>
        ))}
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
            <th style={th}>ON</th>
            <th style={th}>Element Type</th>
            <th style={th}>XPath / CSS Pattern Template</th>
            <th style={th}>Strategy</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {patterns.map(row => (
            <tr key={row.id} style={{ background: row.enabled ? 'transparent' : 'rgba(0,0,0,0.15)', opacity: row.enabled ? 1 : 0.5 }}>
              {editing === row.id ? (
                /* ── Edit mode ── */
                <>
                  <td style={td}><input type="checkbox" checked={draft.enabled} onChange={e => setDraft(d => ({ ...d, enabled: e.target.checked }))} style={{ accentColor: 'var(--cyan)' }} /></td>
                  <td style={td}><input className="input" style={{ fontSize: 10, padding: '2px 6px' }} value={draft.elementType} onChange={e => setDraft(d => ({ ...d, elementType: e.target.value }))} /></td>
                  <td style={td}><input className="input" style={{ fontSize: 10, padding: '2px 6px', fontFamily: 'JetBrains Mono', width: '100%' }} value={draft.pattern} onChange={e => setDraft(d => ({ ...d, pattern: e.target.value }))} /></td>
                  <td style={td}>
                    <select className="select" style={{ fontSize: 10, padding: '2px 4px' }} value={draft.strategy} onChange={e => setDraft(d => ({ ...d, strategy: e.target.value }))}>
                      <option value="xpath">xpath</option>
                      <option value="css">css</option>
                    </select>
                  </td>
                  <td style={{ ...td, display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 9 }} onClick={saveEdit}>✓</button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 9 }} onClick={cancelEdit}>✕</button>
                  </td>
                </>
              ) : (
                /* ── View mode ── */
                <>
                  <td style={td}>
                    <input type="checkbox" checked={row.enabled} onChange={() => toggleEnabled(row.id)} style={{ accentColor: 'var(--cyan)' }} />
                  </td>
                  <td style={{ ...td, color: 'var(--amber)', fontWeight: 600 }}>{row.elementType}</td>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono', color: 'var(--green)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.pattern}>
                    {row.pattern}
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 12, background: row.strategy === 'css' ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)', color: row.strategy === 'css' ? 'var(--amber)' : '#f87171', border: `1px solid ${row.strategy === 'css' ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)'}` }}>
                      {row.strategy}
                    </span>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: '1px 6px' }} onClick={() => startEdit(row)}>✎</button>
                    {row.custom && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: '1px 6px', color: 'var(--red)', marginLeft: 3 }} onClick={() => remove(row.id)}>✕</button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add new row */}
      {showAdd ? (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <input className="input" style={{ flex: '0 0 160px', fontSize: 11 }} placeholder="Element type…" value={newRow.elementType} onChange={e => setNewRow(r => ({ ...r, elementType: e.target.value }))} />
          <input className="input" style={{ flex: 1, fontSize: 11, fontFamily: 'JetBrains Mono' }} placeholder="//tag[@attr='{placeholder}']" value={newRow.pattern} onChange={e => setNewRow(r => ({ ...r, pattern: e.target.value }))} />
          <select className="select" style={{ flex: '0 0 80px', fontSize: 11 }} value={newRow.strategy} onChange={e => setNewRow(r => ({ ...r, strategy: e.target.value }))}>
            <option value="xpath">xpath</option>
            <option value="css">css</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Add</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, fontSize: 10 }} onClick={() => setShowAdd(true)}>
          + Add Custom Pattern
        </button>
      )}
    </div>
  );
}
const th = { padding: '5px 8px', textAlign: 'left', fontSize: 10, color: 'var(--muted2)', fontWeight: 700, letterSpacing: 1, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '5px 8px', fontSize: 11, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

// ─────────────────────────────────────────────────────────────────────────────
// Pages to Crawl editor
// ─────────────────────────────────────────────────────────────────────────────
function PagesEditor({ value, onChange }) {
  const [input, setInput] = useState('');
  const pages = value || [];
  const add = () => {
    const v = input.trim();
    if (!v || pages.includes(v)) return;
    onChange([...pages, v.startsWith('/') ? v : `/${v}`]);
    setInput('');
  };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, minHeight: 24 }}>
        {pages.map(p => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'JetBrains Mono', padding: '2px 8px', background: 'rgba(6,182,212,.12)', border: '1px solid rgba(6,182,212,.3)', borderRadius: 12, color: 'var(--cyan)' }}>
            {p}
            <button onClick={() => onChange(pages.filter(x => x !== p))} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 9, padding: 0 }}>✕</button>
          </span>
        ))}
        {pages.length === 0 && <span style={{ fontSize: 11, color: 'var(--muted2)' }}>No pages — will crawl base URL only</span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="input" style={{ flex: 1, fontSize: 11 }} placeholder="/login  /dashboard  /patients …" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
        <button className="btn btn-secondary btn-sm" onClick={add}>+ Add</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Locator Priority rows (in Agent Settings)
// ─────────────────────────────────────────────────────────────────────────────
function LocatorRow({ rule, index, total, onToggle, onMove, onRemove }) {
  const color = LOCATOR_STRATEGY_COLORS[rule.kind] || '#6b7280';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: rule.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)', border: `1px solid ${rule.enabled ? 'var(--border2)' : 'var(--border)'}`, borderRadius: 4, marginBottom: 3, opacity: rule.enabled ? 1 : 0.5 }}>
      <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: 'var(--muted2)', width: 14, textAlign: 'center', flexShrink: 0 }}>{index + 1}</span>
      <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', padding: '1px 6px', borderRadius: 12, background: color + '22', color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>{rule.label}</span>
      {rule.attr && <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>[{rule.attr}]</span>}
      <div style={{ flex: 1 }} />
      <button className="btn btn-ghost btn-sm" style={{ padding: '1px 4px', fontSize: 9 }} onClick={() => onMove(index, -1)} disabled={index === 0}>↑</button>
      <button className="btn btn-ghost btn-sm" style={{ padding: '1px 4px', fontSize: 9 }} onClick={() => onMove(index, +1)} disabled={index === total - 1}>↓</button>
      <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
        <input type="checkbox" checked={rule.enabled} onChange={() => onToggle(index)} style={{ accentColor: color }} />
        <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'JetBrains Mono', minWidth: 22 }}>{rule.enabled ? 'ON' : 'OFF'}</span>
      </label>
      {rule.custom && <button className="btn btn-ghost btn-sm" style={{ padding: '1px 4px', fontSize: 9, color: 'var(--red)' }} onClick={() => onRemove(index)}>✕</button>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ConfigTab
// ─────────────────────────────────────────────────────────────────────────────
export default function ConfigTab({ config, setConfig, onInit, initDone, serverOk, checking }) {
  const update = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  // Panel enabled state
  const panels    = config.panels    || DEFAULT_PANELS;
  const setPanels = val => update('panels', val);
  const togglePanel = key => setPanels({ ...panels, [key]: !panels[key] });

  // Language
  const language    = config.language || 'typescript';
  const setLanguage = v => update('language', v);

  // Locator patterns
  const locatorPatterns    = config.locatorPatterns    || DEFAULT_LOCATOR_PATTERNS;
  const setLocatorPatterns = arr => update('locatorPatterns', arr);

  // Locator priority (for agent)
  const priority    = config.locatorPriority    || DEFAULT_LOCATOR_PRIORITY;
  const setPriority = arr => update('locatorPriority', arr);
  const togglePri   = i => { const n = [...priority]; n[i] = { ...n[i], enabled: !n[i].enabled }; setPriority(n); };
  const movePri     = (i, dir) => { const n = [...priority]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setPriority(n); };
  const removePri   = i => setPriority(priority.filter((_, idx) => idx !== i));

  // Crawl settings (live inside uiRepo panel)
  const [agentOpen, setAgentOpen] = useState(false);

  const activeCount = Object.values(panels).filter(Boolean).length;
  const langOpt     = LANGUAGE_OPTIONS.find(l => l.value === language) || LANGUAGE_OPTIONS[0];

  return (
    <div className="panel-scroll">
      {serverOk === false && (
        <Alert type="error">⚠ Cannot reach backend at http://localhost:3001. Run <code>npm run server</code>.</Alert>
      )}

      {/* ── Language Selector ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 14, border: '1px solid rgba(139,92,246,.3)', background: 'rgba(139,92,246,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--purple)', marginBottom: 6 }}>
              🌐 Test Language
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted2)' }}>
              Agent will generate test cases and Page Object Models in the selected language.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {LANGUAGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setLanguage(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
                  border: `2px solid ${language === opt.value ? '#8b5cf6' : 'var(--border)'}`,
                  background: language === opt.value ? 'rgba(139,92,246,.2)' : 'transparent',
                  transition: 'all .15s',
                  minWidth: 80,
                }}
              >
                <span style={{ fontSize: 20 }}>{opt.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: language === opt.value ? '#c4b5fd' : 'var(--muted2)' }}>{opt.label}</span>
                <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'JetBrains Mono' }}>{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4 Panels in 2-column grid ─────────────────────────────────────── */}
      <div className="grid-2" style={{ gap: 14 }}>

        {/* ── Panel 1: Automation Framework Repo ─────────────────── */}
        <PanelCard
          panelKey="autRepo"
          title="Automation Framework Repo"
          icon="🏗"
          badge="Pattern Reader"
          color="#06b6d4"
          enabled={panels.autRepo}
          onToggle={togglePanel}
        >
          <p style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.7 }}>
            Agent reads your <strong style={{ color: 'var(--cyan)' }}>existing Playwright framework</strong> — folder structure, naming conventions, POM class style, imports and fixture patterns. All generated tests will follow the same design pattern.
          </p>
          <SourceForm value={config.autRepo || {}} onChange={v => update('autRepo', v)} />
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(6,182,212,.06)', borderRadius: 4, border: '1px solid rgba(6,182,212,.2)', fontSize: 10, color: 'var(--cyan)', fontFamily: 'JetBrains Mono', lineHeight: 1.7 }}>
            ℹ When active, agent will: extract folder structure · naming conventions · POM style · import style · fixture patterns → used as template for all generated files.
          </div>
        </PanelCard>

        {/* ── Panel 2: UI / Frontend Repo (Browser Agent) ────────── */}
        <PanelCard
          panelKey="uiRepo"
          title="UI / Frontend Repository"
          icon="🎭"
          badge="Browser Agent"
          color="#f59e0b"
          enabled={panels.uiRepo}
          onToggle={togglePanel}
        >
          <p style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.7 }}>
            Playwright opens a <strong style={{ color: 'var(--amber)' }}>real Chromium browser</strong>, navigates your live app, discovers all interactive elements and applies your locator patterns.
          </p>

          <div className="field">
            <label>App Base URL <span style={{ color: 'var(--amber)', fontSize: 10 }}>← live application URL</span></label>
            <input className="input" placeholder="http://localhost:4200"
              value={config.agentBaseUrl || config.baseURL || ''}
              onChange={e => { update('agentBaseUrl', e.target.value); update('baseURL', e.target.value); }} />
          </div>

          <div className="field">
            <label>Pages to Crawl</label>
            <PagesEditor value={config.crawlPaths || ['/']} onChange={v => update('crawlPaths', v)} />
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={!!config.autoDiscover}
                  onChange={e => update('autoDiscover', e.target.checked)}
                  style={{ accentColor: 'var(--amber)' }} />
                Auto-discover routes
              </label>
              {config.autoDiscover && (
                <input className="input" style={{ width: 70, fontSize: 11, padding: '3px 6px' }}
                  type="number" min={3} max={50}
                  value={config.maxPages || 15}
                  onChange={e => update('maxPages', +e.target.value)} />
              )}
            </div>
          </div>

          <div className="grid-2" style={{ gap: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--amber)', fontFamily: 'JetBrains Mono', padding: '5px 8px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 4, marginBottom: 10, lineHeight: 1.6 }}>
              🔐 If your app shows a login screen, enter credentials here. The agent will auto-detect the login form, fill credentials, authenticate first — then discover all routes and crawl pages.
            </div>
            <div className="field">
              <label>Browser Mode</label>
              <select className="select" value={config.headless !== false ? 'headless' : 'headed'}
                onChange={e => update('headless', e.target.value === 'headless')}>
                <option value="headless">Headless (fast)</option>
                <option value="headed">Headed (debug)</option>
              </select>
            </div>
            <div className="field">
              <label>Application Type</label>
              <select className="select" value={config.appType || 'spa'}
                onChange={e => update('appType', e.target.value)}>
                <option value="web">Web</option>
                <option value="spa">SPA (React/Vue/Angular)</option>
                <option value="hybrid">Hybrid (Web + API)</option>
                <option value="electron">Electron</option>
              </select>
            </div>
          </div>

          <div className="grid-2" style={{ gap: 8 }}>
            <div className="field">
              <label style={{ fontSize: 10 }}>HTTP Auth Username</label>
              <input className="input" placeholder="admin" value={config.authUser || ''}
                onChange={e => update('authUser', e.target.value)} />
            </div>
            <div className="field">
              <label style={{ fontSize: 10 }}>HTTP Auth Password</label>
              <input className="input" type="password" placeholder="••••••" value={config.authPass || ''}
                onChange={e => update('authPass', e.target.value)} />
            </div>
          </div>
        </PanelCard>

        {/* ── Panel 3: Backend / DB Repository ───────────────────── */}
        <PanelCard
          panelKey="dbRepo"
          title="Backend / DB Repository"
          icon="🗄"
          badge="DB Validator"
          color="#8b5cf6"
          enabled={panels.dbRepo}
          onToggle={togglePanel}
        >
          <p style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.7 }}>
            Agent extracts <strong style={{ color: 'var(--purple)' }}>database queries</strong> from your backend source and maps them to UI actions for end-to-end validation assertions.
          </p>
          <SourceForm value={config.dbRepo || {}} onChange={v => update('dbRepo', v)} />
          <div className="field" style={{ marginTop: 8 }}>
            <label>DB Platform</label>
            <select className="select" value={config.dbPlatform || 'mssql'}
              onChange={e => update('dbPlatform', e.target.value)}>
              <option value="mssql">MS SQL Server</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="oracle">Oracle</option>
            </select>
          </div>
        </PanelCard>

        {/* ── Panel 4: Locator Patterns ───────────────────────────── */}
        <PanelCard
          panelKey="locatorPatterns"
          title="Locator Patterns"
          icon="🎯"
          badge="Template Engine"
          color="#10b981"
          enabled={panels.locatorPatterns}
          onToggle={togglePanel}
        >
          <p style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.7 }}>
            Define <strong style={{ color: 'var(--green)' }}>element-type → XPath/CSS templates</strong> for your application. The agent reads these patterns to generate locators. Use <code style={{ color: 'var(--amber)' }}>{'{placeholder}'}</code> notation for dynamic values.
          </p>

          <LocatorPatternsTable
            patterns={locatorPatterns}
            onChange={setLocatorPatterns}
          />

          {/* Agent strategy priority - collapsible */}
          <div style={{ marginTop: 14 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 10, width: '100%', justifyContent: 'space-between', display: 'flex' }}
              onClick={() => setAgentOpen(o => !o)}
            >
              <span>⚙ Agent Discovery Priority (Playwright fallback order)</span>
              <span>{agentOpen ? '▲' : '▼'}</span>
            </button>

            {agentOpen && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 8, lineHeight: 1.6 }}>
                  When no custom pattern matches, agent falls back to this priority chain:
                </p>
                {priority.map((rule, i) => (
                  <LocatorRow key={rule.id} rule={rule} index={i} total={priority.length}
                    onToggle={togglePri} onMove={movePri} onRemove={removePri} />
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                    onClick={() => setPriority(DEFAULT_LOCATOR_PRIORITY)}>↺ Reset defaults</button>
                </div>
              </div>
            )}
          </div>
        </PanelCard>
      </div>

      {/* ── Initialize button + active agent summary ──────────────────────── */}
      <div className="card" style={{ marginTop: 14, border: '1px solid rgba(16,185,129,.25)', background: 'rgba(16,185,129,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

          {/* Active agent pills */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 8 }}>
              Agents on Initialize ({activeCount} active)
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'autRepo',         label: '🏗 Framework Reader',  color: '#06b6d4' },
                { key: 'uiRepo',          label: '🎭 Browser Crawler',   color: '#f59e0b' },
                { key: 'dbRepo',          label: '🗄 DB Analyzer',       color: '#8b5cf6' },
                { key: 'locatorPatterns', label: '🎯 Pattern Engine',    color: '#10b981' },
              ].map(({ key, label, color }) => (
                <span key={key} style={{
                  fontSize: 10, fontFamily: 'JetBrains Mono', padding: '3px 10px',
                  borderRadius: 12, whiteSpace: 'nowrap',
                  background: panels[key] ? color + '20' : 'rgba(0,0,0,0.15)',
                  color: panels[key] ? color : 'var(--muted2)',
                  border: `1px solid ${panels[key] ? color + '44' : 'var(--border)'}`,
                  opacity: panels[key] ? 1 : 0.5,
                }}>
                  {panels[key] ? '✓' : '○'} {label}
                </span>
              ))}
              <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', padding: '3px 10px', borderRadius: 12, background: 'rgba(139,92,246,.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,.3)', whiteSpace: 'nowrap' }}>
                {langOpt.icon} {langOpt.label} output
              </span>
            </div>
          </div>

          {/* Init button */}
          <button className="btn btn-primary" style={{ flexShrink: 0, minWidth: 200, fontSize: 13 }}
            onClick={onInit} disabled={checking}>
            {checking
              ? <><Spinner /> Checking server…</>
              : initDone
              ? '↻ RE-INITIALIZE AGENT'
              : '⚡ INITIALIZE AGENT'}
          </button>
        </div>
      </div>
    </div>
  );
}
