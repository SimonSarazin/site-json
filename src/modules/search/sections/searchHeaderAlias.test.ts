import { describe, it, expect } from "vitest";
import { Section } from "@/types/site-schema";

/**
 * Verrouille la fin de la migration `title-with-filters-rezo-la-mer` →
 * `searchHeader` : le type canonique parse, l'ancien alias est REJETÉ par le
 * schéma (supprimé lors du découplage des noms de sections — les configs ont
 * été migrés par scripts/migrate-section-types.mjs). Toute réintroduction de
 * l'alias (ou config non migré) fait échouer ce test.
 */

const props = {
  headline: { fr: "Titre", en: "Title" },
  subhead: { fr: "Sous-titre", en: "Subtitle" },
  showSearch: true,
  searchPlaceholder: { fr: "Rechercher…", en: "Search…" },
  types: [{ id: "orgs", label: { fr: "Structures", en: "Orgs" } }],
  dropdownFilters: [
    {
      id: "theme",
      label: { fr: "Thème", en: "Theme" },
      field: "tags",
      multiple: true,
      options: [{ id: "sport", label: { fr: "Sport", en: "Sport" } }],
    },
  ],
  buttons: [{ label: { fr: "Ajouter", en: "Add" }, action: "add-organization" as const }],
};

describe("searchHeader (alias title-with-filters-rezo-la-mer supprimé)", () => {
  it("parse le type canonique `searchHeader`", () => {
    const parsed = Section.parse({ type: "searchHeader", id: "h1", props });
    expect(parsed.type).toBe("searchHeader");
  });

  it("REJETTE l'ancien alias `title-with-filters-rezo-la-mer`", () => {
    expect(() =>
      Section.parse({ type: "title-with-filters-rezo-la-mer", id: "h1", props }),
    ).toThrow();
  });

  it("rejette `categories` (champ supprimé) — strippé, absent du résultat", () => {
    const parsed = Section.parse({
      type: "searchHeader",
      props: { ...props, categories: [{ id: "x", label: { fr: "X", en: "X" } }] },
    }) as { props: Record<string, unknown> };
    expect(parsed.props.categories).toBeUndefined();
  });
});
