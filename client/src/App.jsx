import { useState, useEffect } from 'react';
import { Header, StatusBar } from './components/shared/Layout.jsx';
import { Notification } from './components/shared/index.jsx';
import ConfigTab   from './components/ConfigTab/index.jsx';
import AnalyzeTab  from './components/AnalyzeTab/index.jsx';
import CanvasTab   from './components/CanvasTab/index.jsx';
import GenerateTab from './components/GenerateTab/index.jsx';
import HistoryTab  from './components/HistoryTab/index.jsx';
import { useAgent }        from './hooks/useAgent.js';
import { useNotification } from './hooks/useNotification.js';
import { DEFAULT_PANELS, DEFAULT_LOCATOR_PATTERNS, DEFAULT_LOCATOR_PRIORITY } from './constants.js';

export default function App() {
  const [tab,      setTab]     = useState('config');
  const [config,   setConfig]  = useState({
    appType:         'spa',
    dbPlatform:      'mssql',
    language:        'typescript',
    panels:          DEFAULT_PANELS,
    locatorPatterns: DEFAULT_LOCATOR_PATTERNS,
    locatorPriority: DEFAULT_LOCATOR_PRIORITY,
    crawlPaths:      ['/'],
    headless:        true,
  });
  const [checking, setChecking] = useState(false);

  const { notif, notify, dismiss } = useNotification();
  const {
    logs, addLog,
    analysis, setAnalysis,
    canvas,   setCanvas,
    snapshots, setSnapshots,
    initDone, initAgent,
    serverOk, checkServer,
    saveSnapshot,
  } = useAgent();

  useEffect(() => { checkServer(); }, []);

  const handleInit = async () => {
    setChecking(true);
    const health = await checkServer();
    setChecking(false);

    if (!health) {
      notify('Cannot reach the server. Is it running?', 'error');
      return;
    }

    // Claude AI features need API key; agent mode works without it
    if (!health.apiKeyConfigured) {
      notify('ANTHROPIC_API_KEY not set — Claude AI features disabled. Playwright agent mode works fine.', 'warn');
    }

    initAgent(config);
    setTab('analyze');
    notify('Agent initialized — proceed to Analyze', 'success');
  };

  return (
    <div className="layout-root">
      <Header activeTab={tab} onTabChange={setTab} initDone={initDone} serverOk={serverOk} />
      <StatusBar activeTab={tab} initDone={initDone} />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'config' && (
          <ConfigTab
            config={config} setConfig={setConfig}
            onInit={handleInit} initDone={initDone}
            serverOk={serverOk} checking={checking}
          />
        )}
        {tab === 'analyze' && (
          <AnalyzeTab
            config={config} analysis={analysis} setAnalysis={setAnalysis}
            initDone={initDone} addLog={addLog} logs={logs}
          />
        )}
        {tab === 'canvas' && (
          <CanvasTab analysis={analysis} canvas={canvas} setCanvas={setCanvas} />
        )}
        {tab === 'generate' && (
          <GenerateTab
            analysis={analysis} canvas={canvas} config={config}
            snapshots={snapshots} setSnapshots={setSnapshots} addLog={addLog}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            snapshots={snapshots} setSnapshots={setSnapshots}
            onLoadSnapshot={() => notify('Snapshot loaded', 'info')}
          />
        )}
      </div>

      <Notification notif={notif} onClose={dismiss} />
    </div>
  );
}
