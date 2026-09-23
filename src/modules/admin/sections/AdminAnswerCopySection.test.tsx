// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";

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
  mutate: vi.fn(),
  isPending: false,
  /** Callback `onCopied` capturé par le mock de useCopyAnswer (simule un succès serveur). */
  onCopied: null as null | ((sourceId: string, copyId: string) => void),
}));

vi.mock("@/modules/search/hooks/useSearchQuery", () => ({
  useSearchQuery: () => ({
    transformedResults: ctx.candidates,
    isLoading: false,
    totalCount: ctx.candidates.length,
    lastItemRef: () => undefined,
  }),
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

import AdminAnswerCopySection from "./AdminAnswerCopySection";

const row = (id: string, data: Record<string, unknown>) => ({ id, serverData: data });
const SECTION = {
  type: "answerCopy",
  sourceForm: "6928096adf5caf0d230e7f26",
  targetForm: "6a85af345d898a57cb49f029",
  columns: ["name"],
} as never;

const COPY = "AdminAnswerCopySection.copy";
const COPIED = "AdminAnswerCopySection.copied";

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
  ctx.onCopied = null;
  ctx.mutate.mockReset();
});

describe("AdminAnswerCopySection — états et actions", () => {
  it("rend un badge par état et une action cohérente", () => {
    const { getAllByText, getByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(getByText("AdminAnswerCopySection.status.copied")).toBeTruthy();
    expect(getByText("AdminAnswerCopySection.status.probable")).toBeTruthy();
    expect(getByText("AdminAnswerCopySection.status.new")).toBeTruthy();
    // « Copié » = bouton inerte ; deux « Copier » (probable + nouveau).
    expect((getByText(COPIED).closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(getAllByText(COPY)).toHaveLength(2);
  });

  it("les lignes sont rendues « À copier » d'abord, « Copié » en dernier (ordre serveur : s1, s2, s3)", () => {
    const { getAllByRole } = render(<AdminAnswerCopySection section={SECTION} />);
    const cells = getAllByRole("row").slice(1).map((r) => r.querySelector("td")?.textContent);
    expect(cells).toEqual(["Marche", "Zumba", "Pilates"]);
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

  it("une copie réussie marque la ligne « Copié » sans attendre le refetch de l'index", () => {
    const { getAllByText, queryByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(getAllByText(COPY)).toHaveLength(2);
    act(() => ctx.onCopied?.("s3", "c9"));
    expect(getAllByText(COPY)).toHaveLength(1); // s3 est passée « Copié »
    expect(getAllByText(COPIED)).toHaveLength(2);
    expect(queryByText("AdminAnswerCopySection.status.new")).toBeNull();
  });

  it("sans candidate : état vide", () => {
    ctx.candidates = [];
    const { getByText } = render(<AdminAnswerCopySection section={SECTION} />);
    expect(getByText("AdminAnswerCopySection.empty")).toBeTruthy();
  });
});
