import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { RESOURCE_NOTE_KEYS, RESOURCE_TAG_KEYS } from "@/modules/search/lib/resourceDetails";

/**
 * GARDE « MÊME DÉTAIL QUE LA FICHE » de l'annuaire des ressources.
 *
 * Le détail d'une ressource dans l'annuaire (`coform-resource-directory`,
 * `resourceTypes[].detailSuffixes`) doit montrer les mêmes champs que celui de la fiche du lieu
 * (`profile-about-tl`, `roomPath`/`coworkingPath`/`bedRoomPath`). Les deux configs déclarent ces
 * champs chacune de leur côté, pour le MÊME formulaire (`resourceTypes[].formId` = `<path>.id`) : si
 * l'une change sans l'autre, l'annuaire montre d'autres blocs que la fiche sans que rien n'échoue.
 * Cette garde compare les deux, champ par champ, pour chaque formulaire présent des deux côtés.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DETAIL_KEYS = [...RESOURCE_TAG_KEYS, ...RESOURCE_NOTE_KEYS];

type Json = Record<string, unknown>;

/** Suffixe d'input d'un chemin `<étape>.<étape><suffixe>` de la fiche. */
function suffixeDuChemin(chemin: string): string | undefined {
  const [etape, input] = chemin.split(".");
  return etape && input?.startsWith(etape) ? input.slice(etape.length) : undefined;
}

function* parcourir(o: unknown): Generator<Json> {
  if (Array.isArray(o)) for (const v of o) yield* parcourir(v);
  else if (o && typeof o === "object") {
    yield o as Json;
    for (const v of Object.values(o)) yield* parcourir(v);
  }
}

/** Écarts `section/formId.clé : fiche=… annuaire=…` d'une config — vide si les deux côtés concordent. */
function ecartsDetail(cfg: unknown): string[] {
  const fiche = new Map<string, Json>();
  // Liste et non dictionnaire : plusieurs sections annuaire peuvent déclarer le même formulaire
  // (`/annuaire-ressources` et `/reservation`) — chacune est vérifiée.
  const annuaire: Array<{ section: string; formId: string; suffixes: Json }> = [];
  for (const node of parcourir(cfg)) {
    if (node.type === "profile-about-tl") {
      for (const cle of ["roomPath", "coworkingPath", "bedRoomPath"]) {
        const p = node[cle] as Json | undefined;
        if (p && typeof p.id === "string") fiche.set(p.id, p);
      }
    }
    if (node.type === "coform-resource-directory") {
      const types = ((node.props as Json | undefined)?.resourceTypes ?? []) as Json[];
      for (const rt of types) {
        if (rt.detailSuffixes && typeof rt.formId === "string") {
          annuaire.push({ section: String(node.id ?? "?"), formId: rt.formId, suffixes: rt.detailSuffixes as Json });
        }
      }
    }
  }
  const ecarts: string[] = [];
  for (const { section, formId, suffixes } of annuaire) {
    const chemins = fiche.get(formId);
    if (!chemins) continue;
    for (const cle of DETAIL_KEYS) {
      const attendu = typeof chemins[cle] === "string" ? suffixeDuChemin(chemins[cle] as string) : undefined;
      const declare = suffixes[cle] as string | undefined;
      if (attendu !== declare) ecarts.push(`${section}/${formId}.${cle} : fiche=${attendu ?? "∅"} annuaire=${declare ?? "∅"}`);
    }
  }
  return ecarts;
}

const SITES = readdirSync(ROOT)
  // Toutes les configs de site à la racine : `config.prod.<slug>.json`, mais aussi `config.prod.json`,
  // `config.dev*.json` et `site-config.json`.
  .filter((f) => /^(config\..+|site-config)\.json$/.test(f))
  .sort()
  .map((f) => ({ site: f, cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")) as unknown }));

describe("Préflight — détail des ressources : annuaire = fiche du lieu", () => {
  it.each(SITES)("$site : mêmes champs de détail des deux côtés", ({ cfg }) => {
    expect(ecartsDetail(cfg)).toEqual([]);
  });

  it("détecte un champ qui diverge, manque ou est en trop", () => {
    const cfg = {
      a: { type: "profile-about-tl", roomPath: { id: "F", equipments: "s_0.s_0AAA", tip: "s_0.s_0TIP" } },
      b: { type: "coform-resource-directory", id: "s1", props: { resourceTypes: [{ formId: "F", detailSuffixes: { equipments: "BBB", about: "X" } }] } },
    };
    expect(ecartsDetail(cfg)).toEqual([
      "s1/F.equipments : fiche=AAA annuaire=BBB",
      "s1/F.about : fiche=∅ annuaire=X",
      "s1/F.tip : fiche=TIP annuaire=∅",
    ]);
  });
});
