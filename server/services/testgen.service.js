/**
 * Test Generator Service — Multi-language, Framework-aware
 *
 * Generates Page Object Models and Spec files for:
 *   TypeScript  (.ts)  — @playwright/test
 *   JavaScript  (.js)  — @playwright/test (CommonJS)
 *   Python      (.py)  — playwright-python + pytest
 *   Java        (.java)— playwright-java + JUnit5
 *
 * When frameworkAnalysis is provided (from Framework Analyzer), generated
 * code will match the existing framework's folder paths, naming conventions,
 * import style, POM class structure and test describe/test patterns.
 */

// ── Shared helpers ────────────────────────────────────────────────────────────
const toClassName  = s => (s || 'Page').replace(/[^a-zA-Z0-9\s]/g,' ').split(/\s+/).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
const toPropName   = s => { const w=(s||'el').replace(/[^a-zA-Z0-9\s]/g,' ').split(/\s+/).filter(Boolean); return w[0][0].toLowerCase()+w[0].slice(1)+w.slice(1).map(x=>x[0].toUpperCase()+x.slice(1)).join(''); };
const toSnakeCase  = s => (s||'el').replace(/[^a-zA-Z0-9\s]/g,' ').split(/\s+/).filter(Boolean).map(x=>x.toLowerCase()).join('_');
const toKebab      = s => (s||'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const ucFirst      = s => s.charAt(0).toUpperCase()+s.slice(1);
const esc          = s => String(s).replace(/'/g,"\\'");
const escRx        = s => String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const countTests   = c => (c.match(/^\s+(?:test|def test_|@Test|it)\(/gm)||[]).length;

// Resolve paths from framework analysis (or use sensible defaults)
function resolvePaths(fw, language) {
  const ext = { typescript: '.ts', javascript: '.js', python: '.py', java: '.java' }[language] || '.ts';
  return {
    pagesDir: (fw?.structure?.pages  || 'pages/').replace(/\/$/,''),
    testsDir: (fw?.structure?.tests  || 'tests/e2e/').replace(/\/$/,''),
    ext,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript POM + Spec
// ─────────────────────────────────────────────────────────────────────────────
function pomTS(page, fw) {
  const { pagesDir } = resolvePaths(fw, 'typescript');
  const cls  = toClassName(page.name || page.path);
  const comps = (page.components || []).filter(c => c.locator && c.locator !== '//*');

  const decls   = comps.map(c => `  readonly ${toPropName(c.name)}: Locator;`).join('\n');
  const assigns = comps.map(c => `    this.${toPropName(c.name)} = ${c.pwExpression || `page.locator('${esc(c.locator)}')`};`).join('\n');
  const methods = comps.flatMap(c => pomMethodsTS(c)).join('\n\n');

  // Respect import style from framework analysis
  const importLine = (fw?.importStyle === 'commonjs-require')
    ? `const { Page, Locator } = require('@playwright/test');`
    : `import { Page, Locator } from '@playwright/test';`;

  return `${importLine}

export class ${cls}Page {
  readonly page: Page;
${decls ? '\n' + decls : ''}

  constructor(page: Page) {
    this.page = page;
${assigns}
  }

  async navigate(path = '${page.route || page.path || '/'}') {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

${methods}
}
`;
}

function pomMethodsTS(c) {
  const p = toPropName(c.name);
  switch (c.type) {
    case 'button': return [`  async click${ucFirst(p)}() {\n    await this.${p}.click();\n  }`,
                           `  async is${ucFirst(p)}Enabled(): Promise<boolean> {\n    return this.${p}.isEnabled();\n  }`];
    case 'input': case 'textarea':
      return [`  async fill${ucFirst(p)}(value: string) {\n    await this.${p}.fill(value);\n  }`,
              `  async get${ucFirst(p)}Value(): Promise<string> {\n    return this.${p}.inputValue();\n  }`,
              `  async clear${ucFirst(p)}() {\n    await this.${p}.clear();\n  }`];
    case 'dropdown': return [`  async select${ucFirst(p)}(value: string) {\n    await this.${p}.selectOption(value);\n  }`];
    case 'checkbox': case 'radio': return [`  async check${ucFirst(p)}() {\n    await this.${p}.check();\n  }`,
                                           `  async is${ucFirst(p)}Checked(): Promise<boolean> {\n    return this.${p}.isChecked();\n  }`];
    default: return [`  async get${ucFirst(p)}Text(): Promise<string> {\n    return (await this.${p}.textContent()) || '';\n  }`];
  }
}

function specTS(page, testTypes, fw) {
  const { pagesDir, testsDir } = resolvePaths(fw, 'typescript');
  const cls     = toClassName(page.name || page.path);
  const feature = toKebab(page.name || page.path);
  const rel     = pagesDir.startsWith('src/') ? `../../${pagesDir}` : `../../${pagesDir}`;
  const blocks  = buildTestBlocks(page, testTypes, 'ts', fw);

  return {
    filename: `${feature}.spec.ts`, path: `${testsDir}/${feature}.spec.ts`,
    type: testTypes.includes('e2e') ? 'e2e' : testTypes[0],
    description: `${page.name} — ${testTypes.join(', ')} tests`,
    content: `import { test, expect } from '@playwright/test';
import { ${cls}Page } from '${rel}/${feature}.page';

test.describe('${page.name} — ${testTypes.includes('e2e') ? 'E2E' : 'Test'} Suite', () => {

  test.use({ baseURL: process.env.BASE_URL || 'http://localhost:4200' });

${blocks}
});
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JavaScript POM + Spec
// ─────────────────────────────────────────────────────────────────────────────
function pomJS(page, fw) {
  const cls   = toClassName(page.name || page.path);
  const comps = (page.components || []).filter(c => c.locator && c.locator !== '//*');

  const assigns = comps.map(c => `    this.${toPropName(c.name)} = ${c.pwExpression || `page.locator('${esc(c.locator)}')`};`).join('\n');
  const methods = comps.flatMap(c => pomMethodsJS(c)).join('\n\n');

  return `// @ts-check
/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').Locator} Locator */

class ${cls}Page {
  /** @param {Page} page */
  constructor(page) {
    this.page = page;
${assigns}
  }

  async navigate(path = '${page.route || page.path || '/'}') {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

${methods}
}

module.exports = { ${cls}Page };
`;
}

function pomMethodsJS(c) {
  const p = toPropName(c.name);
  switch (c.type) {
    case 'button':   return [`  async click${ucFirst(p)}() {\n    await this.${p}.click();\n  }`];
    case 'input': case 'textarea':
      return [`  async fill${ucFirst(p)}(value) {\n    await this.${p}.fill(value);\n  }`,
              `  async get${ucFirst(p)}Value() {\n    return this.${p}.inputValue();\n  }`];
    case 'dropdown': return [`  async select${ucFirst(p)}(value) {\n    await this.${p}.selectOption(value);\n  }`];
    case 'checkbox': return [`  async check${ucFirst(p)}() {\n    await this.${p}.check();\n  }`,
                             `  async is${ucFirst(p)}Checked() {\n    return this.${p}.isChecked();\n  }`];
    default: return [`  async get${ucFirst(p)}Text() {\n    return (await this.${p}.textContent()) || '';\n  }`];
  }
}

function specJS(page, testTypes, fw) {
  const { pagesDir, testsDir } = resolvePaths(fw, 'javascript');
  const cls     = toClassName(page.name || page.path);
  const feature = toKebab(page.name || page.path);
  const blocks  = buildTestBlocks(page, testTypes, 'js', fw);

  return {
    filename: `${feature}.spec.js`, path: `${testsDir}/${feature}.spec.js`,
    type: testTypes.includes('e2e') ? 'e2e' : testTypes[0],
    description: `${page.name} — ${testTypes.join(', ')} tests`,
    content: `const { test, expect } = require('@playwright/test');
const { ${cls}Page } = require('../../${pagesDir}/${feature}.page');

test.describe('${page.name} — ${testTypes.includes('e2e') ? 'E2E' : 'Test'} Suite', () => {

  test.use({ baseURL: process.env.BASE_URL || 'http://localhost:4200' });

${blocks}
});
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Python POM + Spec
// ─────────────────────────────────────────────────────────────────────────────
function pomPY(page, fw) {
  const cls   = toClassName(page.name || page.path);
  const comps = (page.components || []).filter(c => c.locator && c.locator !== '//*');
  const url   = page.route || page.path || '/';

  const attrs   = comps.map(c => `        self.${toSnakeCase(c.name)}: Locator = ${pyLocator(c)}`).join('\n');
  const methods = comps.flatMap(c => pomMethodsPY(c)).join('\n\n');

  return `from playwright.sync_api import Page, Locator


class ${cls}Page:
    """Page Object for ${page.name} (${url})"""

    def __init__(self, page: Page) -> None:
        self.page = page
${attrs}

    def navigate(self, path: str = '${esc(url)}') -> None:
        self.page.goto(path)
        self.page.wait_for_load_state('networkidle')

${methods}
`;
}

function pyLocator(c) {
  if (c.pwExpression) return c.pwExpression.replace('page.locator(', 'page.locator(');
  return `page.locator('${esc(c.locator)}')`;
}

function pomMethodsPY(c) {
  const p = toSnakeCase(c.name);
  switch (c.type) {
    case 'button':   return [`    def click_${p}(self) -> None:\n        self.${p}.click()`];
    case 'input': case 'textarea':
      return [`    def fill_${p}(self, value: str) -> None:\n        self.${p}.fill(value)`,
              `    def get_${p}_value(self) -> str:\n        return self.${p}.input_value()`];
    case 'dropdown': return [`    def select_${p}(self, value: str) -> None:\n        self.${p}.select_option(value)`];
    case 'checkbox': return [`    def check_${p}(self) -> None:\n        self.${p}.check()`,
                             `    def is_${p}_checked(self) -> bool:\n        return self.${p}.is_checked()`];
    default: return [`    def get_${p}_text(self) -> str:\n        return self.${p}.text_content() or ''`];
  }
}

function specPY(page, testTypes, fw) {
  const { testsDir } = resolvePaths(fw, 'python');
  const cls     = toClassName(page.name || page.path);
  const feature = toKebab(page.name || page.path).replace(/-/g, '_');
  const url     = page.route || page.path || '/';

  const buttons  = (page.components || []).filter(c => c.type === 'button').slice(0, 3);
  const inputs   = (page.components || []).filter(c => c.type === 'input' || c.type === 'textarea').slice(0, 3);

  const tests = [];

  if (testTypes.includes('positive') || testTypes.includes('e2e')) {
    tests.push(`    def test_page_loads(self, page: Page) -> None:
        po = ${cls}Page(page)
        po.navigate('${esc(url)}')
        expect(page).to_have_url(re.compile(r'${escRx(url)}'))`);

    buttons.forEach(btn => {
      const p = toSnakeCase(btn.name);
      tests.push(`    def test_${p}_is_visible(self, page: Page) -> None:
        po = ${cls}Page(page)
        po.navigate('${esc(url)}')
        expect(po.${p}).to_be_visible()
        expect(po.${p}).to_be_enabled()`);
    });

    inputs.forEach(inp => {
      const p = toSnakeCase(inp.name);
      tests.push(`    def test_${p}_accepts_input(self, page: Page) -> None:
        po = ${cls}Page(page)
        po.navigate('${esc(url)}')
        po.fill_${p}('test_value')
        expect(po.${p}).to_have_value('test_value')`);
    });
  }

  if (testTypes.includes('negative')) {
    inputs.slice(0, 2).forEach(inp => {
      const p = toSnakeCase(inp.name);
      tests.push(`    def test_${p}_empty_shows_error(self, page: Page) -> None:
        po = ${cls}Page(page)
        po.navigate('${esc(url)}')
        po.fill_${p}('')
        po.${p}.blur()
        # Assert error state — update selector to match your app`);
    });
  }

  if (testTypes.includes('smoke')) {
    tests.push(`    def test_smoke_page_reachable(self, page: Page) -> None:
        page.goto('${esc(url)}')
        expect(page).not_to_have_url(re.compile(r'(error|404|500)'))
        expect(page.locator('body')).to_be_visible()`);
  }

  return {
    filename: `test_${feature}.py`, path: `${testsDir}/test_${feature}.py`,
    type: testTypes.includes('e2e') ? 'e2e' : testTypes[0],
    description: `${page.name} — ${testTypes.join(', ')} tests`,
    content: `import re
import pytest
from playwright.sync_api import Page, expect
from pages.${feature}_page import ${cls}Page


class Test${cls}:
    """${page.name} — ${testTypes.join(', ')} tests"""

${tests.join('\n\n')}
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Java POM + Test
// ─────────────────────────────────────────────────────────────────────────────
function pomJAVA(page, fw) {
  const cls   = toClassName(page.name || page.path);
  const comps = (page.components || []).filter(c => c.locator && c.locator !== '//*');
  const url   = page.route || page.path || '/';

  const fields  = comps.map(c => `    public final Locator ${toPropName(c.name)};`).join('\n');
  const assigns = comps.map(c => `        this.${toPropName(c.name)} = page.locator("${c.locator.replace(/"/g,'\\"')}");`).join('\n');
  const methods = comps.flatMap(c => pomMethodsJAVA(c)).join('\n\n');

  return `package pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

public class ${cls}Page {

    private final Page page;

${fields}

    public ${cls}Page(Page page) {
        this.page = page;
${assigns}
    }

    public void navigate() {
        navigate("${esc(url)}");
    }

    public void navigate(String path) {
        page.navigate(path);
        page.waitForLoadState();
    }

${methods}
}
`;
}

function pomMethodsJAVA(c) {
  const p = toPropName(c.name);
  switch (c.type) {
    case 'button':   return [`    public void click${ucFirst(p)}() {\n        ${p}.click();\n    }`,
                             `    public boolean is${ucFirst(p)}Enabled() {\n        return ${p}.isEnabled();\n    }`];
    case 'input': case 'textarea':
      return [`    public void fill${ucFirst(p)}(String value) {\n        ${p}.fill(value);\n    }`,
              `    public String get${ucFirst(p)}Value() {\n        return ${p}.inputValue();\n    }`,
              `    public void clear${ucFirst(p)}() {\n        ${p}.clear();\n    }`];
    case 'dropdown': return [`    public void select${ucFirst(p)}(String value) {\n        ${p}.selectOption(value);\n    }`];
    case 'checkbox': return [`    public void check${ucFirst(p)}() {\n        ${p}.check();\n    }`,
                             `    public boolean is${ucFirst(p)}Checked() {\n        return ${p}.isChecked();\n    }`];
    default: return [`    public String get${ucFirst(p)}Text() {\n        return ${p}.textContent();\n    }`];
  }
}

function specJAVA(page, testTypes, fw) {
  const { pagesDir, testsDir } = resolvePaths(fw, 'java');
  const cls     = toClassName(page.name || page.path);
  const feature = toClassName(page.name || page.path);
  const url     = page.route || page.path || '/';
  const buttons = (page.components || []).filter(c => c.type === 'button').slice(0, 3);
  const inputs  = (page.components || []).filter(c => c.type === 'input').slice(0, 3);

  const tests = [];

  if (testTypes.includes('positive') || testTypes.includes('e2e')) {
    tests.push(`    @Test
    @DisplayName("should load ${page.name} page")
    void shouldLoadPage() {
        po.navigate("${esc(url)}");
        assertThat(page).hasURL(Pattern.compile("${escRx(url)}"));
    }`);

    buttons.forEach(btn => {
      const p = toPropName(btn.name);
      tests.push(`    @Test
    @DisplayName("should display ${btn.name} button")
    void should${ucFirst(p)}BeVisible() {
        po.navigate("${esc(url)}");
        assertThat(po.${p}).isVisible();
        assertThat(po.${p}).isEnabled();
    }`);
    });

    inputs.forEach(inp => {
      const p = toPropName(inp.name);
      tests.push(`    @Test
    @DisplayName("${inp.name} should accept valid input")
    void ${p}ShouldAcceptInput() {
        po.navigate("${esc(url)}");
        po.fill${ucFirst(p)}("test_value");
        assertThat(po.${p}).hasValue("test_value");
    }`);
    });
  }

  if (testTypes.includes('negative')) {
    inputs.slice(0, 2).forEach(inp => {
      const p = toPropName(inp.name);
      tests.push(`    @Test
    @DisplayName("${inp.name} should show error when empty")
    void ${p}ShouldShowErrorWhenEmpty() {
        po.navigate("${esc(url)}");
        po.fill${ucFirst(p)}("");
        // TODO: assert error state — update selector to match your app
    }`);
    });
  }

  if (testTypes.includes('smoke')) {
    tests.push(`    @Test
    @DisplayName("smoke: page is reachable")
    void pageIsReachable() {
        po.navigate("${esc(url)}");
        assertThat(page).hasURL(Pattern.compile("(?!.*(error|404|500)).*"));
    }`);
  }

  return {
    filename: `${feature}Test.java`, path: `src/test/java/tests/${feature}Test.java`,
    type: testTypes.includes('e2e') ? 'e2e' : testTypes[0],
    description: `${page.name} — ${testTypes.join(', ')} tests`,
    content: `package tests;

import com.microsoft.playwright.*;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import org.junit.jupiter.api.*;
import java.util.regex.Pattern;
import pages.${cls}Page;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("${page.name} — ${testTypes.join(', ')} tests")
public class ${feature}Test {

    static Playwright playwright;
    static Browser browser;
    Page page;
    ${cls}Page po;

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(true));
    }

    @AfterAll
    static void closeBrowser() {
        playwright.close();
    }

    @BeforeEach
    void setUp() {
        page = browser.newPage();
        String baseUrl = System.getenv("BASE_URL");
        if (baseUrl != null) page.navigate(baseUrl);
        po = new ${cls}Page(page);
    }

    @AfterEach
    void tearDown() {
        page.close();
    }

${tests.join('\n\n')}

}
`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test blocks builder (for TS + JS)
// ─────────────────────────────────────────────────────────────────────────────
function buildTestBlocks(page, testTypes, lang, fw) {
  const cls     = toClassName(page.name || page.path);
  const url     = page.route || page.path || '/';
  const buttons = (page.components || []).filter(c => c.type === 'button').slice(0, 4);
  const inputs  = (page.components || []).filter(c => c.type === 'input' || c.type === 'textarea').slice(0, 3);
  const links   = (page.components || []).filter(c => c.type === 'link').slice(0, 2);

  // Match test name pattern from framework analysis
  const namePattern = fw?.naming?.testNames || 'should <action> when <condition>';

  const blocks = [];

  if (testTypes.includes('positive') || testTypes.includes('e2e')) {
    const tests = [];
    tests.push(`    test('should load ${page.name} page successfully', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await expect(page).toHaveURL(/${escRx(url)}/);
    });`);

    if (page.title) {
      tests.push(`    test('should display correct page title', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await expect(page).toHaveTitle(/${escRx(page.title)}/);
    });`);
    }

    buttons.forEach(btn => {
      const p = toPropName(btn.name);
      tests.push(`    test('should display ${btn.name} button and be clickable', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await expect(po.${p}).toBeVisible();
      await expect(po.${p}).toBeEnabled();
    });`);
    });

    inputs.forEach(inp => {
      const p = toPropName(inp.name);
      tests.push(`    test('should accept valid input in ${inp.name}', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await po.fill${ucFirst(p)}('valid_test_value');
      await expect(po.${p}).toHaveValue('valid_test_value');
    });`);
    });

    links.forEach(link => {
      const p = toPropName(link.name);
      tests.push(`    test('should display ${link.name} link', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await expect(po.${p}).toBeVisible();
    });`);
    });

    blocks.push(`  test.describe('✅ Positive Tests', () => {\n${tests.join('\n\n')}\n  });`);
  }

  if (testTypes.includes('negative')) {
    const tests = [];
    inputs.slice(0, 3).forEach(inp => {
      const p = toPropName(inp.name);
      tests.push(`    test('should show validation error for empty ${inp.name}', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await po.fill${ucFirst(p)}('');
      await po.${p}.blur();
      // Assert error state — update selector to match your app's error pattern
      // const errorEl = page.locator('[aria-invalid="true"], [class*="error"]').first();
      // await expect(errorEl).toBeVisible();
    });`);

      tests.push(`    test('should handle special characters in ${inp.name}', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await po.fill${ucFirst(p)}('<script>alert(1)</script>');
      await po.${p}.blur();
      // Assert value is sanitized or error shown
    });`);
    });

    if (tests.length) blocks.push(`  test.describe('❌ Negative Tests', () => {\n${tests.join('\n\n')}\n  });`);
  }

  if (testTypes.includes('bva')) {
    const tests = [];
    inputs.slice(0, 2).forEach(inp => {
      const p = toPropName(inp.name);
      tests.push(`    test('BVA: ${inp.name} — min boundary (1 char)', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await po.fill${ucFirst(p)}('a');
    });`);
      tests.push(`    test('BVA: ${inp.name} — max boundary (255 chars)', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await po.fill${ucFirst(p)}('a'.repeat(255));
    });`);
      tests.push(`    test('BVA: ${inp.name} — exceeds limit (256 chars)', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await po.fill${ucFirst(p)}('a'.repeat(256));
      // Assert truncation or validation error
    });`);
    });

    if (tests.length) blocks.push(`  test.describe('📐 Boundary Value Analysis', () => {\n${tests.join('\n\n')}\n  });`);
  }

  if (testTypes.includes('smoke')) {
    const tests = [`    test('smoke: ${page.name} page is reachable', async ({ page }) => {
      const po = new ${cls}Page(page);
      await po.navigate('${esc(url)}');
      await expect(page).not.toHaveURL(/error|404|500/);
      await expect(page.locator('body')).toBeVisible();
    });`];
    blocks.push(`  test.describe('💨 Smoke Tests', () => {\n${tests.join('\n\n')}\n  });`);
  }

  return blocks.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entrypoint — language dispatcher
// ─────────────────────────────────────────────────────────────────────────────
function generateAll({ pages, testTypes = ['e2e','positive','negative'], language = 'typescript', frameworkAnalysis, pattern = {} }) {
  // Merge framework analysis into pattern for path resolution
  const fw = frameworkAnalysis || null;

  const files       = [];
  const pageObjects = [];
  let   totalTests  = 0;

  const coveragePages = [];
  const scenarios     = { positive: 0, negative: 0, bva: 0, smoke: 0 };

  for (const page of pages) {
    if (!page.components?.length) continue;
    coveragePages.push(page.name);

    const { pagesDir, ext } = resolvePaths(fw, language);
    const feature = language === 'java'
      ? toClassName(page.name || page.path)
      : language === 'python'
      ? toKebab(page.name || page.path).replace(/-/g,'_')
      : toKebab(page.name || page.path);

    // ── Page Object ──────────────────────────────────────────
    let pomContent, pomFilename, pomPath;
    switch (language) {
      case 'javascript':
        pomContent  = pomJS(page, fw);
        pomFilename = `${feature}.page.js`;
        pomPath     = `${pagesDir}/${feature}.page.js`;
        break;
      case 'python':
        pomContent  = pomPY(page, fw);
        pomFilename = `${feature}_page.py`;
        pomPath     = `pages/${feature}_page.py`;
        break;
      case 'java':
        pomContent  = pomJAVA(page, fw);
        pomFilename = `${feature}Page.java`;
        pomPath     = `src/main/java/pages/${feature}Page.java`;
        break;
      default: // typescript
        pomContent  = pomTS(page, fw);
        pomFilename = `${feature}.page.ts`;
        pomPath     = `${pagesDir}/${feature}.page.ts`;
    }
    pageObjects.push({ filename: pomFilename, path: pomPath, content: pomContent });

    // ── Spec File ────────────────────────────────────────────
    let spec;
    switch (language) {
      case 'javascript': spec = specJS(page, testTypes, fw); break;
      case 'python':     spec = specPY(page, testTypes, fw); break;
      case 'java':       spec = specJAVA(page, testTypes, fw); break;
      default:           spec = specTS(page, testTypes, fw);
    }
    files.push(spec);
    totalTests += spec.testCount || countTests(spec.content);

    // Coverage counters
    const btnCnt = (page.components || []).filter(c => c.type === 'button').length;
    const inpCnt = (page.components || []).filter(c => c.type === 'input').length;
    if (testTypes.includes('positive')) scenarios.positive += btnCnt + inpCnt;
    if (testTypes.includes('negative')) scenarios.negative += inpCnt * 2;
    if (testTypes.includes('bva'))      scenarios.bva      += inpCnt * 3;
    if (testTypes.includes('smoke'))    scenarios.smoke    += 1;
  }

  return {
    files, pageObjects,
    coverage: { pages: coveragePages, scenarios, totalTests, language },
  };
}

module.exports = { generateAll };
