import { useState } from 'react';
import { StatGrid, Alert } from '../shared/index.jsx';

export default function HistoryTab({ snapshots, setSnapshots, onLoadSnapshot }) {
  const [active, setActive] = useState(null);
  const snap = snapshots.find(s => s.id === active);

  return (
    <div className="layout-main" style={{ gap: 0 }}>
      {/* Snapshot list */}
      <div className="split-left" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>Run Snapshots</div>
          {snapshots.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => { setSnapshots([]); setActive(null); }}>
              CLEAR
            </button>
          )}
        </div>

        {!snapshots.length && (
          <Alert type="info">No snapshots yet. Snapshots are saved automatically after each generation run.</Alert>
        )}

        {[...snapshots].reverse().map(s => (
          <div key={s.id} className={`snapshot-card${active === s.id ? ' active' : ''}`} onClick={() => setActive(s.id)}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                <span className={`badge ${s.mode === 'first' ? 'badge-amber' : 'badge-cyan'}`}>
                  {s.mode === 'first' ? 'FIRST RUN' : 'INCREMENTAL'}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--muted2)' }}>
                  {s.fileCount} files
                </span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted2)' }}>{s.createdAt}</div>
              {s.prsRef && (
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'var(--purple)', marginTop: 3 }}>
                  PRS: {s.prsRef}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail pane */}
      <div className="split-right">
        {snap ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div className="card-title" style={{ margin: 0 }}>Snapshot Detail</div>
              <button className="btn btn-primary btn-sm" onClick={() => onLoadSnapshot(snap)}>
                ↩ LOAD SNAPSHOT
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => { setSnapshots(ss => ss.filter(s => s.id !== snap.id)); setActive(null); }}>
                🗑 DELETE
              </button>
            </div>

            <StatGrid stats={[
              { value: snap.coverage?.totalTests || 0,    label: 'Tests'     },
              { value: snap.fileCount || 0,               label: 'Files'     },
              { value: snap.pages?.length || 0,           label: 'Pages'     },
              { value: snap.dbTables?.length || 0,        label: 'DB Tables' },
            ]} />

            {snap.coverage?.scenarios && (
              <div className="card">
                <div className="card-title">Coverage Breakdown</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {Object.entries(snap.coverage.scenarios).map(([k, v]) => (
                    <div key={k} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 700, color: 'var(--cyan)' }}>{v}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: 1 }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snap.pages?.length > 0 && (
              <div className="card">
                <div className="card-title">Pages Covered</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {snap.pages.map((p, i) => <span key={i} className="badge badge-cyan">{p}</span>)}
                </div>
              </div>
            )}

            {snap.dbTables?.length > 0 && (
              <div className="card">
                <div className="card-title">DB Tables Validated</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {snap.dbTables.map((t, i) => <span key={i} className="badge badge-purple">{t}</span>)}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">Snapshot ID</div>
              <code style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted2)' }}>{snap.id}</code>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted2)', fontFamily: 'JetBrains Mono' }}>
                Created: {snap.createdAt}
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontFamily: 'JetBrains Mono', fontSize: 12, textAlign: 'center', gap: 10 }}>
            <div style={{ fontSize: 44, opacity: .2 }}>📋</div>
            <div>Select a snapshot to view details</div>
          </div>
        )}
      </div>
    </div>
  );
}
