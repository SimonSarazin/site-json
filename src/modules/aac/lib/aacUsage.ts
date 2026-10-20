/**
 * Filtre « Filtrer par besoins » — l'usage catégorisé, en DEUX niveaux.
 *
 * ## Il n'y a pas d'endpoint à appeler
 *
 * Côté legacy, cette liste vient de `Aap::getUsageAnswers`
 * ([Aap.php:1997](modules/citizenToolKit/models/Aap.php)), appelée par
 * `SearchObjWidget::init` **au rendu du widget**. Ce n'est pas une route HTTP :
 * c'est une méthode de modèle exécutée côté serveur, dont le résultat est
 * sérialisé dans la config du bloc CMS. Il n'y a donc rien à « brancher ».
 *
 * Ce que fait cette méthode, elle le fait à partir de deux sources que nous
 * avons DÉJÀ :
 *
 *  1. `form.params["categorizedCheckbox<inputKey>"]`, qui porte `list`
 *     (catégories) et `sublist` (sous-catégories, indexées par clé de
 *     catégorie) — chargé par `useAacConfig` ;
 *  2. les réponses elles-mêmes, pour ne garder que les options réellement
 *     utilisées (`hasAnswer` dans le PHP) — c'est la réponse du listing.
 *
 * D'où le choix de tout dériver ici. Reproduire l'appel serveur n'apporterait
 * rien qu'on ne puisse calculer, et ajouterait une dépendance réseau.
 *
 * ## Les identifiants sont auto-descriptifs
 *
 * Une réponse d'usage se lit ainsi :
 *
 *     { list: ["1_communication-externe", "15_autres-metiers"],
 *       sublist: { "1_communication-externe": ["3_plateforme-video"] } }
 *
 * L'identifiant est `<index>_<libellé slugifié>` (`InflectorHelper::slugifyString`
 * côté PHP). On peut donc TOUJOURS afficher un libellé lisible, même sans le
 * formulaire — au prix des accents et de la casse (« la cae » au lieu de « la
 * CAE »). Les vrais libellés, quand `form.params` est là, priment.
 *
 * ⚠️ Deux catégories distinctes peuvent porter la même sous-catégorie sous des
 * index différents (`2_site-vitrine` et `10_site-vitrine` coexistent dans les
 * données réelles). Les identifiants ne sont donc uniques QUE dans leur
 * catégorie : l'arbre est indexé en conséquence.
 */

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");

const toStringList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v as Rec) : [])
    .map((x) => toStr(x).trim())
    .filter(Boolean);

/** L'usage d'un commun, tel que porté par sa réponse. */
export interface AacUsageAnswer {
  /** Identifiants de catégorie. */
  categories: string[];
  /** Identifiants de sous-catégorie, aplatis — la catégorie reste dans `bySub`. */
  subs: string[];
  /** Sous-catégories groupées par catégorie, comme dans la réponse. */
  bySub: Record<string, string[]>;
}

export const EMPTY_AAC_USAGE: AacUsageAnswer = Object.freeze({
  categories: [],
  subs: [],
  bySub: {},
}) as AacUsageAnswer;

/** Une option du filtre, avec son décompte de communs. */
export interface AacUsageOption {
  id: string;
  label: string;
  count: number;
  children: AacUsageOption[];
}

/**
 * Repère la question d'usage dans une étape de réponses, PAR SA FORME.
 *
 * Volontairement pas par identifiant : `aapStep1m8ixxe88psung3p6a7n` est une
 * donnée propre à un formulaire. La forme `{ list, sublist }` est en revanche la
 * signature stable d'un `categorizedCheckbox`, et elle ne collisionne avec
 * aucune autre question de l'étape (les autres sont des chaînes, des tableaux ou
 * des maps d'identifiants).
 *
 * `overrideId` permet de forcer la question depuis la config du site, comme pour
 * les autres rôles de carte.
 */
export function readUsageAnswer(step: unknown, overrideId?: string | null): AacUsageAnswer {
  const answers = rec(step);

  const entry = overrideId
    ? rec(answers[overrideId])
    : (Object.values(answers).find((v) => {
        const o = rec(v);
        return "list" in o || "sublist" in o;
      }) ?? {});

  const holder = rec(entry);
  const categories = toStringList(holder.list);

  const bySub: Record<string, string[]> = {};
  const subs: string[] = [];
  for (const [categoryId, raw] of Object.entries(rec(holder.sublist))) {
    const values = toStringList(raw);
    if (values.length === 0) continue;
    bySub[categoryId] = values;
    subs.push(...values);
  }

  return { categories, subs, bySub };
}

