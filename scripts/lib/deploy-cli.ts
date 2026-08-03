/**
 * Analyse de la ligne de commande de `scripts/deploy.ts`.
 *
 * POURQUOI — l'extraction historique des positionnels,
 * `argv.filter(a => !a.startsWith("--"))`, prenait les VALEURS d'options pour
 * des slugs : `npm run deploy -- parent62 --timeout 300 --yes` produisait les
 * slugs `["parent62", "300"]` et sortait en erreur « Slug "300" absent de
 * sites.json ». Corriger exige de savoir quelles options consomment une valeur
 * — d'où les deux jeux déclarés ci-dessous. Toute option hors de ces jeux est
 * rendue dans `inconnues` : une faute de frappe (`--wirte`) doit arrêter la
 * commande, pas être ignorée en silence.
 *
 * ~30 lignes maison plutôt qu'une lib (commander/yargs) : le besoin est fermé,
 * la fonction est pure et testée (tests/preflight/deploy-cli.test.ts).
 */

/** Options qui consomment le token suivant comme valeur. */
export const OPTIONS_A_VALEUR: ReadonlySet<string> = new Set([
  "--context",
  "--ref",
  "--timeout",
  "--server",
  "--project",
  "--environment",
]);

/** Options-drapeaux, sans valeur. */
export const OPTIONS_BOOLEENNES: ReadonlySet<string> = new Set([
  "--json",
  "--yes",
  "--write",
  "--unlock",
  "--no-wait",
  "--all",
  "--affected",
  "--fail-fast",
]);

export interface LigneDeCommande {
  /** Premier positionnel : la sous-commande. */
  commande: string | undefined;
  /** Positionnels suivants (slugs, domaine…) — valeurs d'options SAUTÉES. */
  positionnels: string[];
  /** Options hors des deux jeux déclarés : l'appelant doit sortir en code 2. */
  inconnues: string[];
  bool(nom: string): boolean;
  valeur(nom: string): string | undefined;
}

export function analyserArgv(argv: string[]): LigneDeCommande {
  const positionnels: string[] = [];
  const inconnues: string[] = [];
  const bools = new Set<string>();
  const valeurs = new Map<string, string>();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positionnels.push(a);
      continue;
    }
    if (OPTIONS_BOOLEENNES.has(a)) {
      bools.add(a);
      continue;
    }
    if (OPTIONS_A_VALEUR.has(a)) {
      const suivant = argv[i + 1];
      // Option à valeur en fin de ligne ou suivie d'une autre option : on la
      // traite comme absente (`valeur()` → undefined, les appelants ont tous
      // un défaut) plutôt que de consommer un token qui n'est pas sa valeur.
      if (suivant !== undefined && !suivant.startsWith("--")) {
        valeurs.set(a, suivant);
        i++;
      }
      continue;
    }
    inconnues.push(a);
  }

  const commande = positionnels.shift();
  return {
    commande,
    positionnels,
    inconnues,
    bool: (nom) => bools.has(nom),
    valeur: (nom) => valeurs.get(nom),
  };
}
