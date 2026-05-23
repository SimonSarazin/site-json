import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getBaseUrl } from "../helpers/server-manager";

/**
 * Vérifie la complétude structurelle du HTML SSR — anti-régression du fix
 * de streaming React 19 + Vite (`pipe(res)` direct + override `res.end()`,
 * cf. commit `0cf174f`).
 *
 * NOTE : en DEV (test integration tourne avec `server/dev-server.js`), des
 * markers Suspense pending `<!--$?-->` peuvent persister parce que Vite
 * SSR dev ne drain pas toujours toutes les boundary avant d'envoyer la
 * réponse. Les tests stricts sur ces markers sont donc skippés en dev et
 * activés uniquement avec `STRICT_SSR_MARKERS=1` (à utiliser avec un
 * serveur prod).
 *
 * Ce qu'on vérifie en DEV (toujours actif) :
 *   - HTML termine par </html>
 *   - <div id="root"> est non vide (SSR a produit du contenu)
 *   - <!doctype html> présent
 *   - `window.__CONFIG__` injecté
 */

const STRICT = process.env.STRICT_SSR_MARKERS === "1";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const configPath = path.resolve(
  PROJECT_ROOT,
  process.env.SITE_CONFIG_PATH || "./config.prod.json"
);
const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
  pages: Array<{ path: string }>;
};

async function fetchPage(url: string, timeoutMs = 20_000): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const doFetch = async () => {
    const res = await fetch(url, { signal: controller.signal });
    const html = await res.text();
    return { status: res.status, html };
  };
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error(`fetchPage timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([doFetch(), timeout]);
}

async function fetchPageWithRetry(url: string, retries = 3): Promise<{ status: number; html: string }> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchPage(url);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastError;
}

describe("SSR Completeness", () => {
  // Home + 2 pages secondaires (suffisant pour couvrir variantes de routing)
  const secondaryPages = config.pages.filter((p) => p.path !== "/").slice(0, 2);
  const testPaths = ["/", ...secondaryPages.map((p) => p.path)];

  for (const pagePath of testPaths) {
    describe(pagePath, () => {
      it("termine sur `</html>` (closing tags injectés correctement)", async () => {
        const { html } = pagePath === "/"
          ? await fetchPageWithRetry(`${getBaseUrl()}${pagePath}`)
          : await fetchPage(`${getBaseUrl()}${pagePath}`);
        expect(html.trim().endsWith("</html>")).toBe(true);
      });

      it("contient `<!doctype html>` en tête", async () => {
        const { html } = await fetchPage(`${getBaseUrl()}${pagePath}`);
        expect(html).toMatch(/^\s*<!doctype html>/i);
      });

      it("contient `<div id=\"root\">` avec du contenu SSR non vide", async () => {
        const { html } = await fetchPage(`${getBaseUrl()}${pagePath}`);
        // Match jusqu'au prochain `</div>` au même niveau ou `</body>` final
        const rootMatch = html.match(/<div id="root">([\s\S]+?)<\/(?:body|html)>/);
        expect(rootMatch, `<div id="root"> manquant dans ${pagePath}`).not.toBeNull();
        const contentLen = rootMatch![1].trim().length;
        expect(contentLen, `contenu root trop court (${contentLen}) pour ${pagePath}`).toBeGreaterThan(100);
      });

      it("injecte `window.__CONFIG__`", async () => {
        const { html } = await fetchPage(`${getBaseUrl()}${pagePath}`);
        expect(html).toContain("window.__CONFIG__=");
      });

      it("injecte `window.__REACT_QUERY_STATE__`", async () => {
        const { html } = await fetchPage(`${getBaseUrl()}${pagePath}`);
        expect(html).toContain("window.__REACT_QUERY_STATE__=");
      });

      // Tests stricts sur markers Suspense — activés uniquement via env var
      it.skipIf(!STRICT)(
        "[STRICT_SSR_MARKERS=1] aucun marker Suspense pending `<!--$?-->`",
        async () => {
          const { html } = await fetchPage(`${getBaseUrl()}${pagePath}`);
          const pending = (html.match(/<!--\$\?-->/g) || []).length;
          expect(pending, `${pending} marker(s) pending dans ${pagePath}`).toBe(0);
        }
      );

      it.skipIf(!STRICT)(
        "[STRICT_SSR_MARKERS=1] aucun marker boundary failed `<!--$!-->`",
        async () => {
          const { html } = await fetchPage(`${getBaseUrl()}${pagePath}`);
          const failed = (html.match(/<!--\$!-->/g) || []).length;
          expect(failed, `${failed} marker(s) failed dans ${pagePath}`).toBe(0);
        }
      );
    });
  }

  describe("Structure HTML globale (/)", () => {
    it("contient <html>, <head>, <body> dans l'ordre", async () => {
      const { html } = await fetchPageWithRetry(`${getBaseUrl()}/`);
      const htmlIdx = html.indexOf("<html");
      const headIdx = html.indexOf("<head");
      const bodyIdx = html.indexOf("<body");
      expect(htmlIdx, "<html> manquant").toBeGreaterThan(-1);
      expect(headIdx, "<head> manquant").toBeGreaterThan(htmlIdx);
      expect(bodyIdx, "<body> manquant").toBeGreaterThan(headIdx);
    });

    it("ferme proprement chacun des tags structurels", async () => {
      const { html } = await fetchPageWithRetry(`${getBaseUrl()}/`);
      expect(html).toMatch(/<\/head>/);
      expect(html).toMatch(/<\/body>/);
      expect(html).toMatch(/<\/html>/);
    });
  });
});
