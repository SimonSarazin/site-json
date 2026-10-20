// @vitest-environment jsdom
/**
 * `renderSection` — règle du TITRE ORPHELIN : un groupe dont tous les champs visuels sont
 * masqués (widget `hidden` OU `visibleIf` faux) disparaît ENTIÈREMENT, titre compris.
 * Précédent : « Pièces justificatives » (form structure MSS) restait affiché alors que ses
 * deux champs `file` sont conditionnés à la forme juridique choisie.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderSection, type LayoutProps } from "./shared";
import type { FormDescriptor, SectionDescriptor } from "../types";

const descriptor = {
  fields: {
    legalStatus: { name: "legalStatus", widget: "select", type: "string", label: "Forme juridique" },
    statusFile: {
      name: "statusFile", widget: "file", type: "string", label: "Statuts",
      visibleIf: { field: "legalStatus", op: "eq", value: "Association loi 1901" },
    },
    ghost: { name: "ghost", widget: "hidden", type: "string", label: "" },
  },
} as unknown as FormDescriptor;

const section: SectionDescriptor = {
  id: "legal",
  label: "Forme juridique",
  groups: [
    { columns: 1, fields: ["legalStatus"] },
    { columns: 1, label: "Pièces justificatives", fields: ["statusFile", "ghost"] },
  ],
} as SectionDescriptor;

const p = {
  descriptor,
  t: (k: unknown) => String(k),
  renderField: (name: string) => <span data-testid={`field-${name}`} />,
  renderSlot: () => null,
} as unknown as LayoutProps;

describe("renderSection — titre orphelin", () => {
  it("masque le groupe ENTIER (titre compris) quand tous ses champs sont invisibles", () => {
    const { queryByText, queryByTestId } = render(<>{renderSection(section, p, { legalStatus: "Collectivité" })}</>);
    expect(queryByText("Pièces justificatives")).toBeNull();
    expect(queryByTestId("field-statusFile")).toBeNull();
    // le groupe inconditionnel reste rendu
    expect(queryByTestId("field-legalStatus")).not.toBeNull();
  });

  it("affiche titre + champ quand la condition du champ est vraie", () => {
    const { queryByText, queryByTestId } = render(<>{renderSection(section, p, { legalStatus: "Association loi 1901" })}</>);
    expect(queryByText("Pièces justificatives")).not.toBeNull();
    expect(queryByTestId("field-statusFile")).not.toBeNull();
  });

  it("un champ widget hidden seul ne fait pas vivre un groupe", () => {
    const seul: SectionDescriptor = {
      id: "x", groups: [{ columns: 1, label: "Titre fantôme", fields: ["ghost"] }],
    } as SectionDescriptor;
    const { queryByText } = render(<>{renderSection(seul, p, {})}</>);
    expect(queryByText("Titre fantôme")).toBeNull();
  });
});

/**
 * `$slot:` — l'entrée est rendue à la place déclarée, et son enveloppe porte `empty:hidden` : un
 * slot qui ne rend rien (inerte en édition, rien à signaler) ne doit pas laisser de cellule vide
 * dans la grille.
 */
describe("renderSection — $slot", () => {
  const withSlot: SectionDescriptor = {
    id: "info",
    label: "Infos",
    groups: [{ columns: 1, fields: ["legalStatus", "$slot:duplicates"] }],
  } as SectionDescriptor;

  it("rend le nœud du slot APRÈS le champ qui le précède", () => {
    const props = { ...p, renderSlot: (id: string) => <span data-testid={`slot-${id}`} /> } as unknown as LayoutProps;
    const { container, getByTestId } = render(<>{renderSection(withSlot, props, {})}</>);
    const cells = Array.from(container.querySelectorAll(".grid > div"));
    expect(cells).toHaveLength(2);
    expect(cells[0].contains(getByTestId("field-legalStatus"))).toBe(true);
    expect(cells[1].contains(getByTestId("slot-duplicates"))).toBe(true);
  });

  it("l'enveloppe d'un slot vide est masquable (empty:hidden), pas celle d'un champ", () => {
    const { container } = render(<>{renderSection(withSlot, p, {})}</>);
    const cells = Array.from(container.querySelectorAll(".grid > div"));
    expect(cells[0].className).not.toContain("empty:hidden");
    expect(cells[1].className).toContain("empty:hidden");
    expect(cells[1].childElementCount).toBe(0);
  });
});

