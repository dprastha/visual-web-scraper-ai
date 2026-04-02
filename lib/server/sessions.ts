import puppeteer, { type Browser, type Page } from "puppeteer";
import { v4 as uuidv4 } from "uuid";

export const VIEWPORT = { width: 1200, height: 800 };

export interface BrowserSession {
  browser: Browser;
  page: Page;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __aiHtmlExtractorSessions__: Map<string, BrowserSession> | undefined;
}

const sessions =
  globalThis.__aiHtmlExtractorSessions__ ??
  new Map<string, BrowserSession>();

globalThis.__aiHtmlExtractorSessions__ = sessions;

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function createSessionId() {
  return uuidv4();
}

export function storeSession(sessionId: string, session: BrowserSession) {
  sessions.set(sessionId, session);
}

export function deleteSession(sessionId: string) {
  sessions.delete(sessionId);
}

export async function launchBrowserPage(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

  return { browser, page };
}

export async function closeSession(sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    return false;
  }

  try {
    await session.browser.close();
  } catch {
    // Ignore browser shutdown errors during cleanup.
  } finally {
    deleteSession(sessionId);
  }

  return true;
}
