import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * Le contrat est lu dans une FIXTURE commitée plutôt que dans le paquet : la lib n'exporte pas ses
 * schémas costum publiquement, et surtout — c'est le point — un instantané versionné rend VISIBLE en
 * revue le jour où le contrat bouge. C'est exactement ce qui a manqué le 30/07 : la régénération a
 * changé 4 types sans qu'aucun diff n'apparaisse dans ce dépôt. Rafraîchir : `npm run contract:snapshot`.
 */
const lireFixture = (nom: string) =>
  JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), `__contract__/${nom}`), "utf8"));

/** Contrat BUNDLÉ (artefact) — régit les sites SANS `VITE_COSTUM_FORCE_LIVE`. */
const CONTRAT = lireFixture("costum-types.json") as { costums: Record<string, Record<string, Record<string, unknown>>> };

/**
 * Contrat LIVE (`describeCostumForms`) — régit les sites EN force-live, dont le contrat ne vient pas de
 * l'artefact mais de l'`inputType` déclaré dans le costum. Sans lui, la garde est structurellement
 * aveugle à ces sites : c'est exactement pourquoi la panne de Saint-Paul n'a été vue par personne, son
 * costum n'étant même pas dans l'artefact. Champs décrits `{type, multiple}`, pas en JSON-schema.
 */
const LIVE = lireFixture("costum-types.live.json") as {
  costums: Record<string, Record<string, Record<string, unknown>>>;
};

/**
 * PRÉFLIGHT — un `costumForm` envoie-t-il une valeur que le CONTRAT costum refuse ?
 *
 * L'angle mort qui a cassé Saint-Paul et le site régional : `costum-fields:check` compare l'artefact à
 * la BASE, mais rien ne comparait l'artefact aux FORMULAIRES qui en dépendent. Une régénération peut
 * donc invalider un form du parc en silence — c'est ce qui s'est produit le 30/07, quand 4 champs sont
 * passés de `array` à `string` et que la création d'équipement est devenue impossible sans qu'aucune
 * garde ne bronche.
 *
 * Ce que la garde vérifie : pour chaque champ d'un form dont le costum est BUNDLÉ, le type de la valeur
 * ENVOYÉE (celui du `write` déclaré, sinon celui du widget) est-il accepté par le schéma du contrat ?
 *
 * Elle audite les DEUX sens — un widget `multiselect` sur un contrat `string` (le cas Saint-Paul) comme
 * un widget `text` sur un contrat `number` (le cas SSBE `siren`, que le premier croisement avait raté
 * faute d'auditer les widgets « faibles »).
 *
 * Un champ ABSENT du contrat costum est un champ CŒUR (`name`, `urls`, le `tags` natif…) : son type
 * vient du contrat d'endpoint, hors périmètre ici.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Type de la valeur produite par un widget, à défaut de `write`. */
const TYPE_WIDGET: Record<string, string> = {
  switch: "boolean", checkbox: "boolean", toggle: "boolean",
  multiselect: "array", checkboxGroup: "array", tags: "array", valueSelect: "array",
  urlList: "array", multicombobox: "array",
  number: "number",
  text: "string", textarea: "string", select: "string", selectFromLists: "string",
  email: "string", tel: "string", markdown: "string", date: "string",
};

/** Type de la valeur produite par un `write` déclaré. */
const TYPE_WRITE: Record<string, string> = {
  "coerce:csv": "string", "coerce:boolUpper": "string", "coerce:boolOuiNon": "string",
  "coerce:boolString": "string", "coerce:numString": "string", "coerce:string": "string",
  "coerce:stringStrict": "string", "coerce:number": "number", "coerce:bool": "boolean",
};

/** Types acceptés par un sous-schéma JSON (`type`, `oneOf`, `anyOf`). */
function typesAcceptes(schema: unknown): Set<string> {
  const out = new Set<string>();
  const s = schema as { type?: string; oneOf?: unknown[]; anyOf?: unknown[]; const?: unknown };
  if (!s || typeof s !== "object") return out;
  if (s.type) out.add(s.type);
  for (const branche of [...(s.oneOf ?? []), ...(s.anyOf ?? [])]) {
    for (const t of typesAcceptes(branche)) out.add(t);
    if ((branche as { const?: unknown })?.const !== undefined) out.add("string");
  }
  return out;
}

/**
 * DETTE CONNUE — écarts RÉELS, antérieurs à cette garde, laissés en l'état À DESSEIN : les corriger
 * demande de trancher la forme écrite de champs dont on n'a pas mesuré le stockage, ce qui est
 * exactement l'erreur qu'on vient de réparer ailleurs. Inscrits ici pour être VISIBLES et attribués,
 * plutôt que dilués dans un `expect` rouge que personne ne lit.
 */
const DETTE_CONNUE = new Set<string>([
  // (vide — les 2 entrées historiques gatheringDates/visioDate ont été résorbées par le passage des
  // branches array du scanner ET du liveDigest en oneOf permissif : la garde anti-péremption ci-dessous
  // les a signalées périmées, on les retire. Le patron reste : une entrée = un écart RÉEL documenté.)
]);

