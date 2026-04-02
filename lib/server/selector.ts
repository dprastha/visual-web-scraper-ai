import type { Page } from "puppeteer";

export async function installHoverHighlight(page: Page) {
  await page.evaluate(() => {
    if ((window as typeof window & { __HOVER_INSTALLED__?: boolean }).__HOVER_INSTALLED__) {
      return;
    }

    (window as typeof window & { __HOVER_INSTALLED__?: boolean }).__HOVER_INSTALLED__ = true;

    const style = document.createElement("style");
    style.innerHTML = `
      .__hover_target__ {
        outline: 2px solid #ff5e3a !important;
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);

    let lastEl: Element | null = null;

    document.addEventListener(
      "mousemove",
      (event) => {
        try {
          if (lastEl) {
            lastEl.classList.remove("__hover_target__");
          }

          const element = document.elementFromPoint(event.clientX, event.clientY);
          if (element) {
            element.classList.add("__hover_target__");
            lastEl = element;
          }
        } catch {
          // Ignore transient DOM errors while hovering.
        }
      },
      true,
    );
  });
}

function getSelectionInfoExpression(x: number, y: number) {
  return `
    (() => {
      function getCssSelector(el) {
        if (!el || el.nodeType !== 1) return null;
        if (el.id) return '#' + el.id;
        if (el === document.body) return 'body';
        const parts = [];
        while (el && el.nodeType === 1 && el !== document.body) {
          let selector = el.tagName.toLowerCase();
          if (typeof el.className === 'string') {
            const classes = el.className.split(/\\s+/).filter(Boolean).slice(0, 2);
            if (classes.length) selector += '.' + classes.join('.');
          }
          const siblings = Array.from(el.parentNode ? el.parentNode.children : []);
          const index = siblings.indexOf(el) + 1;
          selector += ':nth-child(' + index + ')';
          parts.unshift(selector);
          el = el.parentNode;
        }
        return parts.join(' > ');
      }

      function getXPath(el) {
        if (!el) return null;
        if (el.id) return '//*[@id="' + el.id + '"]';
        if (el === document.body) return '/html/body';
        const parts = [];
        while (el && el.nodeType === 1) {
          let index = 1;
          let sibling = el.previousSibling;
          while (sibling) {
            if (sibling.nodeType === 1 && sibling.nodeName === el.nodeName) index++;
            sibling = sibling.previousSibling;
          }
          parts.unshift(el.nodeName.toLowerCase() + '[' + index + ']');
          el = el.parentNode;
        }
        return '/' + parts.join('/');
      }

      const el = document.elementFromPoint(${x}, ${y});
      if (!el) return { message: 'no element at point' };

      const attributes = Array.from(el.attributes || []).reduce((acc, attribute) => {
        acc[attribute.name] = attribute.value;
        return acc;
      }, {});

      return {
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || '').trim().slice(0, 1000),
        cssSelector: getCssSelector(el),
        xpath: getXPath(el),
        attributes
      };
    })()
  `;
}

export async function getElementInfoAtPoint(page: Page, x: number, y: number) {
  return page.evaluate(getSelectionInfoExpression(x, y)) as Promise<{
    tag?: string;
    text?: string;
    cssSelector?: string | null;
    xpath?: string | null;
    attributes?: Record<string, string>;
    message?: string;
  }>;
}
