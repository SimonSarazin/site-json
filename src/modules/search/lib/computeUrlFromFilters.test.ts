import { describe, it, expect } from "vitest";
import { computeUrlFromFilters } from "./computeUrlFromFilters";
import { applyDefaultSearchTargets, computeFiltersFromUrl, type FilterGroupLike } from "./computeFiltersFromUrl";
import type { SearchByFieldValue } from "../contexts/pageFilters";
import { toggleSearchByField } from "./filterToggles";
import { answerToggleArgs, type AnswerGroupConf } from "./answerFilterClause";
import { searchByFieldsToQuery } from "./searchByFieldsToQuery";

const TYPO: FilterGroupLike = {
  id: "typologies",
  type: "tag",
  options: [{ id: "fablab", name: "fablab" }, { id: "coworking", name: "coworking" }],
};
const RESEAUX: FilterGroupLike = {
  id: "reseauxRegionaux",
  type: "entityList",
  filterType: "sourceKey",
  options: [{ id: "laRosee", name: "laRosee" }, { id: "autre", name: "autre" }],
};
// scopeList tel que construit par FiltersSection : options sans `name` (clé = id),
// avec `level`. field = group.field ?? `${id}${level}`.
const REGIONS: FilterGroupLike = {
  id: "regions",
  type: "scopeList",
  options: [{ id: "974", level: "level3" }, { id: "972", level: "level3" }],
};
const scopeEntry = (id: string, level: string) => ({
  field: `${id}${level}`,
  type: "scopeList",
  value: { id, type: level },
} as unknown as SearchByFieldValue);

