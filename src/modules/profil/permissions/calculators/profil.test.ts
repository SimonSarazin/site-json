import { describe, it, expect } from "vitest";
import { calculateOrganizationPermissions } from "./organization";
import { calculateProjectPermissions } from "./project";
import { calculateEventPermissions } from "./event";
import { calculatePoiPermissions } from "./poi";
import {
  calculateOwnProfilePermissions,
  calculateOtherUserPermissions,
} from "./user";
import type {
  Organization,
  Project,
  Event,
  Poi,
  User,
} from "@communecter/cocolight-api-client";

/**
 * Tests des calculators de permissions du module profil.
 *
 * Chaque calculator est testé en mockant les méthodes Cocolight (isAdmin, isMember,
 * isAuthor, etc.) sur une entité factice. On vérifie les permissions critiques
 * (canEditProfile, canFollow, isMember, isAdmin, canAddX, etc.).
 *
 * On clone le pattern de coform.test.ts : factory `makeOrg/makeProject/...` qui
 * crée une entité avec des méthodes mockées, puis on assert sur le résultat.
 */

// ── Helpers ──
type EntityMethodReturns = Record<string, unknown>;

function makeOrg(returns: EntityMethodReturns = {}): Organization {
  const defaults = {
    isAdmin: false,
    isMember: false,
    isFollowing: false,
    isToBeValidated: false,
    isInviting: false,
    isInvitingAdmin: false,
    isAdminPending: false,
  };
  const r = { ...defaults, ...returns };
  return {
    isAdmin: () => r.isAdmin as boolean,
    isMember: () => r.isMember as boolean,
    isFollowing: () => r.isFollowing as boolean,
    isToBeValidated: () => r.isToBeValidated as boolean,
    isInviting: () => r.isInviting as boolean,
    isInvitingAdmin: () => r.isInvitingAdmin as boolean,
    isAdminPending: () => r.isAdminPending as boolean,
  } as unknown as Organization;
}

function makeProject(returns: EntityMethodReturns = {}): Project {
  const defaults = {
    isAdmin: false,
    isContributor: false,
    isFollowing: false,
    isToBeValidated: false,
    isInviting: false,
    isInvitingAdmin: false,
    isAdminPending: false,
  };
  const r = { ...defaults, ...returns };
  return {
    isAdmin: () => r.isAdmin as boolean,
    isContributor: () => r.isContributor as boolean,
    isFollowing: () => r.isFollowing as boolean,
    isToBeValidated: () => r.isToBeValidated as boolean,
    isInviting: () => r.isInviting as boolean,
    isInvitingAdmin: () => r.isInvitingAdmin as boolean,
    isAdminPending: () => r.isAdminPending as boolean,
  } as unknown as Project;
}

function makeEvent(returns: EntityMethodReturns = {}): Event {
  const defaults = {
    isAdmin: false,
    isAuthor: false,
    isAttendee: false,
    isFollowing: false,
    isInviting: false,
    isInvitingAdmin: false,
    isAdminPending: false,
  };
  const r = { ...defaults, ...returns };
  return {
    isAdmin: () => r.isAdmin as boolean,
    isAuthor: () => r.isAuthor as boolean,
    isAttendee: () => r.isAttendee as boolean,
    isFollowing: () => r.isFollowing as boolean,
    isInviting: () => r.isInviting as boolean,
    isInvitingAdmin: () => r.isInvitingAdmin as boolean,
    isAdminPending: () => r.isAdminPending as boolean,
  } as unknown as Event;
}

function makePoi(returns: EntityMethodReturns = {}): Poi {
  const defaults = { isAuthor: false, isFollowing: false };
  const r = { ...defaults, ...returns };
  return {
    isAuthor: () => r.isAuthor as boolean,
    isFollowing: () => r.isFollowing as boolean,
  } as unknown as Poi;
}

function makeUser(returns: EntityMethodReturns = {}): User {
  const defaults = {
    isFollowing: false,
    isFriend: false,
    isInvitingFriend: false,
    isToBeValidatedFriend: false,
  };
  const r = { ...defaults, ...returns };
  return {
    isFollowing: () => r.isFollowing as boolean,
    isFriend: () => r.isFriend as boolean,
    isInvitingFriend: () => r.isInvitingFriend as boolean,
    isToBeValidatedFriend: () => r.isToBeValidatedFriend as boolean,
  } as unknown as User;
}

