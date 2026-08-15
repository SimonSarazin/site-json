import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { formatNow } from "@/modules/profil/forms/stamps";

/**
 * PRÉFLIGHT des `mutation.stamps` (toutes les configs, pas seulement celles chargées au runtime) :
 *
 *  1. `on: edit|both` + `op: set` sur un champ PRÉSENT dans `fields` du form = INTERDIT — le stamp
 *     écraserait silencieusement la saisie de l'utilisateur à chaque édition. `fillIfEmpty`/`append`
 *     restent permis (ils composent avec la saisie).
 *  2. Format `$now` : après consommation des jetons (`jj j MM M aaaa`), il ne doit rester AUCUNE
 *     lettre — un jeton inconnu (`yyyy`, `dd`…) partirait tel quel dans la valeur écrite.
 *  3. `op: append` + canal `pathValue` = non supporté (v1) — le moteur l'ignore avec un warn ;
 *     autant échouer dès le préflight.
 *  4. Grammaire : clés inconnues / enums invalides (le zod du registre ne valide que les forms
 *     effectivement enregistrés au runtime).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface StampDecl {
  field?: string;
  value?: unknown;
  op?: string;
  on?: string;
  channel?: string;
  [k: string]: unknown;
}

// `_comment` n'est PAS toléré : cf. tests/preflight/no-config-comments.test.ts (clé non
// schématisée, rabotée ou conservée selon l'endroit où elle tombe).
const CLES = new Set(["field", "value", "op", "on", "channel"]);
const OPS = new Set(["set", "fillIfEmpty", "append"]);
const ONS = new Set(["add", "edit", "both"]);
const CHANNELS = new Set(["payload", "pathValue"]);

const SITES = readdirSync(ROOT)
  .filter((f) => /^config\.prod\..+\.json$/.test(f))
  .sort()
  .map((f) => ({ site: f, cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")) as Record<string, unknown> }));

function stampsDe(cfg: Record<string, unknown>): Array<{ formId: string; fields: Set<string>; stamps: StampDecl[] }> {
  const out: Array<{ formId: string; fields: Set<string>; stamps: StampDecl[] }> = [];
  const forms = (cfg.costumForms ?? {}) as Record<string, Record<string, unknown> | undefined>;
  for (const [formId, doc] of Object.entries(forms)) {
    const stamps = (doc?.mutation as { stamps?: StampDecl[] } | undefined)?.stamps;
    if (!stamps?.length) continue;
    out.push({ formId, fields: new Set(Object.keys((doc?.fields as Record<string, unknown>) ?? {})), stamps });
  }
  return out;
}

describe("préflight mutation.stamps", () => {
  const problemes: string[] = [];

  for (const { site, cfg } of SITES) {
    for (const { formId, fields, stamps } of stampsDe(cfg)) {
      stamps.forEach((s, i) => {
        const ou = `${site} ${formId} stamps[${i}]`;
        // 4. grammaire
        if (!s.field || typeof s.field !== "string") problemes.push(`${ou} : field manquant`);
        for (const k of Object.keys(s)) if (!CLES.has(k)) problemes.push(`${ou} : clé inconnue « ${k} »`);
        if (s.op !== undefined && !OPS.has(s.op)) problemes.push(`${ou} : op invalide « ${s.op} »`);
        if (s.on !== undefined && !ONS.has(s.on)) problemes.push(`${ou} : on invalide « ${s.on} »`);
        if (s.channel !== undefined && !CHANNELS.has(s.channel)) problemes.push(`${ou} : channel invalide « ${s.channel} »`);
        // 1. edit + set sur champ visible
        const enEdit = s.on === "edit" || s.on === "both";
        if (enEdit && (s.op ?? "set") === "set" && s.field && fields.has(s.field)) {
          problemes.push(`${ou} : op "set" en édition sur le champ visible « ${s.field} » — écraserait la saisie (fillIfEmpty/append seuls permis)`);
        }
        // 2. format $now sans jeton inconnu
        const v = s.value;
        if (typeof v === "object" && v !== null && "$now" in v) {
          const format = String((v as { $now: unknown }).$now);
          const reste = format.replace(/jj|j|MM|M|aaaa/g, "");
          if (/[A-Za-z]/.test(reste)) problemes.push(`${ou} : format $now « ${format} » porte des jetons inconnus (« ${reste} »)`);
          // le format doit produire quelque chose de plausible (fume-test déterministe)
          expect(formatNow(format, new Date(2026, 0, 5)).length).toBeGreaterThan(0);
        }
        // 3. append sur pathValue
        if (s.op === "append" && s.channel === "pathValue") {
          problemes.push(`${ou} : op "append" non supporté sur le canal pathValue (v1) — utiliser le canal payload`);
        }
      });
    }
  }

  it("aucune déclaration de stamp invalide dans les configs", () => {
    expect(problemes).toEqual([]);
  });

  it("les stamps du parc sont bien là où on les attend (sentinelle d'inventaire)", () => {
    const parc = SITES.flatMap(({ site, cfg }) => stampsDe(cfg).map(({ formId, stamps }) => `${site.replace("config.prod.", "").replace(".json", "")}/${formId}:${stamps.length}`));
    expect(parc).toEqual([
      "institut-bleu/institut-bleu-acteur:2",
      // RELIEF dérive de la config tiers-lieux, dont il reprend le form et ses 5 stamps.
      "relief/tiers-lieux:5",
      // Référencement régional posé à la création : la fiche appartient au costum COMMUNAL
      // (`source.key`) et est RÉFÉRENCÉE par `equipementsSportifs974`, qui la voit via la
      // traduction serveur `sourceKey` → `$or[source.keys, reference.costum]`.
      "saint-paul-sport/equipements-sportifs:2",
      // Idem pour les ARTICLES du site communal. Chaque form pose DEUX stamps : le référencement
      // lui-même (`reference.costum`) et l'ANNOTATION de sous-type
      // (`reference.costumTypes.<slug régional>`) — le second champ que pose l'action de
      // référencement de l'admin, et qui classe une fiche référencée (elle n'a aucun discriminant
      // natif du costum d'accueil). Sans lui, un passage du régional à `costumSubType` exigerait un
      // backfill de toutes les fiches.
      "saint-paul-sport/saintpaul-article:2",
      // Idem pour les ÉVÉNEMENTS. L'annotation y est moins portante (la collection `events` n'est
      // pas polymorphe, contrairement à `poi` qui porte équipements ET articles) : elle est posée
      // pour l'uniformité des trois forms du site et pour éviter un backfill ultérieur.
      "saint-paul-sport/saintpaul-event:2",
      "tiers-lieux/tiers-lieux:5",
    ]);
  });
});