describe("computeUrlFromFilters", () => {
  it("sérialise un groupe catégorie depuis selectedFilters", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      { typologies: ["fablab", "coworking"] },
      {},
      [TYPO],
    );
    expect(out.get("typologies")).toBe("fablab,coworking");
  });

  it("sérialise un entityList depuis searchByFields (nom d'option)", () => {
    const sbf: Record<string, SearchByFieldValue> = {
      laRosee: { field: "sourceKey", type: "sourceKey", value: ["laRosee"] },
    };
    const out = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [RESEAUX]);
    expect(out.get("reseauxRegionaux")).toBe("laRosee");
  });

  it("supprime le param quand la sélection est vide", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams("typologies=fablab&page=2"),
      {},
      {},
      [TYPO],
    );
    expect(out.has("typologies")).toBe(false);
    // préserve les params hors filtres
    expect(out.get("page")).toBe("2");
  });

  it("NE touche PAS au param entityList tant que les options ne sont pas chargées", () => {
    const groupNoOptions: FilterGroupLike = { ...RESEAUX, options: [] };
    const out = computeUrlFromFilters(
      new URLSearchParams("reseauxRegionaux=laRosee"),
      {},
      {},
      [groupNoOptions],
    );
    // deep-link préservé (sinon il serait effacé avant l'hydratation)
    expect(out.get("reseauxRegionaux")).toBe("laRosee");
  });

  it("sérialise un scopeList depuis searchByFields (nom d'option)", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { "974": scopeEntry("974", "level3") },
      [REGIONS],
    );
    expect(out.get("regions")).toBe("974");
  });

  it("NE touche PAS au param scopeList tant que les options (zones) ne sont pas chargées", () => {
    const groupNoOptions: FilterGroupLike = { ...REGIONS, options: [] };
    const out = computeUrlFromFilters(
      new URLSearchParams("regions=974"),
      {},
      {},
      [groupNoOptions],
    );
    expect(out.get("regions")).toBe("974");
  });

  it("sérialise la recherche texte en ?search= (et la retire si vide)", () => {
    const set = computeUrlFromFilters(new URLSearchParams(), {}, {}, [], "tiers lieux");
    expect(set.get("search")).toBe("tiers lieux");
    const cleared = computeUrlFromFilters(new URLSearchParams("search=tiers"), {}, {}, [], "  ");
    expect(cleared.has("search")).toBe(false);
  });

  // — Point fixe : write puis read reproduit l'état d'origine (managed) —
  it("round-trip category : computeFiltersFromUrl(write(state)) == state", () => {
    const selected = { typologies: ["fablab", "coworking"] };
    const url = computeUrlFromFilters(new URLSearchParams(), selected, {}, [TYPO]);
    const { applySelected } = computeFiltersFromUrl(url, [TYPO], null);
    expect(applySelected({})).toEqual(selected);
  });

  it("round-trip entityList : computeFiltersFromUrl(write(state)) == state", () => {
    const sbf: Record<string, SearchByFieldValue> = {
      laRosee: { field: "sourceKey", type: "sourceKey", value: ["laRosee"] },
    };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [RESEAUX]);
    const { applySearchFields } = computeFiltersFromUrl(url, [RESEAUX], null);
    expect(applySearchFields({})).toEqual(sbf);
  });

  it("sérialise un filtre « par réponses » (service) depuis searchByFields", () => {
    const answerData = {
      services: { values: { garderie: { name: "Garderie", orgaNameArray: ["orgA", "orgB"] } } },
    };
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { garderie: { field: "_id", value: ["orgA", "orgB"] } },
      [],
      "",
      answerData,
    );
    expect(out.get("services")).toBe("garderie");
  });

  it("round-trip « par réponses » : computeFiltersFromUrl(write(state)) == state", () => {
    const answerData = {
      services: { values: { garderie: { name: "Garderie", orgaNameArray: ["orgA", "orgB"] } } },
    };
    const sbf: Record<string, SearchByFieldValue> = {
      garderie: { field: "_id", value: ["orgA", "orgB"] },
    };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [], "", answerData);
    const { applySearchFields } = computeFiltersFromUrl(url, [], answerData);
    expect(applySearchFields({})).toEqual(sbf);
  });

  it("round-trip scopeList : computeFiltersFromUrl(write(state)) == state", () => {
    const sbf: Record<string, SearchByFieldValue> = { "974": scopeEntry("974", "level3") };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [REGIONS]);
    const { applySearchFields } = computeFiltersFromUrl(url, [REGIONS], null);
    expect(applySearchFields({})).toEqual(sbf);
  });

  it("round-trip mixte stable (texte + tag + entityList + scopeList) + préserve un param libre (page)", () => {
    const selected = { typologies: ["fablab"] };
    const sbf: Record<string, SearchByFieldValue> = {
      laRosee: { field: "sourceKey", type: "sourceKey", value: ["laRosee"] },
      "974": scopeEntry("974", "level3"),
    };
    const groups = [TYPO, RESEAUX, REGIONS];
    const url = computeUrlFromFilters(new URLSearchParams("page=2"), selected, sbf, groups, "tiers");
    expect(url.get("page")).toBe("2"); // param hors filtres préservé
    expect(url.get("search")).toBe("tiers");
    const { applySelected, applySearchFields } = computeFiltersFromUrl(url, groups, null);
    expect(applySelected({})).toEqual(selected);
    expect(applySearchFields({})).toEqual(sbf);
    // Idempotence : ré-écrire depuis l'état relu ne change pas l'URL.
    const url2 = computeUrlFromFilters(url, applySelected({}), applySearchFields({}), groups, "tiers");
    expect(url2.toString()).toBe(url.toString());
  });
});

// ─── searchTargets (filtre « type d'info », CDC parents62) ──────────────────
const TYPE_INFO: FilterGroupLike = {
  id: "typeInfo",
  type: "searchTargets",
  options: [
    { id: "typeinfo-actions", name: "typeinfo-actions", target: { defaultTypes: ["projects"] } },
    {
      id: "typeinfo-paroles",
      name: "typeinfo-paroles",
      target: { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } },
    },
  ],
};
const targetEntry = (target: Record<string, unknown>) =>
  ({ field: "searchTarget", type: "searchTarget", value: target }) as unknown as SearchByFieldValue;

