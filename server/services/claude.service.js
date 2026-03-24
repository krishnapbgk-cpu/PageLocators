const Anthropic = require('@anthropic-ai/sdk');
const { saveQA, getAllQA } = require('./chatHistoryservice');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-20250514';

/**
 * Core wrapper — always returns the text content of the first block.
 */
async function chat(systemPrompt, userPrompt, maxTokens = 4000) {
 
  const previousQA = await getAllQA();
  const historyText = previousQA?.length
    ? previousQA
        .map(qa => `User: ${qa.question}\nClaudeAnswer: ${qa.answer}`)
        .join('\n\n')
    : '';
  const messages = [];

  // Add history as context (if exists)
  if (historyText) {
    messages.push({
      role: 'user',
      content: `Here is the conversation history:\n\n${historyText}`
    });
  }

  // Add current user question
  messages.push({
    role: 'user',
    content: userPrompt
  });

  // 4. Call model
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages,
  });

  const answer = message.content[0]?.text ?? '';

  // 5. Save new Q&A
  await saveQA(userPrompt, answer);

  return answer;
}

/**
 * Helper: extract JSON from a Claude response that may contain fences.
 */
function parseJSON(raw) {
  const clean = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ── Analysis Calls ────────────────────────────────────────

async function analyzeFramework(code) {
  const system = `You are a Playwright automation architect with 15 years of experience.
Analyze the given framework source code. Return ONLY valid JSON — no markdown, no commentary.`;

  const prompt = `Analyze this Playwright framework. Return:
{
  "patterns": ["string"],
  "conventions": { "naming": "string", "structure": "string", "locators": "string" },
  "config": { "baseURL": "string", "timeout": 30000, "parallel": true, "retries": 2 },
  "testStructure": "string",
  "fixtureUsage": "string",
  "insights": "string"
}

Source:\n${code.slice(0, 6000)}`;

  const raw = await chat(system, prompt);
  return parseJSON(raw);
}

async function extractUIComponents(code) {
  const system = `You are a UI test automation specialist with 20 years of experience with hands on experience in Playwright, Javascript and identification of testable UI components and their locator strategies.
Extract all testable UI components and their best locator which is present in the component attributes. Strictly identify the locator based on the implemented attributes in the code. Do not create locators based on assumptions and prefer the attributes in the code.
Return ONLY valid JSON — no markdown, no commentary.`;

  const prompt = `Extract all UI elements from this frontend code fetch all tags and types of button, input, table, dropdown, Hidden Dropdown, links, forms, checkbox, radio buttons, labels, headings, text, canvas, modal, nav, card. Get exact and unique locators for each element.
  for buttons wirte xpath by using //tag[@class="class-name"]//button[@type="button" and normalize-space()="button text"].
  for input fields write xpath by using //tag[@class="class-name"]//input[@type="text" or @id="input-id"].
  Identify the best locator strategy based on the attributes present in the code. Do not create locators based on assumptions and prefer the attributes in the code. If there are no attributes to create a locator, then write "locator": "no unique attributes found" and "locatorType": "none".
  Rules for locator strategy:
  1. If there is an id attribute, use it as a CSS selector (#id).
  2. If there is a unique class attribute, use it as a CSS selector (.class).
  3. If there are unique data-* attributes, use them as CSS selectors ([data-attr="value"]).
  4. For buttons, if there is visible text, use an XPath selector based on the text.for example for Delete button locator would be //button[@aria-label='Delete']/span[normalize-space()='Delete'].
  5. For inputs, use an XPath selector based on the text.for example for Search input locator would be //input[@placeholder="Search Patients"].
  6. Identify elements with text in UI to validate data. for example for Visits count locator would be //p[normalize-space()='Visits']/following-sibling::p/span[@class='total-count'].
  7. For Headings, use the text content.for example for Add Patient header locator would be //div[@data-pc-section='header']/div[normalize-space()='Add Patient'].
  8. For Labels, use an XPath selector based on the text.for example for first name label locator would be //label[@for='First Name']. 
  9.List of elements: Buttons (tagName="button"), Input fields (tagName="input"), Dropdowns (tagName="select"), Links(tagName="a","link"), Forms(tagName="form"), Checkbox(tagName="input" and type="checkbox"), Radio buttons(tagName="input" and type="radio"), Labels(tagName="label"), Text elements(p, span, div with text)
  use https://web-dev-mcms-frontend-01.azurewebsites.net/patients page as reference for identifying the elements and writing the locators. Use agentInsights key to provide feedback on locator quality and suggestions for improvement.
  Use agentInsights key to provide feedback on locator quality and suggestions for improvement. Analyize the code and then convert it into JSON format with the following structure. add "UniqueKrishnaJson" string before JSON response Strictly return JSON as follows:
{
  "pages": [{
    "name": "string",
    "path": "string",
    "route": "string",
    "components": [{
      "name": "string",
      "type": "button|input|table|dropdown|link|form|modal|nav|card|checkbox|radio|canvas|label",
      "locator": "string",
      "locatorType": "css|xpath|role|text|label",
      "actions": ["fill","click","select","check","hover","getText","isVisible"],
      "required": true,
      "notes": "string"
    }]
  }]
  agentInsights: "string"
}

Source:\n${code}`;
  console.log('Raw Analysis Start:');
  const raw = await chat(system, prompt);
  console.log('Raw Analysis Result:', raw);
  const arr = raw.split('UniqueKrishnaJson');
  if(arr.length > 0) {
    return parseJSON(arr[1]);
  }else {
  return parseJSON(raw);
  }
}

async function extractDBQueries(code) {
  const system = `You are a database testing specialist.
Extract all DB operations and map them to UI actions for validation.
Return ONLY valid JSON — no markdown, no commentary.`;

  const prompt = `Extract all DB queries and operations from this backend code. Return:
{
  "queries": [{
    "operation": "CREATE|READ|UPDATE|DELETE",
    "table": "string",
    "query": "string",
    "relatedUIAction": "string",
    "validationQuery": "string",
    "params": ["string"],
    "expectedResult": "string"
  }]
}

Source:\n${code.slice(0, 6000)}`;

  const raw = await chat(system, prompt);
  console.log('Raw Analysis Result:', raw);
  return parseJSON(raw);
}

async function generateTests({ pages, dbQueries, pattern, testTypes, mode, prsContent, snapshotCoverage, workflows }) {
  const system = `You are a world-class Playwright test automation engineer.
Generate production-ready, fully-implemented Playwright TypeScript test files.
Follow the framework pattern exactly. Every test must be complete and runnable.
Return ONLY valid JSON — no markdown, no commentary.`;

  const isFirstRun = mode === 'first';

  const prompt = `Generate Playwright E2E test files.

## Mode
${isFirstRun ? 'FIRST RUN — full suite covering all pages and scenarios' : 'INCREMENTAL — generate only for new/changed features described in PRS'}
${!isFirstRun && prsContent ? `\n## PRS / Feature Changes\n${prsContent.slice(0, 1500)}` : ''}
${snapshotCoverage ? `\n## Already covered (skip these):\n${JSON.stringify(snapshotCoverage, null, 2).slice(0, 600)}` : ''}

## Framework Pattern
${(pattern || '').slice(0, 1000)}

## Test Types to Generate
${testTypes.join(', ')} — Include Positive, Negative, Boundary Value Analysis

## Pages & Components
${JSON.stringify(pages.slice(0, 3), null, 2).slice(0, 2000)}

## DB Validation Queries
${JSON.stringify(dbQueries.slice(0, 4), null, 2).slice(0, 1000)}

## Canvas Workflows
${JSON.stringify((workflows || []).slice(0, 6), null, 2).slice(0, 500)}

## Output Format
{
  "files": [{
    "path": "tests/e2e/<feature>.spec.ts",
    "filename": "<feature>.spec.ts",
    "type": "e2e|smoke|regression|bvt",
    "description": "string",
    "testCount": 5,
    "content": "import { test, expect } from '@playwright/test';\n// FULL file content..."
  }],
  "coverage": {
    "pages": ["string"],
    "scenarios": { "positive": 5, "negative": 3, "bva": 2 },
    "totalTests": 10,
    "dbValidations": 3
  },
  "pageObjects": [{
    "filename": "<Name>.page.ts",
    "path": "pages/<Name>.page.ts",
    "content": "// full POM class..."
  }]
}`;

  const raw = await chat(system, prompt, 4000);
  return parseJSON(raw);
}

module.exports = { analyzeFramework, extractUIComponents, extractDBQueries, generateTests, chat };
