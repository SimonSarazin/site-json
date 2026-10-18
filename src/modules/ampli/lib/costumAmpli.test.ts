import { describe, expect, it } from "vitest";
import {
  ampliSourceMode,
  ampliTitle,
  collectAmpliTags,
  costumAmpliSlugs,
  filterAmplis,
  findAmpli,
  listAmplis,
  listCostumAmplis,
  resolveAmpliInput,
} from "./costumAmpli";
import type { AmpliModel } from "../types";

/**
 * Lecture des amplis d'un site. La fixture reprend le document RÉEL :
 * `costum.ampli.sinistre` tel que `element/about` le renvoie sur le backend de
 * dev (coform posé).
 */

const SINISTRE_PATH = {
  name: "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7khz08pr",
  description: "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7k7nhhzl",
  address: "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7kk0of9s",
  tags: "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7kmkg9ow",
  image: "franckiOrga27112025_0604_0.franckiOrga27112025_0604_0mih13r7k23mgbw",
};

const SINISTRE_ENTRY = {
  pages: ["#sinistre-welcome", "#messages-sinistre", "#reseau-sinistre", "#statistique-sinistre", "#actualites-sinistre"],
  description: "Sinistre config",
  tags: ["Sinistre", "Ampli", "Francki"],
  path: SINISTRE_PATH,
  slug: "sinistre",
  name: "Sinistre",
  home: "#sinistre-welcome",
  coform: "6927e9f0db22da724360303c",
};

const model = (overrides: Partial<AmpliModel> = {}): AmpliModel => ({
  key: "sinistre",
  slug: "sinistre",
  name: "Sinistre",
  description: "Sinistre config",
  tags: ["Sinistre", "Ampli", "Francki"],
  path: SINISTRE_PATH,
  coform: "6927e9f0db22da724360303c",
  ...overrides,
});

describe("ampliSourceMode", () => {
  it("seul `true` active les amplis", () => {
    expect(ampliSourceMode(true)).toBe("costum");
    expect(ampliSourceMode(false)).toBe("off");
    // La forme tableau historique a été retirée : une config restée dessus
    // n'active plus rien (elle ne décrit aucun ampli du costum).
    expect(ampliSourceMode([{ slug: "amplifions" }])).toBe("off");
    expect(ampliSourceMode(undefined)).toBe("off");
    // La config n'est pas parsée par Zod au runtime : une chaîne n'active rien.
    expect(ampliSourceMode("true")).toBe("off");
  });
});

describe("listCostumAmplis", () => {
  it("lit l'entrée réelle de costum.ampli", () => {
    expect(listCostumAmplis({ ampli: { sinistre: SINISTRE_ENTRY } })).toEqual([model()]);
  });

  it("rend une liste vide sans costum ou sans bloc ampli", () => {
    expect(listCostumAmplis(undefined)).toEqual([]);
    expect(listCostumAmplis({})).toEqual([]);
    expect(listCostumAmplis({ ampli: [] })).toEqual([]);
  });

  it("prend la clé comme slug quand le champ `slug` manque", () => {
    const { slug: _slug, ...withoutSlug } = SINISTRE_ENTRY;
    void _slug;
    const [ampli] = listCostumAmplis({ ampli: { "sinistre-bis": withoutSlug } });
    expect(ampli.slug).toBe("sinistre-bis");
  });

  // Le champ `slug` fait foi pour l'URL ; la CLÉ, elle, est ce que le backend
  // attend pour supprimer l'entrée — les deux doivent rester distincts.
  it("préfère le champ `slug` à la clé, et garde la clé à part", () => {
    const [ampli] = listCostumAmplis({ ampli: { autreCle: SINISTRE_ENTRY } });
    expect(ampli.slug).toBe("sinistre");
    expect(ampli.key).toBe("autreCle");
  });

  // Écarter une entrée incomplète la rendrait invisible pour la garde
  // anti-collision de la création, et le serveur l'écraserait sans prévenir.
  it("liste une entrée ancienne sans mapping ni formulaire, en non configurée", () => {
    const amplis = listCostumAmplis({
      ampli: {
        amplifiions: { name: "AMPLIFIIONS", description: "Amplifions le sens communs", tags: ["communs"] },
        sinistre: SINISTRE_ENTRY,
      },
    });

    expect(amplis.map((ampli) => ampli.slug)).toEqual(["amplifiions", "sinistre"]);
    expect(amplis[0]).toMatchObject({ key: "amplifiions", name: "AMPLIFIIONS", path: undefined, coform: null });
  });

  it("ignore une entrée qui n'est pas un objet", () => {
    const amplis = listCostumAmplis({ ampli: { casse: "pas un objet", sinistre: SINISTRE_ENTRY } });
    expect(amplis.map((ampli) => ampli.slug)).toEqual(["sinistre"]);
  });

  it("garde la première entrée quand deux partagent un slug", () => {
    const amplis = listCostumAmplis({
      ampli: {
        a: SINISTRE_ENTRY,
        b: { ...SINISTRE_ENTRY, name: "Doublon" },
      },
    });
    expect(amplis).toHaveLength(1);
    expect(amplis[0].name).toBe("Sinistre");
  });

  describe("formulaire", () => {
    it("reprend le coform de l'entrée", () => {
      expect(listCostumAmplis({ ampli: { sinistre: SINISTRE_ENTRY } })[0].coform).toBe("6927e9f0db22da724360303c");
    });

    // Décision : aucun repli sur les blocs CMS — un ampli sans coform reste
    // LISTÉ, sa page dit qu'il n'est pas configuré.
    it("un coform absent donne un ampli listé mais non configuré", () => {
      const { coform: _coform, ...sansCoform } = SINISTRE_ENTRY;
      void _coform;
      const amplis = listCostumAmplis({ ampli: { sinistre: sansCoform } });
      expect(amplis).toHaveLength(1);
      expect(amplis[0].coform).toBeNull();
    });

    it("un coform qui n'est pas un ObjectId est traité comme absent", () => {
      const [ampli] = listCostumAmplis({ ampli: { sinistre: { ...SINISTRE_ENTRY, coform: "pas-un-id" } } });
      expect(ampli.coform).toBeNull();
    });
  });

  describe("champs souples", () => {
    // Un tableau PHP à trous revient sérialisé en objet.
    it("accepte des tags sérialisés en objet, dédoublonne et retire les vides", () => {
      const [ampli] = listCostumAmplis({
        ampli: { sinistre: { ...SINISTRE_ENTRY, tags: { 0: "Ampli", 2: " Ampli ", 3: "", 4: 12 } } },
      });
      expect(ampli.tags).toEqual(["Ampli"]);
    });

    it("des tags illisibles ne font pas disparaître l'ampli", () => {
      const [ampli] = listCostumAmplis({ ampli: { sinistre: { ...SINISTRE_ENTRY, tags: "Ampli" } } });
      expect(ampli.tags).toEqual([]);
    });

    it("un nom vide est traité comme absent", () => {
      const [ampli] = listCostumAmplis({ ampli: { sinistre: { ...SINISTRE_ENTRY, name: "   " } } });
      expect(ampli.name).toBeUndefined();
      expect(ampliTitle(ampli)).toBe("sinistre");
    });
  });
});

