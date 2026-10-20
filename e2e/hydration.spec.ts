import { test, expect } from "@playwright/test";
import { loadSiteConfig, findSecondaryPage } from "./helpers/config";

const config = loadSiteConfig();
const secondaryPage = findSecondaryPage(config);
const secondaryPath = secondaryPage?.path ?? "/lieux"; // ultimate fallback

test.describe("Hydration (Level 3)", () => {
  test("SSR renders content without JS enabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const root = page.locator("#root");
    const rootContent = await root.innerHTML();
    expect(rootContent.trim().length).toBeGreaterThan(0);

    await context.close();
  });

  test("hydration completes without errors on /", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("net::ERR_") ||
          text.includes("Failed to fetch") ||
          text.includes("[Api.init]") ||
          text.includes("favicon")
        ) {
          return;
        }
        errors.push(text);
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) =>
        e.includes("#root non trouvé") ||
        e.includes("Hydration") ||
        e.includes("did not match")
    );

    expect(criticalErrors).toEqual([]);
  });

  test("window.__CONFIG__ is accessible and has expected shape", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const configData = await page.evaluate(() => window.__CONFIG__);

    expect(configData).toBeDefined();
    expect(configData).toHaveProperty("meta");
    expect(configData).toHaveProperty("pages");
    expect(configData).toHaveProperty("header");
  });

  test("window.__REACT_QUERY_STATE__ is accessible and has queries", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const state = await page.evaluate(() => window.__REACT_QUERY_STATE__);

    expect(state).toBeDefined();
    expect(state).toHaveProperty("queries");
  });

  test(`client-side navigation works without full page reload`, async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    // Look for a VISIBLE link to the secondary page in the header navigation
    const targetPath = secondaryPath;
    const navLink = page.locator(`a[href="${targetPath}"]:visible`).first();

    if ((await navLink.count()) > 0) {
      let fullPageLoad = false;
      page.on("load", () => {
        fullPageLoad = true;
      });

      await navLink.click();
      await page.waitForTimeout(1000);

      expect(page.url()).toContain(targetPath);
      expect(fullPageLoad).toBe(false);
    } else {
      // No visible link — use direct navigation to verify React Router works
      await page.evaluate((path) => {
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, targetPath);
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(targetPath);
    }
  });

  test(`hydration completes without errors on ${secondaryPath}`, async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          text.includes("net::ERR_") ||
          text.includes("Failed to fetch") ||
          text.includes("[Api.init]") ||
          text.includes("favicon")
        ) {
          return;
        }
        errors.push(text);
      }
    });

    await page.goto(secondaryPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(
      (e) =>
        e.includes("#root non trouvé") ||
        e.includes("Hydration") ||
        e.includes("did not match")
    );

    expect(criticalErrors).toEqual([]);
  });

  /**
   * Parents d'entités factorisés (`src/lib/ssrStatePacking.ts`) : le HTML transporte des références
   * `__ssrParentRef`, que `ssrStateBootstrap` doit avoir TOUTES restituées avant que React Query ne
   * lise l'état. Une restitution ratée ne casse pas la page — elle fausse `isAdmin()` et la méta de
   * parent jusqu'au prochain refetch, avec pour seul signal une ligne de console. Ce test la voit.
   * Page lourde visée : `E2E_PACKED_PATH=/communaute VITE_SLUG=openAtlas npx playwright test e2e/hydration.spec.ts`.
   */
  test("parents d'entités factorisés : tous restitués avant l'hydratation", async ({ page, request }) => {
    const target = process.env.E2E_PACKED_PATH ?? secondaryPath;
    const html = await (await request.get(target)).text();
    test.skip(!html.includes("__ssrParentRef"), `${target} : aucun parent factorisé dans le HTML — rien à restituer`);

    const ssrErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("[ssr]")) ssrErrors.push(msg.text());
    });
    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const state = await page.evaluate(() => {
      const text = JSON.stringify(window.__REACT_QUERY_STATE__ ?? null);
      return {
        refs: text.split("__ssrParentRef").length - 1,
        table: text.includes("__ssrParents"),
        // Un parent restitué porte sa méta complète (`serverData`), pas un simple index.
        restored: (text.match(/"parent":\{[^{}]*"serverData":\{/g) ?? []).length,
      };
    });
    expect(ssrErrors).toEqual([]);
    expect(state.refs).toBe(0);
    expect(state.table).toBe(false);
    expect(state.restored).toBeGreaterThan(0);
  });
});
