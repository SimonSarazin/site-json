import { describe, it, expect } from "vitest";
import { buildOptionKey, slugifyOption } from "./slugify";
import {
  buildCategorizedOptions,
  buildChildrenFromCatalog,
  buildManualOptions,
  normalizeCategorizedValue,
  parseQuestionPath,
  resolveStoredKey,
  toggleCategory,
  toggleChild,
} from "./categorizedCheckbox";
import { generateZodSchema } from "./formParser";
import type { CategorizedCheckboxConfig, CategorizedCheckboxValue, CommonTableCatalog, SubFormFields } from "../types";

/**
 * Ces tests sont adossés à un cas RÉEL relevé en base (`pixelhumain1`) : formulaire
 * `677e7e389058e31575550ac8` « Les communs des CAEs », dont l'input `categorizedCheckbox` est
 * alimenté par les 16 questions commonTable du formulaire `6525865cdeaf281bbc7280e9`
 * « Observatoire des besoins et solutions des CAEs », et qui porte 9 réponses enregistrées.
 *
 * Les libellés, catalogues et réponses ci-dessous sont recopiés tels quels depuis la base : c'est
 * ce qui donne leur valeur aux assertions. Une dérivation de clé qui « marche en théorie » mais ne
 * retombe pas sur ces chaînes-là casse l'affichage des réponses déjà saisies.
 */

/** Les 16 questions source, dans l'ordre de `questionsParamsSource` — cet ordre EST l'indexation. */
const LABELS_QUESTIONS = [
  "Administration / Gestion",
  "Communication externe",
  "Coopération et communication interne",
  "Juridique et protection des données",
  "Autres outils  et services de la CAE", // ⚠ double espace, tel quel en base
  "Métiers de l'artisanat",
  "Métiers du bâtiment",
  "Métiers de la communication",
  "Métiers du conseil et coaching",
  "Métiers de la culture",
  "Métiers de la formation",
  "Métiers de l'environnement",
  "Métiers du service à la personne",
  "Métiers du numérique",
  "Métiers de l'inclusion",
  "Autres métiers",
];

/** Catalogue réel de « Administration / Gestion » : 10 criterias, dont 3 pour le même usage. */
const CATALOGUE_ADMIN: CommonTableCatalog = Object.fromEntries(
  (
    [
      ["Comptabilité", ""],
      ["Comptabilité analytique par ESA", ""],
      ["Gestion sociale", ""],
      ["Paie", ""],
      ["Gestion numérique des notes de frais", ""],
      ["Gestion numérique des notes de frais", "usage_1768405059521_zcj2lgkr4"],
      ["Gestion numérique des notes de frais", "usage_1768405059521_zcj2lgkr4"],
      ["Solution paiement fournisseurs pour entrepreneur.es", ""],
      ["Gestion SIRH", ""],
      ["Ticket", ""],
    ] as const
  ).map(([usage, usageKey], i) => [`criteria_${i}`, { usage, usageKey, count: 0 }]),
);

const CONFIG_DISTANT: CategorizedCheckboxConfig = {
  dataSourceToUse: "distanceOnly",
  list: ["Gestion", "Juridique"], // présente en base mais ignorée en distanceOnly
  sublist: {},
  formParamsSource: ["6525865cdeaf281bbc7280e9"],
  questionsParamsSource: [],
};

const optionsDistantes = () =>
  buildCategorizedOptions(
    CONFIG_DISTANT,
    LABELS_QUESTIONS.map((label) => ({ label, catalog: {} })),
  );

describe("slugifyOption — réplique du slugify JS legacy", () => {
  it("translittère les accents au lieu de les supprimer", () => {
    expect(slugifyOption("Autres métiers")).toBe("autres-metiers");
    expect(slugifyOption("Métiers de l'inclusion")).toBe("metiers-de-l-inclusion");
    expect(slugifyOption("Coopération et communication interne")).toBe("cooperation-et-communication-interne");
  });

  it("réduit toute suite de séparateurs à un seul tiret", () => {
    // Double espace réel en base + la barre oblique de « Administration / Gestion ».
    expect(slugifyOption("Autres outils  et services de la CAE")).toBe("autres-outils-et-services-de-la-cae");
    expect(slugifyOption("Administration / Gestion")).toBe("administration-gestion");
  });

  it("retombe sur `n-a` plutôt que sur une chaîne vide", () => {
    expect(slugifyOption("")).toBe("n-a");
    expect(slugifyOption("!!!")).toBe("n-a");
    expect(slugifyOption(null)).toBe("n-a");
  });
});

