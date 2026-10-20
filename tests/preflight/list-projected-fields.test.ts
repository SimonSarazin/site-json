/**
 * Préflight — les champs LUS par l'affichage d'une liste sont projetés par la recherche.
 *
 * Une section de recherche qui déclare `baseParams.defaultFields` ne reçoit QUE ces champs. Un champ
 * nommé par la présentation mais absent de la projection vaut `undefined` au runtime, sans la moindre
 * erreur : le sous-titre d'une carte `portrait` disparaît, un regroupement range tout dans « Non classé »,
 * un tri dans les blocs ne trie plus rien. Ni `config:validate` (le NOM est bien formé), ni
 * `audit:config` ne le voient. Même invariant que `list-item-rules` pour les prédicats de règles.
 *
 * Seuls les champs EXPLICITEMENT déclarés sont vérifiés : un champ laissé à son repli de code
 * (`titleField` → `name`…) n'est pas un choix de la config, et le backend projette souvent ces
 * champs de base d'office.
 */
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const sites: { slug: string; config: string }[] = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);

type Objet = Record<string, unknown>;
const estObjet = (v: unknown): v is Objet => !!v && typeof v === "object" && !Array.isArray(v);

/** Clés d'une conf `resource` qui nomment un champ de `serverData`. */
const CHAMPS_RESOURCE = ["titleField", "subtitleField", "descriptionField", "dateField", "imageField", "cityField", "urlsField", "mediasField"] as const;

/** Champs nommés par une conf `resource` (champs directs, pastille, repères). */
function champsResource(resource: unknown): Array<[string, string]> {
  if (!estObjet(resource)) return [];
  const out: Array<[string, string]> = [];
  for (const cle of CHAMPS_RESOURCE) if (typeof resource[cle] === "string") out.push([`resource.${cle}`, resource[cle] as string]);
  if (estObjet(resource.badge) && typeof resource.badge.field === "string") out.push(["resource.badge.field", resource.badge.field]);
  if (Array.isArray(resource.facets)) {
    resource.facets.forEach((f, i) => { if (estObjet(f) && typeof f.field === "string") out.push([`resource.facets[${i}].field`, f.field]); });
  }
  return out;
}

/** Champs nommés par le bloc `list` d'une section (regroupement, tri dans les blocs, présentateur). */
function champsDeListe(list: unknown): Array<[string, string]> {
  if (!estObjet(list)) return [];
  const out: Array<[string, string]> = [];
  if (estObjet(list.groupBy)) {
    if (typeof list.groupBy.field === "string") out.push(["list.groupBy.field", list.groupBy.field]);
    const tri = list.groupBy.itemsSortBy;
    if (estObjet(tri) && typeof tri.field === "string") out.push(["list.groupBy.itemsSortBy.field", tri.field]);
  }
  out.push(...champsResource(list.resource).map(([ou, champ]) => [`list.${ou}`, champ] as [string, string]));
  return out;
}

interface Constat { section: string; ou: string; champ: string }

/** Sections portant une projection (`props.baseParams.defaultFields`) — où qu'elles soient imbriquées. */
function constats(noeud: unknown, trail: string, out: Constat[] = []): Constat[] {
  if (Array.isArray(noeud)) {
    noeud.forEach((v, i) => constats(v, `${trail}[${i}]`, out));
    return out;
  }
  if (!estObjet(noeud)) return out;
  const props = noeud.props;
  const defaultFields = estObjet(props) && estObjet(props.baseParams) ? props.baseParams.defaultFields : undefined;
  if (estObjet(props) && Array.isArray(defaultFields) && defaultFields.length > 0) {
    const projetes = new Set(defaultFields as string[]);
    const section = `${trail}${typeof noeud.id === "string" ? ` (${noeud.id})` : ""}`;
    // `resource` au niveau des props : sections qui ne passent pas par `list` (ex. `featured-carousel`).
    const lus = [...champsDeListe(props.list), ...champsResource(props.resource).map(([ou, champ]) => [`props.${ou}`, champ] as [string, string])];
    for (const [ou, champ] of lus) {
      // Chemin pointé : c'est la RACINE qui est projetée (`address` couvre `address.addressLocality`).
      if (!projetes.has(champ) && !projetes.has(champ.split(".")[0])) out.push({ section, ou, champ });
    }
  }
  for (const [k, v] of Object.entries(noeud)) constats(v, `${trail}.${k}`, out);
  return out;
}

const configs = [...new Set(sites.map((s) => s.config))]
  .map((file) => ({ file, abs: path.resolve(PROJECT_ROOT, file) }))
  .filter(({ abs }) => fs.existsSync(abs));

describe("Preflight — champs lus par l'affichage projetés par defaultFields", () => {
  for (const { file, abs } of configs) {
    test(file, () => {
      const manquants = constats(JSON.parse(fs.readFileSync(abs, "utf-8")), "config")
        .map(({ section, ou, champ }) => `${section} — ${ou} = « ${champ} » absent de baseParams.defaultFields`);
      expect(manquants).toEqual([]);
    });
  }
});
