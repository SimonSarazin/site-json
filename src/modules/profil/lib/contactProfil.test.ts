import { describe, it, expect } from "vitest";
import { contactsDuProfil, lignesContactEquipe, ligneAdresse } from "./contactProfil";

describe("contactsDuProfil", () => {
  it("lit le courriel et le téléphone quand `telephone` est une chaîne", () => {
    expect(contactsDuProfil({ email: "a@b.fr", telephone: "07 88 15 57 38" })).toEqual({
      email: "a@b.fr",
      telephone: "07 88 15 57 38",
      adresse: null,
    });
  });

  it("aplatit l'objet `{ mobile, fixe }` — un objet ferait planter le rendu React", () => {
    expect(
      contactsDuProfil({ telephone: { mobile: ["07 88 15 57 38"], fixe: ["03 21 98 19 98"] } }).telephone,
    ).toBe("07 88 15 57 38 · 03 21 98 19 98");
  });

  it("accepte une chaîne seule là où le contrat annonce un tableau", () => {
    expect(contactsDuProfil({ telephone: { fixe: "03 21 98 19 98" } }).telephone).toBe("03 21 98 19 98");
  });

  it("retombe sur le `mobile` plat des fiches anciennes", () => {
    expect(contactsDuProfil({ mobile: "06 11 21 40 75" }).telephone).toBe("06 11 21 40 75");
  });

  it("ignore le vide plutôt que d'afficher une ligne creuse", () => {
    const vide = { email: null, telephone: null, adresse: null };
    expect(contactsDuProfil({ email: "   ", telephone: { mobile: [], fixe: [] } })).toEqual(vide);
    expect(contactsDuProfil(undefined)).toEqual(vide);
    expect(contactsDuProfil({})).toEqual(vide);
  });

  it("ignore les entrées non textuelles d'une liste de numéros", () => {
    expect(contactsDuProfil({ telephone: { mobile: [null, 42, "07 88 15 57 38"] } }).telephone).toBe(
      "07 88 15 57 38",
    );
  });
});

describe("lignesContactEquipe", () => {
  const contacts = { email: "audomarois@parent62.org", telephone: "07 88 15 57 38 · 03 21 98 19 98" };

  it("retire la ligne que la fiche de la personne affiche déjà", () => {
    const texte = "audomarois@parent62.org\n07 88 15 57 38 · 03 21 98 19 98\nCentre Social, rue Brueghel";
    expect(lignesContactEquipe(texte, contacts)).toEqual(["Centre Social, rue Brueghel"]);
  });

  it("ignore casse, espaces et ponctuation pour comparer", () => {
    expect(lignesContactEquipe("0788155738·0321981998", contacts)).toEqual([]);
    expect(lignesContactEquipe("  AUDOMAROIS@PARENT62.ORG  ", contacts)).toEqual([]);
  });

  it("garde une ligne seulement PROCHE — elle porte sa propre information", () => {
    const proche = "Centre Social Inter-Générations, rue Brueghel, Longuenesse";
    expect(lignesContactEquipe(proche, { email: null, telephone: null })).toEqual([proche]);
  });

  it("ne rend rien sans texte, et laisse tout passer sans contact connu", () => {
    expect(lignesContactEquipe(undefined, contacts)).toEqual([]);
    expect(lignesContactEquipe("a\n\n b ", { email: null, telephone: null })).toEqual(["a", "b"]);
  });
});

describe("ligneAdresse", () => {
  it("assemble rue, code postal et commune", () => {
    expect(
      ligneAdresse({ streetAddress: "Rue Brueghel", postalCode: "62219", addressLocality: "Longuenesse" }),
    ).toBe("Rue Brueghel, 62219, Longuenesse");
  });

  it("saute les champs absents ou vides au lieu de laisser des séparateurs orphelins", () => {
    expect(ligneAdresse({ postalCode: "62219", addressLocality: "Longuenesse" })).toBe("62219, Longuenesse");
    expect(ligneAdresse({ streetAddress: "  ", addressLocality: "Arras" })).toBe("Arras");
  });

  it("accepte un autre séparateur — c'est ce qui permettra d'aligner les cartes du parc", () => {
    expect(ligneAdresse({ postalCode: "62219", addressLocality: "Longuenesse" }, " ")).toBe("62219 Longuenesse");
  });

  it("rend null quand il n'y a pas d'adresse, plutôt qu'une chaîne vide à tester partout", () => {
    expect(ligneAdresse(undefined)).toBeNull();
    expect(ligneAdresse({})).toBeNull();
    expect(ligneAdresse("pas un objet")).toBeNull();
    expect(ligneAdresse({ streetAddress: 42 })).toBeNull();
  });
});

describe("contactsDuProfil — adresse", () => {
  it("rend l'adresse formatée avec les autres contacts", () => {
    expect(
      contactsDuProfil({ email: "a@b.fr", address: { postalCode: "62219", addressLocality: "Longuenesse" } }),
    ).toEqual({ email: "a@b.fr", telephone: null, adresse: "62219, Longuenesse" });
  });
});
