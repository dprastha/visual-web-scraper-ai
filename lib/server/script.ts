import Ajv from 'ajv';

import type { ScriptRequestBody, ScrapingStrategy, SelectedElementInfo, SelectorCandidate } from '@/lib/types';

const ajv = new Ajv({ allErrors: true });

const strategySchema = {
	type: 'object',
	properties: {
		intent: { type: 'string' },
		collectionType: { enum: ['single', 'list'] },
		primarySelector: {
			type: 'object',
			properties: {
				type: { enum: ['css', 'xpath'] },
				value: { type: 'string' },
				confidence: { type: 'number' },
				reason: { type: 'string' },
			},
			required: ['type', 'value', 'reason'],
		},
		fallbackSelectors: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					type: { enum: ['css', 'xpath'] },
					value: { type: 'string' },
					confidence: { type: 'number' },
					reason: { type: 'string' },
				},
				required: ['type', 'value', 'reason'],
			},
		},
		extract: {
			type: 'object',
			properties: {
				attribute: { type: 'string' },
				target: { enum: ['text', 'attribute', 'html'] },
				transform: {
					type: 'array',
					items: { type: 'string' },
				},
			},
			required: ['attribute', 'target'],
		},
		waitFor: {
			type: 'object',
			properties: {
				type: { enum: ['selector', 'timeout'] },
				value: { type: 'string' },
				timeoutMs: { type: 'number' },
			},
			required: ['type', 'timeoutMs'],
		},
	},
	required: ['intent', 'collectionType', 'primarySelector', 'extract', 'waitFor'],
};

const validateStrategySchema = ajv.compile<ScrapingStrategy>(strategySchema);

const OPENAI_COMPATIBLE_BASE_URL = process.env.OPENAI_COMPATIBLE_BASE_URL ?? 'http://127.0.0.1:1234';
const OPENAI_COMPATIBLE_API_KEY = process.env.OPENAI_COMPATIBLE_API_KEY;
const STRATEGY_MODEL = 'mistralai/ministral-3-3b';

function cleanJsonResponse(rawContent: string) {
	return rawContent
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
}

