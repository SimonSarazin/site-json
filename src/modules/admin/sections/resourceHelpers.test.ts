import { describe, it, expect, vi } from "vitest";
import type { AdminResourceSection } from "../schema";
import { resolveCreateModal, resolveEditModal, getPath, getColumnValue, formatCell, formatColumnCell, readStatusValue } from "./resourceHelpers";

/** Section resource minimale — cast : create/edit sont posés par les défauts zod à la validation. */
function section(over: Record<string, unknown> = {}): AdminResourceSection {
  return { type: "resource", entityType: "organizations", ...over } as AdminResourceSection;
}

describe("resolveCreateModal — choix costum/standard piloté par la config", () => {
  it("create:false → null (pas de création)", () => {
    expect(resolveCreateModal(section({ create: false }))).toBeNull();
  });

  it("create:\"standard\" → modale standard du type, même si un form costum existe", () => {
    const costumForms = { f1: { id: "equipements", entityType: "organizations" } };
    expect(resolveCreateModal(section({ create: "standard" }), costumForms)).toBe("add-organization");
  });

  it("create:\"standard\" sur un type sans modale standard → null", () => {
    expect(resolveCreateModal(section({ create: "standard", entityType: "answers" }))).toBeNull();
  });

  it("clé forcée explicite « add-xxx » → renvoyée telle quelle", () => {
    expect(resolveCreateModal(section({ create: "add-mon-form" }))).toBe("add-mon-form");
  });

  it("inherit sans costumForms → modale standard du type", () => {
    expect(resolveCreateModal(section({ entityType: "poi" }))).toBe("add-poi");
    expect(resolveCreateModal(section({ entityType: "events" }), null)).toBe("add-event");
    expect(resolveCreateModal(section({ entityType: "projects" }), {})).toBe("add-project");
  });

  it("inherit + form costum du type → « add-<id> » (le costum prime sur le standard)", () => {
    const costumForms = { doc1: { id: "equipements-sportifs", entityType: "poi" } };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms)).toBe(
      "add-equipements-sportifs",
    );
  });

  it("inherit + costumForms d'un AUTRE type → retombe sur la modale standard", () => {
    const costumForms = { doc1: { id: "equipements", entityType: "poi" } };
    expect(resolveCreateModal(section({ entityType: "organizations" }), costumForms)).toBe(
      "add-organization",
    );
  });

  it("inherit + type inconnu sans costum → null", () => {
    expect(resolveCreateModal(section({ entityType: "citoyens" }))).toBeNull();
  });

  it("plusieurs forms du type : le costumSlug du site est prioritaire", () => {
    const costumForms = {
      a: { id: "form-a", entityType: "poi", costumSlug: "autreSite" },
      b: { id: "form-b", entityType: "poi", costumSlug: "monSite" },
    };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms, "monSite")).toBe(
      "add-form-b",
    );
  });

  /**
   * NON-RÉGRESSION DE L'ORDRE DES CLÉS. Ces trois cas tenaient auparavant sur un `docs[0]` : le
   * formulaire ouvert par l'admin dépendait de l'ordre d'écriture dans le JSON, qu'aucun test ne
   * surveille et qu'un simple reformatage suffit à changer. Le départage est désormais explicite,
   * et l'ambiguïté irréductible rend la main au lieu de deviner.
   */
  describe("inherit — plusieurs forms du même type", () => {
    const deuxPoi = (over: Record<string, unknown> = {}) => ({
      equipements: { id: "equipements", entityType: "poi", costumSlug: "monSite", identity: { type: "recoveryCenter" }, ...over },
      articles: { id: "articles", entityType: "poi", costumSlug: "monSite", identity: { type: "article" } },
    });

    it("l'identity départage contre les defaultFilters de la resource", () => {
      const forms = deuxPoi();
      const equip = section({ entityType: "poi", source: { defaultFilters: { type: "recoveryCenter" } } });
      const artic = section({ entityType: "poi", source: { defaultFilters: { type: "article" } } });
      expect(resolveCreateModal(equip, forms, "monSite")).toBe("add-equipements");
      expect(resolveCreateModal(artic, forms, "monSite")).toBe("add-articles");
    });

    it("le résultat NE dépend PAS de l'ordre des clés JSON", () => {
      const { equipements, articles } = deuxPoi();
      const sec = section({ entityType: "poi", source: { defaultFilters: { type: "article" } } });
      expect(resolveCreateModal(sec, { equipements, articles }, "monSite")).toBe("add-articles");
      expect(resolveCreateModal(sec, { articles, equipements }, "monSite")).toBe("add-articles");
    });

    it("filtre en $in ou en tableau : l'identity matche aussi", () => {
      const forms = deuxPoi();
      const parIn = section({ entityType: "poi", source: { defaultFilters: { type: { $in: ["article", "autre"] } } } });
      expect(resolveCreateModal(parIn, forms, "monSite")).toBe("add-articles");
      const parTableau = section({ entityType: "poi", source: { defaultFilters: { type: ["article"] } } });
      expect(resolveCreateModal(parTableau, forms, "monSite")).toBe("add-articles");
    });

    it("ambiguïté irréductible → modale STANDARD et avertissement, jamais un choix arbitraire", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      // aucun defaultFilters : rien pour départager deux forms du site.
      expect(resolveCreateModal(section({ entityType: "poi" }), deuxPoi(), "monSite")).toBe("add-poi");
      // …et deux forms d'AUTRES costums : le siteSlug ne restreint rien non plus.
      const etrangers = {
        a: { id: "form-a", entityType: "poi", costumSlug: "autreSite" },
        b: { id: "form-b", entityType: "poi", costumSlug: "encoreUnAutre" },
      };
      expect(resolveCreateModal(section({ entityType: "poi" }), etrangers, "monSite")).toBe("add-poi");
      expect(warn).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it("un filtre que le départage ne sait pas lire ($regex) rend la main plutôt que de deviner", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const sec = section({ entityType: "poi", source: { defaultFilters: { type: { $regex: "^article" } } } });
      expect(resolveCreateModal(sec, deuxPoi(), "monSite")).toBe("add-poi");
      warn.mockRestore();
    });
  });

  it("doc sans id → retombe sur la clé du record", () => {
    const costumForms = { maCle: { entityType: "poi" } };
    expect(resolveCreateModal(section({ entityType: "poi" }), costumForms)).toBe("add-maCle");
  });

  it("create absent (défaut) se comporte comme inherit", () => {
    // section() ne pose pas create → branche `?? "inherit"`.
    expect(resolveCreateModal(section({ entityType: "events" }))).toBe("add-event");
  });
});

