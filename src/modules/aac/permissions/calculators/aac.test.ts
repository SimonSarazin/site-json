import { describe, expect, it } from "vitest";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { calculateAacPermissions } from "./aac";
import type { AacGateFlags } from "../types";

/**
 * Le calculateur de permissions AAC — le seul fichier pur du module qui décide de
 * droits. Le patron suit `cagnotte.test.ts`.
 *
 * Les gates sont les clés RACINE du form que le legacy lit réellement (review
 * MR 53, C3/N1) : `standalone` et `annuaire` n'existaient pas côté backend et
 * ont disparu ; `anyOnewithLinkCanAnswer` a retrouvé son sens (modifier une
 * réponse sans lien au contexte, connecté). Le financement, lui, ne dépend pas
 * d'un gate mais de l'ÉTAPE de financement de l'appel (`hasFundingStep`).
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
   * `detailProposal.php` porte DEUX onglets : `#proposition-funding` (l.100-104),
   * les paliers et leurs financeurs, ouvert dès que l'étape `aapStep3` existe, et
   * `#proposition-contribution` (l.105-108), la corémunération, seul gardé par
   * `form.coremu`. Les blocs de la fiche traduisent le PREMIER.
   */
  it("le financement s'affiche dès que l'appel porte une étape de financement", () => {
    const sans = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {}, hasFundingStep: false });
    expect(sans.canViewFunding).toBe(false);
    expect(sans.canContributeFunding).toBe(false);
    expect(sans.canContributeFundingReason).toBe("No funding step on this call");

    const absent = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {} });
    expect(absent.canViewFunding).toBe(false);

    const avec = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: {}, hasFundingStep: true });
    expect(avec.canViewFunding).toBe(true);
    expect(avec.canContributeFunding).toBe(true);
  });

  it("l'affichage suit l'étape seule ; contribuer exige en plus un compte", () => {
    const anonyme = calculateAacPermissions(NON_ADMIN(), ANON, { gates: {}, hasFundingStep: true });
    expect(anonyme.canViewFunding).toBe(true);
    expect(anonyme.canContributeFunding).toBe(false);
    expect(anonyme.canContributeFundingReason).toBe("User not connected");
  });

  it("sans étape de financement, l'admin non plus ne voit rien (parité legacy)", () => {
    const admin = calculateAacPermissions(makeEntity(true), makeMe("a"), { gates: {}, hasFundingStep: false });
    expect(admin.canViewFunding).toBe(false);
    expect(admin.canContributeFunding).toBe(false);
  });

  /**
   * Régression du 09/09 : brancher l'affichage sur `coremu` éteignait les trois
   * blocs sur l'appel de la Fédération des CAE — dont le formulaire ne porte pas
   * la clé — alors que 500 € y étaient déjà collectés. `coremu` ne garde que la
   * corémunération, que site-json ne rend pas.
   */
  it("`coremu` n'ouvre ni ne ferme le financement", () => {
    const gatesCoremu = { coremu: true } as unknown as AacGateFlags;
    const coremuSansEtape = calculateAacPermissions(NON_ADMIN(), makeMe("u"), { gates: gatesCoremu });
    expect(coremuSansEtape.canViewFunding).toBe(false);

    const etapeSansCoremu = calculateAacPermissions(NON_ADMIN(), makeMe("u"), {
      gates: { coremu: false },
      hasFundingStep: true,
    });
    expect(etapeSansCoremu.canViewFunding).toBe(true);
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
    const perms = calculateAacPermissions(null, makeMe("u"), { gates: { active: true }, hasFundingStep: true });
    expect(perms.currentUserId).toBe("u");
    expect(perms.isConnected).toBe(true);
    expect(perms.canCreateCommun).toBe(false);
    expect(perms.canViewFunding).toBe(false);
  });
});
