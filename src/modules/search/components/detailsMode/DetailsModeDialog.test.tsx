// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

/**
 * Preview doublée : une vraie preview (`testimonial`, `resource`…) peut porter un élément
 * focusable dès son en-tête (ex. le bouton « agrandir l'image » de `PreviewTestimonialBubble`) —
 * ce test porte sur la COQUILLE (où va le focus à l'ouverture), pas sur son contenu.
 */
vi.mock("../Preview", () => ({
  default: () => <button type="button">bouton de la preview</button>,
}));

import DetailsModeDialog from "./DetailsModeDialog";

const item = { id: "i1", serverData: {} } as unknown as SearchEntity;

describe("DetailsModeDialog — focus à l'ouverture", () => {
  // Régression : `onOpenAutoFocus={(e) => e.preventDefault()}` SEUL désarme aussi le repli de
  // focus de Radix (vécu dans son `FocusScope`, sous un `if (!defaultPrevented)`) — le focus ne va
  // alors NULLE PART, pas même sur le dialogue. Corrigé en reposant le focus sur le conteneur
  // (`event.currentTarget.focus()`), comme `DiscussionModalShell.tsx`.
  it("pose le focus sur le dialogue — pas sur le premier élément focusable de la preview", () => {
    render(
      <DetailsModeDialog
        openDetails
        setOpenDetails={() => {}}
        item={item}
        preview={{ type: "resource" }}
      />,
    );
    const boite = screen.getByRole("dialog");
    expect(document.activeElement).toBe(boite);
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "bouton de la preview" }));
  });

  it("fermé, ne rend pas de dialogue", () => {
    render(
      <DetailsModeDialog
        openDetails={false}
        setOpenDetails={() => {}}
        item={item}
        preview={{ type: "resource" }}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