// ── Organization ──
describe("calculateOrganizationPermissions", () => {
  describe("canEditProfile", () => {
    it("true si admin", () => {
      const perms = calculateOrganizationPermissions(makeOrg({ isAdmin: true }));
      expect(perms.canEditProfile).toBe(true);
      expect(perms.editProfileReason).toBeUndefined();
    });

    it("false si pas admin (avec reason)", () => {
      const perms = calculateOrganizationPermissions(makeOrg({ isAdmin: false }));
      expect(perms.canEditProfile).toBe(false);
      expect(perms.editProfileReason).toBe("Must be admin of organization");
    });
  });

  describe("isMember / isAdmin", () => {
    it("expose isAdmin et isMember", () => {
      const perms = calculateOrganizationPermissions(
        makeOrg({ isAdmin: true, isMember: true })
      );
      expect(perms.isAdmin).toBe(true);
      expect(perms.isMember).toBe(true);
    });
  });

  describe("canRequestMembership", () => {
    it("true si pas admin, pas membre, pas en cours d'invitation", () => {
      const perms = calculateOrganizationPermissions(makeOrg());
      expect(perms.canRequestMembership).toBe(true);
    });

    it("false si déjà membre", () => {
      const perms = calculateOrganizationPermissions(makeOrg({ isMember: true }));
      expect(perms.canRequestMembership).toBe(false);
    });

    it("false si déjà admin", () => {
      const perms = calculateOrganizationPermissions(makeOrg({ isAdmin: true }));
      expect(perms.canRequestMembership).toBe(false);
    });

    it("false si en attente de validation", () => {
      const perms = calculateOrganizationPermissions(makeOrg({ isToBeValidated: true }));
      expect(perms.canRequestMembership).toBe(false);
    });
  });

  describe("canFollow", () => {
    it("true si pas admin", () => {
      expect(calculateOrganizationPermissions(makeOrg()).canFollow).toBe(true);
    });

    it("false si admin", () => {
      expect(calculateOrganizationPermissions(makeOrg({ isAdmin: true })).canFollow).toBe(false);
    });
  });

  describe("canAdd*", () => {
    it("admin peut ajouter projet/event/poi (mais pas organization)", () => {
      const perms = calculateOrganizationPermissions(makeOrg({ isAdmin: true }));
      expect(perms.canAddProject).toBe(true);
      expect(perms.canAddEvent).toBe(true);
      expect(perms.canAddPoi).toBe(true);
      expect(perms.canAddOrganization).toBe(false);
    });

    it("non-admin ne peut rien ajouter", () => {
      const perms = calculateOrganizationPermissions(makeOrg());
      expect(perms.canAddProject).toBe(false);
      expect(perms.canAddEvent).toBe(false);
      expect(perms.canAddPoi).toBe(false);
    });
  });

  describe("canRequestPromotion", () => {
    it("true si membre simple (pas admin)", () => {
      const perms = calculateOrganizationPermissions(
        makeOrg({ isMember: true, isAdmin: false })
      );
      expect(perms.canRequestPromotion).toBe(true);
    });

    it("false si déjà admin", () => {
      const perms = calculateOrganizationPermissions(
        makeOrg({ isMember: true, isAdmin: true })
      );
      expect(perms.canRequestPromotion).toBe(false);
    });
  });
});

// ── Project ──
describe("calculateProjectPermissions", () => {
  it("canEditProfile true si admin du projet", () => {
    const perms = calculateProjectPermissions(makeProject({ isAdmin: true }));
    expect(perms.canEditProfile).toBe(true);
  });

  it("expose isAdmin et isContributor", () => {
    const perms = calculateProjectPermissions(
      makeProject({ isAdmin: false, isContributor: true })
    );
    expect(perms.isAdmin).toBe(false);
    expect(perms.isContributor).toBe(true);
  });

  it("canRequestContributor true si ni admin ni contributor", () => {
    const perms = calculateProjectPermissions(makeProject());
    expect(perms.canRequestContributor).toBe(true);
  });

  it("canFollow false si déjà admin ou contributor", () => {
    expect(calculateProjectPermissions(makeProject({ isAdmin: true })).canFollow).toBe(false);
    expect(calculateProjectPermissions(makeProject({ isContributor: true })).canFollow).toBe(
      false
    );
  });

  it("admin peut ajouter event et poi (pas project ni org)", () => {
    const perms = calculateProjectPermissions(makeProject({ isAdmin: true }));
    expect(perms.canAddEvent).toBe(true);
    expect(perms.canAddPoi).toBe(true);
    expect(perms.canAddProject).toBe(false);
    expect(perms.canAddOrganization).toBe(false);
  });
});

