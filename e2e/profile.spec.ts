import { test, expect } from "@playwright/test";
import { loadSiteConfig } from "./helpers/config";

const BACKEND_URL = process.env.VITE_BASE_URL_BACKEND || "http://localhost:5080";
const VITE_SLUG = process.env.VITE_SLUG || "franceTierslieux";

const config = loadSiteConfig();
const profileTypes = config.profiles ? Object.keys(config.profiles) : [];

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

test.describe("Profile Pages (E2E)", () => {
  test.beforeEach(async () => {
    const reachable = await isBackendReachable();
    if (!reachable) {
      test.skip();
    }
  });

  test("config.profiles is defined with at least one profile type", () => {
    expect(config.profiles).toBeDefined();
    expect(profileTypes.length).toBeGreaterThan(0);
  });

  test("each profile type has tabs configured", () => {
    for (const type of profileTypes) {
      const profile = config.profiles![type];
      expect(
        profile.tabs,
        `Profile type "${type}" should have tabs`
      ).toBeDefined();
      expect(profile.tabs!.length).toBeGreaterThan(0);
    }
  });

  test(`/profil/${VITE_SLUG} renders a profile page`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          !text.includes("net::ERR_") &&
          !text.includes("Failed to fetch") &&
          !text.includes("[Api.init]") &&
          !text.includes("favicon")
        ) {
          errors.push(text);
        }
      }
    });

    await page.goto(`/profil/${VITE_SLUG}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Root should have content (not a blank page or 404)
    const rootContent = await page.locator("#root").innerHTML();
    expect(rootContent.length).toBeGreaterThan(100);
  });

  test("/profil/slug-inexistant-xyz handles error gracefully", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => {
      jsErrors.push(err.message);
    });

    await page.goto("/profil/slug-inexistant-xyz", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // No uncaught JS errors
    expect(jsErrors.length).toBe(0);

    // Page still renders something (error boundary or fallback)
    const rootContent = await page.locator("#root").innerHTML();
    expect(rootContent.trim().length).toBeGreaterThan(0);
  });
});
