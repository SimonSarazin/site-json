/**
 * CLI build-time (P4 de doc/formulaire-config-driven.md) : génère une JsonFormConfig depuis
 * l'artefact costum-extensions.json de la lib. La config produite est destinée à être versionnée
 * puis ÉDITÉE à la main (libellés, widgets fins comme location/finder, étapes).
 *
 * Usage : tsx scripts/gen-costum-config.ts <slug> <collection> [out.json]
 *   Artefact : env COSTUM_EXTENSIONS, sinon ../cocolight-api-endpoint/costum-extensions.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
const config = costumToConfig(ext, slug, collection);

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
