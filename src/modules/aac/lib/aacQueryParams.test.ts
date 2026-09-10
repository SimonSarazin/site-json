import { describe, expect, it } from "vitest";
import { splitAacFilters, serverSortBy } from "./aacQueryParams";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "./filtersKey";
import {
  EMPTY_AAC_CARD_FIELDS,
  type AacCardFieldRef,
  type AacCardFields,
} from "./resolveAacCardFields";

const ref = (stepKey: string, id: string): AacCardFieldRef => ({
  stepKey,
  id,
  path: `answers.${stepKey}.${id}`,
  label: id,
  options: [],
});

/** Un champ de la RACINE du document : pré-calculé, donc pas interrogeable. */
const rootRef = (id: string): AacCardFieldRef => ({
  stepKey: null,
  id,
  path: id,
  label: id,
  options: [],
});

/** Champs résolus, avec des clés d'étape EXOTIQUES : rien n'est codé en dur. */
const FIELDS: AacCardFields = {
  ...EMPTY_AAC_CARD_FIELDS,
  title: ref("etapeA", "q_titre"),
  tags: ref("etapeA", "q_theme"),
  maturity: ref("etapeA", "q_matu"),
};

const f = (p: Partial<AacDirectoryFiltersState> = {}): AacDirectoryFiltersState => ({
  ...EMPTY_AAC_FILTERS,
  ...p,
});

describe("splitAacFilters — ce qui part au serveur", () => {
  it("aucun filtre utilisateur ⇒ seul le garde-brouillons part, et pas de balayage", () => {
    const { server, needsScan } = splitAacFilters(f(), FIELDS);
    expect(server).toEqual({
      filters: { "answers.etapeA.q_titre": { $exists: true } },
    });
    expect(needsScan).toBe(false);
  });

  it("écarte TOUJOURS les réponses sans titre — ce sont des brouillons", () => {
    // Parité avec le front legacy, qui pose
    // `filters[answers.aapStep1.titre][$exists]=true` sur l'annuaire. Sans lui,
    // la grille affiche des cartes « Commun sans titre ».
    const { server } = splitAacFilters(f({ q: "x" }), FIELDS);
    expect(server.filters).toEqual({ "answers.etapeA.q_titre": { $exists: true } });
  });

  it("filtre sur le chemin RÉSOLU, jamais sur une clé d'étape en dur", () => {
    // `etapeA` est exotique : si `aapStep1` apparaissait, ce serait du codage en dur.
    const { server } = splitAacFilters(f(), FIELDS);
    expect(Object.keys(server.filters ?? {})).toEqual(["answers.etapeA.q_titre"]);
  });

  it("sans chemin de titre résolu, aucun garde-brouillons n'est posé", () => {
    const { server } = splitAacFilters(f(), EMPTY_AAC_CARD_FIELDS);
    expect(server.filters).toBeUndefined();
  });

  it("la recherche par nom part AVEC son `textPath`", () => {
    // Sans `textPath`, `name` ne matcherait RIEN : un document `answers` ne
    // stocke pas de `name`, il est calculé après la requête.
    const { server, client, needsScan } = splitAacFilters(f({ q: "  Peertube " }), FIELDS);
    expect(server.name).toBe("Peertube");
    expect(server.textPath).toBe("answers.etapeA.q_titre");
    expect(client.q).toBe("");
    expect(needsScan).toBe(false);
  });

  it("les tags partent AVEC leur `tagsPath`", () => {
    const { server, client } = splitAacFilters(f({ tags: ["open source"] }), FIELDS);
    expect(server.searchTags).toEqual(["open source"]);
    expect(server.tagsPath).toBe("answers.etapeA.q_theme");
    expect(client.tags).toEqual([]);
  });

  it("le tri part au serveur et ne repasse PAS au client", () => {
    // Re-trier une page partielle donnerait un ordre faux.
    const { server, client } = splitAacFilters(f({ sort: "created_desc" }), FIELDS);
    expect(server.sortBy).toEqual({ created: -1 });
    expect(client.sort).toBe("");
  });
});

