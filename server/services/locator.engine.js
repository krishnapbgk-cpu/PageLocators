/**
 * Locator Engine — Configurable locator strategy resolver
 * Works in Node.js context using Playwright element handles
 */

// ── Default priority configuration ───────────────────────────────────────────
const DEFAULT_LOCATOR_PRIORITY = [
  { id: 'data-testid',  label: 'data-testid',    attr: 'data-testid',         kind: 'attribute', enabled: true  },
  { id: 'data-cy',      label: 'data-cy',         attr: 'data-cy',             kind: 'attribute', enabled: true  },
  { id: 'data-qa',      label: 'data-qa',         attr: 'data-qa',             kind: 'attribute', enabled: false },
  { id: 'aria-label',   label: 'aria-label',      attr: 'aria-label',          kind: 'aria',      enabled: true  },
  { id: 'id',           label: 'ID (#)',           attr: 'id',                  kind: 'id',        enabled: true  },
  { id: 'role',         label: 'Role + Name',      attr: null,                  kind: 'role',      enabled: true  },
  { id: 'placeholder',  label: 'Placeholder',      attr: 'placeholder',         kind: 'placeholder', enabled: true },
  { id: 'text',         label: 'Text Content',     attr: null,                  kind: 'text',      enabled: true  },
  { id: 'name',         label: 'name attr',        attr: 'name',                kind: 'attribute', enabled: true  },
  { id: 'class',        label: 'CSS Class',        attr: 'class',               kind: 'class',     enabled: false },
  { id: 'xpath',        label: 'XPath (fallback)', attr: null,                  kind: 'xpath',     enabled: true  },
];

/**
 * Returns the default locator priority list (for seeding config)
 */
function getDefaultPriority() {
  return JSON.parse(JSON.stringify(DEFAULT_LOCATOR_PRIORITY));
}

/**
 * Resolve the best locator for an element given its attributes and priority config
 * @param {object} attrs - flat attribute map + _tagName, _text, _innerText, _type
 * @param {array}  priority - ordered list of locator rules from config
 * @returns {{ display: string, strategy: string, playwrightExpr: string }}
 */
function generateBestLocator(attrs, priority = DEFAULT_LOCATOR_PRIORITY) {
  const enabled = priority.filter(r => r.enabled !== false);
  const tag     = attrs._tagName || 'div';
  const text    = (attrs._innerText || attrs._text || '').trim().slice(0, 50);

  for (const rule of enabled) {
    const result = tryRule(rule, attrs, tag, text);
    if (result) return result;
  }

  // Hard fallback — bare xpath
  return xpathFallback(tag, attrs, text);
}

function tryRule(rule, attrs, tag, text) {
  switch (rule.kind) {
    case 'attribute': {
      const attr = rule.attr || rule.id;
      const val  = attrs[attr];
      if (!val) return null;
      if (attr === 'data-testid') {
        return { display: `getByTestId('${esc(val)}')`, strategy: 'testid', playwrightExpr: `page.getByTestId('${esc(val)}')` };
      }
      return {
        display: `[${attr}="${esc(val)}"]`,
        strategy: 'css',
        playwrightExpr: `page.locator('[${attr}="${esc(val)}"]')`,
      };
    }

    case 'aria': {
      const val = attrs['aria-label'];
      if (!val) return null;
      return {
        display: `getByLabel('${esc(val)}')`,
        strategy: 'aria',
        playwrightExpr: `page.getByLabel('${esc(val)}')`,
      };
    }

    case 'id': {
      const val = attrs['id'];
      if (!val || val.includes(' ') || /^\d/.test(val)) return null;
      return {
        display: `#${val}`,
        strategy: 'css',
        playwrightExpr: `page.locator('#${val}')`,
      };
    }

    case 'role': {
      const role = attrs['role'] || implicitRole(tag, attrs);
      if (!role || !text) return null;
      return {
        display: `getByRole('${role}', { name: '${esc(text)}' })`,
        strategy: 'role',
        playwrightExpr: `page.getByRole('${role}', { name: '${esc(text)}' })`,
      };
    }

    case 'placeholder': {
      const val = attrs['placeholder'];
      if (!val) return null;
      return {
        display: `getByPlaceholder('${esc(val)}')`,
        strategy: 'placeholder',
        playwrightExpr: `page.getByPlaceholder('${esc(val)}')`,
      };
    }

    case 'text': {
      if (!text || text.length > 60 || !['button', 'a', 'label', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'li'].includes(tag)) return null;
      return {
        display: `getByText('${esc(text)}')`,
        strategy: 'text',
        playwrightExpr: `page.getByText('${esc(text)}', { exact: true })`,
      };
    }

    case 'class': {
      const cls = attrs['class'];
      if (!cls) return null;
      // Use first meaningful class (skip utility/layout classes)
      const meaningful = cls.split(' ').find(c =>
        c.length > 3 && !['flex','grid','block','hidden','w-','h-','p-','m-','text-','bg-','border'].some(p => c.startsWith(p))
      );
      if (!meaningful) return null;
      return {
        display: `.${meaningful}`,
        strategy: 'css',
        playwrightExpr: `page.locator('.${meaningful}')`,
      };
    }

    case 'xpath':
      return xpathFallback(tag, attrs, text);

    default:
      return null;
  }
}

