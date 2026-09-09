/**
 * Transport de l'annuaire des communs — POINT DE BASCULE UNIQUE.
 *
 * Tout ce qui sait COMMENT les communs sont récupérés vit ici, et nulle part
 * ailleurs. Le reste du module — hook, carte, filtres, section — ne connaît que
 * `AacCommunsQuery` et `AacCommunsPage`, exprimés dans notre vocabulaire.
 *
 * Depuis la version 1.0.181 du SDK, la source est l'endpoint réel :
 * `Form.getProposals` → `POST /co2/aap/directoryproposal/source/{source}/form/{form}`.
 *
 * ## Deux chemins, et pourquoi
 *
 *  - **paginé serveur** — le cas courant. Le serveur filtre, trie et découpe ;
 *    on lui demande `count` et on en déduit `hasNext` depuis l'offset ;
 *  - **balayage** — dès qu'un filtre n'est pas exprimable côté serveur
 *    (`usage`, `usageSub`, `maturity` : cf. `aacQueryParams`). Paginer chez le
 *    serveur puis filtrer en mémoire donnerait un `count` et un `hasNext` qui
 *    décrivent l'ensemble AVANT filtrage — le compteur « N RÉSULTATS » et le
 *    scroll infini mentiraient tous les deux. On balaie donc, borné, puis on
 *    filtre et pagine en mémoire.
 *
 * ## Deux pièges du SDK, tous deux vérifiés en exécutant le code
 *
 *  1. `ApiClient._transformData` normalise CHAQUE entrée de `results` :
 *     `created`/`updated` deviennent des `Date` (d'où `toEpochSeconds` dans le
 *     parseur), `image` devient une URL absolue, `_id` un `ObjectID` — la clé de
 *     la map étant promue en `id`, que le parseur lit en repli ;
 *  2. les BLOCS LATÉRAUX (`allActions`, `users`, `inputs`…) ne sont PAS
 *     normalisés : `_transformData` est une chaîne `if/else if` et seule la
 *     branche `results` s'exécute. Ils reviennent bruts, ce qui est exactement
 *     ce qu'attend le code qui les joint.
 *
 * ⚠️ Les lignes de `results` sont des VUES pré-formatées par le serveur
 * (`parsePropositionData`), pas des documents `answers` complets — ne jamais les
 * router dans `_linkEntities`. Pour un détail, reviver par id.
 *
 * ## Ce qu'on n'envoie PAS, et pourquoi
 *
 * Le front legacy expédie sur cette route tout son paquetage de recherche
 * générique : `contextId`, `contextType`, `costumId`, `costumSlug`, `costumType`,
 * `costumEditMode`, `notSourceKey`, `sourceKey`, `countType[]`, `initType`,
 * `fediverse`, `locality`. **Aucun** n'est lu par `globalAutocompleteProposalQuery`
 * (vérifié : zéro occurrence dans Aap.php:1090-1370). Le contexte costum passe
 * exclusivement par le segment d'URL `{source}`, que la façade du SDK remplit
 * depuis le slug du parent. Les reproduire n'ajouterait que du bruit — et
 * laisserait croire à un scoping qui n'existe pas.
 *
 *   grep -rn "MIGRATION directoryproposal" src/
 */
import type { Form } from "@communecter/cocolight-api-client";
import { parseAacAnswer, type AacCommunCard } from "./parseAacAnswer";
import { filterCommuns } from "./filterCommuns";
import {
  splitAacFilters,
  PUBLIC_AAC_VISIBILITY,
  type AacVisibility,
} from "./aacQueryParams";
import type { AacCardFields } from "./resolveAacCardFields";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "./filtersKey";

