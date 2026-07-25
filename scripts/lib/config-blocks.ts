/**
 * Résolution des BLOCS du schéma de site (sélecteurs de `config:schema`) +
 * outillage JSON Schema partagé entre scripts/config-schema.ts et le garde-fou
 * tests/preflight/prop-descriptions.test.ts.
 *
 * La sémantique des props vit dans scripts/lib/prop-descriptions.ts (registre
 * séparé, décision 2026-07-24 — cf. commentaire/refonte-assistant-config.md,
 * axe A3) et se FUSIONNE au dump : `applyDescriptions` pose `description` sur
 * les nœuds du JSON Schema produits par z.toJSONSchema.
 */
import { z } from "zod";
import {
  SiteConfig,
  Section,
  Header,
  Footer,
  ThemeConfig,
  Page,
} from "../../src/types/site-schema";
import { CostumFormSchemaZod } from "../../src/modules/profil/forms/costum/costumFormSchema.zod";
import { AdminConfigSchema } from "../../src/modules/admin/schema";
import { ProfileOnlySectionSchema as ProfileOnlySectionUnion } from "../../src/modules/profil/schema";

/** Membres d'une discriminatedUnion, indexés par leur littéral `type`. */
function unionByType(union: unknown): Map<string, z.ZodType> {
  const out = new Map<string, z.ZodType>();
  const options = (union as { options?: z.ZodObject<{ type: z.ZodLiteral<string> }>[] }).options ?? [];
  for (const opt of options) {
    const value = (opt.shape?.type as unknown as { value?: string })?.value;
    if (typeof value === "string") out.set(value, opt);
  }
  return out;
}

/** Membres de la discriminatedUnion `Section` (sections de PAGE), par `type`. */
export function sectionOptions(): Map<string, z.ZodType> {
  return unionByType(Section);
}

/**
 * Sections de PROFIL (`config.profiles.<type>.tabs[].sections[]`) — une union
 * SÉPARÉE (src/modules/profil/schema.ts), invisible du catalogue des sections
 * de page alors qu'elle pèse ~360 occurrences dans le parc. Sans ce résolveur,
 * `config:schema section:profile-header` répondait « type inconnu ».
 */
export function profileSectionOptions(): Map<string, z.ZodType> {
  return unionByType(ProfileOnlySectionUnion);
}

const ROOT_BLOCKS: Record<string, { schema: () => z.ZodType; note?: string }> = {
  header: { schema: () => Header },
  footer: { schema: () => Footer },
  theme: { schema: () => ThemeConfig },
  page: { schema: () => Page },
  meta: { schema: () => SiteConfig.shape.meta },
  auth: { schema: () => SiteConfig.shape.auth, note: "// config.auth (module auth — cf. doc/23)" },
  profiles: { schema: () => SiteConfig.shape.profiles, note: "// config.profiles (module profil — cf. doc/08)" },
  integrations: {
    schema: () => SiteConfig.shape.integrations,
    note: "// config.integrations (analytics, seo, map MapTiler — clé en env VITE_MAPTILER_API_KEY)",
  },
  commandPalette: {
    schema: () => SiteConfig.shape.commandPalette,
    note: "// config.commandPalette (palette ⌘K — cf. doc/17 ; gate header.utilities.search)",
  },
  costumForm: {
    schema: () => CostumFormSchemaZod,
    note: "// config.costumForms.<id> = document CostumFormSchema (zod PRAGMATIQUE : structure essentielle + passthrough) — forme complète : doc/28-module-formengine.md",
  },
  admin: {
    schema: () => AdminConfigSchema,
    note: "// config.admin = back-office /admin config-driven (7 sections builtin, discriminatedUnion strict) — référence : doc/30-module-admin.md",
  },
};

export const ROOT_BLOCK_SELECTORS = Object.keys(ROOT_BLOCKS);

/** Sélecteur (`header`, `section:agenda`…) → schéma Zod du bloc, ou undefined. */
export function resolveBlockSchema(selector: string): z.ZodType | undefined {
  if (selector.startsWith("section:")) {
    const type = selector.slice("section:".length);
    return sectionOptions().get(type) ?? profileSectionOptions().get(type);
  }
  return ROOT_BLOCKS[selector]?.schema();
}

export function blockNote(selector: string): string | undefined {
  return ROOT_BLOCKS[selector]?.note;
}

// ─── JSON Schema : résolution de chemins pointés ──────────────────────────

export interface JsonSchemaNode {
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  additionalProperties?: JsonSchemaNode | boolean;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  description?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchemaNode>;
  type?: string;
  enum?: unknown[];
  required?: string[];
}

/**
 * Dump JSON Schema d'un bloc. `reused: "ref"` FACTORISE les schémas réutilisés
 * dans `$defs` : sans lui, l'union `Section` (70 membres) est ré-inlinée à
 * chaque point d'usage et les blocs les plus courants deviennent illisibles
 * (`profiles` 683 Ko, `page` 509 Ko — au-delà de ce qu'un agent peut lire).
 *
 * Source UNIQUE du dump : le garde-fou préflight doit voir exactement la même
 * forme que l'assistant, sinon une description morte sous `$ref` passerait
 * inaperçue.
 */
export function dumpJsonSchema(schema: z.ZodType): JsonSchemaNode {
  return z.toJSONSchema(schema, { unrepresentable: "any", reused: "ref" }) as JsonSchemaNode;
}

/**
 * Remplace l'union `Section` (70 membres) par un RENVOI au catalogue partout où
 * elle apparaît. Même factorisée en `$defs`, elle pèse ~220 Ko : un dump de
 * `page` ou de `gridLayout` reste alors illisible alors qu'à ce stade on veut
 * l'ENVELOPPE, pas la forme des 70 sections — qui se demandent une par une
 * (`config:schema section:<type>`).
 *
 * Détection structurelle (pas par nom) : une union d'au moins 20 branches dont
 * chacune porte un littéral `type`.
 */
