/**
 * Framework Analyzer Service
 *
 * Reads an existing Playwright automation framework and extracts:
 *  - Folder structure  (pages/, tests/, fixtures/, helpers/)
 *  - Naming conventions (pageFile naming, testFile naming, locator style)
 *  - POM class style   (TypeScript class vs plain object vs fixture-based)
 *  - Import style      (ESM import vs require)
 *  - Test structure    (test.describe, beforeEach, etc.)
 *  - Fixture patterns
 *
 * All generated tests will follow these extracted patterns.
 */

const { chat, parseJSON } = require('./claude.service');

/**
 * Analyze an automation framework codebase and return a structured
 * design-pattern object that testgen.service.js uses to match conventions.
 *
 * @param {string} code - concatenated source files from the framework repo
 * @returns {Promise<FrameworkAnalysis>}
 */
async function analyzeFrameworkPatterns(code) {
  const system = `You are a senior Playwright automation architect.
Analyze the provided automation framework source code and extract its exact design patterns.
Return ONLY valid JSON — no markdown, no commentary.`;

  const prompt = `Analyze this Playwright framework source and extract its design patterns.

Return a JSON object with this exact shape:
{
  "structure": {
    "pages":    "relative path for page objects, e.g. pages/",
    "tests":    "relative path for spec files, e.g. tests/e2e/",
    "fixtures": "relative path or null",
    "helpers":  "relative path or null",
    "data":     "relative path for test data or null"
  },
  "naming": {
    "pageFiles":  "pattern e.g. <PageName>.page.ts",
    "testFiles":  "pattern e.g. <featureName>.spec.ts",
    "className":  "PascalCase or camelCase",
    "locators":   "camelCase or snake_case",
    "testNames":  "pattern e.g. should <action> when <condition>"
  },
  "pomStyle":      "class-based-typescript | class-based-javascript | fixture-based | plain-object",
  "importStyle":   "esm-import | commonjs-require",
  "testStructure": "describe-test | suite-test | plain-test",
  "fixtureUsage":  "none | page-fixtures | custom-fixtures | extended-test",
  "locatorStyle":  "getByRole | getByTestId | xpath | css | mixed",
  "baseUrlInConfig": true,
  "parallelEnabled": true,
  "retries": 0,
  "examplePageObject": "// paste a short representative POM snippet showing the exact style",
  "exampleTest":       "// paste a short representative test snippet showing the exact style",
  "insights": "2-3 sentence summary of the framework's design philosophy"
}

Framework source:
${code.slice(0, 8000)}`;

  try {
    const raw = await chat(system, prompt, 3000);
    return parseJSON(raw);
  } catch (err) {
    // Return sensible defaults so generation still works
    console.warn('[framework.analyzer] Claude analysis failed:', err.message);
    return {
      structure:     { pages: 'pages/', tests: 'tests/e2e/', fixtures: null, helpers: null, data: null },
      naming:        { pageFiles: '<PageName>.page.ts', testFiles: '<featureName>.spec.ts', className: 'PascalCase', locators: 'camelCase', testNames: 'should <action> when <condition>' },
      pomStyle:      'class-based-typescript',
      importStyle:   'esm-import',
      testStructure: 'describe-test',
      fixtureUsage:  'none',
      locatorStyle:  'mixed',
      baseUrlInConfig: true,
      parallelEnabled: true,
      retries:        2,
      examplePageObject: null,
      exampleTest:       null,
      insights: 'Framework analysis failed — using standard Playwright TypeScript POM pattern as default.',
    };
  }
}

/**
 * Static (no-LLM) quick analysis from source code heuristics.
 * Used as a fallback when Claude API is unavailable.
 */
function quickAnalyze(code) {
  const lines = code.toLowerCase();

  const isTS        = lines.includes('.ts') || lines.includes(': page') || lines.includes('readonly ');
  const hasFixtures = lines.includes('test.extend') || lines.includes('fixtures');
  const usesRequire = lines.includes("require('@playwright") || lines.includes("require('playwright");
  const usesImport  = lines.includes("from '@playwright") || lines.includes('from \'@playwright');

  const pagesMatch  = code.match(/(?:pages|pageObjects|po)['"\/]/i);
  const testsMatch  = code.match(/(?:tests|specs|e2e)['"\/]/i);

  return {
    structure: {
      pages: pagesMatch ? 'pages/' : 'src/pages/',
      tests: testsMatch ? 'tests/e2e/' : 'src/tests/',
      fixtures: hasFixtures ? 'fixtures/' : null,
      helpers: null, data: null,
    },
    naming: {
      pageFiles: isTS ? '<PageName>.page.ts' : '<PageName>.page.js',
      testFiles: isTS ? '<featureName>.spec.ts' : '<featureName>.spec.js',
      className: 'PascalCase', locators: 'camelCase',
      testNames: 'should <action> when <condition>',
    },
    pomStyle:      hasFixtures ? 'fixture-based' : isTS ? 'class-based-typescript' : 'class-based-javascript',
    importStyle:   usesRequire ? 'commonjs-require' : 'esm-import',
    testStructure: 'describe-test',
    fixtureUsage:  hasFixtures ? 'custom-fixtures' : 'none',
    locatorStyle:  'mixed',
    baseUrlInConfig: true, parallelEnabled: true, retries: 2,
    examplePageObject: null, exampleTest: null,
    insights: 'Quick static analysis (Claude unavailable) — patterns estimated from source heuristics.',
  };
}

module.exports = { analyzeFrameworkPatterns, quickAnalyze };
