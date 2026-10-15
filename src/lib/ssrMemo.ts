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
 * - **Chaque appelant reçoit une copie** (`structuredClone`, ~2 ms pour 500 Ko), jamais l'objet
 *   stocké : une requête SSR qui muterait sa donnée ne contaminerait ni le mémo ni les voisines.
 *   La copie est faite AVANT la mémorisation : une valeur non clonable (fonction, instance) est un
 *   échec comme un autre — rejet, rien de stocké, la demande suivante relance `fn`.
 * - **`get` renvoie toujours une promesse** : un `fn` qui lève ou une valeur non clonable se
 *   traduisent par un rejet, jamais par un throw synchrone.
 * - **`clear()` rend caducs les appels en vol** : leur résultat est servi à ceux qui l'attendaient
 *   mais n'est pas mémorisé, et ils n'évincent pas un appel lancé après la purge.
 * - `ttlMs <= 0` : passe-plat strict, `fn` est appelé à chaque fois (mode « désactivé »).
 * - Taille bornée (`maxEntries`, FIFO) : impossible de dériver en NOMBRE d'entrées. Le plafond
 *   n'est pas en octets : 200 facettes de 500 Ko feraient 100 Mo — un site en compte une dizaine,
 *   la borne est une ceinture, pas le dimensionnement.
 *
 * Ce n'est PAS un cache de pages : rien ici ne touche au HTML ni au streaming.
 */
import { clone } from "./ssrStatePacking";

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
  /** Vide les entrées et rend caducs les appels en vol (tests, ou purge volontaire). */
  clear(): void;
  readonly size: number;
  readonly stats: Readonly<SsrMemoStats>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export function createSsrMemo(options: SsrMemoOptions): SsrMemo {
  const ttlMs = options.ttlMs;
  const maxEntries = options.maxEntries ?? 200;
  const now = options.now ?? Date.now;

  const entries = new Map<string, Entry>();
  /** L'original (à mémoriser, jamais distribué) et la copie due au premier appelant. */
  const inFlight = new Map<string, Promise<{ value: unknown; copy: unknown }>>();
  const stats: SsrMemoStats = { hits: 0, misses: 0, joined: 0 };
  /** Incrémentée par `clear()` : un appel parti sous une génération antérieure ne mémorise rien. */
  let generation = 0;

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
          try {
            return Promise.resolve(clone(hit.value as V));
          } catch (err) {
            return Promise.reject(err);
          }
        }
        entries.delete(key);
      }

      const pending = inFlight.get(key) as Promise<{ value: V; copy: V }> | undefined;
      if (pending) {
        stats.joined++;
        return pending.then((r) => clone(r.value));
      }

      stats.misses++;
      const startedUnder = generation;
      // `new Promise` appelle `fn` tout de suite (les tests comptent dessus) et convertit un throw
      // synchrone en rejet.
      const request = new Promise<V>((resolve) => resolve(fn()))
        .then((value) => {
          // La copie D'ABORD : une valeur non clonable rejette ici, rien n'est mémorisé, et les
          // appels regroupés échouent avec elle. L'original reste dans le mémo, jamais distribué.
          const copy = clone(value);
          if (startedUnder === generation) {
            entries.set(key, { value, expiresAt: now() + ttlMs });
            evict();
          }
          return { value, copy };
        })
        .finally(() => {
          // Ne retire que SON entrée : après un `clear()`, la clé peut porter un appel plus récent.
          if (inFlight.get(key) === request) inFlight.delete(key);
        });
      inFlight.set(key, request);
      return request.then((r) => r.copy);
    },

    clear(): void {
      entries.clear();
      inFlight.clear();
      generation++;
    },

    get size(): number {
      return entries.size;
    },

    get stats(): Readonly<SsrMemoStats> {
      return stats;
    },
  };
}
