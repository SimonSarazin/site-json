import { describe, it, expect } from "vitest";
import {
  extractCommunId,
  isCommunLink,
  replaceCommunId,
  templateYieldsCommunId,
} from "./communLink";

/**
 * Les cas d'extraction sont ceux de la sonde PHP de
 * `ToolsCatalogListAction::extractCommunId` : ce fichier n'a de valeur que si les
 * deux côtés reconnaissent EXACTEMENT les mêmes formes. Les liens « réels » sont
 * relevés en base (`navigatorcriteria`), pas inventés.
 */

const ID = "6a33be10fbb6f52b76632076";
const AUTRE = "67d00cc8f0ce2514cc1b3ec7";

describe("extractCommunId — les deux formes écrites en base", () => {
  it.each([
    ["ancre legacy absolue", `https://communs.les-cae.coop/#detail-un-commun.communId.${AUTRE}`, AUTRE],
    ["ancre legacy sans schéma (Peertube)", `lescommuns.tiers-lieux.org#detail-un-commun.communId.${AUTRE}`, AUTRE],
    ["route site-json relative", `/aac/commun/${ID}`, ID],
    ["route site-json absolue", `https://cae.example.org/aac/commun/${ID}`, ID],
    ["route + query", `https://cae.example.org/aac/commun/${ID}?from=catalogue`, ID],
    ["route + fragment", `https://cae.example.org/aac/commun/${ID}#postes`, ID],
    ["route nue", `commun/${ID}`, ID],
  ])("lit %s", (_quoi, url, attendu) => {
    expect(extractCommunId(url)).toBe(attendu);
  });

  it("normalise la casse de l'identifiant", () => {
    expect(extractCommunId(`/aac/commun/${ID.toUpperCase()}`)).toBe(ID);
  });

  it("préfère l'ancre à la route quand un lien porte les deux", () => {
    // L'ancre a été écrite en connaissance du domaine cible ; même ordre côté PHP.
    expect(extractCommunId(`https://x.org/aac/commun/${ID}#detail-un-commun.communId.${AUTRE}`)).toBe(AUTRE);
  });
});

describe("extractCommunId — ce qui n'est PAS un lien de commun", () => {
  it.each([
    ["une page quelconque de l'outil (Rustine Libre)", "https://rustinelibre.fr/notre-collectif"],
    ["la chaîne vide", ""],
    ["null", null],
    ["undefined", undefined],
    // Un `[0-9a-f]{24}` isolé ne suffit pas : c'est le libellé `commun/` qui porte
    // l'intention, sinon toute URL portant un id Mongo deviendrait un lien de commun.
    ["une image portant un id Mongo", `https://x.org/img/${ID}.png`],
    ["un segment qui se TERMINE par commun", `https://x.org/moncommun/${ID}`],
    ["un identifiant trop long", `https://x.org/commun/${ID}1234`],
    ["un segment non hexadécimal", "https://x.org/commun/notanid"],
  ])("refuse %s", (_quoi, url) => {
    expect(extractCommunId(url as string | null | undefined)).toBe("");
    expect(isCommunLink(url as string | null | undefined)).toBe(false);
  });
});

describe("replaceCommunId — repointer sans perdre la forme ni le domaine", () => {
  it("garde le domaine du costum sur une ancre legacy", () => {
    // C'est ce qui permet de rattacher un autre commun à un outil enrichi ailleurs,
    // sans connaître le site d'origine.
    expect(replaceCommunId(`https://communs.les-cae.coop/#detail-un-commun.communId.${AUTRE}`, ID)).toBe(
      `https://communs.les-cae.coop/#detail-un-commun.communId.${ID}`,
    );
  });

  it("garde le préfixe de route ET la query sur une route site-json", () => {
    expect(replaceCommunId(`https://cae.example.org/aac/commun/${AUTRE}?from=catalogue`, ID)).toBe(
      `https://cae.example.org/aac/commun/${ID}?from=catalogue`,
    );
  });

  it("rend null sur un lien qui n'en est pas un — à l'appelant de décider", () => {
    // Écrire "" ici effacerait un lien légitime au moment même où l'admin rattache
    // un commun ; c'est pourquoi on distingue « pas de forme » de « lien vide ».
    expect(replaceCommunId("https://rustinelibre.fr/notre-collectif", ID)).toBeNull();
  });
});

describe("templateYieldsCommunId — le gabarit est-il relisible par le serveur ?", () => {
  it.each([
    ["route site-json", "/aac/commun/{communId}", true],
    ["ancre legacy", "https://communs.les-cae.coop/#detail-un-commun.communId.{communId}", true],
    ["route absolue", "https://cae.example.org/aac/commun/{communId}", true],
  ])("accepte %s", (_quoi, tpl, attendu) => {
    expect(templateYieldsCommunId(tpl)).toBe(attendu);
  });

  it.each([
    ["un gabarit sans marqueur", "/aac/commun/"],
    ["un gabarit qui oublie le segment", "/aac/{communId}"],
    ["une URL quelconque", "https://rustinelibre.fr/notre-collectif"],
    // L'URL d'une VRAIE fiche copiée-collée à la place du gabarit : elle « rend »
    // bien une communId, mais toujours la même — chaque outil rattaché pointerait
    // ce commun-là, quel que soit celui choisi, sans la moindre erreur.
    ["un gabarit à communId en dur (route)", `/aac/commun/${ID}`],
    ["un gabarit à communId en dur (ancre legacy)", `https://communs.les-cae.coop/#detail-un-commun.communId.${ID}`],
    // Le marqueur est là, mais ce n'est pas lui que le serveur lit.
    ["un marqueur derrière une communId en dur", `/aac/commun/${ID}/{communId}`],
    ["une ancre en dur qui l'emporte sur le marqueur de route", `https://x.org/aac/commun/{communId}#detail-un-commun.communId.${ID}`],
  ])("rejette %s", (_quoi, tpl) => {
    expect(templateYieldsCommunId(tpl)).toBe(false);
  });

  it("le marqueur substitué est bien celui que le serveur relit (pas seulement « une » communId)", () => {
    // Même substitution que `ToolEditDialog` : `replace("{communId}", id)`.
    const tpl = "/aac/commun/{communId}";
    expect(extractCommunId(tpl.replace("{communId}", ID))).toBe(ID);
    expect(extractCommunId(tpl.replace("{communId}", AUTRE))).toBe(AUTRE);
  });
});
