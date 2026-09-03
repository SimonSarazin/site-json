import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Garde des DEEP-LINKS de filtre : un lien « voir tous » qui prétend arriver filtré doit porter une
 * valeur que la page cible sait reconnaître.
 *
 * L'hydratation d'un `dropdownFilters` rapproche la valeur d'URL des options par
 * `resolveOptionInList` (`dropdownFilters.ts`) : id exact, puis `value` normalisée, puis libellé.
 * Un lien écrit avec le libellé — `?territoire=Familles en sol mineur Hénin Carvin` au lieu de
 * `?territoire=familles-en-sol-mineur-henin-carvin` — filtre donc bien, mais reste FRAGILE : il
 * casse le jour où le libellé est retouché, et n'est pas l'URL qu'un clic sur la facette produit
 * (deux permaliens pour le même état). Ce gate maintient donc la convention « une URL de config
 * porte l'ID de l'option », la seule qui ne dépende pas d'un texte d'affichage.
 * (`resolveFilterHydration` écarte silencieusement une valeur qu'aucune option ne porte — c'est
 * voulu : une option supprimée ne doit pas casser un lien partagé.)
 *
 * Portée : les `customHeader.linkHref` dont la page cible, dans la MÊME config, déclare des
 * `dropdownFilters`. Les pages qui filtrent par une sidebar `filters` suivent une autre convention
 * (`computeFiltersFromUrl` accepte `name || id`) et sortent volontairement de ce gate.
 */

const RACINE = path.resolve(__dirname, "../..");

interface OptionLike {
  id?: string;
}
interface FiltreLike {
  id?: string;
  options?: OptionLike[];
}
interface SectionLike {
  props?: {
    dropdownFilters?: FiltreLike[];
    customHeader?: { linkHref?: string };
  };
}
interface PageLike {
  path?: string;
  sections?: SectionLike[];
}

const CONFIGS = fs
  .readdirSync(RACINE)
  .filter((f) => /^config\.prod(\..+)?\.json$/.test(f))
  .map((f) => ({
    nom: f,
    pages: (JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf-8")).pages ?? []) as PageLike[],
  }));

/** Filtres déclarés par une page cible : id du filtre → ids d'options acceptés en URL. */
function filtresDeLaPage(pages: PageLike[], cible: string): Map<string, Set<string>> {
  const filtres = new Map<string, Set<string>>();
  for (const page of pages) {
    if (page.path !== cible) continue;
    for (const section of page.sections ?? []) {
      for (const filtre of section.props?.dropdownFilters ?? []) {
        if (!filtre.id) continue;
        const ids = filtre.options?.map((o) => o.id).filter((id): id is string => !!id) ?? [];
        filtres.set(filtre.id, new Set(ids));
      }
    }
  }
  return filtres;
}

/** Un paramètre de deep-link à vérifier, avec de quoi le situer dans le message d'échec. */
interface Lien {
  repere: string;
  cle: string;
  valeur: string;
  filtres: Map<string, Set<string>>;
}

function deepLinks(): Lien[] {
  const liens: Lien[] = [];
  for (const { nom, pages } of CONFIGS) {
    for (const page of pages) {
      for (const section of page.sections ?? []) {
        const href = section.props?.customHeader?.linkHref;
        if (!href?.includes("?")) continue;
        const [cible, query] = href.split("?");
        const filtres = filtresDeLaPage(pages, cible);
        if (filtres.size === 0) continue; // page cible sans dropdownFilters → autre convention
        for (const [cle, brut] of new URLSearchParams(query)) {
          // Même découpage qu'à l'hydratation : une valeur multiple est séparée par des virgules.
          for (const valeur of brut.split(",").map((v) => v.trim())) {
            liens.push({ repere: `${nom} ${page.path} → ${href}`, cle, valeur, filtres });
          }
        }
      }
    }
  }
  return liens;
}

describe("deep-links de filtre — la page cible doit reconnaître la valeur", () => {
  it("le parc est bien découvert", () => {
    expect(CONFIGS.length).toBeGreaterThan(5);
  });

  it("chaque paramètre vise un filtre qui existe sur la page cible", () => {
    const inconnus = deepLinks()
      .filter((l) => !l.filtres.has(l.cle))
      .map((l) => `${l.repere} : aucun dropdownFilter d'id « ${l.cle} » sur la page cible`);
    expect(inconnus).toEqual([]);
  });

  it("chaque valeur est un id d'option, pas un libellé", () => {
    const invalides = deepLinks()
      .filter((l) => l.filtres.has(l.cle) && !l.filtres.get(l.cle)!.has(l.valeur))
      .map((l) => `${l.repere} : « ${l.valeur} » n'est pas un id de « ${l.cle} »`);
    expect(
      invalides,
      "une URL de config porte l'ID de l'option : un libellé est certes reconnu par " +
        "`resolveOptionInList`, mais il cesse de l'être dès qu'on retouche le texte affiché — et " +
        "une valeur que plus aucune option ne porte est ignorée en silence, la page cible " +
        "s'ouvrant NON filtrée alors que le bouton promettait un sous-ensemble",
    ).toEqual([]);
  });
});