/** Ce que l'appelant demande — aucun opérateur Mongo, aucun nom de champ SDK. */
export interface AacCommunsQuery {
  /**
   * L'instance `Form`, RATTACHÉE à l'entité costum (via `entity.form({id})`).
   * Son parent porte le slug qui devient le pathParam `{source}` ; un `Form`
   * obtenu par `api.form({id})` ferait lever un 400.
   */
  form: Form;
  filters: AacDirectoryFiltersState;
  fields: AacCardFields;
  /** Index de page, 0-based. */
  page: number;
  pageSize: number;
  contextId?: string | null;
  baseUrl?: string;
  /** Projection Mongo. Omise ⇒ documents complets. */
  projection?: string[];
  /**
   * Qui regarde. Détermine la restriction « communs sélectionnés seulement »
   * appliquée aux visiteurs non administrateurs.
   *
   * ⚠️ Par défaut PUBLIC_AAC_VISIBILITY, mais sans `contextId` la restriction ne
   * peut PAS être construite et l'annuaire est servi en entier. C'est un défaut
   * PERMISSIF : la vraie garde est côté serveur (`onlyAdminCanSeeList`), celle-ci
   * n'est qu'une parité de comportement avec le bloc legacy.
   */
  visibility?: AacVisibility;
  /**
   * Mémoïsation du BALAYAGE, à la charge de l'appelant.
   *
   * Sur le chemin balayage, la requête serveur ne dépend PAS de `page` : chaque
   * page du scroll infini demanderait les mêmes `AAC_SCAN_SIZE` documents pour
   * n'en afficher que `pageSize` de plus. Le transport ne sait pas où vit le
   * cache de l'appelant ; il lui tend le travail à faire, avec les paramètres
   * serveur qui l'identifient. Omise ⇒ un balayage par appel.
   */
  memoizeScan?: AacScanMemoizer;
}

/** Ce qu'un balayage rapatrie : les communs AVANT filtrage client, et si la borne a été atteinte. */
export interface AacCommunsScan {
  cards: AacCommunCard[];
  truncated: boolean;
}

/**
 * `serverParams` est l'IDENTITÉ du balayage : deux appels qui envoient les mêmes
 * paramètres serveur ramènent les mêmes documents, quels que soient les filtres
 * client qui les découpent ensuite.
 */
export type AacScanMemoizer = (
  serverParams: Readonly<Record<string, unknown>>,
  run: () => Promise<AacCommunsScan>
) => Promise<AacCommunsScan>;

/** Une page de résultats, déjà normalisée. */
export interface AacCommunsPage {
  communs: AacCommunCard[];
  /** Total APRÈS filtrage — c'est ce qu'affiche le compteur « N RÉSULTATS ». */
  total: number;
  page: number;
  hasNext: boolean;
  /**
   * `true` quand un balayage a atteint sa borne : le total est alors un
   * MINORANT. Mieux vaut le dire que sous-compter en silence.
   */
  truncated: boolean;
}

/**
 * Borne du balayage.
 *
 * Ni un réglage de confort ni une limite serveur : c'est le garde-fou contre un
 * AAC volumineux (le formulaire de recette du SDK en portait 2 396). Au-delà, on
 * remonte `truncated` plutôt que de laisser croire à un total exact.
 */
export const AAC_SCAN_SIZE = 300;

interface ProposalsResponse {
  results?: unknown[];
  count?: Record<string, number>;
}

/** Une page brute de l'endpoint, déjà parsée en cartes. */
async function fetchCards(
  query: AacCommunsQuery,
  opts: { indexMin: number; indexStep: number; serverParams: Record<string, unknown> }
): Promise<{ cards: AacCommunCard[]; total: number }> {
  const { form, fields, contextId, baseUrl, projection } = query;

  const page = (await form.getProposals({
    ...opts.serverParams,
    indexMin: opts.indexMin,
    indexStep: opts.indexStep,
    // `count` est un contrôle de PRÉSENCE côté serveur, et le contrat ne pose
    // aucun `default` : sans cette ligne, pas de `count.answers`, donc pas de
    // total et pas de `hasNext`.
    count: true,
    ...(projection && projection.length > 0 ? { fields: projection } : {}),
  })) as ProposalsResponse;

  const rows = Array.isArray(page.results) ? page.results : [];
  const cards = rows.map((raw) => parseAacAnswer(raw, { fields, contextId, baseUrl }));

  return { cards, total: page.count?.answers ?? cards.length };
}

