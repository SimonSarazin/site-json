import { describe, expect, it } from "vitest";
import { calculateCoFormPermissions } from "./coform";
import { DEFAULT_COFORM_PERMISSIONS } from "../defaults";
import type { CoFormAccessInfo } from "../../types";

/**
 * Tests du calculateur de permissions coform.
 * Couvre les 3 branches principales : pas d'access, canSubmitAnswer derived,
 * canEditAnswer/canDeleteAnswer par ownership/canEdit serveur.
 */

const makeUser = (id: string, isConnected = true) =>
  ({
    id,
    isConnected,
    serverData: { id, name: "Test User" },
  }) as unknown as Parameters<typeof calculateCoFormPermissions>[1];

const makeAccess = (overrides: Partial<CoFormAccessInfo> = {}): CoFormAccessInfo => ({
  canAnswer: true,
  reason: null,
  formStatus: "open",
  existingAnswerId: null,
  existingAnswer: null,
  requiresLogin: false,
  allowTemporary: false,
  withConfirmation: false,
  isOnlyMember: false,
  isOneAnswerPerPers: false,
  isActive: true,
  dates: { start: null, end: null, startNoConfirmation: null, endNoConfirmation: null },
  ...overrides,
});

describe("calculateCoFormPermissions", () => {
  describe("cas dégradés", () => {
    it("retourne defaults désactivés si me et entity null", () => {
      const perms = calculateCoFormPermissions(null, null);
      expect(perms.canSubmitAnswer).toBe(false);
      expect(perms.cannotSubmitReason).toBe("not_logged_in");
      expect(perms.isConnected).toBe(false);
      expect(perms.currentUserId).toBe("");
    });

    it("garde isConnected si me connecté mais sans access", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"));
      expect(perms.isConnected).toBe(true);
      expect(perms.currentUserId).toBe("u1");
      expect(perms.canSubmitAnswer).toBe(false);
      // Pas d'access → on retombe sur defaults sécurisés.
      expect(perms.cannotSubmitReason).toBeNull();
    });
  });

  describe("canSubmitAnswer", () => {
    it("dérive de access.canAnswer = true", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess({ canAnswer: true }),
      });
      expect(perms.canSubmitAnswer).toBe(true);
      expect(perms.cannotSubmitReason).toBeUndefined();
    });

    it("dérive de access.canAnswer = false avec reason", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess({ canAnswer: false, reason: "already_answered" }),
      });
      expect(perms.canSubmitAnswer).toBe(false);
      expect(perms.cannotSubmitReason).toBe("already_answered");
    });

    it("dérive false avec reason form_closed", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess({ canAnswer: false, reason: "form_closed" }),
      });
      expect(perms.canSubmitAnswer).toBe(false);
      expect(perms.cannotSubmitReason).toBe("form_closed");
    });
  });

  describe("canViewForm", () => {
    it("true par défaut", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canViewForm).toBe(true);
    });

    it("false si isOnlyMember et non-membre", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess({ isOnlyMember: true }),
      });
      // safeIsMember(null) = false → canViewForm = false
      expect(perms.canViewForm).toBe(false);
    });
  });

  describe("canEditAnswer", () => {
    it("false si me non connecté", () => {
      const perms = calculateCoFormPermissions(null, null, {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer({ user: "u1" })).toBe(false);
    });

    it("respecte answer.canEdit = true du serveur", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer({ user: "u2", canEdit: true })).toBe(true);
    });

    it("respecte answer.canEdit = false du serveur (même si owner)", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer({ user: "u1", canEdit: false })).toBe(false);
    });

    it("fallback : owner peut éditer un draft", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer({ user: "u1", draft: true })).toBe(true);
    });

    it("fallback : owner peut éditer sa réponse finalisée", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer({ user: "u1" })).toBe(true);
    });

    it("non-owner ne peut pas éditer (sans canEdit du serveur)", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer({ user: "u2" })).toBe(false);
    });

    it("retourne false pour answer null", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canEditAnswer(null)).toBe(false);
      expect(perms.canEditAnswer(undefined)).toBe(false);
    });
  });

  describe("canDeleteAnswer", () => {
    it("seul l'auteur peut supprimer sa réponse", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canDeleteAnswer({ user: "u1" })).toBe(true);
      expect(perms.canDeleteAnswer({ user: "u2" })).toBe(false);
    });

    it("false si me non connecté", () => {
      const perms = calculateCoFormPermissions(null, null, {
        access: makeAccess(),
      });
      expect(perms.canDeleteAnswer({ user: "u1" })).toBe(false);
    });

    it("retourne false pour answer null", () => {
      const perms = calculateCoFormPermissions(null, makeUser("u1"), {
        access: makeAccess(),
      });
      expect(perms.canDeleteAnswer(null)).toBe(false);
    });
  });

  describe("structure des defaults", () => {
    it("DEFAULT_COFORM_PERMISSIONS désactive toutes les actions", () => {
      expect(DEFAULT_COFORM_PERMISSIONS.canSubmitAnswer).toBe(false);
      expect(DEFAULT_COFORM_PERMISSIONS.canEditAnswer(null)).toBe(false);
      expect(DEFAULT_COFORM_PERMISSIONS.canDeleteAnswer(null)).toBe(false);
      expect(DEFAULT_COFORM_PERMISSIONS.canViewForm).toBe(true);
    });
  });
});
