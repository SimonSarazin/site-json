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