describe("searchTargets — miroir URL", () => {
  it("écriture : option active dans searchByFields → ?typeInfo=<option>", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { "typeinfo-paroles": targetEntry({ defaultTypes: ["poi"] }) },
      [TYPE_INFO],
    );
    expect(out.get("typeInfo")).toBe("typeinfo-paroles");
  });

  it("écriture : aucune option active → param retiré", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams("typeInfo=typeinfo-paroles"),
      {},
      {},
      [TYPE_INFO],
    );
    expect(out.get("typeInfo")).toBeNull();
  });

  it("lecture : deep-link ?typeInfo=… → entrée searchByFields avec la cible de l'option (radio : 1ʳᵉ valeur)", () => {
    const { applySearchFields } = computeFiltersFromUrl(
      new URLSearchParams("typeInfo=typeinfo-paroles,typeinfo-actions"),
      [TYPE_INFO],
      null,
    );
    expect(applySearchFields({})).toEqual({
      "typeinfo-paroles": {
        field: "searchTarget",
        type: "searchTarget",
        value: { defaultTypes: ["poi"], defaultFilters: { type: "affiche" } },
      },
    });
  });

  it("lecture : les clés d'options searchTargets sont reconstruites (pas préservées), les autres clés le sont", () => {
    const { applySearchFields } = computeFiltersFromUrl(new URLSearchParams(), [TYPE_INFO], null);
    const prev = {
      "typeinfo-actions": targetEntry({ defaultTypes: ["projects"] }),
      autre: { field: "tags", value: ["sport"] } as unknown as SearchByFieldValue,
    };
    expect(applySearchFields(prev)).toEqual({
      autre: { field: "tags", value: ["sport"] },
    });
  });
});

// ─── dateRange (filtre par date, CDC parents62) ─────────────────────────────
const DATES: FilterGroupLike = { id: "dates", type: "dateRange", field: "startDate" };
const rangeEntry = (value: Record<string, unknown>) =>
  ({ field: "startDate", type: "dateRange", value }) as unknown as SearchByFieldValue;

describe("dateRange — miroir URL", () => {
  it("écriture : plage active → ?dates=start[,end] ; vide → param retiré", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { dates: rangeEntry({ start: "2026-07-01", end: "2026-08-31" }) },
      [DATES],
    );
    expect(out.get("dates")).toBe("2026-07-01,2026-08-31");

    const cleared = computeUrlFromFilters(new URLSearchParams("dates=2026-07-01"), {}, {}, [DATES]);
    expect(cleared.get("dates")).toBeNull();
  });

  it("lecture : deep-link ?dates=start,end → entrée searchByFields sous la clé du groupe", () => {
    const { applySearchFields } = computeFiltersFromUrl(
      new URLSearchParams("dates=2026-07-01,2026-08-31"),
      [DATES],
      null,
    );
    expect(applySearchFields({})).toEqual({
      dates: { field: "startDate", type: "dateRange", value: { start: "2026-07-01", end: "2026-08-31" } },
    });
  });

  it("plage « fin seule » : position de début vide conservée (`,end`) et relue en borne de fin", () => {
    // écriture : la position de début vide est gardée → `?dates=,end`.
    const written = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { dates: rangeEntry({ end: "2026-08-31" }) },
      [DATES],
    );
    expect(written.get("dates")).toBe(",2026-08-31");

    // lecture : `,end` reste une borne de FIN (et ne glisse pas en début).
    const { applySearchFields } = computeFiltersFromUrl(
      new URLSearchParams("dates=,2026-08-31"),
      [DATES],
      null,
    );
    expect(applySearchFields({})).toEqual({
      dates: { field: "startDate", type: "dateRange", value: { end: "2026-08-31" } },
    });
  });

  it("plage « début seul » → ?dates=start (sans virgule) et relue en borne de début", () => {
    const written = computeUrlFromFilters(
      new URLSearchParams(),
      {},
      { dates: rangeEntry({ start: "2026-07-01" }) },
      [DATES],
    );
    expect(written.get("dates")).toBe("2026-07-01");

    const { applySearchFields } = computeFiltersFromUrl(
      new URLSearchParams("dates=2026-07-01"),
      [DATES],
      null,
    );
    expect(applySearchFields({})).toEqual({
      dates: { field: "startDate", type: "dateRange", value: { start: "2026-07-01" } },
    });
  });
});

