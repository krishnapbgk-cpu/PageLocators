import { TABS, STEPS } from '../../constants';

/* ── Header ─────────────────────────────────────────────── */
export function Header({ activeTab, onTabChange, initDone, serverOk }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 20,
      padding: '0 20px', height: 52,
      background: 'var(--panel)', borderBottom: '1px solid var(--border)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Animated top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, var(--amber), var(--cyan), var(--amber))',
        backgroundSize: '200% 100%',
        animation: 'slide-gradient 3s linear infinite',
      }} />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, border: '2px solid var(--amber)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'var(--amber)', fontFamily: 'JetBrains Mono',
          fontWeight: 700,
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
        }}>PW</div>
        <span style={{ fontFamily: 'Rajdhani', fontSize: 17, fontWeight: 700, letterSpacing: 2, color: 'var(--amber)', textTransform: 'uppercase' }}>
          ESF AUTOMATION Agent
        </span>
      </div>

      <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap' }}>
        AI-Powered Playwright E2E Suite Generator
      </span>

      {/* Server status pill */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'JetBrains Mono', color: serverOk === false ? 'var(--red)' : serverOk ? 'var(--green)' : 'var(--muted2)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
        {serverOk === null ? 'checking...' : serverOk ? 'API OK' : 'API KEY MISSING'}
      </div>

      {/* Navigation tabs */}
      <nav style={{ display: 'flex', gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'Rajdhani', fontWeight: 600, fontSize: 12,
              letterSpacing: 1.5, textTransform: 'uppercase',
              color: activeTab === t.id ? 'var(--amber)' : 'var(--muted2)',
              border: `1px solid ${activeTab === t.id ? 'var(--amber)' : 'transparent'}`,
              background: activeTab === t.id ? 'rgba(245,158,11,0.08)' : 'transparent',
              borderBottom: activeTab === t.id ? '2px solid var(--amber)' : '2px solid transparent',
              transition: 'all 0.18s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

/* ── StatusBar ──────────────────────────────────────────── */
export function StatusBar({ activeTab, initDone }) {
  const stepIndex = ['config', 'analyze', 'canvas', 'generate', 'history'].indexOf(activeTab);

  return (
    <div style={{
      padding: '4px 20px', background: 'var(--code-bg)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--muted2)',
      flexShrink: 0,
    }}>
      {STEPS.map((s, i) => (
        <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span style={{ color: 'var(--border2)' }}>──</span>}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            color: i === stepIndex ? 'var(--amber)' : i < stepIndex ? 'var(--green)' : 'var(--muted2)',
          }}>
            <span style={{
              width: 17, height: 17, border: '1px solid currentColor',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9,
            }}>
              {i < stepIndex ? '✓' : i + 1}
            </span>
            {s}
          </span>
        </span>
      ))}

      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {initDone
          ? <><span className="pulse green" /><span style={{ color: 'var(--green)' }}>AGENT READY</span></>
          : <><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--muted)', display: 'inline-block' }} /><span>NOT INITIALIZED</span></>
        }
      </span>
    </div>
  );
}
