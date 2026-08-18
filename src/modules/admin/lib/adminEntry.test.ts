import { describe, it, expect } from "vitest";
import {
  levelSatisfies,
  resolveAdminAccessLevel,
  isAdminEntryVisible,
  isKanbanEntryVisible,
} from "./adminEntry";

type Config = Parameters<typeof isAdminEntryVisible>[0];
type KanbanConfig = Parameters<typeof isKanbanEntryVisible>[0];

/** Config minimale — cast : enabled/access sont posés par les défauts zod à la validation. */
function cfg(admin: Record<string, unknown> | undefined): Config {
  return { admin } as unknown as Config;
}

// Doublons minimaux des objets lib (User / carrier) — aucune vraie lib réseau.
const superAdmin = { isSuperAdmin: () => true };
const adminPlatform = { isAdminPlatform: () => true };
const lambda = { isSuperAdmin: () => false, isAdminPlatform: () => false };
const carrierAdmin = { isAdmin: () => true };
const carrierNotAdmin = { isAdmin: () => false };

describe("levelSatisfies — hiérarchie superAdmin > siteAdmin > entityAdmin", () => {
  it("superAdmin satisfait tous les niveaux", () => {
    expect(levelSatisfies("superAdmin", "superAdmin")).toBe(true);
    expect(levelSatisfies("superAdmin", "siteAdmin")).toBe(true);
    expect(levelSatisfies("superAdmin", "entityAdmin")).toBe(true);
  });

  it("siteAdmin satisfait siteAdmin et entityAdmin, pas superAdmin", () => {
    expect(levelSatisfies("siteAdmin", "superAdmin")).toBe(false);
    expect(levelSatisfies("siteAdmin", "siteAdmin")).toBe(true);
    expect(levelSatisfies("siteAdmin", "entityAdmin")).toBe(true);
  });

  it("entityAdmin ne satisfait que entityAdmin", () => {
    expect(levelSatisfies("entityAdmin", "superAdmin")).toBe(false);
    expect(levelSatisfies("entityAdmin", "siteAdmin")).toBe(false);
    expect(levelSatisfies("entityAdmin", "entityAdmin")).toBe(true);
  });

  it("null ne satisfait rien", () => {
    expect(levelSatisfies(null, "entityAdmin")).toBe(false);
    expect(levelSatisfies(null, "superAdmin")).toBe(false);
  });
});

describe("resolveAdminAccessLevel — superAdmin (plateforme) > siteAdmin (admin du carrier)", () => {
  it("isSuperAdmin() → superAdmin", () => {
    expect(resolveAdminAccessLevel(superAdmin, null)).toBe("superAdmin");
  });

  it("isAdminPlatform() → superAdmin", () => {
    expect(resolveAdminAccessLevel(adminPlatform, null)).toBe("superAdmin");
  });

  it("superAdmin prime sur l'admin du carrier", () => {
    expect(resolveAdminAccessLevel(superAdmin, carrierAdmin)).toBe("superAdmin");
  });

  it("admin du carrier (sans droits plateforme) → siteAdmin", () => {
    expect(resolveAdminAccessLevel(lambda, carrierAdmin)).toBe("siteAdmin");
    expect(resolveAdminAccessLevel(null, carrierAdmin)).toBe("siteAdmin");
  });

  it("ni plateforme ni carrier → null", () => {
    expect(resolveAdminAccessLevel(lambda, carrierNotAdmin)).toBeNull();
    expect(resolveAdminAccessLevel(null, null)).toBeNull();
    expect(resolveAdminAccessLevel(undefined, undefined)).toBeNull();
  });

  it("objets sans les méthodes (optionnelles) → null, sans lever", () => {
    expect(resolveAdminAccessLevel({}, {})).toBeNull();
  });
});

