// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { placeCaret, selectText } from "../../../../tests/test-utils-ui";
import { rowPreviewProps, stopRowClick } from "./rowPreview";

/** Cellule de texte attachée au document — la sélection n'existe que dans un DOM monté. */
function cell(text: string): HTMLElement {
  const td = document.createElement("td");
  td.textContent = text;
  document.body.append(td);
  return td;
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe("rowPreviewProps — clic sur une ligne de table admin", () => {
  it("sans bloc preview : aucune prop, la ligne n'a ni curseur ni clic", () => {
    expect(rowPreviewProps(undefined)).toEqual({});
  });

  it("un clic simple ouvre le détail, même avec le curseur replié que laisse son mousedown", () => {
    // Le navigateur laisse une plage VIDE après un clic simple : tester l'existence d'une plage
    // (`rangeCount`) au lieu de son texte bloquerait toutes les ouvertures.
    placeCaret(cell("Marche nordique"));
    expect(window.getSelection()?.rangeCount).toBe(1); // la sonde pose bien une plage

    const open = vi.fn();
    const props = rowPreviewProps(open);
    expect(props.className).toBe("cursor-pointer");
    props.onClick?.();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("le clic qui termine une sélection de texte n'ouvre rien (copier un e-mail reste possible)", () => {
    selectText(cell("contact@ekilibre.re"));
    expect(window.getSelection()?.toString()).toBe("contact@ekilibre.re"); // la sonde sélectionne bien

    const open = vi.fn();
    rowPreviewProps(open).onClick?.();
    expect(open).not.toHaveBeenCalled();
  });
});

describe("stopRowClick — cellule portant un contrôle", () => {
  it("coupe la remontée du clic vers la ligne", () => {
    const event = { stopPropagation: vi.fn() };
    stopRowClick(event);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