// Groupe « champ » (taxonomie en CHAMPS, parent62) : `field` sur un groupe
// `filters` → la sélection vit dans searchByFields, clé = nom d'option, et la
// valeur envoyée au backend est le libellé EXACT stocké en base.
const TERRITOIRES_CHAMP: FilterGroupLike = {
  id: "territoire",
  type: "filters",
  field: "territoires",
  options: [
    { id: "arrageois", name: "Arrageois" },
    { id: "entre-mer-et-terres", name: "Entre Mer et Terres" },
  ],
};

describe("groupe « champ » (field sur un groupe filters)", () => {
  it("écriture : options actives dans searchByFields → ?territoire=<valeurs>", () => {
    const sbf: Record<string, SearchByFieldValue> = {
      Arrageois: { field: "territoires", value: ["Arrageois"] },
    };
    const out = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [TERRITOIRES_CHAMP]);
    expect(out.get("territoire")).toBe("Arrageois");
  });

  it("lecture : deep-link par id OU par valeur → searchByFields sur le champ du groupe", () => {
    const byValue = computeFiltersFromUrl(
      new URLSearchParams("territoire=Arrageois"),
      [TERRITOIRES_CHAMP],
      null,
    ).applySearchFields({});
    expect(byValue).toEqual({ Arrageois: { field: "territoires", value: ["Arrageois"] } });

    // La bulle territoire de l'accueil deep-linke par slug d'option.
    const byId = computeFiltersFromUrl(
      new URLSearchParams("territoire=entre-mer-et-terres"),
      [TERRITOIRES_CHAMP],
      null,
    ).applySearchFields({});
    expect(byId).toEqual({
      "Entre Mer et Terres": { field: "territoires", value: ["Entre Mer et Terres"] },
    });
  });

  it("round-trip : write(state) relu redonne le même state", () => {
    const sbf: Record<string, SearchByFieldValue> = {
      Arrageois: { field: "territoires", value: ["Arrageois"] },
      "Entre Mer et Terres": { field: "territoires", value: ["Entre Mer et Terres"] },
    };
    const url = computeUrlFromFilters(new URLSearchParams(), {}, sbf, [TERRITOIRES_CHAMP]);
    expect(computeFiltersFromUrl(url, [TERRITOIRES_CHAMP], null).applySearchFields({})).toEqual(sbf);
  });

  it("sans sélection → param retiré ; les clés du groupe sont reconstruites, pas préservées", () => {
    const out = computeUrlFromFilters(
      new URLSearchParams("territoire=Arrageois"),
      {},
      {},
      [TERRITOIRES_CHAMP],
    );
    expect(out.has("territoire")).toBe(false);

    const applied = computeFiltersFromUrl(new URLSearchParams(), [TERRITOIRES_CHAMP], null)
      .applySearchFields({
        Arrageois: { field: "territoires", value: ["Arrageois"] },
        service1: { field: "_id", value: ["orga"] },
      });
    expect(applied).toEqual({ service1: { field: "_id", value: ["orga"] } });
  });
});

// ─── défaut d'un groupe searchTargets (option defaultChecked) ────────────────
// Régression parent62 : le défaut rangé en selectedFilters fuyait en tag `$all`
// « typeinfo-… » inexistant → 0 résultat. Le défaut doit vivre en searchByFields.
const TYPE_INFO_DEFAULT: FilterGroupLike = {
  ...TYPE_INFO,
  options: [
    { ...TYPE_INFO.options![0], defaultChecked: true },
    TYPE_INFO.options![1],
  ],
};