describe("splitAacFilters — ce qui reste client", () => {
  it("usage, sous-usage et maturité imposent le balayage", () => {
    for (const p of [
      { usage: ["1_alpha"] },
      { usageSub: ["0_beta"] },
      { maturity: ["Oui"] },
    ]) {
      const { server, client, needsScan } = splitAacFilters(f(p), FIELDS);
      expect(needsScan, JSON.stringify(p)).toBe(true);
      expect(server.name).toBeUndefined();
      expect(server.searchTags).toBeUndefined();
      expect({ ...client, sort: "" }).toEqual({ ...EMPTY_AAC_FILTERS, ...p });
    }
  });

  it("le tri REDEVIENT client dès qu'on balaie", () => {
    const { client } = splitAacFilters(f({ usage: ["1_alpha"], sort: "alpha" }), FIELDS);
    expect(client.sort).toBe("alpha");
  });

  it("sans chemin de titre résolu, la recherche retombe côté client", () => {
    // Cas réel : le formulaire n'est pas encore chargé.
    const { server, client, needsScan } = splitAacFilters(
      f({ q: "peertube" }),
      EMPTY_AAC_CARD_FIELDS
    );
    expect(server.name).toBeUndefined();
    expect(client.q).toBe("peertube");
    expect(needsScan).toBe(true);
  });

  it("sans chemin de tags résolu, les tags retombent côté client", () => {
    const { server, client, needsScan } = splitAacFilters(
      f({ tags: ["a"] }),
      EMPTY_AAC_CARD_FIELDS
    );
    expect(server.searchTags).toBeUndefined();
    expect(client.tags).toEqual(["a"]);
    expect(needsScan).toBe(true);
  });

  it("un champ RACINE ne part jamais au serveur : il est calculé après la requête", () => {
    // `name` et `tags` racine sont posés par `parsePropositionData` APRÈS la
    // requête. Les envoyer comme chemins Mongo ne filtrerait rien — et le
    // garde-brouillons `$exists` sur `name` viderait l'annuaire entier.
    const rootFields: AacCardFields = {
      ...EMPTY_AAC_CARD_FIELDS,
      title: rootRef("name"),
      tags: rootRef("tags"),
    };
    const { server, client, needsScan } = splitAacFilters(
      f({ q: "peertube", tags: ["a"] }),
      rootFields
    );

    expect(server.filters).toBeUndefined();
    expect(server.name).toBeUndefined();
    expect(server.textPath).toBeUndefined();
    expect(server.searchTags).toBeUndefined();
    expect(client.q).toBe("peertube");
    expect(client.tags).toEqual(["a"]);
    expect(needsScan).toBe(true);
  });

  it("un filtre n'est JAMAIS appliqué des deux côtés", () => {
    const state = f({ q: "x", tags: ["t"], usage: ["1_a"] });
    const { server, client } = splitAacFilters(state, FIELDS);

    expect(server.name).toBe("x");
    expect(client.q).toBe("");
    expect(server.searchTags).toEqual(["t"]);
    expect(client.tags).toEqual([]);
    // Seul l'usage reste à filtrer en mémoire.
    expect(client.usage).toEqual(["1_a"]);
  });
});

