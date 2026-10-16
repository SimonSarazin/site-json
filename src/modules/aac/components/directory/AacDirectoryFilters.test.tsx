// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "../../lib/filtersKey";
import type { AacUsageOption } from "../../lib/aacUsage";

// Bundle « modules/aac » : les libellés sont ceux que verra l'utilisateur.
import "../../i18n";
import { AacDirectoryFilters } from "./AacDirectoryFilters";

const ARBRE: AacUsageOption[] = [
  {
    id: "communication",
    label: "Communication externe",
    count: 3,
    children: [{ id: "video", label: "Plateforme vidéo", count: 1, children: [] }],
  },
  {
    id: "gestion",
    label: "Gestion interne",
    count: 2,
    children: [{ id: "compta", label: "Comptabilité", count: 2, children: [] }],
  },
];

const TOUS_ACTIFS = { search: true, usage: true, tags: true, maturity: true, commune: true, sort: true };

function poser(filters: Partial<AacDirectoryFiltersState>) {
  const onChange = vi.fn();
  render(
    <LocalizationProvider>
      <AacDirectoryFilters
        filters={{ ...EMPTY_AAC_FILTERS, ...filters }}
        onChange={onChange}
        usageTree={ARBRE}
        tagOptions={[]}
        communeOptions={[]}
        maturityField={null}
        enabled={TOUS_ACTIFS}
      />
    </LocalizationProvider>
  );
  // L'accordéon est fermé au montage : les pastilles n'existent qu'une fois
  // « Filtrer par besoins » déplié.
  fireEvent.click(screen.getByRole("button", { name: /Filtrer par besoins/ }));
  return onChange;
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

/**
 * M20 — une liste de catégories VIDE signifie « Tous » : toutes les
 * sous-catégories redeviennent visibles, donc celle qui est cochée reste
 * atteignable. Le nettoyage la supprimait quand même, et la liste passait des
 * communs « Plateforme vidéo » à tous les communs sans que l'utilisateur ait
 * touché à cette pastille.
 */
describe("AacDirectoryFilters — sous-catégories à la décoche d'une catégorie (M20)", () => {
  it("décocher la DERNIÈRE catégorie conserve la sous-catégorie cochée", () => {
    const onChange = poser({ usage: ["communication"], usageSub: ["video"] });

    fireEvent.click(screen.getByRole("button", { name: /Communication externe/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ usage: [], usageSub: ["video"] });
  });

  it("décocher une catégorie parmi d'autres retire ses sous-catégories, devenues inatteignables", () => {
    const onChange = poser({
      usage: ["communication", "gestion"],
      usageSub: ["video", "compta"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Communication externe/ }));

    expect(onChange.mock.calls[0][0]).toMatchObject({
      usage: ["gestion"],
      usageSub: ["compta"],
    });
  });

  it("cocher une catégorie conserve une sous-catégorie qui lui appartient", () => {
    const onChange = poser({ usage: [], usageSub: ["video"] });

    fireEvent.click(screen.getByRole("button", { name: /Communication externe/ }));

    expect(onChange.mock.calls[0][0]).toMatchObject({
      usage: ["communication"],
      usageSub: ["video"],
    });
  });
});

/** Facette « Commune » (rôle `directory.fields.adresse`) : activée mais sans option, elle n'est pas rendue. */
describe("AacDirectoryFilters — facette « Commune »", () => {
  const poserCommunes = (
    communeOptions: { id: string; label: string; count?: number }[],
    filters: Partial<AacDirectoryFiltersState> = {}
  ) => {
    const onChange = vi.fn();
    render(
      <LocalizationProvider>
        <AacDirectoryFilters
          filters={{ ...EMPTY_AAC_FILTERS, ...filters }}
          onChange={onChange}
          usageTree={ARBRE}
          tagOptions={[]}
          communeOptions={communeOptions}
          maturityField={null}
          enabled={TOUS_ACTIFS}
        />
      </LocalizationProvider>
    );
    return onChange;
  };

  it("aucune commune (rôle `adresse` non déclaré) ⇒ la facette n'existe pas", () => {
    poserCommunes([]);

    expect(screen.queryByRole("button", { name: /Commune/ })).toBeNull();
  });

  it("des communes ⇒ la facette, ses options et leur décompte", () => {
    poserCommunes([
      { id: "Saint-Denis", label: "Saint-Denis", count: 2 },
      { id: "Le Tampon", label: "Le Tampon", count: 1 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Commune/ }));

    expect(screen.getByLabelText(/Saint-Denis/)).toBeTruthy();
    expect(screen.getByLabelText(/Le Tampon/)).toBeTruthy();
  });

  it("cocher une commune l'ajoute à l'état, sans toucher aux autres facettes", () => {
    const onChange = poserCommunes(
      [{ id: "Saint-Denis", label: "Saint-Denis", count: 2 }],
      { tags: ["Numérique"] }
    );

    fireEvent.click(screen.getByRole("button", { name: /Commune/ }));
    fireEvent.click(screen.getByLabelText(/Saint-Denis/));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({
      commune: ["Saint-Denis"],
      tags: ["Numérique"],
    });
  });
});
