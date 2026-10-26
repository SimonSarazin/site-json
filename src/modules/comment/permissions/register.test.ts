import { describe, it, expect } from "vitest";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { getCalculator } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { CommentPermissions } from "./types";
import "./register";

/**
 * Les droits du fil, tels que le module les ENREGISTRE (et non le seul calculateur) : c'est la
 * fonction enregistrée qui coupait tout sans `userContext` (revue du 29/09).
 */
const calculer = (ctx: Partial<PermissionContext>) =>
  getCalculator("comment")!.calculate({ entity: null, me: null, ...ctx } as PermissionContext) as unknown as CommentPermissions;

const moi = (roles: Record<string, unknown> = {}) =>
  ({ isConnected: true, slug: "moi", roles, isSuperAdmin: () => roles.superAdmin === true }) as unknown as User;

/** Une organisation chargée par `api.organization({id})` : connectée, mais SANS `userContext`. */
const orgSansContexte = { isConnected: true, userContext: null } as unknown as EntityTypes;
/** Une organisation dont je suis admin : `isAdmin` est une MÉTHODE (`User.ts`). */
const orgAdmin = (admin: boolean) =>
  ({ isConnected: true, userContext: { isAdmin: () => admin } }) as unknown as EntityTypes;

describe("droits du fil — participation", () => {
  it("anonyme : aucun droit", () => {
    expect(calculer({ entity: orgSansContexte })).toMatchObject({ canComment: false, canModerate: false });
  });

  it("connecté, entité sans `userContext` (aperçu de recherche) : peut écrire", () => {
    expect(calculer({ entity: orgSansContexte, me: moi() })).toMatchObject({
      canComment: true, canReply: true, canReact: true, canReport: true,
    });
  });

  it("connecté, fil sans porteur : peut écrire", () => {
    expect(calculer({ me: moi() }).canComment).toBe(true);
  });

  it("fil fermé par l'option de section : aucun droit", () => {
    expect(calculer({ me: moi(), data: { enabled: false } }).canComment).toBe(false);
  });
});

describe("droits du fil — modération (règle de `Comment::delete`)", () => {
  it("la méthode `isAdmin` n'est plus lue comme une valeur : simple membre → pas de modération", () => {
    expect(calculer({ entity: orgAdmin(false), me: moi() }).canModerate).toBe(false);
  });

  it("admin de l'espace : pas de modération — le serveur refuse", () => {
    expect(calculer({ entity: orgAdmin(true), me: moi() }).canModerate).toBe(false);
  });

  it("super-admin : modère", () => {
    expect(calculer({ entity: orgAdmin(false), me: moi({ superAdmin: true }) }).canModerate).toBe(true);
  });

  it("admin de source : modère", () => {
    expect(calculer({ me: moi({ sourceAdmin: true }) }).canModerate).toBe(true);
  });
});