describe("applyDefaultSearchTargets (défaut à l'hydratation)", () => {
  it("URL vierge → la cible defaultChecked est posée en searchByFields", () => {
    const out = applyDefaultSearchTargets({}, [TYPE_INFO_DEFAULT], new URLSearchParams());
    expect(out).toEqual({
      "typeinfo-actions": targetEntry({ defaultTypes: ["projects"] }),
    });
  });

  it("l'URL prime : param du groupe présent → aucun défaut appliqué", () => {
    const fromUrl = computeFiltersFromUrl(
      new URLSearchParams("typeInfo=typeinfo-paroles"),
      [TYPE_INFO_DEFAULT],
      null,
    ).applySearchFields({});
    const out = applyDefaultSearchTargets(
      fromUrl,
      [TYPE_INFO_DEFAULT],
      new URLSearchParams("typeInfo=typeinfo-paroles"),
    );
    expect(out).toEqual({
      "typeinfo-paroles": targetEntry({ defaultTypes: ["poi"], defaultFilters: { type: "affiche" } }),
    });
  });

  it("une option du groupe déjà sélectionnée → pas d'écrasement", () => {
    const prev = { "typeinfo-paroles": targetEntry({ defaultTypes: ["poi"] }) };
    expect(applyDefaultSearchTargets(prev, [TYPE_INFO_DEFAULT], new URLSearchParams())).toBe(prev);
  });

  it("groupe sans defaultChecked ou non-searchTargets → identité", () => {
    expect(applyDefaultSearchTargets({}, [TYPE_INFO], new URLSearchParams())).toEqual({});
    expect(applyDefaultSearchTargets({}, [TYPO], new URLSearchParams())).toEqual({});
  });

  // Régression : un defaultChecked sur un groupe « champ » doit lui aussi être
  // posé en searchByFields (jamais selectedFilters, sinon tag `$all` fantôme).
  it("groupe « champ » defaultChecked → posé en searchByFields (pas en tag)", () => {
    const territoireDefault: FilterGroupLike = {
      ...TERRITOIRES_CHAMP,
      options: [
        { ...TERRITOIRES_CHAMP.options![0], defaultChecked: true },
        TERRITOIRES_CHAMP.options![1],
      ],
    };
    const out = applyDefaultSearchTargets({}, [territoireDefault], new URLSearchParams());
    expect(out).toEqual({ Arrageois: { field: "territoires", value: ["Arrageois"] } });

    // L'URL prime : param présent → aucun défaut.
    expect(
      applyDefaultSearchTargets({}, [territoireDefault], new URLSearchParams("territoire=Entre Mer et Terres")),
    ).toEqual({});
  });
});

/**
 * VERROU D'ALLER-RETOUR — une valeur d'option contenant une VIRGULE.
 *
 * La lecture fait `split(",")` puis `decodeURIComponent` par fragment. Tant que l'écriture
 * joignait sans encoder, une telle valeur était redécoupée en morceaux qui ne correspondaient à
 * aucune option et le paramètre disparaissait de l'URL — en liste mixte, la perte était PARTIELLE
 * et silencieuse. 4 valeurs du parc étaient dans ce cas (groupe `portage` de relief et
 * tiers-lieux). Ces tests interdisent la régression dans les deux sens.
 */
describe("aller-retour d'une valeur à virgule", () => {
  const PORTAGE: FilterGroupLike = {
    id: "portage",
    type: "tag",
    options: [
      { id: "assoc", name: "Association" },
      { id: "collectivites", name: "Collectivités (Département, Intercommunalité, Région, etc)" },
    ],
  };
  const AVEC_VIRGULE = "Collectivités (Département, Intercommunalité, Région, etc)";

  it("une valeur à virgule survit à écriture → lecture", () => {
    const url = computeUrlFromFilters(new URLSearchParams(), { portage: [AVEC_VIRGULE] }, {}, [PORTAGE], "");
    const { applySelected } = computeFiltersFromUrl(new URLSearchParams(url.toString()), [PORTAGE], null);
    expect(applySelected({})).toEqual({ portage: [AVEC_VIRGULE] });
  });

  it("en liste MIXTE, la valeur sans virgule ne masque plus la perte de l'autre", () => {
    const sel = { portage: ["Association", AVEC_VIRGULE] };
    const url = computeUrlFromFilters(new URLSearchParams(), sel, {}, [PORTAGE], "");
    const { applySelected } = computeFiltersFromUrl(new URLSearchParams(url.toString()), [PORTAGE], null);
    expect(applySelected({}).portage).toHaveLength(2);
    expect(applySelected({}).portage).toContain(AVEC_VIRGULE);
  });

  it("l'encodage est l'IDENTITÉ sur une valeur URL-safe (rétrocompatibilité du wire)", () => {
    const url = computeUrlFromFilters(new URLSearchParams(), { portage: ["Association"] }, {}, [PORTAGE], "");
    expect(url.get("portage")).toBe("Association");
  });

  it("une URL héritée, écrite SANS encodage, reste lisible", () => {
    // La lecture décodait déjà : les liens déjà partagés ne cessent pas de fonctionner.
    const { applySelected } = computeFiltersFromUrl(new URLSearchParams("portage=Association"), [PORTAGE], null);
    expect(applySelected({})).toEqual({ portage: ["Association"] });
  });
});