export function collapseSectionUnions(root: JsonSchemaNode): JsonSchemaNode {
  const seen = new Set<JsonSchemaNode>();
  const literalsOf = (node: JsonSchemaNode): string[] | undefined => {
    const branchesOf = node.anyOf ?? node.oneOf;
    if (!branchesOf || branchesOf.length < 20) return undefined;
    const types: string[] = [];
    for (const b of branchesOf) {
      const t = deref(b, root).properties?.type as { const?: unknown } | undefined;
      if (typeof t?.const !== "string") return undefined;
      types.push(t.const);
    }
    return types;
  };
  const walk = (node: JsonSchemaNode | boolean | undefined) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    const types = literalsOf(node);
    if (types) {
      delete node.anyOf;
      delete node.oneOf;
      node.type = "object";
      node.description = `Section — union de ${types.length} types. Forme exacte d'un type : \`config:schema section:<type>\` ; catalogue complet : \`config:schema sections\`.`;
      node.properties = {
        type: { enum: types.sort() } as JsonSchemaNode,
        id: { type: "string", description: "Identifiant de la section (ancre `#id`, ciblage CSS)." } as JsonSchemaNode,
        props: { type: "object", description: "Propriétés propres au type — `config:schema section:<type>`." } as JsonSchemaNode,
      };
      node.required = ["type"];
      return;
    }
    for (const child of Object.values(node.properties ?? {})) walk(child);
    for (const child of Object.values(node.$defs ?? {})) walk(child);
    walk(node.items);
    walk(node.additionalProperties);
    for (const b of [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])]) walk(b);
  };
  walk(root);
  return root;
}

/**
 * Suit `$ref` → `$defs`, ainsi que `$ref: "#"` — l'auto-référence à la RACINE
 * du document, émise pour les schémas récursifs (une section `gridLayout`
 * contient des sections, donc elle-même). Sans ce cas, l'union des sections
 * n'était pas reconnue quand on dumpait un conteneur.
 */
function deref(node: JsonSchemaNode, root: JsonSchemaNode): JsonSchemaNode {
  let cur = node;
  for (let i = 0; i < 8 && cur.$ref; i++) {
    if (cur.$ref === "#") {
      if (root === cur) break;
      cur = root;
      continue;
    }
    const m = /^#\/\$defs\/(.+)$/.exec(cur.$ref);
    const target = m && root.$defs?.[decodeURIComponent(m[1])];
    if (!target) break;
    cur = target;
  }
  return cur;
}

/**
 * Aplati les unions (anyOf/oneOf/allOf) en feuilles explorables, `$ref` suivis.
 * `seen` est indispensable : les schémas récursifs boucleraient sinon.
 */
function branches(node: JsonSchemaNode, root: JsonSchemaNode, seen = new Set<JsonSchemaNode>()): JsonSchemaNode[] {
  const resolved = deref(node, root);
  if (seen.has(resolved)) return [];
  seen.add(resolved);
  const subs = [...(resolved.anyOf ?? []), ...(resolved.oneOf ?? []), ...(resolved.allOf ?? [])];
  return subs.length ? [resolved, ...subs.flatMap((s) => branches(s, root, seen))] : [resolved];
}

/**
 * Résout un chemin pointé dans un JSON Schema produit par z.toJSONSchema.
 * Syntaxe par segment : `cle` (propriété), `cle[]` (items du tableau `cle`),
 * `*` (valeurs d'un record / additionalProperties). Retourne TOUS les nœuds
 * atteints (les unions font diverger le chemin).
 */
export function resolveJsonSchemaPath(root: JsonSchemaNode, dottedPath: string): JsonSchemaNode[] {
  let candidates = branches(root, root);
  const segments = dottedPath.split(".");
  for (const [i, seg] of segments.entries()) {
    const last = i === segments.length - 1;
    const wantItems = seg.endsWith("[]");
    const key = wantItems ? seg.slice(0, -2) : seg;
    const next: JsonSchemaNode[] = [];
    for (const node of candidates) {
      const target =
        key === "*"
          ? typeof node.additionalProperties === "object"
            ? node.additionalProperties
            : undefined
          : node.properties?.[key];
      if (!target) continue;
      if (wantItems) {
        for (const b of branches(target, root)) {
          if (!b.items) continue;
          // Dernier segment : garder le nœud RÉFÉRENÇANT (cf. ci-dessous).
          if (last) next.push(b.items);
          else next.push(...branches(b.items, root));
        }
      } else if (last) {
        // On annote le nœud qui RÉFÉRENCE, jamais la définition partagée : poser
        // une description sur `$defs/LocalizedString` la collerait à TOUS les
        // titres et libellés du dump. Une annotation à côté d'un `$ref` est
        // valide en JSON Schema 2020-12.
        next.push(target);
      } else {
        next.push(...branches(target, root));
      }
    }
    if (!next.length) return [];
    candidates = next;
  }
  return candidates;
}

/**
 * Pose `description` sur chaque nœud ciblé par le registre. Retourne les
 * chemins SANS cible (entrées mortes — le garde-fou préflight les refuse).
 */
export function applyDescriptions(jsonSchema: JsonSchemaNode, descs: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const [path, desc] of Object.entries(descs)) {
    const nodes = resolveJsonSchemaPath(jsonSchema, path);
    if (!nodes.length) {
      missing.push(path);
      continue;
    }
    for (const n of nodes) n.description = desc;
  }
  return missing;
}
