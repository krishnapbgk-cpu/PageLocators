/**
 * Playwright Browser Agent — Profile-driven, Login-first, Event-driven
 *
 * Config parameters honoured:
 *   appType        → selects nav selectors, wait strategy, locator preferences
 *                    via app.profiles.js (Angular/React/Vue/Web/Hybrid/Electron)
 *   auth           → form-based login (not httpCredentials — supports real login forms)
 *   headless       → browser visibility
 *   locatorConfig  → user-defined patterns + priority chain
 *   maxPages       → BFS depth limit
 *
 * Core mechanisms:
 *   page.on('framenavigated')           — native Playwright SPA navigation event
 *   page.exposeFunction + addInitScript — intercepts pushState/replaceState inside
 *                                         Angular/React/Vue router code itself
 *   context.storageState()              — saves full session after login, reused
 *                                         for every subsequent page — zero re-logins
 *   profile.expandSelectors             — opens collapsed accordions/panels before nav scan
 */

const { getProfile } = require('./app.profiles');
const {
  generateBestLocator,
  determineElementType,
  getElementActions,
  generateElementName,
} = require('./locator.engine');

// Base element selectors (common across all app types)
const BASE_ELEMENT_SELECTORS = [
  'button:visible',
  'input:not([type="hidden"]):visible',
  'select:visible',
  'textarea:visible',
  'a[href]:visible',
  '[role="button"]:visible',
  '[role="tab"]:visible',
  '[role="checkbox"]:visible',
  '[role="radio"]:visible',
  '[role="combobox"]:visible',
  '[role="menuitem"]:visible',
  '[role="dialog"]',
  'table:visible',
  'form:visible',
];

const LOGIN_PATH_RE   = /\/login|\/signin|\/sign-in|\/auth(?:\/|$)|\/logout/i;
const ASSET_PATH_RE   = /\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|map|json)(\?|$)/i;
const MAX_EL_PER_SEL  = 50;

