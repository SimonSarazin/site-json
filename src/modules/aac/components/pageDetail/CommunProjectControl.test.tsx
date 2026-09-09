// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

/**
 * Trois états à couvrir (cf. doc/34-module-aac.md §1 — génération IRRÉVERSIBLE,
 * jamais gatée sur le statut du commun) :
 *  1. un projet existe déjà → bouton "Ouvrir le projet", visible de TOUS (pas de
 *     gate admin) — ouvre le drawer d'aperçu partagé du module profil
 *     (`EntityPreviewDrawer`), PAS une navigation `/profil/:slug` ;
 *  2. pas de projet, admin → bouton "Générer" (+ "Associer"), SANS badge ;
 *  3. pas de projet, non-admin → badge "Phase proposition" seul, aucun bouton.
 * Et un chemin d'erreur : l'aperçu qui ne se résout pas se DIT (toast), il
 * n'échoue pas en silence.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string, params?: Record<string, unknown>) => {
    const base = fallback ?? key;
    if (!params) return base;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
      base
    );
  },
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

const generateMutate = vi.fn();
let isPending = false;
vi.mock("../../hooks/useGenerateAacProject", () => ({
  useGenerateAacProject: () => ({ mutate: generateMutate, isPending }),
}));

const associateMutate = vi.fn();
let isAssociatePending = false;
vi.mock("../../hooks/useAssociateExistingAacProject", () => ({
  useAssociateExistingAacProject: () => ({ mutate: associateMutate, isPending: isAssociatePending }),
}));

// `EntityPreviewDrawer` a ses propres dépendances (permissions, carte, modal
// d'édition) hors du périmètre de CE composant — on vérifie seulement que
// `CommunProjectControl` lui passe les bonnes props, pas son rendu interne.
vi.mock("@/modules/profil/components/shared/EntityPreviewDrawer", () => ({
  EntityPreviewDrawer: (props: { entity: { id: string }; open: boolean; link?: string }) =>
    props.open ? (
      <div data-testid="entity-preview-drawer" data-entity-id={props.entity.id} data-link={props.link ?? ""} />
    ) : null,
}));

// `FinderSearchModal` a ses propres dépendances (recherche debounced, React
// Query) hors du périmètre de CE composant — on simule juste un bouton qui
// "valide" un élément choisi, pour vérifier le câblage `onValidate`.
vi.mock("@/modules/coform/components/FinderSearchModal", () => ({
  FinderSearchModal: (props: {
    config: { elementLabel: string; filters: Array<{ attributeName: string; valueName: string }> };
    onValidate: (elements: Array<{ id: string; name: string; type: string }>) => void;
    onClose: () => void;
  }) => (
    <div
      data-testid="finder-search-modal"
      data-element-label={props.config.elementLabel}
      data-filters={JSON.stringify(props.config.filters)}
    >
      <button
        type="button"
        onClick={() => props.onValidate([{ id: "existing-proj-1", name: "Projet existant", type: "projects" }])}
      >
        pick-existing-project
      </button>
      <button type="button" onClick={props.onClose}>
        close-finder
      </button>
    </div>
  ),
}));

const { CommunProjectControl } = await import("./CommunProjectControl");
const { toast } = await import("sonner");

type Props = Parameters<typeof CommunProjectControl>[0];

function makeApi(projectEntity: { id: string } = { id: "proj-1" }) {
  return { project: vi.fn().mockResolvedValue(projectEntity) } as unknown as NonNullable<Props["api"]>;
}

function renderControl(over: Partial<Props> = {}) {
  return render(
    <CommunProjectControl
      api={makeApi()}
      canManageProject
      answerId="answer-1"
      projectId={null}
      projectSlug={null}
      parentId="677e7e13bd08b2478f5f5314"
      parentType="organizations"
      userId="user-1"
      {...over}
    />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.error).mockClear();
  generateMutate.mockClear();
  associateMutate.mockClear();
  isPending = false;
  isAssociatePending = false;
});

describe("CommunProjectControl — pas de projet", () => {
  it("n'affiche que le badge à un non-admin", () => {
    renderControl({ canManageProject: false, projectId: null });
    expect(screen.getByText("detail.project.proposalPhaseBadge")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("affiche le bouton Générer à un admin, SANS le badge (il peut déjà agir)", () => {
    renderControl({ canManageProject: true, projectId: null });
    expect(screen.queryByText("detail.project.proposalPhaseBadge")).toBeNull();
    expect(screen.getByRole("button", { name: /detail\.project\.generateCta/ })).toBeTruthy();
  });
});

describe("CommunProjectControl — génération", () => {
  it("demande confirmation avant d'appeler la mutation", () => {
    renderControl({ canManageProject: true, projectId: null });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.generateCta/ }));
    expect(generateMutate).not.toHaveBeenCalled();
  });

  it("appelle la mutation une seule fois après confirmation", () => {
    renderControl({ canManageProject: true, projectId: null });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.generateCta/ }));
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.confirmGenerate\.confirm/ }));
    expect(generateMutate).toHaveBeenCalledTimes(1);
  });

  it("déclenche onGenerated quand la mutation réussit", () => {
    const onGenerated = vi.fn();
    renderControl({ canManageProject: true, projectId: null, onGenerated });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.generateCta/ }));
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.confirmGenerate\.confirm/ }));

    const [, callbacks] = generateMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    callbacks.onSuccess?.();
    expect(onGenerated).toHaveBeenCalledTimes(1);
  });

  it("n'appelle rien si l'utilisateur annule", () => {
    renderControl({ canManageProject: true, projectId: null });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.generateCta/ }));
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.confirmGenerate\.cancel/ }));
    expect(generateMutate).not.toHaveBeenCalled();
  });

  it("désactive le bouton pendant l'enregistrement", () => {
    isPending = true;
    renderControl({ canManageProject: true, projectId: null });
    const bouton = screen.getByRole("button", { name: /detail\.project\.generateCta/ });
    expect(bouton.hasAttribute("disabled")).toBe(true);
  });
});

describe("CommunProjectControl — association à un projet existant", () => {
  it("affiche le bouton Associer à côté de Générer, pour un admin sans projet", () => {
    renderControl({ canManageProject: true, projectId: null });
    expect(screen.getByRole("button", { name: /detail\.project\.associateCta/ })).toBeTruthy();
  });

  it("n'affiche pas le bouton Associer à un non-admin", () => {
    renderControl({ canManageProject: false, projectId: null });
    expect(screen.queryByRole("button", { name: /detail\.project\.associateCta/ })).toBeNull();
  });

  it("ouvre le finder au clic, fermé par défaut", () => {
    renderControl({ canManageProject: true, projectId: null });
    expect(screen.queryByTestId("finder-search-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.associateCta/ }));
    expect(screen.getByTestId("finder-search-modal")).toBeTruthy();
  });

  it("appelle la mutation d'association avec l'id du projet choisi", () => {
    renderControl({ canManageProject: true, projectId: null });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.associateCta/ }));
    fireEvent.click(screen.getByText("pick-existing-project"));

    expect(associateMutate).toHaveBeenCalledTimes(1);
    expect(associateMutate.mock.calls[0][0]).toEqual({ projectId: "existing-proj-1" });
  });

  it("déclenche onGenerated et referme le finder quand l'association réussit", () => {
    const onGenerated = vi.fn();
    renderControl({ canManageProject: true, projectId: null, onGenerated });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.associateCta/ }));
    fireEvent.click(screen.getByText("pick-existing-project"));

    const [, callbacks] = associateMutate.mock.calls[0] as [unknown, { onSuccess?: () => void }];
    act(() => {
      callbacks.onSuccess?.();
    });

    expect(onGenerated).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("finder-search-modal")).toBeNull();
  });

  it("désactive le bouton Associer pendant l'écriture", () => {
    isAssociatePending = true;
    renderControl({ canManageProject: true, projectId: null });
    const bouton = screen.getByRole("button", { name: /detail\.project\.associateCta/ });
    expect(bouton.hasAttribute("disabled")).toBe(true);
  });

  it("restreint le finder aux projets dont l'utilisateur courant est admin", () => {
    renderControl({ canManageProject: true, projectId: null, userId: "user-42" });
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.associateCta/ }));

    const filters = JSON.parse(
      screen.getByTestId("finder-search-modal").getAttribute("data-filters") ?? "[]"
    );
    expect(filters).toEqual([
      { attributeName: "links.contributors.user-42.type", valueName: "citoyens" },
      { attributeName: "links.contributors.user-42.isAdmin", valueName: "true" },
    ]);
  });

  it("désactive le bouton Associer si l'utilisateur courant est inconnu (pas de filtre sûr)", () => {
    renderControl({ canManageProject: true, projectId: null, userId: null });
    const bouton = screen.getByRole("button", { name: /detail\.project\.associateCta/ });
    expect(bouton.hasAttribute("disabled")).toBe(true);
  });
});

describe("CommunProjectControl — projet existant", () => {
  it("ouvre le drawer d'aperçu (pas de navigation) au clic, y compris pour un non-admin", async () => {
    const api = makeApi({ id: "proj-1" });
    renderControl({ canManageProject: false, api, projectId: "proj-1", projectSlug: "mon-projet" });

    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));

    expect(api.project).toHaveBeenCalledWith({ id: "proj-1" });
    const drawer = await screen.findByTestId("entity-preview-drawer");
    expect(drawer.getAttribute("data-entity-id")).toBe("proj-1");
    expect(drawer.getAttribute("data-link")).toBe("/profil/mon-projet");
  });

  it("ne résout le projet qu'une seule fois pour des clics répétés", async () => {
    const api = makeApi({ id: "proj-1" });
    renderControl({ projectId: "proj-1", projectSlug: "mon-projet", api });

    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));
    await screen.findByTestId("entity-preview-drawer");
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));

    expect(api.project).toHaveBeenCalledTimes(1);
  });

  it("fonctionne même sans slug résolu (le lien 'page complète' est simplement absent)", async () => {
    const api = makeApi({ id: "proj-1" });
    renderControl({ projectId: "proj-1", projectSlug: null, api });

    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));
    const drawer = await screen.findByTestId("entity-preview-drawer");
    expect(drawer.getAttribute("data-link")).toBe("");
  });

  it("signale par un toast l'aperçu qui ne se résout pas, au lieu d'échouer en silence", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = { project: vi.fn().mockRejectedValue(new Error("Projet inaccessible")) } as unknown as NonNullable<Props["api"]>;
    renderControl({ projectId: "proj-1", projectSlug: "mon-projet", api });

    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("detail.project.toasts.openError", {
        description: "Projet inaccessible",
      }),
    );
    expect(screen.queryByTestId("entity-preview-drawer")).toBeNull();
    // Le bouton redevient cliquable : l'utilisateur, informé, peut réessayer.
    expect(screen.getByRole("button", { name: /detail\.project\.openCta/ }).hasAttribute("disabled")).toBe(false);
  });
});
