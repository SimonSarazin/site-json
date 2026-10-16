// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResourceDetail } from "./ResourceDetail";

describe("ResourceDetail — textes libres", () => {
  const texte = "Ligne *une*\nLigne deux";

  it("`plainText` : texte brut, sauts de ligne gardés, aucun markdown interprété (rendu historique)", () => {
    render(<ResourceDetail name="Salle" images={[]} notes={[{ label: "À propos", value: texte, plainText: true }]} />);
    const p = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === texte);
    expect(p.className).toContain("whitespace-pre-line");
    expect(document.querySelector("em")).toBeNull();
  });

  it("par défaut : markdown interprété", () => {
    render(<ResourceDetail name="Salle" images={[]} notes={[{ label: "À propos", value: texte }]} />);
    expect(document.querySelector("em")?.textContent).toBe("une");
  });
});
