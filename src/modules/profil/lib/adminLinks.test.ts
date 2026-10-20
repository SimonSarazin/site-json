import { describe, it, expect } from "vitest";

import { validatedAdminLinkFilters } from "./adminLinks";

describe("validatedAdminLinkFilters — admin VALIDÉ d'une organisation", () => {
  it("exige le lien et isAdmin, exclut l'attente, la validation et l'invitation", () => {
    expect(validatedAdminLinkFilters("u1")).toEqual({
      "links.members.u1": { $exists: true },
      "links.members.u1.isAdmin": true,
      "links.members.u1.isAdminPending": { $exists: false },
      "links.members.u1.toBeValidated": { $exists: false },
      "links.members.u1.isInviting": { $exists: false },
    });
  });
});
