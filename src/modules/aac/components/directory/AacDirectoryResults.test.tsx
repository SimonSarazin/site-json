// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";
import { EMPTY_AAC_USAGE } from "../../lib/aacUsage";

// Les cartes et lignes ont leurs propres tests : ici seul compte QUELS communs
// sont rendus, pas comment.
vi.mock("./AacCommunCard", () => ({
  AacCommunCard: ({ commun }: { commun: CommunCard }) => <article>{commun.title}</article>,
}));
vi.mock("./AacCommunRow", () => ({
  AacCommunRow: ({ commun }: { commun: CommunCard }) => <article>{commun.title}</article>,
}));

// Bundle « modules/aac » : les libellés sont ceux que verra l'utilisateur.
import "../../i18n";
import { AacDirectoryResults } from "./AacDirectoryResults";

type Props = Parameters<typeof AacDirectoryResults>[0];

function commun(id: string, title: string): CommunCard {
  return {
    id,
    title,
    hasTitle: true,
    description: "",
    tags: [],
    maturity: null,
    imageUrl: null,
    funds: [],
    totalRequested: 0,
    totalFunded: 0,
    progressPercent: 0,
    hasFundingRequest: false,
    usersCount: 0,
    interestCount: 0,
    isSelected: null,
    usage: EMPTY_AAC_USAGE,
    createdAt: 0,
    updatedAt: 0,
  };
}

const DEUX_PAGES = [commun("a1", "Peertube des CAE"), commun("a2", "Nextcloud mutualisé")];

function poser(over: Partial<Props> = {}) {
  return render(
    <LocalizationProvider>
      <AacDirectoryResults
        communs={[]}
        display="grid"
        columns={3}
        isLoading={false}
        isFetchingNextPage={false}
        hasNextPage={false}
        error={null}
        lastItemRef={() => {}}
        {...over}
      />
    </LocalizationProvider>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

/**
 * H9 — en React Query, l'échec d'un `fetchNextPage` (ou d'un refetch) pose
 * `error` tout en CONSERVANT `data`. Le retour anticipé sur `error` effaçait
 * donc les 24 cartes déjà affichées, sentinelle comprise, sans aucun bouton :
 * il fallait recharger la page pour revoir ne serait-ce que la première.
 */
describe("AacDirectoryResults — une erreur n'efface pas les communs chargés (H9)", () => {
  it("garde la liste et propose la reprise sous elle", () => {
    const onRetry = vi.fn();
    poser({ communs: DEUX_PAGES, hasNextPage: true, error: new Error("503"), onRetry });

    expect(screen.getByText("Peertube des CAE")).toBeInTheDocument();
    expect(screen.getByText("Nextcloud mutualisé")).toBeInTheDocument();
    expect(screen.queryByText("Impossible de charger les communs.")).not.toBeInTheDocument();

    expect(screen.getByText("Le chargement de la suite a échoué.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retire la sentinelle sous une erreur — sinon la page en défaut se relancerait en boucle", () => {
    const lastItemRef = vi.fn();
    poser({ communs: DEUX_PAGES, hasNextPage: true, error: new Error("503"), lastItemRef });

    // React appelle un ref-callback avec le nœud au montage : jamais appelé
    // avec un élément ⇒ jamais monté.
    expect(lastItemRef.mock.calls.filter(([node]) => node instanceof HTMLElement)).toHaveLength(0);
  });

  it("désactive le bouton le temps de la reprise", () => {
    poser({ communs: DEUX_PAGES, error: new Error("503"), onRetry: () => {}, isRetrying: true });

    expect(screen.getByRole("button", { name: "Réessayer" })).toBeDisabled();
    expect(screen.getByText("Peertube des CAE")).toBeInTheDocument();
  });

  it("garde le panneau bloquant — avec reprise — quand il n'y a RIEN à montrer", () => {
    const onRetry = vi.fn();
    poser({ communs: [], error: new Error("503"), onRetry });

    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les communs.");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("sans erreur, la sentinelle est bien posée quand il reste des pages", () => {
    const lastItemRef = vi.fn();
    poser({ communs: DEUX_PAGES, hasNextPage: true, lastItemRef });

    expect(lastItemRef.mock.calls.some(([node]) => node instanceof HTMLElement)).toBe(true);
    expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
  });
});
