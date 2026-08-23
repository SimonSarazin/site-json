/**
 * Test d'intégration de la PROPAGATION DES TAGS (chantier 2026-08-09) : un tiers-lieu créé via le
 * form costum doit porter dans `tags` les LIBELLÉS que les facettes du search filtrent — sinon il
 * est invisible aux facettes (le bug corrigé). On fait tourner la VRAIE chaîne client
 * (specToConfig → buildSpec → buildPayload pipeline → applyPayloadStamps) et on vérifie que chaque
 * tag propagé est EXACTEMENT une valeur du vocabulaire de la config (options de facette
 * typologies/portage, valueMap surface de l'observatoire). Ça prouve « matche les facettes » et
 * verrouille le couplage libellés signalé dans doc-projets/tiers-lieux.md §12 (renommer une option
 * de facette sans ajuster la map du stamp, ou l'inverse, casse ce test).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { EntityTypes } from "@communecter/cocolight-api-client";

import { specToConfig } from "../../resolveModalSpec";
import { applyPayloadStamps } from "../../stamps";
import { getDefaultTiersLieuxValues, type CostumConfig } from "./fns";
import type { EntityModalCtx } from "../../entityModalSpec";
import { loadCostumForm } from "../__fixtures__/configCostum";

// ── vocabulaires lus dans LA MÊME config que le search (source de vérité des valeurs cherchées) ──
const raw = JSON.parse(fs.readFileSync(path.resolve("config.prod.tiers-lieux.json"), "utf-8"));

/** Noms d'options de TOUTE facette `filterGroups` d'id donné (typologies/portage filtrent `tags`). */
function facetOptionNames(id: string): Set<string> {
  const acc = new Set<string>();
  const walk = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    const node = o as Record<string, unknown>;
    if (node.id === id && Array.isArray(node.options)) {
      for (const x of node.options) if (x && typeof x === "object" && typeof (x as { name?: unknown }).name === "string") acc.add((x as { name: string }).name);
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(raw);
  return acc;
}

/** Libellés de tranche m² reconnus par la dimension observatoire (valeurs de `valueMap` en « …m² »). */
function surfaceLabels(): Set<string> {
  const acc = new Set<string>();
  const walk = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    const node = o as Record<string, unknown>;
    const vm = node.valueMap;
    if (vm && typeof vm === "object") for (const v of Object.values(vm)) if (typeof v === "string" && v.endsWith("m²")) acc.add(v);
    for (const v of Object.values(node)) walk(v);
  };
  walk(raw);
  return acc;
}

const typologies = facetOptionNames("typologies");
const portage = facetOptionNames("portage");
const surfaces = surfaceLabels();

describe("tiers-lieux — propagation des tags → matche les facettes du search", () => {
  const { spec } = loadCostumForm("tiers-lieux");
  const config = specToConfig(spec);
  const carrier = { id: "c", serverData: { slug: "franceTiersLieux" } } as unknown as EntityTypes;
  const costum: CostumConfig = { mainTag: "TiersLieux" };
  const scope = config.resolveScope!(carrier);

  /** Le payload complet (pipeline + stamps) d'un lieu saisi via le form, en mode `add`. */
  const buildTags = (form: Record<string, unknown>): string[] => {
    const ctx: EntityModalCtx = { mode: "add", parent: null, scope, me: { id: "m" } as unknown as EntityTypes, carrier, costum };
    const mut = config.buildSpec(ctx);
    const payload = applyPayloadStamps(mut.buildPayload(form as never), mut.stamps, { mode: "add" });
    return (payload.tags as string[]) ?? [];
  };

  // Cas de référence : 2 typologies + portage SCIC + 350 m².
  const form = {
    ...getDefaultTiersLieuxValues(),
    name: "TL test", shortDescription: "d", email: "a@b.fr",
    family: ["coworking", "fablab"], managementType: "scic", surfaceBuilt: "350",
  } as Record<string, unknown>;
  const tags = buildTags(form);

  it("les fixtures de facette existent (garde d'assertion vide)", () => {
    expect(typologies.size).toBeGreaterThanOrEqual(8);
    expect(portage.size).toBeGreaterThanOrEqual(9);
    expect(surfaces.size).toBe(3);
  });

  it("mainTag + typologies + portage + tranche m² sont dans tags", () => {
    expect(tags).toEqual(
      expect.arrayContaining([
        "TiersLieux",
        "Bureaux partagés / Coworking",
        "Fablab / Makerspace / Hackerspace (Espaces du Faire)",
        "SCIC",
        "Plus de 200m²",
      ]),
    );
  });

  it("CHAQUE tag propagé (hors marqueurs costum) est une valeur de facette/observatoire — donc filtrable", () => {
    const vocab = new Set<string>([...typologies, ...portage, ...surfaces]);
    const markers = new Set(["TiersLieux", "Compagnon France Tiers-Lieux"]);
    const propages = tags.filter((t) => !markers.has(t));
    expect(propages.length).toBeGreaterThan(0);
    for (const t of propages) expect(vocab.has(t), `« ${t} » n'est aucune valeur de facette/observatoire → invisible au search`).toBe(true);
  });

  it("chaque axe tombe dans la BONNE facette", () => {
    expect(typologies.has("Bureaux partagés / Coworking")).toBe(true);
    expect(portage.has("SCIC")).toBe(true);
    expect(surfaces.has("Plus de 200m²")).toBe(true);
  });

  it("seuils m² (port legacy) : 45→<60, 60→60-200, 200→60-200, 201→>200 ; vide → pas de tag surface", () => {
    const m2 = (v: string) => buildTags({ ...form, surfaceBuilt: v }).filter((t) => surfaces.has(t));
    expect(m2("45")).toEqual(["Moins de 60m²"]);
    expect(m2("60")).toEqual(["Entre 60 et 200m²"]);
    expect(m2("200")).toEqual(["Entre 60 et 200m²"]);
    expect(m2("201")).toEqual(["Plus de 200m²"]);
    expect(m2("")).toEqual([]);
  });

  it("aucune typologie/portage saisie → aucun tag parasite (seuls les marqueurs costum)", () => {
    const vide = buildTags({ ...getDefaultTiersLieuxValues(), name: "x", shortDescription: "d", email: "a@b.fr", managementType: "public" });
    // managementType "public" n'est pas une clé de la map portage → aucun libellé propagé
    expect(vide.filter((t) => portage.has(t) || typologies.has(t) || surfaces.has(t))).toEqual([]);
  });
});
