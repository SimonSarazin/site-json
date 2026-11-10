// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";

import { publicSurfaceKeys } from "@/lib/queryKeys";
import { loadCostumForm } from "@/modules/profil/forms/costum/__fixtures__/configCostum";

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
  uploadDocument: vi.fn(async () => ({ docId: "d1", docPath: "/copied" })),
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
// Expose `createDefaults` tel quel : c'est le seed qui prouve la duplication (review du seed, pas
// le rendu réel de la modale — DynamicModal a sa propre résolution de form, hors de ce périmètre).
vi.mock("@/modules/profil/components/add/ModalRegistry", () => ({
  DynamicModal: ({ open, createDefaults, onCreated }: {
    open: boolean;
    createDefaults?: Record<string, unknown>;
    onCreated?: (entity: unknown) => void;
  }) =>
    open ? (
      <div data-testid="create-modal">
        <span data-testid="seed">{JSON.stringify(createDefaults ?? null)}</span>
        {onCreated && (
          <button type="button" onClick={() => onCreated({ uploadDocument: ctx.uploadDocument })}>
            simuler la création
          </button>
        )}
      </div>
    ) : null,
}));
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

describe("AdminResourceTable — « Dupliquer » (rowActions: duplicate)", () => {
  // Costum RÉEL `parent62-event` (config.prod.parent62.json), enregistré via la voie unique
  // `registerCostumForm` — exerce le VRAI pipeline de lecture (`seedFromEntity`, cf.
  // `openDuplicateEntity`) plutôt qu'une forme standard, qui n'a pas de descripteur dans le registre
  // costum et retomberait sur la copie brute (`seedBrut`), sans les transforms `openingHours`/`address`.
  loadCostumForm("parent62-event");
  // Idem `parent62-article` (entityType `poi`) : son champ `category` est un `multiselect` au
  // `write:"joinCsv"` SANS `read` déclaré → défaut de widget `coerce:stringArray` (compileCostumSchema
  // WIDGET_DEFAULTS). `serverData.category` est donc une chaîne CSV ("appel-projet, offre-emploi") —
  // la copie BRUTE (avant ce lot) la semait telle quelle, que `ValueSelectField` aurait lue comme UNE
  // option bogus au lieu de la splitter : seul `seedFromEntity` (vrai pipeline) la décode correctement.
  loadCostumForm("parent62-article");
  const SECTION_EVENTS = {
    type: "resource",
    entityType: "events",
    columns: ["name"],
    rowActions: ["duplicate"],
    create: "add-parent62-event",
    edit: false,
  };
  const SECTION_ARTICLES = {
    type: "resource",
    entityType: "poi",
    columns: ["name"],
    rowActions: ["duplicate"],
    create: "add-parent62-article",
    edit: false,
  };

  beforeEach(() => {
    ctx.rows = [{
      id: "e1",
      serverData: { id: "e1", slug: "fete-du-jeu", name: "Fête du jeu", startDate: "2026-11-10" },
    }];
  });

  it("ouvre la modale de création semée des valeurs de la ligne, nom préfixé, sans id ni slug", async () => {
    const { getByRole, findByRole, findByTestId } = renderTable(SECTION_EVENTS);
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
    const seedEl = await findByTestId("seed");
    const seed = JSON.parse(seedEl.textContent ?? "null") as Record<string, unknown> | null;
    expect(seed).not.toBeNull();
    expect(seed).not.toHaveProperty("id");
    expect(seed).not.toHaveProperty("slug");
    expect(seed?.startDate).toBe("2026-11-10");
    // `useT` mocké renvoie la clé brute (pas d'interpolation réelle ici) : on vérifie que `name`
    // porte bien la clé de préfixe, pas le nom original tel quel.
    expect(seed?.name).toBe("AdminResourceTable.duplicateNamePrefix");
  });

  // `parent62-event.fields.openingHours` est `widget:"hidden"` sans `read` déclaré (seule
  // `eventOpeningHours:write` normalise à l'ÉCRITURE, selon `recurrency`) — AUCUN widget visible
  // n'attend un modèle 7 jours en LECTURE ; le tableau brut (jours cochés, partiel) EST la forme
  // correcte à semer. `seedFromEntity` le relaie tel quel (pas de `field.read` → valeur inchangée).
  it("relaie openingHours tel quel (hidden, sans codec de lecture)", async () => {
    ctx.rows = [{
      id: "e1",
      serverData: {
        id: "e1", name: "Fête du jeu",
        openingHours: [{ dayOfWeek: "Mo", hours: [{ opens: "09:00", closes: "17:00" }] }],
      },
    }];
    const { getByRole, findByRole, findByTestId } = renderTable(SECTION_EVENTS);
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
    const seedEl = await findByTestId("seed");
    const seed = JSON.parse(seedEl.textContent ?? "null") as { openingHours?: unknown };
    expect(seed.openingHours).toEqual([{ dayOfWeek: "Mo", hours: [{ opens: "09:00", closes: "17:00" }] }]);
  });

  it("déplie l'adresse (objet composite serveur → champs plats attendus par EditLocationTab)", async () => {
    ctx.rows = [{
      id: "e1",
      serverData: {
        id: "e1", name: "Fête du jeu",
        address: {
          addressCountry: "FR", addressLocality: "Arras", postalCode: "62000",
          streetAddress: "1 place de la mairie", localityId: "arras-id",
        },
      },
    }];
    const { getByRole, findByRole, findByTestId } = renderTable(SECTION_EVENTS);
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
    const seedEl = await findByTestId("seed");
    const seed = JSON.parse(seedEl.textContent ?? "null") as Record<string, unknown>;
    // Les champs plats, lus par `form.watch` dans EditLocationTab, doivent être semés directement —
    // `address` lui-même (renderOnly) ne doit PAS écraser ces clés ni rester seul dans le seed.
    expect(seed.addressLocality).toBe("Arras");
    expect(seed.postalCode).toBe("62000");
    expect(seed.streetAddress).toBe("1 place de la mairie");
    expect(seed.localityId).toBe("arras-id");
    expect(seed.addressCountry).toBe("FR");
  });

  it("décode category (CSV serveur → tableau, parent62-article) avant de le semer", async () => {
    ctx.rows = [{
      id: "a1",
      serverData: { id: "a1", name: "Un article", category: "appel-projet, offre-emploi" },
    }];
    const { getByRole, findByRole, findByTestId } = renderTable(SECTION_ARTICLES);
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
    const seedEl = await findByTestId("seed");
    const seed = JSON.parse(seedEl.textContent ?? "null") as { category?: unknown };
    expect(seed.category).toEqual(["appel-projet", "offre-emploi"]);
  });

  it("recopie galerie/documents sur la fiche créée (best-effort, via onCreated)", async () => {
    ctx.uploadDocument.mockClear();
    ctx.rows = [{
      id: "e1",
      serverData: { id: "e1", name: "Fête du jeu" },
      getGalleryImages: () => [{ imagePath: "https://exemple.re/img.jpg", contentKey: "slider" }],
      getGalleryFiles: async () => [{ docPath: "https://exemple.re/doc.pdf", docId: "d0" }],
    }];
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["x"]) }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { getByRole, findByRole, findByText } = renderTable(SECTION_EVENTS);
      fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
      fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
      fireEvent.click(await findByText("simuler la création"));
      await waitFor(() => expect(ctx.uploadDocument).toHaveBeenCalledTimes(2));
      expect(ctx.uploadDocument).toHaveBeenCalledWith(expect.any(Blob), { contentKey: "slider", docType: "image" });
      expect(ctx.uploadDocument).toHaveBeenCalledWith(expect.any(Blob), { contentKey: "file", docType: "file" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("un fichier en échec n'empêche pas les autres et toaste un résumé (pas tout ou rien)", async () => {
    ctx.uploadDocument.mockClear();
    ctx.rows = [{
      id: "e1",
      serverData: { id: "e1", name: "Fête du jeu" },
      getGalleryImages: () => [{ imagePath: "https://exemple.re/cassee.jpg" }],
      getGalleryFiles: async () => [{ docPath: "https://exemple.re/doc.pdf" }],
    }];
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("cassee") ? { ok: false, blob: async () => new Blob() } : { ok: true, blob: async () => new Blob(["x"]) },
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { getByRole, findByRole, findByText } = renderTable(SECTION_EVENTS);
      fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
      fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
      fireEvent.click(await findByText("simuler la création"));
      await waitFor(() => expect(ctx.uploadDocument).toHaveBeenCalledTimes(1));
      expect(ctx.uploadDocument).toHaveBeenCalledWith(expect.any(Blob), { contentKey: "file", docType: "file" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ouvrir « Dupliquer » n'écrit rien tant que rien n'est soumis", async () => {
    // La modale de création réelle n'écrit rien avant un submit explicite — ici mockée (non
    // rejouable), donc ce test couvre seulement `openDuplicateEntity` : construire le seed et
    // ouvrir l'état local ne déclenche aucune mutation.
    const { getByRole, findByRole, findByTestId } = renderTable(SECTION_EVENTS);
    fireEvent.keyDown(getByRole("button", { name: "AdminResourceTable.rowActions" }), { key: "Enter" });
    fireEvent.click(await findByRole("menuitem", { name: /AdminResourceTable\.duplicate/ }));
    await findByTestId("create-modal");
    expect(invalidate).not.toHaveBeenCalled();
    expect(ctx.refetch).not.toHaveBeenCalled();
  });
});