function escapeForDoubleQuotes(value: string) {
	return value.replace(/(["\\])/g, '\\$1');
}

function buildSelectorCandidates(element: SelectedElementInfo): SelectorCandidate[] {
	const candidates: SelectorCandidate[] = [];

	if (element.cssSelector) {
		candidates.push({
			type: 'css',
			value: element.cssSelector,
			source: 'clicked-element',
		});
	}

	if (element.xpath) {
		candidates.push({
			type: 'xpath',
			value: element.xpath,
			source: 'clicked-element',
		});
	}

	return candidates;
}

function fallbackStrategy(payload: ScriptRequestBody): ScrapingStrategy {
	const candidates = buildSelectorCandidates(payload.clickedElement);
	const primarySelector =
		candidates[0] ??
		(() => {
			throw new Error('No selector available for the selected element');
		})();

	const attributes = payload.clickedElement.attributes ?? {};
	const attribute = attributes.href ? 'href' : attributes.src ? 'src' : attributes.content ? 'content' : attributes.value ? 'value' : 'text';

	return {
		intent: `Extract data from the selected ${payload.clickedElement.tag ?? 'element'}`,
		collectionType: 'single',
		primarySelector: {
			...primarySelector,
			confidence: 0.55,
			reason: 'Fallback strategy derived directly from the clicked selector candidate.',
		},
		fallbackSelectors: candidates.slice(1).map((candidate) => ({
			...candidate,
			confidence: 0.35,
			reason: 'Secondary selector captured from the clicked element.',
		})),
		extract: {
			attribute,
			target: attribute === 'text' ? 'text' : 'attribute',
			transform: attribute === 'text' ? ['trim'] : [],
		},
		waitFor: {
			type: 'selector',
			value: primarySelector.value,
			timeoutMs: 10000,
		},
	};
}

export function validateStrategy(strategy: unknown) {
	const valid = validateStrategySchema(strategy);

	return {
		valid,
		errors: validateStrategySchema.errors ?? [],
	};
}

export async function generateStrategyWithLLM(payload: ScriptRequestBody): Promise<ScrapingStrategy> {
	const selectorCandidates = buildSelectorCandidates(payload.clickedElement);

	if (selectorCandidates.length === 0) {
		throw new Error('No selector candidates were captured from the selected element');
	}

	const systemMessage = `
You are a scraping strategy assistant.
Return exactly one JSON object and nothing else.
Do not generate code.
You must choose selectors and extraction metadata only.

Schema:
- intent: string
- collectionType: "single" | "list"
- primarySelector: { type: "css" | "xpath", value: string, confidence: number, reason: string }
- fallbackSelectors: [{ type: "css" | "xpath", value: string, confidence: number, reason: string }]
- extract: { attribute: string, target: "text" | "attribute" | "html", transform: string[] }
- waitFor: { type: "selector" | "timeout", value?: string, timeoutMs: number }
  `.trim();

	const userMessage = `
Generate a robust scraping strategy for the selected element.

URL: ${payload.url}
Clicked element:
${JSON.stringify(payload.clickedElement, null, 2)}

Selector candidates:
${JSON.stringify(selectorCandidates, null, 2)}

Rules:
1. Prefer css selectors when they look stable.
2. Avoid brittle selectors when possible, but only use values from the candidates provided.
3. Infer whether the extraction should be "single" or "list".
4. Infer the best extraction target and attribute.
5. Use waitFor.type="selector" when possible.
6. Return JSON only.
  `.trim();

	const response = await fetch(`${OPENAI_COMPATIBLE_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(OPENAI_COMPATIBLE_API_KEY ? { Authorization: `Bearer ${OPENAI_COMPATIBLE_API_KEY}` } : {}),
		},
		body: JSON.stringify({
			model: STRATEGY_MODEL,
			temperature: 0,
			response_format: {
				type: 'json_object',
			},
			messages: [
				{ role: 'system', content: systemMessage },
				{ role: 'user', content: userMessage },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`LLM error: ${await response.text()}`);
	}

	const data = (await response.json()) as {
		choices?: Array<{
			message?: {
				content?: string;
			};
		}>;
	};

	const content = data.choices?.[0]?.message?.content ?? '';
	const cleaned = cleanJsonResponse(content);

	try {
		return JSON.parse(cleaned) as ScrapingStrategy;
	} catch (error) {
		throw new Error(`LLM returned invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}\nContent:\n${content}`);
	}
}

function buildExtractionExpression(strategy: ScrapingStrategy) {
	if (strategy.extract.target === 'html') {
		return 'return node.innerHTML;';
	}

	if (strategy.extract.target === 'text' || strategy.extract.attribute === 'text') {
		return "return (node.innerText || '').trim();";
	}

	return `return node.getAttribute(${JSON.stringify(strategy.extract.attribute)});`;
}

export function generatePuppeteerScriptFromStrategy({ url, strategy }: { url: string; strategy: ScrapingStrategy }) {
	const selector = strategy.primarySelector.value;
	const selectorType = strategy.primarySelector.type;
	const isList = strategy.collectionType === 'list';
	const waitForValue = strategy.waitFor.value || selector;
	const waitTimeout = strategy.waitFor.timeoutMs || 10000;
	const extractionExpression = buildExtractionExpression(strategy);

	const extractionSnippet =
		selectorType === 'css'
			? isList
				? `
    const elements = await page.$$("${escapeForDoubleQuotes(selector)}");
    const data = await Promise.all(
      elements.map((element) =>
        page.evaluate((node) => {
          ${extractionExpression}
        }, element),
      ),
    );`
				: `
    const element = await page.$("${escapeForDoubleQuotes(selector)}");
    const data = element
      ? await page.evaluate((node) => {
          ${extractionExpression}
        }, element)
      : null;`
			: isList
				? `
    const elements = await page.$x(${JSON.stringify(selector)});
    const data = [];
    for (const element of elements) {
      data.push(
        await page.evaluate((node) => {
          ${extractionExpression}
        }, element),
      );
    }`
				: `
    const elements = await page.$x(${JSON.stringify(selector)});
    const data = elements.length
      ? await page.evaluate((node) => {
          ${extractionExpression}
        }, elements[0])
      : null;`;

	const fallbackSelectors = strategy.fallbackSelectors.map((candidate) => `${candidate.type}:${candidate.value}`).join(', ');
	const waitSnippet =
		strategy.waitFor.type === 'selector'
			? strategy.primarySelector.type === 'xpath' || waitForValue.startsWith('/')
				? `await page.waitForFunction(
      (selector) =>
        Boolean(
          document.evaluate(
            selector,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
          ).singleNodeValue,
        ),
      { timeout: ${waitTimeout} },
      ${JSON.stringify(waitForValue)},
    );`
				: `await page.waitForSelector(${JSON.stringify(waitForValue)}, { timeout: ${waitTimeout} });`
			: `await new Promise((resolve) => setTimeout(resolve, ${waitTimeout}));`;

	return `
// Auto-generated Puppeteer scraper
// Source URL: ${url}
// Strategy model: ${STRATEGY_MODEL}
// Generated at: ${new Date().toISOString()}

const fs = require("fs");
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle2" });

    try {
      ${waitSnippet}
    } catch (error) {
      console.warn("Primary wait strategy failed, continuing.");
    }

    ${extractionSnippet}

    fs.writeFileSync(
      "result.json",
      JSON.stringify(
        {
          url: ${JSON.stringify(url)},
          strategy: {
            intent: ${JSON.stringify(strategy.intent)},
            collectionType: ${JSON.stringify(strategy.collectionType)},
            primarySelector: ${JSON.stringify(strategy.primarySelector)},
            fallbackSelectors: ${JSON.stringify(strategy.fallbackSelectors)},
            extract: ${JSON.stringify(strategy.extract)},
            waitFor: ${JSON.stringify(strategy.waitFor)},
          },
          data,
        },
        null,
        2,
      ),
    );

    console.log("Wrote result.json");
    console.log("Fallback selectors:", ${JSON.stringify(fallbackSelectors)});
    console.log(data);
  } catch (error) {
    console.error("Scrape error", error);
  } finally {
    await browser.close();
  }
})();
  `.trimStart();
}

export async function buildStrategyAndScript(payload: ScriptRequestBody) {
	let strategy: ScrapingStrategy;
	let strategySource: 'llm' | 'fallback' = 'llm';

	try {
		strategy = await generateStrategyWithLLM(payload);
		const validation = validateStrategy(strategy);

		if (!validation.valid) {
			throw new Error(`Strategy validation failed: ${JSON.stringify(validation.errors)}`);
		}
	} catch (error) {
		strategy = fallbackStrategy(payload);
		strategySource = 'fallback';
	}

	return {
		strategy,
		strategySource,
		script: generatePuppeteerScriptFromStrategy({
			url: payload.url,
			strategy,
		}),
		model: STRATEGY_MODEL,
	};
}