describe("dérivation des clés — parité avec les réponses en base", () => {
  it("reproduit les clés de niveau 1 réellement stockées", () => {
    const options = optionsDistantes();
    const cles = options.map((o) => o.key);
    // Les 7 clés (sur 9 réponses) qui se dérivent encore aujourd'hui.
    expect(cles).toContain("1_communication-externe");
    expect(cles).toContain("2_cooperation-et-communication-interne");
    expect(cles).toContain("4_autres-outils-et-services-de-la-cae");
    expect(cles).toContain("10_metiers-de-la-formation");
    expect(cles).toContain("13_metiers-du-numerique");
    expect(cles).toContain("14_metiers-de-l-inclusion");
    expect(cles).toContain("15_autres-metiers");
  });

  it("n'émet aucune option manuelle en mode distanceOnly", () => {
    // `config.list` est non vide en base, mais le legacy ne la rend pas dans ce mode.
    expect(buildManualOptions(CONFIG_DISTANT)).toEqual([]);
    expect(optionsDistantes()).toHaveLength(16);
  });

  it("indexe les options distantes APRÈS les manuelles en mode `both`", () => {
    const config: CategorizedCheckboxConfig = { ...CONFIG_DISTANT, dataSourceToUse: "both" };
    const options = buildCategorizedOptions(config, [{ label: "Administration / Gestion", catalog: {} }]);
    expect(options.map((o) => o.key)).toEqual([
      "0_gestion",
      "1_juridique",
      "2_administration-gestion", // décalée de 2 par les manuelles
    ]);
  });
});

describe("sous-options issues du catalogue commonTable", () => {
  it("masque les usages en double sans réindexer les autres", () => {
    const enfants = buildChildrenFromCatalog(CATALOGUE_ADMIN);
    // 10 criterias → 8 lignes : les 3 « notes de frais » n'en font qu'une.
    expect(enfants).toHaveLength(8);
    expect(enfants.filter((e) => e.label === "Gestion numérique des notes de frais")).toHaveLength(1);
    // Les index 5 et 6 sont « brûlés » : les suivants gardent leur position d'origine.
    expect(enfants.map((e) => e.key)).toEqual([
      "0_comptabilite",
      "1_comptabilite-analytique-par-esa",
      "2_gestion-sociale",
      "3_paie",
      "4_gestion-numerique-des-notes-de-frais",
      "7_solution-paiement-fournisseurs-pour-entrepreneur-es",
      "8_gestion-sirh",
      "9_ticket",
    ]);
  });

  it("regroupe une entrée sans usageKey avec celles qui en ont un (données legacy)", () => {
    const enfants = buildChildrenFromCatalog(CATALOGUE_ADMIN);
    const notes = enfants.find((e) => e.label === "Gestion numérique des notes de frais");
    // L'entrée d'index 4 n'a pas d'usageKey mais partage l'usage des index 5 et 6 : c'est elle qui
    // porte la clé, car c'est la première rencontrée.
    expect(notes?.key).toBe("4_gestion-numerique-des-notes-de-frais");
  });

  it("écarte les entrées sans libellé d'usage mais leur laisse consommer leur index", () => {
    const catalogue: CommonTableCatalog = {
      a: { usage: "Alpha", usageKey: "", count: 1 },
      b: { usage: "", usageKey: "", count: 0 },
      c: { usage: "Gamma", usageKey: "", count: 2 },
    };
    expect(buildChildrenFromCatalog(catalogue).map((e) => e.key)).toEqual(["0_alpha", "2_gamma"]);
  });
});

