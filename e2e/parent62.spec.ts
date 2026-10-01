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
  iconOnly?: boolean;
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
  test("accueil : titre, nav à 7 entrées dont la loupe, dropdown Publics, 9 bulles territoire", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    await expect(page).toHaveTitle(/Parent62/);

    // Le header stacked rend un bandeau <header> suivi d'un <nav class="sticky …">.
    const headerNav = page.locator("nav.sticky").first();
    await expect(headerNav).toBeVisible();

    // 17/09 : « INFORESO » rejoint le premier niveau, à côté de « Contenus », puis la loupe vers la recherche,
    // en icône seule comme sur l'ancien site (7 entrées).
    expect(config.header.nav, "la nav de la config doit rester à 7 entrées").toHaveLength(7);
    const headerText = (await headerNav.textContent()) ?? "";
    for (const item of config.header.nav) {
      if (item.iconOnly) {
        // Icône seule : le libellé est le nom accessible du lien, pas un texte affiché.
        const lien = headerNav.locator(`a[aria-label="${item.label.fr}"]`).first();
        await expect(lien, `lien icône « ${item.label.fr} »`).toHaveAttribute("href", item.path ?? "");
        await expect(lien).toHaveText("");
        continue;
      }
      expect(headerText, `entrée « ${item.label.fr} » attendue dans le header`).toContain(
        item.label.fr,
      );
    }
    // Refonte du 06/08 : le dropdown « Publics » (7 entrées) REMPLACE la décision
    // du 23/07 (Parents/Professionnels hors menu, liés depuis l'accueil) — les
    // pages par public sont désormais navigables depuis le header, et la home
    // data-driven n'a plus de tuiles /parents et /pro.
    expect(headerText).toContain("Professionnels");

    // Home data-driven : les 9 bulles de la carte pointent vers /territoire/*.
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

  test("/temoignages : la page « Paroles de parents » rend (filtres à gauche)", async ({ page }) => {
    // Réconciliation 24/07 (main canonique) : la parole passe par la page
    // /temoignages de Thomas — l'ancienne /paroles du MR a été retirée comme doublon.
    // 09/09 : la page échange son searchHeader à 5 dropdowns contre un searchHeader
    // titre-seul (`showSearch:false`) + un `gridLayout` filtres/liste. Le champ de
    // recherche « Rechercher une parole… » du bandeau n'existe donc plus : c'est le
    // panneau `filters` qui porte désormais la recherche.
    await page.goto("/temoignages", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(
      page.getByRole("heading", { name: "Paroles de parents" }).first(),
    ).toBeVisible();
    // Gabarit « filtres à gauche » : la sidebar desktop de `FiltersSection` est le marqueur
    // stable du nouveau rendu. Scopé à l'`aside` — le champ de recherche du panneau est
    // rendu DEUX fois (bloc mobile `lg:hidden` + sidebar `hidden lg:block`), donc un
    // `getByPlaceholder` global viserait la copie masquée.
    const panneau = page.locator("aside").first();
    await expect(panneau.getByRole("heading", { name: "Filtres" })).toBeVisible();
    await expect(panneau.getByPlaceholder(/Rechercher par nom/i)).toBeVisible();
  });

  // ── Coordination territoriale : filtre serveur + projection (SDK ≥ 1.0.194) ──────────────
  // Navigateur NON connecté : chemin public `globalautocomplete` (projection additive), complément
  // du contrôle manuel sur le chemin admin. Les cas « carte présente » dépendent du semis local
  // documenté en doc-projets/parent62.md §9septvicies.6 (Mirana → Audomarois, Legrand → Hénin
  // Carvin, Judicael sans territoire) : sans lui, ils sont IGNORÉS explicitement, pas verts à vide.
  test("/territoire/arrageois : sans coordination rattachée, le repli de contact et rien d'autre", async ({ page }) => {
    await page.goto("/territoire/arrageois", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const section = page.locator("#arrageois-coordination");
    await expect(section.getByText("arrageois@parent62.org")).toBeVisible({ timeout: 45_000 });
    await expect(section.getByText(/Aucun membre/i)).toHaveCount(0);
    await expect(section.getByText("Coordonnateur(trice)")).toHaveCount(0);
  });

  test("/territoire/audomarois : la coordination filtrée serveur, sans repli", async ({ page }) => {
    await page.goto("/territoire/audomarois", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const section = page.locator("#audomarois-coordination");
    // La liste se résout côté client : on attend la carte OU le repli, puis on tranche.
    await expect(section.getByText(/Mirana Sylvany|audomarois@parent62.org/)).toBeVisible({ timeout: 45_000 });
    test.skip(
      (await section.getByText("Mirana Sylvany").count()) === 0,
      "semis local absent (doc-projets/parent62.md §9septvicies.6)",
    );
    await expect(section.getByText("Coordonnateur(trice)")).toBeVisible();
    await expect(section.getByText("audomarois@parent62.org")).toHaveCount(0); // pas de repli quand une carte est rendue
    await expect(section.getByText("Centre Social Inter-Générations", { exact: false })).toBeVisible(); // cardText
    await expect(section.getByRole("link", { name: /actualités du territoire/i })).toHaveCount(0); // déjà sur la page
  });

  test("/equipe : l'équipe de coordination, avec et sans territoire", async ({ page }) => {
    await page.goto("/equipe", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    const section = page.locator("#equipe-terr");
    await expect(section.getByText(/Legrand Antoine|Aucun membre/)).toBeVisible({ timeout: 45_000 });
    test.skip(
      (await section.getByText("Legrand Antoine").count()) === 0,
      "semis local absent (doc-projets/parent62.md §9septvicies.6)",
    );
    for (const nom of ["Mirana Sylvany", "Legrand Antoine", "Judicael RAKOTOMALALA"]) {
      await expect(section.getByText(nom)).toBeVisible();
    }
    // Deux rattachés → deux boutons vers leur territoire ; le troisième, sans territoire, n'en a pas.
    await expect(section.getByRole("link", { name: /actualités du territoire/i })).toHaveCount(2);
    await expect(section.locator('a[href="/territoire/familles-en-sol-mineur-henin-carvin"]')).toHaveCount(1);
  });

  test("/equipe : couleurs fixes des cartes « animation départementale » et « contact CAF »", async ({ page }) => {
    // Ces deux sections n'ont pas de territoire à résoudre (`card.fixedColors` prime alors sur
    // `couleursTerritoire`, qui serait retombée sur le neutre du thème) — cf. `CardTeamMember`.
    await page.goto("/equipe", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    const fond = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect(page.locator("#equipe-dep")).toBeVisible({ timeout: 45_000 });
    const [dep, caf] = await Promise.all([
      fond('#equipe-dep [data-slot="card"]'),
      fond('#equipe-caf [data-slot="card"]'),
    ]);
    expect(dep, "vert de marque (--p62-vert)").toBe("rgb(30, 174, 152)");
    expect(caf, "jaune-vert de marque (--p62-caf)").toBe("rgb(215, 216, 114)");
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

  test("/blog : le fil en densité compacte tient sur 2 colonnes mobile, 4 en grand écran, sans info perdue", async ({ page }) => {
    // `articleFeed.density: "compact"` (posé sur les 33 fils d'actus du site) : grille resserrée,
    // mais date/titre/extrait/tags restent tous affichés — c'est la hauteur de l'image qui se
    // resserre, pas le contenu. Assertion sur les DEUX viewports : la densité change de colonnes à
    // `lg:`, un test à une seule taille ne verrait qu'une moitié du contrat.
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    if (!backendUp) test.skip(true, "fil d'actualités indisponible sans backend");

    const grid = page.locator("#blog-feed .grid").first();
    await grid.locator(":scope > *").first().waitFor();

    const desktopCols = await grid.evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
    expect(desktopCols, "4 colonnes à partir de lg: (1440px, viewport par défaut)").toBe(4);

    const premiere = grid.locator(":scope > *").first();
    // Titre, extrait ET tags coexistent (aucun n'est sacrifié pour la densité) — un `h3` retrouvable,
    // une pastille de tag, et une carte SANS le padding `py-6` de base (retiré en compact : cf.
    // `ArticleCard`/`ArticleCardPoster`, sinon 48px de vide pour rien sur une carte déjà resserrée).
    await expect(premiere.locator("h3")).toBeVisible();
    await expect(premiere.locator('[data-slot="badge"]').first()).toBeVisible();
    const paddingTop = await premiere.evaluate((c) => getComputedStyle(c).paddingTop);
    expect(paddingTop, "py-6 retiré en compact").toBe("0px");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const mobileCols = await grid.evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(" ").length);
    expect(mobileCols, "2 colonnes dès le mobile (pas 1, comme le reste du parc)").toBe(2);
  });

  test("/zoomcat : liste des actualités « Zoom sur le réseau », sans filtre, atteinte depuis l'accueil", async ({ page }) => {
    // Le bouton « voir tout » de la section « Zoom sur le réseau » de l'accueil mène à cette page.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.locator('[data-section-type="articleTeaser"] a[href="/zoomcat"]')).toHaveCount(1);

    await page.goto("/zoomcat", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Zoom sur le réseau" }).first()).toBeVisible();
    // Page de listing pure : ni champ de recherche ni liste déroulante de filtres.
    await expect(page.locator("main input[type=search], main [role=combobox]")).toHaveCount(0);
    if (backendUp) {
      await expect(page.locator("main h3").first()).toBeVisible();
    }
  });

  test("mode sombre : header stacked — nav lisible, wordmark collapse au scroll", async ({
    page,
  }) => {
    // next-themes (attribute="class") lit localStorage.theme au démarrage.
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Attendre l'hydratation (listener de scroll attaché) avant de scroller —
    // sinon le wheel part avant que `useScrollAware` n'écoute (bundle lourd).
    await waitForHydration(page);

    await expect(page.locator("html")).toHaveClass(/dark/);

    // Header stacked (remplace transparent-scroll depuis la refonte du 06/08) :
    // bandeau wordmark <header> dans le flux + <nav class="sticky …"> — pas de
    // bascule bg-background/90. Au repos, le bandeau est à l'écran et la nav visible.
    const bandeau = page.locator("header").first();
    await expect(bandeau).toBeInViewport();
    const headerNav = page.locator("nav.sticky").first();
    const firstNav = headerNav.locator("a", { hasText: config.header.nav[0].label.fr }).first();
    await expect(firstNav).toBeVisible();

    // Scroll réel (window.scrollTo → event `scroll`) : le bandeau sort de
    // l'écran, la barre sticky reste collée en haut avec la nav visible.
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect(bandeau).not.toBeInViewport();
    await expect(firstNav).toBeVisible();
  });

  test("accueil : bandeau « à la une » (carrousel POI tagués) ne casse pas le rendu", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // Le composant se masque entièrement tant qu'aucun POI n'est tagué "A la
    // une" côté contenu (cf. doc-projets/parent62.md §5.1) : l'assertion ne
    // porte donc que si la section a effectivement rendu quelque chose.
    const section = page.locator('[data-section-type="featured-carousel"]');
    if (backendUp && (await section.count()) > 0) {
      await expect(section.getByRole("link").first()).toBeVisible();
    }
  });

  test("header à 1280px (seuil de la nav complète) : aucun débordement horizontal", async ({ page }) => {
    // À `xl` pile, la nav de premier niveau et le groupe d'actions partagent la ligne : une entrée de plus
    // (INFORESO, 17/09) poussait « Se connecter » 3px hors de l'écran, sur toutes les pages.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, "la page ne doit pas défiler horizontalement").toBeLessThanOrEqual(clientWidth);
    await expect(page.getByRole("button", { name: "Se connecter" }).first()).toBeInViewport({ ratio: 1 });
  });

  test("header à 1280px sous une barre de défilement classique : les actions tiennent dans la barre", async ({ page }) => {
    // Chromium de test a des barres de défilement en surimpression ; sous Windows, la barre prend 17px alors
    // que la nav complète (`xl`) reste affichée. Avec la loupe (7ᵉ entrée), le contenu dépassait alors de 20px.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await page.addStyleTag({ content: "html { padding-right: 17px !important; box-sizing: border-box; }" });

    const { contenu, boite } = await page.locator("nav.sticky .grid").first().evaluate((grille) => ({
      contenu: grille.scrollWidth,
      boite: grille.clientWidth,
    }));
    expect(contenu, "le contenu de la barre ne doit pas dépasser sa largeur").toBeLessThanOrEqual(boite);
  });

  test("/inforeso : les numéros rangés par année s'ouvrent dans un nouvel onglet", async ({ page }) => {
    await page.goto("/inforeso", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "INFORESO" }).first()).toBeVisible();
    // Les blocs d'année n'existent que si des numéros sont saisis : l'assertion suit la donnée.
    const annee = page.getByRole("region", { name: /^\d{4}$/ }).first();
    if (backendUp && (await annee.count()) > 0) {
      const numero = annee.getByRole("link").first();
      await expect(numero).toHaveAttribute("target", "_blank");
      await expect(numero).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  test("/elles-et-ils-ont-marque-le-reseau : annuaire affiché en entier, sans clic ni modale", async ({ page }) => {
    await page.goto("/elles-et-ils-ont-marque-le-reseau", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Elles et ils ont marqué le réseau" }).first()).toBeVisible();
    const personne = page.locator("main article").first();
    if (backendUp && (await personne.count()) > 0) {
      await expect(personne.getByRole("heading", { level: 3 })).toBeVisible();
      // Design `portrait` : tout est sur la carte — aucun bouton d'ouverture de détail.
      await expect(personne.getByRole("button")).toHaveCount(0);
    }
  });

  test("/territoire/arrageois : l'agenda du territoire liste les événements du territoire", async ({ page }) => {
    await page.goto("/territoire/arrageois", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // Deux agendas sur la page : les dates du comité local (réunions) puis l'agenda du territoire.
    const agendas = page.locator('[data-section-type="agenda"]');
    await expect(agendas).toHaveCount(2);
    const agendaTerritoire = agendas.last();
    await expect(agendaTerritoire.getByText("L'agenda du territoire")).toBeVisible();
    await expect(agendaTerritoire.getByRole("link", { name: /Voir tout l'agenda/ })).toHaveAttribute(
      "href",
      // L'ID de l'option, pas le libellé : un libellé retouché cesserait d'être reconnu (garde préflight
      // `deeplink-filters`), et la page cible s'ouvrirait NON filtrée.
      "/agenda?territoire=arrageois",
    );

    // Le contenu dépend des données : n'assertionner qu'avec un backend qui répond.
    if (backendUp) {
      const vide = await agendaTerritoire.getByText(/Aucun événement/i).count();
      if (vide === 0) await expect(agendaTerritoire.locator("article, a[href]").first()).toBeVisible();
    }
  });

  test("accueil : « Vous êtes » + Territoires/À la une forment UNE bande, de même largeur que « Zoom sur le réseau »", async ({ page }) => {
    // Refonte accueil : « Vous êtes » (action-tiles) n'est plus une bande séparée, il est intégré en
    // TÊTE du gridLayout (`props.topSection`) — une seule bande blanche porte « Vous êtes » PUIS la
    // rangée Territoires (3/4) / À la une (1/4), au lieu des 3 bandes disjointes d'avant la refonte.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    // La carte de l'actu n'existe qu'une fois les actualités chargées : attendre son lien avant de mesurer.
    await page.locator('[data-section-type="featured-carousel"] a:has-text("Lire la suite")').first().waitFor();

    const mesures = await page.evaluate(() => {
      const bande = (type: string) => {
        const sec = [...document.querySelectorAll("[data-section-index]")].find(
          (d) => (d as HTMLElement).dataset.sectionType === type,
        );
        const c = sec?.querySelector(".container")?.getBoundingClientRect();
        return c ? { largeur: Math.round(c.width), x: Math.round(c.x) } : null;
      };
      // Carte (fond blanc, `bg:"card"`) de chaque colonne — le `<section>` rendu par le composant lui-même,
      // PAS un wrapper de dégradé (il n'y en a plus sur l'une des deux colonnes depuis la refonte « fond
      // blanc » : `featured-carousel` n'a plus de `backgroundOverlay`, seul `map-bubbles` garde le sien,
      // scopé à sa SEULE illustration — mesurer la `<section>` entière compare donc la même chose des 2 côtés).
      const carte = (type: string) => {
        const r = document.querySelector(`[data-section-type="${type}"] section`)?.getBoundingClientRect();
        return r ? { haut: Math.round(r.top), bas: Math.round(r.bottom) } : null;
      };
      const une = document.querySelector('[data-section-type="featured-carousel"]');
      const cta = [...(une?.querySelectorAll("a") ?? [])].find((a) => /Lire la suite/.test(a.textContent ?? ""));

      // « Vous êtes » (action-tiles) et Territoires (map-bubbles) doivent vivre dans LA MÊME bande
      // blanche extérieure (gridLayout) : même parent de type `section`, pas deux bandes empilées.
      const vousEtes = document.querySelector('[data-section-type="action-tiles"]');
      const territoiresSection = document.querySelector('[data-section-type="map-bubbles"]');
      const bandeExterieure = (el: Element | null) => el?.closest('[data-section-type="gridLayout"]');
      const memeBande = !!vousEtes && !!territoiresSection
        && bandeExterieure(vousEtes) === bandeExterieure(territoiresSection);

      return {
        bandes: [bande("gridLayout"), bande("articleTeaser")],
        territoires: carte("map-bubbles"),
        alaune: carte("featured-carousel"),
        ctaDansLaCarte: Boolean(cta),
        vousEtesDansLaMemeBandeQueTerritoires: memeBande,
      };
    });

    // Les deux bandes restantes (gridLayout, articleTeaser) ont la même largeur, calées au même bord.
    const largeurs = new Set(mesures.bandes.map((b) => b?.largeur));
    const bords = new Set(mesures.bandes.map((b) => b?.x));
    expect(largeurs.size, `largeurs : ${JSON.stringify(mesures.bandes)}`).toBe(1);
    expect(bords.size, `bords : ${JSON.stringify(mesures.bandes)}`).toBe(1);

    expect(mesures.vousEtesDansLaMemeBandeQueTerritoires, "« Vous êtes » et Territoires dans la même bande").toBe(true);

    // Les deux cartes (Territoires, À la une) commencent et finissent à la même hauteur (`align:"stretch"`),
    // et le lien de l'actu vit DANS sa carte.
    expect(mesures.alaune, "carte de l'actu").toEqual(mesures.territoires);
    expect(mesures.ctaDansLaCarte, "lien « Lire la suite » dans la carte de l'actu").toBe(true);
  });

  test("accueil : survoler une bulle de territoire montre ses villes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // Dans la CARTE, pas le lien du même chemin dans le menu déroulant du header.
    const calaisis = page.locator('main a[href="/territoire/calaisis"]').first();
    const villes = calaisis.locator("span[id]");
    await expect(villes).toHaveText("Calais – Audruicq – Guînes");
    // Cachée au repos, montrée au survol — et elle décrit le lien pour un lecteur d'écran.
    await expect(villes).toHaveCSS("opacity", "0");
    await expect(calaisis).toHaveAttribute("aria-describedby", await villes.getAttribute("id") ?? "");
    await calaisis.hover();
    await expect(villes).toHaveCSS("opacity", "1");
  });

  test("/territoire/boulonnais : la page porte la couleur du territoire et en teinte des sections", async ({ page }) => {
    await page.goto("/territoire/boulonnais", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    const accent = await page.locator("main").evaluate((m) => getComputedStyle(m).getPropertyValue("--page-accent").trim());
    expect(accent, "l'accent de la page est la couleur du territoire").toBe("#c34a42");

    // Deux bandeaux teintés (agenda du territoire, communes) se distinguent du fond de page.
    const fonds = await page.evaluate(() => {
      const fond = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : "");
      const sections = [...document.querySelectorAll("[data-section-index]")];
      const teinte = (type: string) => fond(sections.find((d) => (d as HTMLElement).dataset.sectionType === type)?.querySelector("section") ?? null);
      return {
        page: fond(document.body),
        agenda: teinte("agenda"),
        accordion: teinte("accordion"),
        filtres: teinte("searchHeader"),
      };
    });
    expect(fonds.agenda, "l'agenda est teinté").not.toBe(fonds.page);
    expect(fonds.accordion, "les communes sont teintées").toBe(fonds.agenda);
    expect(fonds.filtres, "les filtres d'actualités sont teintés").toBe(fonds.agenda);
  });

  test("/annuaire : bouton d'ajout, filtres, et liste qui ne montre que les fiches validées", async ({ page }) => {
    await page.goto("/annuaire", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Annuaire des partenaires" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ajouter un partenaire/ })).toBeVisible();
    const filtres = page.locator('[data-section-type="filters"]');
    for (const groupe of ["Territoire", "Type de structure", "Public", "Thèmes"]) {
      await expect(filtres.getByText(groupe, { exact: true }).first()).toBeVisible();
    }

    // Une fiche proposée porte `toBeValidated` : sans `costumSlug`, la liste n'envoie pas la porte de
    // validation et la fiche s'afficherait dès sa création, avant tout contrôle.
    const recherche = page.waitForRequest(
      (r) => r.url().includes("globalautocomplete") && decodeURIComponent(r.postData() ?? "").includes("filters[type]"),
    );
    await filtres.getByText("Association", { exact: true }).click();
    const corps = decodeURIComponent((await recherche).postData() ?? "");
    expect(corps).toContain("filters[type][$in][]=NGO");
    expect(corps).toContain("filters[preferences.toBeValidated.parent62][$exists]=false");
    expect(corps).toContain("searchType[]=organizations");
  });

  test("/blog : le filtre « Villes » propose les villes des territoires et filtre sur la ville de l'adresse", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await page.getByRole("button", { name: /^Villes/ }).first().click();
    await page.getByPlaceholder("Rechercher…").last().fill("Arras");
    const arras = page.getByRole("option", { name: "Arras", exact: true });
    await expect(arras).toBeVisible();

    const recherche = page.waitForRequest(
      (r) => r.url().includes("globalautocomplete") && decodeURIComponent(r.postData() ?? "").includes("filters[address.addressLocality]"),
    );
    await arras.click();
    const corps = decodeURIComponent((await recherche).postData() ?? "");
    expect(corps).toContain("filters[address.addressLocality][$in][]=Arras");
    // Le fil reste borné aux actualités : un filtre de page ne peut pas écraser `type`.
    expect(corps).toContain("filters[type]=article");
    await expect(page).toHaveURL(/ville=arras/);
  });

  test("/agenda : le filtre « Villes » (même liste que /blog) applique le paramètre d'URL", async ({ page }) => {
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    await page.getByRole("button", { name: /^Villes/ }).first().click();
    await page.getByPlaceholder("Rechercher…").last().fill("Arras");
    const arras = page.getByRole("option", { name: "Arras", exact: true });
    await expect(arras).toBeVisible();
    await arras.click();
    await expect(page).toHaveURL(/ville=arras/);
  });

  test("accueil : le menu se centre sous le logo et le titre du bandeau, sans « Ctrl+K »", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);

    // Aucun déclencheur de palette de commandes dans la barre : la loupe (nav « Recherche »,
    // `placement: "actions"`) le remplace — cf. `HeaderStacked`.
    await expect(page.locator("nav.sticky kbd", { hasText: /Ctrl|⌘/ })).toHaveCount(0);
    const loupe = page.locator('nav.sticky a[aria-label="Recherche"]').first();
    await expect(loupe).toHaveAttribute("href", "/recherche");

    // Le menu centré (colonnes de flanc `1fr` égales) tombe exactement sous le centre du bandeau
    // wordmark au-dessus — décalé dès que les deux colonnes de flanc n'ont pas la même largeur
    // (l'ancien `auto_1fr_auto`, qui centrait dans l'espace RESTANT après le logo).
    const ecart = await page.evaluate(() => {
      const wordmark = document.querySelector("header .relative.flex.flex-col.items-center")!;
      const menu = [...document.querySelectorAll("nav.sticky .grid > div")].find(
        (d) => d.className.includes("xl:flex") && d.className.includes("justify-center"),
      )!;
      const w = wordmark.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      return Math.round(w.left + w.width / 2 - (m.left + m.width / 2));
    });
    expect(Math.abs(ecart), "menu centré sous le logo/titre à 1440px").toBeLessThanOrEqual(2);
  });

  for (const url of ["/parents", "/pro"]) {
    test(`${url} : « Par où commencer ? » — 4 cases sur une rangée, de même hauteur, icônes alignées`, async ({ page }) => {
      // Un titre qui passe sur une ligne de plus ne doit ni faire dépasser sa case ni décaler l'icône voisine.
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await waitForHydration(page);

      const tuiles = page.locator('[data-section-type="action-tiles"] a > button');
      await expect(tuiles).toHaveCount(4);
      const boites = await tuiles.evaluateAll((els) =>
        els.map((el) => {
          const tuile = el.getBoundingClientRect();
          const icone = el.querySelector("svg")?.getBoundingClientRect();
          return { y: Math.round(tuile.y), h: Math.round(tuile.height), iconeY: icone && Math.round(icone.y) };
        }),
      );
      expect(new Set(boites.map((b) => b.y)).size, "une seule rangée").toBe(1);
      expect(new Set(boites.map((b) => b.h)).size, "même hauteur").toBe(1);
      expect(new Set(boites.map((b) => b.iconeY)).size, "icônes alignées").toBe(1);
    });
  }
});
