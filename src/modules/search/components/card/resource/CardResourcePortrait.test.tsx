// @vitest-environment jsdom
/**
 * Design `portrait` : une personne présentée en entier, en ligne d'annuaire — photo ronde, nom, fonction, présentation.
 * Carte non cliquable : les seuls éléments interactifs sont les liens de la présentation.
 */
import { describe, it, expect, vi } from "vitest";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import CardResourcePortrait from "./CardResourcePortrait";

const fiche = (serverData: Record<string, unknown>) => ({ serverData } as unknown as SearchEntity);
const list = { resource: { design: "portrait" as const, subtitleField: "shortDescription" } };

describe("CardResourcePortrait", () => {
  it("affiche le nom en titre, la fonction et la présentation complète avec ses liens", () => {
    renderWithProviders(
      <CardResourcePortrait
        item={fiche({
          name: "Ivy Daure",
          shortDescription: "Psychologue clinicienne",
          description: "Intervenue le **22 septembre 2025**.\n\nRetrouvez son intervention [ICI](https://exemple.org/journee).",
        })}
        list={list}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Ivy Daure" })).toBeInTheDocument();
    expect(screen.getByText("Psychologue clinicienne")).toBeInTheDocument();
    expect(screen.getByText("22 septembre 2025").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "ICI" })).toHaveAttribute("href", "https://exemple.org/journee");
  });

  it("n'est pas cliquable : aucun bouton, et un clic ne déclenche rien", async () => {
    const onClick = vi.fn();
    renderWithProviders(<CardResourcePortrait item={fiche({ name: "Ivy Daure", description: "Texte." })} list={list} onClick={onClick} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Texte."));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("neutralise le HTML injecté dans la présentation", () => {
    const { container } = renderWithProviders(
      <CardResourcePortrait item={fiche({ name: "X", description: "<img src=x onerror=alert(1)><script>alert(2)</script>Texte" })} list={list} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("montre la photo en décor (le nom est déjà écrit à côté)", () => {
    const { container } = renderWithProviders(
      <CardResourcePortrait item={fiche({ name: "Ivy Daure", profilMediumImageUrl: "https://exemple.org/ivy.jpg" })} list={list} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(img?.getAttribute("src")).toContain("ivy.jpg");
  });

  it("sans photo, affiche les initiales ; sans `subtitleField`, aucun sous-titre", () => {
    const { container } = renderWithProviders(
      <CardResourcePortrait item={fiche({ name: "Serge Tisseron", shortDescription: "Psychiatre" })} list={{ resource: { design: "portrait" } }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("ST")).toBeInTheDocument();
    expect(screen.queryByText("Psychiatre")).not.toBeInTheDocument();
  });
});
