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
import { walkSections, type SectionLike } from "@/lib/sectionContainers";
import { answerToggleArgs, type AnswerGroupConf } from "@/modules/search/lib/answerFilterClause";
import { searchByFieldsToQuery } from "@/modules/search/lib/searchByFieldsToQuery";

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

/** Registre de déploiement `sites.json` (racine) : la SOURCE D'AUTORITÉ du slug porteur — c'est le
 *  costum sous lequel l'app déployée tourne, donc le slug que `useCocolight().entity.slug` verra au
 *  runtime. Une config peut porter PLUSIEURS déploiements (commune-transparente : 6 slugs). */
const DEPLOIEMENTS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  const sites = JSON.parse(readFileSync(join(ROOT, "sites.json"), "utf8")) as Array<{
    slug?: string;
    config?: string;
  }>;
  for (const s of sites) {
    if (!s.config || !s.slug) continue;
    m.set(s.config, [...(m.get(s.config) ?? []), s.slug]);
  }
  return m;
})();

/**
 * Slug du site, statiquement. Autorité : `sites.json` (le slug de déploiement = celui de l'entité
 * porteuse au runtime). Config MULTI-déploiements → null : les projections dépendantes du slug
 * varieraient par déploiement, on les laisse inertes et la fixture matérialise la liste
 * (`deploiements`) pour que tout changement du registre reste visible. Repli si la config n'est
 * pas au registre : `costumSlug` majoritaire des `costumForms`.
 */
