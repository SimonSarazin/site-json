/**
 * Parsing des PDF « Liste des communes » du WordPress parent62.org
 * (T0.5 — remplissage de `TERRITOIRES_62.communes`).
 *
 * Entrée : la sortie TEXTE de `pdftotext -layout <pdf>` (une extraction par
 * territoire). Format observé sur les 9 PDF officiels (octobre 2020) :
 *  - page 1 = page de titre (« TERRITOIRE / <NOM> ») → ignorée entièrement,
 *    sinon le nom du territoire serait pris pour une commune ;
 *  - pages suivantes = noms de communes répartis en colonnes à positions
 *    fixes, entrées séparées verticalement par des lignes vides ;
 *  - un nom trop long continue sur la ligne IMMÉDIATEMENT suivante de la même
 *    colonne (« BAILLEUL-SIRE- / BERTHOULT », « SAINT POL SUR / TERNOISE ») —
 *    c'est l'absence de ligne vide qui signe la continuation ;
 *  - selon le PDF, la casse est MAJUSCULES (accents souvent absents) ou
 *    Capitalisée (« Noyelles-godault ») → normalisation via formatCommuneName.
 *
 * Consommé par `scripts/import-communes-territoires62.ts` (one-shot). Les noms
 * sont restitués tels que publiés (espaces/apostrophes conservés — on ne
 * « corrige » pas vers les graphies INSEE pour ne rien inventer), seule la
 * casse est uniformisée.
 */

/** Fragment de texte d'une ligne : position de départ = colonne du PDF. */
interface Fragment {
  line: number;
  start: number;
  text: string;
}

/** Tolérance (en caractères) d'alignement d'un fragment sur sa colonne. */
const COLUMN_TOLERANCE = 4;

/** Lignes d'habillage des PDF (en-tête, pied de page, folio) à écarter. */
const NOISE_LINE = /Listes? des communes|Réseau Parentalité|^\s*TERRITOIRE\b|^\s*\d+\s*$/i;

/** Mots invariables des noms de communes, en minuscule sauf en tête de nom. */
const PARTICLES = new Set([
  "le", "la", "les", "lès", "au", "aux", "du", "de", "des",
  "en", "sur", "sous", "et", "à", "l", "d",
]);

/**
 * Uniformise la casse d'un nom de commune : chaque mot capitalisé, particules
 * en minuscule (sauf initiale). Les accents absents des PDF en MAJUSCULES ne
 * sont PAS restaurés (ce serait inventer la donnée) : « VILLERS L’HOPITAL » →
 * « Villers l’Hopital ».
 */
export function formatCommuneName(raw: string): string {
  const lower = raw.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");
  let wordIndex = 0;
  return lower.replace(/[^\s\-’']+/g, (word) => {
    const isFirst = wordIndex === 0;
    wordIndex += 1;
    if (!isFirst && PARTICLES.has(word)) return word;
    return word.charAt(0).toLocaleUpperCase("fr-FR") + word.slice(1);
  });
}

/** Découpe une ligne en fragments (séparés par ≥ 2 espaces), position incluse. */
function lineFragments(line: string, lineIndex: number): Fragment[] {
  const fragments: Fragment[] = [];
  const re = /\S+(?: \S+)*/g;
  for (let m = re.exec(line); m !== null; m = re.exec(line)) {
    fragments.push({ line: lineIndex, start: m.index, text: m[0] });
  }
  return fragments;
}

/** Rattache chaque fragment à une colonne (clusters de positions de départ). */
function groupByColumn(fragments: Fragment[]): Fragment[][] {
  const starts = [...new Set(fragments.map((f) => f.start))].sort((a, b) => a - b);
  const columns: number[] = [];
  for (const s of starts) {
    if (columns.length === 0 || s > columns[columns.length - 1] + COLUMN_TOLERANCE) {
      columns.push(s);
    }
  }
  const grouped: Fragment[][] = columns.map(() => []);
  for (const f of fragments) {
    // La colonne la plus proche ≤ start + tolérance (les continuations sont
    // parfois décalées d'un caractère).
    let idx = columns.findIndex((c) => Math.abs(f.start - c) <= COLUMN_TOLERANCE);
    if (idx === -1) idx = columns.filter((c) => c <= f.start).length - 1;
    grouped[Math.max(idx, 0)].push(f);
  }
  return grouped;
}

/**
 * Extrait la liste des communes d'une sortie `pdftotext -layout`, casse
 * uniformisée, dédupliquée et triée (ordre français).
 */
export function parseCommunesPdfText(text: string): string[] {
  // Page 1 = page de titre sur les 9 PDF officiels — jamais de communes.
  const dataPages = text.split("\f").slice(1);
  const entries: string[] = [];

  for (const page of dataPages) {
    const fragments = page
      .split("\n")
      .flatMap((line, i) => (NOISE_LINE.test(line) ? [] : lineFragments(line, i)));

    for (const column of groupByColumn(fragments)) {
      let previousLine = Number.NEGATIVE_INFINITY;
      for (const fragment of column) {
        if (fragment.line === previousLine + 1 && entries.length > 0) {
          // Ligne consécutive = suite du nom précédent (les entrées distinctes
          // sont toujours séparées par au moins une ligne vide).
          const prev = entries[entries.length - 1];
          entries[entries.length - 1] = prev.endsWith("-")
            ? prev + fragment.text
            : `${prev} ${fragment.text}`;
        } else {
          entries.push(fragment.text);
        }
        previousLine = fragment.line;
      }
    }
  }

  const formatted = entries
    // Le PDF Artois est une liste numérotée (« 12. Lillers ») — on retire
    // l'énumération, qui n'appartient pas au nom de la commune.
    .map((entry) => entry.replace(/^\d+\s*[.)]\s*/, ""))
    .map(formatCommuneName)
    .filter((name) => name.length > 0);
  return [...new Set(formatted)].sort((a, b) => a.localeCompare(b, "fr"));
}
