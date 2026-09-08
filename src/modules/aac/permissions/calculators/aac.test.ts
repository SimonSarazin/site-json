import { describe, expect, it } from "vitest";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { calculateAacPermissions } from "./aac";
import type { AacGateFlags } from "../types";

/**
 * Le calculateur de permissions AAC — le seul fichier pur du module qui décide de
 * droits, et qui n'avait aucun test. Le patron suit `cagnotte.test.ts`.
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

  it("un non-connecté ne dépose pas, sauf appel standalone", () => {
    const ferme = calculateAacPermissions(NON_ADMIN(), ANON, { gates: gates() });
    expect(ferme.canCreateCommun).toBe(false);
    expect(ferme.canCreateCommunReason).toBe("User not connected");

    const ouvert = calculateAacPermissions(NON_ADMIN(), ANON, { gates: gates({ standalone: true }) });
    expect(ouvert.canCreateCommun).toBe(true);
  });

  it("`oneAnswerPerPers` ferme le dépôt à qui a déjà répondu", () => {
    const perms = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: gates({ oneAnswerPerPers: true }),
      hasOwnCommun: true,
    });
    expect(perms.canCreateCommun).toBe(false);
    expect(perms.canCreateCommunReason).toBe("Already answered (one per person)");
  });

  /**
   * `standalone` remplace l'exigence de CONNEXION, pas les gates communauté/rôles —
   * c'est ce qu'énonce l'en-tête du calculateur, et ce qu'implémentait déjà
   * `canCreateCommunReason` (`!isConnected && !gates.standalone`) pendant que la
   * décision, elle, court-circuitait tout.
   */
  it("`standalone` ne dispense NI du gate communauté NI des rôles", () => {
    const nonMembre = calculateAacPermissions(NON_ADMIN(), ANON, {
      gates: gates({ standalone: true, onlyMemberAccess: true }),
      isCommunityMember: false,
    });
    expect(nonMembre.canCreateCommun).toBe(false);
    expect(nonMembre.canCreateCommunReason).toBe("Insufficient membership/role");

    const sansRole = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: gates({ standalone: true, restrictRoles: ["porteur"] }),
      userRoles: ["visiteur"],
    });
    expect(sansRole.canCreateCommun).toBe(false);
  });

  it("mais laisse passer un membre, connecté ou non", () => {
    const membreAnonyme = calculateAacPermissions(NON_ADMIN(), ANON, {
      gates: gates({ standalone: true, onlyMemberAccess: true }),
      isCommunityMember: true,
    });
    expect(membreAnonyme.canCreateCommun).toBe(true);
  });

  it("le gate communauté ferme le dépôt à un connecté non membre", () => {
    const perms = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: gates({ onlyMemberAccess: true }),
      isCommunityMember: false,
    });
    expect(perms.canCreateCommun).toBe(false);
    expect(perms.canCreateCommunReason).toBe("Insufficient membership/role");
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
  it("l'annuaire public s'ouvre à tous ; sinon aux membres et aux admins", () => {
    expect(calculateAacPermissions(NON_ADMIN(), ANON, { gates: { annuaire: true } }).canReadCommuns).toBe(true);
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {}, isCommunityMember: true }).canReadCommuns).toBe(true);
    expect(calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {}, isCommunityMember: false }).canReadCommuns).toBe(false);
    expect(calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: {} }).canReadCommuns).toBe(true);
  });

  it("un commun se modifie par son auteur ou un admin", () => {
    const auteur = calculateAacPermissions(NON_ADMIN(), makeMe("u1"), { gates: {} });
    expect(auteur.canEditCommun({ authorId: "u1" })).toBe(true);
    expect(auteur.canEditCommun({ authorId: "u2" })).toBe(false);
    expect(auteur.canEditCommun(null)).toBe(false);

    const admin = calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: {} });
    expect(admin.canEditCommun({ authorId: "u1" })).toBe(true);
  });

  it("`coRemuneration` est le gate MAÎTRE du financement", () => {
    const off = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: { coRemuneration: false } });
    expect(off.canContributeFunding).toBe(false);
    expect(off.canContributeFundingReason).toBe("Co-funding disabled (master gate)");

    const anonyme = calculateAacPermissions(NON_ADMIN(), ANON, { gates: { coRemuneration: true } });
    expect(anonyme.canContributeFunding).toBe(false);
    expect(anonyme.canContributeFundingReason).toBe("User not connected");

    const connecte = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: { coRemuneration: true } });
    expect(connecte.canContributeFunding).toBe(true);
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
    const perms = calculateAacPermissions(null, makeMe("u"), { gates: { active: true, annuaire: true } });
    expect(perms.currentUserId).toBe("u");
    expect(perms.isConnected).toBe(true);
    expect(perms.canCreateCommun).toBe(false);
  });
});
