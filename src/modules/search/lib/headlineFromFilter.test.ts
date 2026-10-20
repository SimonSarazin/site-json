import { describe, expect, it } from "vitest";

import { optionsDuTitre } from "./headlineFromFilter";

/**
 * Ce que ces cas protègent : le titre d'une page `/theme?theme=…` est la première chose lue, et il est
 * calculé à partir d'une sélection venue de l'URL — donc d'une source que personne ne valide. Les deux
 * pièges sont l'ORDRE (un titre qui change selon l'ordre des clics) et l'id PÉRIMÉ (un lien partagé
 * après qu'une liste dynamique a bougé), qui ne doivent jamais produire un titre incohérent ou brut.
 */

const filtres = [
  {
    id: "theme",
    options: [
      { id: "la-petite-enfance", label: { fr: "La petite enfance" } },
      { id: "les-ecrans", label: { fr: "Les écrans" } },
      { id: "les-emotions", label: { fr: "Les émotions" } },
    ],
  },
  { id: "public", options: [{ id: "parents", label: { fr: "Parents" } }] },
];

/** `selection` simulée — c'est le composant qui fournit la vraie (lue dans le contexte PageFilters). */
const choisir = (ids: Record<string, string[]>) => (f: { id: string }) => ids[f.id] ?? [];

describe("optionsDuTitre", () => {
  it("rend l'option sélectionnée du filtre visé", () => {
    const out = optionsDuTitre(filtres, "theme", choisir({ theme: ["les-ecrans"] }));
    expect(out.map((o) => o.label)).toEqual([{ fr: "Les écrans" }]);
  });

  it("ORDRE DES OPTIONS, pas de la sélection — le titre ne dépend pas de l'ordre des clics", () => {
    const out = optionsDuTitre(filtres, "theme", choisir({ theme: ["les-emotions", "la-petite-enfance"] }));
    expect(out.map((o) => o.id)).toEqual(["la-petite-enfance", "les-emotions"]);
  });

  it("ne lit QUE le filtre visé — la sélection d'un autre filtre ne titre pas la page", () => {
    const out = optionsDuTitre(filtres, "theme", choisir({ public: ["parents"] }));
    expect(out).toEqual([]);
  });

  it("id périmé (lien partagé, liste dynamique qui a bougé) : ignoré, pas d'id brut au titre", () => {
    expect(optionsDuTitre(filtres, "theme", choisir({ theme: ["nexiste-plus"] }))).toEqual([]);
  });

  it("id périmé PARMI des valides : seules les valides titrent", () => {
    const out = optionsDuTitre(filtres, "theme", choisir({ theme: ["nexiste-plus", "les-ecrans"] }));
    expect(out.map((o) => o.id)).toEqual(["les-ecrans"]);
  });

  it("rien de sélectionné → `[]` (l'appelant garde le headline déclaré)", () => {
    expect(optionsDuTitre(filtres, "theme", choisir({}))).toEqual([]);
  });

  it("`headlineFromFilter` absent, filtre inconnu, ou filtre sans options → `[]`, jamais d'erreur", () => {
    expect(optionsDuTitre(filtres, undefined, choisir({ theme: ["les-ecrans"] }))).toEqual([]);
    expect(optionsDuTitre(filtres, "inconnu", choisir({ theme: ["les-ecrans"] }))).toEqual([]);
    expect(optionsDuTitre([{ id: "theme" }], "theme", choisir({ theme: ["x"] }))).toEqual([]);
    expect(optionsDuTitre(undefined, "theme", choisir({ theme: ["x"] }))).toEqual([]);
  });

  it("trouve un filtre MASQUÉ : c'est le cas d'usage d'origine (page scopée par un filtre non manipulable)", () => {
    const masque = [{ id: "theme", options: filtres[0].options }];
    const out = optionsDuTitre(masque, "theme", choisir({ theme: ["la-petite-enfance"] }));
    expect(out.map((o) => o.id)).toEqual(["la-petite-enfance"]);
  });
});