/**
 * Le clic (`FiltersSection` → `toggleSearchByField`) et le deep-link
 * (`computeFiltersFromUrl`) DOIVENT écrire la même entrée : sinon un lien partagé
 * et un clic donnent des résultats différents. C'est la seule raison pour laquelle
 * la lecture d'URL reçoit la config des groupes (`filterTarget`).
 */
describe("groupes « par réponses » : clic et deep-link écrivent la MÊME chose", () => {
  const CONF_ANSWERS: Record<string, AnswerGroupConf> = {
    maladies: { filterTarget: "answers", path: "eki_0.multiCheckboxPluseki_0mal" },
  };
  const DATA = {
    maladies: { values: { "Obésité": { name: "Obésité", orgaNameArray: ["orgMairie"] } } },
  };

  const parLeClic = (confs: Record<string, AnswerGroupConf> | null) => {
    const { field, value, fieldType } = answerToggleArgs(
      confs?.maladies,
      "Obésité",
      DATA.maladies.values["Obésité"],
    );
    return toggleSearchByField({}, "Obésité", { field, value, fieldType });
  };

  it("cible answers : clic == URL, et c'est un prédicat de CHEMIN (pas un _id)", () => {
    const clic = parLeClic(CONF_ANSWERS);
    const url = computeUrlFromFilters(new URLSearchParams(), {}, clic, [], "", DATA);
    expect(url.get("maladies")).toBe("Ob%C3%A9sit%C3%A9");
    const { applySearchFields } = computeFiltersFromUrl(url, [], DATA, CONF_ANSWERS);
    expect(applySearchFields({})).toEqual(clic);
    expect(clic["Obésité"].field).toBe("answers.eki_0.multiCheckboxPluseki_0mal");
    expect(searchByFieldsToQuery(clic).filters).toEqual({
      $or: {
        $and: [
          { $or: [{ "answers.eki_0.multiCheckboxPluseki_0mal.Obésité": { $exists: true } }] },
        ],
      },
    });
  });

  it("groupe historique (sans filterTarget) : clic == URL, filtre par _id INCHANGÉ", () => {
    const clic = parLeClic(null);
    expect(clic["Obésité"]).toEqual({ field: "_id", value: ["orgMairie"] });
    const url = computeUrlFromFilters(new URLSearchParams(), {}, clic, [], "", DATA);
    const { applySearchFields } = computeFiltersFromUrl(url, [], DATA, null);
    expect(applySearchFields({})).toEqual(clic);
    expect(searchByFieldsToQuery(clic).filters).toEqual({ _id: { $in: ["orgMairie"] } });
  });

  it("SANS la config, un deep-link retomberait sur _id là où le clic pose un chemin", () => {
    // Contre-épreuve de la raison d'être du 4e paramètre : c'est exactement la
    // divergence que la garde interdit.
    const clic = parLeClic(CONF_ANSWERS);
    const url = computeUrlFromFilters(new URLSearchParams(), {}, clic, [], "", DATA);
    const sansConf = computeFiltersFromUrl(url, [], DATA).applySearchFields({});
    expect(sansConf).not.toEqual(clic);
    expect(sansConf["Obésité"].field).toBe("_id");
  });
});
