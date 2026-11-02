import { describe, it, expect } from "vitest";
import {
  levelSatisfies,
  resolveAdminAccessLevel,
  isAdminEntryVisible,
  resolveKanbanEntry,
} from "./adminEntry";

type Config = Parameters<typeof isAdminEntryVisible>[0];
type KanbanConfig = Parameters<typeof resolveKanbanEntry>[0];

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
function kanbanCfg(kanban?: boolean, module = false): KanbanConfig {
  return { auth: { menu: { kanban } }, ...(module ? { kanban: {} } : {}) };
}

const SERVER = "https://www.communecter.org/";
const PLATFORM = { kind: "platform", href: "https://www.communecter.org/#@tiersLieux.view.actions" };
const MODULE = { kind: "module", to: "/kanban" };
const context = (contextType: string | null, costumSlug: string | null = "tiersLieux") => ({ costumSlug, contextType, serverUrl: SERVER });

const orgMember = { isAdmin: () => false, isMember: () => true };
const projectContributor = { isAdmin: () => false, isContributor: () => true };
const outsider = { isAdmin: () => false, isMember: () => false, isContributor: () => false };

describe("resolveKanbanEntry — sans le module : l’ancien lien vers la plateforme, admins du costum", () => {
  it("opt-in absent ou false → aucune entrée, même pour un superAdmin", () => {
    expect(resolveKanbanEntry(kanbanCfg(undefined), superAdmin, carrierAdmin, context("projects"))).toBeNull();
    expect(resolveKanbanEntry(kanbanCfg(false), superAdmin, carrierAdmin, context("projects"))).toBeNull();
    expect(resolveKanbanEntry(kanbanCfg(false, true), superAdmin, carrierAdmin, context("projects"))).toBeNull();
    expect(resolveKanbanEntry({}, superAdmin, carrierAdmin, context("projects"))).toBeNull();
    expect(resolveKanbanEntry(null, superAdmin, carrierAdmin, context("projects"))).toBeNull();
  });

  it("indépendant du back-office : le lien de la plateforme sans aucun bloc `admin` en config", () => {
    expect(resolveKanbanEntry(kanbanCfg(true), lambda, carrierAdmin, context("organizations"))).toEqual(PLATFORM);
  });

  it("sans slug de carrier résolu → aucune entrée (jamais de lien cassé)", () => {
    expect(resolveKanbanEntry(kanbanCfg(true), superAdmin, carrierAdmin, context("projects", ""))).toBeNull();
    expect(resolveKanbanEntry(kanbanCfg(true), superAdmin, carrierAdmin, context("projects", null))).toBeNull();
  });

  it("niveau requis siteAdmin : admin du carrier et superAdmin, ni membre ni lambda", () => {
    expect(resolveKanbanEntry(kanbanCfg(true), superAdmin, null, context("projects"))).toEqual(PLATFORM);
    expect(resolveKanbanEntry(kanbanCfg(true), adminPlatform, null, context("projects"))).toEqual(PLATFORM);
    expect(resolveKanbanEntry(kanbanCfg(true), lambda, orgMember, context("organizations"))).toBeNull();
    expect(resolveKanbanEntry(kanbanCfg(true), lambda, carrierNotAdmin, context("projects"))).toBeNull();
    expect(resolveKanbanEntry(kanbanCfg(true), null, null, context("projects"))).toBeNull();
  });
});

describe("resolveKanbanEntry — module `kanban` actif : la page /kanban du site, en remplacement", () => {
  it("membre d’une organisation, contributeur d’un projet, admin ou superAdmin : /kanban", () => {
    expect(resolveKanbanEntry(kanbanCfg(true, true), lambda, orgMember, context("organizations"))).toEqual(MODULE);
    expect(resolveKanbanEntry(kanbanCfg(true, true), lambda, projectContributor, context("projects"))).toEqual(MODULE);
    expect(resolveKanbanEntry(kanbanCfg(true, true), lambda, carrierAdmin, context("projects"))).toEqual(MODULE);
    expect(resolveKanbanEntry(kanbanCfg(true, true), superAdmin, null, context("organizations"))).toEqual(MODULE);
  });

  it("le lien de la plateforme n’est plus proposé, même à un admin", () => {
    expect(resolveKanbanEntry(kanbanCfg(true, true), superAdmin, carrierAdmin, context("projects"))).not.toEqual(PLATFORM);
  });

  it("ni membre, ni contributeur, ni admin → aucune entrée (la page le refuserait)", () => {
    expect(resolveKanbanEntry(kanbanCfg(true, true), lambda, outsider, context("organizations"))).toBeNull();
    // La règle du TYPE : un membre d'organisation n'est pas contributeur d'un projet.
    expect(resolveKanbanEntry(kanbanCfg(true, true), lambda, orgMember, context("projects"))).toBeNull();
  });

  it("porteur sans kanban (ni organisation ni projet) → aucune entrée", () => {
    expect(resolveKanbanEntry(kanbanCfg(true, true), superAdmin, carrierAdmin, context("citoyens"))).toBeNull();
    expect(resolveKanbanEntry(kanbanCfg(true, true), superAdmin, carrierAdmin, context(null))).toBeNull();
  });

  it("le slug du carrier ne compte plus : la page est sur le site", () => {
    expect(resolveKanbanEntry(kanbanCfg(true, true), lambda, orgMember, context("organizations", null))).toEqual(MODULE);
  });
});
