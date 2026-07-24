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

/** Membres de la discriminatedUnion `Section`, indexés par littéral `type`. */
export function sectionOptions(): Map<string, z.ZodType> {
  const out = new Map<string, z.ZodType>();
  const options = (Section as unknown as { options: z.ZodObject<{ type: z.ZodLiteral<string> }>[] }).options;
  for (const opt of options) {
    const lit = opt.shape?.type;
    const value = (lit as unknown as { value?: string }).value;
    if (typeof value === "string") out.set(value, opt);
  }
  return out;
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
  if (selector.startsWith("section:")) return sectionOptions().get(selector.slice("section:".length));
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
}

/** Aplati les unions (anyOf/oneOf/allOf) en feuilles explorables. */
function branches(node: JsonSchemaNode): JsonSchemaNode[] {
  const subs = [...(node.anyOf ?? []), ...(node.oneOf ?? []), ...(node.allOf ?? [])];
  return subs.length ? [node, ...subs.flatMap(branches)] : [node];
}

/**
 * Résout un chemin pointé dans un JSON Schema produit par z.toJSONSchema.
 * Syntaxe par segment : `cle` (propriété), `cle[]` (items du tableau `cle`),
 * `*` (valeurs d'un record / additionalProperties). Retourne TOUS les nœuds
 * atteints (les unions font diverger le chemin).
 */
export function resolveJsonSchemaPath(root: JsonSchemaNode, dottedPath: string): JsonSchemaNode[] {
  let candidates = branches(root);
  for (const seg of dottedPath.split(".")) {
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
        for (const b of branches(target)) if (b.items) next.push(...branches(b.items));
      } else {
        next.push(...branches(target));
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