/**
 * Combien de communs, sans en rapatrier un seul.
 *
 * Le mode `countonly` de l'endpoint est fait pour ça : il rend `count` et
 * **pas** `results`. Compter en lisant une page reviendrait à télécharger des
 * documents pour n'en garder que le cardinal.
 *
 * ⚠️ Volontairement SANS filtres utilisateur : ce décompte est celui de la
 * population VISIBLE — restriction de visibilité et exclusion des brouillons
 * comprises, puisqu'elles viennent du même `splitAacFilters` que le listing.
 * C'est ce qui garantit qu'un médaillon « N communs » et l'annuaire parlent du
 * même ensemble. Un décompte filtré demanderait le chemin balayage (les filtres
 * `usage`/`maturité` ne sont pas exprimables côté serveur), donc justement les
 * documents que ce mode évite de charger.
 */
export async function fetchAacCommunsCount(query: {
  form: Form;
  fields: AacCardFields;
  visibility?: AacVisibility;
}): Promise<number> {
  const { form, fields, visibility = PUBLIC_AAC_VISIBILITY } = query;
  const { server } = splitAacFilters(EMPTY_AAC_FILTERS, fields, visibility);

  const page = (await form.countProposals({
    ...(server as unknown as Record<string, unknown>),
    count: true,
  })) as { count?: Record<string, number> };

  return page.count?.answers ?? 0;
}

export async function fetchAacCommunsPage(
  query: AacCommunsQuery
): Promise<AacCommunsPage> {
  const { filters, fields, page, pageSize, visibility = PUBLIC_AAC_VISIBILITY } = query;
  const { server, client, needsScan } = splitAacFilters(filters, fields, visibility);
  const serverParams = server as unknown as Record<string, unknown>;

  if (!needsScan) {
    const indexMin = page * pageSize;
    const { cards, total } = await fetchCards(query, {
      indexMin,
      indexStep: pageSize,
      serverParams,
    });

    return {
      communs: cards,
      total,
      page,
      // Calculé depuis l'OFFSET, jamais depuis un cumul : chaque page est
      // récupérée par un appel indépendant.
      hasNext: indexMin + cards.length < total,
      truncated: false,
    };
  }

  // Chemin balayage : on prend tout ce que la borne autorise, puis on filtre et
  // pagine en mémoire — la seule façon d'avoir un total et un `hasNext` justes.
  //
  // Le balayage est tendu à `memoizeScan` quand l'appelant en fournit une : la
  // page n'entre pas dans la requête, donc les pages suivantes n'ont rien à
  // redemander au serveur. Le filtrage client, lui, reste par page — c'est lui
  // qui varie, et 300 cartes se filtrent en mémoire sans coût perceptible.
  const runScan = () => scanAacCommuns(query, serverParams);
  const { cards, truncated } = await (query.memoizeScan
    ? query.memoizeScan(serverParams, runScan)
    : runScan());

  const matching = filterCommuns(cards, client);
  const start = page * pageSize;
  const communs = matching.slice(start, start + pageSize);

  return {
    communs,
    total: matching.length,
    page,
    hasNext: start + communs.length < matching.length,
    truncated,
  };
}

/** Le balayage borné, SANS filtrage client : ce que `memoizeScan` mémorise. */
async function scanAacCommuns(
  query: AacCommunsQuery,
  serverParams: Record<string, unknown>
): Promise<AacCommunsScan> {
  const { cards } = await fetchCards(query, {
    indexMin: 0,
    indexStep: AAC_SCAN_SIZE,
    serverParams,
  });
  return { cards, truncated: cards.length >= AAC_SCAN_SIZE };
}
