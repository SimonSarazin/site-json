import { describe, expect, it } from "vitest";
import config from "../../config.prod.tierslieuxbelgique.json";
import { buildProfileFieldRows } from "@/modules/profil/lib/profileFields";

describe("profil de personne tierslieuxbelgique", () => {
  const sections = config.profiles.citoyens.sections;

  it("conserve les sections du profil par défaut et ajoute les compétences", () => {
    expect(sections.map((section) => section.type)).toEqual([
      "profile-header",
      "profile-info",
      "profile-about",
      "profile-fields",
      "profile-organizer",
    ]);
  });

  it("affiche les compétences présentes et omet le champ vide", () => {
    const section = sections.find((item) => item.type === "profile-fields");
    expect(section?.fields).toEqual([{ field: "skills", label: { fr: "Compétences" } }]);
    const fields = section?.fields ?? [];
    expect(buildProfileFieldRows({ skills: ["Leadership", "Animation"] }, fields)[0].tokens)
      .toEqual(["Leadership", "Animation"]);
    expect(buildProfileFieldRows({}, fields)).toEqual([]);
  });
});
