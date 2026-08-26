import { describe, it, expect } from "vitest";

import { parseLegacyHash } from "../legacyEmailHash";

/**
 * Contrat d'URL des DEEP-LINKS EN FRAGMENT des e-mails legacy.
 *
 * Les formes testées ici sont relevées TELLES QUELLES dans les templates du legacy
 * (`pixelhumain/ph/protected/views/emails/*.php`) — ce sont des e-mails **déjà envoyés** :
 * si le parseur cesse de les reconnaître, ces liens retombent silencieusement sur l'accueil.
 * Cf. `cocolight-backend/docs/24-EMAILS-LIENS-AUDIT.md` (AXE 2, dette hash).
 */
const ID = "6a756553a27baaaea9912ea7";

describe("parseLegacyHash — formes réelles des templates legacy", () => {
  it("confirmYouTo / referenceEmailInElement / inviteYouTo : #page.type.<coll>.id.<id>", () => {
    // confirmYouTo.php:11 · referenceEmailInElement.php:9 · inviteYouTo.php:9
    for (const type of ["organizations", "projects", "events", "poi", "citoyens"]) {
      expect(parseLegacyHash(`#page.type.${type}.id.${ID}`)).toEqual({
        kind: "element", type, id: ID, view: null,
      });
    }
  });

  it("milestoneProgression : projet, avec ou sans « # » de tête", () => {
    // milestoneProgression.php:7 — `$urlRedirect."/#page.type.projects.id.".$projectId`
    expect(parseLegacyHash(`page.type.projects.id.${ID}`)).toEqual({
      kind: "element", type: "projects", id: ID, view: null,
    });
  });

  it("askToBecome : suffixe .view.directory.dir.<dir> → vue « directory » retenue, params ignorés", () => {
    // askToBecome.php:47 — `.view.directory.dir.".$dir`
    expect(parseLegacyHash(`#page.type.organizations.id.${ID}.view.directory.dir.members`)).toEqual({
      kind: "element", type: "organizations", id: ID, view: "directory",
    });
  });

  it("passwordRetreive : #page.type.citoyens.id.<id>.view.settings", () => {
    // passwordRetreive.php:11
    expect(parseLegacyHash(`#page.type.citoyens.id.${ID}.view.settings`)).toEqual({
      kind: "element", type: "citoyens", id: ID, view: "settings",
    });
  });

  it("#@slug → profil par slug, sans appel réseau", () => {
    expect(parseLegacyHash("#@mon-tiers-lieu")).toEqual({ kind: "slug", slug: "mon-tiers-lieu" });
    expect(parseLegacyHash("#@monTiersLieu_2")).toEqual({ kind: "slug", slug: "monTiersLieu_2" });
  });

  it("fragment percent-encodé (certains clients mail ré-encodent le lien)", () => {
    // `@` encodé en %40 — le parseur décode avant d'analyser.
    expect(parseLegacyHash("#%40mon-tiers-lieu")).toEqual({ kind: "slug", slug: "mon-tiers-lieu" });
  });
});

describe("parseLegacyHash — ce qu'il ne faut SURTOUT pas détourner", () => {
  it("ancres de page normales", () => {
    for (const h of ["#contact", "#section-2", "#top", ""]) {
      expect(parseLegacyHash(h)).toBeNull();
    }
  });

  it("hash applicatifs du legacy hors périmètre (admin, news, element.remove…)", () => {
    // reservations.php `#admin.view.circuits` · helpAndDebugNews `#news.index.type.pixels`
    for (const h of ["#admin.view.circuits", "#admin.directory", "#news.index.type.pixels", `#element.remove.id.${ID}`]) {
      expect(parseLegacyHash(h)).toBeNull();
    }
  });

  it("collections NON routables vers /profil (classifieds, cms…)", () => {
    // bookmarkNotif.php:41 pointe des `classifieds` : pas de fiche profil → on ne détourne pas.
    expect(parseLegacyHash(`#page.type.classifieds.id.${ID}`)).toBeNull();
    expect(parseLegacyHash(`#page.type.cms.id.${ID}`)).toBeNull();
  });

  it("id malformé (pas un ObjectId) → ignoré", () => {
    expect(parseLegacyHash("#page.type.projects.id.42")).toBeNull();
    expect(parseLegacyHash("#page.type.projects.id.")).toBeNull();
  });

  it("entrées vides / nulles", () => {
    expect(parseLegacyHash(null)).toBeNull();
    expect(parseLegacyHash(undefined)).toBeNull();
    expect(parseLegacyHash("#")).toBeNull();
  });

  it("RÉGRESSION — un « % » non décodable ne doit JAMAIS lever", () => {
    // `decodeURIComponent("100%")` lève URIError. Ce parseur tourne dans un effet monté à la RACINE,
    // sous l'ErrorBoundary de RootLayout : une exception remplacerait TOUT le site par un écran
    // d'erreur… pour une simple ancre de page. Cf. review du 2026-08-11.
    for (const h of ["#100%", "#soldes-50%", "#caf%E9", "#%", "#%zz", "#a%E0%A4"]) {
      expect(() => parseLegacyHash(h), h).not.toThrow();
      expect(parseLegacyHash(h), h).toBeNull();
    }
  });
});

describe("parseLegacyHash — suffixes legacy sur #@slug", () => {
  it("#@<slug>.view.forms.dir.answer.<id> → le SLUG est extrait (4 590 des 4 591 liens réels)", () => {
    // Forme dominante en file (`Mail::urlMailNotif`) : le suffixe n'a pas d'équivalent site-json,
    // on ouvre la fiche du porteur — plus proche que l'accueil.
    expect(parseLegacyHash("#@ctenat.view.forms.dir.answer.61ba20cfccc8fd6bec4c96e5"))
      .toEqual({ kind: "slug", slug: "ctenat" });
    expect(parseLegacyHash("#@LaReunionDesTiersLieux.view.forms.dir.answer.61b97f68979c940b441f90d7"))
      .toEqual({ kind: "slug", slug: "LaReunionDesTiersLieux" });
  });
});
