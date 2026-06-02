import { describe, it, expect } from "vitest";
import { calculateNewsPermissions } from "./news";
import type {
  EntityTypes,
  News,
  Organization,
  Project,
  Event,
  User,
  Poi,
} from "@communecter/cocolight-api-client";

/**
 * Tests du calculator news : 6 permissions × 5 types d'entités + cas isOwnProfile.
 *
 * Pattern : on mock une entité minimale avec son `getEntityType()` + les méthodes
 * de rôle utilisées par la branche concernée, puis on assert sur le retour.
 */

// ── Helpers ──
function makeNews(isAuthor: boolean): News {
  return { isAuthor: () => isAuthor } as unknown as News;
}

function makeUserEntity(): EntityTypes {
  return { getEntityType: () => "citoyens" } as unknown as User;
}

function makeOrgEntity(opts: { isAdmin?: boolean; isMember?: boolean } = {}): EntityTypes {
  return {
    getEntityType: () => "organizations",
    isAdmin: () => opts.isAdmin ?? false,
    isMember: () => opts.isMember ?? false,
  } as unknown as Organization;
}

function makeProjectEntity(opts: { isAdmin?: boolean; isContributor?: boolean } = {}): EntityTypes {
  return {
    getEntityType: () => "projects",
    isAdmin: () => opts.isAdmin ?? false,
    isContributor: () => opts.isContributor ?? false,
  } as unknown as Project;
}

function makeEventEntity(opts: { isAdmin?: boolean; isAuthor?: boolean } = {}): EntityTypes {
  return {
    getEntityType: () => "events",
    isAdmin: () => opts.isAdmin ?? false,
    isAuthor: () => opts.isAuthor ?? false,
  } as unknown as Event;
}

function makePoiEntity(): EntityTypes {
  return { getEntityType: () => "poi" } as unknown as Poi;
}

// ── isOwnProfile (priorité absolue) ──
describe("calculateNewsPermissions — isOwnProfile", () => {
  it("canAddNews = true sur son propre profil", () => {
    const perms = calculateNewsPermissions({
      entity: makeUserEntity(),
      isOwnProfile: true,
    });
    expect(perms.canAddNews).toBe(true);
    expect(perms.canModerateNews).toBe(true);
    expect(perms.canEditComment).toBe(true);
    expect(perms.canDeleteComment).toBe(true);
  });

  it("canEditNews / canDeleteNews seulement si auteur de la news", () => {
    const ownAuthor = calculateNewsPermissions({
      entity: makeUserEntity(),
      news: makeNews(true),
      isOwnProfile: true,
    });
    expect(ownAuthor.canEditNews).toBe(true);
    expect(ownAuthor.canDeleteNews).toBe(true);

    const ownNotAuthor = calculateNewsPermissions({
      entity: makeUserEntity(),
      news: makeNews(false),
      isOwnProfile: true,
    });
    expect(ownNotAuthor.canEditNews).toBe(false);
    expect(ownNotAuthor.canDeleteNews).toBe(false);
  });
});

// ── User (autre que soi) ──
describe("calculateNewsPermissions — User (autre)", () => {
  it("aucune permission d'écriture sur le profil d'un autre user", () => {
    const perms = calculateNewsPermissions({
      entity: makeUserEntity(),
      isOwnProfile: false,
    });
    expect(perms.canAddNews).toBe(false);
    expect(perms.canEditNews).toBe(false);
    expect(perms.canDeleteNews).toBe(false);
    expect(perms.canModerateNews).toBe(false);
    expect(perms.canDeleteComment).toBe(false);
  });

  it("peut éditer ses propres commentaires", () => {
    const perms = calculateNewsPermissions({
      entity: makeUserEntity(),
      isOwnProfile: false,
    });
    expect(perms.canEditComment).toBe(true);
  });
});

