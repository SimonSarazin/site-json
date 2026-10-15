/**
 * L'état React Query transmis du serveur au client (`window.__REACT_QUERY_STATE__`), allégé des
 * PARENTS recopiés.
 *
 * Chaque entité du SDK s'y sérialise avec la méta de son parent (`BaseEntity.toJSON` → `parent`,
 * `links` compris, pour `isAdmin()`) — la même, recopiée à l'identique dans chaque carte d'une
 * liste. Sur /communaute d'Open Atlas : 42 copies de 44 Ko, soit 1,8 Mo des 3,3 Mo de l'état.
 *
 * Le serveur range chaque parent distinct UNE fois dans `__ssrParents` et laisse à sa place une
 * référence ; le client les restitue AVANT toute lecture de l'état (`ssrStateBootstrap`, importé en
 * tête d'`entry-client`). React Query et le SDK reçoivent donc exactement le JSON d'avant — seul le
 * transport change. L'état emballé reste un `DehydratedState` lisible (`queries`, `mutations`).
 */

const PARENTS_KEY = "__ssrParents";
const REF_KEY = "__ssrParentRef";

type JsonObject = Record<string, unknown>;

const isObject = (v: unknown): v is JsonObject => v !== null && typeof v === "object" && !Array.isArray(v);

/** Une entité sérialisée par le SDK (`toJSON`) qui porte la méta de son parent. */
const hasEntityParent = (node: JsonObject): node is JsonObject & { parent: JsonObject } =>
  node.__isSerializedEntity === true && isObject(node.parent);

/** Une copie indépendante ; `structuredClone` manque aux navigateurs anciens (Safari < 15.4). */
const clone = <V>(value: V): V =>
  typeof structuredClone === "function" ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as V);

function forEachNode(node: unknown, visit: (obj: JsonObject) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) forEachNode(item, visit);
    return;
  }
  if (!isObject(node)) return;
  visit(node);
  for (const value of Object.values(node)) forEachNode(value, visit);
}

/**
 * Serveur : range les parents distincts dans `__ssrParents`. Un seul `JSON.stringify`, dont le
 * replacer voit chaque entité APRÈS son `toJSON` (comme `serialize(…, { isJSON: true })`) ; sans
 * parent à factoriser, l'état d'origine est rendu tel quel — pas de reparse pour rien.
 */
export function packSsrState<T extends object>(state: T): T {
  const indexByParent = new Map<string, number>();
  const parents: JsonObject[] = [];

  const text = JSON.stringify(state, (_key, value: unknown) => {
    if (!isObject(value) || !hasEntityParent(value)) return value;
    const parentKey = JSON.stringify(value.parent);
    let index = indexByParent.get(parentKey);
    if (index === undefined) {
      index = parents.length;
      parents.push(JSON.parse(parentKey) as JsonObject);
      indexByParent.set(parentKey, index);
    }
    return { ...value, parent: { [REF_KEY]: index } };
  });

  if (parents.length === 0) return state;
  const json = JSON.parse(text) as JsonObject;
  json[PARENTS_KEY] = parents;
  return json as T;
}

/**
 * Client : restitue chaque parent référencé — une COPIE par entité, comme avant l'emballage, pour
 * qu'aucune ne partage d'objet avec une autre. Un état non emballé est rendu tel quel.
 */
export function unpackSsrState<T>(state: T): T {
  if (!isObject(state) || !Array.isArray(state[PARENTS_KEY])) return state;
  const parents = state[PARENTS_KEY] as unknown[];
  delete state[PARENTS_KEY];

  forEachNode(state, (node) => {
    if (node.__isSerializedEntity !== true || !isObject(node.parent)) return;
    const ref = node.parent[REF_KEY];
    if (typeof ref === "number" && isObject(parents[ref])) node.parent = clone(parents[ref]);
  });
  return state;
}