function xpathFallback(tag, attrs, text) {
  const parts = [];
  if (attrs._type && tag === 'input') parts.push(`@type="${attrs._type}"`);
  if (attrs['name'])  parts.push(`@name="${attrs['name']}"`);

  if (text && text.length < 40) {
    const xpath = `//${tag}[normalize-space()='${esc(text)}']`;
    return { display: xpath, strategy: 'xpath', playwrightExpr: `page.locator('${xpath}')` };
  }
  if (parts.length) {
    const xpath = `//${tag}[${parts.join(' and ')}]`;
    return { display: xpath, strategy: 'xpath', playwrightExpr: `page.locator('${xpath}')` };
  }

  return { display: `//${tag}`, strategy: 'xpath', playwrightExpr: `page.locator('//${tag}')` };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) { return String(s).replace(/'/g, "\\'"); }

function implicitRole(tag, attrs) {
  const type = attrs._type || attrs.type;
  const map  = {
    button:   'button',
    a:        'link',
    input:    type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : type === 'submit' ? 'button' : 'textbox',
    select:   'combobox',
    textarea: 'textbox',
    nav:      'navigation',
    main:     'main',
    header:   'banner',
    footer:   'contentinfo',
    table:    'table',
    th:       'columnheader',
    tr:       'row',
    td:       'cell',
  };
  return map[tag] || null;
}

/**
 * Classify an element into a semantic type
 */
function determineElementType(tag, type, role) {
  if (role === 'dialog' || tag === 'dialog') return 'modal';
  if (tag === 'nav' || role === 'navigation') return 'nav';
  if (tag === 'table' || role === 'table') return 'table';
  if (tag === 'form') return 'form';
  if (tag === 'select' || role === 'combobox' || role === 'listbox') return 'dropdown';
  if (tag === 'input' && type === 'checkbox') return 'checkbox';
  if (tag === 'input' && type === 'radio') return 'radio';
  if (tag === 'input' && type === 'file') return 'input';
  if (tag === 'button' || role === 'button' || (tag === 'input' && (type === 'submit' || type === 'button'))) return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'input' || tag === 'textarea') return 'input';
  if (tag === 'label') return 'label';
  return 'element';
}

/**
 * Map element type to meaningful Playwright actions
 */
function getElementActions(type) {
  const map = {
    button:   ['click', 'isVisible', 'isDisabled', 'isEnabled'],
    input:    ['fill', 'clear', 'type', 'isVisible', 'isEnabled', 'inputValue'],
    dropdown: ['selectOption', 'isVisible', 'isEnabled'],
    link:     ['click', 'isVisible', 'getAttribute'],
    checkbox: ['check', 'uncheck', 'isChecked', 'isVisible'],
    radio:    ['check', 'isChecked', 'isVisible'],
    table:    ['isVisible', 'locator'],
    form:     ['submit', 'locator'],
    modal:    ['isVisible', 'locator'],
    nav:      ['isVisible', 'locator'],
    label:    ['isVisible', 'textContent'],
    element:  ['isVisible', 'textContent'],
  };
  return map[type] || ['click', 'isVisible'];
}

/**
 * Generate a human-readable name for an element
 */
function generateElementName(attrs, type) {
  const text       = (attrs._innerText || attrs._text || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const ariaLabel  = attrs['aria-label'];
  const placeholder= attrs['placeholder'];
  const id         = attrs['id'];
  const name       = attrs['name'];
  const testId     = attrs['data-testid'] || attrs['data-cy'];

  const raw = testId || ariaLabel || placeholder || name || text || id || type;
  if (!raw) return `unnamed_${type}`;

  // PascalCase-ish: "submit-btn" → "SubmitBtn", "Search Users" → "SearchUsers"
  return raw
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

module.exports = {
  getDefaultPriority,
  generateBestLocator,
  determineElementType,
  getElementActions,
  generateElementName,
};