describe("resolveStoredKey — lecture tolérante des réponses existantes", () => {
  const options = optionsDistantes();

  it("résout à l'identique quand la clé n'a pas bougé", () => {
    expect(resolveStoredKey("15_autres-metiers", options)?.label).toBe("Autres métiers");
  });

  it("ne rattrape PAS une question renommée — et c'est délibéré", () => {
    // Cas réel : « Autres outils de la CAE » a été renommée « Autres outils et services de la
    // CAE ». Ni la clé ni le slug ne correspondent plus. On refuse de retomber sur l'index seul :
    // l'index 4 peut désormais désigner une TOUTE AUTRE question, et attribuer la réponse à
    // celle-ci serait pire que de la signaler. L'appelant l'affiche donc en orpheline.
    expect(resolveStoredKey("4_autres-outils-de-la-cae", options)).toBeUndefined();
  });

  it("rattrape une option DÉPLACÉE via le repli sur le slug", () => {
    // Même libellé, index différent (question insérée en amont, ou ordre de catalogue divergent).
    expect(resolveStoredKey("9_autres-metiers", options)?.key).toBe("15_autres-metiers");
  });

  it("ne résout pas une clé issue de l'ancienne liste manuelle", () => {
    // `0_gestion` date de l'époque où l'input était en mode manuel : l'appelant doit l'afficher
    // en brut plutôt que l'escamoter (cf. bloc « orphelines » du composant).
    expect(resolveStoredKey("0_gestion", options)).toBeUndefined();
  });
});

describe("parseQuestionPath", () => {
  it("extrait formId et inputKey d'un chemin à trois segments", () => {
    expect(
      parseQuestionPath("6525865cdeaf281bbc7280e9-6525865cdeaf281bbc7280ea-communsDeCaes1696958044_0lnkmtohuq5cvjy0fp3f"),
    ).toEqual({
      formId: "6525865cdeaf281bbc7280e9",
      inputKey: "communsDeCaes1696958044_0lnkmtohuq5cvjy0fp3f",
    });
  });

  it("rejette un chemin incomplet", () => {
    expect(parseQuestionPath("formIdSeul")).toBeNull();
    expect(parseQuestionPath("")).toBeNull();
  });
});

describe("toggle — automatismes repris du legacy", () => {
  const vide = { list: [], sublist: {} };

  it("cocher une sous-option coche sa catégorie", () => {
    const v = toggleChild(vide, "1_communication-externe", "3_plateforme-video", true);
    expect(v.list).toEqual(["1_communication-externe"]);
    expect(v.sublist["1_communication-externe"]).toEqual(["3_plateforme-video"]);
  });

  it("décocher la dernière sous-option décoche la catégorie", () => {
    const v = toggleChild(vide, "1_communication-externe", "3_plateforme-video", true);
    const apres = toggleChild(v, "1_communication-externe", "3_plateforme-video", false);
    expect(apres.list).toEqual([]);
    expect(apres.sublist).toEqual({});
  });

  it("décocher une catégorie purge ses sous-options", () => {
    const v = toggleChild(vide, "0_a", "0_x", true);
    const apres = toggleCategory(v, "0_a", false);
    expect(apres.list).toEqual([]);
    // Sans cette purge, re-cocher la catégorie ressusciterait « 0_x ».
    expect(apres.sublist).toEqual({});
  });

  it("ne mute jamais la valeur reçue", () => {
    const v = { list: ["0_a"], sublist: { "0_a": ["0_x"] } };
    toggleCategory(v, "0_a", false);
    toggleChild(v, "0_a", "0_x", false);
    expect(v).toEqual({ list: ["0_a"], sublist: { "0_a": ["0_x"] } });
  });
});

describe("normalizeCategorizedValue", () => {
  it("accepte les réponses réelles sans `sublist`", () => {
    // 3 des 9 réponses en base n'ont que `list`.
    expect(normalizeCategorizedValue({ list: ["14_metiers-de-l-inclusion"] })).toEqual({
      list: ["14_metiers-de-l-inclusion"],
      sublist: {},
    });
  });

  it("retombe sur une valeur vide pour null/undefined/scalaire", () => {
    for (const brut of [null, undefined, 42, "x"]) {
      expect(normalizeCategorizedValue(brut)).toEqual({ list: [], sublist: {} });
    }
  });
});

