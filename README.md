# ESF Automation Agent v2.0
## Playwright Browser Agent — Multi-language E2E Test Generator

A tool that uses a real **Playwright browser** to crawl your live application, discover UI elements using configurable locator patterns, and generate production-ready test cases in **TypeScript, JavaScript, Python, or Java** — following the design patterns of your existing automation framework.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ESF Agent UI                             │
│  Config → Analyze → Canvas → Generate → History                 │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP API (localhost:3001)
         ┌───────────────┴──────────────────────────┐
         │             Express Server               │
         │                                          │
         │  /api/agent/analyze-framework  ──────►  framework.analyzer.js
         │  /api/agent/crawl              ──────►  playwright.agent.js
         │  /api/agent/generate           ──────►  testgen.service.js
         │  /api/claude/*                 ──────►  claude.service.js (optional AI)
         └──────────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Install dependencies
npm run setup

# 2. Install Playwright's Chromium browser (one-time)
npm run install:browsers

# 3. Copy and configure environment (API key optional)
cp .env.example .env

# 4. Start the application
npm start
# Server: http://localhost:3001
# Client: http://localhost:3002
```

---

## Configuration Guide

### Panel 1 — 🏗 Automation Framework Repo  
**Purpose:** Reads your *existing* Playwright automation framework to understand its design patterns, then generates all new test cases following the *exact same* style.

**What the agent extracts:**
| Pattern | Example |
|---|---|
| Folder structure | `pages/`, `tests/e2e/`, `fixtures/` |
| Naming conventions | `LoginPage.page.ts`, `login.spec.ts` |
| POM class style | `class LoginPage` with typed `Locator` fields |
| Import style | `import { Page } from '@playwright/test'` vs `require(...)` |
| Fixture usage | `test.extend<{...}>({...})` pattern |
| Test structure | `test.describe / test / test.beforeEach` nesting |

**Sources supported:** GitHub URL, Azure DevOps URL, Local folder picker, Paste code

> **Enable this panel** → agent reads framework first → all generated files match your conventions.

---

### Panel 2 — 🎭 UI / Frontend Repository (Browser Agent)
**Purpose:** Playwright opens a real **Chromium browser**, navigates your live application, and discovers every interactive element.

**Settings:**
- **App Base URL** — the running application URL (e.g. `http://localhost:4200`)
- **Pages to Crawl** — add specific routes, or enable **Auto-discover** to follow links
- **Browser Mode** — Headless (fast, default) or Headed (visible, for debugging)
- **HTTP Basic Auth** — optional credentials for protected apps

**What it discovers:** buttons, inputs, dropdowns, links, checkboxes, radios, tables, forms, modals, nav elements

---

### Panel 3 — 🗄 Backend / DB Repository
**Purpose:** Extracts database queries from your backend source and maps them to UI actions for end-to-end validation assertions.

**DB Platforms:** MS SQL Server, PostgreSQL, MySQL, Oracle

---

### Panel 4 — 🎯 Locator Patterns
**Purpose:** Define per-element-type **XPath/CSS pattern templates**. The agent uses these when generating locators — ensuring they match your team's standards.

**Placeholder syntax:**

| Placeholder | Replaced with |
|---|---|
| `{text}` | Visible text of the element |
| `{id}` | `id` attribute value |
| `{name}` | `name` attribute value |
| `{placeholder}` | `placeholder` attribute value |
| `{aria-label}` | `aria-label` attribute value |
| `{value}` | `value` attribute |
| `{class}` | `class` attribute |

**Example patterns:**
```
Button (text)      → //button[normalize-space()='{text}']
Input (placeholder)→ //input[@placeholder='{placeholder}']
Link               → //a[normalize-space()='{text}']
data-testid        → [data-testid='{value}']
```

You can **add custom patterns** for your application's specific attributes (e.g. `data-automation`, `data-e2e`).

The **Agent Discovery Priority** section controls the fallback chain when no custom pattern matches — reorder with ↑↓ and toggle ON/OFF.

---

## Language Support

Select your target language in the **Config** tab. Generated code matches Playwright's idiomatic style per language:

### TypeScript (default)
```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';

test.describe('Login — E2E Test Suite', () => {
  test('should load login page successfully', async ({ page }) => {
    const po = new LoginPage(page);
    await po.navigate('/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

### JavaScript
```javascript
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/login.page');

test.describe('Login — E2E Test Suite', () => {
  test('should display login button', async ({ page }) => {
    const po = new LoginPage(page);
    await po.navigate('/login');
    await expect(po.loginButton).toBeVisible();
  });
});
```

### Python
```python
import pytest
from playwright.sync_api import Page, expect
from pages.login_page import LoginPage

class TestLogin:
    def test_page_loads(self, page: Page) -> None:
        po = LoginPage(page)
        po.navigate('/login')
        expect(page).to_have_url(re.compile(r'/login'))
```

### Java
```java
@Test
@DisplayName("should load login page")
void shouldLoadPage() {
    po.navigate("/login");
    assertThat(page).hasURL(Pattern.compile("/login"));
}
```

---

## Agent Workflow Sequence

When you click **Initialize Agent** and then **Run Agents**:

```
Step 1 — 🏗 Framework Reader (if enabled)
  └─ Reads framework repo code
  └─ Extracts folder structure, naming, POM style, import style
  └─ Stores as analysis.framework → used by test generator

Step 2 — 🎭 Browser Crawler (if enabled)
  └─ Launches headless Chromium
  └─ Navigates to each configured page
  └─ Discovers all interactive elements
  └─ Applies custom locator patterns first, then fallback priority chain
  └─ Takes screenshots for review

Step 3 — 🗄 DB Analyzer (if enabled)
  └─ Reads backend source code
  └─ Extracts SQL/DB queries and maps to UI actions
  └─ Stores as analysis.dbQueries

Generate Phase
  └─ Combines: analysis.framework + analysis.pages + config.locatorPatterns + language
  └─ Generates Page Object Models (POM) per page
  └─ Generates spec files with: positive, negative, BVA, smoke, E2E tests
  └─ Saves directly to your local framework repo (if folder selected)
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agent/locator-defaults` | Default locator priority list |
| POST | `/api/agent/analyze-framework` | Extract design patterns from framework code |
| POST | `/api/agent/discover` | Auto-discover routes from base URL |
| POST | `/api/agent/crawl` | Playwright browser crawl + element discovery |
| POST | `/api/agent/generate` | Generate test files (template or AI) |
| POST | `/api/claude/analyze/ui` | Claude AI: extract UI components from source code |
| POST | `/api/claude/analyze/db` | Claude AI: extract DB queries |
| GET | `/health` | Server health + API key status |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Optional | Claude API key — only needed for AI-enhanced generation and framework analysis |
| `PORT` | No (default: 3001) | Server port |

> **Note:** The Playwright browser agent works entirely **without** an API key. The key is only needed when:
> - "Use AI (Claude) for richer test generation" is checked in Config
> - Framework analysis uses AI mode (falls back to static analysis if key is absent)

---

## Project Structure

```
ESF_AUTO_002/
├── server/
│   ├── index.js                          # Express app entry point
│   ├── routes/
│   │   ├── agent.route.js                # Playwright agent endpoints
│   │   ├── claude.route.js               # Claude AI endpoints
│   │   └── repo.route.js                 # GitHub / Azure DevOps / file upload
│   └── services/
│       ├── playwright.agent.js           # Browser crawler (Chromium)
│       ├── locator.engine.js             # Configurable locator strategy resolver
│       ├── framework.analyzer.js         # Extracts design patterns from existing PW framework
│       ├── testgen.service.js            # Multi-language test file generator
│       └── claude.service.js             # Anthropic API wrapper (optional)
├── client/src/
│   ├── components/
│   │   ├── ConfigTab/                    # Configuration + panel checkboxes
│   │   ├── AnalyzeTab/                   # Agent execution + results
│   │   ├── GenerateTab/                  # Test file preview + download
│   │   ├── CanvasTab/                    # Visual workflow editor
│   │   └── HistoryTab/                   # Generation snapshots
│   ├── constants.js                      # Language options, locator patterns, panel defaults
│   └── hooks/useAgent.js                 # Agent state management
├── .env.example
├── package.json
└── README.md
```
