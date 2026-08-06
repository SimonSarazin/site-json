import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { costumCreateKey } from "@/modules/profil/components/action-buttons/AddEntityDropdown";
import { resolveEditModalName } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { LISTES } from "@/modules/profil/components/tabs/MembershipTab";
import { resolveCreateModal, resolveEditModal } from "@/modules/admin/sections/resourceHelpers";
import type { AdminResourceSection } from "@/modules/admin/schema";
import {
  expandCostumSubType,
  formsDeCollection,
  cheminAnnotation,
  type CostumFormSubTypeLike,
} from "@/modules/search/lib/costumSubType";

/**
 * GARDE D'IMPACT INTER-CONFIGS — étage 2 : le « comportement résolu par site ».
 *
 * Pour chaque `config.prod.*.json`, ce test matérialise une projection SÉMANTIQUE calculée par les
 * MÊMES fonctions pures que l'app (résolution des menus d'ajout, des routes d'édition, des
 * baseParams admin expansés, des sous-types de référencement, des défauts membership), et la
 * compare à une fixture committée (`__effective__/<site>.json`).
 *
 * L'effet recherché : tout changement de CODE PARTAGÉ qui altère le comportement effectif d'un
 * site — même un site dont on ne touche pas la config — apparaît comme un diff de SA fixture.
 * Mettre à jour la fixture (`vitest -u`) est l'acte EXPLICITE « oui, cet impact est voulu »,
 * site par site, visible en revue. Précédent mesuré : `costumCreateKey` a rerouté les boutons
 * « Créer » de 5 sites sans qu'aucun signal n'existe ; cette garde l'aurait montré en 5 diffs.
 *
 * Étage 1 (qui est exposé à une clé) : `npm run config:surface -- --key <nom>`.
 * Limite assumée : couvre la résolution pure, pas le rendu (labels, CSS).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

interface FormDoc extends CostumFormSubTypeLike {
  [k: string]: unknown;
}
type Cfg = Record<string, unknown> & {
  costumForms?: Record<string, FormDoc>;
  profiles?: Record<string, Record<string, unknown> | undefined>;
  admin?: { tabs?: Array<Record<string, unknown>> };
};

const SITES = readdirSync(ROOT)
  .filter((f) => /^config\.prod\..+\.json$/.test(f))
  .sort()
  .map((f) => ({
    site: f.replace(/^config\.prod\./, "").replace(/\.json$/, ""),
    cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")) as Cfg,
  }));

/** Slug du site, statiquement : le `costumSlug` MAJORITAIRE des costumForms (null sans forms) —
 *  même dérivation d'autorité que `formsDeCollection`/`costumCreateKey` au runtime. */
