/**
 * Mémo SERVEUR à durée de vie, partagé entre les requêtes d'un même processus.
 *
 * Pensé pour les données que le rendu SSR redemande au backend à chaque page alors qu'elles sont
 * identiques pour tout le monde et changent rarement : les facettes des filtres (zones, réseaux,
 * thématiques…). Cf. `modules/search/prefetch/facetCache.ts`, son seul usage.
 *
 * Contrat :
 * - **Seuls les succès sont mémorisés.** Un `fn` qui rejette ne laisse rien derrière lui : la
 *   demande suivante relance l'appel. Un hoquet du backend n'est donc jamais amplifié.
 * - **Les appels en vol sont regroupés** : N demandes concurrentes pour la même clé → un seul `fn`.
 * - **Chaque appelant reçoit une copie** (`structuredClone`), jamais l'objet stocké : une requête
 *   SSR qui muterait sa donnée ne contaminerait ni le cache ni les requêtes voisines.
 * - `ttlMs <= 0` : passe-plat strict, `fn` est appelé à chaque fois (mode « désactivé »).
 * - Taille bornée (`maxEntries`, FIFO) : impossible de dériver en mémoire.
 *
 * Ce n'est PAS un cache de pages : rien ici ne touche au HTML ni au streaming.
 */

export interface SsrMemoOptions {
  /** Durée de vie d'une entrée, en millisecondes. `<= 0` désactive le mémo. */
  ttlMs: number;
  /** Nombre maximal d'entrées (défaut 200) ; au-delà, la plus ancienne est évincée. */
  maxEntries?: number;
  /** Horloge injectable (tests). */
  now?: () => number;
}

export interface SsrMemoStats {
  hits: number;
  misses: number;
  /** Demandes servies par un appel déjà en vol. */
  joined: number;
}

export interface SsrMemo {
  get<V>(key: string, fn: () => Promise<V>): Promise<V>;
  /** Vide entrées ET appels en vol (tests, ou purge volontaire). */
  clear(): void;
  readonly size: number;
  readonly stats: Readonly<SsrMemoStats>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

/** Une copie indépendante ; même repli que `ssrStatePacking` quand `structuredClone` manque. */
function clone<V>(value: V): V {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as V);
}

export function createSsrMemo(options: SsrMemoOptions): SsrMemo {
  const ttlMs = options.ttlMs;
  const maxEntries = options.maxEntries ?? 200;
  const now = options.now ?? Date.now;

  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<unknown>>();
  const stats: SsrMemoStats = { hits: 0, misses: 0, joined: 0 };

  function evict(): void {
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  }

  return {
    get<V>(key: string, fn: () => Promise<V>): Promise<V> {
      if (ttlMs <= 0) return fn();

      const hit = entries.get(key);
      if (hit) {
        if (hit.expiresAt > now()) {
          stats.hits++;
          return Promise.resolve(clone(hit.value as V));
        }
        entries.delete(key);
      }

      const pending = inFlight.get(key) as Promise<V> | undefined;
      if (pending) {
        stats.joined++;
        return pending.then(clone);
      }

      stats.misses++;
      const request = fn()
        .then((value) => {
          entries.set(key, { value, expiresAt: now() + ttlMs });
          evict();
          return value;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, request);
      // L'original reste dans le mémo ; même le premier appelant reçoit une copie.
      return request.then(clone);
    },

    clear(): void {
      entries.clear();
      inFlight.clear();
    },

    get size(): number {
      return entries.size;
    },

    get stats(): Readonly<SsrMemoStats> {
      return stats;
    },
  };
}
