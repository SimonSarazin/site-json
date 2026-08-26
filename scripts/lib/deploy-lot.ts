/**
 * Moteur de lot de `scripts/deploy.ts` : exécuter une action site par site,
 * séquentiellement, en encaissant les échecs.
 *
 * POURQUOI — trois commandes itéraient chacune à sa façon : `lock` tolérant
 * avec bilan, `push` fail-fast avec reprise, `env` mono-site. À ~6 minutes par
 * build, un échec transitoire du site 2/9 en fail-fast gâchait la session
 * entière ; le lot TOLÉRANT termine les autres et rend un bilan avec la
 * commande de reprise réduite aux seuls ratés. `failFast` reste disponible
 * pour les changements risqués — la reprise couvre alors ratés + non tentés.
 *
 * Fonction pure vis-à-vis de la sortie (log/err injectables) : testée dans
 * tests/preflight/deploy-lot.test.ts avec des actions factices.
 */

export interface ResultatSite {
  slug: string;
  ok: boolean;
  /** Message d'échec (absent si ok). */
  detail?: string;
}

export interface OptionsLot {
  /** Arrêt au premier échec ; les non-tentés rejoignent la reprise. */
  failFast: boolean;
  /** Reconstruit la commande à relancer pour les slugs restés en défaut. */
  reprise(slugs: string[]): string;
  log?: (m: string) => void;
  err?: (m: string) => void;
}

export interface BilanLot {
  /** Un résultat par site TENTÉ (en failFast, les suivants n'y figurent pas). */
  resultats: ResultatSite[];
  code: 0 | 1;
  /** Commande de reprise, présente dès qu'un site reste en défaut. */
  reprise?: string;
}

export async function executerParSite(
  slugs: string[],
  action: (slug: string, i: number, total: number) => Promise<void>,
  opts: OptionsLot,
): Promise<BilanLot> {
  const log = opts.log ?? console.log;
  const err = opts.err ?? console.error;
  const resultats: ResultatSite[] = [];
  let restants: string[] = [];

  for (const [idx, slug] of slugs.entries()) {
    log(`\n[${idx + 1}/${slugs.length}] ${slug}`);
    try {
      await action(slug, idx + 1, slugs.length);
      resultats.push({ slug, ok: true });
    } catch (e) {
      const detail = (e as Error).message;
      resultats.push({ slug, ok: false, detail });
      err(`  ✗ ${detail}`);
      if (opts.failFast) {
        restants = slugs.slice(idx + 1);
        break;
      }
    }
  }

  const echoues = resultats.filter((r) => !r.ok).map((r) => r.slug);
  const reussis = resultats.length - echoues.length;
  const aReprendre = [...echoues, ...restants];

  if (aReprendre.length === 0) {
    log(`\n✓ ${reussis}/${slugs.length} traité(s).`);
    return { resultats, code: 0 };
  }

  err(
    `\n${reussis}/${slugs.length} traité(s), ${echoues.length} échec(s)` +
      `${restants.length ? `, ${restants.length} non tenté(s)` : ""} : ${aReprendre.join(", ")}`,
  );
  const reprise = opts.reprise(aReprendre);
  err(`Reprendre :  ${reprise}`);
  return { resultats, code: 1, reprise };
}