function slugDuSite(cfg: Cfg): string | null {
  const compte = new Map<string, number>();
  for (const doc of Object.values(cfg.costumForms ?? {})) {
    if (doc?.costumSlug) compte.set(doc.costumSlug, (compte.get(doc.costumSlug) ?? 0) + 1);
  }
  return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Pose `chemin.pointé` en profondeur (les probes des routes d'édition en ont besoin). */
function poser(obj: Record<string, unknown>, chemin: string, valeur: unknown): void {
  const parts = chemin.split(".");
  let ref = obj;
  for (const p of parts.slice(0, -1)) {
    if (typeof ref[p] !== "object" || ref[p] === null) ref[p] = {};
    ref = ref[p] as Record<string, unknown>;
  }
  ref[parts[parts.length - 1]] = valeur;
}

/** Entité-sonde minimale : `resolveEditModalName` ne lit que `getEntityType()` + `serverData`. */
function sonde(collection: string, serverData: Record<string, unknown>) {
  return { getEntityType: () => collection, serverData } as never;
}

interface RouteDecl {
  editModal?: string;
  editModalMatch?: Record<string, unknown>;
  when?: unknown;
}

/** Les routes déclarées d'un profil, dans l'ordre du registry (table `editModals`, puis la paire
 *  historique `editModal`/`editModalMatch` à plat). */
function routesDe(profil: Record<string, unknown> | undefined): RouteDecl[] {
  if (!profil) return [];
  const table = Array.isArray(profil.editModals) ? (profil.editModals as RouteDecl[]) : [];
  const plate = profil.editModal
    ? [{ editModal: profil.editModal as string, editModalMatch: profil.editModalMatch as never, when: profil.when }]
    : [];
  return [...table, ...plate].filter((r) => r.editModal);
}

function projeter(site: string, cfg: Cfg) {
  const slug = slugDuSite(cfg);
  const forms = cfg.costumForms ?? {};
  const profils = cfg.profiles ?? {};

  // ── Menus d'ajout : par type de profil, la modale EFFECTIVE de chaque builtin activé + customs.
  const addMenus: Record<string, unknown> = {};
  for (const [type, profil] of Object.entries(profils)) {
    for (const section of (profil?.sections as Array<Record<string, unknown>> | undefined) ?? []) {
      const ac = section.addConfig as Record<string, unknown> | undefined;
      if (!ac) continue;
      const builtins: Record<string, string> = {};
      for (const t of ["organization", "project", "event", "poi"] as const) {
        if (ac[t] === false) continue;
        builtins[t] = costumCreateKey(t, forms, slug ?? undefined) ?? `add-${t}`;
      }
      const customs = ((ac.custom as Array<{ modalKey?: string }> | undefined) ?? [])
        .map((c) => c.modalKey)
        .filter(Boolean);
      addMenus[type] = { builtins, ...(customs.length ? { customs } : {}) };
    }
  }

  // ── Routes d'édition : résolution RÉELLE sur des sondes — une « native » (champs du match +
  //    périmètre du site) et une « hors périmètre » (mêmes champs, sans provenance) par route,
  //    plus une sonde vierge par collection. C'est ce qui rend visibles les changements de
  //    SÉMANTIQUE du matcher (lookup plat → chemins pointés, clauses `when`…).
  const editModals: Record<string, unknown> = {};
  for (const [collection, profil] of Object.entries(profils)) {
    const routes = routesDe(profil);
    if (routes.length === 0) continue;
    const resolue = (sd: Record<string, unknown>) => resolveEditModalName(sonde(collection, sd), cfg as never);
    editModals[collection] = {
      vierge: resolue({}),
      routes: routes.map((route) => {
        const identite: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(route.editModalMatch ?? {})) poser(identite, k, v);
        const native = structuredClone(identite);
        if (slug) {
          poser(native, "source.keys", [slug]);
          poser(native, "reference.costum", [slug]);
        }
        return { declare: route.editModal, native: resolue(native), horsPerimetre: resolue(identite) };
      }),
    };
  }

  // ── Sections admin `resource` : baseParams APRÈS expansion + modales create/edit résolues.
  const adminResources: Record<string, unknown> = {};
  for (const tab of cfg.admin?.tabs ?? []) {
    for (const section of (tab.sections as Array<Record<string, unknown>> | undefined) ?? []) {
      if (section.type !== "resource") continue;
      const s = section as unknown as AdminResourceSection;
      adminResources[`${tab.id}/${s.entityType}`] = {
        source: expandCostumSubType(
          structuredClone((section.source as Record<string, unknown> | undefined) ?? {}) as never,
          forms,
          slug,
        ),
        create: resolveCreateModal(s, forms as never, slug ?? undefined),
        edit: resolveEditModal(s),
      };
    }
  }

  // ── Référencement : sous-types candidats par collection (= annotation posée ou non).
  const referencement: Record<string, unknown> = {};
  for (const tab of cfg.admin?.tabs ?? []) {
    for (const section of (tab.sections as Array<Record<string, unknown>> | undefined) ?? []) {
      if (section.type !== "reference") continue;
      for (const et of (section.entityTypes as string[] | undefined) ?? []) {
        const sousTypes = formsDeCollection(forms, et, slug)
          .filter((f): f is CostumFormSubTypeLike & { subType: string } => !!f.subType)
          .map((f) => f.subType);
        referencement[et] = {
          sousTypes,
          annotation: sousTypes.length > 0 && slug ? cheminAnnotation(slug) : null,
        };
      }
    }
  }

  // ── Adhésions & relations : listes + périmètre EFFECTIFS (défauts matérialisés — un changement
  //    de défaut du code diffe la fixture de tous les sites qui ne déclarent rien).
  const membership: Record<string, unknown> = {};
  const profileRelated: Record<string, unknown> = {};
  for (const [type, profil] of Object.entries(profils)) {
    for (const tab of (profil?.tabs as Array<Record<string, unknown>> | undefined) ?? []) {
      if (tab.component !== "MembershipTab") continue;
      const props = (tab.props as { types?: string[]; scope?: string } | undefined) ?? {};
      membership[`${type}/${tab.id}`] = {
        types: props.types?.length ? props.types : [...LISTES],
        scope: props.scope ?? "network",
      };
    }
    for (const section of (profil?.sections as Array<Record<string, unknown>> | undefined) ?? []) {
      if (section.type !== "profile-related") continue;
      profileRelated[`${type}/${section.entityType ?? section.relationType ?? "?"}`] = {
        scope: (section.scope as string | undefined) ?? "network",
      };
    }
  }

  return { site, slug, addMenus, editModals, adminResources, referencement, membership, profileRelated };
}

describe("comportement résolu par site (garde d'impact inter-configs)", () => {
  for (const { site, cfg } of SITES) {
    it(site, async () => {
      const projection = projeter(site, cfg);
      await expect(JSON.stringify(projection, null, 2) + "\n").toMatchFileSnapshot(
        `__effective__/${site}.json`,
      );
    });
  }
});
