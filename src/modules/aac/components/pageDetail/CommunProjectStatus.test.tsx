// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * « Ouvrir le projet » — visible de TOUS, sans gate admin — ouvre le drawer d'aperçu partagé du
 * module profil (`EntityPreviewDrawer`), PAS une navigation `/profil/:slug`. Et un chemin
 * d'erreur : l'aperçu qui ne se résout pas se DIT (toast), il n'échoue pas en silence.
 *
 * Le passage en projet (générer, associer) et l'état « enveloppe en vol » se testent avec la
 * barre qui les câble : `CommunActionBar.test.tsx`.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, fallback?: string) => fallback ?? key,
}));
vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => {} }));

// `EntityPreviewDrawer` a ses propres dépendances (permissions, carte, modal d'édition) hors du
// périmètre de CE composant — on vérifie seulement les props qu'il reçoit.
vi.mock("@/modules/profil/components/shared/EntityPreviewDrawer", () => ({
  EntityPreviewDrawer: (props: { entity: { id: string }; open: boolean; link?: string }) =>
    props.open ? (
      <div data-testid="entity-preview-drawer" data-entity-id={props.entity.id} data-link={props.link ?? ""} />
    ) : null,
}));

const { CommunProjectOpenButton, CommunProjectBadge } = await import("./CommunProjectStatus");
const { toast } = await import("sonner");

type Props = Parameters<typeof CommunProjectOpenButton>[0];

function makeApi(projectEntity: { id: string } = { id: "proj-1" }) {
  return { project: vi.fn().mockResolvedValue(projectEntity) } as unknown as NonNullable<Props["api"]>;
}

function renderButton(over: Partial<Props> = {}) {
  return render(<CommunProjectOpenButton api={makeApi()} projectId="proj-1" projectSlug="mon-projet" {...over} />);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.error).mockClear();
});

describe("CommunProjectOpenButton", () => {
  it("ouvre le drawer d'aperçu au clic, sans navigation", async () => {
    const api = makeApi({ id: "proj-1" });
    renderButton({ api });

    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));

    expect(api.project).toHaveBeenCalledWith({ id: "proj-1" });
    const drawer = await screen.findByTestId("entity-preview-drawer");
    expect(drawer.getAttribute("data-entity-id")).toBe("proj-1");
    expect(drawer.getAttribute("data-link")).toBe("/profil/mon-projet");
  });

  it("ne résout le projet qu'une seule fois pour des clics répétés", async () => {
    const api = makeApi({ id: "proj-1" });
    renderButton({ api });

    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));
    await screen.findByTestId("entity-preview-drawer");
    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));

    expect(api.project).toHaveBeenCalledTimes(1);
  });

  it("fonctionne même sans slug résolu (le lien 'page complète' est simplement absent)", async () => {
    renderButton({ projectSlug: null });

    fireEvent.click(screen.getByRole("button", { name: /detail\.project\.openCta/ }));
    const drawer = await screen.findByTestId("entity-preview-drawer");
    expect(drawer.getAttribute("data-link")).toBe("");
  });

  it("signale par un toast l'aperçu qui ne se résout pas, au lieu d'échouer en silence", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const api = { project: vi.fn().mockRejectedValue(new Error("Projet inaccessible")) } as unknown as NonNullable<Props["api"]>;
    renderButton({ api });

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

describe("CommunProjectBadge", () => {
  it("dit la phase, sans action", () => {
    render(<CommunProjectBadge />);
    expect(screen.getByText("detail.project.proposalPhaseBadge")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
