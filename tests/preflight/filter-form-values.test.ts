import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Garde FILTRE ↔ FORMULAIRE : un filtre à options fixes, posé sur un champ qu'un formulaire costum du
 * même site saisit par une liste fermée (`enum`), ne doit proposer que des valeurs que ce formulaire
 * sait enregistrer. Une option hors liste ne ramène jamais rien — l'utilisateur la coche, la page se
 * vide, et rien ne dit pourquoi.
 *
 * Cas qui l'a fait naître : les villes de parent62, recopiées à la fois dans le champ `villes` du
 * formulaire d'actualité et dans le filtre « Villes » de /blog. Retoucher l'une sans l'autre
 * (orthographe, ville ajoutée d'un seul côté) casse le filtre en silence.
 *
 * Valeur envoyée par une option : `value ?? id` pour un `dropdownFilters` (`dropdownFilters.ts`),
 * `name || id` pour un groupe de la sidebar `filters` (`computeFiltersFromUrl.ts`). Les filtres à
 * options dynamiques (`optionsFrom`/`optionsKey`) sortent du gate : leurs valeurs viennent de la base.
 */

const RACINE = path.resolve(__dirname, "../..");

interface OptionLike {
  id?: string;
  value?: string;
  name?: string;
}
interface FiltreLike {
  id?: string;
  field?: string;
  options?: OptionLike[];
  optionsFrom?: unknown;
  optionsKey?: unknown;
}
interface ConfigLike {
  pages?: Array<{ path?: string }>;
  costumForms?: Record<string, { fields?: Record<string, { enum?: Array<{ value?: unknown }> }> }>;
}

/** Valeurs saisissables par champ, toutes listes fermées des formulaires du site confondues. */
function valeursDesFormulaires(config: ConfigLike): Map<string, Set<string>> {
  const parChamp = new Map<string, Set<string>>();
  for (const form of Object.values(config.costumForms ?? {})) {
    for (const [champ, def] of Object.entries(form.fields ?? {})) {
      if (!Array.isArray(def?.enum)) continue;
      const set = parChamp.get(champ) ?? new Set<string>();
      for (const e of def.enum) if (e?.value != null) set.add(String(e.value));
      parChamp.set(champ, set);
    }
  }
  return parChamp;
}

/** Options qu'aucun formulaire ne peut produire : `<page> <filtre> → <valeur>`. */
export function optionsHorsFormulaire(config: ConfigLike): string[] {
  const saisissables = valeursDesFormulaires(config);
  const ecarts: string[] = [];
  const verifier = (page: string, filtre: FiltreLike, valeurDe: (o: OptionLike) => string | undefined) => {
    const autorisees = filtre.field ? saisissables.get(filtre.field) : undefined;
    if (!autorisees || filtre.optionsFrom || filtre.optionsKey) return;
    for (const option of filtre.options ?? []) {
      const valeur = valeurDe(option);
      if (valeur != null && !autorisees.has(valeur)) ecarts.push(`${page} ${filtre.id ?? filtre.field} → ${valeur}`);
    }
  };
  const parcourir = (noeud: unknown, page: string) => {
    if (Array.isArray(noeud)) return noeud.forEach((n) => parcourir(n, page));
    if (!noeud || typeof noeud !== "object") return;
    const objet = noeud as Record<string, unknown>;
    for (const f of (objet.dropdownFilters as FiltreLike[] | undefined) ?? []) verifier(page, f, (o) => o.value ?? o.id);
    for (const f of (objet.filterGroups as FiltreLike[] | undefined) ?? []) verifier(page, f, (o) => o.name || o.id);
    for (const valeur of Object.values(objet)) parcourir(valeur, page);
  };
  for (const page of config.pages ?? []) parcourir(page, page.path ?? "?");
  return ecarts;
}

const CONFIGS = fs
  .readdirSync(RACINE)
  .filter((f) => /^config\.prod(\..+)?\.json$/.test(f))
  .map((f) => ({ nom: f, config: JSON.parse(fs.readFileSync(path.join(RACINE, f), "utf-8")) as ConfigLike }));

describe("filtres ↔ formulaires : un filtre ne propose que des valeurs saisissables", () => {
  it("détecte une option qu'aucun formulaire ne peut enregistrer", () => {
    const config: ConfigLike = {
      costumForms: { article: { fields: { villes: { enum: [{ value: "Arras" }, { value: "Achicourt" }] } } } },
      pages: [{ path: "/blog", sections: [{ props: { dropdownFilters: [
        { id: "ville", field: "villes", options: [{ id: "arras", value: "Arras" }, { id: "achicour", value: "Achicour" }] },
      ] } }] } as { path: string }],
    };
    expect(optionsHorsFormulaire(config)).toEqual(["/blog ville → Achicour"]);
  });

  for (const { nom, config } of CONFIGS) {
    it(nom, () => {
      expect(optionsHorsFormulaire(config)).toEqual([]);
    });
  }
});
