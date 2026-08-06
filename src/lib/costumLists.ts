/**
 * Listes déclarées d'un costum (`costum.lists.<nom>`) — lecture et typage.
 *
 * DEUX FORMES COEXISTENT en base, et la distinction commande tout le reste :
 *
 *  • STATIQUE — un tableau de chaînes, ou une map `valeur → libellé`. Les valeurs sont écrites dans
 *    la déclaration elle-même. Elles voyagent donc DÉJÀ dans le costum que le front a en mémoire
 *    (`getcostumjson` / `element/about` renvoient le champ brut) : les demander au serveur serait un
 *    aller-retour pour rien. On les résout ici, sans requête.
 *
 *  • DYNAMIQUE — une RECETTE : `{collection, distinct, where}`, `{type:"badges", category}` ou
 *    `{collection, where, fields}`. Le costum ne transporte que la recette, jamais le résultat
 *    (`Costum::getAndConvertLists` n'est appelée qu'au rendu des pages PHP legacy, et son résultat
 *    part dans un cache). Seul le serveur peut les résoudre — c'est l'objet de `costum/co/listvalues`,
 *    qui refuse d'ailleurs explicitement les statiques pour cette raison.
 *
 * Ce module est le miroir client des mêmes règles : garder les deux implémentations d'accord évite
 * qu'un front demande ce qu'il a déjà, ou tienne pour acquis ce qu'il n'a pas.
 */

/** Une entité porteuse telle que le front la manipule (org du site, entité éditée…). */
type CarrierLike = { serverData?: Record<string, unknown> } | null | undefined;

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Slug à passer à `costum/co/listvalues`.
 *
 * C'est le slug de l'ÉLÉMENT porteur, et non `costum.slug` : le serveur résout par `Slug::getBySlug`,
 * qui indexe les éléments. Source unique, partagée par le widget et par l'invalidation post-mutation.
 */
export function costumSlugOf(carrier: CarrierLike): string | null {
  const slug = carrier?.serverData?.slug;
  return typeof slug === "string" && slug !== "" ? slug : null;
}

/**
 * Les listes déclarées par le PORTEUR du site.
 *
 * `costum.lists` d'abord — l'emplacement CANONIQUE, seul lu par le legacy
 * (`Costum::getAndConvertLists`) et par le backend, utilisé par 78 costums. Repli sur la racine
 * `serverData.lists` : un unique document de toute la base l'utilise (l'org porteuse
 * d'equipements-sportifs, dont les listes ont été déposées là avant qu'elle ne porte un costum) — le
 * legacy, lui, ignore totalement cet emplacement. Repli à retirer une fois ce cas migré
 * (cf. tools/equipements-lists-migration).
 */
export function costumListsOf(carrier: CarrierLike): Record<string, unknown> {
  const data = carrier?.serverData;
  if (!data) return {};
  const fromCostum = isPlainObj(data.costum) ? data.costum.lists : undefined;
  if (isPlainObj(fromCostum)) return fromCostum;
  return isPlainObj(data.lists) ? data.lists : {};
}

/**
 * La déclaration est-elle une RECETTE à résoudre côté serveur ?
 *
 * Miroir exact de la garde serveur (`ListValuesAction::run`, `costum.routes.ts`) : est dynamique un
 * objet portant `collection`, ou `type:"badges"`. Tout le reste — tableau, map valeur→libellé — porte
 * ses valeurs et se résout ici.
 */
export function isDynamicList(spec: unknown): boolean {
  if (!isPlainObj(spec)) return false;
  return spec.type === "badges" || typeof spec.collection === "string";
}

/**
 * Casse d'AFFICHAGE d'une valeur : 1ʳᵉ lettre en majuscule, le reste intact (« ONU » ne devient pas
 * « Onu », « économie de la mer » devient « Économie de la mer »).
 *
 * Ne s'applique qu'au LIBELLÉ. La valeur stockée — celle qui part en requête et qui doit correspondre au
 * caractère près à ce qu'il y a en base — n'est jamais retouchée. C'est la contrepartie de la saisie
 * libre : les valeurs sont écrites au petit bonheur, une liste où une entrée sur deux commence en
 * minuscule se lit mal, mais les uniformiser en base serait une réécriture de données.
 */
export function capitaliser(v: string): string {
  const s = (v ?? "").trim();
  return s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s;
}

/**
 * Valeurs d'une liste STATIQUE. Renvoie `null` si la déclaration n'en est pas une, ou n'est pas
 * convertible en valeurs de saisie.
 *
 * Pour une map, les valeurs stockées en base sont les CLÉS (`{"Pêche": "Pêche"}` se saisit « Pêche ») —
 * le discriminant est donc la clé, pas la valeur. Une map dont TOUTES les clés sont des ObjectId est
 * une liste d'ENTITÉS et non de valeurs : refusée, comme côté serveur.
 */
export function staticListValues(spec: unknown): string[] | null {
  if (isDynamicList(spec)) return null;

  let brut: unknown[];
  if (Array.isArray(spec)) {
    brut = spec;
  } else if (isPlainObj(spec)) {
    const cles = Object.keys(spec);
    if (cles.length > 0 && cles.every((k) => /^[a-f0-9]{24}$/i.test(k))) return null;
    brut = cles;
  } else {
    return null;
  }

  const vues = new Set<string>();
  const out: string[] = [];
  for (const v of brut) {
    if (typeof v !== "string" || v === "" || vues.has(v)) continue;
    vues.add(v);
    out.push(v);
  }
  return out;
}
