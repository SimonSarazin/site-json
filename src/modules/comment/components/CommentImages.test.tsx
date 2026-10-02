// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { CommentImages } from "./CommentImages";
import type { CommentImage } from "../types";
import "../i18n";

/**
 * Les images d'un message.
 *
 * Deux décisions sont verrouillées ici, parce qu'elles sont invisibles à la relecture du code :
 * une image seule est servie en pleine résolution quand plusieurs se contentent de vignettes
 * (un fil en affiche jusqu'à cinq, charger cinq pleines résolutions pour des carrés de 96 px
 * serait du gâchis), et un document disparu se dit au lieu de laisser un cadre vide.
 */

function monte(images: readonly CommentImage[]) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(LocalizationProvider, null, children);
  return render(createElement(CommentImages, { images }), { wrapper });
}

const image = (over: Partial<CommentImage> = {}): CommentImage => ({
  id: "a".repeat(24),
  url: "/upload/grande.jpg",
  thumbUrl: "/upload/thumb/grande.jpg",
  name: "capture.png",
  ...over,
});

describe("CommentImages", () => {
  it("ne rend rien sans image — pas même un conteneur vide", () => {
    const { container } = monte([]);
    expect(container.querySelector("[data-comment-images]")).toBeNull();
  });

  it("sert la pleine résolution pour une image seule", () => {
    monte([image()]);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("grande.jpg");
    expect(img.src).not.toContain("thumb");
  });

  it("sert les vignettes dès qu'il y en a plusieurs", () => {
    monte([image(), image({ id: "b".repeat(24), name: "seconde.png" })]);
    const sources = screen.getAllByRole("img").map(i => (i as HTMLImageElement).src);
    expect(sources).toHaveLength(2);
    expect(sources.every(src => src.includes("thumb"))).toBe(true);
  });

  // Le backend décrémente `countImages` quand un document a disparu, mais rien ne garantit que
  // l'entrée ne survive pas : mieux vaut le dire que peindre un cadre vide.
  it("signale un document disparu au lieu d'un cadre vide", () => {
    const { container } = monte([image({ url: null, thumbUrl: null })]);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("[data-comment-images] svg")).not.toBeNull();
  });

  it("nomme chaque image, même sans nom de fichier", () => {
    monte([image({ name: "" }), image({ id: "b".repeat(24), name: "" })]);
    expect(screen.getByRole("button", { name: /image 1 sur 2/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /image 2 sur 2/i })).toBeTruthy();
  });

  it("ouvre la visionneuse au clic", () => {
    monte([image()]);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /capture\.png/i }));
    // Le dialogue est PORTALISÉ : il ne se trouve pas sous `container`, seulement dans l'écran.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
