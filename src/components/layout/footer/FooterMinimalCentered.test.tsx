// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Footer } from "@/types/site-schema";
import FooterMinimalCentered from "./FooterMinimalCentered";

vi.mock("@/hooks/useLocalization", () => ({
  useLocalization: () => ({ t: (value: { fr: string }) => value.fr }),
}));
vi.mock("./useFooterLinks", () => ({
  useFooterLinks: (links: unknown[] | undefined) => links ?? [],
}));

const config = {
  type: "minimal-centered",
  copyright: { fr: "Contenu C BY-SA 4.0" },
  legalLinks: [
    { href: "https://example.org/code", label: { fr: "Logiciel libre" } },
    { href: "https://example.org/docs", label: { fr: "Documentation" } },
  ],
};

describe("FooterMinimalCentered", () => {
  it("place la mention avant les liens à droite si configuré", () => {
    const footer = Footer.parse({ ...config, copyrightPosition: "right" });
    const { container } = render(<MemoryRouter><FooterMinimalCentered footer={footer} /></MemoryRouter>);
    const mention = screen.getByText("Contenu C BY-SA 4.0");
    const logiciel = screen.getByRole("link", { name: "Logiciel libre" });
    const documentation = screen.getByRole("link", { name: "Documentation" });
    expect(mention.parentElement).toBe(logiciel.parentElement);
    expect(Array.from(mention.parentElement!.children)).toEqual([mention, logiciel, documentation]);
    expect(mention.parentElement?.parentElement?.className).toContain("sm:justify-end");
    expect(documentation.getAttribute("href")).toBe("https://example.org/docs");
    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("garde la mention séparée à gauche par défaut", () => {
    const footer = Footer.parse(config);
    render(<MemoryRouter><FooterMinimalCentered footer={footer} /></MemoryRouter>);
    const mention = screen.getByText("Contenu C BY-SA 4.0");
    const logiciel = screen.getByRole("link", { name: "Logiciel libre" });
    expect(mention.parentElement).toBe(logiciel.parentElement?.parentElement);
    expect(mention.parentElement?.className).toContain("justify-between");
  });
});
