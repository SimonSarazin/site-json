// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "@/i18n";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { AacCommunCard as CommunCard } from "../../lib/parseAacAnswer";
import { EMPTY_AAC_USAGE } from "../../lib/aacUsage";

// Les cartes et lignes ont leurs propres tests : ici seul compte QUELS communs
// sont rendus, pas comment.
type ItemStub = { commun: CommunCard; onRequestDelete?: (c: CommunCard) => void };
const stub = ({ commun, onRequestDelete }: ItemStub) => (
  <article>
    {commun.title}
    {onRequestDelete && (
      <button type="button" onClick={() => onRequestDelete(commun)}>
        suppr-{commun.id}
      </button>
    )}
  </article>
);
vi.mock("./AacCommunCard", () => ({ AacCommunCard: (p: ItemStub) => stub(p) }));
vi.mock("./AacCommunRow", () => ({ AacCommunRow: (p: ItemStub) => stub(p) }));

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
    keywords: [],
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
    address: null,
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

/**
 * Le droit de supprimer se résout ITEM PAR ITEM : un visiteur peut être l'auteur
 * d'un commun de la liste et pas des autres. C'est l'ABSENCE de
 * `onRequestDelete` sur l'item qui retire son bouton — un booléen global aurait
 * obligé la carte et la ligne à porter la même condition, et à diverger un jour.
 */
describe("AacDirectoryResults — suppression par item", () => {
  it("sans droit ni handler, aucun item ne propose la suppression", () => {
    poser({ communs: DEUX_PAGES });
    expect(screen.queryByRole("button", { name: /^suppr-/ })).not.toBeInTheDocument();
  });

  it("un handler SANS droit ne suffit pas à faire apparaître le bouton", () => {
    poser({ communs: DEUX_PAGES, onRequestDelete: vi.fn(), canDeleteCommun: () => false });
    expect(screen.queryByRole("button", { name: /^suppr-/ })).not.toBeInTheDocument();
  });

  it("n'ouvre la suppression que sur les communs autorisés", () => {
    const onRequestDelete = vi.fn();
    poser({
      communs: DEUX_PAGES,
      onRequestDelete,
      canDeleteCommun: (c) => c.id === "a1",
    });

    expect(screen.getByRole("button", { name: "suppr-a1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "suppr-a2" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "suppr-a1" }));
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete.mock.calls[0][0].id).toBe("a1");
  });

  it("vaut pour le mode LISTE comme pour la grille", () => {
    poser({ communs: DEUX_PAGES, display: "list", onRequestDelete: vi.fn(), canDeleteCommun: () => true });
    expect(screen.getAllByRole("button", { name: /^suppr-/ })).toHaveLength(2);
  });
});
