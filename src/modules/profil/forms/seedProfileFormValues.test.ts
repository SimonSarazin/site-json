import { describe, it, expect } from "vitest";
import { seedProfileFormValues } from "./editProfilePayload";

/**
 * Équivalence READ (S5) : `seedProfileFormValues` doit reproduire EXACTEMENT l'ancien mapping manuel de
 * `useProfileFormData` (extractAddressFields 14 / extractSocialFields 9 / dates / openingHours / public /
 * urls / parent / organizer). Valeurs attendues calculées depuis l'ancienne logique.
 */

const ADDRESS = {
  addressCountry: "FR", addressLocality: "Paris", localityId: "c1", postalCode: "75001", streetAddress: "1 rue X",
  level1: "11", level1Name: "IDF", codeInsee: "75056",
};
const ADDR_14 = {
  addressCountry: "FR", streetAddress: "1 rue X", postalCode: "75001", addressLocality: "Paris", localityId: "c1",
  level1: "11", level1Name: "IDF", level2: "", level2Name: "", level3: "", level3Name: "", level4: "", level4Name: "", codeInsee: "75056",
};
const SOCIAL_9 = {
  github: "https://gh", gitlab: "", facebook: "https://fb", twitter: "", instagram: "",
  diaspora: "", mastodon: "", telegram: "", signal: "",
};

describe("seedProfileFormValues (READ via pipeline)", () => {
  it("citoyens : objet complet (10 champs + 14 adresse + 9 social)", () => {
    const out = seedProfileFormValues("citoyens", { serverData: {
      name: "Jean", shortDescription: "court", description: "long", email: "a@b.fr", url: "https://x.fr",
      tags: ["t1"], slug: "jean", mobile: "06", fixe: "01", birthDate: "1990-01-01",
      address: ADDRESS, socialNetwork: { github: "https://gh", facebook: "https://fb" },
    } });
    expect(out).toEqual({
      name: "Jean", slug: "jean", shortDescription: "court", description: "long", url: "https://x.fr", email: "a@b.fr",
      mobile: "06", fixe: "01", birthDate: "1990-01-01", tags: ["t1"],
      ...ADDR_14, ...SOCIAL_9,
    });
  });

  it("citoyens vide : defaults (chaînes vides, tags [], adresse/social vides)", () => {
    const out = seedProfileFormValues("citoyens", { serverData: {} })!;
    expect(out.name).toBe("");
    expect(out.tags).toEqual([]);
    expect(out.birthDate).toBe("");
    expect(out.addressCountry).toBe("");
    expect(out.level4Name).toBe("");
    expect(out.facebook).toBe("");
  });

  it("organizations : type brut + openingHours formatées + social", () => {
    const oh = [{ dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "18:00" }] }];
    const out = seedProfileFormValues("organizations", { serverData: {
      name: "Org", slug: "org", type: "NGO", tags: ["x"], openingHours: oh, address: ADDRESS,
      socialNetwork: { facebook: "https://fb" },
    } })!;
    expect(out.type).toBe("NGO");
    expect(Array.isArray(out.openingHours)).toBe(true);
    expect((out.openingHours as unknown[]).length).toBeGreaterThan(0);
    expect(out.facebook).toBe("https://fb");
    expect(out.github).toBe("");
    expect(out.localityId).toBe("c1");
  });

  it("projects : parent brut conservé + avancement", () => {
    const parent = { p1: { type: "organizations", name: "Org" } };
    const out = seedProfileFormValues("projects", { serverData: {
      name: "P", slug: "p", avancement: "idea", parent,
    } })!;
    expect(out.avancement).toBe("idea");
    expect(out.parent).toEqual(parent);
    expect(out.github).toBe(""); // social présent (vide)
  });

  it("events : dates ISO, public, recurrency, organizer, PAS de social", () => {
    const out = seedProfileFormValues("events", { serverData: {
      name: "E", slug: "e", type: "meeting", recurrency: true, public: false,
      startDate: "2030-01-01T10:00:00.000Z", endDate: "2030-01-01T12:00:00.000Z", timeZone: "Europe/Paris",
      organizer: { o1: { type: "organizations", name: "Org" } }, address: ADDRESS,
    } })!;
    expect(out.type).toBe("meeting");
    expect(out.recurrency).toBe(true);
    expect(out.public).toBe(false);
    expect(out.startDate).toBe("2030-01-01T10:00:00.000Z");
    expect(out.endDate).toBe("2030-01-01T12:00:00.000Z");
    expect(out.timeZone).toBe("Europe/Paris");
    expect(out.organizer).toEqual({ o1: { type: "organizations", name: "Org" } });
    expect(out).not.toHaveProperty("github"); // event = pas de social
    expect(out.localityId).toBe("c1");
  });

  it("events vide : public=true par défaut, organizer={}, recurrency=false", () => {
    const out = seedProfileFormValues("events", { serverData: { name: "E", slug: "e" } })!;
    expect(out.public).toBe(true);
    expect(out.recurrency).toBe(false);
    expect(out.organizer).toEqual({});
    expect(out.startDate).toBe("");
  });

  it("poi : urls (readOnly) + description, PAS de shortDescription ni social", () => {
    const out = seedProfileFormValues("poi", { serverData: {
      name: "Poi", slug: "poi", type: "place", description: "d", tags: ["x"],
      urls: ["https://u"], address: ADDRESS,
    } })!;
    expect(out.type).toBe("place");
    expect(out.description).toBe("d");
    expect(out.urls).toEqual(["https://u"]);
    expect(out).not.toHaveProperty("shortDescription");
    expect(out).not.toHaveProperty("github");
    expect(out.localityId).toBe("c1");
  });

  it("type non géré → null", () => {
    expect(seedProfileFormValues("forms", { serverData: {} })).toBeNull();
  });
});
