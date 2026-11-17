// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Pliage de la carte équipement (`card.collapsible`) : repliée par défaut sur
 * une ligne titre + sous-titre — la lecture de la liste observatoire — dépliée
 * par le chevron, qui ne doit PAS ouvrir la fiche au passage.
 */

// `useT` renvoie la clé brute : les assertions portent dessus.
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
// Hors périmètre : le filtre par installation (URL + contexte de page).
vi.mock("../../hooks/useInstallationFilter", () => ({
  useInstallationFilter: () => ({ enabled: false, toggle: vi.fn(), isActive: () => false }),
}));
// Compté, résultat inchangé : la commune ne doit pas se relire à chaque rendu (review de la MR 120).
vi.mock("../../lib/dropdownFilters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/dropdownFilters")>();
  return { ...actual, optionLabelOf: vi.fn(actual.optionLabelOf) };
});

// Créneaux de la page (`card.slotsBand`) : la mesure partagée a son test (`useSlotUsage`), simulée ici.
const creneaux = vi.hoisted(() => ({
  appels: [] as unknown[],
  usage: undefined as { planned: Set<string>; rates: Map<string, number> } | undefined,
}));
vi.mock("../../hooks/useSlotUsage", () => ({
  useSlotUsage: (conf: unknown) => {
    creneaux.appels.push(conf);
    return { usage: conf ? creneaux.usage : undefined, loading: false, failed: false, refetch: vi.fn() };
  },
}));

import type React from "react";
import { SiteContext } from "@/contexts/SiteContext";
import { optionLabelOf } from "../../lib/dropdownFilters";
import CardPoiAmenities from "./CardPoiAmenities";

const item = {
  serverData: {
    name: "Salle multisports - Win-Lime",
    equip_type_name: "Salle multisports (gymnase)",
    inst_nom: "Complexe sportif Win-Lime",
    equip_eclair: true,
  },
} as unknown as SearchEntity;

const AMENITIES = "CardPoiAmenities.amenities";

