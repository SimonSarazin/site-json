// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AdminOrganization } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";

/**
 * Ce qui est verrouillé ici : chacun des trois états « rien à montrer » (chargement, aucune
 * orga, aucun résultat) a son propre rendu, et la recherche n'apparaît que si la liste est trop
 * longue pour se lire d'un coup.
 */

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));

const { CagnotteOrganizationPicker, ORG_SEARCH_THRESHOLD } = await import("./CagnotteOrganizationPicker");

const NOT_ADMIN = "PaymentConfigPage.orgPicker.notAdminTitle";
const NO_MATCH = "PaymentConfigPage.orgPicker.noMatch";

function makeOrgs(names: string[]): AdminOrganization[] {
  return names.map((name, i) => ({ id: `org-${i}`, name }));
}

const FEW = makeOrgs(["Fédération des CAE", "Coopérative Alpha", "Asso Beta"]);
const MANY = makeOrgs([
  "Fédération des CAE",
  "Coopérative Alpha",
  ...Array.from({ length: ORG_SEARCH_THRESHOLD }, (_, i) => `Structure ${i + 1}`),
]);

function renderPicker(over: Partial<Parameters<typeof CagnotteOrganizationPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const view = render(
    <CagnotteOrganizationPicker
      organizations={FEW}
      isLoading={false}
      selectedId=""
      onSelect={onSelect}
      {...over}
    />
  );
  return { onSelect, ...view };
}

describe("CagnotteOrganizationPicker", () => {
  it("pendant le chargement, affiche des squelettes et non « pas admin »", () => {
    const { container } = renderPicker({ organizations: [], isLoading: true });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(NOT_ADMIN)).toBeNull();
  });

  it("sans aucune orga administrée, affiche « pas admin »", () => {
    renderPicker({ organizations: [] });
    expect(screen.getByText(NOT_ADMIN)).toBeTruthy();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("liste courte : toutes les orgas visibles, pas de recherche", () => {
    renderPicker();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(FEW.length);
  });

  it("liste longue : le champ de recherche apparaît", () => {
    renderPicker({ organizations: MANY });
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(MANY.length);
  });

  it("la recherche ignore casse et accents", () => {
    renderPicker({ organizations: MANY });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "FEDERATION" } });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(1);
    expect(screen.getByRole("radio", { name: /Fédération des CAE/ })).toBeTruthy();
  });

  it("un terme sans résultat dit « aucun résultat », pas « pas admin »", () => {
    renderPicker({ organizations: MANY });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText(NO_MATCH)).toBeTruthy();
    expect(screen.queryByText(NOT_ADMIN)).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("l'orga choisie reste visible quand le terme l'exclut", () => {
    renderPicker({ organizations: MANY, selectedId: "org-1" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "federation" } });
    expect(screen.getByRole("radio", { name: /Coopérative Alpha/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Fédération des CAE/ })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("un clic sur une carte transmet l'orga", () => {
    const { onSelect } = renderPicker();
    fireEvent.click(screen.getByRole("radio", { name: /Asso Beta/ }));
    expect(onSelect).toHaveBeenCalledWith(FEW[2]);
  });
});
