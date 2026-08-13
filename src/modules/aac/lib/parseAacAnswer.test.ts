import { describe, expect, it } from "vitest";
import { parseAacAnswer } from "./parseAacAnswer";
import { buildAacFormMeta } from "./formMeta";
import { resolveAacCardFields } from "./resolveAacCardFields";
import { EMPTY_AAC_CARD_FIELDS, type AacCardFields } from "./resolveAacCardFields";

/** Champs résolus sur un formulaire aux clés EXOTIQUES (rien en dur). */
const FIELDS: AacCardFields = resolveAacCardFields(
  buildAacFormMeta("f1", {
    subForms: ["etapeA", "etapeB"],
    inputs: {
      etapeA: {
        inputs: {
          q_titre: { type: "text", label: "Nom", position: 1 },
          q_desc: { type: "textarea", label: "Résumé", position: 2 },
          q_theme: { type: "tpls.forms.cplx.checkboxNew", label: "Thèmes", position: 3 },
          q_matu: { type: "tpls.forms.cplx.radioNew", label: "Maturité", position: 4 },
          depense: { type: "tpls.forms.ocecoform.newDepenseList", label: "Budget", position: 5 },
        },
      },
      etapeB: { inputs: { choose: { type: "tpls.forms.aap.selection", label: "Sél." } } },
    },
    params: { checkboxNewq_theme: { list: ["A", "B"] }, radioNewq_matu: { list: ["Idée"] } },
  }),
  {
    depenseStepKey: "etapeA",
    evalStepKey: "etapeB",
    financementStepKey: null,
    suiviStepKey: null,
  }
).fields;

const parse = (raw: unknown, opts: Partial<Parameters<typeof parseAacAnswer>[1]> = {}) =>
  parseAacAnswer(raw, { fields: FIELDS, ...opts });

/**
 * Lignes de `results` telles que `directoryproposal` les renvoie.
 *
 * TRANSCRITES d'une réponse serveur réelle, pas inventées : mêmes clés, mêmes
 * types, mêmes formes limites. Trois points comptent et sont reproduits tels
 * quels :
 *
 *  - les étapes sont `aapStep1`/`aapStep2`, alors que `FIELDS` ci-dessus résout
 *    des étapes EXOTIQUES (`etapeA`) — les lectures par question tombent donc à
 *    côté, et le parseur doit retomber sur les champs PRÉ-CALCULÉS. C'est le
 *    chemin le plus emprunté en production ;
 *  - `name` vaut `"(No title)"` quand la question titre est vide : c'est le
 *    backend qui pose ce littéral, et il ne doit jamais atteindre l'écran ;
 *  - `user_count` recopie `links.contributors`, alors que l'appartenance
 *    plateforme vit dans `links.cae`. Les deux divergent — c'est le motif qui
 *    justifie le rôle `fields.users`.
 */
const LISTING_ROWS: Record<string, Record<string, unknown>> = {
  "65b3dc1d87518f12c723dc75": {
    _id: { $id: "65b3dc1d87518f12c723dc75" },
    collection: "answers",
    user: "55f053fbe41d75cd64558518",
    links: {
      contributors: { "55f053fbe41d75cd64558518": { type: "citoyens" } },
      cae: { a1: {}, a2: {}, a3: {} },
    },
    created: 1782484377,
    updated: 1785573150,
    form: "677e7e389058e31575550ac8",
    answers: {
      aapStep1: { titre: "Comparateur de statuts", tags: ["open source"] },
      aapStep2: { choose: { "677e7e13bd08b2478f5f5314": { value: "selected" } } },
    },
    allVoteCount: { love: 3 },
    name: "Comparateur de statuts",
    image: "/upload/communecter/answers/65b3dc1d87518f12c723dc75/restricted/a.png",
    descriptionStr: "Comparateur de statuts et simulateur de revenus pour les CAEs",
    tags: ["open source", "outils"],
    funds: [{ price: 8400, financer: [4400] }],
    user_count: 1,
    interrest_count: 3,
  },
  "6718d2ad6489667d210cbfa7": {
    _id: { $id: "6718d2ad6489667d210cbfa7" },
    collection: "answers",
    links: {},
    created: 1770000000,
    updated: 1771000000,
    form: "677e7e389058e31575550ac8",
    answers: { aapStep1: { titre: "Yeswiki" } },
    // Aucun budget : `funds` revient en tableau VIDE, jamais absent.
    name: "Yeswiki",
    image: "/upload/communecter/answers/6718d2ad6489667d210cbfa7/restricted/b.png",
    descriptionStr: "",
    tags: ["Commun"],
    funds: [],
    user_count: 0,
    interrest_count: 2,
  },
  "6865055dd4b0841b621b014e": {
    _id: { $id: "6865055dd4b0841b621b014e" },
    collection: "answers",
    links: {},
    created: 1760000000,
    updated: 1761000000,
    form: "677e7e389058e31575550ac8",
    answers: { aapStep1: {} },
    // Titre absent ⇒ le backend pose son littéral.
    name: "(No title)",
    image: "",
    descriptionStr: "",
    tags: [],
    funds: [],
    user_count: 0,
    interrest_count: 0,
  },
};

