import { SourceForm } from '../shared/SourceForm.jsx';
import { Alert, Spinner } from '../shared/index.jsx';
import { DEFAULT_PATTERN } from '../../constants.js';

const config = require("../client/env.js");
export default function ConfigTab({ config, setConfig, onInit, initDone, serverOk, checking }) {
  const update = (k, v) => setConfig(c => ({ ...c, [k]: v }));
  console.log(config);
  return (
    <div className="panel-scroll">
      {serverOk === false && (
        <Alert type="error">
          ⚠ Cannot reach the backend at http://localhost:3001. Make sure the server is running
          (<code>npm run server</code>) and ANTHROPIC_API_KEY is set in <code>.env</code>.
        </Alert>
      )}
      {serverOk && !config.ANTHROPIC_API_KEY_CONFIGURED && (
        <Alert type="warn">API key detected on server — ready to use.</Alert>
      )}

      <div className="grid-2">
        {/* Automation Framework */}
        <div className="card">
          <div className="card-title">Automation Framework Repo</div>
          <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
            Existing Playwright repo — agent reads patterns, conventions and config from here.
          </p>
          <SourceForm value={config.autRepo || {}} onChange={v => update('autRepo', v)} />
        </div>

        {/* UI Source */}
        <div className="card">
          <div className="card-title">UI / Frontend Repository</div>
          <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
            {/* Frontend application source — agent extracts pages, components and locator strategies. */}
          </p>
          <SourceForm value={config.uiRepo || {}} onChange={v => update('uiRepo', v)} />
        </div>

        {/* Backend / DB */}
        <div className="card">
          <div className="card-title">Backend / DB Repository</div>
          <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 12, lineHeight: 1.6 }}>
            Backend source — agent extracts DB queries to build end-to-end validation assertions.
          </p>
          <SourceForm value={config.dbRepo || {}} onChange={v => update('dbRepo', v)} />
        </div>

        {/* Pattern + App Settings */}
        <div className="card">
          <div className="card-title">Framework Pattern &amp; App Settings</div>

          <div className="field">
            <label>Pattern Definition (editable)</label>
            <textarea className="textarea mono"
              style={{ minHeight: 180, fontSize: 11 }}
              value={config.pattern || DEFAULT_PATTERN}
              onChange={e => update('pattern', e.target.value)} />
          </div>

          <div className="grid-2" style={{ gap: 10 }}>
            <div className="field">
              <label>Application Type</label>
              <select className="select" value={config.appType || 'web'} onChange={e => update('appType', e.target.value)}>
                <option value="web">Web Application</option>
                <option value="spa">SPA (React / Vue / Angular)</option>
                <option value="hybrid">Hybrid (Web + API)</option>
                <option value="electron">Electron App</option>
              </select>
            </div>
            <div className="field">
              <label>DB Platform</label>
              <select className="select" value={config.dbPlatform || 'mssql'} onChange={e => update('dbPlatform', e.target.value)}>
                <option value="mssql">MS SQL Server</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="oracle">Oracle</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Test Base URL</label>
            <input className="input" placeholder="http://localhost:4200" value={config.baseURL || ''}
              onChange={e => update('baseURL', e.target.value)} />
          </div>

          <button className="btn btn-primary btn-full" onClick={onInit} disabled={checking}>
            {checking ? <><Spinner /> Checking server...</> : initDone ? '↻ RE-INITIALIZE AGENT' : '⚡ INITIALIZE AGENT'}
          </button>
        </div>
      </div>
    </div>
  );
}
