/**
 * Préflight du PÉRIMÈTRE des modales costum — QUEL formulaire s'ouvre, et SUR QUOI.
 *
 * Deux volets, deux dangers symétriques :
 *  · ÉDITION (`profiles.<type>.editModals[]`) — une route trop LARGE ouvre un formulaire costum sur
 *    des entités étrangères ;
 *  · CRÉATION (`admin.tabs[].sections[].create`) — un `inherit` AMBIGU (plusieurs forms costum du
 *    même `entityType`) laisse le choix à un départage qui doit rester déterministe.
 *
 * ── volet ÉDITION ──
 *
 * Le danger : une route SANS condition est un catch-all — le formulaire costum s'ouvre sur TOUTES
 * les entités du type, y compris étrangères au costum. Constaté le 03/08 sur institutBleu, où le
 * formulaire acteur s'ouvrait sur les ~29 400 organisations du site. Rien ne le signalait :
 * `config:validate` accepte l'absence de condition (c'est un usage légitime pour un form non costum)
 * et `audit:config` ne vérifie que les références mortes.
 *
 * Le sous-type ne suffit PAS à borner : `editModalMatch: {type:"recoveryCenter"}` laisse passer
 * 3 079 POI d'autres costums. Seule la provenance borne — et elle n'est portée par aucun champ plat
 * (`source.key`/`source.keys`, exposés `sourceKey`/`sourceKeys` ; `reference.costum` pour le
 * rattachement secondaire), d'où le prédicat `when`.
 *
 * Ce test échoue sur toute NOUVELLE route costum non bornée. Les cas connus non traités sont dans
 * `DETTE_CONNUE` : les y laisser est un choix explicite, les corriger n'exige que de retirer la ligne.
 */
import { describe, test, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveCreateModal, type CostumFormDocLike } from "@/modules/admin/sections/resourceHelpers";
import type { AdminResourceSection } from "@/modules/admin/schema";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const sites: { slug: string; config: string }[] = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);

/**
 * Routes costum sciemment laissées non bornées, `"<config> · <chemin>"` → raison.
 * Toute entrée ici est une entité étrangère qui peut ouvrir un formulaire costum : à résorber.
 */
const DETTE_CONNUE: Record<string, string> = {
  "config.prod.tiers-lieux.json · profiles.organizations.editModal":
    "LAISSÉ TEL QUEL sur décision du porteur. Réseau FÉDÉRÉ : ses listes sont scopées sur TROIS provenances (franceTierslieux + tierslieuxbelgique + navigatorDesTierslieux = 4 274 organisations) alors que son formulaire s'ouvre sur le tag `TiersLieux` (4 318). Recouvrement de 98 %, divergence des deux côtés : 84 organisations listées et NON éditables, 128 éditables et non listées. Si on le borne un jour, le `when` doit porter la LISTE des 3 slugs (`op:\"in\"`), pas un slug unique",
};


interface Route {
  where: string;
  editModal?: string;
  hasWhen: boolean;
}

/** Toutes les routes d'édition déclarées par une config, avec leur chemin lisible. */
function collectRoutes(config: Record<string, unknown>): Route[] {
  const out: Route[] = [];
  const profiles = (config.profiles ?? {}) as Record<string, Record<string, unknown> | undefined>;
  for (const [kind, profile] of Object.entries(profiles)) {
    if (!profile || typeof profile !== "object") continue;
    const table = profile.editModals;
    if (Array.isArray(table)) {
      table.forEach((raw, i) => {
        const route = raw as { editModal?: string; when?: unknown };
        out.push({
          where: `profiles.${kind}.editModals[${i}]`,
          editModal: route.editModal,
          hasWhen: route.when !== undefined,
        });
      });
    }
    if (typeof profile.editModal === "string") {
      out.push({
        where: `profiles.${kind}.editModal`,
        editModal: profile.editModal,
        hasWhen: profile.when !== undefined,
      });
    }
  }
  return out;
}

