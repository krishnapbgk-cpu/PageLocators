import { useEffect, useState } from 'react';
import { FolderPicker } from './FolderPicker.jsx';

export function SourceForm({ value = {}, onChange }) {
  const [src, setSrc] = useState(value.source || 'github');
  const azureDefaults = {
  org: 'RotaryClub',
  project: 'Medical Camp Management System',
  repo: 'MCMS.UI',
  pat: 'dsjfbhebvfhj'
};
useEffect(() => {
  if (src === 'azure') {
    onChange({ ...azureDefaults, ...value, source: 'azure' });
  }
}, [src]);

  const update    = (k, v) => onChange({ ...value, source: src, [k]: v });
  const switchSrc = (s)    => { setSrc(s); onChange({ source: s }); };

  return (
    <div>
      <div className="src-tabs">
        {[['github', 'GitHub'], ['azure', 'Azure DevOps'], ['local', 'Local Folder']].map(([id, lbl]) => (
          <button key={id} className={`src-tab${src === id ? ' active' : ''}`} onClick={() => switchSrc(id)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── GitHub ─────────────────────────────────────── */}
      {src === 'github' && (
        <>
          <div className="field">
            <label>Repository URL</label>
            <input className="input" placeholder="https://github.com/owner/repo"
              value={value.url || ''} onChange={e => update('url', e.target.value)} />
          </div>
          <div className="field">
            <label>Branch</label>
            <input className="input" placeholder="main" value={value.branch || ''}
              onChange={e => update('branch', e.target.value)} />
          </div>
          <div className="field">
            <label>Personal Access Token (optional for public repos)</label>
            <input className="input" type="password" placeholder="ghp_..."
              value={value.pat || ''} onChange={e => update('pat', e.target.value)} />
          </div>
        </>
      )}

      {/* ── Azure DevOps ───────────────────────────────── */}
      {src === 'azure' && (
        <>
          <div className="field">
            <label>Organization</label>
            <input className="input" placeholder="my-org" value={value.org || ''}
              onChange={e => update('org', e.target.value)} />
          </div>
          <div className="field">
            <label>Project</label>
            <input className="input" placeholder="my-project" value={value.project || ''}
              onChange={e => update('project', e.target.value)} />
          </div>
          <div className="field">
            <label>Repository</label>
            <input className="input" placeholder="my-repo" value={value.repo || ''}
              onChange={e => update('repo', e.target.value)} />
          </div>
          <div className="field">
            <label>PAT Token</label>
            <input className="input" type="password" placeholder="Personal Access Token"
              value={value.pat || ''} onChange={e => update('pat', e.target.value)} />
          </div>
        </>
      )}

      {/* ── Local Folder ───────────────────────────────── */}
      {src === 'local' && (
        <div className="field">
          <FolderPicker
            value={value}
            onChange={folderData => onChange({ ...folderData, source: 'local' })}
          />
        </div>
      )}
    </div>
  );
}
