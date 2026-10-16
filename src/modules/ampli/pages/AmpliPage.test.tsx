// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen } from "../../../../tests/test-utils-ui";
import type { AmpliModel } from "../types";

/**
 * Page `/ampli/:slug` — résolution de l'ampli et ses trois issues : introuvable,
 * non configuré (pas de formulaire), rendu normal. Les sections sont mockées.
 */

vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/SiteFooter", () => ({ SiteFooter: () => null }));
vi.mock("../AmpliSeo", () => ({
  AmpliSeo: (props: { name?: string }) => <div data-testid="seo" data-name={props.name ?? ""} />,
}));
vi.mock("../components/AmpliTabs", () => ({ AmpliTabs: () => <nav data-testid="tabs" /> }));
vi.mock("../AmpliRenderer", () => ({ AmpliRenderer: () => <div data-testid="renderer" /> }));

let amplis: AmpliModel[];
vi.mock("../hooks/useAmplis", () => ({
  useAmplis: () => ({ mode: "costum", amplis }),
  useAmpli: (slug: string | undefined) => amplis.find((ampli) => ampli.slug === slug) ?? null,
}));

const { default: AmpliPage } = await import("./AmpliPage");

const SINISTRE: AmpliModel = {
  slug: "sinistre",
  name: "Sinistre",
  tags: [],
  path: { name: "step.name", address: "step.address" },
  coform: "6927e9f0db22da724360303c",
};

function render(slug: string) {
  const router = createMemoryRouter(
    [{ path: "/ampli/:slug", element: <AmpliPage />, loader: () => ({ slug, activeTab: "home" }) }],
    { initialEntries: [`/ampli/${slug}`] },
  );
  return renderWithProviders(<RouterProvider router={router} />);
}

describe("AmpliPage", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    amplis = [SINISTRE];
  });

  it("rend l'ampli : onglets, sections, SEO à son nom", async () => {
    render("sinistre");

    expect(await screen.findByTestId("renderer")).toBeInTheDocument();
    expect(screen.getByTestId("tabs")).toBeInTheDocument();
    expect(screen.getByTestId("seo")).toHaveAttribute("data-name", "Sinistre");
  });

  it("annonce un slug inconnu, avec un lien vers la liste des amplis", async () => {
    render("inconnu");

    expect(await screen.findByText("Ampli non trouvé")).toBeInTheDocument();
    expect(screen.getByText("Aucun ampli « inconnu » n'existe sur ce site.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voir tous les amplis/ })).toHaveAttribute("href", "/ampli");
  });

  // Décision : pas de repli CMS. Sans formulaire, la page le DIT au lieu de
  // lancer les sections avec un id vide.
  it("dit qu'un ampli sans formulaire n'est pas configuré, sans rendre les sections", async () => {
    amplis = [{ ...SINISTRE, coform: null }];
    render("sinistre");

    expect(await screen.findByText("Ampli en préparation")).toBeInTheDocument();
    expect(screen.getByText(/« Sinistre » n'accepte pas encore de propositions/)).toBeInTheDocument();
    expect(screen.queryByTestId("renderer")).toBeNull();
    // Les onglets restent : on est bien sur la page de l'ampli.
    expect(screen.getByTestId("tabs")).toBeInTheDocument();
  });
});