describe("resolveEditModal — même contrat de choix que create", () => {
  it("edit:false → désactivé", () => {
    expect(resolveEditModal(section({ edit: false }))).toEqual({ enabled: false, modalName: null });
  });

  it("edit:\"inherit\" → activé, modalName null (résolution publique DynamicEditModal)", () => {
    expect(resolveEditModal(section({ edit: "inherit" }))).toEqual({ enabled: true, modalName: null });
  });

  it("edit absent (défaut) → inherit (résolution publique)", () => {
    expect(resolveEditModal(section())).toEqual({ enabled: true, modalName: null });
  });

  it("edit:\"standard\" → form générique edit-profile forcé", () => {
    expect(resolveEditModal(section({ edit: "standard" }))).toEqual({
      enabled: true,
      modalName: "edit-profile",
    });
  });

  it("clé forcée explicite « edit-xxx » → renvoyée telle quelle", () => {
    expect(resolveEditModal(section({ edit: "edit-equipements" }))).toEqual({
      enabled: true,
      modalName: "edit-equipements",
    });
  });
});

describe("getPath — lecture d'un chemin pointé", () => {
  const doc = { name: "Foo", address: { city: "Paris", geo: { lat: 48.85 } }, tags: ["a", "b"] };

  it("chemin simple", () => {
    expect(getPath(doc, "name")).toBe("Foo");
  });

  it("chemin imbriqué à 2 et 3 niveaux", () => {
    expect(getPath(doc, "address.city")).toBe("Paris");
    expect(getPath(doc, "address.geo.lat")).toBe(48.85);
  });

  it("segment absent → undefined (sans lever)", () => {
    expect(getPath(doc, "address.postalCode")).toBeUndefined();
    expect(getPath(doc, "missing.deep.path")).toBeUndefined();
  });

  it("objet null/undefined → undefined", () => {
    expect(getPath(null, "a.b")).toBeUndefined();
    expect(getPath(undefined, "a")).toBeUndefined();
  });

  it("traversée d'un scalaire → undefined (pas de propriétés de string)", () => {
    expect(getPath(doc, "name.length")).toBeUndefined();
  });

  it("index de tableau accessible comme clé", () => {
    expect(getPath(doc, "tags.1")).toBe("b");
  });
});

describe("getColumnValue — colonne startDate : repli vers l'occurrence d'un récurrent", () => {
  it("colonne autre que startDate → identique à getPath", () => {
    expect(getColumnValue({ name: "Foo" }, "name")).toBe("Foo");
  });

  it("ponctuel : startDate déjà présent → inchangé", () => {
    const d = new Date("2026-08-14T09:00:00Z");
    expect(getColumnValue({ startDate: d }, "startDate")).toBe(d);
  });

  it("récurrent : pas de startDate → repli sur startDateSortFormat", () => {
    const value = getColumnValue(
      { startDateSort: { date: "2026-08-14 09:00:00.000000" }, startDateSortFormat: "2026-08-14T09:00:00+0200" },
      "startDate",
    );
    expect((value as Date).toISOString()).toBe("2026-08-14T07:00:00.000Z");
  });

  it("ni l'un ni l'autre (autre type d'entité) → null", () => {
    expect(getColumnValue({ name: "Foo" }, "startDate")).toBeNull();
  });
});

