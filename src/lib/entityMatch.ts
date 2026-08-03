/**
 * Appariement d'une ENTITÉ (SDK Cocolight) contre des règles config-driven à prédicat.
 *
 * Source unique du trio *(vue matchable + première règle gagnante + garde d'erreur)*, extrait de
 * `src/modules/profil/commands/register.tsx` (`iconRules` de la palette) pour être partagé avec les
 * règles de rendu par item du module search (`list.itemRules`).
 *
 * La grammaire des prédicats est celle du formEngine (`PredicateJson` / {@link check}) : déjà
 * sérialisable en JSON, déjà dotée d'un évaluateur pur et synchrone. On n'en invente pas une seconde.
 */
import { check } from "@/modules/formEngine/engine/conditional";
import type { Predicate, FormValues } from "@/modules/formEngine/types";
import getValueByPath from "@/helpers/getValueByPath";

/** Bloc `source` d'un document (`{insertOrign, key, keys}`), non typé côté SDK. */
function sourceOf(item: unknown): { key?: unknown; keys?: unknown } | undefined {
  const src = (item as { serverData?: Record<string, unknown> } | undefined)?.serverData?.source;
  return src && typeof src === "object" ? (src as { key?: unknown; keys?: unknown }) : undefined;
}

/** Clé de source PRIMAIRE (`serverData.source.key`), ou `undefined`. */
export function getSourceKey(item: unknown): string | undefined {
  const key = sourceOf(item)?.key;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

/**
 * TOUTES les clés de source d'une entité (`source.key` + `source.keys`), dédoublonnées.
 *
 * ⚠ `source.keys` peut être un TABLEAU **ou un OBJET À TROUS** (`{"0":"a","2":"b"}`) : byte-parité
 * avec un `unset` PHP sur un array non séquentiel. Un prédicat `{field:"source.keys", op:"contains"}`
 * échouerait silencieusement sur la seconde forme — d'où la normalisation ici, et l'exposition du
 * champ synthétique `sourceKeys` par {@link entityMatchData}.
 * Même normalisation que `src/lib/permissions/usePermissions.ts` et
 * `src/modules/profil/permissions/register.ts`.
 */
export function getSourceKeys(item: unknown): string[] {
  const src = sourceOf(item);
  if (!src) return [];
  const raw = src.keys;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  return Array.from(
    new Set([src.key, ...list].filter((v): v is string => typeof v === "string" && v.length > 0)),
  );
}

/**
 * Vue « matchable » d'une entité : son `serverData` enrichi de champs SYNTHÉTIQUES, derrière un Proxy
 * qui résout les chemins pointés (`address.addressLocality`) — l'évaluateur de prédicats fait un
 * lookup PLAT (`values[field]`), c'est donc ce Proxy qui apporte l'imbriqué.
 *
 * Champs synthétiques (ils écrasent un homonyme de `serverData`, par construction) :
 *  - `collection` — `serverData.collection`, repli `getEntityType()`. GARANTI sur tout résultat de
 *    recherche : le SDK (`_linkEntities`) supprime les documents sans `collection`. C'est l'ancre
 *    obligatoire de toute règle, car `serverData.type` a DEUX sémantiques (sous-type POI
 *    `article`/`affiche`/`recoveryCenter` vs sous-type d'organisation `NGO`/`Group`/…).
 *  - `sourceKey` / `sourceKeys` — cf. {@link getSourceKeys}.
 *
 * ⚠ Les autres champs (`type`, `source`, champs costum) ne survivent que s'ils sont PROJETÉS
 * (`baseParams.defaultFields` → `fields`). Un champ non projeté vaut `undefined` : la règle ne
 * matchera jamais, en silence.
 */
export function entityMatchData(item: unknown): FormValues {
  const serverData = ((item as { serverData?: Record<string, unknown> } | undefined)?.serverData ??
    {}) as Record<string, unknown>;
  const base: Record<string, unknown> = {
    ...serverData,
    collection:
      serverData.collection ??
      (item as { getEntityType?: () => string } | undefined)?.getEntityType?.(),
    sourceKey: getSourceKey(item),
    sourceKeys: getSourceKeys(item),
  };
  return new Proxy(base, {
    get: (target, prop) =>
      typeof prop === "string" && prop.includes(".")
        ? getValueByPath(target, prop)
        : target[prop as keyof typeof target],
  }) as unknown as FormValues;
}

/**
 * Première règle dont le prédicat `when` matche. Une règle SANS `when` matche toujours
 * (`check(undefined) === true`) : c'est un catch-all, à placer EN DERNIER — placé en tête il masque
 * toutes les suivantes.
 *
 * GARDE : une règle malformée (ex. `op:"matches"` avec un regex invalide → `new RegExp` throw) est
 * IGNORÉE et signalée via `onError`, sans interrompre l'évaluation des règles suivantes. Sans cette
 * garde, une seule faute de config casserait tout le rendu appelant.
 */
export function firstMatching<R extends { when?: unknown }>(
  rules: readonly R[] | undefined,
  data: FormValues,
  onError?: (err: unknown, rule: R) => void,
): R | undefined {
  if (!rules?.length) return undefined;
  for (const rule of rules) {
    try {
      if (check(rule.when as Predicate | undefined, data)) return rule;
    } catch (err) {
      onError?.(err, rule);
    }
  }
  return undefined;
}