describe("buildOptionKey", () => {
  it("compose <index>_<slug>", () => {
    expect(buildOptionKey(4, "Autres outils  et services de la CAE")).toBe(
      "4_autres-outils-et-services-de-la-cae",
    );
  });
});

/**
 * Le chemin réellement cassable : une valeur peut être correctement relue et pourtant refusée au
 * submit. `z.object` STRIP les clés non déclarées, et le formulaire mono-étape soumet la sortie
 * zod-parsée — une `sublist` absente du schéma serait effacée en silence.
 */
describe("aller-retour Zod du submit (norme : bugfix de donnée legacy)", () => {
  const champs = (isRequired = false): SubFormFields[] => [
    {
      subFormId: "aapStep1",
      subFormName: "Étape 1",
      fields: [
        {
          name: "aapStep1m8ixxe88psung3p6a7n",
          label: "Besoins outillés",
          type: "tpls.forms.cplx.categorizedCheckbox",
          componentType: "categorizedCheckbox",
          isRequired,
        } as SubFormFields["fields"][number],
      ],
    },
  ];

  const valider = (valeur: unknown, isRequired = false) =>
    generateZodSchema(champs(isRequired)).safeParse({ aapStep1m8ixxe88psung3p6a7n: valeur });

  it("accepte les 9 réponses réelles ET conserve leur `sublist`", () => {
    const reponsesEnBase = [
      { list: ["0_gestion"], sublist: { "0_gestion": ["0_test1"] } },
      { list: ["4_autres-outils-et-services-de-la-cae"], sublist: { "4_autres-outils-et-services-de-la-cae": ["1_outil-de-coremuneration"] } },
      { list: ["15_autres-metiers"], sublist: { "15_autres-metiers": ["1_plateforme-pour-reserver-de-la-reparation-velo"] } },
      { list: ["14_metiers-de-l-inclusion"], sublist: {} },
      { list: ["4_autres-outils-de-la-cae"], sublist: {} },
      {
        list: ["2_cooperation-et-communication-interne", "13_metiers-du-numerique"],
        sublist: { "2_cooperation-et-communication-interne": ["4_documentation-interne"], "13_metiers-du-numerique": ["2_cartographie"] },
      },
      { list: ["10_metiers-de-la-formation"], sublist: { "10_metiers-de-la-formation": ["0_logiciel-qualiopi"] } },
      { list: ["1_communication-externe"], sublist: { "1_communication-externe": ["3_plateforme-video"] } },
      { list: ["4_autres-outils-et-services-de-la-cae"], sublist: {} },
    ];
    for (const reponse of reponsesEnBase) {
      const res = valider(reponse);
      expect(res.success).toBe(true);
      // La `sublist` doit SURVIVRE au parse : c'est elle que `z.object` stripperait si le schéma
      // ne la déclarait pas, et la perte serait totalement silencieuse.
      if (res.success) expect(res.data.aapStep1m8ixxe88psung3p6a7n).toEqual(reponse);
    }
  });

  it("accepte la valeur normalisée d'une réponse sans `sublist`", () => {
    const res = valider(normalizeCategorizedValue({ list: ["14_metiers-de-l-inclusion"] }));
    expect(res.success).toBe(true);
  });

  it("accepte la sortie des toggles (pas seulement la donnée en base)", () => {
    let v: CategorizedCheckboxValue = { list: [], sublist: {} };
    v = toggleChild(v, "1_communication-externe", "3_plateforme-video", true);
    v = toggleCategory(v, "15_autres-metiers", true);
    expect(valider(v).success).toBe(true);
  });

  it("refuse une valeur vide quand le champ est requis", () => {
    expect(valider({ list: [], sublist: {} }, true).success).toBe(false);
    expect(valider({ list: ["0_a"], sublist: {} }, true).success).toBe(true);
  });
});
