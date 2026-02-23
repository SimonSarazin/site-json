import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getBaseUrl } from "../helpers/server-manager";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const configPath = path.resolve(PROJECT_ROOT, process.env.SITE_CONFIG_PATH || "./config.prod.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
  pages: Array<{ path: string }>;
};

// Build routes array from config + a non-existent page for fallback testing
const configRoutes = config.pages.map((p) => p.path);
const mixedRoutes = [...configRoutes, "/page-inexistante"];

// ————————————————————————————————————————————————————————————
// Helper: extract window.__REACT_QUERY_STATE__ from HTML
// The server uses serialize-javascript (not JSON.stringify),
// so we parse it with new Function() to handle undefined values.
// ————————————————————————————————————————————————————————————

function extractReactQueryState(html: string): unknown | null {
  const match = html.match(
    /window\.__REACT_QUERY_STATE__\s*=\s*([\s\S]*?)<\/script>/
  );
  if (!match?.[1]) return null;

  try {
    // serialize-javascript output may contain `undefined` literals
    return new Function(`return (${match[1]})`)();
  } catch {
    return null;
  }
}

function hasCompleteHtml(html: string): boolean {
  return html.includes("</html>");
}

// ————————————————————————————————————————————————————————————
// Tests
// ————————————————————————————————————————————————————————————

describe("SSR Concurrency (Level 1)", () => {

  it("single request returns 200 with __CONFIG__, __REACT_QUERY_STATE__, and #root", async () => {
    // Retry to handle cold-start SSR stream issues
    let html = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        const res = await fetch(getBaseUrl(), { signal: controller.signal });
        expect(res.status).toBe(200);
        html = await res.text();
        clearTimeout(timer);
        break;
      } catch {
        if (attempt === 2) throw new Error("Failed after 3 retries");
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    expect(html).toContain("window.__CONFIG__=");
    expect(html).toContain("window.__REACT_QUERY_STATE__=");
    expect(html).toContain('<div id="root">');
  });

  it("10 parallel requests to same route all return 200 with parseable state", async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch(getBaseUrl()).then(async (res) => ({
        status: res.status,
        html: await res.text(),
      }))
    );

    const results = await Promise.all(requests);

    for (const { status, html } of results) {
      expect(status).toBe(200);
      const state = extractReactQueryState(html);
      expect(state).not.toBeNull();
      expect(hasCompleteHtml(html)).toBe(true);
    }
  });

  it("20 parallel requests to mixed routes all complete without truncation", async () => {
    const requests = Array.from({ length: 20 }, (_, i) => {
      const route = mixedRoutes[i % mixedRoutes.length];
      return fetch(`${getBaseUrl()}${route}`).then(async (res) => ({
        route,
        status: res.status,
        html: await res.text(),
      }));
    });

    const results = await Promise.all(requests);

    for (const { status, html } of results) {
      expect(status).toBe(200);
      expect(hasCompleteHtml(html)).toBe(true);
      expect(html).toContain("window.__CONFIG__=");
    }
  });

  it("dehydrated state contains cocolight-data query in 5 parallel requests", async () => {
    const requests = Array.from({ length: 5 }, () =>
      fetch(getBaseUrl()).then(async (res) => ({
        html: await res.text(),
      }))
    );

    const results = await Promise.all(requests);

    for (const { html } of results) {
      const state = extractReactQueryState(html) as {
        queries?: Array<{ queryKey: unknown[] }>;
      } | null;

      expect(state).not.toBeNull();
      expect(state!.queries).toBeDefined();

      const hasCocolightData = state!.queries!.some(
        (q) => q.queryKey?.[0] === "cocolight-data"
      );
      expect(hasCocolightData).toBe(true);
    }
  });

  it("no cross-route leakage between config pages in parallel", async () => {
    // Use first two distinct routes from config
    const secondaryPath = configRoutes.find((r) => r !== "/") ?? "/page-inexistante";

    const [homeRes, secondaryRes] = await Promise.all([
      fetch(getBaseUrl()).then(async (res) => ({
        status: res.status,
        html: await res.text(),
      })),
      fetch(`${getBaseUrl()}${secondaryPath}`).then(async (res) => ({
        status: res.status,
        html: await res.text(),
      })),
    ]);

    // Both complete
    expect(homeRes.status).toBe(200);
    expect(secondaryRes.status).toBe(200);
    expect(hasCompleteHtml(homeRes.html)).toBe(true);
    expect(hasCompleteHtml(secondaryRes.html)).toBe(true);

    // Both have the globals
    expect(homeRes.html).toContain("window.__CONFIG__=");
    expect(secondaryRes.html).toContain("window.__CONFIG__=");
    expect(homeRes.html).toContain("window.__REACT_QUERY_STATE__=");
    expect(secondaryRes.html).toContain("window.__REACT_QUERY_STATE__=");
  });
});
