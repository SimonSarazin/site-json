/**
 * Traduction de NOTRE vocabulaire de filtres vers les paramètres de
 * `directoryproposal` — fonction PURE.
 *
 * C'est ici, et nulle part ailleurs, que l'on décide de ce qui part au serveur
 * et de ce qui reste en mémoire. La règle n'est pas un compromis implicite mais
 * une contrainte du backend, qu'il faut connaître pour lire ce fichier :
 *
 * `SearchNew::searchFilters` n'offre **qu'un seul créneau `$or`** et ne sait pas
 * composer un `$and` de `$or`. Or l'égalité exacte n'est disponible QUE dans ce
 * créneau — la branche « tableau » du pass-through construit des regex NON
 * ANCRÉES et insensibles à la casse, donc des correspondances par sous-chaîne.
 *
 * D'où la répartition :
 *
 *  - **serveur** : la portée AAC (injectée par la façade), la recherche par nom,
 *    les tags, le tri, la pagination. Ce sont les cas courants, et ils sont
 *    exacts ;
 *  - **client** : `usage`, `usageSub` et `maturity`. `usage` et `usageSub`
 *    réclameraient tous deux le créneau `$or`, qui les combinerait en OU là où
 *    il faut un ET ; et une maturité en sous-chaîne ferait matcher « Oui » dans
 *    « Non, mais d'ici 6 mois oui ». Les envoyer serait pire que de ne pas les
 *    envoyer.
 *
 * Conséquence assumée : dès qu'un filtre client est actif, la pagination serveur
 * devient impossible — `count` et `hasNext` décriraient l'ensemble AVANT
 * filtrage, et mentiraient au compteur comme au scroll infini. Le transport
 * bascule alors sur un balayage borné puis pagine en mémoire.
 *
 * Le jour où `searchFilters` saura composer un `$and` générique (il gère déjà
 * `$or`, et `addQuery` compose déjà en ET), tout passe serveur et le balayage
 * disparaît.
 */
import type { AacCardFieldRef, AacCardFields } from "./resolveAacCardFields";
import type { AacDirectoryFiltersState, AacSortKey } from "./filtersKey";

/**
 * Le chemin INTERROGEABLE d'une référence, ou `null` si elle n'en a pas.
 *
 * Un champ de la RACINE du document (`name`, `descriptionStr`, `tags`, `image`,
 * `funds`…) est calculé par `Aap::parsePropositionData` **après** la requête :
 * il n'est stocké dans aucun document, donc l'envoyer comme chemin Mongo ne
 * filtrerait rien — et le `$exists` anti-brouillons ci-dessous viderait
 * l'annuaire entier. Ces rôles-là restent côté client, comme quand le champ
 * n'est pas résolu du tout.
 */
function serverPath(ref: AacCardFieldRef | null): string | null {
  return ref && ref.stepKey ? ref.path : null;
}

/** Ce qui part sur le fil, dans le vocabulaire de l'endpoint. */
export interface AacServerParams {
  name?: string;
  /**
   * OBLIGATOIRE dès qu'on envoie `name` : un document `answers` ne STOCKE pas de
   * `name` — il est calculé après la requête par `parsePropositionData`. Sans ce
   * chemin, la recherche par nom ne matcherait rien.
   */
  textPath?: string;
  searchTags?: string[];
  /** Idem : le défaut serveur `"tags"` n'est pas un champ stocké sur `answers`. */
  tagsPath?: string;
  sortBy?: Record<string, 1 | -1>;
  /**
   * Filtres Mongo passés tels quels.
   *
   * ⚠️ La façade du SDK y AJOUTE `form` (`{...data.filters, form: this.id}`) —
   * la portée AAC ne se pose donc pas ici, mais tout le reste si.
   */
  filters?: Record<string, unknown>;
}

/**
 * Qui regarde — ce qui détermine la restriction de visibilité.
 *
 * Le bloc legacy `searchObj` porte un filtre configuré avec `applyFor: "forUser"`
 * (`configSearchObj.js:296-306`), appliqué quand le visiteur n'est **ni
 * superAdmin ni interfaceAdmin**. Ce n'est donc pas « anonyme ou pas » : un
 * utilisateur connecté mais non administrateur y est soumis lui aussi.
 */
export interface AacVisibility {
  /** Admin de l'entité ou du costum : voit TOUT, aucune restriction. */
  isAdmin: boolean;
  /** Id de l'utilisateur connecté, `""` si anonyme. */
  currentUserId: string;
  /** Id du contexte porteur (1re clé de `form.parent`). */
  contextId: string | null;
}

export const PUBLIC_AAC_VISIBILITY: AacVisibility = {
  isAdmin: false,
  currentUserId: "",
  contextId: null,
};

export interface AacSplitFilters {
  server: AacServerParams;
  /**
   * Ce qui n'a pas pu partir. Vide ⇒ le serveur filtre tout, on pagine chez lui.
   * Non vide ⇒ balayage + filtrage mémoire.
   */
  client: AacDirectoryFiltersState;
  /** `true` quand un filtre client est actif — impose le balayage. */
  needsScan: boolean;
}

const EMPTY_CLIENT: AacDirectoryFiltersState = {
  q: "",
  tags: [],
  maturity: [],
  usage: [],
  usageSub: [],
  sort: "",
};

