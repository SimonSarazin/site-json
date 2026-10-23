// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";

/**
 * Câblage des onglets du profil — la décision elle-même est testée par `lib/tabVisibility.test.ts` :
 *  - un onglet réservé au propriétaire (`userContext: own`) n'est PAS rendu avant l'hydratation, ni
 *    pour le propriétaire (HTML serveur = 1er rendu client), puis apparaît pour lui seul ;
 *  - un visiteur arrivé par l'URL de cet onglet est renvoyé au profil ;
 *  - les props de `StructuresTab` sont revalidées à l'exécution : invalides, l'onglet ne rend rien ;
 *  - sur un projet sans réponse liée, l'onglet cagnotte n'est jamais rendu, et son URL renvoie au profil.
 */
type EntiteProfil = { slug: string; getEntityType: () => string; serverData?: Record<string, unknown> };
const ctx = vi.hoisted(() => {
  const citoyen: EntiteProfil = { slug: "judi", getEntityType: () => "citoyens" };
  return {
    hydrated: true,
    me: { id: "u1", slug: "judi" } as { id: string; slug: string } | null,
    citoyen,
    entity: citoyen,
    tabs: [] as unknown[],
    structuresProps: undefined as unknown,
  };
});

vi.mock("@/hooks/useHydrated", () => ({ useHydrated: () => ctx.hydrated }));
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: ctx.me }) }));
vi.mock("@/hooks/useLocalization", () => ({ useLocalization: () => ({ t: (label: { fr: string }) => label.fr }) }));
vi.mock("../../hooks/useProfileEntity", () => ({
  useProfileEntity: () => ({ entity: ctx.entity, config: { tabs: ctx.tabs } }),
}));
vi.mock("../../ProfileSectionRenderer", () => ({ ProfileSectionRenderer: () => null }));
vi.mock("../TabDetailRenderer", () => ({ TabDetailRenderer: () => null }));
vi.mock("../tabs/NewsTab", () => ({ default: () => <p>onglet actualités</p> }));
vi.mock("../tabs/StructuresTab", () => ({
  default: (props: unknown) => {
    ctx.structuresProps = props;
    return <p>onglet structures</p>;
  },
}));

import ProfileTemplateDynamic from "./ProfileTemplateDynamic";

const PROPS_VALIDES = {
  answers: {
    formId: "6928096adf5caf0d230e7f26",
    structureFinderPath: "answers.sportSanteBienetre2172025_854_0.findersportSanteBienetre2172025_854_0mdn1fzoewyjg66n85p",
  },
};
const onglets = (props: unknown = PROPS_VALIDES) => [
  { id: "news", label: { fr: "Actualités" }, component: "NewsTab", condition: {} },
  {
    id: "structures",
    label: { fr: "Structures" },
    component: "StructuresTab",
    condition: { entityTypes: ["citoyens"], userContext: "own", auth: "required" },
    props,
  },
];

function Chemin() {
  return <p data-testid="chemin">{useLocation().pathname}</p>;
}
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/profil/:slug/*"
          element={
            <>
              <ProfileTemplateDynamic />
              <Chemin />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  ctx.hydrated = true;
  ctx.me = { id: "u1", slug: "judi" };
  ctx.entity = ctx.citoyen;
  ctx.tabs = onglets();
  ctx.structuresProps = undefined;
});

describe("ProfileTemplateDynamic — onglet réservé au propriétaire", () => {
  it("avant hydratation : pas d'onglet « Structures », même pour le propriétaire", () => {
    ctx.hydrated = false;
    renderAt("/profil/judi");
    expect(screen.getByRole("tab", { name: "Actualités" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Structures" })).toBeNull();
  });

  it("après hydratation, propriétaire : l'onglet apparaît et rend le composant avec ses props validées", async () => {
    renderAt("/profil/judi/structures");
    expect(screen.getByRole("tab", { name: "Structures" })).toBeTruthy();
    expect(await screen.findByText("onglet structures")).toBeTruthy();
    expect(ctx.structuresProps).toEqual(PROPS_VALIDES);
  });

  it("visiteur : pas d'onglet, et l'URL de l'onglet renvoie au profil", async () => {
    ctx.me = { id: "u2", slug: "autre" };
    renderAt("/profil/judi/structures");
    expect(screen.queryByRole("tab", { name: "Structures" })).toBeNull();
    await waitFor(() => expect(screen.getByTestId("chemin").textContent).toBe("/profil/judi"));
  });

  it("props invalides : l'onglet ne rend rien (revalidation à l'exécution, la config n'étant pas parsée)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    ctx.tabs = onglets({ answers: { formId: "pas-un-objectid", structureFinderPath: "x" } });
    renderAt("/profil/judi/structures");
    expect(screen.getByRole("tab", { name: "Structures" })).toBeTruthy();
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.queryByText("onglet structures")).toBeNull();
    warn.mockRestore();
  });
});

describe("ProfileTemplateDynamic — onglets cagnotte d'un projet", () => {
  const projet = (answer: unknown): EntiteProfil => ({ slug: "p", getEntityType: () => "projects", serverData: { answer } });

  beforeEach(() => {
    ctx.tabs = [
      { id: "about", label: { fr: "À propos" }, sections: [{ type: "profile-about" }] },
      {
        id: "finance",
        label: { fr: "Financements" },
        condition: { auth: "required" },
        sections: [{ type: "cagnotte-layout", props: { leftSections: [{ type: "finance" }] } }],
      },
    ];
  });

  it("sans réponse liée : pas d'onglet « Financements », avant comme après hydratation", () => {
    ctx.entity = projet(null);
    ctx.hydrated = false;
    const { unmount } = renderAt("/profil/p");
    expect(screen.getByRole("tab", { name: "À propos" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Financements" })).toBeNull();
    unmount();

    ctx.hydrated = true;
    renderAt("/profil/p");
    expect(screen.queryByRole("tab", { name: "Financements" })).toBeNull();
  });

  it("sans réponse liée : l'URL de l'onglet renvoie au profil", async () => {
    ctx.entity = projet("");
    renderAt("/profil/p/finance");
    await waitFor(() => expect(screen.getByTestId("chemin").textContent).toBe("/profil/p"));
  });

  it("relié à une réponse : l'onglet est proposé", () => {
    ctx.entity = projet("answer-1");
    renderAt("/profil/p");
    expect(screen.getByRole("tab", { name: "Financements" })).toBeTruthy();
  });
});
