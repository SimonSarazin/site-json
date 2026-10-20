// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";

import { publicSurfaceKeys } from "@/lib/queryKeys";

import { selectText } from "../../../../tests/test-utils-ui";

/**
 * Câblage « détail au clic » et « création par CoForm » de la table `resource` (review MR 84) :
 *  - un geste sur un CONTRÔLE de la ligne (lecteur audio) ou la fin d'une sélection de texte n'ouvre
 *    pas le détail ;
 *  - consulter une fiche ne coûte AUCUNE requête ; seule une correction faite depuis le détail
 *    invalide, et alors tables admin ET surfaces publiques ;
 *  - une création par CoForm = une invalidation, pas de `refetch()` en double à la fermeture.
 * Les hooks réseau sont remplacés par des témoins : on compte les requêtes demandées, pas leur rendu.
 */
const ctx = vi.hoisted(() => ({
  refetch: vi.fn(),
  rows: [] as unknown[],
}));

// jsdom n'a pas de ResizeObserver, dont le Popper du menu d'actions (Radix) a besoin pour s'ouvrir.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

const SLUG = "associationEkilibre";
const FORM = "6a85af345d898a57cb49f029";
const AUDIO = "https://exemple.re/temoignage.mp3";

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ entity: { slug: "associationEkilibre" }, contextId: "ctx", contextType: "organizations", me: null }),
}));
vi.mock("../hooks/useAdminAccess", () => ({ useAdminAccess: () => ({ has: () => true }) }));
vi.mock("@/hooks/useSite", () => ({ useSite: () => ({ config: {} }) }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: unknown) => (typeof key === "string" ? key : JSON.stringify(key)) }));
vi.mock("@/hooks/useDebounce", () => ({ useDebounce: <T,>(v: T) => v }));
vi.mock("@/hooks/useMutationWithToast", () => ({ useMutationWithToast: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/modules/admin/i18n", () => ({}));
vi.mock("@/modules/search/i18n", () => ({}));
vi.mock("@/modules/search/components/SearchTextInput", () => ({ default: () => null }));
vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: () => ({
    transformedResults: ctx.rows,
    totalCount: ctx.rows.length,
    isLoading: false,
    lastItemRef: undefined,
    refetch: ctx.refetch,
    error: null,
  }),
}));
vi.mock("../hooks/useDeleteEntity", () => ({ useDeleteEntity: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../hooks/useValidateGroup", () => ({ useValidateGroup: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../hooks/useReferenceElement", () => ({ useReferenceElement: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("../hooks/useSetExclusiveFlag", () => ({ useSetExclusiveFlag: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({ DynamicModal: () => null }));
vi.mock("@/modules/profil/components/profile-edit/EditModalRegistry", () => ({ DynamicEditModal: () => null }));
vi.mock("../components/OwnershipMigrationDialog", () => ({ OwnershipMigrationDialog: () => null }));
// Lecteur réduit à son bouton « Lecture » : c'est le geste qui ouvrait le détail par-dessus.
vi.mock("@/components/media/AudioPlayer", () => ({
  AudioPlayer: ({ src }: { src: string }) => <button type="button">{`lire ${src}`}</button>,
}));
// Détail : « enregistrer » rejoue `PreviewCoformAnswer.handleEdited` (prévient l'hôte, PUIS ferme) —
// et n'est proposé, comme « Modifier » dans le vrai détail, que si la conf reçue porte `editButton`.
vi.mock("@/modules/search/components/SwitchDetailsMode", () => ({
  SwitchDetailsMode: ({ openDetails, setOpenDetails, onEdited, preview }: {
    openDetails: boolean;
    setOpenDetails: (open: boolean) => void;
    onEdited?: () => void;
    preview?: { type?: string; editButton?: boolean };
  }) =>
    openDetails ? (
      <div data-testid="detail">
        <span data-testid="detail-conf">{`${preview?.type}:edit=${String(preview?.editButton)}`}</span>
        <button type="button" onClick={() => setOpenDetails(false)}>fermer le détail</button>
        {preview?.editButton && (
          <button type="button" onClick={() => { onEdited?.(); setOpenDetails(false); }}>enregistrer une correction</button>
        )}
      </div>
    ) : null,
}));
// CoFormModal : « soumettre » rejoue `handleAfterSubmit` (onAfterSubmit attendu, PUIS fermeture).
vi.mock("@/modules/coform/components/CoFormModal", () => ({
  default: ({ open, onOpenChange, onAfterSubmit }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAfterSubmit?: () => void | Promise<void>;
  }) =>
    open ? (
      <div data-testid="coform">
        <button type="button" onClick={async () => { await onAfterSubmit?.(); onOpenChange(false); }}>soumettre</button>
        <button type="button" onClick={() => onOpenChange(false)}>fermer sans soumettre</button>
      </div>
    ) : null,
}));

import AdminResourceTable from "./AdminResourceTable";

const SECTION = {
  type: "resource",
  entityType: "answers",
  columns: ["name", { path: "audio", type: "audio" }],
  rowActions: [],
  create: { coform: FORM },
  edit: false,
  preview: { type: "coform-answer", editButton: true },
};

const spyOnInvalidate = (client: QueryClient) => vi.spyOn(client, "invalidateQueries");
let queryClient: QueryClient;
let invalidate: ReturnType<typeof spyOnInvalidate>;

function renderTable(section: unknown = SECTION) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminResourceTable section={section as never} />
    </QueryClientProvider>,
  );
}

/** Clés des invalidations demandées ; `"admin-*"` pour le prédicat des tables et tuiles admin. */
function invalidatedKeys(): unknown[] {
  // Une vraie requête de la table, pour interroger le prédicat comme le fait React Query.
  const adminKey: QueryKey = ["admin-answers"];
  const adminQuery = queryClient.getQueryCache().build(queryClient, { queryKey: adminKey });
  return invalidate.mock.calls.map(([filters]) => {
    if (filters?.predicate) return filters.predicate(adminQuery) ? "admin-*" : "prédicat inconnu";
    return filters?.queryKey;
  });
}

beforeEach(() => {
  ctx.refetch.mockClear();
  ctx.rows = [{ id: "a1", serverData: { id: "a1", name: "Marche nordique", audio: AUDIO } }];
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidate = spyOnInvalidate(queryClient);
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  cleanup();
});

describe("AdminResourceTable — détail d'une ligne (`preview`)", () => {
  it("un geste sur le lecteur audio n'ouvre pas le détail ; un clic sur une cellule de texte, si", () => {
    const { getByText, queryByTestId } = renderTable();
    fireEvent.click(getByText(`lire ${AUDIO}`));
    expect(queryByTestId("detail")).toBeNull();
    fireEvent.click(getByText("Marche nordique"));
    expect(queryByTestId("detail")).not.toBeNull();
  });

  it("terminer une sélection de texte sur la ligne n'ouvre pas le détail", () => {
    const { getByText, queryByTestId } = renderTable();
    const cell = getByText("Marche nordique");
    selectText(cell);
    fireEvent.click(cell);
    expect(queryByTestId("detail")).toBeNull();
  });

  it("la case de sélection et le bouton d'actions gardent leurs clics", () => {
    const { getByRole, queryByTestId } = renderTable({ ...SECTION, bulkActions: ["export"] });
    fireEvent.click(getByRole("checkbox", { name: "AdminResourceTable.selectRow" }));
    expect(getByRole("checkbox", { name: "AdminResourceTable.selectRow" })).toHaveAttribute("data-state", "checked");
    fireEvent.click(getByRole("button", { name: "AdminResourceTable.rowActions" }));
    expect(queryByTestId("detail")).toBeNull();
  });

  it("au clavier : « Aperçu » du menu d'actions ouvre le même détail", async () => {
    const { getByRole, findByRole, queryByTestId } = renderTable();
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.preview/ }));
    expect(queryByTestId("detail")).not.toBeNull();
  });

  it("une autre action du menu (Supprimer) n'ouvre pas le détail par-dessus sa confirmation", async () => {
    // Le menu est PORTALÉ hors du tableau, mais React fait remonter ses clics jusqu'à la ligne :
    // seule la cellule d'actions les arrête.
    const { getByRole, findByRole, queryByTestId } = renderTable({ ...SECTION, rowActions: ["delete"] });
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.delete/ }));
    expect(queryByTestId("detail")).toBeNull();
  });

  it("sans bloc `preview` : la ligne ne réagit pas et n'en a pas l'air", () => {
    const { getByText, queryByTestId } = renderTable({ ...SECTION, preview: undefined });
    const cell = getByText("Marche nordique");
    expect(cell.closest("tr")).not.toHaveClass("cursor-pointer");
    fireEvent.click(cell);
    expect(queryByTestId("detail")).toBeNull();
  });

  it("transmet `editButton` tel quel : corriger depuis la modération est voulu ici (≠ answerCopy)", () => {
    const { getByText, getByTestId } = renderTable();
    fireEvent.click(getByText("Marche nordique"));
    expect(getByTestId("detail-conf").textContent).toBe("coform-answer:edit=true");
  });

  it("consulter puis fermer une fiche ne relance aucune requête", () => {
    const { getByText, queryByTestId } = renderTable();
    fireEvent.click(getByText("Marche nordique"));
    fireEvent.click(getByText("fermer le détail"));
    expect(queryByTestId("detail")).toBeNull();
    expect(ctx.refetch).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("une correction faite depuis le détail invalide tables admin ET surfaces publiques, sans refetch en plus", () => {
    const { getByText, queryByTestId } = renderTable();
    fireEvent.click(getByText("Marche nordique"));
    fireEvent.click(getByText("enregistrer une correction"));
    expect(queryByTestId("detail")).toBeNull();
    expect(invalidatedKeys()).toEqual(["admin-*", ...publicSurfaceKeys(SLUG)]);
    expect(ctx.refetch).not.toHaveBeenCalled();
  });
});

describe("AdminResourceTable — création par CoForm (`create.coform`)", () => {
  it("une soumission = une invalidation (admin + public), aucun refetch à la fermeture", async () => {
    const { getByRole, findByText, queryByTestId } = renderTable();
    fireEvent.click(getByRole("button", { name: "AdminResourceTable.create" }));
    fireEvent.click(await findByText("soumettre")); // chunk lazy : le témoin arrive après coup
    await waitFor(() => expect(queryByTestId("coform")).toBeNull());
    expect(invalidatedKeys()).toEqual(["admin-*", ...publicSurfaceKeys(SLUG)]);
    expect(ctx.refetch).not.toHaveBeenCalled();
  });

  it("fermer la création sans soumettre ne relance rien : CoForm n'écrit rien avant la soumission", async () => {
    const { getByRole, findByText, queryByTestId } = renderTable();
    fireEvent.click(getByRole("button", { name: "AdminResourceTable.create" }));
    fireEvent.click(await findByText("fermer sans soumettre"));
    expect(queryByTestId("coform")).toBeNull();
    expect(ctx.refetch).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
