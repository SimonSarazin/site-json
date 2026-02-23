import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getBaseUrl } from "../helpers/server-manager";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Load config at module level
const configPath = path.resolve(PROJECT_ROOT, process.env.SITE_CONFIG_PATH || "./config.prod.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
  meta: {
    title: Record<string, string>;
    defaultLang: string;
    languages: string[];
  };
  header: {
    nav: Array<{
      label: Record<string, string>;
      path?: string;
      children?: Array<{ label: Record<string, string>; path?: string }>;
    }>;
  };
  pages: Array<{
    path: string;
    title: Record<string, string>;
    sections: Array<{ type: string }>;
  }>;
  footer: {
    copyright: Record<string, string>;
  };
};

const defaultLang = config.meta.defaultLang || "fr";

/**
 * Fetch with timeout and retry for SSR pages.
 */
async function fetchSSR(
  urlPath: string,
  retries = 3,
  timeoutMs = 20_000
): Promise<{ status: number; html: string }> {
  const url = `${getBaseUrl()}${urlPath}`;
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      const html = await res.text();
      clearTimeout(timer);
      return { status: res.status, html };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastError;
}

/**
 * Read the LazySections keys from SectionRenderer.tsx to know which types are registered.
 */
function getRegisteredSectionTypes(): string[] {
  const sectionRendererPath = path.resolve(
    PROJECT_ROOT,
    "src/components/sections/SectionRenderer.tsx"
  );
  const content = fs.readFileSync(sectionRendererPath, "utf-8");
  // Match lines like: `hero: lazy(...)` or `"hero-tiers-lieux": lazy(...)`
  const regex = /^\s+(?:"([^"]+)"|(\w+)):\s*lazy\(/gm;
  const types: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    types.push(match[1] || match[2]);
  }
  return types;
}

// ——————————————————————————————————————————
// Dynamic SSR tests per config page
// ——————————————————————————————————————————
describe("Config-driven SSR — Pages", () => {
  for (const page of config.pages) {
    describe(`Page: ${page.path}`, () => {
      it(`SSR returns 200 with root, globals, and complete HTML`, async () => {
        const { status, html } = await fetchSSR(page.path);
        expect(status).toBe(200);
        expect(html).toContain('<div id="root">');
        expect(html).toContain("window.__CONFIG__=");
        expect(html).toContain("</html>");
      });
    });
  }
});

// ——————————————————————————————————————————
// Meta tests
// ——————————————————————————————————————————
describe("Config-driven SSR — Meta", () => {
  it(`<title> contains config.meta.title in default language (${defaultLang})`, async () => {
    const { html } = await fetchSSR("/");
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/);
    expect(titleMatch).not.toBeNull();
    const titleText = titleMatch![1];
    const expectedTitle = config.meta.title[defaultLang];
    expect(titleText).toContain(expectedTitle);
  });

  for (const lang of config.meta.languages) {
    it(`meta.title is defined for language: ${lang}`, () => {
      expect(config.meta.title[lang]).toBeDefined();
      expect(config.meta.title[lang].length).toBeGreaterThan(0);
    });
  }
});

// ——————————————————————————————————————————
// Nav items that reference real pages
// ——————————————————————————————————————————
describe("Config-driven SSR — Nav to pages", () => {
  const pagePaths = new Set(config.pages.map((p) => p.path));

  // Flatten all nav items (top-level + children)
  const navPaths: string[] = [];
  for (const item of config.header.nav) {
    if (item.path && item.path !== "#") navPaths.push(item.path);
    if (item.children) {
      for (const child of item.children) {
        if (child.path && child.path !== "#") navPaths.push(child.path);
      }
    }
  }

  // Only test nav items that actually correspond to a config page
  const navPagePaths = [...new Set(navPaths)].filter((p) => pagePaths.has(p));

  for (const navPath of navPagePaths) {
    it(`nav item "${navPath}" renders SSR 200`, async () => {
      const { status } = await fetchSSR(navPath);
      expect(status).toBe(200);
    });
  }
});

// ——————————————————————————————————————————
// Section types cross-reference
// ——————————————————————————————————————————
describe("Config-driven SSR — Section types registered", () => {
  const registeredTypes = getRegisteredSectionTypes();
  const usedTypes = new Set<string>();
  for (const page of config.pages) {
    for (const section of page.sections) {
      usedTypes.add(section.type);
    }
  }

  for (const sectionType of usedTypes) {
    it(`section type "${sectionType}" is registered in SectionRenderer`, () => {
      expect(registeredTypes).toContain(sectionType);
    });
  }
});

// ——————————————————————————————————————————
// Footer copyright
// ——————————————————————————————————————————
describe("Config-driven SSR — Footer", () => {
  it(`footer copyright text appears in SSR HTML`, async () => {
    const { html } = await fetchSSR("/");
    const copyright = config.footer.copyright[defaultLang];
    expect(html).toContain(copyright);
  });
});
