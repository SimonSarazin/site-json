import { describe, it, expect } from "vitest";
import { Section } from "@/types/site-schema";

/**
 * Verrouille l'équivalence entre le type canonique `searchHeader` et son alias
 * rétro-compat `title-with-filters-rezo-la-mer` : mêmes props, parsing OK pour
 * les deux. Invariant indispensable à la migration des configs (étape 6).
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

describe("searchHeader ⇄ title-with-filters-rezo-la-mer (alias)", () => {
  it("parse le type canonique `searchHeader`", () => {
    const parsed = Section.parse({ type: "searchHeader", id: "h1", props });
    expect(parsed.type).toBe("searchHeader");
  });

  it("parse l'alias `title-with-filters-rezo-la-mer`", () => {
    const parsed = Section.parse({ type: "title-with-filters-rezo-la-mer", id: "h1", props });
    expect(parsed.type).toBe("title-with-filters-rezo-la-mer");
  });

  it("produit des props identiques pour les deux types", () => {
    const a = Section.parse({ type: "searchHeader", id: "h1", props }) as { props: unknown };
    const b = Section.parse({ type: "title-with-filters-rezo-la-mer", id: "h1", props }) as {
      props: unknown;
    };
    expect(a.props).toEqual(b.props);
  });

  it("rejette `categories` (champ supprimé) — strippé, absent du résultat", () => {
    const parsed = Section.parse({
      type: "searchHeader",
      props: { ...props, categories: [{ id: "x", label: { fr: "X", en: "X" } }] },
    }) as { props: Record<string, unknown> };
    expect(parsed.props.categories).toBeUndefined();
  });
});
