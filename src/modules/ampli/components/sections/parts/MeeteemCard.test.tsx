// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from "vitest";
import "@/modules/ampli/i18n";
import i18n from "@/i18n";
import { renderWithProviders, screen, userEvent } from "../../../../../../tests/test-utils-ui";
import { MeeteemCard as MeeteemCardComponent } from "./MeeteemCard";
import type { MeeteemCard as MeeteemCardType } from "../../../types";

/**
 * Tests de la carte d'une réponse Meeteem.
 * Couvre les 2 variants (large/compact), les tags, le clic auteur, et les stats.
 */

function makeCard(overrides: Partial<{
  id: string;
  name: string;
  description: string;
  tags: string[];
  userName: string;
  vote: Record<string, unknown>;
  comments: Record<string, unknown>;
}> = {}): MeeteemCardType {
  return {
    answer: {
      serverData: {
        id: overrides.id ?? "card-1",
        created: new Date("2026-05-01"),
        vote: overrides.vote,
        comments: overrides.comments,
      },
    },
    data: {
      name: overrides.name ?? "Card Title",
      description: overrides.description ?? "Card description text.",
      tags: overrides.tags,
    },
    user: overrides.userName
      ? { name: overrides.userName, initial: overrides.userName.charAt(0), exists: true }
      : undefined,
  };
}

describe("MeeteemCard", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  describe("variant 'large' (vue Annuaire)", () => {
    it("rend le titre, la description et l'auteur", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ name: "My Card", description: "A nice card", userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      expect(screen.getByText("My Card")).toBeInTheDocument();
      expect(screen.getByText("A nice card")).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("affiche le fallback 'Anonyme' si user absent", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ name: "Anon Card" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      expect(screen.getByText("Anonyme")).toBeInTheDocument();
    });

    it("affiche le fallback 'N/A' si created absent", () => {
      const card = makeCard({ userName: "Alice" });
      card.answer.serverData.created = undefined;
      renderWithProviders(
        <MeeteemCardComponent
          card={card}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
  });

  describe("tags", () => {
    it("rend les tags de la carte", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ tags: ["food", "music"], userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      expect(screen.getByText("food")).toBeInTheDocument();
      expect(screen.getByText("music")).toBeInTheDocument();
    });

    it("appelle onToggleFilter au clic sur un tag", async () => {
      const onToggleFilter = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ tags: ["food"], userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={onToggleFilter}
          onSelectUser={() => {}}
        />,
      );
      await user.click(screen.getByText("food"));
      expect(onToggleFilter).toHaveBeenCalledWith("food");
    });

    it("met en évidence un tag actif (bg-primary)", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ tags: ["food"], userName: "Alice" })}
          activeFilters={["food"]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      const foodBtn = screen.getByText("food");
      expect(foodBtn.className).toContain("bg-primary");
    });

    it("style normal pour un tag non actif", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ tags: ["food"], userName: "Alice" })}
          activeFilters={["other"]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      const foodBtn = screen.getByText("food");
      expect(foodBtn.className).toContain("bg-muted");
    });
  });

  describe("stats (likes + comments)", () => {
    it("affiche 0 si aucun vote ni comment", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      // Deux "0" présents (likes + comments)
      const zeros = screen.getAllByText("0");
      expect(zeros).toHaveLength(2);
    });

    it("compte les votes et commentaires", () => {
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({
            userName: "Alice",
            vote: { u1: true, u2: true, u3: true },
            comments: { c1: {}, c2: {} },
          })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
        />,
      );
      expect(screen.getByText("3")).toBeInTheDocument(); // 3 votes
      expect(screen.getByText("2")).toBeInTheDocument(); // 2 comments
    });
  });

  describe("interaction auteur", () => {
    it("appelle onSelectUser au clic sur l'auteur", async () => {
      const onSelectUser = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={onSelectUser}
        />,
      );
      await user.click(screen.getByText("Alice"));
      expect(onSelectUser).toHaveBeenCalledWith("Alice");
    });

    it("passe '' au callback si user absent", async () => {
      const onSelectUser = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <MeeteemCardComponent
          card={makeCard()}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={onSelectUser}
        />,
      );
      await user.click(screen.getByText("Anonyme"));
      expect(onSelectUser).toHaveBeenCalledWith("");
    });
  });

  describe("variant 'compact' (vue Split)", () => {
    it("rend en mode compact avec classes différentes", () => {
      const { container } = renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ name: "Compact Card", userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
          variant="compact"
        />,
      );
      const wrapper = container.querySelector(".rounded-xl");
      // En compact, la card est `flex items-center` (pas `flex-col`)
      expect(wrapper?.className).toContain("flex items-center");
      expect(wrapper?.className).not.toContain("flex-col");
    });

    it("n'ajoute pas l'animation slideIn en mode compact", () => {
      const { container } = renderWithProviders(
        <MeeteemCardComponent
          card={makeCard({ userName: "Alice" })}
          activeFilters={[]}
          onToggleFilter={() => {}}
          onSelectUser={() => {}}
          variant="compact"
          animationDelay={50}
        />,
      );
      const wrapper = container.querySelector(".rounded-xl") as HTMLElement;
      // animationDelay ne devrait être appliqué qu'en variant large
      expect(wrapper.style.animationDelay).toBe("");
    });
  });
});