// ── Organization ──
describe("calculateNewsPermissions — Organization", () => {
  it("admin peut tout (add, modérer)", () => {
    const perms = calculateNewsPermissions({
      entity: makeOrgEntity({ isAdmin: true }),
      isOwnProfile: false,
    });
    expect(perms.canAddNews).toBe(true);
    expect(perms.canModerateNews).toBe(true);
    expect(perms.canEditNews).toBe(true);
    expect(perms.canDeleteNews).toBe(true);
  });

  it("membre peut ajouter mais pas modérer", () => {
    const perms = calculateNewsPermissions({
      entity: makeOrgEntity({ isMember: true }),
      isOwnProfile: false,
    });
    expect(perms.canAddNews).toBe(true);
    expect(perms.canModerateNews).toBe(false);
  });

  it("non-membre ne peut pas ajouter", () => {
    const perms = calculateNewsPermissions({
      entity: makeOrgEntity({ isAdmin: false, isMember: false }),
      isOwnProfile: false,
    });
    expect(perms.canAddNews).toBe(false);
  });

  it("auteur de la news peut l'éditer même sans être admin", () => {
    const perms = calculateNewsPermissions({
      entity: makeOrgEntity({ isMember: true }),
      news: makeNews(true),
      isOwnProfile: false,
    });
    expect(perms.canEditNews).toBe(true);
    expect(perms.canDeleteNews).toBe(true);
  });

  it("non-auteur + non-admin ne peut pas éditer", () => {
    const perms = calculateNewsPermissions({
      entity: makeOrgEntity({ isMember: true }),
      news: makeNews(false),
      isOwnProfile: false,
    });
    expect(perms.canEditNews).toBe(false);
    expect(perms.canDeleteNews).toBe(false);
  });
});

// ── Project ──
describe("calculateNewsPermissions — Project", () => {
  it("admin et contributor peuvent ajouter", () => {
    expect(
      calculateNewsPermissions({
        entity: makeProjectEntity({ isAdmin: true }),
        isOwnProfile: false,
      }).canAddNews
    ).toBe(true);
    expect(
      calculateNewsPermissions({
        entity: makeProjectEntity({ isContributor: true }),
        isOwnProfile: false,
      }).canAddNews
    ).toBe(true);
  });

  it("ni admin ni contributor → pas d'add", () => {
    expect(
      calculateNewsPermissions({
        entity: makeProjectEntity(),
        isOwnProfile: false,
      }).canAddNews
    ).toBe(false);
  });

  it("admin du projet peut modérer", () => {
    expect(
      calculateNewsPermissions({
        entity: makeProjectEntity({ isAdmin: true }),
        isOwnProfile: false,
      }).canModerateNews
    ).toBe(true);
  });

  it("contributor ne peut pas modérer", () => {
    expect(
      calculateNewsPermissions({
        entity: makeProjectEntity({ isContributor: true }),
        isOwnProfile: false,
      }).canModerateNews
    ).toBe(false);
  });
});

// ── Event ──
describe("calculateNewsPermissions — Event", () => {
  it("admin ou author peuvent ajouter", () => {
    expect(
      calculateNewsPermissions({
        entity: makeEventEntity({ isAdmin: true }),
        isOwnProfile: false,
      }).canAddNews
    ).toBe(true);
    expect(
      calculateNewsPermissions({
        entity: makeEventEntity({ isAuthor: true }),
        isOwnProfile: false,
      }).canAddNews
    ).toBe(true);
  });

  it("ni admin ni author → pas d'add", () => {
    expect(
      calculateNewsPermissions({
        entity: makeEventEntity(),
        isOwnProfile: false,
      }).canAddNews
    ).toBe(false);
  });
});

// ── Defaults (POI ou type inconnu) ──
describe("calculateNewsPermissions — défaut (POI)", () => {
  it("toutes permissions à false pour POI (et types non gérés)", () => {
    const perms = calculateNewsPermissions({
      entity: makePoiEntity(),
      isOwnProfile: false,
    });
    expect(perms.canAddNews).toBe(false);
    expect(perms.canEditNews).toBe(false);
    expect(perms.canDeleteNews).toBe(false);
    expect(perms.canModerateNews).toBe(false);
    expect(perms.canEditComment).toBe(false);
    expect(perms.canDeleteComment).toBe(false);
  });
});