describe("CardPoiAmenities (card.collapsible)", () => {
  it("repliée par défaut : titre + sous-titre, aucun bloc d'aménagement", () => {
    render(<CardPoiAmenities item={item} card={{ collapsible: true }} />);

    expect(screen.getByText("Salle multisports - Win-Lime")).toBeInTheDocument();
    // Sous-titre composé comme celui de la liste observatoire (valeurs jointes par « · »).
    expect(
      screen.getByText("Salle multisports (gymnase) · Complexe sportif Win-Lime"),
    ).toBeInTheDocument();
    expect(screen.queryByText(AMENITIES)).not.toBeInTheDocument();
  });

  it("le chevron déplie SANS ouvrir la fiche", () => {
    const onClick = vi.fn();
    render(<CardPoiAmenities item={item} onClick={onClick} card={{ collapsible: true }} />);

    fireEvent.click(screen.getByLabelText("CardPoiAmenities.expand"));

    expect(screen.getByText(AMENITIES)).toBeInTheDocument();
    // stopPropagation : sans elle, déplier ouvrirait la fiche par-dessus.
    expect(onClick).not.toHaveBeenCalled();
    // Et on peut replier.
    fireEvent.click(screen.getByLabelText("CardPoiAmenities.collapse"));
    expect(screen.queryByText(AMENITIES)).not.toBeInTheDocument();
  });

  it("sans la clé, la carte reste dépliée et sans chevron (comportement historique)", () => {
    render(<CardPoiAmenities item={item} card={{}} />);

    expect(screen.getByText(AMENITIES)).toBeInTheDocument();
    expect(screen.queryByLabelText("CardPoiAmenities.collapse")).not.toBeInTheDocument();
  });

  it("bouton « Fiche » : présent avec onOpenSheet, il ouvre le détail sans déclencher le clic de carte", () => {
    const onClick = vi.fn();
    const onOpenSheet = vi.fn();
    render(
      <CardPoiAmenities
        item={item}
        onClick={onClick}
        onOpenSheet={onOpenSheet}
        card={{ collapsible: true }}
      />,
    );

    fireEvent.click(screen.getByText("CardPoiAmenities.sheet"));
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
    // Le clic de carte porte la SÉLECTION dans ce mode : le bouton ne doit pas
    // la déclencher au passage.
    expect(onClick).not.toHaveBeenCalled();
  });

  it("sans onOpenSheet, pas de bouton « Fiche » (il ferait double emploi avec le clic)", () => {
    render(<CardPoiAmenities item={item} card={{ collapsible: true }} />);
    expect(screen.queryByText("CardPoiAmenities.sheet")).not.toBeInTheDocument();
  });

  it("un clic sur la ligne repliée ouvre la fiche", () => {
    const onClick = vi.fn();
    render(<CardPoiAmenities item={item} onClick={onClick} card={{ collapsible: true }} />);

    fireEvent.click(screen.getByText("Salle multisports - Win-Lime"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("CardPoiAmenities (card.communeFrom)", () => {
  // Une page dont le filtre `poi-postalCode` regroupe deux codes postaux sous une commune.
  const config = {
    pages: [{
      path: "/equipements",
      sections: [{ type: "searchHeader", props: { dropdownFilters: [{
        id: "poi-postalCode", label: "Commune", field: "address.postalCode",
        options: [{ id: "saint-paul", label: "Saint-Paul (97411 / 97434)", values: ["97411", "97434"] }],
      }] } }],
    }],
  };
  const lieuDit = {
    serverData: { ...item.serverData, address: { postalCode: "97411", addressLocality: "Bois-de-Nèfles" } },
  } as unknown as SearchEntity;
  const avecSite = (ui: React.ReactElement) => (
    <SiteContext.Provider value={{ config } as unknown as React.ContextType<typeof SiteContext>}>{ui}</SiteContext.Provider>
  );

  it("ajoute la commune de rattachement sous le lieu-dit", () => {
    render(avecSite(<CardPoiAmenities item={lieuDit} card={{ communeFrom: { filter: "poi-postalCode" } }} />));
    expect(screen.getByText("97411 Bois-de-Nèfles")).toBeInTheDocument();
    expect(screen.getByText("CardPoiAmenities.commune")).toBeInTheDocument();
  });

  it("sans la clé, ou hors SiteProvider, pas de ligne de commune", () => {
    const { unmount } = render(avecSite(<CardPoiAmenities item={lieuDit} card={{}} />));
    expect(screen.queryByText("CardPoiAmenities.commune")).not.toBeInTheDocument();
    unmount();
    render(<CardPoiAmenities item={lieuDit} card={{ communeFrom: { filter: "poi-postalCode" } }} />);
    expect(screen.queryByText("CardPoiAmenities.commune")).not.toBeInTheDocument();
  });

  it("la commune se lit une fois par carte, pas à chaque rendu", () => {
    vi.mocked(optionLabelOf).mockClear();
    const carte = () => avecSite(<CardPoiAmenities item={lieuDit} card={{ communeFrom: { filter: "poi-postalCode" } }} />);
    const { rerender } = render(carte());
    rerender(carte());
    expect(screen.getByText("CardPoiAmenities.commune")).toBeInTheDocument();
    expect(optionLabelOf).toHaveBeenCalledTimes(1);
  });
});

describe("CardPoiAmenities (card.slotsBand)", () => {
  const POI = "6a0b3078f16441794857e2f0";
  const equipement = { id: POI, serverData: { ...item.serverData, id: POI } } as unknown as SearchEntity;
  const reservations = { form: "f", step: "s", fields: { finder: "fi", slots: "sl" } };
  const list = { preview: { reservations } } as unknown as React.ComponentProps<typeof CardPoiAmenities>["list"];
  const bande = (container: HTMLElement) => (container.firstElementChild as HTMLElement).style.borderLeftColor;

  it("sans la clé : bande d'origine, aucune réservation demandée", () => {
    creneaux.appels = [];
    const { container } = render(<CardPoiAmenities item={equipement} card={{}} list={list} />);
    expect(bande(container)).toBe("var(--card-border-left)");
    expect(creneaux.appels.every((c) => c === undefined)).toBe(true);
  });

  it("équipement qui a un planning : bande de la couleur choisie (défaut accent) et taux sous le type", () => {
    creneaux.usage = { planned: new Set([POI]), rates: new Map([[POI, 0.184]]) };
    const { container, unmount } = render(<CardPoiAmenities item={equipement} card={{ slotsBand: {} }} list={list} />);
    expect(creneaux.appels[creneaux.appels.length - 1]).toBe(reservations);
    expect(bande(container)).toBe("var(--accent)");
    expect(screen.getByText("CardPoiAmenities.slotsRate")).toBeInTheDocument();
    unmount();
    const autre = render(<CardPoiAmenities item={equipement} card={{ slotsBand: { color: "chart-2" } }} list={list} />);
    expect(bande(autre.container)).toBe("var(--chart-2)");
  });

  it("sans planning, ou réservations pas encore lues : bande d'origine, pas de ligne de créneaux", () => {
    creneaux.usage = { planned: new Set(["autre"]), rates: new Map() };
    const { container, unmount } = render(<CardPoiAmenities item={equipement} card={{ slotsBand: {} }} list={list} />);
    expect(bande(container)).toBe("var(--card-border-left)");
    expect(screen.queryByText("CardPoiAmenities.slotsRate")).toBeNull();
    unmount();
    creneaux.usage = undefined;
    const avant = render(<CardPoiAmenities item={equipement} card={{ slotsBand: {} }} list={list} />);
    expect(bande(avant.container)).toBe("var(--card-border-left)");
  });

  it("planning sans plage de référence (pas de `usage`) : la bande, et « avec créneaux » sans taux", () => {
    creneaux.usage = { planned: new Set([POI]), rates: new Map() };
    render(<CardPoiAmenities item={equipement} card={{ slotsBand: {} }} list={list} />);
    expect(screen.getByText("CardPoiAmenities.slots")).toBeInTheDocument();
  });

  it("repliée : la couleur, et le texte pour les lecteurs d'écran", () => {
    creneaux.usage = { planned: new Set([POI]), rates: new Map([[POI, 0.2]]) };
    const { container } = render(<CardPoiAmenities item={equipement} card={{ slotsBand: {}, collapsible: true }} list={list} />);
    expect(bande(container)).toBe("var(--accent)");
    expect(screen.getByText("CardPoiAmenities.slotsRate")).toHaveClass("sr-only");
  });
});
