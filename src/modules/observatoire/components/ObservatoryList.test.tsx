// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { renderWithProviders } from "../../../../tests/test-utils-ui";
import "../i18n";
import { ObservatoryList } from "./ObservatoryList";
import { PLACEHOLDER } from "../dashboard";
import type { DimensionsConfig, ObservatoryItem } from "../schema";

// Le conteneur de fiche (dialog/drawer) est hors sujet ici : on le neutralise.
vi.mock("@/modules/search/components/SwitchDetailsMode", () => ({
  SwitchDetailsMode: () => <div data-testid="details-modal" />,
}));

const dimensions: DimensionsConfig = { name: { paths: ["name"] } };
const data: ObservatoryItem[] = [{ name: "Gymnase" }, { name: "" }];
// Une entité par ligne : le bouton « Fiche » reste rendu même sans libellé.
const entities = [{}, {}] as unknown as SearchEntity[];

const renderList = (onSelect = vi.fn(), selection = "") =>
  renderWithProviders(
    <MemoryRouter>
      <ObservatoryList
        data={data}
        entities={entities}
        dimensions={dimensions}
        list={{ titleDimension: "name" }}
        rowAction={{ kind: "preview" }}
        selection={selection}
        onSelect={onSelect}
      />
    </MemoryRouter>,
  );

describe("ObservatoryList (sélection par clic)", () => {
  it("clic sur une ligne titrée → onSelect(libellé)", () => {
    const onSelect = vi.fn();
    renderList(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Gymnase" }));
    expect(onSelect).toHaveBeenCalledWith("Gymnase");
  });

  it("ligne SANS libellé : affiche le tiret mais n'est pas sélectionnable", () => {
    const onSelect = vi.fn();
    renderList(onSelect);

    const placeholder = screen.getByText(PLACEHOLDER);
    // Pas un bouton : sélectionner le tiret ne matcherait aucun item et viderait le tableau de bord.
    expect(placeholder.closest("button")).toBeNull();
    fireEvent.click(placeholder);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ligne SANS libellé : la fiche reste accessible par son bouton", () => {
    renderList();

    expect(screen.getAllByRole("button", { name: /fiche/i })).toHaveLength(2);
  });
});
