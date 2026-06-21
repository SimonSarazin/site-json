import { describe, it, expect } from "vitest";
import { DAYS } from "@/constants/DAYS";
import { buildProfileUpdateData } from "./editProfilePayload";

const FULL_ADDRESS = {
  addressCountry: "FR", addressLocality: "Paris", localityId: "city123",
  level1: "11", level1Name: "Île-de-France", codeInsee: "75056",
  postalCode: "75001", streetAddress: "1 rue X",
};
const EXPECTED_ADDRESS = {
  "@type": "PostalAddress", addressCountry: "FR", addressLocality: "Paris", localityId: "city123",
  level1: "11", level1Name: "Île-de-France", codeInsee: "75056", postalCode: "75001", streetAddress: "1 rue X",
};

describe("buildProfileUpdateData", () => {
  it("citoyens : desc/contact/birthDate/tags/address/social", () => {
    const out = buildProfileUpdateData("citoyens", {
      name: "Jean", slug: "jean", shortDescription: "court", description: "long",
      url: "https://x.fr", email: "a@b.fr", mobile: "06", fixe: "01", birthDate: "1990-01-01",
      tags: ["t1"], github: "https://gh/x", ...FULL_ADDRESS,
    });
    expect(out.name).toBe("Jean");
    expect(out.slug).toBe("jean");
    expect(out.mobile).toBe("06");
    expect(out.birthDate).toBe("1990-01-01");
    expect(out.tags).toEqual(["t1"]);
    expect(out.address).toEqual(EXPECTED_ADDRESS);
    expect(out.github).toBe("https://gh/x");
    expect(out.facebook).toBe(""); // social toujours complet (9 clés)
  });

  it("organizations : openingHours (7 entrées) + type + social", () => {
    const oh = [{ dayOfWeek: DAYS[0], hours: [{ opens: "08:00", closes: "18:00" }] }];
    const out = buildProfileUpdateData("organizations", {
      name: "Org", slug: "org", type: "NGO", tags: [], openingHours: oh, ...FULL_ADDRESS,
    });
    expect(out.type).toBe("NGO");
    expect(Array.isArray(out.openingHours)).toBe(true);
    expect((out.openingHours as unknown[]).length).toBe(DAYS.length);
    expect((out.openingHours as unknown[])[0]).toEqual(oh[0]);
    expect((out.openingHours as unknown[])[1]).toBe(""); // jour non renseigné
    expect(out).toHaveProperty("github");
    expect(out.tags).toBe(""); // [] → ""
  });

  it("projects : parent normalisé (name+type) + avancement", () => {
    const out = buildProfileUpdateData("projects", {
      name: "P", slug: "p", avancement: "idea",
      parent: { org1: { type: "organizations", name: "Org", extra: "drop" } },
    });
    expect(out.avancement).toBe("idea");
    expect(out.parent).toEqual({ org1: { name: "Org", type: "organizations" } });
  });

  it("events : startDate/endDate ISO + timeZone + organizer + parent", () => {
    const out = buildProfileUpdateData("events", {
      name: "E", slug: "e", type: "meeting", recurrency: false,
      startDate: "2030-01-01T10:00:00.000Z", endDate: "2030-01-01T12:00:00.000Z",
      timeZone: "Europe/Paris",
      organizer: { o1: { type: "organizations", name: "Org" } },
    });
    expect(out.type).toBe("meeting");
    expect(out.recurrency).toBe(false);
    expect(typeof out.startDate).toBe("string");
    expect(out.timeZone).toBe("Europe/Paris");
    expect(out.organizer).toEqual({ o1: { name: "Org", type: "organizations" } });
    expect(out.parent).toBe(""); // pas de parent → ""
  });

  it("poi : description + address, PAS de shortDescription ni social", () => {
    const out = buildProfileUpdateData("poi", {
      name: "Poi", slug: "poi", type: "place", description: "d", tags: ["x"], shortDescription: "ne doit pas passer",
    });
    expect(out.type).toBe("place");
    expect(out.description).toBe("d");
    expect(out).not.toHaveProperty("shortDescription");
    expect(out).not.toHaveProperty("github");
  });

  it("address vide si localityId manquant", () => {
    const out = buildProfileUpdateData("citoyens", { name: "x", slug: "x", addressCountry: "FR", addressLocality: "Paris" });
    expect(out.address).toBe("");
  });
});
