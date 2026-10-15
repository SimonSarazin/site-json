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

/** L'échappement de `serialize-javascript` (`isJSON`), à l'identique : le JSON reste inerte dans un `<script>`. */
const UNSAFE_CHARS = /[<>/\u2028\u2029]/g;
const ESCAPED_CHARS: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};
const toScriptSafe = (json: string): string => json.replace(UNSAFE_CHARS, (c) => ESCAPED_CHARS[c]);

/**
 * Serveur : le texte de `window.__REACT_QUERY_STATE__=…`, parents distincts rangés dans
 * `__ssrParents`. UN `JSON.stringify` de l'état, dont le replacer voit chaque entité APRÈS son
 * `toJSON` ; la table des parents s'ajoute au texte, sans reparse. Un parent n'est sérialisé qu'une
 * fois par INSTANCE du SDK — celle qu'une liste partage entre toutes ses cartes —, le texte ne
 * servant qu'à reconnaître deux instances au contenu identique.
 */
export function serializeSsrState(state: object): string {
  // La table s'ajoute en dernière clé d'un OBJET : un autre état part tel quel, sans référence.
  if (!isObject(state)) return toScriptSafe(JSON.stringify(state));

  const indexByText = new Map<string, number>();
  const indexByInstance = new WeakMap<object, number>();
  const parentTexts: string[] = [];

  const text = JSON.stringify(state, function (this: unknown, key: string, value: unknown) {
    if (!isObject(value) || !hasEntityParent(value)) return value;
    // `this[key]` : l'entité AVANT son `toJSON` — son parent, une instance du SDK. Sans `toJSON`
    // (nœud déjà sérialisé), aucune instance ne garantit le contenu : reconnu par son texte.
    const original = (this as JsonObject)[key];
    const instance =
      original !== value && isObject(original) && isObject(original.parent) ? original.parent : undefined;
    let index = instance ? indexByInstance.get(instance) : undefined;
    if (index === undefined) {
      const parentText = JSON.stringify(value.parent);
      index = indexByText.get(parentText);
      if (index === undefined) {
        index = parentTexts.length;
        parentTexts.push(parentText);
        indexByText.set(parentText, index);
      }
      if (instance) indexByInstance.set(instance, index);
    }
    return { ...value, parent: { [REF_KEY]: index } };
  });

  if (parentTexts.length === 0) return toScriptSafe(text);
  // Un `toJSON` de l'état qui rendrait autre chose qu'un objet : pas de table où ranger les parents.
  if (!text.startsWith("{")) return toScriptSafe(JSON.stringify(state));
  // `text` est celui d'un objet NON vide (il porte au moins l'entité référencée) : `{…}` → `{…,"__ssrParents":[…]}`.
  return toScriptSafe(`${text.slice(0, -1)},"${PARENTS_KEY}":[${parentTexts.join(",")}]}`);
}

/** Restitue les parents référencés sous `node` ; ne descend jamais dans un parent restitué (il n'en contient pas). */
function restoreParents(node: unknown, parents: unknown[]): void {
  if (Array.isArray(node)) {
    for (const item of node) restoreParents(item, parents);
    return;
  }
  if (!isObject(node)) return;
  const isEntity = node.__isSerializedEntity === true;
  for (const [key, value] of Object.entries(node)) {
    const ref = isEntity && key === "parent" && isObject(value) ? value[REF_KEY] : undefined;
    if (typeof ref === "number") {
      if (isObject(parents[ref])) node.parent = clone(parents[ref]);
      continue;
    }
    restoreParents(value, parents);
  }
}

/**
 * Client : restitue chaque parent référencé — une COPIE par entité, comme avant l'emballage, pour
 * qu'aucune ne partage d'objet avec une autre. Un état non emballé est rendu tel quel.
 */
export function unpackSsrState<T>(state: T): T {
  if (!isObject(state) || !Array.isArray(state[PARENTS_KEY])) return state;
  const parents = state[PARENTS_KEY] as unknown[];
  delete state[PARENTS_KEY];
  restoreParents(state, parents);
  return state;
}
