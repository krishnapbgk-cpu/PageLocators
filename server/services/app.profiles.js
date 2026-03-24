/**
 * Application Profiles
 *
 * Each profile defines:
 *   navSelectors     — elements clicked to trigger SPA routing
 *   expandSelectors  — collapsed panels to open before nav scan
 *   clickableSelectors — JS-navigated elements (no href/role) detected by class pattern
 *   domRouteAttrs    — HTML attributes that contain route paths
 *   waitStrategy     — 'networkidle' | 'domcontentloaded' | 'load'
 *   extraWaitMs      — additional ms after waitStrategy settles
 *   extraElementSelectors — framework-specific component elements to discover
 *
 * The "clickableSelectors" list handles custom components like:
 *   <div class="menu-item">Patient Visits</div>  ← no href, no role, just a JS click listener
 */

const PROFILES = {

  // ─── Angular SPA ──────────────────────────────────────────────────────────
  'spa-angular': {
    name: 'Angular SPA',
    waitStrategy: 'networkidle',
    extraWaitMs:  1500,

    navSelectors: [
      // PrimeNG
      '.p-menuitem-link', 'p-menuitem > a', '.p-panelmenu-header-link',
      '.p-tieredmenu .p-menuitem-link', '.p-submenu-list .p-menuitem-link',
      'p-tabmenu .p-tabmenuitem a', '.p-sidebar .p-menuitem-link',
      '.p-tree .p-treenode-content', '.p-panelmenu-content a',
      // Angular Material
      'mat-nav-list a', '[mat-list-item]', 'mat-list-item',
      'mat-tab-link', '.mat-tab-label', 'mat-toolbar a',
      // Angular Router attrs
      '[routerLink]:not([disabled])', '[ng-reflect-router-link]', '[routerlink]',
      // Bootstrap / generic anchor-based nav
      'nav a', '.nav-link', '[role="menuitem"]', '[role="tab"]',
      '[class*="sidebar"] a', '[class*="menu"] a', '[class*="nav"] a',
    ],

    // ── Custom JS-navigated elements (no href, no role) ───────────────────
    // These are divs/spans that navigate purely via click event listeners.
    // Matched by class name patterns — covers the widest range of custom
    // Angular component libraries and hand-rolled sidebars.
    clickableSelectors: [
      // Exact class patterns for common custom nav divs
      '[class*="menu-item"]',        // <div class="menu-item  ">
      '[class*="menu-link"]',
      '[class*="nav-item"]',
      '[class*="sidebar-item"]',
      '[class*="sidebar-link"]',
      '[class*="sidebar-menu"] > *',
      '[class*="side-menu"] > *',
      '[class*="navigation-item"]',
      '[class*="nav-link"]',
      '[class*="tree-item"]',
      '[class*="list-item"]',
      // Icon+label patterns (the specific structure in your app)
      '.menu-item', '.nav-item', '.sidebar-item',
      // Spans and divs with navigation text inside icon wrappers
      '[class*="menu-item"] > div',
      '[class*="menu-item"] > span',
    ],

    expandSelectors: [
      '.p-panelmenu-header:not(.p-highlight)',
      '.p-accordion-header:not(.p-highlight)',
      '[aria-expanded="false"]:not(input):not(select)',
      '.mat-expansion-panel-header:not(.mat-expanded)',
      '[class*="collapse-toggle"]',
      '[class*="expand"]',
      // Custom accordion/group toggles
      '[class*="menu-group"] > [class*="header"]',
      '[class*="nav-group"] > [class*="title"]',
    ],

    domRouteAttrs: ['routerLink', 'ng-reflect-router-link', 'routerlink', 'data-routerlink'],

    locatorPreference: ['data-testid', 'id', 'aria-label', 'ng-reflect-name', 'placeholder', 'text', 'xpath'],

    extraElementSelectors: [
      'mat-button', 'button[mat-button]', 'button[mat-raised-button]',
      'mat-select', 'mat-checkbox', 'mat-radio-button',
      'p-button', 'p-dropdown', 'p-inputtext', 'p-checkbox',
      'p-radiobutton', 'p-calendar', 'p-multiselect', 'p-autocomplete', 'p-datatable',
    ],
  },

  // ─── React SPA ────────────────────────────────────────────────────────────
  'spa-react': {
    name: 'React SPA',
    waitStrategy: 'domcontentloaded',
    extraWaitMs:  800,

    navSelectors: [
      'nav a', '[class*="sidebar"] a', '[class*="drawer"] a',
      '[class*="menu"] a', '[class*="nav"] a',
      '.MuiListItem-root a', '.MuiListItemButton-root', '.MuiTab-root',
      '.MuiBottomNavigationAction-root', '.MuiButtonBase-root[href]',
      '.ant-menu-item a', '.ant-menu-submenu-title', '.ant-tabs-tab',
      '[role="tab"]', '[role="menuitem"]', '[role="navigation"] a', '.nav-link',
      '[data-testid*="nav"]', '[data-testid*="menu"]', '[data-testid*="link"]',
    ],

    clickableSelectors: [
      '[class*="menu-item"]', '[class*="nav-item"]', '[class*="sidebar-item"]',
      '[class*="menu-link"]', '[class*="nav-link"]',
      '.menu-item', '.nav-item', '.sidebar-item',
    ],

    expandSelectors: [
      '[aria-expanded="false"]:not(input):not(select)',
      '.ant-collapse-header',
      '.MuiAccordionSummary-root:not(.Mui-expanded)',
    ],

    domRouteAttrs: ['data-href', 'data-path', 'data-route'],

    locatorPreference: ['data-testid', 'id', 'aria-label', 'placeholder', 'text', 'class', 'xpath'],

    extraElementSelectors: [
      '.MuiButton-root', '.MuiTextField-root input', '.MuiSelect-root',
      '.MuiCheckbox-root', '.MuiSwitch-root',
      '.ant-btn', '.ant-input', '.ant-select', '.ant-checkbox',
    ],
  },

  // ─── Vue SPA ──────────────────────────────────────────────────────────────
  'spa-vue': {
    name: 'Vue SPA',
    waitStrategy: 'domcontentloaded',
    extraWaitMs:  700,

    navSelectors: [
      'nav a', '[class*="sidebar"] a', '[class*="menu"] a',
      '.v-list-item', '.v-list-item__title', '.v-tab', '.v-navigation-drawer a',
      '.el-menu-item', '.el-submenu__title', '.el-tabs__item',
      '[role="tab"]', '[role="menuitem"]', '.nav-link',
    ],

    clickableSelectors: [
      '[class*="menu-item"]', '[class*="nav-item"]', '[class*="sidebar-item"]',
      '.menu-item', '.nav-item',
    ],

    expandSelectors: [
      '[aria-expanded="false"]:not(input):not(select)',
      '.el-submenu:not(.is-opened) .el-submenu__title',
      '.v-expansion-panel-header:not(.v-expansion-panel-header--active)',
    ],

    domRouteAttrs: ['to', 'data-path', 'data-route'],
    locatorPreference: ['data-testid', 'id', 'aria-label', 'placeholder', 'text', 'xpath'],
    extraElementSelectors: ['.v-btn', '.v-text-field input', '.v-select', '.el-button', '.el-input__inner'],
  },

  // ─── Web (server-rendered) ────────────────────────────────────────────────
  'web': {
    name: 'Web (Server-rendered)',
    waitStrategy: 'load',
    extraWaitMs:  500,

    navSelectors: [
      'nav a', '.navbar-nav a', '.nav-link', '.nav-item a',
      '[class*="sidebar"] a', 'header a', '.breadcrumb a',
      '[role="navigation"] a', '[role="menuitem"]', '[role="tab"]',
    ],

    clickableSelectors: [
      '[class*="menu-item"]', '[class*="nav-item"]', '.menu-item', '.nav-item',
    ],

    expandSelectors: [
      '[aria-expanded="false"]:not(input):not(select)',
      '.accordion-button.collapsed',
      '[data-bs-toggle="collapse"]',
    ],

    domRouteAttrs: [],
    locatorPreference: ['id', 'name', 'data-testid', 'aria-label', 'placeholder', 'text', 'xpath'],
    extraElementSelectors: [],
  },

  // ─── Hybrid (Next.js / Nuxt / Remix) ─────────────────────────────────────
  'hybrid': {
    name: 'Hybrid (SSR+SPA)',
    waitStrategy: 'networkidle',
    extraWaitMs:  1000,

    navSelectors: [
      'nav a', '[class*="sidebar"] a', '[class*="menu"] a',
      '.nav-link', '[role="menuitem"]', '[role="tab"]',
      '[role="navigation"] a', '[data-testid*="nav"]', 'a[href^="/"]',
    ],

    clickableSelectors: [
      '[class*="menu-item"]', '[class*="nav-item"]', '.menu-item', '.nav-item',
    ],

    expandSelectors: [
      '[aria-expanded="false"]:not(input):not(select)',
      '.accordion-button.collapsed',
    ],

    domRouteAttrs: ['data-href', 'data-path'],
    locatorPreference: ['data-testid', 'id', 'aria-label', 'placeholder', 'text', 'xpath'],
    extraElementSelectors: [],
  },

  // ─── Electron ─────────────────────────────────────────────────────────────
  'electron': {
    name: 'Electron Desktop',
    waitStrategy: 'domcontentloaded',
    extraWaitMs:  1200,

    navSelectors: [
      'nav a', '[class*="sidebar"] a', '[class*="menu"] a',
      '[role="tab"]', '[role="menuitem"]', '[role="treeitem"]',
      '[class*="toolbar"] button',
    ],

    clickableSelectors: [
      '[class*="menu-item"]', '[class*="nav-item"]', '[class*="tree-item"]',
      '.menu-item', '.nav-item',
    ],

    expandSelectors: [
      '[aria-expanded="false"]:not(input):not(select)',
      '[class*="tree-item"]:not([class*="expanded"])',
    ],

    domRouteAttrs: [],
    locatorPreference: ['data-testid', 'id', 'aria-label', 'text', 'class', 'xpath'],
    extraElementSelectors: ['[class*="tab"]', '[class*="panel"]', '[class*="toolbar"] button'],
  },
};

function getProfile(appType = 'spa') {
  if (PROFILES[appType]) return { key: appType, ...PROFILES[appType] };
  const map = {
    spa: 'spa-angular', angular: 'spa-angular', react: 'spa-react',
    vue: 'spa-vue', web: 'web', hybrid: 'hybrid', electron: 'electron',
  };
  const key = map[appType?.toLowerCase()] || 'spa-angular';
  return { key, ...PROFILES[key] };
}

module.exports = { getProfile, PROFILES };