const SITES = readdirSync(ROOT)
  .filter((f) => /^config\.prod.*\.json$/.test(f))
  .map((f) => ({ site: f, cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")) as Record<string, unknown> }));

describe("préflight — forms costum vs contrat de l'artefact", () => {
  it("aucun champ n'envoie une valeur que le contrat refuse", () => {
    const problemes: string[] = [];
    let audites = 0;

    for (const { site, cfg } of SITES) {
      const forms = (cfg.costumForms ?? {}) as Record<string, Record<string, unknown>>;
      for (const [formId, form] of Object.entries(forms)) {
        const slug = form.costumSlug as string | undefined;
        const coll = (form.collection ?? form.entityType) as string;
        const bundle = slug ? CONTRAT.costums[slug]?.[coll] : undefined;
        const live = slug ? LIVE.costums[slug]?.[coll] : undefined;
        if (!bundle && !live) continue; // aucun contrat connu pour ce costum

        for (const [champ, def] of Object.entries((form.fields ?? {}) as Record<string, Record<string, unknown>>)) {
          const dansBundle = bundle?.[champ];
          const dansLive = live?.[champ];
          if (dansBundle === undefined && dansLive === undefined) continue; // champ CŒUR
          if (def.renderOnly || def.readOnly || def.group) continue; // jamais émis (fieldPipeline:85) / membre de groupe
          const write = typeof def.write === "string" ? def.write : undefined;
          // `valueSelect` est multi par DÉFAUT mais scalaire en `widgetProps.multiple:false` — le
          // compilateur fait la même bascule (`buildField`, qui cite `financementSource`). Sans elle la
          // garde criait au loup sur un champ correct.
          const mono = def.widget === "valueSelect"
            && (def.widgetProps as { multiple?: boolean } | undefined)?.multiple === false;
          const envoie = write ? TYPE_WRITE[write] : mono ? "string" : TYPE_WIDGET[String(def.widget)];
          if (!envoie) continue;                        // widget composite / write métier → non audité
          audites++;
          const cle = `${site.replace("config.prod.", "").replace(".json", "")} · ${formId}.${champ}`;
          // Les deux fixtures portent le MÊME objet : un sous-schéma AJV. Une seule lecture, donc.
          const contrats: Array<[string, Set<string>]> = [
            ...(dansBundle !== undefined ? [["bundle", typesAcceptes(dansBundle)] as [string, Set<string>]] : []),
            ...(dansLive !== undefined ? [["live", typesAcceptes(dansLive)] as [string, Set<string>]] : []),
          ];
          for (const [nom, acceptes] of contrats) {
            if (!acceptes.size || acceptes.has(envoie) || DETTE_CONNUE.has(cle)) continue;
            problemes.push(
              `[${nom}] ${cle} : widget=${def.widget}${write ? ` write=${write}` : ""} envoie ${envoie}, `
              + `contrat accepte {${[...acceptes].join("|")}}`
              + (write ? "" : " — déclarer un `write` de sérialisation"),
            );
          }
        }
      }
    }

    expect(audites).toBeGreaterThan(50); // garde-fou : la garde audite bien quelque chose
    expect(problemes).toEqual([]);
  });

  it("la DETTE_CONNUE est encore réelle (garde anti-péremption)", () => {
    // Une entrée de dette dont l'écart a disparu doit être RETIRÉE, pas traînée : sinon elle masquerait
    // un futur vrai problème au même endroit. On re-évalue chaque entrée ; si elle ne produit plus
    // d'écart, le test le dit explicitement.
    const encoreEnEcart = new Set<string>();
    for (const { site, cfg } of SITES) {
      const forms = (cfg.costumForms ?? {}) as Record<string, Record<string, unknown>>;
      for (const [formId, form] of Object.entries(forms)) {
        const slug = form.costumSlug as string | undefined;
        const coll = (form.collection ?? form.entityType) as string;
        const bundle = slug ? CONTRAT.costums[slug]?.[coll] : undefined;
        const live = slug ? LIVE.costums[slug]?.[coll] : undefined;
        for (const [champ, def] of Object.entries((form.fields ?? {}) as Record<string, Record<string, unknown>>)) {
          const cle = `${site.replace("config.prod.", "").replace(".json", "")} · ${formId}.${champ}`;
          if (!DETTE_CONNUE.has(cle)) continue;
          const write = typeof def.write === "string" ? def.write : undefined;
          const envoie = write ? TYPE_WRITE[write] : TYPE_WIDGET[String(def.widget)];
          if (!envoie) continue;
          for (const dans of [bundle?.[champ], live?.[champ]]) {
            if (dans === undefined) continue;
            const acceptes = typesAcceptes(dans);
            if (acceptes.size && !acceptes.has(envoie)) encoreEnEcart.add(cle);
          }
        }
      }
    }
    const perimees = [...DETTE_CONNUE].filter((c) => !encoreEnEcart.has(c));
    expect(perimees, "entrées de DETTE_CONNUE dont l'écart a disparu — les retirer").toEqual([]);
  });
});