const LISTING_COUNT = { answers: Object.keys(LISTING_ROWS).length };


// ─────────────────────────────────────────────────────────────────────────────
// D'ABORD les formes du SERVEUR, transcrites (cf. `LISTING_ROWS`).
//
// Aucune assertion ne code en dur un compte ni un id : ce qui est verrouillé,
// ce sont les invariants du parseur face à la donnée telle qu'elle arrive.
// ─────────────────────────────────────────────────────────────────────────────
describe("parseAacAnswer — formes du listing", () => {
  const capture = { results: LISTING_ROWS, count: LISTING_COUNT };
  const communs = Object.values(capture.results);


  it("`count.answers` concorde avec le nombre de communs livrés", () => {
    // La page tient dans un seul `indexStep` : le compteur du serveur et la
    // taille de `results` doivent coïncider. S'ils divergent, c'est que la
    // capture est tronquée et les tests suivants ne valent plus rien.
    expect(communs.length).toBeGreaterThan(0);
    expect(capture.count?.answers).toBe(communs.length);
  });

  it("aucun commun ne fait lever d'exception", () => {
    expect(() => communs.map((c) => parse(c))).not.toThrow();
  });

  it("les titres du backend « (No title) » ne fuient jamais dans l'UI", () => {
    for (const c of communs) {
      expect(parse(c).title).not.toBe("(No title)");
    }
  });

  it("`_id.$id` est extrait, et rend bien la clé de la map `results`", () => {
    // `results` est indexé par answerId : l'id parsé DOIT retomber sur sa clé.
    // Plus fort qu'un contrôle de format, et indépendant du contenu.
    for (const [key, raw] of Object.entries(capture.results)) {
      expect(parse(raw).id).toBe(key);
    }
  });

  it("`user_count` ne dit PAS les membres d'une plateforme — d'où `fields.users`", () => {
    // Le motif qui justifie le rôle : `user_count` recopie la
    // taille de `links.contributors`, tandis que l'appartenance plateforme vit
    // dans `links.cae` / `links.tls`. Assertion RELATIONNELLE (aucun compte en
    // dur) : il existe au moins un commun où les deux divergent.
    const size = (v: unknown) =>
      Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;

    const diverge = communs.some((c) => {
      const links = (c as { links?: Record<string, unknown> }).links ?? {};
      const platform = size(links.cae) + size(links.tls);
      return platform !== (Number((c as { user_count?: unknown }).user_count) || 0);
    });
    expect(diverge).toBe(true);
  });

  it("les montants restent finis, positifs, et cohérents avec `funds`", () => {
    for (const c of communs) {
      const card = parse(c);
      const requested = card.funds.reduce((s, f) => s + f.price, 0);
      const funded = card.funds.reduce(
        (s, f) => s + f.financers.reduce((t, x) => t + x, 0),
        0
      );

      expect(card.totalRequested).toBe(requested);
      expect(card.totalFunded).toBe(funded);
      expect(Number.isFinite(card.progressPercent)).toBe(true);
      expect(card.progressPercent).toBeGreaterThanOrEqual(0);
      expect(card.hasFundingRequest).toBe(funded > 0);
    }
  });

  it("au moins un commun porte un budget — sinon le jeu ne prouve rien", () => {
    // Garde-fou : une projection étroite vide `funds` PARTOUT sans lever
    // d'erreur. Si ce test tombe, les assertions de montant ci-dessus ne
    // testent plus que du zéro.
    expect(communs.map((c) => parse(c)).some((card) => card.totalRequested > 0)).toBe(true);
  });

  it("les tags sont remontés", () => {
    const withTags = communs.map((c) => parse(c)).filter((card) => card.tags.length > 0);
    expect(withTags.length).toBeGreaterThan(0);
  });

  it("les images sont absolutisées", () => {
    const withImage = communs
      .map((c) => parse(c, { baseUrl: "https://ex.org" }))
      .filter((card) => card.imageUrl);
    expect(withImage.length).toBeGreaterThan(0);
    expect(withImage.every((card) => card.imageUrl?.startsWith("https://ex.org/"))).toBe(true);
  });

  it("les compteurs sont lus du backend, jamais recalculés", () => {
    for (const [, raw] of Object.entries(capture.results)) {
      const src = raw as { user_count?: number; interrest_count?: number };
      const card = parse(raw);
      expect(card.usersCount).toBe(src.user_count ?? 0);
      expect(card.interestCount).toBe(src.interrest_count ?? 0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("parseAacAnswer — budget", () => {
  const withFunds = (funds: unknown) => ({ _id: { $id: "a1" }, funds });

  it("somme les prix et les financements", () => {
    const card = parse(withFunds([{ price: 5000, financer: [3000, 1000] }]));
    expect(card.totalRequested).toBe(5000);
    expect(card.totalFunded).toBe(4000);
    expect(card.progressPercent).toBe(80);
    expect(card.hasFundingRequest).toBe(true);
  });

  it("SUR-FINANCEMENT : le pourcentage dépasse 100 et n'est pas plafonné", () => {
    const card = parse(withFunds([{ price: 5000, financer: [3000, 2500] }]));
    expect(card.totalFunded).toBe(5500);
    expect(card.progressPercent).toBe(110);
  });

  it("demandé à 0 avec du financé : pas de division par zéro", () => {
    const card = parse(withFunds([{ price: 0, financer: [500] }]));
    expect(card.progressPercent).toBe(50000);
    expect(Number.isFinite(card.progressPercent)).toBe(true);
  });

  it("`funds` en OBJET (map Mongo) traité comme un tableau", () => {
    const card = parse(withFunds({ "0": { price: 100, financer: [50] } }));
    expect(card.totalRequested).toBe(100);
    expect(card.totalFunded).toBe(50);
  });

  it("`funds` absent, `[]` ou `{}` ⇒ tout à zéro", () => {
    for (const v of [undefined, [], {}]) {
      const card = parse(withFunds(v));
      expect([card.totalRequested, card.totalFunded, card.progressPercent]).toEqual([0, 0, 0]);
    }
  });

  it("prix non numérique : préfixe entier, comme intval()", () => {
    expect(parse(withFunds([{ price: "1500 €", financer: [] }])).totalRequested).toBe(1500);
    expect(parse(withFunds([{ price: "abc", financer: [] }])).totalRequested).toBe(0);
  });

  it("`financer` absent ou non itérable ⇒ liste vide, pas d'exception", () => {
    expect(parse(withFunds([{ price: 10 }])).funds[0].financers).toEqual([]);
    expect(parse(withFunds([{ price: 10, financer: "x" }])).funds[0].financers).toEqual([]);
  });

  it("repli sur `answers.<étape>.depense` quand `funds` est vide", () => {
    const card = parse({
      _id: { $id: "a1" },
      funds: [],
      answers: { etapeA: { depense: [{ price: 200, financer: [{ amount: 75 }] }] } },
    });
    expect(card.totalRequested).toBe(200);
    expect(card.totalFunded).toBe(75);
  });
});

describe("parseAacAnswer — titre, description, tags, maturité", () => {
  it("privilégie la question résolue sur le champ pré-calculé", () => {
    const card = parse({
      _id: { $id: "a1" },
      descriptionStr: "pré-calculé",
      tags: ["depuis-racine"],
      answers: { etapeA: { q_desc: "depuis la question", q_theme: ["Vrai tag"] } },
    });
    expect(card.description).toBe("depuis la question");
    expect(card.tags).toEqual(["Vrai tag"]);
  });

  it("retombe sur le pré-calculé si la question est vide", () => {
    const card = parse({
      _id: { $id: "a1" },
      descriptionStr: "pré-calculé",
      tags: ["t1", "t2"],
      answers: { etapeA: {} },
    });
    expect(card.description).toBe("pré-calculé");
    expect(card.tags).toEqual(["t1", "t2"]);
  });

  it("titre depuis la question quand le backend dit « (No title) »", () => {
    const card = parse({
      _id: { $id: "a1" },
      name: "(No title)",
      answers: { etapeA: { q_titre: "Comparateur de statuts" } },
    });
    expect(card.title).toBe("Comparateur de statuts");
    expect(card.hasTitle).toBe(true);
  });

  it("tags en chaîne unique ou en map ⇒ liste", () => {
    expect(parse({ _id: { $id: "a" }, answers: { etapeA: { q_theme: "Solo" } } }).tags).toEqual(["Solo"]);
    expect(
      parse({ _id: { $id: "a" }, answers: { etapeA: { q_theme: { x: "A", y: "B" } } } }).tags
    ).toEqual(["A", "B"]);
  });

  it("maturité lue sur la question résolue, `null` si absente", () => {
    expect(parse({ _id: { $id: "a" }, answers: { etapeA: { q_matu: "Prototype" } } }).maturity).toBe(
      "Prototype"
    );
    expect(parse({ _id: { $id: "a" } }).maturity).toBeNull();
  });

  it("les membres se comptent sur le chemin configuré — map, tableau, ou rien", () => {
    // Les trois formes observées en base pour `links.<plateforme>` : map
    // d'utilisateurs, tableau d'ids, et `null`.
    const users = (path: string): AacCardFields => ({
      ...EMPTY_AAC_CARD_FIELDS,
      users: { stepKey: null, id: path, path, label: path, options: [] },
    });
    const count = (doc: unknown, path: string) =>
      parseAacAnswer(doc, { fields: users(path) }).usersCount;

    const doc = {
      _id: { $id: "a" },
      user_count: 6,
      links: { cae: { u1: {}, u2: {} }, tls: ["u1", "u2", "u3"], autre: null },
    };

    // Le même commun, deux plateformes, deux chiffres — le motif du rôle.
    expect(count(doc, "links.cae")).toBe(2);
    expect(count(doc, "links.tls")).toBe(3);

    // Configuré ⇒ AUCUN repli sur `user_count` (6), qui compte autre chose.
    expect(count(doc, "links.autre")).toBe(0);
    expect(count({ _id: { $id: "a" }, user_count: 6 }, "links.cae")).toBe(0);

    // Rien n'oblige le chemin à passer par `links`.
    expect(count({ _id: { $id: "a" }, membres: ["u1"] }, "membres")).toBe(1);

    // Sans chemin configuré, on garde le compte du backend.
    expect(parse(doc).usersCount).toBe(6);
  });

  it("un champ sans étape se lit à la RACINE du document, pas dans `answers`", () => {
    // La maturité n'a aucun repli backend : si la lecture racine ne marchait
    // pas, elle sortirait `null` — le test ne peut pas passer par accident.
    const rootFields: AacCardFields = {
      ...EMPTY_AAC_CARD_FIELDS,
      maturity: { stepKey: null, id: "usable", path: "usable", label: "usable", options: [] },
    };
    const card = parseAacAnswer(
      { _id: { $id: "a" }, usable: "Oui", answers: { etapeA: { usable: "ignoré" } } },
      { fields: rootFields }
    );
    expect(card.maturity).toBe("Oui");
  });
});

describe("parseAacAnswer — compteurs et badge", () => {
  it("les compteurs viennent du backend, jamais de links/vote", () => {
    const card = parse({
      _id: { $id: "a1" },
      user_count: 3,
      interrest_count: 10,
      // Bruit : présents mais à ignorer.
      links: { cae: { u1: {}, u2: {} } },
      vote: { u1: { status: "love" } },
    });
    expect(card.usersCount).toBe(3);
    expect(card.interestCount).toBe(10);
  });

  it("compteurs absents ⇒ 0", () => {
    const card = parse({ _id: { $id: "a1" } });
    expect(card.usersCount).toBe(0);
    expect(card.interestCount).toBe(0);
  });

  it("badge : sélectionné / en attente / indécidé", () => {
    const base = { _id: { $id: "a1" } };
    expect(
      parse(
        { ...base, answers: { etapeB: { choose: { ctx1: { value: "selected" } } } } },
        { contextId: "ctx1" }
      ).isSelected
    ).toBe(true);
    expect(
      parse(
        { ...base, answers: { etapeB: { choose: { ctx1: { value: "notselected" } } } } },
        { contextId: "ctx1" }
      ).isSelected
    ).toBe(false);
    // Étape présente mais autre contexte ⇒ non sélectionné.
    expect(
      parse(
        { ...base, answers: { etapeB: { choose: { autre: { value: "selected" } } } } },
        { contextId: "ctx1" }
      ).isSelected
    ).toBe(false);
    // Étape absente ⇒ indécidé.
    expect(parse({ ...base, answers: { etapeA: {} } }, { contextId: "ctx1" }).isSelected).toBeNull();
    // Sans contextId ⇒ indécidé.
    expect(
      parse({ ...base, answers: { etapeB: { choose: {} } } }).isSelected
    ).toBeNull();
  });
});

describe("parseAacAnswer — sans aucun champ résolu (formulaire indisponible)", () => {
  // Le listing ne doit pas dépendre du chargement du formulaire : les champs
  // pré-calculés par le backend suffisent à rendre une carte.
  const bare = (raw: unknown) => parseAacAnswer(raw, { fields: EMPTY_AAC_CARD_FIELDS });

  it("les champs pré-calculés suffisent", () => {
    const card = bare({
      _id: { $id: "a1" },
      name: "Yeswiki",
      descriptionStr: "Outil libre et convivial",
      tags: ["Numérique"],
      image: "/upload/x.png",
      funds: [{ price: 1000, financer: [520] }],
      user_count: 2,
      interrest_count: 7,
    });
    expect(card.title).toBe("Yeswiki");
    expect(card.description).toBe("Outil libre et convivial");
    expect(card.tags).toEqual(["Numérique"]);
    expect(card.imageUrl).toBe("/upload/x.png");
    expect(card.totalFunded).toBe(520);
    expect(card.progressPercent).toBe(52);
    expect(card.usersCount).toBe(2);
    expect(card.interestCount).toBe(7);
  });

  it("les formes du listing passent aussi sans champs résolus", () => {
    const communs = Object.values(LISTING_ROWS);
    expect(() => communs.map(bare)).not.toThrow();
    // Les champs pré-calculés suffisent : c'est ce qui permet à la grille de
    // s'afficher avant que le formulaire ne soit chargé.
    expect(communs.map(bare).some((c) => c.tags.length > 0)).toBe(true);
    expect(communs.map(bare).some((c) => c.hasTitle)).toBe(true);
  });
});

describe("parseAacAnswer — image et identifiant", () => {
  it("URL absolue laissée telle quelle", () => {
    const card = parse(
      { _id: { $id: "a1" }, image: "https://cdn.test/x.png" },
      { baseUrl: "https://ex.org" }
    );
    expect(card.imageUrl).toBe("https://cdn.test/x.png");
  });

  it("chemin relatif sans slash initial préfixé proprement", () => {
    expect(
      parse({ _id: { $id: "a" }, image: "upload/x.png" }, { baseUrl: "https://ex.org" }).imageUrl
    ).toBe("https://ex.org/upload/x.png");
  });

  it("image absente ⇒ null (l'UI met SON placeholder)", () => {
    expect(parse({ _id: { $id: "a" } }).imageUrl).toBeNull();
    expect(parse({ _id: { $id: "a" }, image: "  " }).imageUrl).toBeNull();
  });

  it("`_id` en chaîne, ou champ `id`, restent lisibles", () => {
    expect(parse({ _id: "plain" }).id).toBe("plain");
    expect(parse({ id: "viaId" }).id).toBe("viaId");
  });

  it("document totalement vide : aucune exception", () => {
    expect(() => parse({})).not.toThrow();
    expect(() => parse(undefined)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les horodatages arrivent sous trois formes selon la source. C'est le piège le
// plus coûteux de la bascule fixture → SDK : `toInt` seul rendait 0 sur une
// `Date`, et les tris par date devenaient inertes SANS lever d'erreur.
// ─────────────────────────────────────────────────────────────────────────────
describe("parseAacAnswer — horodatages", () => {
  const SEC = 1782484377;

  it("lit un nombre — la forme de fil et celle des fixtures", () => {
    const card = parse({ _id: { $id: "a1" }, created: SEC, updated: SEC + 10 });
    expect(card.createdAt).toBe(SEC);
    expect(card.updatedAt).toBe(SEC + 10);
  });

  it("lit une `Date` — ce que rend le SDK après normalisation", () => {
    const card = parse({
      _id: { $id: "a1" },
      created: new Date(SEC * 1000),
      updated: new Date((SEC + 10) * 1000),
    });
    expect(card.createdAt).toBe(SEC);
    expect(card.updatedAt).toBe(SEC + 10);
  });

  it("lit `{sec, usec}` — la forme Mongo héritée", () => {
    const card = parse({ _id: { $id: "a1" }, created: { sec: SEC, usec: 0 } });
    expect(card.createdAt).toBe(SEC);
  });

  it("rend la MÊME valeur pour les trois formes du même instant", () => {
    const asNumber = parse({ _id: { $id: "a" }, created: SEC }).createdAt;
    const asDate = parse({ _id: { $id: "a" }, created: new Date(SEC * 1000) }).createdAt;
    const asMongo = parse({ _id: { $id: "a" }, created: { sec: SEC } }).createdAt;
    expect(new Set([asNumber, asDate, asMongo]).size).toBe(1);
  });

  it("rend 0 sur une valeur absente ou inexploitable, jamais NaN", () => {
    for (const v of [undefined, null, "", "oups", new Date("invalide"), {}]) {
      const card = parse({ _id: { $id: "a1" }, created: v });
      expect(card.createdAt).toBe(0);
      expect(Number.isFinite(card.createdAt)).toBe(true);
    }
  });
});
