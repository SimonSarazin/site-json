import { describe, it, expect } from "vitest";
import type { EntityTypes, Organization, User } from "@communecter/cocolight-api-client";
import { calculateCagnottePermissions } from "./cagnotte";

/**
 * Le porteur d'une ressource (`data.ownerIds`) obtient les mêmes droits qu'un admin
 * de l'entité passée au calculateur.
 *
 * Le besoin vient de l'AAC : le DÉPOSANT d'un commun n'est admin ni de l'org du site
 * ni forcément du projet lié (`checkHierarchy` n'est pas appliqué). Sans cette entrée,
 * seul un admin de l'entité du site pouvait créer un palier ou une action.
 */

function makeOrgEntity(isAdmin = false): EntityTypes {
  return {
    getEntityType: () => "organizations",
    isAdmin: () => isAdmin,
    isContributor: () => false,
  } as unknown as Organization;
}

function makeMe(id: string): User {
  return { id, isConnected: true } as unknown as User;
}

const OPEN_MILESTONE = { status: "open" as const };

describe("calculateCagnottePermissions — ownerIds", () => {
  it("le porteur déclaré gère paliers et actions sans être admin de l'entité", () => {
    const perms = calculateCagnottePermissions(makeOrgEntity(false), makeMe("user-1"), {
      ownerIds: ["user-1"],
    });

    expect(perms.isAdmin).toBe(true);
    expect(perms.canCreateMilestone).toBe(true);
    expect(perms.canCreateAction(OPEN_MILESTONE)).toBe(true);
    expect(perms.canEditMilestone(OPEN_MILESTONE)).toBe(true);
    expect(perms.canDeleteAction({ status: "todo" })).toBe(true);
  });

  it("un utilisateur qui n'est pas dans ownerIds reste sans droits de gestion", () => {
    const perms = calculateCagnottePermissions(makeOrgEntity(false), makeMe("visiteur"), {
      ownerIds: ["user-1"],
    });

    expect(perms.isAdmin).toBe(false);
    expect(perms.canCreateMilestone).toBe(false);
    expect(perms.canCreateAction(OPEN_MILESTONE)).toBe(false);
  });

  it("l'admin de l'entité garde ses droits quand ownerIds est absent — call-sites inchangés", () => {
    const admin = calculateCagnottePermissions(makeOrgEntity(true), makeMe("user-1"));
    expect(admin.isAdmin).toBe(true);
    expect(admin.canCreateMilestone).toBe(true);

    const simple = calculateCagnottePermissions(makeOrgEntity(false), makeMe("user-1"));
    expect(simple.isAdmin).toBe(false);
    expect(simple.canCreateMilestone).toBe(false);
  });

  it("les gardes d'état priment sur le statut de porteur", () => {
    const perms = calculateCagnottePermissions(makeOrgEntity(false), makeMe("user-1"), {
      ownerIds: ["user-1"],
    });

    // Un palier clôturé reste figé, un palier financé reste indestructible.
    expect(perms.canCreateAction({ status: "close" })).toBe(false);
    expect(perms.canEditMilestone({ status: "close" })).toBe(false);
    expect(perms.canDeleteMilestone({ status: "open", hasTransactions: true })).toBe(false);
  });

  it("un utilisateur non connecté ne devient pas porteur", () => {
    const perms = calculateCagnottePermissions(
      makeOrgEntity(false),
      { id: "user-1", isConnected: false } as unknown as User,
      { ownerIds: ["user-1"] },
    );

    expect(perms.isAdmin).toBe(false);
    expect(perms.canCreateMilestone).toBe(false);
  });
});

/**
 * L'AUTEUR d'une action peut la corriger tant qu'elle n'est pas terminée.
 *
 * Créer une action ne rend pas contributeur : sans `authorId`, celui qui l'avait
 * écrite perdait le bouton « éditer » dès l'enregistrement, faute d'être admin
 * du projet ou assigné à sa propre action.
 */
describe("calculateCagnottePermissions — canEditAction", () => {
  const NON_ADMIN = () => makeOrgEntity(false);

  it("l'auteur édite son action non terminée, sans être admin ni contributeur", () => {
    const perms = calculateCagnottePermissions(NON_ADMIN(), makeMe("auteur"));
    expect(perms.canEditAction({ status: "todo", authorId: "auteur", contributorIds: [] })).toBe(true);
  });

  it("le contributeur assigné édite aussi — comportement d'avant, inchangé", () => {
    const perms = calculateCagnottePermissions(NON_ADMIN(), makeMe("assigne"));
    expect(perms.canEditAction({ status: "todo", contributorIds: ["assigne"] })).toBe(true);
  });

  it("le porteur du commun (ownerIds) et l'admin éditent, terminée ou non", () => {
    const porteur = calculateCagnottePermissions(NON_ADMIN(), makeMe("deposant"), {
      ownerIds: ["deposant"],
    });
    expect(porteur.canEditAction({ status: "todo", contributorIds: [] })).toBe(true);
    expect(porteur.canEditAction({ status: "done", contributorIds: [] })).toBe(true);

    const admin = calculateCagnottePermissions(makeOrgEntity(true), makeMe("admin"));
    expect(admin.canEditAction({ status: "done", contributorIds: [] })).toBe(true);
  });

  it("une action TERMINÉE se ferme à l'auteur comme au contributeur", () => {
    const auteur = calculateCagnottePermissions(NON_ADMIN(), makeMe("auteur"));
    expect(auteur.canEditAction({ status: "done", authorId: "auteur", contributorIds: [] })).toBe(false);

    const assigne = calculateCagnottePermissions(NON_ADMIN(), makeMe("assigne"));
    expect(assigne.canEditAction({ status: "done", contributorIds: ["assigne"] })).toBe(false);
  });

  it("un tiers n'édite rien, et un authorId vide ne vaut pas identité", () => {
    const tiers = calculateCagnottePermissions(NON_ADMIN(), makeMe("tiers"));
    expect(tiers.canEditAction({ status: "todo", authorId: "auteur", contributorIds: [] })).toBe(false);

    // `currentUserId` non vide face à une action sans auteur connu : pas de match.
    expect(tiers.canEditAction({ status: "todo", authorId: "", contributorIds: [] })).toBe(false);
    expect(tiers.canEditAction({ status: "todo", contributorIds: [] })).toBe(false);
  });
});

