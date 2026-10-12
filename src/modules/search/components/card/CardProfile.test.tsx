// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import type { Organization } from "@communecter/cocolight-api-client";

// La carte lit le contexte de session et les mutations « suivre » : hors sujet ici, mocks inertes.
vi.mock("@/hooks/useCocolight", () => ({ useCocolight: () => ({ me: null }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/modules/auth", () => ({ useAuthModal: () => ({ openLogin: vi.fn() }) }));
vi.mock("@/modules/profil/actions/mutations/relationship", () => ({
  useFollowEntity: () => ({ mutate: vi.fn(), isPending: false }),
  useUnfollowEntity: () => ({ mutate: vi.fn(), isPending: false }),
}));

import CardProfile from "./CardProfile";

const item = (tags: string[]) =>
  ({ id: "1", slug: "cabinet-x", serverData: { id: "1", name: "Cabinet X", tags } }) as unknown as Organization;
const mount = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/**
 * Chips de tags de la carte profil : `card.tagColors` est la même brique que sur `CardDefault`
 * (masquage des tags techniques, couleur des tags mappés). Sans conf, rien ne change pour les
 * 24 annuaires du parc qui utilisent cette carte.
 */
describe("CardProfile — chips de tags", () => {
  it("sans tagColors : les tags s'affichent tels quels, 3 au plus puis « +N »", () => {
    const { getByText, queryByText } = mount(<CardProfile item={item(["a", "b", "c", "d"])} />);
    for (const t of ["a", "b", "c"]) expect(getByText(t)).toBeInTheDocument();
    expect(queryByText("d")).toBeNull();
    expect(getByText("+1")).toBeInTheDocument();
  });

  it("tagColors.hideTags masque le marqueur d'annuaire, les autres restent — y compris ceux qui commencent pareil", () => {
    const { getByText, queryByText } = mount(
      <CardProfile
        item={item(["lieux-sante", "pharmacie", "lieux-sante-mentale"])}
        card={{ tagColors: { mapping: {}, hideTags: ["lieux-sante"] } }}
      />,
    );
    expect(queryByText("lieux-sante")).toBeNull();
    expect(getByText("pharmacie")).toBeInTheDocument();
    expect(getByText("lieux-sante-mentale")).toBeInTheDocument();
  });

  it("tous les tags masqués : rien — la fiche EST taguée, la carte ne prétend pas le contraire", () => {
    const { queryByText, container } = mount(
      <CardProfile item={item(["lieux-sante"])} card={{ tagColors: { mapping: {}, hideTags: ["lieux-sante"] } }} />,
    );
    expect(queryByText("Aucun tag")).toBeNull();
    expect(container.querySelector("[title]")).toBeNull();
  });

  it("fiche sans aucun tag : le repli historique « Aucun tag » reste", () => {
    const { getByText } = mount(<CardProfile item={item([])} />);
    expect(getByText("Aucun tag")).toBeInTheDocument();
  });

  it("showActions : « Contacter » et « Suivre » sont là par défaut, et disparaissent sur demande", () => {
    const avec = mount(<CardProfile item={item([])} />);
    expect(avec.getByText("Contacter")).toBeInTheDocument();
    expect(avec.getByText("Suivre")).toBeInTheDocument();
    avec.unmount();
    const sans = mount(<CardProfile item={item([])} card={{ showActions: false }} />);
    expect(sans.queryByText("Contacter")).toBeNull();
    expect(sans.queryByText("Suivre")).toBeNull();
  });

  it("tags en objet (tableau PHP à trous) : la carte rend les valeurs au lieu de planter", () => {
    const raw = { id: "1", slug: "x", serverData: { id: "1", name: "X", tags: { "1": "Pedagogie", "3": "Santé" } } } as unknown as Organization;
    const { getByText } = mount(<CardProfile item={raw} />);
    expect(getByText("Pedagogie")).toBeInTheDocument();
    expect(getByText("Santé")).toBeInTheDocument();
  });

  it("tagColors.mapping : pastille de couleur et libellé lisible, le tag brut en title", () => {
    const { getByText, getByTitle } = mount(
      <CardProfile
        item={item(["territoire:nord"])}
        card={{ tagColors: { mapping: { "territoire:nord": "var(--chart-1)" } } }}
      />,
    );
    expect(getByText("Nord")).toBeInTheDocument();
    const chip = getByTitle("territoire:nord");
    expect(chip.querySelector("span[aria-hidden]")).not.toBeNull();
  });
});
