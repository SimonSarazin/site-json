// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import type { ReactNode } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Le slot est rendu DANS le formulaire de création : il ne doit rien MONTRER quand il n'a rien
 * à dire, ne jamais pouvoir soumettre le formulaire, et ne jamais faire quitter la page à
 * l'utilisateur qui remplit un wizard de cinq étapes. La logique de classement est couverte par
 * `entityDuplicates.test.ts` ; ici on teste le rendu et ce que le slot DEMANDE au hook.
 */
const ctx = vi.hoisted(() => ({
  state: { matches: [] as unknown[], found: 0, hasMore: false, isLoading: false, isError: false, isSearched: true },
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
  SwitchDetailsMode: ({ item }: { item: { serverData: { name: string } } }) => (
    <div data-testid="preview">
      {item.serverData.name}
      <a href="https://exemple.org/page">lien de la description</a>
    </div>
  ),
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
const panel = (c: HTMLElement) => c.querySelector("section");

beforeEach(() => {
  ctx.state = { matches: [], found: 0, hasMore: false, isLoading: false, isError: false, isSearched: true };
  ctx.received = null;
});
afterEach(() => vi.restoreAllMocks());

describe("EntityDuplicatesSlot — rien à dire", () => {
  it("ne MONTRE rien, mais garde montée une région d'annonce vide, seule et marquée « muette »", () => {
    const { container, getByRole } = mount();
    expect(panel(container)).toBeNull();
    const form = container.querySelector("form") as HTMLFormElement;
    expect(form.childElementCount).toBe(1);
    const live = getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.hasAttribute("data-slot-quiet")).toBe(true);
    expect(live.textContent).toBe("");
  });
});

describe("EntityDuplicatesSlot — ce qu'il demande au hook", () => {
  it("les valeurs du formulaire et le périmètre RÉSOLU depuis la section du site", () => {
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
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mount(undefined, { ...PARAMS, search: { types: ["organizations"], from: { page: "/lieux", sectionId: "absente" } } });
    expect(ctx.received?.baseParams).toBeNull();
  });
});

describe("EntityDuplicatesSlot — panneau", () => {
  it("liste les correspondances : nom, lieu, indice en TEXTE ; l'annonce reprend le titre", () => {
    ctx.state = { ...ctx.state, matches: [match("p1", "La Plume à Loup", "strong"), match("p2", "La Plume d'or", "possible")], found: 2 };
    const { container, getByRole, getAllByRole, getByText } = mount();
    expect(getByRole("status").textContent).toBe("EntityDuplicates.titleStrong");
    const section = panel(container) as HTMLElement;
    expect(section.getAttribute("role")).toBeNull(); // la région vivante est l'annonce, pas le panneau
    expect(section.querySelector(`#${CSS.escape(section.getAttribute("aria-labelledby") ?? "")}`)?.textContent).toBe("EntityDuplicates.titleStrong");
    expect(getAllByRole("listitem")).toHaveLength(2);
    expect(getAllByRole("listitem")[0].textContent).toContain("62170 ATTIN");
    expect(getByText("EntityDuplicates.hint.sameNameSamePostalCode")).toBeTruthy();
  });

  it("titre neutre sans correspondance forte ; titre « plus de… » quand le serveur en a d'autres", () => {
    ctx.state = { ...ctx.state, matches: [match("p2", "La Plume d'or", "possible")], found: 1 };
    const neutre = mount();
    expect(neutre.getByRole("status").textContent).toBe("EntityDuplicates.title");
    neutre.unmount();
    ctx.state = { ...ctx.state, found: 50, hasMore: true };
    const { getByRole, getByText } = mount();
    expect(getByRole("status").textContent).toBe("EntityDuplicates.titleMany");
    expect(getByText("EntityDuplicates.moreMany")).toBeTruthy();
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
    const { container, queryAllByRole } = mount();
    expect(panel(container)?.textContent).toContain("EntityDuplicates.error");
    expect(queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("EntityDuplicatesSlot — aperçu", () => {
  const open = async () => {
    ctx.state = { ...ctx.state, matches: [match("p1", "La Plume à Loup", "strong")], found: 1 };
    const view = mount();
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(view.getByTestId("preview")).toBeTruthy());
    return view;
  };

  it("reste ouvert quand la liste se vide (réponse du nom suivant) pendant la lecture", async () => {
    const view = await open();
    ctx.state = { ...ctx.state, matches: [], found: 0 };
    view.rerender(<Host values={{ name: "La Plume à loup inexistant", postalCode: "62170" }}><EntityDuplicatesSlot params={PARAMS} /></Host>);
    expect(panel(view.container)).toBeNull();
    expect(view.getByTestId("preview").textContent).toContain("La Plume à Loup");
  });

  it("un lien de la description s'ouvre dans un nouvel onglet : la saisie du formulaire n'est pas perdue", async () => {
    const opened = vi.spyOn(window, "open").mockImplementation(() => null);
    const view = await open();
    const link = view.getByText("lien de la description");
    const allowed = fireEvent.click(link);
    expect(allowed).toBe(false); // navigation par défaut empêchée
    expect(opened).toHaveBeenCalledWith("https://exemple.org/page", "_blank", "noopener,noreferrer");
  });
});
