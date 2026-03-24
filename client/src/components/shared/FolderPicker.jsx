import { useState, useRef } from 'react';
import { isFSASupported, pickFolder, buildFileTree } from '../../utils/folderAccess.js';

const EXT_COLOR = {
  '.ts':   'var(--blue)',
  '.tsx':  'var(--blue)',
  '.js':   'var(--amber)',
  '.jsx':  'var(--amber)',
  '.json': 'var(--green)',
  '.sql':  'var(--purple)',
  '.yaml': 'var(--cyan)',
  '.yml':  'var(--cyan)',
  '.md':   'var(--muted2)',
};

function fileExt(name) { return name.slice(name.lastIndexOf('.')); }
function fileIcon(name) {
  const ext = fileExt(name);
  if (['.ts','.tsx','.js','.jsx'].includes(ext)) return '⟨/⟩';
  if (ext === '.json')  return '{ }';
  if (ext === '.sql')   return '🗄';
  if (['.yaml','.yml'].includes(ext)) return '≡';
  return '·';
}

/* ── FileTree component ─────────────────────────────── */
function TreeNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const indent = depth * 14;

  if (node.type === 'file') {
    const ext = fileExt(node.name);
    return (
      <div style={{ paddingLeft: 10 + indent, padding: `3px 8px 3px ${10 + indent}px`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--muted2)' }}>
        <span style={{ color: EXT_COLOR[ext] || 'var(--muted2)', fontSize: 10, width: 20, textAlign: 'center' }}>{fileIcon(node.name)}</span>
        <span style={{ color: 'var(--text)' }}>{node.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ paddingLeft: 10 + indent, padding: `4px 8px 4px ${10 + indent}px`, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono', color: 'var(--amber)', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 9 }}>{open ? '▾' : '▸'}</span>
        <span>📁</span>
        <span style={{ fontWeight: 600 }}>{node.name}</span>
        {node.children && <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 4 }}>{countFiles(node)} files</span>}
      </div>
      {open && node.children?.map((child, i) => <TreeNode key={i} node={child} depth={depth + 1} />)}
    </div>
  );
}

function countFiles(node) {
  if (node.type === 'file') return 1;
  return (node.children || []).reduce((s, c) => s + countFiles(c), 0);
}

/* ── FolderPicker main component ────────────────────── */
export function FolderPicker({ value = {}, onChange }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [tree,     setTree]     = useState(null);
  const [showTree, setShowTree] = useState(false);
  // Fallback: webkitdirectory input for browsers without FSA API
  const inputRef = useRef();

  const hasFSA       = isFSASupported();
  const folderName   = value.folderName  || '';
  const fileCount    = value.files?.length || 0;

  /* ── FSA API path ─────────────────────────────────── */
  const handlePickFSA = async () => {
    setLoading(true); setError('');
    try {
      const result = await pickFolder();
      if (!result) { setLoading(false); return; } // cancelled

      const fileTree = buildFileTree(result.files);
      setTree(fileTree);
      setShowTree(true);

      onChange({
        source:     'local',
        folderName: result.name,
        folderHandle: result.handle,        // kept for writing back
        files:      result.files,            // { path, content, size }[]
        paste:      result.files.map(f => `// === ${f.path} ===\n${f.content}`).join('\n\n'),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Fallback: webkitdirectory ────────────────────── */
  const handleFallbackChange = async (e) => {
    setLoading(true); setError('');
    const fileList = Array.from(e.target.files);
    const READABLE = /\.(ts|tsx|js|jsx|json|yaml|yml|sql|md)$/i;
    const readable = fileList.filter(f => READABLE.test(f.name) && !f.webkitRelativePath.includes('node_modules'));

    const parsed = await Promise.all(
      readable.map(f => new Promise(resolve => {
        const r = new FileReader();
        r.onload = ev => resolve({ path: f.webkitRelativePath, name: f.name, content: ev.target.result, size: f.size });
        r.readAsText(f);
      }))
    );

    const folderName = fileList[0]?.webkitRelativePath?.split('/')[0] || 'local';
    const fileTree   = buildFileTree(parsed);
    setTree(fileTree);
    setShowTree(true);

    onChange({
      source:     'local',
      folderName,
      folderHandle: null,   // not available via fallback
      files:      parsed,
      paste:      parsed.map(f => `// === ${f.path} ===\n${f.content}`).join('\n\n'),
    });
    setLoading(false);
  };

  return (
    <div>
      {/* Pick button */}
      {!folderName ? (
        <div
          style={{
            border: '2px dashed var(--border2)', padding: 20, textAlign: 'center',
            cursor: 'pointer', transition: 'all .2s', color: 'var(--muted2)',
          }}
          onClick={hasFSA ? handlePickFSA : () => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, marginBottom: 4 }}>
            {loading ? 'Reading folder...' : 'Click to select repo folder'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {hasFSA
              ? 'Full read/write access — generated tests saved directly into repo'
              : 'Reads all .ts .js .json .sql files recursively (Chrome/Edge recommended for write-back)'}
          </div>
          {loading && <div className="spinner" style={{ margin: '10px auto 0' }} />}
        </div>
      ) : (
        /* Loaded state */
        <div style={{ border: '1px solid var(--green)', background: 'rgba(16,185,129,.05)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📂</span>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{folderName}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted2)' }}>
                  {fileCount} files loaded
                  {!value.folderHandle && <span style={{ color: 'var(--amber)', marginLeft: 8 }}>⚠ read-only (use Chrome for write-back)</span>}
                  {value.folderHandle  && <span style={{ color: 'var(--green)',  marginLeft: 8 }}>✓ write-back enabled</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTree(t => !t)}>
                {showTree ? '▴ hide' : '▾ tree'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                onChange({ source: 'local' });
                setTree(null); setShowTree(false);
              }}>✕ clear</button>
            </div>
          </div>

          {/* File tree */}
          {showTree && tree && (
            <div style={{ border: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto', background: 'var(--code-bg)', marginTop: 8 }}>
              {tree.map((node, i) => <TreeNode key={i} node={node} depth={0} />)}
            </div>
          )}
        </div>
      )}

      {error && <div style={{ color: 'var(--red)', fontSize: 11, fontFamily: 'JetBrains Mono', marginTop: 6 }}>⚠ {error}</div>}

      {/* Hidden fallback input */}
      <input
        ref={inputRef} type="file" multiple
        /* @ts-ignore */
        webkitdirectory="true" directory="true"
        style={{ display: 'none' }}
        onChange={handleFallbackChange}
      />
    </div>
  );
}
