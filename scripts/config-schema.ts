/**
 * Imprime le JSON Schema (z.toJSONSchema) d'un MORCEAU du schéma de site —
 * évite à l'assistant config (et aux humains) de relire les ~2000 lignes de
 * site-schema.ts pour connaître la forme exacte d'une section ou d'un bloc.
 * Cf. doc/26-assistant-config.md.
 *
 * Usage :
 *   npx tsx scripts/config-schema.ts sections          # liste type + description des sections
 *   npx tsx scripts/config-schema.ts section:<type>    # JSON Schema d'une section (ex. section:pricing)
 *   npx tsx scripts/config-schema.ts header|footer|theme|meta|auth|page|profiles|integrations|costumForm|root
 *   npx tsx scripts/config-schema.ts costumForm        # forme d'un document config.costumForms.<id> (cf. doc/28)
 *
 * Les refinements Zod (.refine/.check) ne sont PAS représentables en JSON
 * Schema (`unrepresentable: "any"`) → toujours revalider avec
 * scripts/validate-config.ts après génération.
 */
import { z } from "zod";
import {
  SiteConfig,
  Section,
  Header,
  Footer,
  ThemeConfig,
  Page,
} from "../src/types/site-schema";
import SECTION_META, { SECTION_FAMILIES } from "../src/components/admin/section-meta";
import { CostumFormSchemaZod } from "../src/modules/profil/forms/costum/costumFormSchema.zod";
import { AdminConfigSchema } from "../src/modules/admin/schema";

// Sortie souvent pipée vers head/grep — ne pas crasher sur le tube fermé.
process.stdout.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EPIPE") process.exit(0);
  throw e;
});

const arg = process.argv[2];

function print(schema: z.ZodType, note?: string) {
  if (note) console.error(note);
  console.log(JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any" }), null, 2));
}

/** Membres de la discriminatedUnion `Section`, indexés par littéral `type`. */
function sectionOptions(): Map<string, z.ZodType> {
  const out = new Map<string, z.ZodType>();
  const options = (Section as unknown as { options: z.ZodObject<{ type: z.ZodLiteral<string> }>[] }).options;
  for (const opt of options) {
    const lit = opt.shape?.type;
    const value = (lit as unknown as { value?: string }).value;
    if (typeof value === "string") out.set(value, opt);
  }
  return out;
}

if (!arg) {
  console.error(
    "Usage : config-schema.ts <sections | section:<type> | header | footer | theme | meta | auth | page | profiles | integrations | costumForm | root>",
  );
  process.exit(2);
}

if (arg === "sections") {
  // Catalogue : type → description française (section-meta du panel admin), groupé par famille.
  const byFamily = new Map<string, string[]>();
  for (const [type] of [...sectionOptions()].sort(([a], [b]) => a.localeCompare(b))) {
    const m = SECTION_META[type];
    const line = `${type.padEnd(28)} ${m ? `${m.label} — ${m.desc}` : "(absent de section-meta)"}`;
    const family = m?.family ?? "(sans famille)";
    byFamily.set(family, [...(byFamily.get(family) ?? []), line]);
  }
  for (const family of [...SECTION_FAMILIES, "(sans famille)"]) {
    const lines = byFamily.get(family);
    if (!lines) continue;
    console.log(`\n# ${family}`);
    for (const line of lines) console.log(line);
  }
  process.exit(0);
}

if (arg.startsWith("section:")) {
  const type = arg.slice("section:".length);
  const schema = sectionOptions().get(type);
  if (!schema) {
    console.error(`✗ type de section inconnu : "${type}" (voir \`config-schema.ts sections\`)`);
    process.exit(1);
  }
  print(schema);
  process.exit(0);
}

const ROOT_PARTS: Record<string, () => void> = {
  header: () => print(Header),
  footer: () => print(Footer),
  theme: () => print(ThemeConfig),
  page: () => print(Page),
  meta: () => print(SiteConfig.shape.meta),
  auth: () => print(SiteConfig.shape.auth, "// config.auth (module auth — cf. doc/23)"),
  profiles: () => print(SiteConfig.shape.profiles, "// config.profiles (module profil — cf. doc/08)"),
  integrations: () => print(SiteConfig.shape.integrations, "// config.integrations (analytics, seo, map MapTiler — clé en env VITE_MAPTILER_API_KEY)"),
  costumForm: () => print(CostumFormSchemaZod, "// config.costumForms.<id> = document CostumFormSchema (zod PRAGMATIQUE : structure essentielle + passthrough) — forme complète : doc/28-module-formengine.md"),
  admin: () => print(AdminConfigSchema, "// config.admin = back-office /admin config-driven (7 sections builtin, discriminatedUnion strict) — référence : doc/30-module-admin.md"),
  root: () => {
    // Vue d'ensemble : clés racine + type sommaire (pas le schéma complet, volumineux).
    for (const [key, value] of Object.entries(SiteConfig.shape)) {
      const def = (value as z.ZodType).constructor.name.replace("Zod", "");
      console.log(`${key.padEnd(22)} ${def}`);
    }
  },
};

const fn = ROOT_PARTS[arg];
if (!fn) {
  console.error(`✗ sélecteur inconnu : "${arg}"`);
  process.exit(2);
}
fn();
