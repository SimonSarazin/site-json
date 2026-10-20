// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { EMPTY_AAC_USAGE } from "../../lib/aacUsage";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";

/**
 * Affichage de la commune dans l'interface « editorial » : la commune seule (rue et code postal
 * en infobulle), et rien pour un commun sans adresse — ni icône, ni séparateur.
 */
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _default?: unknown, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(" ")}` : key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const CommunCardEditorial = (await import("./CommunCardEditorial")).default;
const CommunRowEditorial = (await import("./CommunRowEditorial")).default;

function commun(patch: Partial<CommunCard> = {}): CommunCard {
  return {
    id: "c1",
    title: "Tiers-lieu du Butor",
    hasTitle: true,
    description: "Un atelier partagé",
    tags: ["Gouvernance"],
    keywords: [],
    maturity: null,
    imageUrl: null,
    funds: [],
    totalRequested: 0,
    totalFunded: 0,
    progressPercent: 0,
    hasFundingRequest: false,
    usersCount: 0,
    interestCount: 0,
    isSelected: true,
    usage: EMPTY_AAC_USAGE,
    address: {
      locality: "Saint-Denis",
      postalCode: "97400",
      streetAddress: "12 rue Juliette Dodu",
      country: "RE",
      localityId: "c-sd",
      label: "12 rue Juliette Dodu, 97400, Saint-Denis",
    },
    project: null,
    createdAt: 0,
    updatedAt: 0,
    ...patch,
  };
}

const renderIn = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

afterEach(cleanup);

describe.each([
  ["carte", CommunCardEditorial],
  ["ligne", CommunRowEditorial],
] as const)("interface « editorial » — %s", (_label, Item) => {
  it("affiche la COMMUNE seule ; l'adresse complète reste en infobulle", () => {
    renderIn(<Item commun={commun()} />);

    expect(screen.getByText("Saint-Denis")).toBeTruthy();
    // Ni rue ni code postal dans le texte.
    expect(screen.queryByText(/Juliette Dodu/)).toBeNull();
    expect(screen.queryByText(/97400/)).toBeNull();
    expect(
      document.querySelector('[title="12 rue Juliette Dodu, 97400, Saint-Denis"]')
    ).not.toBeNull();
  });

  it("sans adresse (rôle `adresse` non déclaré), rien n'est rendu", () => {
    renderIn(<Item commun={commun({ address: null })} />);

    expect(screen.queryByText("Saint-Denis")).toBeNull();
    expect(screen.queryByText("directory.card.location")).toBeNull();
  });

  it("adresse en texte libre (question TEXTE) : pas de commune ⇒ rien non plus", () => {
    const freeText = commun({
      address: {
        locality: "",
        postalCode: "",
        streetAddress: "",
        country: "",
        localityId: "",
        label: "12 rue du Port, Le Port",
      },
    });
    renderIn(<Item commun={freeText} />);

    expect(screen.queryByText(/Le Port/)).toBeNull();
  });
});
