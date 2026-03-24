import { useEffect, useRef, useState } from 'react';

/* ── LogStream ──────────────────────────────────────────── */
export function LogStream({ logs }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);
  return (
    <div className="log-stream" ref={ref}>
      {!logs.length && <span className="log-time">// Agent ready — configure and run.</span>}
      {logs.map((l, i) => (
        <div key={i} className="log-line">
          <span className="log-time">{l.time}</span>
          <span className={`log-${l.type}`}>{l.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Notification toast ─────────────────────────────────── */
export function Notification({ notif, onClose }) {
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [notif, onClose]);

  if (!notif) return null;
  return (
    <div className={`notif ${notif.type}`} onClick={onClose} style={{ cursor: 'pointer' }}>
      {notif.msg}
    </div>
  );
}

/* ── ProgressBar ────────────────────────────────────────── */
export function ProgressBar({ value, running, label }) {
  return (
    <div style={{ marginBottom: 8 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted2)', marginBottom: 4, fontFamily: 'JetBrains Mono' }}>
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="progress-bar">
        <div className={`progress-fill${running ? ' running' : ''}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* ── FileDropZone ───────────────────────────────────────── */
export function FileDropZone({ onFiles, accept = '.ts,.js,.tsx,.jsx,.json,.yaml,.yml,.sql,.env,.txt,.md' }) {
  const [dragging, setDragging] = useState(false);
  const [count, setCount]       = useState(0);
  const inputRef = useRef();

  const process = (fileList) => {
    const files = Array.from(fileList);
    setCount(files.length);
    onFiles(files);
  };

  return (
    <div
      className={`drop-zone${dragging ? ' drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files); }}
    >
      <div className="drop-zone-icon">📁</div>
      {count > 0
        ? <span style={{ color: 'var(--green)' }}>{count} file(s) ready</span>
        : <>
            <div>Drop files or click to upload</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {accept.split(',').join(' ')}
            </div>
          </>
      }
      <input ref={inputRef} type="file" multiple accept={accept} style={{ display: 'none' }}
        onChange={e => process(e.target.files)} />
    </div>
  );
}

/* ── StatGrid ───────────────────────────────────────────── */
export function StatGrid({ stats }) {
  return (
    <div className="stat-grid">
      {stats.map((s, i) => (
        <div key={i} className="stat-box">
          <div className="stat-val">{s.value}</div>
          <div className="stat-lbl">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────── */
export function Spinner() {
  return <span className="spinner" />;
}

/* ── Alert ──────────────────────────────────────────────── */
export function Alert({ type = 'info', children }) {
  return <div className={`alert ${type}`}>{children}</div>;
}

/* ── SectionTitle ───────────────────────────────────────── */
export function SectionTitle({ children }) {
  return <div className="card-title">{children}</div>;
}
