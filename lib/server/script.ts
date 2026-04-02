import type { SelectedElementInfo } from "@/lib/types";

function escapeForDoubleQuotes(value: string) {
  return value.replace(/(["\\])/g, "\\$1");
}

function inferAttribute(element: SelectedElementInfo) {
  const attributes = element.attributes ?? {};

  if (attributes.href) return "href";
  if (attributes.src) return "src";
  if (attributes.content) return "content";
  if (attributes.value) return "value";

  return "text";
}

function resolveSelector(element: SelectedElementInfo) {
  if (element.cssSelector) {
    return { selectorType: "css" as const, selector: element.cssSelector };
  }

  if (element.xpath) {
    return { selectorType: "xpath" as const, selector: element.xpath };
  }

  throw new Error("No selector available for the selected element");
}

export function generatePuppeteerScriptFromSelection({
  url,
  element,
}: {
  url: string;
  element: SelectedElementInfo;
}) {
  const { selectorType, selector } = resolveSelector(element);
  const attribute = inferAttribute(element);

  const extractionSnippet =
    selectorType === "css"
      ? `
    const element = await page.$("${escapeForDoubleQuotes(selector)}");
    const data = element
      ? await page.evaluate((node) => {
          ${
            attribute === "text"
              ? "return (node.innerText || '').trim();"
              : `return node.getAttribute(${JSON.stringify(attribute)});`
          }
        }, element)
      : null;`
      : `
    const nodes = await page.$x(${JSON.stringify(selector)});
    const data = nodes.length
      ? await page.evaluate((node) => {
          ${
            attribute === "text"
              ? "return (node.innerText || '').trim();"
              : `return node.getAttribute(${JSON.stringify(attribute)});`
          }
        }, nodes[0])
      : null;`;

  return `
// Auto-generated Puppeteer scraper
// Source URL: ${url}
// Generated at: ${new Date().toISOString()}

const fs = require("fs");
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle2" });

    ${extractionSnippet}

    fs.writeFileSync(
      "result.json",
      JSON.stringify(
        {
          url: ${JSON.stringify(url)},
          selectorType: ${JSON.stringify(selectorType)},
          selector: ${JSON.stringify(selector)},
          attribute: ${JSON.stringify(attribute)},
          data,
        },
        null,
        2,
      ),
    );

    console.log("Wrote result.json");
    console.log(data);
  } catch (error) {
    console.error("Scrape error", error);
  } finally {
    await browser.close();
  }
})();
  `.trimStart();
}
