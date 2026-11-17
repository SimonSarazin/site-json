import { describe, expect, it } from "vitest";

import { scopeAgendaToProfile, type AgendaLikeSection } from "./scopeAgendaToProfile";

const OR = {
  $or: {
    "links.attendees.abc": { $exists: true },
    "organizer.abc": { $exists: true },
  },
};

describe("scopeAgendaToProfile", () => {
  it("ajoute le filtre organisateur/participant de l'entité, en gardant les filtres de config", () => {
    const out = scopeAgendaToProfile(
      { type: "agenda", props: { scopeToProfile: true, baseParams: { sourceKey: ["x"], filters: { tags: { $in: ["a"] } } } } },
      "abc",
    );
    expect(out.props?.baseParams).toEqual({ sourceKey: ["x"], filters: { tags: { $in: ["a"] }, ...OR } });
  });

  it("compose un $or déjà présent en config au lieu de l'écraser", () => {
    const out = scopeAgendaToProfile(
      { type: "agenda", props: { scopeToProfile: true, baseParams: { filters: { $or: { tags: { $in: ["a"] } } } } } },
      "abc",
    );
    expect(out.props?.baseParams?.filters).toEqual({
      $or: {
        $and: [
          { $or: [{ tags: { $in: ["a"] } }] },
          { $or: [{ "links.attendees.abc": { $exists: true } }, { "organizer.abc": { $exists: true } }] },
        ],
      },
    });
  });

  it("crée baseParams.filters s'il n'y en a pas", () => {
    const section: AgendaLikeSection = { type: "agenda", props: { scopeToProfile: true } };
    const out = scopeAgendaToProfile(section, "abc");
    expect(out.props?.baseParams?.filters).toEqual(OR);
  });

  it("ne touche à rien sans l'option (opt-in)", () => {
    const section = { type: "agenda", props: { baseParams: { filters: { tags: 1 } } } };
    expect(scopeAgendaToProfile(section, "abc")).toBe(section);
  });

  it("ne touche pas les autres types de section", () => {
    const section = { type: "news", props: { scopeToProfile: true } };
    expect(scopeAgendaToProfile(section, "abc")).toBe(section);
  });
});
