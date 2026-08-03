import { describe, expect, it } from "vitest";
import { buildProfileFieldRows, fieldHref } from "./profileFields";
import type { ProfileField } from "../schema";

const F = (field: string, format?: ProfileField["format"]): ProfileField => ({ field, format });

describe("buildProfileFieldRows", () => {
  it("écarte les champs absents, vides ou de type non affichable", () => {
    const rows = buildProfileFieldRows(
      { acronym: "IB", siret: "", codeNaf: null, meta: { nested: undefined } },
      [F("acronym"), F("siret"), F("codeNaf"), F("absent"), F("meta.nested")],
    );
    expect(rows.map((r) => r.field.field)).toEqual(["acronym"]);
    expect(rows[0].tokens).toEqual(["IB"]);
  });

  it("résout les dot-paths et normalise tableaux et chaînes multi-valeurs", () => {
    const rows = buildProfileFieldRows(
      {
        categoryThematic: ["Pêche et produits de la mer", "Tourisme bleu"],
        tags: "Plongée, Voile",
        address: { addressLocality: "LE PORT" },
      },
      [F("categoryThematic"), F("tags"), F("address.addressLocality")],
    );
    expect(rows[0].tokens).toEqual(["Pêche et produits de la mer", "Tourisme bleu"]);
    expect(rows[1].tokens).toEqual(["Plongée", "Voile"]);
    expect(rows[2].tokens).toEqual(["LE PORT"]);
  });

  it("format socialLinks : garde les entrées avec lien, étiquette par le type", () => {
    const rows = buildProfileFieldRows(
      {
        otherSociaNetworks: [
          { type: "Lien vers le profil LinkedIn", link: "https://linkedin.com/company/ib" },
          { type: "Lien vers le profil Facebook", link: "" },
          { type: "", link: "https://instagram.com/ib" },
          "bruit",
        ],
      },
      [F("otherSociaNetworks", "socialLinks")],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tokens).toEqual(["https://linkedin.com/company/ib", "https://instagram.com/ib"]);
    expect(rows[0].labels).toEqual(["Lien vers le profil LinkedIn", "https://instagram.com/ib"]);
  });

  it("socialLinks : aplatit les entrées où type ET link sont des tableaux parallèles", () => {
    // Donnée réelle (acteur « Duocean WOS ») : saisie legacy non normalisée.
    const rows = buildProfileFieldRows(
      {
        otherSociaNetworks: [
          { type: "Facebook", link: "https://www.facebook.com/duocean" },
          {
            type: ["Instagram", "TikTok"],
            link: ["https://www.instagram.com/duocean", "tiktok.com/@duocean"],
          },
        ],
      },
      [F("otherSociaNetworks", "socialLinks")],
    );
    expect(rows[0].tokens).toEqual([
      "https://www.facebook.com/duocean",
      "https://www.instagram.com/duocean",
      "tiktok.com/@duocean",
    ]);
    expect(rows[0].labels).toEqual(["Facebook", "Instagram", "TikTok"]);
  });

  it("socialLinks sans aucun lien exploitable → aucune ligne", () => {
    const rows = buildProfileFieldRows(
      { otherSociaNetworks: [{ type: "Facebook", link: "" }] },
      [F("otherSociaNetworks", "socialLinks")],
    );
    expect(rows).toEqual([]);
  });

  it("serverData absent → aucune ligne (pas de throw)", () => {
    expect(buildProfileFieldRows(undefined, [F("name")])).toEqual([]);
  });
});

describe("fieldHref", () => {
  it("construit les href par format", () => {
    expect(fieldHref("email", "contact@institutbleu.re")).toBe("mailto:contact@institutbleu.re");
    expect(fieldHref("tel", "02 62 00 00 00")).toBe("tel:0262000000");
    expect(fieldHref("link", "institutbleu.re")).toBe("https://institutbleu.re");
    expect(fieldHref("link", "https://institutbleu.re")).toBe("https://institutbleu.re");
    expect(fieldHref("text", "IB")).toBeUndefined();
    expect(fieldHref(undefined, "IB")).toBeUndefined();
  });
});
