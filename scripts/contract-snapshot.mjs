// Rafraîchit l'instantané du CONTRAT costum (tests/preflight/__contract__/costum-types.json) depuis
// l'artefact de la lib. À lancer après tout upgrade de `@communecter/cocolight-api-client` : le diff
// produit ici EST le signal qu'un type a bougé sous les formulaires du parc.
import fs from 'node:fs';
const SRC = process.env.COSTUM_ARTEFACT
  ?? '../cocolight-backend/reference/cocolight-lib/costum-extensions.json';
if (!fs.existsSync(SRC)) {
  console.error(`artefact introuvable : ${SRC}\n(définir COSTUM_ARTEFACT=<chemin vers costum-extensions.json>)`);
  process.exit(1);
}
const a = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const costums = {};
for (const [slug, colls] of Object.entries(a.costumExtensions ?? {}))
  for (const [coll, v] of Object.entries(colls)) {
    const props = v?.schema?.properties;
    if (props) (costums[slug] ??= {})[coll] = props;
  }
const doc = {
  _source: "costum-extensions.json de @communecter/cocolight-api-client — instantané du CONTRAT costum bundlé. Rafraîchir : npm run contract:snapshot. Un diff ici = le plancher des formulaires a bougé.",
  _generatedFrom: a.generatedAt ?? null,
  costums,
};
fs.writeFileSync('tests/preflight/__contract__/costum-types.json', JSON.stringify(doc, null, 2) + '\n');
const n = Object.values(costums).reduce((t, c) => t + Object.values(c).reduce((m, p) => m + Object.keys(p).length, 0), 0);
console.log(`instantané rafraîchi — ${Object.keys(costums).length} costums, ${n} champs`);
