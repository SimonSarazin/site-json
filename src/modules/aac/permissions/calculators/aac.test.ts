import { describe, expect, it } from "vitest";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { calculateAacPermissions } from "./aac";
import type { AacGateFlags } from "../types";

/**
 * Le calculateur de permissions AAC — le seul fichier pur du module qui décide de
 * droits. Le patron suit `cagnotte.test.ts`.
 *
 * Les gates sont les clés RACINE du form que le legacy lit réellement (review
 * MR 53, C3/N1) : `coremu` garde le financement ; `standalone` et `annuaire`
 * n'existaient pas côté backend et ont disparu ; `anyOnewithLinkCanAnswer` a
 * retrouvé son sens (modifier une réponse sans lien au contexte, connecté).
 */

const makeEntity = (isAdmin: boolean) =>
  ({ isAdmin: () => isAdmin }) as unknown as EntityTypes;

const makeMe = (id: string, isConnected = true) =>
  ({ id, isConnected }) as unknown as User;

const ANON = { id: "", isConnected: false } as unknown as User;
const NON_ADMIN = () => makeEntity(false);

describe("calculateAacPermissions — dépôt d'un commun", () => {
  const gates = (over: Partial<AacGateFlags> = {}): AacGateFlags => ({ active: true, ...over });

  it("un appel inactif ferme le dépôt à tous, admin compris", () => {
    const admin = calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: gates({ active: false }) });
    expect(admin.canCreateCommun).toBe(false);

    const membre = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: gates({ active: false }) });
    expect(membre.canCreateCommun).toBe(false);
    expect(membre.canCreateCommunReason).toBe("AAC inactive");
  });

  /**
   * Il n'existe pas de clé `standalone` côté legacy (mode de requête, pas une
   * option du form) : le dépôt exige un compte, point — parité
   * `Coform::getFormAccessInfo` (`not_logged_in`). Et `anyOnewithLinkCanAnswer`
   * n'est PAS un dépôt sans connexion : il ne lève pas cette garde.
   */
  it("un non-connecté ne dépose pas — `anyOnewithLinkCanAnswer` n'y change rien", () => {
    const ferme = calculateAacPermissions(NON_ADMIN(), ANON, { gates: gates() });
    expect(ferme.canCreateCommun).toBe(false);
    expect(ferme.canCreateCommunReason).toBe("User not connected");

    const parLien = calculateAacPermissions(NON_ADMIN(), ANON, { gates: gates({ anyOnewithLinkCanAnswer: true }) });
    expect(parLien.canCreateCommun).toBe(false);
    expect(parLien.canCreateCommunReason).toBe("User not connected");
  });

  it("`oneAnswerPerPers` ferme le dépôt à qui a déjà répondu", () => {
    const perms = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: gates({ oneAnswerPerPers: true }),
      hasOwnCommun: true,
    });
    expect(perms.canCreateCommun).toBe(false);
    expect(perms.canCreateCommunReason).toBe("Already answered (one per person)");
  });

  it("le gate communauté ferme le dépôt à un connecté non membre, et l'ouvre à un membre", () => {
    const nonMembre = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: gates({ onlyMemberAccess: true }),
      isCommunityMember: false,
    });
    expect(nonMembre.canCreateCommun).toBe(false);
    expect(nonMembre.canCreateCommunReason).toBe("Insufficient membership/role");

    const membre = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: gates({ onlyMemberAccess: true }),
      isCommunityMember: true,
    });
    expect(membre.canCreateCommun).toBe(true);
  });

  it("les rôles requis : il suffit d'en porter un", () => {
    const data = { gates: gates({ restrictRoles: ["porteur", "referent"] }) };
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { ...data, userRoles: ["referent"] }).canCreateCommun).toBe(true);
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { ...data, userRoles: [] }).canCreateCommun).toBe(false);
  });

  it("l'admin passe outre communauté et rôles, tant que l'appel est actif", () => {
    const perms = calculateAacPermissions(makeEntity(true), makeMe("a"), {
      gates: gates({ onlyMemberAccess: true, restrictRoles: ["porteur"] }),
      isCommunityMember: false,
      userRoles: [],
    });
    expect(perms.canCreateCommun).toBe(true);
  });
});

