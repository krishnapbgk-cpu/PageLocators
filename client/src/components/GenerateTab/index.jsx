import { useState } from 'react';
import { ProgressBar, Alert, Spinner } from '../shared/index.jsx';
import { agentGenerate, generateTests } from '../../services/api.js';
import { TEST_TYPE_OPTIONS, LANGUAGE_OPTIONS } from '../../constants.js';
import { writeFilesToRepo } from '../../utils/folderAccess.js';

export default function GenerateTab({ analysis, canvas, config, snapshots, setSnapshots, addLog }) {
  const [mode,        setMode]       = useState('first');
  const [prs,         setPrs]        = useState('');
  const [testTypes,   setTestTypes]  = useState(['e2e', 'positive', 'negative', 'bva']);
  const [selWf,       setSelWf]      = useState('all');
  const [genning,     setGenning]    = useState(false);
  const [progress,    setProgress]   = useState(0);
  const [files,       setFiles]      = useState([]);
  const [pageObjs,    setPageObjs]   = useState([]);
  const [activeFile,  setActiveFile] = useState(0);
  const [activeTab,   setActiveTab]  = useState('tests');
  const [saveResult,  setSaveResult] = useState(null);
  const [saving,      setSaving]     = useState(false);

  const repoHandle = config?.autRepo?.folderHandle || null;
  const repoName   = config?.autRepo?.folderName   || null;
  const language   = config?.language || 'typescript';
  const langOpt    = LANGUAGE_OPTIONS.find(l => l.value === language) || LANGUAGE_OPTIONS[0];
  const useAI      = config?.useAIGeneration || false;
  const lastSnap   = snapshots[snapshots.length - 1];
  const workflows  = canvas.workflows || [];

  const targetWfNode  = selWf !== 'all' ? workflows.find(w => w.id === selWf) : null;
  const relevantNodes = targetWfNode
    ? (canvas.nodes || []).filter(n => targetWfNode.nodes.includes(n.id))
    : (canvas.nodes || []);

  const toggleType = t => setTestTypes(ts => ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]);

  const generate = async () => {
    if (!analysis.done)   { addLog('warn', 'Run Analysis first'); return; }
    if (!testTypes.length) { addLog('warn', 'Select at least one test type'); return; }

    setGenning(true); setProgress(0); setFiles([]); setPageObjs([]); setSaveResult(null);

    try {
      addLog('info', `Generating ${langOpt.icon} ${langOpt.label} tests — mode: ${mode}${useAI ? ' (AI-enhanced)' : ' (template)'}`);
      if (analysis.framework) addLog('info', '  Using framework patterns: ' + JSON.stringify(analysis.framework?.naming || {}));
      setProgress(25);

      const payload = {
        pages:             analysis.pages     || [],
        dbQueries:         analysis.dbQueries || [],
        testTypes,
        language,
        frameworkAnalysis: analysis.framework || null,
        pattern:           config?.pattern,
        mode,
        prsContent:        mode === 'incremental' ? prs : null,
        snapshotCoverage:  mode === 'incremental' && lastSnap ? lastSnap.coverage : null,
        workflows:         relevantNodes,
        useAI,
      };

      setProgress(40);
      addLog('info', 'Sending to generator…');
      const res  = await agentGenerate(payload);
      setProgress(85);

      const data = res.data;
      if (data?.files?.length) {
        setFiles(data.files);
        setPageObjs(data.pageObjects || []);
        addLog('ok', `✓ Generated ${data.files.length} test file(s) · ${data.coverage?.totalTests || '?'} tests · ${langOpt.icon} ${langOpt.label}`);
        if (data.coverage?.pages) addLog('info', `  Pages covered: ${data.coverage.pages.join(', ')}`);
        if (res.source) addLog('info', `  Engine: ${res.source} (language: ${res.language || language})`);

        if (repoHandle) {
          setProgress(92);
          addLog('info', `Writing into repo: ${repoName}…`);
          const result = await writeFilesToRepo(repoHandle, [...data.files, ...(data.pageObjects || [])]);
          setSaveResult(result);
          result.written.forEach(p => addLog('ok', `  └─ ${p}`));
          result.failed.forEach(f => addLog('err', `  ✗ ${f.path}: ${f.error}`));
        }

        setSnapshots(ss => [...ss, {
          id: `snap_${Date.now()}`, createdAt: new Date().toLocaleString(), mode,
          prsRef: prs ? prs.slice(0, 80) : null,
          fileCount: data.files.length, coverage: data.coverage || {},
          language, pages: (analysis.pages || []).map(p => p.name),
          savedToRepo: !!repoHandle, repoName,
        }]);
        addLog('ok', 'Snapshot saved');
      } else {
        addLog('warn', 'Generator returned no files — check analysis data');
      }
      setProgress(100);
    } catch (err) {
      addLog('err', `Generation failed: ${err.message}`);
    } finally {
      setGenning(false);
    }
  };

  const saveToRepo = async () => {
    if (!repoHandle || !files.length) return;
    setSaving(true); setSaveResult(null);
    try {
      const all    = [...files, ...pageObjs];
      const result = await writeFilesToRepo(repoHandle, all);
      setSaveResult(result);
      result.written.forEach(p => addLog('ok', `  └─ ${p}`));
      result.failed.forEach(f  => addLog('err', `  ✗ ${f.path}: ${f.error}`));
    } catch (err) { addLog('err', `Save failed: ${err.message}`); }
    finally { setSaving(false); }
  };

  const downloadFile = f => {
    const blob = new Blob([f.content], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = f.filename; a.click();
    URL.revokeObjectURL(url);
  };
  const downloadAll = () => [...files, ...pageObjs].forEach(downloadFile);

  const allFiles = activeTab === 'tests' ? files : pageObjs;
  const current  = allFiles[activeFile] || null;

  return (
    <div className="layout-main" style={{ gap: 0 }}>

      {/* ── Left Config Panel ─────────────────────────── */}
      <div className="split-left" style={{ padding: 14, width: 280, minWidth: 280 }}>

        {/* Language display */}
        <div style={{ padding: '8px 10px', border: `1px solid rgba(139,92,246,.3)`, borderRadius: 4, background: 'rgba(139,92,246,.08)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{langOpt.icon}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#c4b5fd' }}>{langOpt.label}</div>
            <div style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'JetBrains Mono' }}>{langOpt.hint}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--muted2)' }}>← change in Config</div>
        </div>

        {/* Framework patterns badge */}
        {analysis.framework && (
          <div style={{ padding: '6px 10px', border: '1px solid rgba(6,182,212,.25)', borderRadius: 4, background: 'rgba(6,182,212,.06)', marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>🏗 Framework Patterns Active</div>
            <div style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'JetBrains Mono', lineHeight: 1.6 }}>
              {analysis.framework.pomStyle} · {analysis.framework.importStyle}<br/>
              Pages: {analysis.framework.structure?.pages || 'pages/'}<br/>
              Tests: {analysis.framework.structure?.tests || 'tests/e2e/'}
            </div>
          </div>
        )}

        <div className="card-title" style={{ marginBottom: 8 }}>Generation Mode</div>
        <div className="mode-toggle">
          <button className={`mode-btn${mode === 'first' ? ' active' : ''}`} onClick={() => setMode('first')}>⚡ First Run</button>
          <button className={`mode-btn${mode === 'incremental' ? ' active' : ''}`} onClick={() => setMode('incremental')}>↻ Incremental</button>
        </div>

        {mode === 'incremental' && (
          <div className="field">
            <label>PRS / Feature Description</label>
            <textarea className="textarea" placeholder="Paste PRS, Jira ticket or change description…"
              value={prs} onChange={e => setPrs(e.target.value)} style={{ minHeight: 100 }} />
            {lastSnap
              ? <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>✓ Snapshot from {lastSnap.createdAt}</div>
              : <Alert type="warn">No snapshot — full generation will run.</Alert>}
          </div>
        )}

        <div className="card-title" style={{ marginBottom: 8 }}>Test Coverage</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {TEST_TYPE_OPTIONS.map(({ value, label }) => (
            <label key={value} className="check-item">
              <input type="checkbox" checked={testTypes.includes(value)} onChange={() => toggleType(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {workflows.length > 0 && (
          <div className="field">
            <label>Target Workflow</label>
            <select className="select" value={selWf} onChange={e => setSelWf(e.target.value)}>
              <option value="all">All Workflows</option>
              {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
        )}

        {/* Engine toggle */}
        <div style={{ marginBottom: 12, padding: '8px 10px', border: `1px solid ${useAI ? 'rgba(139,92,246,.3)' : 'var(--border)'}`, borderRadius: 4, background: useAI ? 'rgba(139,92,246,.06)' : 'transparent' }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700, color: useAI ? 'var(--purple)' : 'var(--muted2)', marginBottom: 3 }}>
            Engine: {useAI ? 'AI (Claude)' : 'Template (fast)'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.5 }}>
            {useAI ? 'Context-aware AI generation via Claude.' : 'Deterministic template — no API key needed.'}
            <span style={{ marginLeft: 4, color: 'var(--amber)' }}>Change in Config</span>
          </div>
        </div>

        {/* Repo write-back status */}
        <div style={{ marginBottom: 12, padding: '8px 10px', border: `1px solid ${repoHandle ? 'var(--green)' : 'var(--border)'}`, borderRadius: 4, background: repoHandle ? 'rgba(16,185,129,.06)' : 'transparent' }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono', fontWeight: 700, color: repoHandle ? 'var(--green)' : 'var(--muted2)', marginBottom: 3 }}>
            {repoHandle ? '✓ Write-back enabled' : '○ Write-back unavailable'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted2)', lineHeight: 1.5 }}>
            {repoHandle ? <>Files → <span style={{ color: 'var(--amber)' }}>📂 {repoName}</span></> : <>Select Local Folder in Config → Automation Repo</>}
          </div>
        </div>

        {!analysis.done && <Alert type="warn">Run Analysis before generating tests.</Alert>}

        <button className="btn btn-primary btn-full" onClick={generate}
          disabled={genning || !analysis.done} style={{ marginBottom: 8 }}>
          {genning ? <><Spinner /> GENERATING…</> : `▶ GENERATE ${langOpt.icon} TESTS`}
        </button>

        {files.length > 0 && repoHandle && (
          <button className="btn btn-secondary btn-full" onClick={saveToRepo} disabled={saving} style={{ marginBottom: 8 }}>
            {saving ? <><Spinner /> SAVING…</> : `💾 SAVE TO REPO (${files.length + pageObjs.length} files)`}
          </button>
        )}
        {files.length > 0 && (
          <button className="btn btn-ghost btn-full" onClick={downloadAll}>
            ↓ DOWNLOAD ALL ({files.length + pageObjs.length} files)
          </button>
        )}
        {genning && <div style={{ marginTop: 10 }}><ProgressBar value={progress} running label="Generating…" /></div>}

        {saveResult && (
          <div style={{ marginTop: 10 }}>
            {saveResult.written.length > 0 && (
              <div style={{ padding: '7px 10px', border: '1px solid var(--green)', background: 'rgba(16,185,129,.06)', marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>✓ {saveResult.written.length} FILES SAVED</div>
                <div style={{ maxHeight: 100, overflowY: 'auto' }}>
                  {saveResult.written.map((p, i) => <div key={i} style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: 'JetBrains Mono' }}>└─ {p}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right Output Panel ────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {files.length > 0 ? (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--panel)', flexShrink: 0 }}>
              <button className={`file-tab${activeTab === 'tests' ? ' active' : ''}`}
                onClick={() => { setActiveTab('tests'); setActiveFile(0); }}>Tests ({files.length})</button>
              {pageObjs.length > 0 && (
                <button className={`file-tab${activeTab === 'pages' ? ' active' : ''}`}
                  onClick={() => { setActiveTab('pages'); setActiveFile(0); }}>Page Objects ({pageObjs.length})</button>
              )}
            </div>
            <div className="file-tabs" style={{ flexShrink: 0 }}>
              {allFiles.map((f, i) => (
                <button key={i} className={`file-tab${activeFile === i ? ' active' : ''}`} onClick={() => setActiveFile(i)}>
                  {f.type && <span className={`badge badge-${f.type === 'e2e' ? 'cyan' : f.type === 'smoke' ? 'green' : 'purple'}`} style={{ padding: '1px 4px', fontSize: 9 }}>{f.type}</span>}
                  {f.filename}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, right: 12, zIndex: 10, display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(current?.content || '')}>⎘ COPY</button>
                <button className="btn btn-ghost btn-sm" onClick={() => downloadFile(current)}>↓ DOWNLOAD</button>
              </div>
              <div style={{ height: '100%', overflow: 'auto' }}>
                <div style={{ padding: '8px 12px', fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--muted2)', borderBottom: '1px solid var(--border)', background: 'var(--code-bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--purple)' }}>{langOpt.icon}</span>
                  <span>{current?.path}</span>
                  {current?.description && <span style={{ color: 'var(--muted)' }}>· {current.description}</span>}
                  {saveResult?.written?.includes(current?.path) && <span style={{ color: 'var(--green)', marginLeft: 'auto' }}>✓ saved</span>}
                </div>
                <pre className="code-viewer" style={{ margin: 0, border: 'none', height: 'calc(100% - 34px)', borderRadius: 0 }}>
                  {current?.content || ''}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 12, textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 44, opacity: .15 }}>{langOpt.icon}</div>
            <div>Configure and click GENERATE TESTS</div>
            <div style={{ fontSize: 11, color: 'var(--border2)' }}>Analysis must be run first · language: {langOpt.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}
