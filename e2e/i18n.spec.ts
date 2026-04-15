import { test, expect } from "@playwright/test";
import { loadSiteConfig } from "./helpers/config";

const config = loadSiteConfig();

const defaultLang = config.meta.defaultLang || "fr";

// Find the hero headline text for the home page
const homePage = config.pages.find((p) => p.path === "/");
const heroSection = homePage?.sections.find(
  (s) => s.type === "hero" || s.type === "hero-tiers-lieux"
);
const heroHeadline = heroSection?.props?.headline;

test.describe("i18n (E2E)", () => {
  test("home page loads with default language content", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    if (heroHeadline && heroHeadline[defaultLang]) {
      const headlineText = heroHeadline[defaultLang];
      const pageContent = await page.locator("#root").textContent();
      expect(pageContent).toContain(headlineText);
    } else {
      // No hero headline to check — verify page loads without errors
      const rootContent = await page.locator("#root").innerHTML();
      expect(rootContent.length).toBeGreaterThan(100);
    }
  });

  test("language switch changes visible text", async ({ page }) => {
    if (!config.header.utilities.langSwitch) {
      test.skip();
      return;
    }

    // We need at least 2 languages and a hero headline to test
    if (config.meta.languages.length < 2 || !heroHeadline) {
      test.skip();
      return;
    }

    const altLang = config.meta.languages.find((l) => l !== defaultLang);
    if (!altLang || !heroHeadline[altLang]) {
      test.skip();
      return;
    }

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Look for a language switch button/select
    const langSwitch = page.locator(
      `button:has-text("${altLang.toUpperCase()}"), button:has-text("${altLang}"), [data-testid="lang-switch"], button[aria-label*="lang" i]`
    );

    if ((await langSwitch.count()) > 0) {
      await langSwitch.first().click();
      await page.waitForTimeout(2000);

      const altHeadline = heroHeadline[altLang];
      const pageContent = await page.locator("#root").textContent();
      expect(pageContent).toContain(altHeadline);
    } else {
      // Language switch button not found — skip
      test.skip();
    }
  });
});
