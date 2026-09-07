/**
 * DÉTECTEURS DE CHOIX — « ici une décision est prise, en voici d'autres ».
 *
 * CE QUE CE SCRIPT NE FAIT PAS. Il ne dit JAMAIS qu'une config a tort. La distinction est tout :
 *  - un PRÉDICAT d'applicabilité (« cette config devrait-elle utiliser optionsFrom ? ») est un
 *    jugement métier — savoir si « type de document » est un vocabulaire clos pour l'Institut Bleu
 *    ne se dérive d'aucune mesure ;
 *  - un DÉTECTEUR (« ici une liste est posée en dur ») est un FAIT, greppable, sans jugement.
 *
 * Quatre tentatives de mesurer « ce qui manque » à une config ont produit du bruit à chaque fois
 * (thème absent pris pour un thème amputé, 8 clés identiques pour tous faute de filtre, clés
 * optionnelles niche comptées comme des manques, 12 listes figées dont 9 le sont à raison). Le mode
 * d'échec n'a jamais été de mal répondre : c'est de ne pas être interrogé. Poser la question suffit.
 *
 * Les fiches vivent dans `.claude/skills/config-assistant/besoins.json`, indexées par le BESOIN tel
 * qu'on se le pose au moment de décider, avec le PRIX de chaque réponse.
 *
 * Usage :
 *   node scripts/config-besoins.mjs <config.prod.X.json>   → les choix repérés dans cette config
 *   node scripts/config-besoins.mjs --diff                 → sur les configs modifiées (revue)
 *   node scripts/config-besoins.mjs --tous                 → tout le parc (mesure de bruit)
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const FICHES = JSON.parse(
  readFileSync(".claude/skills/config-assistant/besoins.json", "utf8"),
).besoins;

const parcourir = function* (n) {
  if (Array.isArray(n)) { for (const x of n) yield* parcourir(x); }
  else if (n && typeof n === "object") { yield n; for (const v of Object.values(n)) yield* parcourir(v); }
};

const WIDGETS_A_OPTIONS = new Set(["select", "multiselect", "checkboxGroup"]);

/** Champs de costumForm dont les options sont écrites en dur. */
function listesFigees(cfg) {
  const out = [];
  for (const n of parcourir(cfg.costumForms ?? {})) {
    if (!WIDGETS_A_OPTIONS.has(n.widget) || !Array.isArray(n.enum)) continue;
    const libelle = typeof n.label === "object" ? (n.label.fr ?? n.label.en) : n.label;
    // « Autre… » en fin de liste = la 2e réponse de la fiche est DÉJÀ posée : on le signale comme tel.
    const valeurs = n.enum.map((e) => (typeof e === "object" ? (e.value ?? e.id) : e)).filter(Boolean);
    const echappatoire = valeurs.some((v) => /^autre/i.test(String(v)));
    out.push({ champ: n.name ?? libelle ?? "?", libelle, n: n.enum.length, echappatoire });
  }
  return out;
}

/** costumForms portant `identity` sans `subType`, dans une config qui référence. */
function chaineIncomplete(cfg) {
  const brut = JSON.stringify(cfg);
  const refere = brut.includes('"reference"') || brut.includes('"moderateReferenced"');
  if (!refere) return [];
  return Object.entries(cfg.costumForms ?? {})
    .filter(([, f]) => f?.identity && !f?.subType)
    .map(([id]) => ({ form: id }));
}

const fiche = (id) => FICHES.find((f) => f.id === id);

function analyser(fichier) {
  const cfg = JSON.parse(readFileSync(fichier, "utf8"));
  const remarques = [];

  const figees = listesFigees(cfg);
  const sansEchappatoire = figees.filter((f) => !f.echappatoire);
  if (sansEchappatoire.length) {
    const f = fiche("liste-ouverte");
    remarques.push({
      fiche: f,
      constat: `${sansEchappatoire.length} champ(s) à options écrites en dur` +
        (figees.length > sansEchappatoire.length
          ? ` (+ ${figees.length - sansEchappatoire.length} avec « Autre… », donc déjà ouverts)` : ""),
      detail: sansEchappatoire
        .sort((a, b) => b.n - a.n).slice(0, 6)
        .map((x) => `${x.libelle ?? x.champ} (${x.n})`),
    });
  }

  const chaine = chaineIncomplete(cfg);
  if (chaine.length) {
    const f = fiche("rattachement-fiche");
    remarques.push({
      fiche: f,
      constat: `${chaine.length} costumForm(s) avec \`identity\` mais sans \`subType\`, dans une config qui référence`,
      detail: chaine.map((c) => c.form),
    });
  }
  return remarques;
}

// ── sortie ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let cibles;
if (args.includes("--tous")) {
  cibles = readdirSync(".").filter((f) => /^config\.prod.*\.json$/.test(f)).sort();
} else if (args.includes("--diff")) {
  cibles = execFileSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" })
    .split("\n").filter((f) => /^config\.prod.*\.json$/.test(f));
  if (!cibles.length) { console.log("aucune config modifiée."); process.exit(0); }
} else if (args[0]) {
  cibles = [args[0]];
} else {
  console.log("usage : node scripts/config-besoins.mjs <config.prod.X.json> | --diff | --tous");
  process.exit(2);
}

let total = 0;
for (const f of cibles) {
  const rs = analyser(f);
  total += rs.length;
  if (!rs.length) continue;
  console.log(`\n\x1b[1m${f}\x1b[0m`);
  for (const r of rs) {
    console.log(`\n  • ${r.constat}`);
    if (r.detail?.length) console.log(`    ${r.detail.join(" · ")}`);
    console.log(`\n    \x1b[36m${r.fiche.besoin}\x1b[0m`);
    for (const rep of r.fiche.reponses) {
      console.log(`      – ${rep.nom} — ${rep.quand}`);
      console.log(`        prix : ${rep.prix}`);
    }
    console.log(`    → ${r.fiche.discriminant}`);
  }
}
console.log(`\n${total} remarque(s) sur ${cibles.length} config(s).`);
console.log("Une remarque n'est PAS un défaut : elle signale un choix, pas une erreur.");