describe("isAdminEntryVisible — même gate que la page /admin", () => {
  it("pas de config ou pas de bloc admin → invisible", () => {
    expect(isAdminEntryVisible(null, superAdmin, carrierAdmin)).toBe(false);
    expect(isAdminEntryVisible(undefined, superAdmin, carrierAdmin)).toBe(false);
    expect(isAdminEntryVisible(cfg(undefined), superAdmin, carrierAdmin)).toBe(false);
  });

  it("admin.enabled:false → invisible même pour un superAdmin", () => {
    expect(isAdminEntryVisible(cfg({ enabled: false }), superAdmin, carrierAdmin)).toBe(false);
  });

  it("défaut access.min = siteAdmin : admin du carrier visible, visiteur lambda non", () => {
    expect(isAdminEntryVisible(cfg({ enabled: true }), lambda, carrierAdmin)).toBe(true);
    expect(isAdminEntryVisible(cfg({ enabled: true }), lambda, carrierNotAdmin)).toBe(false);
    expect(isAdminEntryVisible(cfg({ enabled: true }), null, null)).toBe(false);
  });

  it("access absent → défaut siteAdmin appliqué", () => {
    expect(isAdminEntryVisible(cfg({}), lambda, carrierAdmin)).toBe(true);
  });

  it("min superAdmin : siteAdmin refusé, plateforme acceptée", () => {
    const config = cfg({ enabled: true, access: { min: "superAdmin" } });
    expect(isAdminEntryVisible(config, lambda, carrierAdmin)).toBe(false);
    expect(isAdminEntryVisible(config, superAdmin, null)).toBe(true);
  });

  it("min entityAdmin : siteAdmin suffit (hiérarchie)", () => {
    const config = cfg({ enabled: true, access: { min: "entityAdmin" } });
    expect(isAdminEntryVisible(config, lambda, carrierAdmin)).toBe(true);
  });
});

/** Config kanban minimale — typée telle quelle (tous les champs d'AuthConfig sont optionnels). */
function kanbanCfg(kanban?: boolean): KanbanConfig {
  return { auth: { menu: { kanban } } };
}

describe("isKanbanEntryVisible — opt-in auth.menu.kanban, admins du costum, jamais sans slug", () => {
  it("opt-in absent ou false → invisible même pour un superAdmin", () => {
    expect(isKanbanEntryVisible(kanbanCfg(undefined), superAdmin, carrierAdmin, "tiersLieux")).toBe(false);
    expect(isKanbanEntryVisible(kanbanCfg(false), superAdmin, carrierAdmin, "tiersLieux")).toBe(false);
    expect(isKanbanEntryVisible({}, superAdmin, carrierAdmin, "tiersLieux")).toBe(false);
    expect(isKanbanEntryVisible(null, superAdmin, carrierAdmin, "tiersLieux")).toBe(false);
  });

  it("indépendant du back-office : visible sans aucun bloc `admin` en config", () => {
    expect(isKanbanEntryVisible(kanbanCfg(true), lambda, carrierAdmin, "tiersLieux")).toBe(true);
  });

  it("sans slug de carrier résolu → invisible (jamais de lien cassé)", () => {
    expect(isKanbanEntryVisible(kanbanCfg(true), superAdmin, carrierAdmin, "")).toBe(false);
    expect(isKanbanEntryVisible(kanbanCfg(true), superAdmin, carrierAdmin, null)).toBe(false);
    expect(isKanbanEntryVisible(kanbanCfg(true), superAdmin, carrierAdmin, undefined)).toBe(false);
  });

  it("niveau requis siteAdmin : admin du carrier et superAdmin visibles, lambda non", () => {
    expect(isKanbanEntryVisible(kanbanCfg(true), lambda, carrierAdmin, "s")).toBe(true);
    expect(isKanbanEntryVisible(kanbanCfg(true), superAdmin, null, "s")).toBe(true);
    expect(isKanbanEntryVisible(kanbanCfg(true), adminPlatform, null, "s")).toBe(true);
    expect(isKanbanEntryVisible(kanbanCfg(true), lambda, carrierNotAdmin, "s")).toBe(false);
    expect(isKanbanEntryVisible(kanbanCfg(true), null, null, "s")).toBe(false);
  });
});
