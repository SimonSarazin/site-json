// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SearchEntity } from "@communecter/cocolight-api-client";

/**
 * Fiche `poi-amenities` : la fiche des sites d'équipements sportifs est un OPT-IN (`preview.equipmentDetails`).
 * Sans l'option, la fiche reste celle de main — celle de sport-santé-bien-être, qui ne doit pas bouger (review de
 * la MR 114) : « Catégorie » sur `equip_type_name`, sport en texte, rangée « Partenariat », ni SIRET ni UAI.
 */

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/modules/search/i18n", () => ({}));
vi.mock("@/dateFns", () => ({ default: () => undefined }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/modules/profil/hooks/useProfilPermissions", () => ({
  useProfilPermissions: () => ({ canEditProfile: false }),
}));
vi.mock("@/modules/profil/components/sections/ProfileMapLeaflet", () => ({ default: () => null }));
vi.mock("@/components/ui/OptimizedImage", () => ({ OptimizedImage: () => null }));
vi.mock("@/modules/profil/components/profile-edit/EditModalRegistry", () => ({ DynamicEditModal: () => null }));
// La facette réelle cherche un filtre du site : une doublure qui dit sur quel champ elle filtrerait.
vi.mock("@/modules/search/components/ClickableFacet", () => ({
  ClickableFacet: ({ field, token }: { field: string; token: string }) => <span data-facet={field}>{token}</span>,
}));

import PreviewPoiAmenities from "./PreviewPoiAmenities";

const fiche = (serverData: Record<string, unknown>) =>
  ({ id: "poi1", serverData, refresh: vi.fn().mockResolvedValue(undefined) }) as unknown as SearchEntity;

const ITEM = fiche({
  name: "Gymnase du lycée",
  equip_type_name: "Salle multisports (gymnase)",
  categorie: "Salles",
  inst_part_bool: "1",
  inst_part_type: "Etablissement scolaire",
  aps_name: "Basket-Ball, Volley-Ball",
  equip_numero: "E974001",
  inst_siret: "12345678900011",
  inst_uai: "9740001A",
});

const rendre = (item: SearchEntity, preview: Record<string, unknown>) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<PreviewPoiAmenities item={item} preview={{ type: "poi-amenities", ...preview }} />, { wrapper });
};

const facette = (container: HTMLElement, field: string) =>
  [...container.querySelectorAll(`[data-facet="${field}"]`)].map((e) => e.textContent);

describe("PreviewPoiAmenities — fiche historique, sans `equipmentDetails` (sport-santé-bien-être)", () => {
  it("garde « Catégorie » sur equip_type_name, le sport en texte, ni type, ni particularité", () => {
    const { container } = rendre(ITEM, {});
    expect(screen.getByText("PreviewPoiAmenities.fields.category")).toBeTruthy();
    expect(facette(container, "equip_type_name")).toEqual(["Salle multisports (gymnase)"]);
    expect(screen.queryByText("PreviewPoiAmenities.fields.type")).toBeNull();
    expect(screen.queryByText("PreviewPoiAmenities.fields.particularity")).toBeNull();
    expect(facette(container, "categorie")).toEqual([]);
    expect(facette(container, "aps_name")).toEqual([]);
    // Le sport figure aussi dans l'en-tête de la fiche : du texte, sans facette, aux deux endroits.
    expect(screen.getAllByText("Basket-Ball, Volley-Ball").length).toBeGreaterThan(0);
  });

  it("garde la rangée « Partenariat » (type si inst_part_bool est vrai, sinon « Non »), sans SIRET ni UAI", () => {
    rendre(ITEM, {});
    expect(screen.getByText("PreviewPoiAmenities.fields.partnership")).toBeTruthy();
    expect(screen.getByText("Etablissement scolaire")).toBeTruthy();
    expect(screen.queryByText("PreviewPoiAmenities.equipNumero.siret")).toBeNull();
    expect(screen.queryByText("12345678900011")).toBeNull();
  });

  it("sans particularité : « Partenariat » vaut « Non »", () => {
    rendre(fiche({ ...ITEM.serverData, inst_part_bool: "0" }), {});
    expect(screen.getByText("PreviewPoiAmenities.no")).toBeTruthy();
  });
});

describe("PreviewPoiAmenities — fiche des sites d'équipements, avec `equipmentDetails`", () => {
  it("affiche type, catégorie, particularité et sports en valeurs cliquables, sans « Partenariat »", () => {
    const { container } = rendre(ITEM, { equipmentDetails: true });
    expect(screen.getByText("PreviewPoiAmenities.fields.type")).toBeTruthy();
    expect(facette(container, "equip_type_name")).toEqual(["Salle multisports (gymnase)"]);
    expect(facette(container, "categorie")).toEqual(["Salles"]);
    expect(facette(container, "inst_part_type")).toEqual(["Etablissement scolaire"]);
    expect(facette(container, "aps_name")).toEqual(["Basket-Ball", "Volley-Ball"]);
    expect(screen.queryByText("PreviewPoiAmenities.fields.partnership")).toBeNull();
  });

  it("affiche SIRET et UAI sous la fiche nationale, mais pas le marqueur d'absence", () => {
    rendre(fiche({ ...ITEM.serverData, inst_uai: "Donnée non renseignée" }), { equipmentDetails: true });
    expect(screen.getByText("12345678900011")).toBeTruthy();
    expect(screen.getByText("PreviewPoiAmenities.equipNumero.siret")).toBeTruthy();
    expect(screen.queryByText("PreviewPoiAmenities.equipNumero.uai")).toBeNull();
  });
});