/** `t` factice fr, fidèle aux clés réelles (`modules/search/i18n/fr.json`). */
const tFr = (key: string, _fallback?: string, params?: Record<string, unknown>) => {
  const dict: Record<string, string> = { "days.wednesday": "Mercredi", "card.event.recurringAnd": "et" };
  return key === "card.event.recurring" ? `Chaque ${params?.days ?? ""}` : (dict[key] ?? key);
};

describe("formatColumnCell — cellule startDate, avec repli récurrent (admin : searchCostum ne calcule pas d'occurrence)", () => {
  it("colonne autre que startDate → identique à formatCell(getColumnValue(...))", () => {
    expect(formatColumnCell({ name: "Foo" }, "name", tFr)).toBe("Foo");
  });

  it("ponctuel : startDate présent → date formatée normalement", () => {
    expect(formatColumnCell({ startDate: new Date("2026-08-14T09:00:00Z") }, "startDate", tFr)).toContain("2026");
  });

  it("récurrent : ni startDate ni startDateSort/Format (cas réel admin) → libellé de récurrence", () => {
    const row = { recurrency: true, openingHours: [{ dayOfWeek: "We", hours: [{ opens: "08:00", closes: "19:00" }] }] };
    expect(formatColumnCell(row, "startDate", tFr)).toBe("Chaque mercredi");
  });

  it("ni date ni récurrence exploitable → tiret (comme avant), pas de crash", () => {
    expect(formatColumnCell({ name: "Foo" }, "startDate", tFr)).toBe("—");
  });
});

describe("formatCell — rendu texte d'une cellule", () => {
  it("string et number → tels quels", () => {
    expect(formatCell("Foo")).toBe("Foo");
    expect(formatCell(0)).toBe("0");
    expect(formatCell(42.5)).toBe("42.5");
  });

  it("null/undefined → tiret cadratin", () => {
    expect(formatCell(null)).toBe("—");
    expect(formatCell(undefined)).toBe("—");
  });

  it("booléen → coche ou tiret", () => {
    expect(formatCell(true)).toBe("✓");
    expect(formatCell(false)).toBe("—");
  });

  it("objet quelconque → chaîne vide (une colonne ne rend pas une structure)", () => {
    // Les TABLEAUX, eux, sont désormais rendus : ce sont des champs multivalués ordinaires,
    // et les laisser vides masquait des données bien présentes (cf. bloc « champs MULTIVALUÉS »).
    expect(formatCell({ a: 1 })).toBe("");
  });
});

describe("formatCell — champs MULTIVALUÉS", () => {
  // Sans ce cas, la colonne « Organisme » de la bibliothèque restait VIDE alors que 610 des 686
  // documents en portent un : la valeur est un tableau, qui tombait dans le repli `""`.
  it("joint les valeurs d'un tableau de chaînes", () => {
    expect(formatCell(["APMR", "IFREMER"])).toBe("APMR, IFREMER");
  });

  it("un seul élément s'affiche seul", () => {
    expect(formatCell(["APMR"])).toBe("APMR");
  });

  it("tableau vide ou sans contenu utile → tiret, comme une valeur absente", () => {
    expect(formatCell([])).toBe("—");
    expect(formatCell([null, undefined])).toBe("—");
  });

  it("ignore les éléments non rendus plutôt que de laisser des séparateurs vides", () => {
    expect(formatCell(["APMR", null, "IFREMER"])).toBe("APMR, IFREMER");
  });
});

describe("readStatusValue — chemin Mongo imbriqué, repli clé feuille à plat", () => {
  const FIELD = "answers.sportSanteBienetre2172025_854_0.sportSanteBienetre2172025_854_0mdn1jcq445i0mb9bap7";

  it("lit le chemin complet quand le document est imbriqué (shape Mongo brute)", () => {
    const data = { answers: { sportSanteBienetre2172025_854_0: { sportSanteBienetre2172025_854_0mdn1jcq445i0mb9bap7: "Validé" } } };
    expect(readStatusValue(data, FIELD)).toBe("Validé");
  });

  it("replie sur la clé FEUILLE à plat (shape aplatie par le hook costum de recherche)", () => {
    const data = { sportSanteBienetre2172025_854_0mdn1jcq445i0mb9bap7: "En attente" };
    expect(readStatusValue(data, FIELD)).toBe("En attente");
  });

  it("champ absent des deux shapes → undefined (badge « Non renseigné »)", () => {
    expect(readStatusValue({ name: "x" }, FIELD)).toBeUndefined();
    expect(readStatusValue(undefined, FIELD)).toBeUndefined();
  });
});
