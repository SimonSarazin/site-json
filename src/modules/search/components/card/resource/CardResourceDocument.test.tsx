// @vitest-environment jsdom
/**
 * Design `document` : une ligne qui ouvre directement le fichier, sinon le lien, sinon le détail.
 * Le choix du lien est testé à part (`resourceLink.test.ts`) ; ici, le CÂBLAGE et l'accessibilité.
 */
import { describe, it, expect, vi } from "vitest";
import "@/modules/search/i18n"; // enregistre les libellés du module — en vrai, SearchListView s'en charge
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import CardResourceDocument from "./CardResourceDocument";

const fiche = (serverData: Record<string, unknown>) => ({ serverData } as unknown as SearchEntity);
const list = { resource: { design: "document" as const } };

describe("CardResourceDocument", () => {
  it("ouvre le PDF hébergé dans un nouvel onglet, sans fuite de l'onglet d'origine", () => {
    renderWithProviders(
      <CardResourceDocument
        item={fiche({ name: "INFORESO n°74 – Octobre 2022", medias: [{ type: "pdf", url: "/upload/inforeso-74.pdf", name: "inforeso-74.pdf" }] })}
        list={list}
      />,
    );
    const lien = screen.getByRole("link", { name: /INFORESO n°74/ });
    expect(lien).toHaveAttribute("href", "/upload/inforeso-74.pdf");
    expect(lien).toHaveAttribute("target", "_blank");
    expect(lien).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("annonce le format RÉEL du fichier : pas « PDF » sur un document bureautique", () => {
    renderWithProviders(
      <CardResourceDocument item={fiche({ name: "Compte rendu", medias: [{ type: "file", url: "/upload/cr.docx", name: "cr.docx" }] })} list={list} />,
    );
    expect(screen.getByText("DOCX")).toBeInTheDocument();
    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
  });

  it("dit « Document » quand le fichier n'a pas d'extension", () => {
    renderWithProviders(
      <CardResourceDocument item={fiche({ name: "Note", medias: [{ type: "file", url: "/upload/note", name: "note" }] })} list={list} />,
    );
    expect(screen.getByText("Document")).toBeInTheDocument();
  });

  it("annonce l'ouverture dans un nouvel onglet aux lecteurs d'écran", () => {
    renderWithProviders(
      <CardResourceDocument item={fiche({ name: "n°1", urls: ["https://www.calameo.com/books/x"] })} list={list} />,
    );
    expect(screen.getByRole("link", { name: /s'ouvre dans un nouvel onglet/ })).toBeInTheDocument();
  });

  it("ouvre le lien externe quand il n'y a pas de document", () => {
    renderWithProviders(
      <CardResourceDocument
        item={fiche({ name: "INFORESO « Faire Famille »", urls: ["https://www.calameo.com/books/008264182a31adb6c6465"] })}
        list={list}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://www.calameo.com/books/008264182a31adb6c6465");
    expect(screen.getByText("Lien externe")).toBeInTheDocument();
  });

  it("sans document ni lien, retombe sur le clic de détail plutôt qu'un lien mort", async () => {
    const onClick = vi.fn();
    renderWithProviders(<CardResourceDocument item={fiche({ name: "Fiche incomplète" })} list={list} onClick={onClick} />);
    expect(screen.queryByRole("link")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: /Fiche incomplète/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