const isLoginPath = p => LOGIN_PATH_RE.test(p);
const isAssetPath = p => ASSET_PATH_RE.test(p);

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE LISTENER — must be called BEFORE first goto()
// Combines:
//   1. Playwright's native framenavigated event
//   2. exposeFunction bridge that injected script calls from inside the SPA
//   3. Injection of pushState/replaceState intercept into the page's JS context
// ─────────────────────────────────────────────────────────────────────────────
async function attachRouteListener(page, routeSet, baseHost, onLog) {
  const normalize = (urlStr) => {
    try {
      const { host, pathname } = new URL(urlStr);
      if (host !== baseHost || !pathname || routeSet.has(pathname)
          || isLoginPath(pathname) || isAssetPath(pathname)) return null;
      return pathname;
    } catch { return null; }
  };

  const addRoute = (src, urlStr) => {
    const p = normalize(urlStr);
    if (!p) return;
    routeSet.add(p);
    onLog('info', `  [${src}] → ${p}`);
  };

  // 1. Native Playwright navigation event
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame()) return;
    addRoute('framenavigated', frame.url());
  });

  // 2. Network-level document requests (hard navigation or SSR fetch)
  page.on('request', req => {
    if (req.resourceType() !== 'document') return;
    addRoute('request', req.url());
  });

  // 3. exposeFunction MUST be awaited before addInitScript
  await page.exposeFunction('__esfRouteListener', url => addRoute('spa', url));

  // 4. Inject intercept — runs on every page load including SPA navigations
  //    Covers Angular Router (ngZone), React Router (history), Vue Router (useRouter)
  await page.addInitScript(() => {
    const notify = url => { try { window.__esfRouteListener?.(url); } catch {} };

    const wrap = (obj, method) => {
      const orig = obj[method];
      obj[method] = function (...args) {
        const result = orig.apply(this, args);
        notify(location.href);
        return result;
      };
    };

    wrap(history, 'pushState');
    wrap(history, 'replaceState');
    window.addEventListener('popstate', () => notify(location.href));
    // Hash-based routing (legacy Angular)
    window.addEventListener('hashchange', () => notify(location.href));
    // Fire for the current URL immediately
    notify(location.href);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN DETECTION & FORM FILL
// ─────────────────────────────────────────────────────────────────────────────
async function isLoginPage(page) {
  try { return (await page.locator('input[type="password"]:visible').count()) > 0; }
  catch { return false; }
}

async function performLogin(page, username, password, onLog) {
  onLog('info', '🔐 Login form detected — auto-filling credentials…');

  const pwLoc = page.locator('input[type="password"]:visible').first();
  if (!(await pwLoc.isVisible().catch(() => false))) {
    return { success: false, error: 'Password field not visible' };
  }

  // Username field — priority order covers most enterprise login forms
  const userSelectors = [
    'input[type="email"]:visible',
    'input[autocomplete="username"]:visible',
    'input[autocomplete="email"]:visible',
    'input[name="username"]:visible', 'input[name="email"]:visible',
    'input[name="user"]:visible',     'input[name="userId"]:visible',
    'input[name="userName"]:visible', 'input[name="loginId"]:visible',
    'input[id*="username" i]:visible', 'input[id*="email" i]:visible',
    'input[id*="user" i]:visible',
    'input[placeholder*="username" i]:visible',
    'input[placeholder*="email" i]:visible',
    'input[placeholder*="user" i]:visible',
    'input[type="text"]:visible',  // last resort
  ];

  let userLoc = null;
  for (const sel of userSelectors) {
    try { const el = page.locator(sel).first(); if (await el.isVisible()) { userLoc = el; onLog('info', `  ↳ username: ${sel}`); break; } } catch {}
  }

  const submitSelectors = [
    'button[type="submit"]:visible', 'input[type="submit"]:visible',
    '.p-button[type="submit"]:visible',
    'button:has-text("Login"):visible',    'button:has-text("Sign in"):visible',
    'button:has-text("Log in"):visible',   'button:has-text("Submit"):visible',
    'button:has-text("Continue"):visible', 'button:has-text("Proceed"):visible',
    '[class*="login-btn"]:visible', '[class*="loginBtn"]:visible',
    '[class*="sign-in-btn"]:visible',
  ];

  let submitLoc = null;
  for (const sel of submitSelectors) {
    try { const el = page.locator(sel).first(); if (await el.isVisible()) { submitLoc = el; onLog('info', `  ↳ submit: ${sel}`); break; } } catch {}
  }

  try {
    if (userLoc) {
      onLog('info', `  → Filling username: ${username}`);
      await userLoc.click({ timeout: 5000 });
      await userLoc.selectText().catch(() => {});
      await userLoc.fill(username);
    }

    onLog('info', '  → Filling password: ••••••');
    await pwLoc.click({ timeout: 5000 });
    await pwLoc.selectText().catch(() => {});
    await pwLoc.fill(password);

    await page.waitForTimeout(400); // let reactive forms settle

    onLog('info', '  → Submitting form…');
    if (submitLoc) await submitLoc.click({ timeout: 8000 });
    else           await pwLoc.press('Enter');

    // Wait for URL to leave login path
    try {
      await page.waitForURL(url => !isLoginPath(new URL(url).pathname), { timeout: 20_000 });
    } catch {
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    if (await isLoginPage(page)) {
      let errMsg = '';
      for (const sel of ['[class*="error"]:visible','[role="alert"]:visible','.p-message-error:visible','[class*="invalid-feedback"]:visible']) {
        try { const el = page.locator(sel).first(); if (await el.isVisible()) { errMsg = (await el.textContent() || '').trim(); break; } } catch {}
      }
      onLog('err', `  ✗ Login failed${errMsg ? ': ' + errMsg : ' — still on login page, check credentials'}`);
      return { success: false, error: errMsg || 'Still on login page' };
    }

    const landingUrl  = page.url();
    const landingPath = new URL(landingUrl).pathname;
    onLog('ok', `  ✓ Authenticated — landed at: ${landingPath}`);
    return { success: true, landingPath, landingUrl };

  } catch (err) {
    onLog('err', `  Login error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM ROUTE SCAN — no interaction, reads attributes only
// Uses profile.domRouteAttrs to know which framework-specific attrs to scan
// ─────────────────────────────────────────────────────────────────────────────
async function collectDOMRoutes(page, baseHost, profile) {
  try {
    return await page.evaluate(({ baseHost, domRouteAttrs }) => {
      const paths = new Set();

      // Standard hrefs
      document.querySelectorAll('a[href]').forEach(a => {
        try {
          const u = new URL(a.href, location.origin);
          if (u.host === baseHost && u.pathname !== '#'
              && !u.pathname.match(/\.(js|css|png|jpg|svg|ico|woff|map)$/)) {
            paths.add(u.pathname);
          }
        } catch {}
      });

      // Framework-specific routing attributes
      domRouteAttrs.forEach(attr => {
        document.querySelectorAll(`[${attr}]`).forEach(el => {
          const v = el.getAttribute(attr);
          if (v && typeof v === 'string' && v.startsWith('/') && !v.includes('*')) {
            paths.add(v.split('?')[0].split('#')[0]);
          }
        });
      });

      // Common data attributes
      document.querySelectorAll('[data-path],[data-route],[data-url],[data-href]').forEach(el => {
        const v = el.dataset.path || el.dataset.route || el.dataset.url || el.dataset.href;
        if (v && v.startsWith('/')) paths.add(v.split('?')[0]);
      });

      return [...paths];
    }, { baseHost, domRouteAttrs: profile.domRouteAttrs || [] });
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPAND COLLAPSED MENUS — profile-specific expand selectors
// Opens accordion panels, tree nodes etc before nav scan
// ─────────────────────────────────────────────────────────────────────────────
async function expandCollapsedMenus(page, profile, onLog) {
  let expanded = 0;
  for (const sel of (profile.expandSelectors || [])) {
    try {
      const count = await page.locator(sel).count();
      for (let i = 0; i < Math.min(count, 15); i++) {
        const el = page.locator(sel).nth(i);
        if (await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(250);
          expanded++;
        }
      }
    } catch {}
  }
  if (expanded > 0) {
    onLog('info', `  ↳ Expanded ${expanded} collapsed panels`);
    await page.waitForTimeout(400);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV CLICK DISCOVERY — profile-specific nav selectors
// CRITICAL: navigates back to landingUrl (authenticated landing), NOT baseUrl
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// Build the full candidate list combining 3 sources:
//   1. profile.navSelectors  — anchor/role-based elements
//   2. profile.clickableSelectors — custom div/span nav items (no href/role)
//   3. cursor-pointer scan   — any visible element the browser marks as
//                              clickable, regardless of class or tag
//      This is the universal fallback that catches <div class="menu-item">
// ─────────────────────────────────────────────────────────────────────────
async function collectNavCandidates(page, profile) {
  const candidates = new Map(); // key: elementText → { sel, idx }

  // Source 1: standard nav selectors
  for (const sel of profile.navSelectors) {
    try {
      const count = await page.locator(sel).count();
      for (let i = 0; i < Math.min(count, 30); i++) candidates.set(`${sel}::${i}`, { sel, idx: i, source: 'nav' });
    } catch {}
  }

  // Source 2: clickable class-pattern divs (custom sidebar items like menu-item)
  for (const sel of (profile.clickableSelectors || [])) {
    try {
      const count = await page.locator(sel).count();
      for (let i = 0; i < Math.min(count, 30); i++) candidates.set(`${sel}::${i}`, { sel, idx: i, source: 'clickable' });
    } catch {}
  }

  // Source 3: cursor-pointer scan — catches any JS-navigated element
  // Evaluates computed style, ignores buttons/inputs (handled by nav/element selectors)
  // This is what catches <div class="menu-item  "> with no href or role
  try {
    const pointerEls = await page.evaluate(() => {
      const results = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        { acceptNode: node => {
          if (['SCRIPT','STYLE','NOSCRIPT','SVG','IFRAME'].includes(node.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }}
      );
      while (walker.nextNode()) {
        const el = walker.currentNode;
        const tag = el.tagName.toLowerCase();
        // Skip standard interactive elements — already covered
        if (['a','button','input','select','textarea'].includes(tag)) continue;
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') continue;
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (el.offsetWidth < 20 || el.offsetHeight < 8) continue; // skip tiny invisible elements
        const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        if (!text || text.length < 2) continue;
        results.push({ tag, cls: el.className || '', text });
        if (results.length >= 60) break;
      }
      return results;
    });

    // For each cursor:pointer element, build a selector to click it
    pointerEls.forEach(({ tag, cls, text }) => {
      // Use text content as selector via :has-text (Playwright)
      const cleanText = text.replace(/'/g, "\\'").slice(0, 40);
      const sel = `${tag}:has-text('${cleanText}')`;
      const key = `cursor::${text}`;
      if (!candidates.has(key)) candidates.set(key, { sel, idx: 0, source: 'cursor-pointer', text });
    });
  } catch {}

  return [...candidates.values()];
}

async function discoverByClicking(page, landingUrl, routeSet, visitedSet, profile, onLog) {
  await expandCollapsedMenus(page, profile, onLog);

  const navHandles = await collectNavCandidates(page, profile);
  const bySource   = navHandles.reduce((a, h) => { a[h.source] = (a[h.source]||0)+1; return a; }, {});
  onLog('info', `  Candidates: ${navHandles.length} total — ${Object.entries(bySource).map(([k,v])=>`${k}:${v}`).join(' | ')}`);

  const clickedTexts = new Set();
  let newRoutes = 0;

  for (const handle of navHandles.slice(0, 150)) {
    try {
      const el = page.locator(handle.sel).nth(handle.idx || 0);
      if (!(await el.isVisible().catch(() => false))) continue;

      // Get text — works even when text is inside nested <span> like your menu-item
      const text = handle.text ||
        (await el.evaluate(n => (n.innerText || n.textContent || '').trim().replace(/\s+/g, ' ')).catch(() => '')).slice(0, 60);

      if (!text || text.length < 2 || clickedTexts.has(text)) continue;
      clickedTexts.add(text);

      const sizeBefore = routeSet.size;

      await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      // Try normal click first, then force click (for elements with pointer-events or overlays)
      await el.click({ timeout: 4000 }).catch(() =>
        el.click({ timeout: 3000, force: true }).catch(() => {}));

      if (profile.waitStrategy === 'networkidle') {
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      } else {
        await page.waitForLoadState('domcontentloaded', { timeout: 4000 }).catch(() => {});
      }
      await page.waitForTimeout(300);

      if (routeSet.size > sizeBefore) {
        newRoutes += (routeSet.size - sizeBefore);
        onLog('info', `  ✓ [${handle.source}] "${text}" triggered navigation`);
      }

      // CRITICAL: go back to landingUrl (authenticated landing), NOT baseUrl (login page)
      const curPath    = new URL(page.url()).pathname;
      const landingPath = new URL(landingUrl).pathname;
      if (curPath !== landingPath) {
        await page.goto(landingUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(400);
        await expandCollapsedMenus(page, profile, () => {}).catch(() => {});
      }
    } catch {}
  }

  onLog('info', `  ↳ Click scan done — ${newRoutes} new routes | ${routeSet.size} total`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAWL SINGLE PAGE — extract all interactive elements
// Uses profile.extraElementSelectors for framework-specific components
// ─────────────────────────────────────────────────────────────────────────────
async function crawlPage(page, url, locatorConfig, profile, onLog) {
  onLog('info', `→ Crawling: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

  // Wait using profile strategy
  if (profile.waitStrategy === 'load') {
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
  } else if (profile.waitStrategy === 'networkidle') {
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
  }
  await page.waitForTimeout(profile.extraWaitMs || 1000);

  if (await isLoginPage(page)) {
    onLog('warn', `  ↳ Session expired — redirected to login, skipping`);
    return null;
  }

  const title    = await page.title().catch(() => '');
  const pathname = new URL(url).pathname;
  onLog('info', `  "${title}" on ${pathname}`);

  const screenshotBuf = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 70 }).catch(() => null);
  const screenshot    = screenshotBuf ? screenshotBuf.toString('base64') : null;

  // Combine base selectors with profile-specific ones
  const allSelectors = [...BASE_ELEMENT_SELECTORS, ...(profile.extraElementSelectors || [])];
  const seen = new Set(), components = [];

  for (const selector of allSelectors) {
    let count = 0;
    try { count = await page.locator(selector).count(); } catch { continue; }

    for (let i = 0; i < Math.min(count, MAX_EL_PER_SEL); i++) {
      const el = page.locator(selector).nth(i);
      try {
        const attrs = await el.evaluate(node => {
          const obj = {};
          for (const { name, value } of node.attributes) obj[name] = value;
          obj._tagName   = node.tagName.toLowerCase();
          obj._text      = (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
          obj._innerText = (node.innerText   || '').trim().replace(/\s+/g, ' ').slice(0, 80);
          obj._type      = node.type  || '';
          obj._value     = node.value || '';
          obj._visible   = (node.offsetWidth > 0 || node.offsetHeight > 0)
                        && getComputedStyle(node).visibility !== 'hidden'
                        && getComputedStyle(node).display    !== 'none';
          return obj;
        });

        if (!attrs._visible) continue;

        // Try user-defined patterns first, then priority chain
        let locResult = tryUserPatterns(attrs, locatorConfig.userPatterns || []);
        if (!locResult) locResult = generateBestLocator(attrs, locatorConfig.priority);
        if (!locResult || seen.has(locResult.display)) continue;
        seen.add(locResult.display);

        const type    = determineElementType(attrs._tagName, attrs._type, attrs.role);
        const name    = generateElementName(attrs, type);
        const actions = getElementActions(type);

        components.push({
          name, type,
          locator:      locResult.display,
          locatorType:  locResult.strategy,
          pwExpression: locResult.playwrightExpr,
          actions,
          tagName:  attrs._tagName,
          required: true,
          notes:    buildNotes(attrs),
        });
      } catch {}
    }
  }

  onLog('ok', `  ✓ ${components.length} elements discovered on ${pathname}`);

  const segments = pathname.split('/').filter(Boolean);
  const pageName = segments.length
    ? segments.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    : 'Home';

  return { name: pageName, path: pathname, route: pathname, url, title, screenshot, components };
}

// ─────────────────────────────────────────────────────────────────────────────
// USER LOCATOR PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
function tryUserPatterns(attrs, userPatterns) {
  if (!userPatterns?.length) return null;
  const map = { text: '_text', id: 'id', name: 'name', placeholder: 'placeholder',
                'aria-label': 'aria-label', value: '_value', class: 'class', type: '_type' };
  for (const pat of userPatterns) {
    if (!pat.enabled || !pat.pattern) continue;
    const deps   = (pat.pattern.match(/\{([^}]+)\}/g) || []).map(m => m.slice(1, -1));
    const allMet = deps.every(dep => { const v = attrs[map[dep] || dep]; return v && String(v).trim(); });
    if (!allMet) continue;

    const resolved = pat.pattern
      .replace(/\{text\}/g,        attrs._text || attrs._innerText || '')
      .replace(/\{id\}/g,          attrs.id || '')
      .replace(/\{name\}/g,        attrs.name || '')
      .replace(/\{placeholder\}/g, attrs.placeholder || '')
      .replace(/\{aria-label\}/g,  attrs['aria-label'] || '')
      .replace(/\{value\}/g,       attrs.value || attrs._value || '')
      .replace(/\{class\}/g,       attrs.class || '')
      .replace(/\{type\}/g,        attrs._type || attrs.type || '');

    return {
      display:      resolved,
      strategy:     pat.strategy === 'css' ? 'css' : 'user-pattern',
      playwrightExpr: pat.strategy === 'css'
        ? `page.locator('${resolved.replace(/'/g, "\\'")}')`
        : `page.locator('xpath=${resolved.replace(/'/g, "\\'")}')`,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
function requirePlaywright() {
  try { return require('playwright'); }
  catch { throw new Error('playwright not installed — run: npm install playwright && npx playwright install chromium'); }
}

function launchOpts(headless) {
  return {
    headless,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',           // avoids CORS blocking screenshots
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAWL PAGES — called from AnalyzeTab
// appType flows through to profile → changes selectors + wait strategy
// ─────────────────────────────────────────────────────────────────────────────
async function crawlPages({
  baseUrl, paths, locatorConfig, auth,
  headless = true, appType = 'spa',
  onLog = () => {}, onPageDone = () => {},
}) {
  const { chromium } = requirePlaywright();
  const profile      = getProfile(appType);
  onLog('info', `🎭 Profile: ${profile.name} | ${headless ? 'Headless' : 'Headed'} Chromium`);

  const browser = await chromium.launch(launchOpts(headless));

  try {
    // ── Step 1: Login + save session ─────────────────────────────────────
    let savedState = null;
    if (auth?.username && auth?.password) {
      onLog('info', '━ Step 1: Authenticate');
      const loginCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const loginPage = await loginCtx.newPage();
      await attachRouteListener(loginPage, new Set(), new URL(baseUrl).host, () => {});

      try {
        await loginPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await loginPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await loginPage.waitForTimeout(1000);

        if (await isLoginPage(loginPage)) {
          const r = await performLogin(loginPage, auth.username, auth.password, onLog);
          if (!r.success) {
            onLog('err', `Auth failed: ${r.error}`);
            await loginCtx.close(); await browser.close(); return [];
          }
          await loginPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
          await loginPage.waitForTimeout(profile.extraWaitMs || 1000);
        }

        savedState = await loginCtx.storageState();
        onLog('ok', `Session saved — ${savedState.cookies?.length || 0} cookies`);
      } finally { await loginCtx.close(); }
    }

    // ── Step 2: Crawl each path with saved session ────────────────────────
    onLog('info', `━ Step 2: Crawl ${paths.length} page(s) [${profile.name}]`);
    const ctxOpts = { viewport: { width: 1280, height: 800 } };
    if (savedState) ctxOpts.storageState = savedState;

    const context = await browser.newContext(ctxOpts);
    const page    = await context.newPage();
    page.on('console', () => {}); page.on('pageerror', () => {});

    const results = [];
    for (const rawPath of paths) {
      const url = `${baseUrl.replace(/\/$/, '')}${rawPath.startsWith('/') ? rawPath : '/' + rawPath}`;
      try {
        const pageData = await crawlPage(page, url, locatorConfig, profile, onLog);
        if (pageData) { results.push(pageData); onPageDone(pageData); }
      } catch (err) { onLog('warn', `Skipped ${url}: ${err.message}`); }
    }

    await context.close();
    const total = results.reduce((s, p) => s + p.components.length, 0);
    onLog('ok', `✓ Crawl complete — ${results.length} pages, ${total} elements`);
    return results;
  } finally { await browser.close(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVER ROUTES — full 5-phase discovery, profile-aware
// ─────────────────────────────────────────────────────────────────────────────
async function discoverRoutes({
  baseUrl, maxPages = 50, auth,
  headless = true, appType = 'spa',
  onLog = () => {},
}) {
  const { chromium } = requirePlaywright();
  const profile      = getProfile(appType);
  const baseHost     = new URL(baseUrl).host;

  onLog('info', `🔍 Discovering routes — Profile: ${profile.name} | maxPages: ${maxPages}`);

  const browser = await chromium.launch(launchOpts(headless));

  try {
    // ── Phase 0: Login, save storageState ────────────────────────────────
    onLog('info', '━━ Phase 0: Authenticate ━━');
    const discoveredRoutes = new Set();
    const loginCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const loginPage = await loginCtx.newPage();

    // Attach BEFORE first goto so pushState intercept is in place from page 1
    await attachRouteListener(loginPage, discoveredRoutes, baseHost, onLog);

    await loginPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await loginPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await loginPage.waitForTimeout(1500);

    let savedState  = null;
    let landingUrl  = loginPage.url();
    let landingPath = new URL(landingUrl).pathname;

    if (await isLoginPage(loginPage)) {
      if (!auth?.username) {
        onLog('err', '⚠ Login page detected but no credentials supplied');
        onLog('err', '  → Add username + password in CONFIG → UI Repository panel');
        await loginCtx.close(); await browser.close(); return ['/'];
      }
      const result = await performLogin(loginPage, auth.username, auth.password, onLog);
      if (!result.success) {
        onLog('err', `❌ Login failed: ${result.error}`);
        await loginCtx.close(); await browser.close(); return ['/'];
      }
      await loginPage.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
      await loginPage.waitForTimeout(profile.extraWaitMs || 1500);
      landingUrl  = loginPage.url();
      landingPath = new URL(landingUrl).pathname;
    } else {
      onLog('info', 'No login form — proceeding as authenticated');
    }

    savedState = await loginCtx.storageState();
    onLog('ok', `✓ Session saved — ${savedState.cookies?.length || 0} cookies | Landing: ${landingPath}`);
    discoveredRoutes.add(landingPath);

    // ── Phase 1: DOM scan ────────────────────────────────────────────────
    onLog('info', `━━ Phase 1: DOM scan [${profile.name}] ━━`);
    const dom1 = await collectDOMRoutes(loginPage, baseHost, profile);
    dom1.filter(p => !isLoginPath(p)).forEach(p => { discoveredRoutes.add(p); onLog('info', `  dom → ${p}`); });
    onLog('info', `  ${dom1.length} candidates from DOM attrs`);

    // ── Phase 2: Nav click (profile-specific selectors + expand) ─────────
    onLog('info', `━━ Phase 2: Nav click discovery [${profile.name}] ━━`);
    const visitedSet = new Set([landingPath]);
    await discoverByClicking(loginPage, landingUrl, discoveredRoutes, visitedSet, profile, onLog);
    onLog('info', `  After Phase 2: ${discoveredRoutes.size} routes`);

    await loginCtx.close();

    // ── Phase 3: BFS with saved session — visits each route, runs DOM scan + nav click ─
    onLog('info', '━━ Phase 3: BFS deep scan (stored session) ━━');
    const bfsCtx  = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: savedState });
    const bfsPage = await bfsCtx.newPage();
    await attachRouteListener(bfsPage, discoveredRoutes, baseHost, onLog);
    bfsPage.on('console', () => {}); bfsPage.on('pageerror', () => {});

    const queue = [...discoveredRoutes].filter(p => !visitedSet.has(p) && !isLoginPath(p));

    while (queue.length && discoveredRoutes.size < maxPages) {
      const p = queue.shift();
      if (visitedSet.has(p)) continue;
      visitedSet.add(p);

      const url = `${baseUrl.replace(/\/$/, '')}${p.startsWith('/') ? p : '/' + p}`;
      try {
        await bfsPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        if (profile.waitStrategy === 'networkidle') {
          await bfsPage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        }
        await bfsPage.waitForTimeout(600);

        if (await isLoginPage(bfsPage)) {
          onLog('warn', `  Session expired at ${p} — re-authenticating…`);
          if (!auth?.username) { onLog('err', '  No credentials for re-auth — stopping'); break; }
          const r = await performLogin(bfsPage, auth.username, auth.password, onLog);
          if (!r.success) { onLog('err', '  Re-auth failed — stopping BFS'); break; }
          await bfsPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
          await bfsPage.waitForTimeout(500);
        }

        const subDom = await collectDOMRoutes(bfsPage, baseHost, profile);
        const newFromDom = subDom.filter(sp => !isLoginPath(sp) && !discoveredRoutes.has(sp));
        newFromDom.slice(0, maxPages - discoveredRoutes.size).forEach(sp => {
          discoveredRoutes.add(sp); queue.push(sp); onLog('info', `  bfs-dom → ${sp}`);
        });

        // Also run nav click on each BFS page to find routes only reachable via sidebar
        if (discoveredRoutes.size < maxPages) {
          const curUrl = bfsPage.url();
          await discoverByClicking(bfsPage, curUrl, discoveredRoutes, visitedSet, profile, onLog);
          [...discoveredRoutes].filter(sp => !visitedSet.has(sp) && !isLoginPath(sp)).forEach(sp => queue.push(sp));
        }

      } catch (err) { onLog('warn', `  BFS skip ${p}: ${err.message}`); }
    }

    await bfsCtx.close();

    const result = [...discoveredRoutes]
      .filter(p => p && p !== '#' && !p.includes('undefined') && !isLoginPath(p))
      .sort();

    onLog('ok', `━━ Discovery complete — ${result.length} unique routes found ━━`);
    result.forEach(p => onLog('info', `  ✓ ${p}`));
    return result;

  } finally { await browser.close(); }
}

function buildNotes(attrs) {
  const parts = [];
  if (attrs._type)            parts.push(`type="${attrs._type}"`);
  if (attrs.required)         parts.push('required');
  if (attrs.disabled)         parts.push('disabled');
  if (attrs['aria-required']) parts.push('aria-required');
  return parts.join(', ');
}

module.exports = { crawlPages, discoverRoutes, performLogin, isLoginPage };
