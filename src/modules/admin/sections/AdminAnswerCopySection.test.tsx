// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";

import { selectText } from "../../../../tests/test-utils-ui";

/**
 * Câblage de la section : chaque état de `copyStatusOf` doit se traduire par ce que l'admin PEUT
 * faire (copier / confirmer d'abord / rien), et « Copier » doit rester inerte tant que l'index
 * du form cible n'est pas complet — sinon une copie déjà faite passe pour « À copier ». La
 * logique d'état elle-même est couverte par `answerCopy.test.ts` ; ici on teste le rendu et
 * les appels.
 */
const ctx = vi.hoisted(() => ({
  candidates: [] as unknown[],
  target: [] as unknown[],
  targetComplete: true,
  targetCapped: false,
  targetPending: false,
  targetFetching: false,
  targetError: null as unknown,
  hasNextPage: false,
  /** `enabled` reçu par le mock de useSearchQuery : le fetch des candidates est gaté par l'index. */
  candidatesEnabled: undefined as boolean | undefined,
  mutate: vi.fn(),
  isPending: false,
  /** Callback `onCopied` capturé par le mock de useCopyAnswer (simule un succès serveur). */
  onCopied: null as null | ((sourceId: string, copyId: string) => void),
}));

vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: (params: { enabled?: boolean }) => {
    ctx.candidatesEnabled = params.enabled;
    return {
      transformedResults: ctx.candidates,
      isLoading: false,
      totalCount: ctx.candidates.length,
      lastItemRef: () => undefined,
      hasNextPage: ctx.hasNextPage,
      isFetchingNextPage: false,
    };
  },
}));
vi.mock("@/modules/search/hooks/useSearchAllResults", () => ({
  useSearchAllResults: () => ({
    results: ctx.target,
    loaded: ctx.target.length,
    total: ctx.target.length,
    isComplete: ctx.targetComplete,
    capped: ctx.targetCapped,
    isLoading: !ctx.targetComplete,
    isPending: ctx.targetPending,
    isFetching: ctx.targetFetching,
    error: ctx.targetError,
  }),
}));
vi.mock("../hooks/useCopyAnswer", () => ({
  useCopyAnswer: (_target: string, onCopied?: (sourceId: string, copyId: string) => void) => {
    ctx.onCopied = onCopied ?? null;
    return { mutate: ctx.mutate, isPending: ctx.isPending };
  },
}));
// `useT` renvoie la clé brute (et la clé + params pour les interpolations) : les assertions portent dessus.
vi.mock("@/hooks/useT", () => ({ useT: () => (key: unknown) => (typeof key === "string" ? key : JSON.stringify(key)) }));
vi.mock("@/hooks/useDebounce", () => ({ useDebounce: <T,>(v: T) => v }));
vi.mock("@/modules/admin/i18n", () => ({}));
// Coque de détail remplacée par un témoin : on teste QUI s'ouvre, QUAND, avec QUELLE conf, et sa
// fermeture — pas le rendu du détail (couvert par le module search).
vi.mock("@/modules/search/components/SwitchDetailsMode", () => ({
  SwitchDetailsMode: ({ openDetails, setOpenDetails, item, preview }: {
    openDetails: boolean;
    setOpenDetails: (open: boolean) => void;
    item: { id: string };
    preview?: { type?: string; editButton?: boolean };
  }) =>
    openDetails ? (
      <div data-testid="answer-preview">
        <span data-testid="answer-preview-item">{item.id}</span>
        <span data-testid="answer-preview-conf">{JSON.stringify(preview)}</span>
        <button type="button" onClick={() => setOpenDetails(false)}>fermer le détail</button>
      </div>
    ) : null,
}));

import AdminAnswerCopySection from "./AdminAnswerCopySection";

const row = (id: string, data: Record<string, unknown>) => ({ id, serverData: data });
const BASE_SECTION = {
  type: "answerCopy",
  sourceForm: "6928096adf5caf0d230e7f26",
  targetForm: "6a85af345d898a57cb49f029",
  columns: ["name"],
};
const SECTION = BASE_SECTION as never;
const SECTION_PREVIEW = { ...BASE_SECTION, preview: { type: "coform-answer" } } as never;
/** Le bloc preview de l'onglet Modération, recopié tel quel (même forme, même type), plus une largeur. */
const SECTION_PREVIEW_EDIT = { ...BASE_SECTION, preview: { type: "coform-answer", editButton: true, width: "3xl" } } as never;
/** Conf reçue par la coque de détail, telle que la section la transmet. */
const previewConf = (getByTestId: (id: string) => HTMLElement) => JSON.parse(getByTestId("answer-preview-conf").textContent ?? "null");
const PREVIEW_LABEL = "AdminAnswerCopySection.preview";