function slugDuSite(site: string, cfg: Cfg): { slug: string | null; deploiements: string[] } {
  const deploiements = DEPLOIEMENTS.get(`config.prod.${site}.json`) ?? [];
  if (new Set(deploiements).size === 1) return { slug: deploiements[0], deploiements };
  if (deploiements.length > 1) return { slug: null, deploiements };
  const compte = new Map<string, number>();
  for (const doc of Object.values(cfg.costumForms ?? {})) {
    if (doc?.costumSlug) compte.set(doc.costumSlug, (compte.get(doc.costumSlug) ?? 0) + 1);
  }
  return { slug: [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, deploiements };
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
  const { slug, deploiements } = slugDuSite(site, cfg);
  const forms = cfg.costumForms ?? {};
  const profils = cfg.profiles ?? {};

  /** Clé unique dans une projection : suffixe `#n` dès la 2e occurrence — sans ça, deux sections
   *  homonymes (sport-sante : 2 resources `organizations` dans le même tab) s'écrasent et la
   *  fixture MENT (une section invisible de la garde — défaut trouvé en revue). */
  const cleUnique = (bag: Record<string, unknown>, base: string): string => {
    if (!(base in bag)) return base;
    let n = 1;
    while (`${base}#${n}` in bag) n += 1;
    return `${base}#${n}`;
  };

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
      addMenus[cleUnique(addMenus, type)] = { builtins, ...(customs.length ? { customs } : {}) };
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
      adminResources[cleUnique(adminResources, `${tab.id}/${s.entityType}`)] = {
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

  // ── Pages PUBLIQUES : tout `props.baseParams` porté par une section de page, APRÈS expansion —
  //    c'est la surface de `/bibliotheque` et `/financements` (useSearchQuery/prefetch), que la
  //    première version ne couvrait pas (défaut trouvé en revue : seul l'admin était projeté).
  //    Le parcours passe par `walkSections` (registre partagé avec le prefetch SSR) : une section
  //    imbriquée dans un `tabs`/`gridLayout` interroge le backend comme les autres, et une boucle
  //    À PLAT la rate en silence — 11 sections du parc étaient hors garde (revue MR !35).
  const pages: Record<string, unknown> = {};
  for (const page of (cfg.pages as Array<Record<string, unknown>> | undefined) ?? []) {
    const sections = (page.sections as SectionLike[] | undefined) ?? [];
    for (const section of walkSections(sections)) {
      const props = section.props as { baseParams?: Record<string, unknown> } | undefined;
      if (!props?.baseParams) continue;
      pages[cleUnique(pages, `${page.path}/${section.type}`)] = {
        baseParams: expandCostumSubType(structuredClone(props.baseParams) as never, forms, slug),
      };
    }
  }

  // ── Facettes « par réponses » : pour chaque groupe `filtersByAnswers`/`filtersByPath`, le
  //    filtre Mongo RÉELLEMENT émis au clic sur une valeur — calculé par les fonctions pures de
  //    l'app (`answerToggleArgs` + `searchByFieldsToQuery`), sur une valeur témoin.
  //    Sans cette projection la garde était AVEUGLE à ce chemin : aucune fixture ne portait de
  //    `filtersByAnswers`, alors que 3 configs du parc en déclarent 11 groupes — et le bug des
  //    facettes mortes de `/creneaux` (filtre par `_id` d'organisation sur une liste d'answers)
  //    serait passé en revue sans laisser la moindre trace.
  const answerFacets: Record<string, unknown> = {};
  const VALEUR_TEMOIN = "Valeur";
  const ORGA_TEMOIN = "000000000000000000000000";
  for (const page of (cfg.pages as Array<Record<string, unknown>> | undefined) ?? []) {
    const sections = (page.sections as SectionLike[] | undefined) ?? [];
    for (const section of walkSections(sections)) {
      const props = section.props as
        | {
            filtersByAnswers?: Record<string, AnswerGroupConf>;
            filtersByPath?: Record<string, AnswerGroupConf>;
          }
        | undefined;
      const groupes = { ...(props?.filtersByAnswers ?? {}), ...(props?.filtersByPath ?? {}) };
      for (const [groupId, conf] of Object.entries(groupes)) {
        const { field, value, fieldType } = answerToggleArgs(conf, VALEUR_TEMOIN, {
          name: VALEUR_TEMOIN,
          orgaNameArray: [ORGA_TEMOIN],
        });
        const entry = fieldType ? { field, type: fieldType, value } : { field, value };
        answerFacets[cleUnique(answerFacets, `${page.path}/${groupId}`)] = {
          target: conf.filterTarget ?? "linkedElements",
          searchByField: entry,
          filters: searchByFieldsToQuery({ [VALEUR_TEMOIN]: entry }).filters,
        };
      }
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
        referencement[cleUnique(referencement, et)] = {
          sousTypes,
          annotation: sousTypes.length > 0 && slug ? cheminAnnotation(slug) : null,
        };
      }
    }
  }

  // ── Stamps de mutation : par form, la liste NORMALISÉE (défauts matérialisés : op/on/channel) —
  //    un changement des défauts du moteur (stamps.ts) diffe les fixtures des sites déclarants.
  const stamps: Record<string, unknown> = {};
  for (const [formId, doc] of Object.entries(forms)) {
    const liste = ((doc as { mutation?: { stamps?: Array<Record<string, unknown>> } } | undefined)?.mutation?.stamps) ?? [];
    if (liste.length === 0) continue;
    stamps[formId] = liste.map((s) => ({
      field: s.field,
      value: s.value,
      op: s.op ?? "set",
      on: s.on ?? "add",
      channel: s.channel ?? "payload",
    }));
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
      profileRelated[cleUnique(profileRelated, `${type}/${section.entityType ?? section.relationType ?? "?"}`)] = {
        scope: (section.scope as string | undefined) ?? "network",
      };
    }
  }

  return {
    site,
    slug,
    ...(deploiements.length > 1 ? { deploiements } : {}),
    addMenus,
    editModals,
    adminResources,
    pages,
    ...(Object.keys(stamps).length ? { stamps } : {}),
    ...(Object.keys(answerFacets).length ? { answerFacets } : {}),
    referencement,
    membership,
    profileRelated,
  };
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
