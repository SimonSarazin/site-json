/**
 * Instantané du CONTRAT costum LIVE — le pendant de `contract:snapshot` (qui fige le contrat BUNDLÉ).
 *
 * POURQUOI les deux : un site en `VITE_COSTUM_FORCE_LIVE` (institutBleu, saintpaulSport1) n'est PAS régi
 * par l'artefact mais par l'`inputType` déclaré dans le costum, digéré à la volée. Une garde qui ne
 * connaît que l'artefact ne peut donc structurellement pas voir ces sites — c'est ce qui a laissé passer
 * la panne de Saint-Paul : son costum n'était même pas dans l'artefact.
 *
 * On capture le SCHÉMA AJV réel (`CostumScope.contextFor().schema`, sous `setCostumForceLive(true)`) et non
 * le type logique : `liveDigest` rend le schéma PERMISSIF (un booléen accepte `oneOf[string, boolean]`), si
 * bien qu'un instantané du seul `type` ferait passer pour des fautes des formulaires corrects. Capturer le
 * schéma, c'est aussi cesser de modéliser la lib — un modèle dérive d'elle sans prévenir.
 *
 * Usage : node scripts/contract-snapshot-live.mjs [--backend http://127.0.0.1:5080]
 */
import fs from "node:fs";
import { setCostumForceLive, resolveCostumScope } from "@communecter/cocolight-api-client";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BACKEND = arg("backend", process.env.VITE_BASE_URL_BACKEND ?? "http://127.0.0.1:5080");

/**
 * `describeCostumForms` n'a besoin du `user` que pour deux appels d'endpoint. On fournit donc le strict
 * nécessaire plutôt qu'un vrai BaseEntity : la chaîne d'inférence exécutée reste celle de la lib.
 */
const post = async (url, body) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body ?? "" });
  return r.ok ? r.json() : null;
};
const stubUser = {
  endpointApi: {
    getCostumJson: async ({ pathParams }) => post(`${BACKEND}/co2/cms/getcostumjson?slug=${encodeURIComponent(pathParams.slug)}`),
    getElementsKey: async ({ pathParams }) => post(`${BACKEND}/co2/slug/getinfo/key/${encodeURIComponent(pathParams.slug)}`),
  },
};

// slugs réellement utilisés par un `costumForm` du parc — pas tout l'univers costum
const slugs = new Set();
const COLLECTIONS = new Map();
for (const f of fs.readdirSync(".").filter((x) => /^config\.prod.*\.json$/.test(x))) {
  const cfg = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const form of Object.values(cfg.costumForms ?? {})) {
    if (!form?.costumSlug) continue;
    slugs.add(form.costumSlug);
    const set = COLLECTIONS.get(form.costumSlug) ?? new Set();
    set.add(form.collection ?? form.entityType);
    COLLECTIONS.set(form.costumSlug, set);
  }
}

setCostumForceLive(true);
const costums = {};
const echecs = [];
for (const slug of [...slugs].sort()) {
  try {
    const scope = await resolveCostumScope(stubUser, slug);
    // collections où un form du parc écrit réellement — inutile d'énumérer tout le costum
    for (const coll of COLLECTIONS.get(slug) ?? []) {
      const ctx = scope.contextFor(coll);
      const props = ctx?.schema?.properties;
      if (!props || !Object.keys(props).length) continue;
      ((costums[slug] ??= {})[coll] = props);
    }
    if (!costums[slug]) { echecs.push(`${slug} : aucun schéma live (contextFor vide)`); continue; }
    const n = Object.values(costums[slug] ?? {}).reduce((t, c) => t + Object.keys(c).length, 0);
    console.log(`  ${slug.padEnd(26)} ${n} champ(s)`);
  } catch (e) {
    echecs.push(`${slug} : ${e instanceof Error ? e.message : String(e)}`);
  }
}

const doc = {
  _source: `contrat costum LIVE (describeCostumForms sous force-live) — backend ${BACKEND}. Rafraîchir : npm run contract:snapshot:live. Un diff ici = l'inférence live a bougé sous les formulaires.`,
  _backend: BACKEND,
  costums,
};
fs.writeFileSync("tests/preflight/__contract__/costum-types.live.json", JSON.stringify(doc, null, 2) + "\n");
console.log(`\ninstantané LIVE écrit — ${Object.keys(costums).length}/${slugs.size} costum(s)`);
if (echecs.length) {
  console.error(`\n❌ ${echecs.length} costum(s) NON résolu(s) — la garde deviendrait AVEUGLE à ces sites :`);
  for (const e of echecs) console.error(`   ${e}`);
  process.exit(1); // un slug droppé en silence = la panne exacte que la garde existe pour voir
}