const COPY = "AdminAnswerCopySection.copy";

beforeEach(() => {
  ctx.candidates = [
    row("s1", { name: "Pilates", structure: { name: "Mairie" }, address: { postalCode: "97430" } }),
    row("s2", { name: "Zumba", structure: { name: "Mairie" }, address: { postalCode: "97418" } }),
    row("s3", { name: "Marche", structure: { name: "Mairie" }, address: { postalCode: "97430" } }),
  ];
  ctx.target = [
    row("c1", { copiedFrom: "s1", name: "Pilates" }),
    row("c2", { name: "Zumba", structure: { name: "Mairie" }, address: { postalCode: "97418" } }),
  ];
  ctx.targetComplete = true;
  ctx.targetCapped = false;
  ctx.targetPending = false;
  ctx.targetFetching = false;
  ctx.targetError = null;
  ctx.isPending = false;
  ctx.hasNextPage = false;
  ctx.candidatesEnabled = undefined;
  ctx.onCopied = null;
  ctx.mutate.mockReset();
});

describe("AdminAnswerCopySection — états et actions", () => {
  it("masque les « Copié », en dit le nombre, et propose « Copier » sur les autres", () => {
    const { getAllByText, getByText, queryByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(queryByText("Pilates")).toBeNull(); // s1 est copiée → masquée
    expect(queryByText("AdminAnswerCopySection.status.copied")).toBeNull();
    expect(getByText("AdminAnswerCopySection.status.probable")).toBeTruthy();
    expect(getByText("AdminAnswerCopySection.status.new")).toBeTruthy();
    expect(getByText(/AdminAnswerCopySection\.hiddenCopied/)).toBeTruthy();
    expect(getAllByText(COPY)).toHaveLength(2);
  });

  it("les lignes sont rendues « À copier » d'abord (ordre serveur : s1, s2, s3)", () => {
    const { getAllByRole } = render(<AdminAnswerCopySection section={SECTION} />);
    const cells = getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent);
    expect(cells).toEqual(["Marche", "Zumba"]);
  });

  it("le fetch des candidates est gaté par l'index cible (rien à masquer sans lui)", () => {
    render(<AdminAnswerCopySection section={SECTION} />);
    expect(ctx.candidatesEnabled).toBe(true);
    ctx.targetComplete = false;
    render(<AdminAnswerCopySection section={SECTION} />);
    expect(ctx.candidatesEnabled).toBe(false);
  });

  it("une page suivante → une ligne sentinelle dédiée, même si toutes les lignes sont masquées", () => {
    ctx.hasNextPage = true;
    ctx.candidates = [row("s1", { name: "Pilates" })]; // entièrement copiée
    const { getByTestId, queryByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(queryByText("Pilates")).toBeNull();
    expect(getByTestId("answer-copy-sentinel")).toBeTruthy();
  });

  it("« À copier » → mutation immédiate avec l'id source et l'intitulé", () => {
    const { getAllByText } = render(<AdminAnswerCopySection section={SECTION} />);
    const [nouveau] = getAllByText(COPY); // ordre AFFICHÉ : s3 (new) puis s2 (probable)
    fireEvent.click(nouveau);
    expect(ctx.mutate).toHaveBeenCalledWith({ answerId: "s3", name: "Marche" });
  });

  it("« Doublon probable » → confirmation d'abord, mutation après", () => {
    const { getAllByText, getByText } = render(<AdminAnswerCopySection section={SECTION} />);
    const [, probable] = getAllByText(COPY);
    fireEvent.click(probable);
    expect(ctx.mutate).not.toHaveBeenCalled();
    fireEvent.click(getByText("AdminAnswerCopySection.confirmAction"));
    expect(ctx.mutate).toHaveBeenCalledWith({ answerId: "s2", name: "Zumba" });
  });

  it("index cible incomplet → « Copier » désactivé (jamais de copie à l'aveugle)", () => {
    ctx.targetComplete = false;
    const { getAllByText, getByText } = render(<AdminAnswerCopySection section={SECTION} />);
    for (const b of getAllByText(COPY)) expect((b.closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(getByText("AdminAnswerCopySection.indexing")).toBeTruthy();
  });

  it("index plafonné → « Copier » désactivé avec le message dédié", () => {
    ctx.targetCapped = true;
    const { getAllByText, getByText } = render(<AdminAnswerCopySection section={SECTION} />);
    for (const b of getAllByText(COPY)) expect((b.closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(getByText("AdminAnswerCopySection.indexCapped")).toBeTruthy();
  });

  it("index cible en ERREUR → « Copier » désactivé, message dédié (jamais « 0 réponse » = tout à copier)", () => {
    ctx.targetError = new Error("boom");
    const { getAllByText, getByText, queryByText } = render(<AdminAnswerCopySection section={SECTION} />);
    for (const b of getAllByText(COPY)) expect((b.closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(getByText("AdminAnswerCopySection.indexError")).toBeTruthy();
    expect(queryByText("AdminAnswerCopySection.indexed")).toBeNull();
  });

  it("refetch de l'index en cours (après une copie) → « Copier » désactivé", () => {
    ctx.targetFetching = true;
    const { getAllByText } = render(<AdminAnswerCopySection section={SECTION} />);
    for (const b of getAllByText(COPY)) expect((b.closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("une copie réussie retire la ligne sans attendre le refetch de l'index", () => {
    const { getAllByText, queryByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(getAllByText(COPY)).toHaveLength(2);
    act(() => ctx.onCopied?.("s3", "c9"));
    expect(getAllByText(COPY)).toHaveLength(1); // s3 copiée → masquée
    expect(queryByText("Marche")).toBeNull();
    expect(queryByText("AdminAnswerCopySection.status.new")).toBeNull();
  });

  it("sans candidate visible : état vide (tout est copié)", () => {
    ctx.candidates = [row("s1", { name: "Pilates" })];
    const { getByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(getByText("AdminAnswerCopySection.empty")).toBeTruthy();
  });
});

describe("AdminAnswerCopySection — détail d'une candidate (`preview`)", () => {
  it("avec `preview` : le clic sur une ligne ouvre le détail de CETTE réponse, en lecture seule", () => {
    const { getByText, getByTestId } = render(<AdminAnswerCopySection section={SECTION_PREVIEW} />);
    fireEvent.click(getByText("Marche")); // s3, première ligne affichée
    expect(getByTestId("answer-preview-item").textContent).toBe("s3");
    expect(previewConf(getByTestId)).toEqual({ type: "coform-answer", editButton: false });
  });

  it("un `editButton: true` recopié depuis la Modération est neutralisé — jamais « Modifier » sur la réponse d'un autre site", () => {
    // Le schéma refuse cette config, mais elle n'est pas parsée au runtime : la section doit tenir
    // seule. Le reste du bloc passe intact (une liste blanche casserait le détail en silence).
    const { getByText, getByTestId } = render(<AdminAnswerCopySection section={SECTION_PREVIEW_EDIT} />);
    fireEvent.click(getByText("Marche"));
    expect(previewConf(getByTestId)).toEqual({ type: "coform-answer", editButton: false, width: "3xl" });
  });

  it("terminer une sélection de texte sur une ligne n'ouvre pas le détail (copier un nom reste possible)", () => {
    const { getByText, queryByTestId } = render(<AdminAnswerCopySection section={SECTION_PREVIEW} />);
    const cell = getByText("Marche");
    selectText(cell);
    try {
      fireEvent.click(cell); // le `click` qui termine le glisser
      expect(queryByTestId("answer-preview")).toBeNull();
    } finally {
      window.getSelection()?.removeAllRanges();
    }
  });

  it("« Copier » n'ouvre PAS le détail (propagation coupée sur la cellule d'action)", () => {
    const { getAllByText, queryByTestId } = render(<AdminAnswerCopySection section={SECTION_PREVIEW} />);
    fireEvent.click(getAllByText(COPY)[0]);
    expect(ctx.mutate).toHaveBeenCalledWith({ answerId: "s3", name: "Marche" });
    expect(queryByTestId("answer-preview")).toBeNull();
  });

  it("le bouton « Aperçu » ouvre le même détail (accès clavier) et la fermeture le retire", () => {
    const { getAllByLabelText, getByTestId, getByText, queryByTestId } = render(<AdminAnswerCopySection section={SECTION_PREVIEW} />);
    fireEvent.click(getAllByLabelText(PREVIEW_LABEL)[1]); // s2 (« Doublon probable »), 2ᵉ ligne
    expect(getByTestId("answer-preview-item").textContent).toBe("s2");
    fireEvent.click(getByText("fermer le détail"));
    expect(queryByTestId("answer-preview")).toBeNull();
  });

  it("sans `preview` : aucune réaction au clic sur une ligne, aucun bouton « Aperçu »", () => {
    const { getByText, queryByTestId, queryByLabelText } = render(<AdminAnswerCopySection section={SECTION} />);
    fireEvent.click(getByText("Marche"));
    expect(queryByTestId("answer-preview")).toBeNull();
    expect(queryByLabelText(PREVIEW_LABEL)).toBeNull();
  });
});