describe("Préflight — périmètre des modales d'édition costum", () => {
  for (const site of sites) {
    const configPath = path.join(PROJECT_ROOT, site.config);
    if (!fs.existsSync(configPath)) continue;
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    const costumForms = (config.costumForms ?? {}) as Record<string, unknown>;
    const routes = collectRoutes(config);
    if (!routes.length) continue;

    describe(site.config, () => {
      test("toute route vers un formulaire COSTUM est bornée par un prédicat `when`", () => {
        const nonBornees = routes
          .filter((r) => {
            // Seuls les formulaires costum sont concernés : `edit-profile` (générique) est
            // universel par nature, et une clé absente de `costumForms` est signalée par
            // l'audit `ref-morte` — pas ici.
            const id = r.editModal?.replace(/^edit-/, "");
            return id !== undefined && id in costumForms && !r.hasWhen;
          })
          .map((r) => `${site.config} · ${r.where}`)
          .filter((cle) => !(cle in DETTE_CONNUE));

        expect(
          nonBornees,
          `Route(s) costum sans clause de périmètre — le formulaire s'ouvrira sur TOUTES les entités du type,\n` +
            `y compris étrangères au costum. Ajouter sur chaque route :\n` +
            `  "when": { "or": [ { "field": "sourceKeys", "op": "contains", "value": "<slugCostum>" },\n` +
            `                    { "field": "reference.costum", "op": "contains", "value": "<slugCostum>" } ] }\n` +
            `(le sous-type ne borne PAS : "type" n'est pas costum-spécifique). Si l'ouverture large est\n` +
            `VOULUE, inscrire la route dans DETTE_CONNUE avec sa justification.`,
        ).toEqual([]);
      });
    });
  }

  test("DETTE_CONNUE ne contient pas d'entrée périmée (route corrigée ou supprimée)", () => {
    const vivantes = new Set<string>();
    for (const site of sites) {
      const configPath = path.join(PROJECT_ROOT, site.config);
      if (!fs.existsSync(configPath)) continue;
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      for (const r of collectRoutes(config)) {
        if (!r.hasWhen) vivantes.add(`${site.config} · ${r.where}`);
      }
    }
    const perimees = Object.keys(DETTE_CONNUE).filter((cle) => !vivantes.has(cle));
    expect(perimees, "Entrée(s) de DETTE_CONNUE sans route correspondante : à supprimer.").toEqual([]);
  });
});

/**
 * Volet CRÉATION. Un site polymorphe déclare légitimement plusieurs forms pour un même
 * `entityType` (Saint-Paul : `poi` porte les équipements ET les actualités). `create: "inherit"`
 * doit alors trancher sur le DISCRIMINANT (`identity` du form contre les `defaultFilters` de la
 * resource), jamais sur l'ordre d'écriture des clés dans le JSON — un reformatage de `costumForms`
 * changerait sinon le formulaire d'ajout de l'admin, en silence et sans qu'aucun test ne bronche.
 *
 * Le test appelle la VRAIE `resolveCreateModal` : il ne peut pas diverger de l'implémentation. Le
 * pas 3 de la fonction (ambiguïté irréductible → modale standard + `console.warn`) est un
 * comportement de repli sûr, pas une cible : aucune config du parc ne doit l'atteindre.
 */
describe("Préflight — création costum : aucun `inherit` ambigu dans le parc", () => {
  for (const site of sites) {
    const configPath = path.join(PROJECT_ROOT, site.config);
    if (!fs.existsSync(configPath)) continue;
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
      costumForms?: Record<string, CostumFormDocLike>;
      admin?: { tabs?: { id?: string; sections?: unknown[] }[] };
    };
    const resources = (config.admin?.tabs ?? []).flatMap((tab) =>
      (tab.sections ?? [])
        .filter((s): s is AdminResourceSection => (s as { type?: string })?.type === "resource")
        .map((s) => ({ tab: tab.id ?? "?", section: s })),
    );
    if (!resources.length) continue;

    test(site.config, () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const ambigues = resources
        .map(({ tab, section }) => {
          warn.mockClear();
          const modale = resolveCreateModal(section, config.costumForms, site.slug);
          return warn.mock.calls.length
            ? `${site.config} · admin.${tab} (${section.entityType}) → ${modale ?? "null"} ; ${String(warn.mock.calls[0][0])}`
            : null;
        })
        .filter((x): x is string => x !== null);
      warn.mockRestore();

      expect(
        ambigues,
        `Resource(s) dont le « create: inherit » ne se départage pas. Deux sorties :\n` +
          `  · poser un « create": "add-<id>" » explicite sur la section ;\n` +
          `  · ou donner à chaque form candidat une « identity » distincte, compatible avec les\n` +
          `    « source.defaultFilters » de sa resource (ex. {"type":"article"}).\n` +
          `Sans cela le formulaire ouvert dépend de l'ordre des clés dans costumForms.`,
      ).toEqual([]);
    });
  }
});
