// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionPills } from "./ReactionPills";
import "../i18n";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(LocalizationProvider, null, children);

describe("ReactionPicker", () => {
  it("propose les huit réactions, chacune avec son libellé", () => {
    render(createElement(ReactionPicker, { current: null, onPick: vi.fn() }), { wrapper });
    expect(screen.getAllByRole("button")).toHaveLength(8);
    // Un libellé, pas une icône seule : « Ravi » et « Content » ne se distinguent pas en icônes.
    expect(screen.getByText("J'adore")).toBeTruthy();
    expect(screen.getByText("Soutien")).toBeTruthy();
  });

  it("marque la réaction déjà posée — annuler doit être une action visible", () => {
    const { container } = render(
      createElement(ReactionPicker, { current: "love", onPick: vi.fn() }),
      { wrapper },
    );
    expect(container.querySelector('[data-reaction-choice="love"]')?.getAttribute("aria-pressed"))
      .toBe("true");
    expect(container.querySelector('[data-reaction-choice="like"]')?.getAttribute("aria-pressed"))
      .toBe("false");
  });

  it("rend le type choisi", () => {
    const onPick = vi.fn();
    const { container } = render(createElement(ReactionPicker, { current: null, onPick }), { wrapper });
    fireEvent.click(container.querySelector('[data-reaction-choice="support"]')!);
    expect(onPick).toHaveBeenCalledExactlyOnceWith("support");
  });
});

describe("ReactionPills", () => {
  it("n'affiche rien quand personne n'a réagi", () => {
    const { container } = render(
      createElement(ReactionPills, { reactions: {}, myReaction: null, canReact: true }),
      { wrapper },
    );
    expect(container.querySelector("[data-comment-reactions]")).toBeNull();
  });

  it("écarte les compteurs nuls plutôt que d'afficher une pastille vide", () => {
    const { container } = render(
      createElement(ReactionPills, { reactions: { love: 2, sad: 0 }, myReaction: null, canReact: true }),
      { wrapper },
    );
    expect(container.querySelectorAll("[data-reaction]")).toHaveLength(1);
  });

  it("désactive la bascule quand on n'a pas le droit de réagir", () => {
    const { container } = render(
      createElement(ReactionPills, { reactions: { love: 1 }, myReaction: null, canReact: false }),
      { wrapper },
    );
    expect(container.querySelector('[data-reaction="love"]')).toBeDisabled();
  });
});
