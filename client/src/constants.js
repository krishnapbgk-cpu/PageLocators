// ─────────────────────────────────────────────────────────────────────────────
// ESF Automation Agent — Constants
// ─────────────────────────────────────────────────────────────────────────────

export const TABS = [
  { id: 'config',   label: 'Config',   icon: '⚙'  },
  { id: 'analyze',  label: 'Analyze',  icon: '🔍' },
  { id: 'canvas',   label: 'Canvas',   icon: '⬡'  },
  { id: 'generate', label: 'Generate', icon: '⚡' },
  { id: 'history',  label: 'History',  icon: '📋' },
];

export const STEPS = ['CONFIG', 'ANALYZE', 'CANVAS', 'GENERATE', 'EXPORT'];

export const NODE_TYPES = {
  PAGE:       { color: '#06b6d4', label: 'PAGE'     },
  ACTION:     { color: '#f59e0b', label: 'ACTION'   },
  ASSERTION:  { color: '#10b981', label: 'ASSERT'   },
  DB_CHECK:   { color: '#8b5cf6', label: 'DB CHECK' },
  NAVIGATION: { color: '#3b82f6', label: 'NAVIGATE' },
};

// ── Language Options ──────────────────────────────────────────────────────────
export const LANGUAGE_OPTIONS = [
  { value: 'typescript', label: 'TypeScript', ext: '.ts',   icon: '🔷', hint: '@playwright/test (TS)' },
  { value: 'javascript', label: 'JavaScript', ext: '.js',   icon: '🟨', hint: '@playwright/test (JS)' },
  { value: 'python',     label: 'Python',     ext: '.py',   icon: '🐍', hint: 'playwright-python + pytest' },
  { value: 'java',       label: 'Java',       ext: '.java', icon: '☕', hint: 'playwright-java + JUnit5' },
];

// ── Panel enable / disable defaults ──────────────────────────────────────────
export const DEFAULT_PANELS = {
  autRepo:         true,
  uiRepo:          true,
  dbRepo:          false,
  locatorPatterns: true,
};

// ── Locator Patterns — element-type → XPath/CSS template ─────────────────────
// Placeholders: {text} {id} {name} {placeholder} {aria-label} {value} {class}
export const DEFAULT_LOCATOR_PATTERNS = [
  { id: 'btn-text',   elementType: 'Button (text)',          pattern: "//button[normalize-space()='{text}']",                              strategy: 'xpath', enabled: true  },
  { id: 'btn-aria',   elementType: 'Button (aria-label)',    pattern: "//button[@aria-label='{aria-label}']",                             strategy: 'xpath', enabled: true  },
  { id: 'btn-span',   elementType: 'Button (span child)',    pattern: "//button[.//span[normalize-space()='{text}']]",                    strategy: 'xpath', enabled: true  },
  { id: 'input-id',   elementType: 'Input (by ID)',          pattern: "//input[@id='{id}']",                                             strategy: 'xpath', enabled: true  },
  { id: 'input-ph',   elementType: 'Input (placeholder)',    pattern: "//input[@placeholder='{placeholder}']",                           strategy: 'xpath', enabled: true  },
  { id: 'input-name', elementType: 'Input (by name)',        pattern: "//input[@name='{name}']",                                         strategy: 'xpath', enabled: true  },
  { id: 'select',     elementType: 'Dropdown (select)',      pattern: "//select[@name='{name}']",                                        strategy: 'xpath', enabled: true  },
  { id: 'link',       elementType: 'Link (by text)',         pattern: "//a[normalize-space()='{text}']",                                 strategy: 'xpath', enabled: true  },
  { id: 'checkbox',   elementType: 'Checkbox',               pattern: "//input[@type='checkbox' and @name='{name}']",                    strategy: 'xpath', enabled: true  },
  { id: 'radio',      elementType: 'Radio Button',           pattern: "//input[@type='radio' and @value='{value}']",                     strategy: 'xpath', enabled: true  },
  { id: 'label',      elementType: 'Label',                  pattern: "//label[normalize-space()='{text}']",                             strategy: 'xpath', enabled: true  },
  { id: 'heading',    elementType: 'Heading (h1–h3)',        pattern: "//*[self::h1 or self::h2 or self::h3][normalize-space()='{text}']", strategy: 'xpath', enabled: true  },
  { id: 'testid',     elementType: 'data-testid',            pattern: "[data-testid='{value}']",                                         strategy: 'css',   enabled: true  },
  { id: 'table-cell', elementType: 'Table Cell',             pattern: "//td[normalize-space()='{text}']",                                strategy: 'xpath', enabled: false },
];

// ── Playwright locator priority (agent discovery order) ───────────────────────
export const DEFAULT_LOCATOR_PRIORITY = [
  { id: 'data-testid',  label: 'data-testid',    kind: 'attribute',   attr: 'data-testid',  enabled: true  },
  { id: 'data-cy',      label: 'data-cy',         kind: 'attribute',   attr: 'data-cy',      enabled: true  },
  { id: 'data-qa',      label: 'data-qa',         kind: 'attribute',   attr: 'data-qa',      enabled: false },
  { id: 'aria-label',   label: 'aria-label',      kind: 'aria',        attr: 'aria-label',   enabled: true  },
  { id: 'id',           label: 'ID (#id)',         kind: 'id',          attr: 'id',           enabled: true  },
  { id: 'role',         label: 'Role + Name',      kind: 'role',        attr: null,           enabled: true  },
  { id: 'placeholder',  label: 'Placeholder',      kind: 'placeholder', attr: 'placeholder',  enabled: true  },
  { id: 'text',         label: 'Text Content',     kind: 'text',        attr: null,           enabled: true  },
  { id: 'name',         label: 'name attr',        kind: 'attribute',   attr: 'name',         enabled: true  },
  { id: 'class',        label: 'CSS Class',        kind: 'class',       attr: 'class',        enabled: false },
  { id: 'xpath',        label: 'XPath (fallback)', kind: 'xpath',       attr: null,           enabled: true  },
];

export const LOCATOR_STRATEGY_COLORS = {
  testid:      '#06b6d4',
  css:         '#f59e0b',
  aria:        '#10b981',
  role:        '#8b5cf6',
  placeholder: '#3b82f6',
  text:        '#ec4899',
  xpath:       '#ef4444',
  attribute:   '#f59e0b',
  id:          '#10b981',
  class:       '#6b7280',
};

export const TEST_TYPE_OPTIONS = [
  { value: 'e2e',        label: 'End-to-End'  },
  { value: 'positive',   label: 'Positive'    },
  { value: 'negative',   label: 'Negative'    },
  { value: 'bva',        label: 'BVA'         },
  { value: 'smoke',      label: 'Smoke'       },
  { value: 'regression', label: 'Regression'  },
];
