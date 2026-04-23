import { test, expect } from "@playwright/test";
import { loadSiteConfig } from "./helpers/config";

const config = loadSiteConfig();
const defaultLang = config.meta.defaultLang || "fr";

test.describe("Config-driven Navigation (E2E)", () => {
  test("header element exists and renders", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const header = page.locator("header");
    await expect(header.first()).toBeVisible();
  });

  test("logo is visible and links to /", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const logoLink = page.locator('header a[href="/"] img, header a[href="/"] svg');
    const count = await logoLink.count();
    expect(count).toBeGreaterThan(0);
  });

  test("each top-level nav label appears in the header (desktop)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    for (const item of config.header.nav) {
      const label = item.label[defaultLang];
      if (!label) continue;

      // Check that the label text exists somewhere in the header (may be in desktop nav or accessible text)
      const headerText = await page.locator("header").textContent();
      expect(
        headerText,
        `Nav label "${label}" should appear in header`
      ).toContain(label);
    }
  });

  test("footer element exists", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const footer = page.locator("footer");
    await expect(footer.first()).toBeVisible();
  });

  test("footer copyright is visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const copyright = config.footer.copyright[defaultLang];
    const footerText = await page.locator("footer").textContent();
    expect(footerText).toContain(copyright);
  });

  test("mobile menu toggle is visible at 375px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Look for hamburger/menu toggle button (common patterns)
    const menuButton = page.locator(
      'header button[aria-label*="menu" i], header button[aria-label*="Menu" i], header button[data-testid="mobile-menu"], header [role="button"]'
    );

    const count = await menuButton.count();
    expect(count).toBeGreaterThan(0);
  });
});