/**
 * Clore son propre travail — symétrique de `canEditAction`.
 *
 * Sans l'auteur, celui qui avait écrit l'action devait d'abord s'y assigner comme
 * contributeur pour pouvoir la cocher : une étape sans intérêt, sur une action qu'il
 * a le droit de modifier par ailleurs.
 */
describe("calculateCagnottePermissions — canMarkActionDone", () => {
  const NON_ADMIN = () => makeOrgEntity(false);

  it("l'auteur clôt son action non terminée, sans être admin ni contributeur", () => {
    const perms = calculateCagnottePermissions(NON_ADMIN(), makeMe("auteur"));
    expect(perms.canMarkActionDone({ status: "todo", authorId: "auteur", contributorIds: [] })).toBe(true);
  });

  it("le contributeur assigné et l'admin la closent — comportement d'avant, inchangé", () => {
    const assigne = calculateCagnottePermissions(NON_ADMIN(), makeMe("assigne"));
    expect(assigne.canMarkActionDone({ status: "todo", contributorIds: ["assigne"] })).toBe(true);

    const admin = calculateCagnottePermissions(makeOrgEntity(true), makeMe("admin"));
    expect(admin.canMarkActionDone({ status: "todo", contributorIds: [] })).toBe(true);
  });

  it("la garde d'état prime : une action déjà terminée ne se re-clôt pour personne", () => {
    const auteur = calculateCagnottePermissions(NON_ADMIN(), makeMe("auteur"));
    expect(auteur.canMarkActionDone({ status: "done", authorId: "auteur", contributorIds: [] })).toBe(false);

    const admin = calculateCagnottePermissions(makeOrgEntity(true), makeMe("admin"));
    expect(admin.canMarkActionDone({ status: "done", contributorIds: [] })).toBe(false);
  });

  it("un tiers ne clôt rien", () => {
    const tiers = calculateCagnottePermissions(NON_ADMIN(), makeMe("tiers"));
    expect(tiers.canMarkActionDone({ status: "todo", authorId: "auteur", contributorIds: [] })).toBe(false);
  });
});

/**
 * `ownerIds` ne se déduit d'aucune entité — être porteur d'une ressource est un fait
 * sur la ressource, pas un rôle sur un objet.
 *
 * Sans ça, l'appelant devait passer une entité de repli (en pratique l'org du site)
 * juste pour franchir le garde d'entrée, ce qui rouvrait tous les droits à ses admins
 * sur le commun de n'importe qui. Le module AAC passe donc `projectEntity` seul, qui
 * vaut `null` tant que le projet n'est pas résolu — ou n'existe pas.
 */
describe("calculateCagnottePermissions — porteur sans entité", () => {
  it("le porteur garde ses droits quand aucune entité n'est en main", () => {
    const perms = calculateCagnottePermissions(null, makeMe("deposant"), {
      ownerIds: ["deposant"],
    });

    expect(perms.isAdmin).toBe(true);
    expect(perms.canCreateMilestone).toBe(true);
    expect(perms.canCreateAction(OPEN_MILESTONE)).toBe(true);
  });

  it("un tiers sans entité n'obtient rien — le garde d'entrée joue toujours", () => {
    const perms = calculateCagnottePermissions(null, makeMe("tiers"), {
      ownerIds: ["deposant"],
    });

    expect(perms.isAdmin).toBe(false);
    expect(perms.canCreateMilestone).toBe(false);
    expect(perms.canCreateAction(OPEN_MILESTONE)).toBe(false);
  });

  it("sans entité NI ownerIds, rien ne passe — comportement d'avant", () => {
    const perms = calculateCagnottePermissions(null, makeMe("qui-que-ce-soit"));

    expect(perms.canCreateMilestone).toBe(false);
    expect(perms.canContributeReason).toBe("No entity provided");
  });

  it("un non-connecté ne devient jamais porteur, même listé dans ownerIds", () => {
    const deconnecte = { id: "deposant", isConnected: false } as unknown as User;
    const perms = calculateCagnottePermissions(null, deconnecte, { ownerIds: ["deposant"] });

    expect(perms.canCreateMilestone).toBe(false);
    expect(perms.canContributeReason).toBe("User not connected");
  });
});
