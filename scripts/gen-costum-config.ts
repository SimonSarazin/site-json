/**
 * CLI build-time (P4 de doc/formulaire-config-driven.md) : génère une JsonFormConfig depuis
 * l'artefact costum-extensions.json de la lib (overlay costum) + le descripteur de BASE curé de la lib
 * (`describeEntityForm`). La config produite (base + costum) est destinée à être versionnée puis
 * ÉDITÉE à la main (libellés costum, widgets fins, étapes).
 *
 * Usage : tsx scripts/gen-costum-config.ts <slug> <collection> [out.json]
 *   Artefact : env COSTUM_EXTENSIONS, sinon ../cocolight-api-endpoint/costum-extensions.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Collection } from "@communecter/cocolight-api-client";
import { describeEntityForm } from "@communecter/cocolight-api-client";
import { costumToConfig } from "../src/modules/formEngine/config/costumToConfig";

const [slug, collection, out] = process.argv.slice(2);
if (!slug || !collection) {
  console.error("Usage: tsx scripts/gen-costum-config.ts <slug> <collection> [out.json]");
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
const config = costumToConfig(ext, slug, collection, base);

if (!config) {
  console.error(`❌ Aucune config générée : collection non créable, ou ${slug}/${collection} absent de l'artefact (${artPath}).`);
  process.exit(2);
}

const json = JSON.stringify(config, null, 2);
if (out) {
  writeFileSync(out, json, "utf-8");
  console.error(`✅ Config générée : ${out} (à éditer ensuite).`);
} else {
  process.stdout.write(json + "\n");
}
