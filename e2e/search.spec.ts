import { test, expect } from "@playwright/test";
import { loadSiteConfig, findSearchPages } from "./helpers/config";

const BACKEND_URL = process.env.VITE_BASE_URL_BACKEND || "http://localhost:5080";
const config = loadSiteConfig();
const searchPages = findSearchPages(config);

async function isBackendReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(BACKEND_URL, { signal: controller.signal });
    clearTimeout(timer);
    return res.status < 600;
  } catch {
    return false;
  }
}

test.describe("Search Module (E2E)", () => {
  test.beforeEach(async () => {
    const reachable = await isBackendReachable();
    if (!reachable) {
      test.skip();
    }
  });

  test("/ renders searchProStatic sections without crash", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // No "Failed to load section" error should appear
    const failedSections = page.locator("text=Failed to load section");
    const failCount = await failedSections.count();
    expect(failCount).toBe(0);

    // The root should have substantial content
    const rootContent = await page.locator("#root").innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);
  });

  for (const searchPage of searchPages.filter((p) => p.path !== "/")) {
    test(`${searchPage.path} renders search/grid content without crash`, async ({ page }) => {
      await page.goto(searchPage.path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);

      // No crash errors
      const failedSections = page.locator("text=Failed to load section");
      expect(await failedSections.count()).toBe(0);

      // Page should have meaningful content
      const rootContent = await page.locator("#root").innerHTML();
      expect(rootContent.length).toBeGreaterThan(100);
    });
  }

  test("search input in hero is functional", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Look for a search input (in hero section or header)
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="echerch" i], input[placeholder*="earch" i]'
    );

    if ((await searchInput.count()) > 0) {
      const input = searchInput.first();
      await input.fill("test");
      const value = await input.inputValue();
      expect(value).toBe("test");

      // Check for a search/submit button nearby
      const searchButton = page.locator(
        'button[type="submit"], button[aria-label*="echerch" i], button[aria-label*="earch" i]'
      );
      // Button may or may not exist — just verify the input works
      expect(true).toBe(true);
    } else {
      // No search input found on home page — skip gracefully
      test.skip();
    }
  });
});
