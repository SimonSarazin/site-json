import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getBaseUrl } from "../helpers/server-manager";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const configPath = path.resolve(PROJECT_ROOT, process.env.SITE_CONFIG_PATH || "./config.prod.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
  pages: Array<{ path: string }>;
};

/**
 * Fetch with a timeout covering both headers and body reading.
 * Uses Promise.race for reliable timeout on hung streams.
 */
async function fetchPage(
  url: string,
  timeoutMs = 20_000
): Promise<{ status: number; headers: Headers; html: string }> {
  const controller = new AbortController();

  const doFetch = async () => {
    const res = await fetch(url, { signal: controller.signal });
    const html = await res.text();
    return { status: res.status, headers: res.headers, html };
  };

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error(`fetchPage timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([doFetch(), timeout]);
}

/**
 * Retry a fetch up to `retries` times. Useful for the first SSR request
 * which may fail due to server warmup.
 */
async function fetchPageWithRetry(
  url: string,
  retries = 3,
  timeoutMs = 20_000
): Promise<{ status: number; headers: Headers; html: string }> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchPage(url, timeoutMs);
    } catch (err) {
      lastError = err;
      // Wait a bit before retrying
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastError;
}

describe("SSR Rendering (Level 2)", () => {
  // ——————————————————————————————————————————
  // / (Home)
  // ——————————————————————————————————————————
  describe("/ (Home)", () => {
    it("returns status 200 with title, SSR content, globals, and viewport", async () => {
      // First request may fail during server warmup, retry
      const { status, html } = await fetchPageWithRetry(getBaseUrl());
      expect(status).toBe(200);

      // Contains <title> (Helmet)
      expect(html).toMatch(/<title[^>]*>.*<\/title>/);

      // <div id='root'> is non-empty (SSR content)
      const rootMatch = html.match(/<div id="root">([\s\S]*?)<\/div>/);
      expect(rootMatch).not.toBeNull();
      expect(rootMatch![1].trim().length).toBeGreaterThan(0);

      // window.__CONFIG__ and window.__REACT_QUERY_STATE__ are present
      expect(html).toContain("window.__CONFIG__=");
      expect(html).toContain("window.__REACT_QUERY_STATE__=");

      // meta viewport is present
      expect(html).toMatch(/meta\s+name="viewport"/);
    });
  });

  // ——————————————————————————————————————————
  // Config-driven secondary pages
  // ——————————————————————————————————————————
  const secondaryPages = config.pages.filter((p) => p.path !== "/");

  for (const page of secondaryPages) {
    describe(`${page.path}`, () => {
      it("returns status 200 with SSR content, globals, and complete HTML", async () => {
        const { status, html } = await fetchPage(`${getBaseUrl()}${page.path}`);
        expect(status).toBe(200);

        expect(html).toContain('<div id="root">');
        expect(html).toContain("window.__CONFIG__=");
        expect(html).toContain("window.__REACT_QUERY_STATE__=");
        expect(html).toMatch(/<!doctype html>/i);
        expect(html).toContain("</html>");
      });
    });
  }

  // ——————————————————————————————————————————
  // 404 fallback (/page-inexistante)
  // ——————————————————————————————————————————
  describe("404 fallback (/page-inexistante)", () => {
    it("returns status 200 with valid HTML structure and globals", async () => {
      const { status, html } = await fetchPage(
        `${getBaseUrl()}/page-inexistante`
      );
      // The catch-all `*` route renders via SSR with status 200
      expect(status).toBe(200);
      expect(html).toContain('<div id="root">');
      expect(html).toContain("window.__CONFIG__=");
      expect(html).toContain("window.__REACT_QUERY_STATE__=");
      expect(html).toContain("</html>");
    });
  });

  // ——————————————————————————————————————————
  // Static assets (should 404)
  // ——————————————————————————————————————————
  describe("Static assets", () => {
    it("/nonexistent.js returns 404", async () => {
      const { status } = await fetchPage(`${getBaseUrl()}/nonexistent.js`);
      expect(status).toBe(404);
    });

    it("/nonexistent.css returns 404", async () => {
      const { status } = await fetchPage(`${getBaseUrl()}/nonexistent.css`);
      expect(status).toBe(404);
    });
  });

  // ——————————————————————————————————————————
  // Headers
  // ——————————————————————————————————————————
  describe("Headers", () => {
    it("Content-Type contains text/html for SSR routes", async () => {
      const { headers } = await fetchPage(getBaseUrl());
      const contentType = headers.get("content-type");
      expect(contentType).toContain("text/html");
    });
  });
});
