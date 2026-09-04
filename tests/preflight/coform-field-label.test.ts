import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression — le libellé d'une question coform passe par `FieldLabel`.
 *
 * `FieldLabel` (`src/modules/coform/components/FormFields.tsx`) est le POINT
 * UNIQUE de rendu du libellé d'une question EN MODE SAISIE : hiérarchie
 * visuelle (`text-base font-semibold` face au `text-sm` du contenu), passage en
 * rouge sur `hasError`, `<label for>` ou `<div>` selon qu'il existe une cible
 * focusable, et surtout l'annonce « obligatoire » aux lecteurs d'écran —
 * l'astérisque seule s'annonce « étoile ».
 *
 * Avant lui, chaque champ recopiait ce bloc à la main :
 *     <Label className="text-sm font-medium text-foreground">
 *       {field.label}
 *       {field.isRequired && <span className="text-destructive ml-1">*</span>}
 *     </Label>
 *
 * Ce test existe parce que la copie est REVENUE : le merge `main` → `jdev`
 * (f2f92ae2) a apporté deux champs neufs (`TimeSlotsField`,
 * `DynamicFieldsField`) écrits sur une branche où `FieldLabel` n'existait pas.
 * Typecheck, lint et les 384 tests du module étaient verts — aucune barrière ne
 * voyait l'écart, visible seulement à l'œil sur un formulaire mixte. D'où ce
 * garde-fou mécanique : la prochaine branche qui ignore la convention échoue
 * ici, pas en production.
 *
 * ⚠️ Portée et limites, à connaître avant de s'y fier :
 * - Il raisonne sur le TEXTE SOURCE. Un libellé rendu via une variable
 *   intermédiaire ou depuis un sous-composant lui échappe. Le filet
 *   complémentaire est le test de RENDU dans `TimeSlotsField.test.tsx`, qui
 *   vérifie le DOM réellement produit.
 * - Il couvre le mode SAISIE. `CoFormReadOnly` a son propre rendu `<dt>`
 *   assumé (contexte liste de définition, pas formulaire) : il est exempté
 *   nommément ci-dessous.
 * - Un faux positif est possible si un jour un sous-libellé légitime est rendu
 *   sous une variable de boucle nommée `field`. Le cas échéant : l'ajouter aux
 *   exemptions AVEC sa raison, comme le fait `site-assets.test.ts`.
 */

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const COFORM_DIR = path.join(PROJECT_ROOT, "src/modules/coform");

/**
 * Fichiers autorisés à rendre `field.label` sans `FieldLabel`, avec la raison.
 * N'y ajouter un fichier que si son rendu N'EST PAS le libellé d'une question
 * en mode saisie.
 */
const EXEMPTIONS: Record<string, string> = {
  "src/modules/coform/components/CoFormReadOnly.tsx":
    "mode lecture : libellés rendus en <dt> d'une liste de définition, registre visuel distinct et assumé",
  "src/modules/coform/components/DynamicCoForm.tsx":
    "fallback « type de champ inconnu » (bloc d'erreur), pas un libellé de question",
  "src/modules/coform/components/MultiStepCoForm.tsx":
    "fallback « type de champ inconnu » (bloc d'erreur), pas un libellé de question",
};

/**
 * Toute balise dont le contenu immédiat est le libellé du champ — `<Label>`,
 * `<label>`, `<span>`, `<p>`… La version d'origine de ce test n'ancrait que sur
 * `<Label`, ce qui laissait passer la forme `<label htmlFor=…>{label}</label>`
 * déjà présente dans `SimpleTableField.tsx`.
 *
 * Les titres de niveau `<h1>`-`<h6>` sont exclus : ils portent les champs
 * DÉCORATIFS du module (`sectionTitle` rend un `<h2>`, cf. `SectionTitleField`
 * dans `FormFields.tsx`), qui ne sont pas des questions — pas de valeur, pas
 * d'erreur, rien à nommer. Les exclure ici évite d'exempter `FormFields.tsx`
 * en entier, ce qui aurait aveuglé le test sur les champs `text`, `textarea`,
 * `select`, `radio` et `checkbox` qui vivent dans ce même fichier.
 */
const LIBELLE_INLINE = /<(?!h[1-6][\s>])(?:[A-Za-z][\w.]*)[^>]*>\s*\{\s*field\.label\s*[}?]/;

/** `import { …, FieldLabel, … } from "./FormFields"` — l'import réel, pas une mention. */
const IMPORTE_FIELDLABEL = /import\s*\{[^}]*\bFieldLabel\b[^}]*\}\s*from/;

/** Un JSDoc qui CITE le bloc proscrit n'est pas une violation. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walkSource(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSource(full, files);
    } else if (entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("Preflight — libellés de question coform", () => {
  const sources = walkSource(COFORM_DIR).map((full) => ({
    file: path.relative(PROJECT_ROOT, full),
    content: fs.readFileSync(full, "utf-8"),
  }));

  test("aucun composant ne rend le libellé de question hors `FieldLabel`", () => {
    const offenders = sources
      .filter(({ file }) => !(file in EXEMPTIONS))
      .filter(({ content }) => LIBELLE_INLINE.test(sansCommentaires(content)))
      .map(({ file }) => file);
    if (offenders.length > 0) {
      console.error(
        "\n❌ Libellé de question rendu hors `FieldLabel`. Fichiers à corriger :\n" +
          offenders.map((f) => `  - ${f}`).join("\n") +
          "\n\nRemplacer le bloc par :\n" +
          "  <FieldLabel field={field} id={labelId} hasError={hasError} />\n" +
          '(et nommer le contrôle composite via `role="group"` + `aria-labelledby={labelId}`).\n' +
          "Si ce rendu n'est PAS le libellé d'une question en mode saisie, l'ajouter\n" +
          "à EXEMPTIONS avec sa raison.\n",
      );
    }
    expect(offenders).toEqual([]);
  });

  test("tout composant `*Field.tsx` qui touche à `field.label` importe `FieldLabel`", () => {
    // Volontairement plus large que le rendu JSX : attrape aussi le libellé
    // passé par une variable intermédiaire ou à un sous-composant, que la
    // regex ci-dessus ne peut pas voir.
    //
    // On exige l'IMPORT, pas la simple présence de la chaîne : un fichier qui
    // ne fait que MENTIONNER `FieldLabel` dans un commentaire passerait au
    // travers — vérifié, c'est ainsi que la variante « variable intermédiaire »
    // échappait à ce test.
    const offenders = sources
      .filter(({ file }) => file.endsWith("Field.tsx") && !(file in EXEMPTIONS))
      .filter(({ content }) => /field\.label/.test(sansCommentaires(content)))
      .filter(({ content }) => !IMPORTE_FIELDLABEL.test(content))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  test("les exemptions désignent des fichiers qui existent encore", () => {
    // Une exemption qui survit à la suppression de son fichier masquerait
    // silencieusement un futur homonyme.
    const manquants = Object.keys(EXEMPTIONS).filter(
      (f) => !fs.existsSync(path.join(PROJECT_ROOT, f)),
    );
    expect(manquants).toEqual([]);
  });

  test("scanne effectivement le module en profondeur", () => {
    // Garde-fou : un chemin cassé ferait passer les tests ci-dessus à tort.
    expect(sources.length).toBeGreaterThan(20);
    expect(sources.filter(({ file }) => file.endsWith("Field.tsx")).length).toBeGreaterThan(8);
  });
});