/**
 * Tri serveur.
 *
 * ⚠️ Deux approximations, assumées et visibles :
 *  - `interest_*` trie sur `allVoteCount.love`, le compteur STOCKÉ, alors que la
 *    carte affiche `interrest_count`, recalculé après la requête. Les deux
 *    coïncident sur toutes les données observées, mais ce n'est pas garanti ;
 *  - `alpha` est un tri BINAIRE Mongo, donc pas l'équivalent de
 *    `localeCompare("fr", {sensitivity:"base"})` : les accents et la casse ne
 *    s'ordonnent pas pareil.
 *
 * `""` ne rend RIEN : l'ordre du serveur (`{updated:-1}`) est un choix, pas un
 * défaut à écraser.
 */
export function serverSortBy(
  sort: AacSortKey,
  fields: AacCardFields
): Record<string, 1 | -1> | undefined {
  switch (sort) {
    case "":
      return undefined;
    case "created_asc":
      return { created: 1 };
    case "created_desc":
      return { created: -1 };
    case "updated_asc":
      return { updated: 1 };
    case "updated_desc":
      return { updated: -1 };
    case "interest_desc":
      return { "allVoteCount.love": -1 };
    case "interest_asc":
      return { "allVoteCount.love": 1 };
    case "alpha": {
      const titlePath = serverPath(fields.title);
      return titlePath ? { [titlePath]: 1 } : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Répartit l'état des filtres entre le serveur et le client.
 *
 * `fields` fournit les CHEMINS des questions (`answers.<étape>.<id>`) : sans
 * eux, ni `textPath` ni `tagsPath` ne sont connus, et les filtres correspondants
 * doivent rester client — c'est le cas tant que le formulaire n'est pas chargé.
 */
export function splitAacFilters(
  filters: AacDirectoryFiltersState,
  fields: AacCardFields,
  visibility: AacVisibility = PUBLIC_AAC_VISIBILITY
): AacSplitFilters {
  const server: AacServerParams = {};
  const client: AacDirectoryFiltersState = { ...EMPTY_CLIENT };

  // Restriction de VISIBILITÉ — pas un filtre utilisateur, une règle d'accès.
  //
  // Un visiteur non administrateur ne voit que les communs SÉLECTIONNÉS, plus
  // les siens. C'est le filtre `applyFor: "forUser"` du bloc legacy, qui pose
  // exactement `filters[$or][answers.aapStep2.choose.<contextId>.value]=selected`
  // et `filters[$or][user]=<userId>`.
  //
  // `$or` est ici une MAP, pas un tableau : `SearchNew::searchFilters` la
  // déplie en `[{clé: valeur}, …]` (SearchNew.php:549-573) et pousse la valeur
  // BRUTE, sans garde sur le vide. Un `user: ""` (anonyme) ne matche donc rien —
  // il ne reste que les sélectionnés, ce qui est bien l'intention.
  //
  // ⚠️ Ce `$or` occupe le créneau UNIQUE de `searchFilters` : c'est une raison
  // de plus pour laisser `usage`/`usageSub` côté client (cf. plus haut).
  const choosePath = serverPath(fields.choose);
  if (!visibility.isAdmin && choosePath && visibility.contextId) {
    server.filters = {
      $or: {
        [`${choosePath}.${visibility.contextId}.value`]: "selected",
        user: visibility.currentUserId,
      },
    };
  }

  // Exclure les réponses SANS titre — c'est-à-dire les brouillons.
  //
  // Le front legacy pose exactement `filters[answers.aapStep1.titre][$exists]=true`
  // sur l'annuaire ; sans lui, la grille affiche des cartes « Commun sans titre »
  // qui ne sont que des dépôts non finalisés.
  //
  // On filtre sur le chemin RÉSOLU plutôt que sur `aapStep1.titre` en dur : c'est
  // le même champ que celui dont la carte tire son titre, donc affichage et
  // filtrage restent cohérents quel que soit le formulaire. Sur un AAC canonique
  // les deux coïncident avec le legacy.
  const titlePath = serverPath(fields.title);
  if (titlePath) {
    // FUSION, jamais affectation : la restriction de visibilité a pu poser son
    // `$or` juste au-dessus, et l'écraser rouvrirait l'annuaire à tout le monde.
    server.filters = { ...server.filters, [titlePath]: { $exists: true } };
  }

  const q = filters.q.trim();
  if (q) {
    if (titlePath) {
      server.name = q;
      server.textPath = titlePath;
    } else {
      // Chemin de titre inconnu : envoyer `name` seul ne ramènerait rien.
      client.q = q;
    }
  }

  const tagsPath = serverPath(fields.tags);
  if (filters.tags.length > 0) {
    if (tagsPath) {
      server.searchTags = filters.tags;
      server.tagsPath = tagsPath;
    } else {
      client.tags = filters.tags;
    }
  }

  // Ces trois-là ne sont pas exprimables sans fausser le résultat — cf. l'en-tête.
  client.maturity = filters.maturity;
  client.usage = filters.usage;
  client.usageSub = filters.usageSub;

  const sortBy = serverSortBy(filters.sort, fields);
  if (sortBy) server.sortBy = sortBy;

  const needsScan =
    client.q !== "" ||
    client.tags.length > 0 ||
    client.maturity.length > 0 ||
    client.usage.length > 0 ||
    client.usageSub.length > 0;

  // Le tri ne suit le chemin client QUE si l'on balaie : sinon le serveur l'a
  // déjà appliqué, et re-trier une page partielle donnerait un ordre faux.
  if (needsScan) client.sort = filters.sort;

  return { server, client, needsScan };
}