// ── Event ──
describe("calculateEventPermissions", () => {
  it("canEditProfile true si admin ou author", () => {
    expect(calculateEventPermissions(makeEvent({ isAdmin: true })).canEditProfile).toBe(true);
    expect(calculateEventPermissions(makeEvent({ isAuthor: true })).canEditProfile).toBe(true);
  });

  it("canEditProfile false sinon (avec reason)", () => {
    const perms = calculateEventPermissions(makeEvent());
    expect(perms.canEditProfile).toBe(false);
    expect(perms.editProfileReason).toBe("Must be author of event");
  });

  it("canParticipate true si pas déjà participant", () => {
    expect(calculateEventPermissions(makeEvent({ isAttendee: false })).canParticipate).toBe(true);
    expect(calculateEventPermissions(makeEvent({ isAttendee: true })).canParticipate).toBe(false);
  });

  it("isParticipant reflète isAttendee", () => {
    expect(calculateEventPermissions(makeEvent({ isAttendee: true })).isParticipant).toBe(true);
  });

  it("aucune création d'entité enfant possible sur event", () => {
    const perms = calculateEventPermissions(makeEvent({ isAuthor: true }));
    expect(perms.canAddOrganization).toBe(false);
    expect(perms.canAddProject).toBe(false);
    expect(perms.canAddEvent).toBe(false);
    expect(perms.canAddPoi).toBe(false);
  });
});

// ── POI ──
describe("calculatePoiPermissions", () => {
  it("canEditProfile true si author", () => {
    expect(calculatePoiPermissions(makePoi({ isAuthor: true })).canEditProfile).toBe(true);
  });

  it("canEditProfile false sinon", () => {
    const perms = calculatePoiPermissions(makePoi());
    expect(perms.canEditProfile).toBe(false);
    expect(perms.editProfileReason).toBe("Must be author of POI");
  });

  it("canFollow true si pas author", () => {
    expect(calculatePoiPermissions(makePoi({ isAuthor: false })).canFollow).toBe(true);
    expect(calculatePoiPermissions(makePoi({ isAuthor: true })).canFollow).toBe(false);
  });

  it("aucune création d'entité enfant", () => {
    const perms = calculatePoiPermissions(makePoi({ isAuthor: true }));
    expect(perms.canAddOrganization).toBe(false);
    expect(perms.canAddProject).toBe(false);
    expect(perms.canAddEvent).toBe(false);
    expect(perms.canAddPoi).toBe(false);
  });
});

// ── User ──
describe("calculateOwnProfilePermissions", () => {
  it("canEditProfile = true (propre profil)", () => {
    expect(calculateOwnProfilePermissions().canEditProfile).toBe(true);
  });

  it("canFollow = false (ne peut pas se suivre soi-même)", () => {
    expect(calculateOwnProfilePermissions().canFollow).toBe(false);
  });

  it("canSendFriendRequest = false", () => {
    expect(calculateOwnProfilePermissions().canSendFriendRequest).toBe(false);
  });

  it("peut créer toutes les entités depuis son propre profil", () => {
    const perms = calculateOwnProfilePermissions();
    expect(perms.canAddOrganization).toBe(true);
    expect(perms.canAddProject).toBe(true);
    expect(perms.canAddEvent).toBe(true);
    expect(perms.canAddPoi).toBe(true);
  });
});

describe("calculateOtherUserPermissions", () => {
  it("canEditProfile false (avec reason)", () => {
    const perms = calculateOtherUserPermissions(makeUser());
    expect(perms.canEditProfile).toBe(false);
    expect(perms.editProfileReason).toBe("Can only edit own profile");
  });

  it("canFollow true", () => {
    expect(calculateOtherUserPermissions(makeUser()).canFollow).toBe(true);
  });

  it("isFollowing reflète l'état", () => {
    expect(calculateOtherUserPermissions(makeUser({ isFollowing: true })).isFollowing).toBe(true);
  });

  it("canSendFriendRequest true si pas friend ni demande pending", () => {
    expect(calculateOtherUserPermissions(makeUser()).canSendFriendRequest).toBe(true);
  });

  it("canSendFriendRequest false si déjà friend", () => {
    expect(
      calculateOtherUserPermissions(makeUser({ isFriend: true })).canSendFriendRequest
    ).toBe(false);
  });

  it("canSendFriendRequest false si demande envoyée pending", () => {
    expect(
      calculateOtherUserPermissions(makeUser({ isInvitingFriend: true })).canSendFriendRequest
    ).toBe(false);
  });

  it("canSendFriendRequest false si demande reçue pending", () => {
    expect(
      calculateOtherUserPermissions(makeUser({ isToBeValidatedFriend: true }))
        .canSendFriendRequest
    ).toBe(false);
  });

  it("hasSentFriendRequest / hasReceivedFriendRequest reflètent l'état", () => {
    const perms = calculateOtherUserPermissions(makeUser({ isInvitingFriend: true }));
    expect(perms.hasSentFriendRequest).toBe(true);
    expect(perms.hasReceivedFriendRequest).toBe(false);
  });

  it("ne peut créer aucune entité sur le profil d'un autre", () => {
    const perms = calculateOtherUserPermissions(makeUser());
    expect(perms.canAddOrganization).toBe(false);
    expect(perms.canAddProject).toBe(false);
    expect(perms.canAddEvent).toBe(false);
    expect(perms.canAddPoi).toBe(false);
  });
});
