import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Garde de `searchHeader.headlineFromFilter` : la prop nomme l'`id` d'un `dropdownFilters` dont la
 * valeur sélectionnée REMPLACE le `headline`. Rien, au runtime, ne signale une référence morte —
 * `optionsDuTitre` (`modules/search/lib/headlineFromFilter.ts`) renvoie `[]` quand le filtre est
 * introuvable, et l'appelant retombe sur le `headline` déclaré. Une faute de frappe (`publics` pour
 * `public`) ou le renommage de l'`id` du filtre rend donc la fonctionnalité SILENCIEUSEMENT
 * inopérante : la page réaffiche son titre générique sans qu'aucune porte ne le voie, exactement la
 * classe de dégradation muette que `deeplink-filters.test.ts` interdit pour les liens.
 *
 * Deux invariants, tous deux vérifiables sans exécuter le site :
 *  1. l'id visé existe parmi les `dropdownFilters` de la MÊME section (c'est la seule liste que la
 *     section passe à `optionsDuTitre`) ;
 *  2. ce filtre a une source d'options — `options` écrites à la main et/ou `optionsFrom`/`optionsKey`.
 *     Sans aucune des deux, il n'y aura jamais d'option à faire correspondre à la sélection, donc
 *     jamais de titre.
 *
 * Le filtre visé peut être `hidden` : la section cherche dans la liste complète, pas dans les
 * filtres visibles. Ce gate ne dit donc rien de `hidden`.
 */

const RACINE = path.resolve(__dirname, "../..");

interface FiltreLike {
  id?: string;
  options?: unknown[];
  optionsFrom?: unknown;
  optionsKey?: unknown;
}
interface PropsLike {
  headlineFromFilter?: unknown;
  dropdownFilters?: FiltreLike[];
}

const CONFIGS = fs
  .readdirSync(RACINE)
  .filter((f) => /^config\.prod(\..+)?\.json$/.test(f))
  .map((f) => ({ nom: f, contenu: JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf-8")) as unknown }));

/** Un usage de la prop, avec de quoi le situer dans le message d'échec. */
interface Usage {
  repere: string;
  vise: string;
  filtres: FiltreLike[];
}

/**
 * Parcours RÉCURSIF, pas seulement `pages[].sections[]` : un `searchHeader` peut vivre imbriqué
 * (`gridLayout.leftSection`, `rightSection`, `itemRules`…), et une référence morte y serait tout
 * aussi muette. Le repère porte le chemin JSON, pour que l'échec pointe l'endroit exact.
 */
function usages(): Usage[] {
  const out: Usage[] = [];
  const visiter = (noeud: unknown, chemin: string, nom: string) => {
    if (Array.isArray(noeud)) {
      noeud.forEach((v, i) => visiter(v, `${chemin}[${i}]`, nom));
      return;
    }
    if (!noeud || typeof noeud !== "object") return;
    const props = noeud as PropsLike;
    if (typeof props.headlineFromFilter === "string" && props.headlineFromFilter !== "") {
      out.push({
        repere: `${nom} ${chemin}`,
        vise: props.headlineFromFilter,
        filtres: props.dropdownFilters ?? [],
      });
    }
    for (const [cle, valeur] of Object.entries(noeud as Record<string, unknown>)) {
      visiter(valeur, `${chemin}.${cle}`, nom);
    }
  };
  for (const { nom, contenu } of CONFIGS) visiter(contenu, "", nom);
  return out;
}

describe("headlineFromFilter — la prop doit viser un filtre réel de la même section", () => {
  it("le parc est bien découvert", () => {
    expect(CONFIGS.length).toBeGreaterThan(5);
  });

  it("l'id visé existe parmi les `dropdownFilters` de la même section", () => {
    const morts = usages()
      .filter((u) => !u.filtres.some((f) => f.id === u.vise))
      .map(
        (u) =>
          `${u.repere} : « ${u.vise} » ne correspond à aucun dropdownFilter de la section ` +
          `(ids présents : ${u.filtres.map((f) => f.id).join(", ") || "aucun"})`,
      );
    expect(
      morts,
      "une référence morte ne lève rien : `optionsDuTitre` renvoie `[]` et la page réaffiche son " +
        "`headline` générique — la fonctionnalité disparaît sans un mot",
    ).toEqual([]);
  });

  it("le filtre visé a bien une source d'options", () => {
    const steriles = usages()
      .map((u) => ({ u, f: u.filtres.find((f) => f.id === u.vise) }))
      .filter(({ f }) => f && !(f.options?.length || f.optionsFrom || f.optionsKey))
      .map(
        ({ u }) =>
          `${u.repere} : le filtre « ${u.vise} » n'a ni \`options\` ni \`optionsFrom\`/\`optionsKey\``,
      );
    expect(
      steriles,
      "sans option à faire correspondre à la sélection, le titre ne peut jamais être remplacé",
    ).toEqual([]);
  });
});
