import { describe, it, expect } from "vitest";
import { buildDynamicNavChildren, DEFAULT_DYNAMIC_NAV_LIMIT } from "./dynamicNav";
import { resolveFilterHydration } from "@/modules/search/lib/hydrateDropdownFilter";
import { resolveListSources } from "@/lib/listSources";
import type { DropdownOptionConfig } from "@/modules/search/lib/dropdownFilters";

/** Reproduit exactement la lecture côté `SearchHeaderSection.tsx` (`raw.split(",")` puis
 *  `decodeURIComponent` par segment) — sert à prouver l'aller-retour URL, pas seulement la forme
 *  de la chaîne produite. */
function readBackAsSearchHeaderSectionWould(path: string, filterId: string): string[] {
  const raw = new URLSearchParams(path.split("?")[1]).get(filterId) ?? "";
  if (!raw) return [];
  return raw.split(",").map((s) => {
    try {
      return decodeURIComponent(s.trim());
    } catch {
      return s.trim();
    }
  });
}

describe("buildDynamicNavChildren", () => {
  const owner = { pathname: "/blog", filter: { id: "theme" } };

  it("un enfant par valeur, path = page propriétaire + query param filtre=valeur (double-encodé)", () => {
    const children = buildDynamicNavChildren(owner, ["La petite enfance", "La santé"]);
    expect(children).toEqual([
      { label: { fr: "La petite enfance", en: "La petite enfance" }, path: "/blog?theme=La%2520petite%2520enfance" },
      { label: { fr: "La santé", en: "La santé" }, path: "/blog?theme=La%2520sant%25C3%25A9" },
    ]);
  });

  it("aller-retour correct pour une valeur banale", () => {
    const [child] = buildDynamicNavChildren(owner, ["La petite enfance"]);
    expect(readBackAsSearchHeaderSectionWould(child.path!, "theme")).toEqual(["La petite enfance"]);
  });

  it("aller-retour correct pour une valeur contenant une virgule LITTÉRALE (cas réel en base, cf. dropdownFilterToParam) — sans le double encodage, `raw.split(\",\")` la coupait en deux", () => {
    const [child] = buildDynamicNavChildren(owner, ["Salon professionnel,"]);
    expect(readBackAsSearchHeaderSectionWould(child.path!, "theme")).toEqual(["Salon professionnel,"]);
  });

  it("respecte le plafond passé explicitement", () => {
    const children = buildDynamicNavChildren(owner, ["a", "b", "c"], 2);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.label.fr)).toEqual(["A", "B"]);
  });

  it("plafond par défaut (DEFAULT_DYNAMIC_NAV_LIMIT) si non précisé", () => {
    const values = Array.from({ length: DEFAULT_DYNAMIC_NAV_LIMIT + 5 }, (_, i) => `valeur-${i}`);
    const children = buildDynamicNavChildren(owner, values);
    expect(children).toHaveLength(DEFAULT_DYNAMIC_NAV_LIMIT);
  });

  it("liste vide : aucun enfant", () => {
    expect(buildDynamicNavChildren(owner, [])).toEqual([]);
  });
});

/**
 * L'aller-retour qui compte VRAIMENT : le lien engendré doit non seulement se relire (ci-dessus),
 * mais être RECONNU par l'hydratation de la page cible. Les deux étaient dissociés, et le lien
 * passait la première épreuve en échouant la seconde : le menu porte la valeur BRUTE de
 * `costum.lists` (« La santé »), alors que l'option de la page cible vient du socle de config et
 * garde son id de SLUG (`optionsFrom.withDeclared`). L'hydratation ne comparait qu'aux ids →
 * `skip` : bonne page, AUCUN filtre, aucune erreur, aucune trace.
 */
describe("menu dynamicList → hydratation du filtre de la page cible", () => {
  const owner = { pathname: "/theme", filter: { id: "theme" } };
  /** Options telles que `useDynamicFilterOptions` les rend avec `withDeclared` : le socle déclaré
   *  garde son id de slug, sa `value` étant la graphie stockée en base. */
  const optionsDeLaPage: DropdownOptionConfig[] = [
    { id: "la-sante", value: "La santé", label: { fr: "La santé", en: "Health" } },
    { id: "les-jeux", value: "Les jeux", label: { fr: "Les jeux", en: "Games" } },
    // Valeur présente en base SEULEMENT (hors socle) : son id EST la valeur.
    { id: "Alimentation", value: "Alimentation", label: "Alimentation" },
  ] as unknown as DropdownOptionConfig[];

  /** Ce que fait `SearchHeaderSection` : lire le param, puis décider. */
  const hydrater = (path: string) =>
    resolveFilterHydration({
      raw: new URLSearchParams(path.split("?")[1]).get("theme") ?? "",
      lastAppliedRaw: undefined,
      optionsReady: true,
      hasCurrentSelection: false,
      options: optionsDeLaPage,
    });

  it("valeur du socle : le filtre est appliqué, sous l'id de l'option", () => {
    const { values } = resolveListSources([{ values: ["La santé"] }]);
    const [child] = buildDynamicNavChildren(owner, values);
    expect(hydrater(child.path!)).toEqual({ action: "apply", ids: ["la-sante"] });
  });

  it("valeur présente en base seulement : appliquée telle quelle", () => {
    const [child] = buildDynamicNavChildren(owner, ["Alimentation"]);
    expect(hydrater(child.path!)).toEqual({ action: "apply", ids: ["Alimentation"] });
  });

  it("valeur à virgule littérale : le double encodage survit jusqu'à l'option", () => {
    const options = [{ id: "salon", value: "Salon professionnel," , label: "Salon professionnel," }] as unknown as DropdownOptionConfig[];
    const [child] = buildDynamicNavChildren(owner, ["Salon professionnel,"]);
    expect(
      resolveFilterHydration({
        raw: new URLSearchParams(child.path!.split("?")[1]).get("theme") ?? "",
        lastAppliedRaw: undefined,
        optionsReady: true,
        hasCurrentSelection: false,
        options,
      }),
    ).toEqual({ action: "apply", ids: ["salon"] });
  });

  it("valeur qu'aucune option ne porte : skip (une liste retirée ne casse pas la page)", () => {
    const [child] = buildDynamicNavChildren(owner, ["Thème disparu"]);
    expect(hydrater(child.path!)).toEqual({ action: "skip" });
  });
});