describe("serverSortBy", () => {
  it("l'ordre du serveur est un CHOIX : `\"\"` n'envoie rien", () => {
    expect(serverSortBy("", FIELDS)).toBeUndefined();
  });

  it("mappe les tris par date", () => {
    expect(serverSortBy("created_asc", FIELDS)).toEqual({ created: 1 });
    expect(serverSortBy("created_desc", FIELDS)).toEqual({ created: -1 });
    expect(serverSortBy("updated_asc", FIELDS)).toEqual({ updated: 1 });
    expect(serverSortBy("updated_desc", FIELDS)).toEqual({ updated: -1 });
  });

  it("trie les intéressés sur le compteur STOCKÉ, pas sur celui de la carte", () => {
    // `interrest_count` est recalculé après la requête : Mongo ne peut pas
    // trier dessus. `allVoteCount.love` est son équivalent persisté.
    expect(serverSortBy("interest_desc", FIELDS)).toEqual({ "allVoteCount.love": -1 });
    expect(serverSortBy("interest_asc", FIELDS)).toEqual({ "allVoteCount.love": 1 });
  });

  it("l'ordre alphabétique suit le chemin du titre, et se tait sans lui", () => {
    expect(serverSortBy("alpha", FIELDS)).toEqual({ "answers.etapeA.q_titre": 1 });
    expect(serverSortBy("alpha", EMPTY_AAC_CARD_FIELDS)).toBeUndefined();
    // Titre pré-calculé ⇒ rien à trier côté Mongo, il n'est pas stocké.
    expect(
      serverSortBy("alpha", { ...EMPTY_AAC_CARD_FIELDS, title: rootRef("name") })
    ).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Restriction de VISIBILITÉ : un visiteur non administrateur ne voit que les
// communs sélectionnés, plus les siens. Ce n'est pas un filtre utilisateur mais
// une règle d'accès — elle ne doit jamais dépendre de l'état des facettes.
// ─────────────────────────────────────────────────────────────────────────────
describe("splitAacFilters — visibilité", () => {
  const WITH_CHOOSE: AacCardFields = { ...FIELDS, choose: ref("etapeB", "choose") };
  const CTX = "677e7e13bd08b2478f5f5314";

  const anonymous = { isAdmin: false, currentUserId: "", contextId: CTX };
  const member = { isAdmin: false, currentUserId: "55f0", contextId: CTX };
  const admin = { isAdmin: true, currentUserId: "55f0", contextId: CTX };

  it("anonyme : sélectionnés OU `user: \"\"` — qui ne matche rien", () => {
    const { server } = splitAacFilters(f(), WITH_CHOOSE, anonymous);
    expect(server.filters?.$or).toEqual({
      [`answers.etapeB.choose.${CTX}.value`]: "selected",
      user: "",
    });
  });

  it("connecté non-admin : sélectionnés OU SES communs", () => {
    const { server } = splitAacFilters(f(), WITH_CHOOSE, member);
    expect((server.filters?.$or as Record<string, unknown>).user).toBe("55f0");
  });

  it("admin : AUCUNE restriction", () => {
    const { server } = splitAacFilters(f(), WITH_CHOOSE, admin);
    expect(server.filters?.$or).toBeUndefined();
  });

  it("cohabite avec le garde-brouillons, sans l'écraser", () => {
    // Les deux vivent dans `filters` : une affectation au lieu d'une fusion
    // rouvrirait l'annuaire à tout le monde.
    const { server } = splitAacFilters(f(), WITH_CHOOSE, anonymous);
    expect(server.filters).toEqual({
      $or: {
        [`answers.etapeB.choose.${CTX}.value`]: "selected",
        user: "",
      },
      "answers.etapeA.q_titre": { $exists: true },
    });
  });

  it("sans contextId, la restriction n'est PAS construite", () => {
    // Défaut permissif assumé : la vraie garde est `onlyAdminCanSeeList`, côté
    // serveur. Poser un `$or` sur un contexte inconnu viderait l'annuaire.
    const { server } = splitAacFilters(f(), WITH_CHOOSE, { ...anonymous, contextId: null });
    expect(server.filters?.$or).toBeUndefined();
  });

  it("sans question `choose` résolue, la restriction n'est PAS construite", () => {
    const { server } = splitAacFilters(f(), FIELDS, anonymous);
    expect(server.filters?.$or).toBeUndefined();
  });

  it("s'applique aussi quand un filtre client impose le balayage", () => {
    // Sinon le balayage ramènerait des communs non sélectionnés, que le
    // filtrage mémoire ne saurait pas écarter.
    const { server, needsScan } = splitAacFilters(
      f({ usage: ["1_alpha"] }),
      WITH_CHOOSE,
      anonymous
    );
    expect(needsScan).toBe(true);
    expect(server.filters?.$or).toBeDefined();
  });

  it("par défaut (visibilité omise), aucune restriction n'est posée", () => {
    const { server } = splitAacFilters(f(), WITH_CHOOSE);
    expect(server.filters?.$or).toBeUndefined();
  });
});