describe("listAmplis", () => {
  it("ne lit le costum que si les amplis sont activés", () => {
    const costum = { ampli: { sinistre: SINISTRE_ENTRY } };
    expect(listAmplis(true, costum).map((ampli) => ampli.slug)).toEqual(["sinistre"]);
    expect(listAmplis(undefined, costum)).toEqual([]);
    expect(listAmplis([{ slug: "amplifions" }], costum)).toEqual([]);
  });
});

describe("costumAmpliSlugs", () => {
  // Lu sur la donnée BRUTE : une entrée illisible occupe quand même sa place en
  // base, et `createAmpli` l'écraserait sans prévenir.
  it("rend les clés ET les slugs déclarés, y compris ceux des entrées illisibles", () => {
    const pris = costumAmpliSlugs({
      ampli: {
        amplifiions: { slug: "amplifions", name: "AMPLIFIIONS" },
        sinistre: SINISTRE_ENTRY,
        casse: "pas un objet",
      },
    });

    expect(pris.sort()).toEqual(["amplifiions", "amplifions", "casse", "sinistre"]);
  });

  it("rend une liste vide sans costum", () => {
    expect(costumAmpliSlugs(undefined)).toEqual([]);
    expect(costumAmpliSlugs({ ampli: [] })).toEqual([]);
  });
});

describe("findAmpli / resolveAmpliInput", () => {
  const amplis = [model(), model({ slug: "amplifions", name: "Amplifions" })];

  it("trouve par slug exact", () => {
    expect(findAmpli(amplis, "amplifions")?.name).toBe("Amplifions");
    expect(findAmpli(amplis, "inconnu")).toBeNull();
  });

  it("résout une saisie libre : espaces et casse tolérés", () => {
    expect(resolveAmpliInput(amplis, "  Sinistre ")?.slug).toBe("sinistre");
  });

  it("rien pour une saisie vide ou inconnue", () => {
    expect(resolveAmpliInput(amplis, "   ")).toBeNull();
    expect(resolveAmpliInput(amplis, "inconnu")).toBeNull();
  });
});

describe("filterAmplis", () => {
  const amplis = [
    model(),
    model({ slug: "idees", name: "Idées citoyennes", description: "Pour la ville", tags: ["Ville"] }),
    model({ slug: "sans-nom", name: undefined, description: undefined, tags: [] }),
  ];
  const slugs = (list: AmpliModel[]) => list.map((ampli) => ampli.slug);

  it("sans filtre, tout passe", () => {
    expect(slugs(filterAmplis(amplis, {}))).toEqual(["sinistre", "idees", "sans-nom"]);
  });

  it("cherche dans le titre et la description, sans tenir compte de la casse ni des accents", () => {
    expect(slugs(filterAmplis(amplis, { query: "IDEE" }))).toEqual(["idees"]);
    expect(slugs(filterAmplis(amplis, { query: "ville" }))).toEqual(["idees"]);
  });

  it("cherche dans le slug quand l'ampli n'a pas de nom (c'est son titre affiché)", () => {
    expect(slugs(filterAmplis(amplis, { query: "sans-nom" }))).toEqual(["sans-nom"]);
  });

  it("combine les tags en OU", () => {
    expect(slugs(filterAmplis(amplis, { tags: ["Ville", "Francki"] }))).toEqual(["sinistre", "idees"]);
  });

  it("combine recherche ET tags", () => {
    expect(slugs(filterAmplis(amplis, { query: "sinistre", tags: ["Ville"] }))).toEqual([]);
  });
});

describe("collectAmpliTags", () => {
  it("union dédoublonnée et triée", () => {
    const amplis = [model({ tags: ["Sinistre", "Ampli"] }), model({ slug: "b", tags: ["Ampli", "Ville"] })];
    expect(collectAmpliTags(amplis)).toEqual(["Ampli", "Sinistre", "Ville"]);
  });
});