/**
 * Libellé lisible déduit d'un identifiant d'usage — le repli quand `form.params`
 * n'est pas disponible. `1_communication-externe` → « Communication externe ».
 */
export function usageLabelFromId(id: string): string {
  const withoutIndex = id.replace(/^\d+_/, "");
  const words = withoutIndex.replace(/-/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

/**
 * Libellés fournis par le formulaire, quand il est chargé.
 *
 * `form.params.categorizedCheckbox<inputKey>` porte `list` et `sublist` sous la
 * MÊME indexation que les identifiants de réponse (`<index>_<slug>`), ce qui
 * permet de reconstruire la correspondance identifiant → libellé exact.
 */
export function readUsageLabels(params: unknown): Record<string, string> {
  const labels: Record<string, string> = {};

  for (const [key, value] of Object.entries(rec(params))) {
    if (!key.startsWith("categorizedCheckbox")) continue;
    const holder = rec(value);

    // `list` est indexée par position : l'identifiant vaut `<index>_<slug>`.
    toStringList(holder.list).forEach((label, index) => {
      labels[`${index}_${slugify(label)}`] = label;
    });

    for (const raw of Object.values(rec(holder.sublist))) {
      toStringList(raw).forEach((label, index) => {
        labels[`${index}_${slugify(label)}`] = label;
      });
    }
  }

  return labels;
}

/** Équivalent de `InflectorHelper::slugifyString` pour reconstruire les clés. */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Construit l'arbre du filtre à partir des communs CHARGÉS.
 *
 * Ne remonte que les options effectivement portées par au moins un commun —
 * c'est exactement le tri final de `getUsageAnswers`, qui écarte toute option
 * sans `hasAnswer`. Une option qui ne filtrerait rien n'a pas à être proposée.
 *
 * L'ordre suit l'index encodé dans l'identifiant, pour retrouver celui du
 * formulaire plutôt qu'un ordre d'apparition dans les données.
 */
export function buildUsageTree(
  usages: readonly AacUsageAnswer[],
  labels: Record<string, string> = {}
): AacUsageOption[] {
  const categories = new Map<string, { count: number; children: Map<string, number> }>();

  const ensure = (id: string) => {
    let entry = categories.get(id);
    if (!entry) {
      entry = { count: 0, children: new Map() };
      categories.set(id, entry);
    }
    return entry;
  };

  for (const usage of usages) {
    // Une catégorie citée uniquement via `sublist` compte aussi : c'est le cas
    // que le PHP couvre par `hasValidChildren`.
    const cited = new Set([...usage.categories, ...Object.keys(usage.bySub)]);
    for (const categoryId of cited) ensure(categoryId).count += 1;

    for (const [categoryId, subIds] of Object.entries(usage.bySub)) {
      const entry = ensure(categoryId);
      for (const subId of new Set(subIds)) {
        entry.children.set(subId, (entry.children.get(subId) ?? 0) + 1);
      }
    }
  }

  const label = (id: string) => labels[id] || usageLabelFromId(id);

  return [...categories.entries()]
    .sort(([a], [b]) => byEncodedIndex(a, b))
    .map(([id, entry]) => ({
      id,
      label: label(id),
      count: entry.count,
      children: [...entry.children.entries()]
        .sort(([a], [b]) => byEncodedIndex(a, b))
        .map(([subId, count]) => ({ id: subId, label: label(subId), count, children: [] })),
    }));
}

function byEncodedIndex(a: string, b: string): number {
  const index = (id: string) => {
    const n = parseInt(id, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
  return index(a) - index(b) || a.localeCompare(b);
}

/**
 * Décompte par tag, pour les pastilles du filtre « Filtrer par tag ».
 *
 * Le legacy obtient ces nombres par une requête serveur dédiée
 * (`setThemesCounts`, la passe à `indexStep: "0"`). Tant que l'annuaire tient
 * dans une fixture, les compter sur les communs chargés donne le même résultat
 * sans aller-retour — mais ce ne sera plus vrai dès que le listing sera paginé
 * côté serveur : il faudra alors la vraie passe de comptage.
 */
export function countTagFacets(
  cards: readonly { tags: string[] }[]
): { id: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const tag of new Set(card.tags)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: id, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
