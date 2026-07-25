import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test, expect, type Page } from "@playwright/test";

/**
 * Parent62 — CDC Partie 1 (E2E lecture seule).
 *
 * Navigation et rendu uniquement : aucune création de données, aucun login.
 * Exécution ciblée : `npx playwright test e2e/parent62.spec.ts`
 * Prérequis : dev server :5173 avec `VITE_SLUG=parent62` (démarré par le
 * webServer Playwright sinon). Les assertions dépendant des données ne
 * s'appliquent que si le backend local (`VITE_BASE_URL_BACKEND`) répond.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

interface NavItem {
  label: Record<string, string>;
  path?: string;
}

// Config chargée explicitement : SITE_CONFIG_PATH est absent du .env, donc
// loadSiteConfig() retomberait sur config.prod.json (un autre site).
const config = JSON.parse(
  fs.readFileSync(path.resolve(PROJECT_ROOT, "config.prod.parent62.json"), "utf-8"),
) as { header: { nav: NavItem[] } };

function backendBaseUrl(): string | undefined {
  const envPath = path.resolve(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.trim().match(/^VITE_BASE_URL_BACKEND=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

let backendUp = false;

test.beforeAll(async () => {
  const base = backendBaseUrl();
  if (!base) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    await fetch(base, { signal: controller.signal });
    clearTimeout(timer);
    backendUp = true;
  } catch {
    backendUp = false;
  }
});

// Le SSR sert la page complète AVANT que React ne monte (en dev, la première
// compilation Vite peut prendre >10 s) : la sidebar de filtres est vide et les
// accordéons sont inertes tant que l'hydratation n'est pas finie. Le bouton
// « Se connecter » du header n'existe qu'après montage client → signal fiable.
async function waitForHydration(page: Page) {
  await page.getByRole("button", { name: "Se connecter" }).waitFor({ timeout: 45_000 });
}

test.describe("Parent62 — Partie 1 (lecture seule)", () => {
  test("accueil : titre, nav à 5 entrées, double entrée parents/pro, 9 bulles territoire", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await expect(page).toHaveTitle(/Parent62/);

    // Le header transparent-scroll rend un <nav class="fixed …">, pas de <header>.
    const headerNav = page.locator("nav.fixed").first();
    await expect(headerNav).toBeVisible();

    expect(config.header.nav, "la nav de la config doit rester à 5 entrées").toHaveLength(5);
    const headerText = (await headerNav.textContent()) ?? "";
    for (const item of config.header.nav) {
      expect(headerText, `entrée « ${item.label.fr} » attendue dans le header`).toContain(
        item.label.fr,
      );
    }
    // Décision du 23/07 : Parents / Professionnels hors menu, accessibles depuis l'accueil.
    expect(headerText).not.toContain("Professionnels");

    await expect(page.locator('main a[href="/parents"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/pro"]').first()).toBeVisible();
    expect(await page.locator('main a[href^="/territoire/"]').count()).toBeGreaterThanOrEqual(9);
  });

  test("/recherche : cible « Actualités » par défaut, groupes de filtres, résultats", async ({
    page,
  }) => {
    await page.goto("/recherche", { waitUntil: "domcontentloaded" });

    // L'apparition des groupes dans la sidebar = hydratation terminée
    // (au SSR, filterGroups est vide : la sidebar ne porte que le champ nom).
    const aside = page.locator("aside");
    const typeInfo = aside.getByRole("button", { name: "Type d'information" });
    await expect(typeInfo).toBeVisible({ timeout: 45_000 });
    for (const label of ["Territoire", "Public", "Thèmes"]) {
      await expect(aside.getByRole("button", { name: label })).toBeVisible();
    }

    // Fix du 23/07 : le défaut est porté par searchByFields, pas par un tag —
    // la cible « Actualités » doit être cochée à l'arrivée sur URL vierge.
    // `defaultOpenGroups` (config) ouvre typeInfo et territoire : ne PAS
    // cliquer le déclencheur, ce refermerait le groupe. `optionStyle:"check"` :
    // la ligne d'option est un bouton — sélectionné = texte plein (pas de
    // `text-muted-foreground`).
    const actualites = aside.getByRole("button", { name: "Actualités" });
    await expect(actualites).toBeVisible();
    await expect(actualites).not.toHaveClass(/text-muted-foreground/);

    if (backendUp) {
      await expect(page.getByText(/aucun résultat/i)).toHaveCount(0);
    }
  });

  test("/recherche?territoire=Arrageois : le deep-link applique le filtre", async ({ page }) => {
    await page.goto("/recherche?territoire=Arrageois", { waitUntil: "domcontentloaded" });

    const aside = page.locator("aside");
    const territoire = aside.getByRole("button", { name: "Territoire" });
    await expect(territoire).toBeVisible({ timeout: 45_000 });

    // Le groupe territoire est ouvert par défaut (`defaultOpenGroups`) et ses
    // options sont des lignes Label + Checkbox (pas le style « check »).
    const arrageois = aside
      .locator("label")
      .filter({ hasText: "Arrageois" })
      .locator('button[role="checkbox"]')
      .first();
    await expect(arrageois).toHaveAttribute("data-state", "checked");
    // Contre-témoin : une option NON sélectionnée reste décochée.
    const artois = aside
      .locator("label")
      .filter({ hasText: "Artois" })
      .locator('button[role="checkbox"]')
      .first();
    await expect(artois).toHaveAttribute("data-state", "unchecked");
  });

  test("/temoignages : la page « Paroles de parents » rend (recherche)", async ({ page }) => {
    // Réconciliation 24/07 (main canonique) : la parole passe par la page
    // /temoignages de Thomas (searchHeader + searchProStatic) — l'ancienne
    // /paroles du MR a été retirée comme doublon.
    await page.goto("/temoignages", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(
      page.getByRole("heading", { name: "Paroles de parents" }).first(),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Rechercher une parole…")).toBeVisible();
  });

  test("/territoire/arrageois : bandeau et liste des communes", async ({ page }) => {
    await page.goto("/territoire/arrageois", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: /Arrageois/ }).first()).toBeVisible();

    // Accordéon replié par défaut : le contenu n'est monté qu'à l'ouverture.
    await page.getByRole("button", { name: /Les communes du territoire/ }).click();
    const communes = page.locator(".p62-communes").first();
    await expect(communes).toBeVisible();
    await expect(communes.getByText("Ablainzevelle", { exact: true })).toBeVisible();
  });

  test("/blog : le fil d'actualités rend", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // TitleSection rend un h2 (pas de h1 sur les pages de liste).
    await expect(page.getByRole("heading", { name: "Les actualités du réseau" })).toBeVisible();
    if (backendUp) {
      await expect(page.locator("main h3").first()).toBeVisible();
    }
  });

  test("mode sombre : scrim au repos sur le héro, opaque après scroll, nav visible", async ({
    page,
  }) => {
    // next-themes (attribute="class") lit localStorage.theme au démarrage.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Attendre l'hydratation (listener de scroll attaché) avant de scroller —
    // sinon le wheel part avant que `useScrollAware` n'écoute (bundle lourd).
    await waitForHydration(page);

    await expect(page.locator("html")).toHaveClass(/dark/);

    const headerNav = page.locator("nav.fixed").first();
    await expect(headerNav).toHaveClass(/bg-linear-to-b/);
    await expect(headerNav.locator("a", { hasText: "Rechercher" }).first()).toBeVisible();

    // Scroll réel (window.scrollTo → event `scroll`) ; l'assertion auto-retry
    // jusqu'à ce que le header bascule opaque.
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(headerNav).toHaveClass(/bg-background\/90/);
  });
});
