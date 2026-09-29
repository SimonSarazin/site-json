// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import type { ReactNode } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Le slot est rendu DANS le formulaire de création : il ne doit rien afficher quand il n'a rien
 * à dire, ne jamais pouvoir soumettre le formulaire, et ne jamais faire quitter la page à
 * l'utilisateur qui remplit un wizard de cinq étapes. La logique de classement est couverte par
 * `entityDuplicates.test.ts` ; ici on teste le rendu et ce que le slot DEMANDE au hook.
 */
const ctx = vi.hoisted(() => ({
  state: { matches: [] as unknown[], found: 0, isLoading: false, isError: false, isSearched: true },
  received: null as Record<string, unknown> | null,
}));
vi.mock("../hooks/useEntityDuplicates", () => ({
  useEntityDuplicates: (params: Record<string, unknown>) => {
    ctx.received = params;
    return ctx.state;
  },
}));
vi.mock("@/hooks/useSite", () => ({
  useSite: () => ({
    config: { pages: [{ path: "/lieux", sections: [{ type: "searchProStatic", id: "annuaire", props: { baseParams: { notSourceKey: true, defaultFilters: { tags: "TiersLieux" } } } }] }] },
  }),
}));
// `useT` renvoie la clé brute : les assertions portent dessus.
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/modules/search/components/SwitchDetailsMode", () => ({
  SwitchDetailsMode: ({ item }: { item: { serverData: { name: string } } }) => <div data-testid="preview">{item.serverData.name}</div>,
}));

import EntityDuplicatesSlot from "./EntityDuplicatesSlot";
import type { DuplicateCheckSpec } from "./entityModalSpec";

const PARAMS: DuplicateCheckSpec = {
  nameField: "name",
  postalCodeField: "postalCode",
  limit: 5,
  search: { types: ["organizations"], from: { page: "/lieux", sectionId: "annuaire" } },
};

const match = (id: string, name: string, level: "strong" | "likely" | "possible", over: Record<string, unknown> = {}) => ({
  entity: { id, slug: id, serverData: { name } } as unknown as SearchEntity,
  candidate: { id, name, slug: id, postalCode: "62170", locality: "ATTIN", ...over },
  level,
  sameName: level !== "possible",
  samePostalCode: level === "strong",
});

function Host({ children, values }: { children: ReactNode; values: Record<string, unknown> }) {
  const form = useForm({ defaultValues: values });
  return <FormProvider {...form}><form>{children}</form></FormProvider>;
}
const mount = (values: Record<string, unknown> = { name: "La Plume à loup", postalCode: "62170" }, params = PARAMS) =>
  render(<Host values={values}><EntityDuplicatesSlot params={params} /></Host>);

beforeEach(() => {
  ctx.state = { matches: [], found: 0, isLoading: false, isError: false, isSearched: true };
  ctx.received = null;
});

describe("EntityDuplicatesSlot", () => {
  it("sans correspondance : ne rend RIEN (pas de « 0 résultat » sous le champ)", () => {
    const { container } = mount();
    expect(container.querySelector("form")?.childElementCount).toBe(0);
  });

  it("passe au hook les valeurs du formulaire et le périmètre RÉSOLU depuis la section du site", () => {
    mount();
    expect(ctx.received).toMatchObject({
      name: "La Plume à loup",
      postalCode: "62170",
      active: true,
      limit: 5,
      baseParams: { defaultTypes: ["organizations"], notSourceKey: true, defaultFilters: { tags: "TiersLieux" }, searchBy: ["name"] },
    });
  });

  it("sans champ code postal déclaré : le code postal n'est pas transmis", () => {
    mount({ name: "La Plume" }, { ...PARAMS, postalCodeField: undefined });
    expect(ctx.received?.postalCode).toBeUndefined();
  });

  it("périmètre introuvable : baseParams null, donc aucune recherche", () => {
    mount(undefined, { ...PARAMS, search: { types: ["organizations"], from: { page: "/lieux", sectionId: "absente" } } });
    expect(ctx.received?.baseParams).toBeNull();
  });

  it("liste les correspondances : nom, lieu, indice en TEXTE, région annoncée poliment", () => {
    ctx.state = { ...ctx.state, matches: [match("p1", "La Plume à Loup", "strong"), match("p2", "La Plume d'or", "possible")], found: 2 };
    const { getByRole, getByText, getAllByRole } = mount();
    const region = getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(getByText("EntityDuplicates.titleStrong")).toBeTruthy();
    expect(getAllByRole("listitem")).toHaveLength(2);
    expect(getByText("La Plume à Loup")).toBeTruthy();
    expect(getAllByRole("listitem")[0].textContent).toContain("62170 ATTIN");
    expect(getByText("EntityDuplicates.hint.sameNameSamePostalCode")).toBeTruthy();
  });

  it("titre neutre sans correspondance forte", () => {
    ctx.state = { ...ctx.state, matches: [match("p2", "La Plume d'or", "possible")], found: 1 };
    const { getByText, queryByText } = mount();
    expect(getByText("EntityDuplicates.title")).toBeTruthy();
    expect(queryByText("EntityDuplicates.titleStrong")).toBeNull();
  });

  it("aucun bouton ne peut soumettre le formulaire", () => {
    ctx.state = { ...ctx.state, matches: [match("p1", "La Plume à Loup", "strong")], found: 1 };
    const { getAllByRole } = mount();
    for (const b of getAllByRole("button")) {
      expect(b.getAttribute("type")).toBe("button");
      expect(b.getAttribute("aria-haspopup")).toBe("dialog");
    }
  });

  it("le lien vers la fiche s'ouvre dans un NOUVEL onglet, et n'existe pas sans slug", () => {
    ctx.state = {
      ...ctx.state,
      matches: [match("laPlume", "La Plume à Loup", "strong"), match("p2", "Sans slug", "possible", { slug: undefined })],
      found: 2,
    };
    const { getAllByRole } = mount();
    const links = getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/profil/laPlume");
    expect(links[0].getAttribute("target")).toBe("_blank");
    expect(links[0].getAttribute("rel")).toContain("noopener");
  });

  it("annonce les correspondances non affichées", () => {
    ctx.state = { ...ctx.state, matches: [match("p1", "La Plume à Loup", "likely")], found: 4 };
    expect(mount().getByText("EntityDuplicates.more")).toBeTruthy();
  });

  it("erreur de recherche : message dédié, sans liste", () => {
    ctx.state = { ...ctx.state, isError: true };
    const { getByText, queryAllByRole } = mount();
    expect(getByText("EntityDuplicates.error")).toBeTruthy();
    expect(queryAllByRole("listitem")).toHaveLength(0);
  });
});
