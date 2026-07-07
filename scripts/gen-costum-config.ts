/**
 * CLI build-time (P4 de doc/formulaire-config-driven.md) : génère depuis l'artefact costum-extensions.json
 * de la lib (overlay costum) + le descripteur de BASE curé de la lib (`describeEntityForm`) :
 *  - défaut (`--format jsonForm`) : une `JsonFormConfig` (couche formEngine) — sortie historique INCHANGÉE ;
 *  - `--format costumForm` (doc/31, fil A/F2) : un document `CostumFormSchema` posable TEL QUEL dans
 *    `config.costumForms.<id>` — validé ici même par `CostumFormSchemaZod` (la garde de `registerCostumForm`),
 *    et n'émettant QUE des clés de registre garanties par `sharedRegistrations`.
 * La config produite est destinée à être versionnée puis ÉDITÉE à la main (libellés, widgets fins, étapes).
 *
 * Usage : tsx scripts/gen-costum-config.ts <slug> <collection> [out.json] [--format jsonForm|costumForm]
 *   Artefact : env COSTUM_EXTENSIONS, sinon ../cocolight-api-endpoint/costum-extensions.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Collection } from "@communecter/cocolight-api-client";
import { describeEntityForm } from "@communecter/cocolight-api-client";
import { costumToConfig } from "../src/modules/formEngine/config/costumToConfig";
import { costumToFormSchema } from "../src/modules/profil/forms/costum/costumToFormSchema";
import { CostumFormSchemaZod } from "../src/modules/profil/forms/costum/costumFormSchema.zod";

const FORMATS = ["jsonForm", "costumForm"] as const;
type Format = (typeof FORMATS)[number];

// ── args : positionnels <slug> <collection> [out.json] + flag --format ──────────────────────────
let format: Format = "jsonForm";
const positional: string[] = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const value = a === "--format" ? argv[++i] : a.startsWith("--format=") ? a.slice("--format=".length) : undefined;
  if (a === "--format" || a.startsWith("--format=")) {
    if (!FORMATS.includes(value as Format)) {
      console.error(`❌ --format invalide : "${value ?? ""}" (attendu : ${FORMATS.join(" | ")})`);
      process.exit(1);
    }
    format = value as Format;
  } else {
    positional.push(a);
  }
}
const [slug, collection, out] = positional;
if (!slug || !collection) {
  console.error("Usage: tsx scripts/gen-costum-config.ts <slug> <collection> [out.json] [--format jsonForm|costumForm]");
  console.error("  Artefact : env COSTUM_EXTENSIONS ou ../cocolight-api-endpoint/costum-extensions.json");
  process.exit(1);
}

const artPath = process.env.COSTUM_EXTENSIONS
  ? resolve(process.env.COSTUM_EXTENSIONS)
  : resolve(process.cwd(), "../cocolight-api-endpoint/costum-extensions.json");

const ext = JSON.parse(readFileSync(artPath, "utf-8"));
// Base curée par la lib (null si l'entité n'a pas encore de base curée → config costum-only).
const base = describeEntityForm(collection as Collection);
if (!base) {
  console.error(`⚠️  Pas de base curée pour "${collection}" (describeEntityForm) → config costum-only.`);
}

const config = format === "costumForm"
  ? costumToFormSchema(ext, slug, collection, base)
  : costumToConfig(ext, slug, collection, base);

if (!config) {
  console.error(`❌ Aucune config générée : collection non créable, ou ${slug}/${collection} absent de l'artefact (${artPath}).`);
  process.exit(2);
}

if (format === "costumForm") {
  // Garde interne : le généré DOIT passer la validation de structure de `registerCostumForm` (zod pragmatique).
  const parsed = CostumFormSchemaZod.safeParse(config);
  if (!parsed.success) {
    console.error(`❌ CostumFormSchema généré invalide (bug générateur) : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
    process.exit(3);
  }
  console.error(`✅ CostumFormSchema valide (CostumFormSchemaZod) — à poser dans config.costumForms.${(config as { id: string }).id}, puis éditer.`);
}

const json = JSON.stringify(config, null, 2);
if (out) {
  writeFileSync(out, json, "utf-8");
  console.error(`✅ Config générée : ${out} (à éditer ensuite).`);
} else {
  process.stdout.write(json + "\n");
}
