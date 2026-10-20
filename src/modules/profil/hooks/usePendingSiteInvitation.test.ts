// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────
const mockUseCocolight = vi.fn();
const mockUseProfilPermissions = vi.fn();
const mockGetEntityType = vi.fn();

vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => mockUseCocolight(),
}));
vi.mock("./useProfilPermissions", () => ({
  useProfilPermissions: (entity: unknown) => mockUseProfilPermissions(entity),
}));
vi.mock("../actions/mutations/core", () => ({
  getEntityType: (entity: unknown) => mockGetEntityType(entity),
}));

import { usePendingSiteInvitation } from "./usePendingSiteInvitation";

function setup({
  me,
  entity,
  isInviting = false,
  isInvitingAdmin = false,
  entityType = "organization",
}: {
  me?: unknown;
  entity?: unknown;
  isInviting?: boolean;
  isInvitingAdmin?: boolean;
  entityType?: string | null;
}) {
  mockUseCocolight.mockReturnValue({ me, entity });
  mockUseProfilPermissions.mockReturnValue({ isInviting, isInvitingAdmin });
  mockGetEntityType.mockReturnValue(entityType);
}

describe("usePendingSiteInvitation", () => {
  beforeEach(() => {
    mockUseCocolight.mockReset();
    mockUseProfilPermissions.mockReset();
    mockGetEntityType.mockReset();
  });

  describe("conditions d'affichage", () => {
    it("n'ouvre pas si me est null", () => {
      setup({ me: null, entity: { id: "e1" }, isInviting: true });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(false);
    });

    it("n'ouvre pas si entity est null", () => {
      setup({ me: { id: "u1" }, entity: null, isInviting: true });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(false);
    });

    it("n'ouvre pas si aucune invitation en attente", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" } });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(false);
    });

    it("ouvre la modale si isInviting=true (invitation membre/contributeur)", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: true });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);
      expect(result.current.isInvitingAdmin).toBe(false);
    });

    it("ouvre la modale si isInvitingAdmin=true (invitation admin)", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInvitingAdmin: true });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);
      expect(result.current.isInvitingAdmin).toBe(true);
    });
  });

  describe("entityType", () => {
    it("expose l'entityType dérivé de l'entité (organization/project)", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: true, entityType: "project" });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.entityType).toBe("project");
    });

    it("entityType est null si pas d'entité", () => {
      setup({ me: { id: "u1" }, entity: null });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.entityType).toBeNull();
      expect(mockGetEntityType).not.toHaveBeenCalled();
    });
  });

  describe("fermeture / ré-affichage", () => {
    it("setOpen permet de fermer manuellement la modale", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: true });
      const { result } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);
      act(() => {
        result.current.setOpen(false);
      });
      expect(result.current.open).toBe(false);
    });

    it("ne rouvre pas automatiquement après une fermeture explicite tant que l'invitation reste active", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: true });
      const { result, rerender } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);
      act(() => {
        result.current.setOpen(false);
      });
      rerender();
      expect(result.current.open).toBe(false);
    });

    it("referme automatiquement si l'invitation est traitée ailleurs (isInviting redevient false)", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: true });
      const { result, rerender } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);

      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: false });
      rerender();
      expect(result.current.open).toBe(false);
    });

    it("autorise un nouveau ré-affichage si une nouvelle invitation apparaît plus tard", () => {
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: true });
      const { result, rerender } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);

      // Invitation traitée (fermeture + reset du flag hasPrompted)
      setup({ me: { id: "u1" }, entity: { id: "e1" }, isInviting: false });
      rerender();
      expect(result.current.open).toBe(false);

      // Nouvelle invitation (ex. autre entité) : doit pouvoir se rouvrir
      setup({ me: { id: "u1" }, entity: { id: "e2" }, isInviting: true });
      rerender();
      expect(result.current.open).toBe(true);
    });

    it("réaffiche la modale après une reconnexion (nouvelle référence `me`) même pour la même invitation, sans reload", () => {
      const me1 = { id: "u1" };
      setup({ me: me1, entity: { id: "e1" }, isInviting: true });
      const { result, rerender } = renderHook(() => usePendingSiteInvitation());
      expect(result.current.open).toBe(true);

      // Fermeture (croix, ou accepter/refuser resté ouvert par erreur, etc.)
      act(() => {
        result.current.setOpen(false);
      });
      rerender();
      expect(result.current.open).toBe(false);

      // Reconnexion dans le même onglet, même compte, même invitation encore
      // active côté serveur : CocolightProvider crée un NOUVEL objet `me` à
      // chaque userLoggedIn (même id, référence différente) → la modale doit
      // pouvoir se rouvrir sans attendre un reload de page.
      const me2 = { id: "u1" };
      setup({ me: me2, entity: { id: "e1" }, isInviting: true });
      rerender();
      expect(result.current.open).toBe(true);
    });
  });
});