describe("calculateAacPermissions — lecture, édition, financement", () => {
  /**
   * Plus de gate `annuaire` (aucune clé backend) : la lecture est publique, sauf
   * appel réservé à sa communauté (`Form.php:1869`) — et les admins passent.
   */
  it("la lecture est publique, sauf `onlyMemberAccess` : membres et admins seulement", () => {
    expect(calculateAacPermissions(NON_ADMIN(), ANON, { gates: {} }).canReadCommuns).toBe(true);
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: { onlyMemberAccess: true }, isCommunityMember: true }).canReadCommuns).toBe(true);
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: { onlyMemberAccess: true }, isCommunityMember: false }).canReadCommuns).toBe(false);
    expect(calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: { onlyMemberAccess: true } }).canReadCommuns).toBe(true);
  });

  it("un commun se modifie par son auteur ou un admin", () => {
    const auteur = calculateAacPermissions(NON_ADMIN(), makeMe("u1"), { gates: {} });
    expect(auteur.canEditCommun({ authorId: "u1" })).toBe(true);
    expect(auteur.canEditCommun({ authorId: "u2" })).toBe(false);
    expect(auteur.canEditCommun(null)).toBe(false);

    const admin = calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: {} });
    expect(admin.canEditCommun({ authorId: "u1" })).toBe(true);
  });

  /**
   * Le VRAI sens de `anyOnewithLinkCanAnswer` (« avoir le lien suffit pour
   * répondre ») : sur une réponse existante, le legacy pose `canEditAnswer = true`
   * pour tout CONNECTÉ (`IndexAction.php:237`) — sans lien au contexte, mais
   * jamais pour un anonyme.
   */
  it("`anyOnewithLinkCanAnswer` ouvre l'édition à tout connecté — jamais à un anonyme", () => {
    const gates = { anyOnewithLinkCanAnswer: true };
    const connecte = calculateAacPermissions(NON_ADMIN(), makeMe("u1"), { gates });
    expect(connecte.canEditCommun({ authorId: "u2" })).toBe(true);
    expect(connecte.canEditCommun(null)).toBe(false);

    const anonyme = calculateAacPermissions(NON_ADMIN(), ANON, { gates });
    expect(anonyme.canEditCommun({ authorId: "u2" })).toBe(false);
  });

  /**
   * `coremu` — la clé que le legacy lit (`detailProposal.php:105`), et non
   * `coRemuneration`, qui n'existait nulle part : le gate valait toujours `false`
   * et aurait éteint le financement de tout site (review MR 53, C3).
   */
  it("`coremu` est le gate MAÎTRE du financement ; absent ⇒ fermé", () => {
    const off = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: { coremu: false } });
    expect(off.canViewFunding).toBe(false);
    expect(off.canContributeFunding).toBe(false);
    expect(off.canContributeFundingReason).toBe("Co-funding disabled (master gate)");

    const absent = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {} });
    expect(absent.canViewFunding).toBe(false);
    expect(absent.canContributeFunding).toBe(false);

    const connecte = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: { coremu: true } });
    expect(connecte.canViewFunding).toBe(true);
    expect(connecte.canContributeFunding).toBe(true);
  });

  it("l'affichage du financement suit `coremu` seul ; contribuer exige en plus un compte", () => {
    const anonyme = calculateAacPermissions(NON_ADMIN(), ANON, { gates: { coremu: true } });
    expect(anonyme.canViewFunding).toBe(true);
    expect(anonyme.canContributeFunding).toBe(false);
    expect(anonyme.canContributeFundingReason).toBe("User not connected");
  });

  it("`coremu` OFF masque le financement à l'admin aussi (parité legacy)", () => {
    const admin = calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: { coremu: false } });
    expect(admin.canViewFunding).toBe(false);
    expect(admin.canContributeFunding).toBe(false);
  });

  it("`coRemuneration` n'est pas un gate : il n'ouvre rien", () => {
    const perms = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: { coRemuneration: true } as unknown as AacGateFlags,
    });
    expect(perms.canViewFunding).toBe(false);
    expect(perms.canContributeFunding).toBe(false);
  });

  it("le droit d'administrer l'annuaire n'appartient qu'à l'admin", () => {
    expect(calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: {} }).canSelectCommun).toBe(true);
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {} }).canSelectCommun).toBe(false);
  });

  it("l'admin costum passe par le drapeau parapluie, sans rôle sur l'entité", () => {
    const perms = calculateAacPermissions(NON_ADMIN(), makeMe("a"), { gates: { active: true } }, true);
    expect(perms.isAdmin).toBe(true);
    expect(perms.canCreateCommun).toBe(true);
  });
});

describe("calculateAacPermissions — sans entité", () => {
  it("rend les valeurs par défaut, en conservant l'identité du lecteur", () => {
    const perms = calculateAacPermissions(null, makeMe("u"), { gates: { active: true, coremu: true } });
    expect(perms.currentUserId).toBe("u");
    expect(perms.isConnected).toBe(true);
    expect(perms.canCreateCommun).toBe(false);
    expect(perms.canViewFunding).toBe(false);
  });
});
