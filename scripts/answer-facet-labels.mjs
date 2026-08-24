/**
 * Garde LIVE des libellés de facettes « par réponses ».
 *
 * POURQUOI un script live et pas un test : les options d'une facette
 * `filtersByAnswers`/`filtersByPath` ne sont PAS dans la config — elles vivent dans le
 * formulaire, en base (`params["multiCheckboxPlus<section><input>"].global.list`). Aucun
 * contrôle statique ne peut donc les voir. La cible du groupe, elle, est statique et
 * gardée par `tests/preflight/answer-facets.test.ts`.
 *
 * CE QU'ON CHERCHE : un libellé contenant un POINT. Sur un `multiCheckboxPlus`, le
 * libellé est une CLÉ Mongo (`[{"Obésité":{…}}]`) et le prédicat est un `$exists` sur la
 * clé dotée `<chemin>.<libellé>` — un point de plus y devient un niveau de chemin
 * supplémentaire, qui ne matche JAMAIS. L'option s'affiche, se coche, et ne filtre rien.
 * Mesuré sur la base : 819 libellés sur 246 185 sont dans ce cas (« Facilitateur.rice de
 * Tiers-Lieux », « …ci-dessus. »). Aucun sur le formulaire Ekilibre à ce jour.
 *
 * Le runtime ne peut que refuser d'émettre un filtre mort (`answerFilterClause` rend
 * `null` + avertissement en dev) : c'est ici qu'on l'apprend AVANT la mise en ligne.
 * Repli théorique pour ces libellés : `$expr` + `$objectToArray` (compatible Mongo 4.2)
 * — écarté, COLLSCAN 182 ms contre 0 ms via l'index wildcard `answers.$**_1`.
 *
 * Usage :  node scripts/answer-facet-labels.mjs [--backend http://127.0.0.1:5080]
 *          npm run config:answer-labels
 * Sortie : exit 2 si au moins un libellé inexprimable, 1 si le backend est injoignable.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const BACKEND = arg("backend", process.env.VITE_BASE_URL_BACKEND ?? "http://127.0.0.1:5080");

/** Groupes déclarés du parc qui ciblent les answers, avec leur form et leur chemin. */
export function groupesCiblantLesAnswers(configs) {
  const out = [];
  const visiter = (noeud, site, page) => {
    if (Array.isArray(noeud)) return noeud.forEach((n) => visiter(n, site, page));
    if (!noeud || typeof noeud !== "object") return;
    for (const cle of ["filtersByAnswers", "filtersByPath"]) {
      for (const [id, conf] of Object.entries(noeud[cle] ?? {})) {
        if (conf?.filterTarget !== "answers") continue;
        const chemin = conf.path ?? conf.thematicPath;
        if (!chemin || !conf.forms) continue; // sans form, rien à interroger
        out.push({ ref: `${site} ${page}/${id}`, form: conf.forms, chemin });
      }
    }
    for (const [k, v] of Object.entries(noeud)) {
      visiter(v, site, k === "pages" ? page : (noeud.path ?? page));
    }
  };
  for (const { site, cfg } of configs) {
    for (const page of cfg.pages ?? []) visiter(page.sections ?? [], site, page.path ?? "?");
  }
  return out;
}

/** Dernier segment du chemin = clé d'input dans `form.params`. */
export const cleInput = (chemin) => chemin.split(".").pop() ?? chemin;

/** Libellés d'un input `multiCheckboxPlus` dans un document Form. */
export function libellesDe(formDoc, chemin) {
  const params = formDoc?.data?.params ?? formDoc?.params ?? formDoc?.form?.params ?? {};
  const input = params[cleInput(chemin)];
  const liste = input?.global?.list ?? input?.list ?? [];
  return Array.isArray(liste) ? liste.filter((v) => typeof v === "string") : Object.keys(liste);
}

/** Libellés INEXPRIMABLES en clé dotée (uniquement pour un multiCheckboxPlus). */
export function libellesInexprimables(chemin, libelles) {
  if (!chemin.includes("multiCheckboxPlus")) return [];
  return libelles.filter((l) => l.includes("."));
}

async function main() {
  const configs = readdirSync(ROOT)
    .filter((f) => /^config\.prod\..+\.json$/.test(f))
    .sort()
    .map((f) => ({
      site: f.replace(/^config\.prod\./, "").replace(/\.json$/, ""),
      cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")),
    }));

  const groupes = groupesCiblantLesAnswers(configs);
  if (groupes.length === 0) {
    console.log("Aucun groupe « par réponses » ne cible les answers — rien à vérifier.");
    return 0;
  }

  const cacheForm = new Map();
  const chargerForm = async (id) => {
    if (cacheForm.has(id)) return cacheForm.get(id);
    const r = await fetch(`${BACKEND}/survey/coform/getformbyid`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      // `parentFormId` et non `id` : cf. le port de `Coform::getCompleteFormData`
      // (cocolight-backend, src/modules/survey/survey.routes.ts:73). Un `id=` rend 200
      // avec un corps vide — silence, pas erreur.
      body: `parentFormId=${encodeURIComponent(id)}`,
    });
    if (!r.ok) throw new Error(`getformbyid ${id} → HTTP ${r.status}`);
    const doc = await r.json();
    if (doc?.result === false) throw new Error(`getformbyid ${id} → ${doc.msg ?? "refus backend"}`);
    cacheForm.set(id, doc);
    return doc;
  };

  let fautifs = 0;
  for (const g of groupes) {
    let doc;
    try {
      doc = await chargerForm(g.form);
    } catch (e) {
      console.error(`✗ ${g.ref} : formulaire ${g.form} illisible sur ${BACKEND} — ${e.message}`);
      return 1;
    }
    const libelles = libellesDe(doc, g.chemin);
    if (libelles.length === 0) {
      console.warn(`⚠ ${g.ref} : aucune option lue pour ${cleInput(g.chemin)} (chemin périmé ?)`);
      continue;
    }
    const morts = libellesInexprimables(g.chemin, libelles);
    if (morts.length === 0) {
      console.log(`✓ ${g.ref} : ${libelles.length} options, toutes filtrables`);
      continue;
    }
    fautifs += morts.length;
    console.error(`✗ ${g.ref} : ${morts.length}/${libelles.length} libellés contiennent un POINT → filtre mort :`);
    for (const m of morts) console.error(`    « ${m} »`);
  }

  if (fautifs > 0) {
    console.error(`\n${fautifs} libellé(s) inexprimable(s) en clé dotée. Renommer l'option dans le formulaire (retirer le point) reste la correction la plus simple.`);
    return 2;
  }
  return 0;
}

// Exécution seulement en direct (les helpers restent importables par un test).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(await main());
}
