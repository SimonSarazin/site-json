import { ArrowLeftRight, BadgeCheck, BadgeX, ChevronDown, ChevronUp, CircleCheck, CircleDashed, CircleDot, CirclePlay, CircleX, Link2, MoreHorizontal, Pencil, Plus, Trash2, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCocolight } from "@/hooks/useCocolight";
import { buildSearchPayload } from "@/modules/search/lib/buildSearchPayload";
import { expandCostumSubType } from "@/modules/search/lib/costumSubType";
import { useDebounce } from "@/hooks/useDebounce";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { SEARCH_QUERY_KEYS, SEARCH_STATIC_LIST_PREFIX, SEARCH_STATIC_MAP_PREFIX } from "@/modules/search/constants/queryKeys";
import { useSite } from "@/hooks/useSite";
import { useT } from "@/hooks/useT";
import "@/modules/admin/i18n";
// Effet de bord : enregistre le bundle i18n "modules/search" (clés `days.*`/`card.event.recurring*`,
// utilisées par `formatColumnCell` pour la colonne `startDate` d'un event récurrent). Les autres
// imports `@/modules/search/...` de ce fichier ne garantissent pas cet enregistrement à eux seuls.
import "@/modules/search/i18n";
import SearchTextInput from "@/modules/search/components/SearchTextInput";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { DynamicEditModal } from "@/modules/profil/components/profile-edit/EditModalRegistry";
import { useSearchQuery } from "@/modules/search/hooks/useSearchQuery";
import { validationStatusFilter } from "@/modules/admin/lib/validationFilter";

import type { SearchType } from "@/modules/search/schema";

import { ADMIN_QUERY_KEYS } from "../constants/queryKeys";
import { OwnershipMigrationDialog } from "../components/OwnershipMigrationDialog";
import { useAdminAccess } from "../hooks/useAdminAccess";
import { useDeleteEntity, type DeletableEntity } from "../hooks/useDeleteEntity";
import { useReferenceElement, type AnnotableEntity, type ReferencingCarrier } from "../hooks/useReferenceElement";
import { useSetExclusiveFlag, type ExclusiveFlagEntity } from "../hooks/useSetExclusiveFlag";
import { useValidateGroup, type ValidatableCarrier } from "../hooks/useValidateGroup";
import type { AdminResourceSection, AdminSection } from "../schema";
import { downloadCsv } from "../lib/downloadCsv";
import { ensureCostumScope } from "../lib/ensureCostumScope";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { formatColumnCell, getColumnValue, getPath, readStatusValue, resolveCreateModal, resolveEditModal, type CostumFormDocLike } from "./resourceHelpers";

/** Cellule audio : lecteur du 1er `medias[].url` de type audio de la ligne (ou d'une URL directe). */
function AudioCell({ value }: { value: unknown }) {
  const url = Array.isArray(value)
    ? (value.find((m): m is { type?: string; url?: string } => !!m && typeof m === "object" && (m as { type?: string }).type === "audio")?.url)
    : (typeof value === "string" ? value : undefined);
  if (!url) return <span className="text-muted-foreground">—</span>;
  return <AudioPlayer compact src={url} />;
}

import { toCsv } from "@communecter/cocolight-api-client";
import { toast } from "sonner";

import type { EntityTypes } from "@communecter/cocolight-api-client";

/**
 * Section `resource` (P2) — tableau CRUD générique. Liste via `useSearchQuery` (searchCostum, scopée au
 * carrier), colonnes déclarées en config, actions par-ligne : Éditer (`DynamicEditModal` → form standard OU
 * costum résolu PAR-LIGNE via editModalMatch) et Supprimer (`useDeleteEntity` → `canDeleteElement`).
 * Création via `DynamicModal` (clé `resolveCreateModal`). cf. plan §3/§4.
 */
/** Statut de validation costum, par filtre serveur : Tous / À valider / Validés. */
type StatusFilter = "all" | "pending" | "validated";

/** Tons du badge en mode `statusField` — MÊMES tokens `bg-badge-*` que les badges des cartes
 *  publiques (`getStatusStyle`, search/lib/coformAnswer) : la modération et l'annuaire racontent
 *  le même statut avec les mêmes couleurs. */
const STATUS_TONE_CLASS: Record<string, string> = {
  positive: "bg-badge-valid text-primary-foreground",
  pending: "bg-badge-waiting text-primary-foreground",
  progress: "bg-badge-in-progress text-primary-foreground",
  negative: "bg-badge-refused text-primary-foreground",
};

/** Icône d'une action « Marquer <état> » selon le ton (repère visuel, jamais seule : le libellé porte l'état). */
const STATUS_TONE_ICON: Record<string, typeof CircleDot> = {
  positive: CircleCheck,
  pending: CircleDashed,
  progress: CirclePlay,
  negative: CircleX,
};

export default function AdminResourceTable({ section }: { section: AdminSection }) {
  const resource = section as AdminResourceSection;
  const { entity: carrier, contextId, contextType, me } = useCocolight();
  // Droit-parapluie costum : dans /admin (gate `siteAdmin` = admin du host du costum), l'utilisateur peut
  // éditer/supprimer TOUS les éléments du costum. On pose le flag client `setCostumAdminAuthorized` sur
  // l'entité avant edit/delete pour que la garde lib (_update/_deleteViaElement) ne bloque pas un non-auteur ;
  // le backend reste la source de vérité (canEditItem/canDeleteElement portent isCostumAdmin).
  const adminAccess = useAdminAccess();
  const canCostumAdmin = adminAccess.has("siteAdmin");
  const grantCostumAdmin = <T,>(item: T): T => {
    if (canCostumAdmin) (item as { setCostumAdminAuthorized?: (v?: boolean) => void })?.setCostumAdminAuthorized?.();
    return item;
  };
  // Ouverture de l'édition : la ligne de liste (searchCostum) est ALLÉGÉE — sans les champs `images`/`files`
  // fusionnés par `about`. On (re)charge l'entité COMPLÈTE par id avant d'ouvrir le form, sinon le seed galerie
  // (`getGalleryImages` / `data.files`) est vide → les images/documents EXISTANTS ne s'affichent pas à l'édition.
  // Repli sur la ligne allégée si le chargement échoue (au moins le form s'ouvre).
  const EDIT_LOAD_METHOD: Record<string, "poi" | "organization" | "project" | "event"> = {
    poi: "poi", organizations: "organization", projects: "project", events: "event",
  };
  const openEditEntity = async (item: unknown, realId: string | undefined): Promise<void> => {
    const method = EDIT_LOAD_METHOD[resource.entityType];
    const sdk = me as unknown as Record<string, ((a: { id: string }) => Promise<unknown>) | undefined> | null;
    if (sdk && realId && method && typeof sdk[method] === "function") {
      try {
        const full = await sdk[method]!({ id: realId });
        if (full) { setEditEntity(grantCostumAdmin(full) as unknown as EntityTypes); return; }
      } catch { /* repli sur la ligne allégée */ }
    }
    setEditEntity(grantCostumAdmin(item) as unknown as EntityTypes);
  };
  const t = useT();
  // Second hook nommé : `t` reste réservé aux LocalizedString de config, `tAdmin` au namespace du module.
  const tAdmin = useT("modules/admin");
  // 3ᵉ : clés `days.*`/`card.event.recurring*` (module `search`, réutilisées par `formatColumnCell`
  // pour la colonne `startDate` d'un event récurrent — cf. import "@/modules/search/i18n" plus haut).
  const tSearch = useT("modules/search");
  // Colonnes : `"path"` brut OU `{path, label}` (libellé localisé) — cf. AdminColumnSchema.
  const columns = (resource.columns ?? ["name"]).map((c) =>
    typeof c === "string" ? { path: c, label: undefined, type: undefined, sortable: undefined } : c,
  );
  const rowActions = resource.rowActions ?? ["edit", "delete"];
  const costumSlug = (carrier as { slug?: string } | null)?.slug ?? "";
  // Mode `statusField` (status.mode) : le statut est un CHAMP MÉTIER de serverData (states config),
  // PAS le flag costum toBeValidated — la machinerie costumFlag (variant admin, filtre pending)
  // ne s'applique pas. Les rows restent sur l'endpoint public (les answers n'y sont pas strippées).
  const statusStates = (resource.status?.states ?? []).map((s) => (typeof s === "string" ? { value: s } : s));
  const fieldStatus = resource.status?.mode === "statusField" && statusStates.length > 0 ? resource.status : null;
  // Mode ADMIN (variant SDK `admin` → globalautocompleteadmin, SDK ≥ 1.0.161) dès que la table gère la
  // validation : la projection admin renvoie `preferences` (strippé byte-legacy sur l'endpoint public)
  // → badge « En attente / Validé » + filtre statut + action contextuelle. Gate : la page /admin est déjà
  // réservée aux admins de l'hôte — même population que la gate serveur (canEditItem sur l'hôte).
  const adminMode = !fieldStatus && (rowActions.includes("validate") || !!resource.status);

  // Recherche plein-texte débouncée (300ms comme MembersSection) — searchText est dans la queryKey → refetch auto.
  const [q, setQ] = useState("");
  const searchText = useDebounce(q, 300);
  // Tri SERVEUR mono-colonne (payload sortBy {champ:1|-1} — byte-vérifié : la direction est préservée).
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
  // Filtre statut (serveur : preferences.toBeValidated.<slug> $exists) — admin uniquement.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Filtre par état métier (mode statusField) : "all" ou une `value` de states — match serveur exact.
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  // Le legacy RÉDUIT les documents quand la requête ne demande aucun champ. Sur la route ADMIN, seul
  // `events` est réduit : `SearchNew::getResults` (citizenToolKit/models/SearchNew.php:432) repasse
  // chaque event par `Event::getSimpleEventById` (Event.php:211) — document blanc-listé sans `type`,
  // `created`/`updated`, `source`/`reference`. Sur la route PUBLIQUE (celle du mode statusField), la
  // réduction frappe TOUS les types testés (organizations : 11 clés sans `source`/`reference` ni champs
  // costum ; poi : sans `publicationDate`/`publicationStatus`/`featured` ; answers : 5 clés SANS le champ
  // `answers`) — d'où colonnes vides, toggle Référencer aveugle (isAttached/isReferenced faux) et gating
  // `restrictActionsToOwned` qui bloquait tout. Demander une projection EXPLICITE court-circuite la
  // réduction : le legacy ne simplifie QUE sur `fields` vide (et ajoute d'office son socle name/address/
  // geo/links). Sans risque pour l'édition — `openEditEntity` recharge l'entité COMPLÈTE par id.
  // ⚠️ JAMAIS "preferences" dans cette liste : champ interdit du legacy (SearchNew::checkFields), retiré
  // par unset() — le trou d'index rend le tableau PHP non-séquentiel et CASSE toute la projection Mongo
  // (documents réduits à _id) dès que "preferences" n'est pas en DERNIÈRE position du POST. Il est de
  // toute façon strippé sur la route publique ; le badge toBeValidated ne vit qu'en adminMode (route admin).
  const champsProjetes = useMemo(() => {
    return [...new Set([
      "name", "type", "collection", "slug", "source", "reference", "links", "creator",
      "created", "updated", "startDate", "endDate", "recurrency", "openingHours", "timeZone",
      "shortDescription", "description", "tags", "address", "addresses", "geo", "geoPosition",
      "profilImageUrl", "profilThumbImageUrl", "profilMediumImageUrl",
      // Les colonnes déclarées en config peuvent viser un champ hors du socle (racine du chemin pointé :
      // le legacy projette par champ de premier niveau), tout comme le champ d'état (mode statusField),
      // le champ d'exclusivité (setFeatured) et les defaultFields de la source.
      ...columns.map((c) => c.path.split(".")[0]),
      ...(resource.status?.field ? [resource.status.field.split(".")[0]] : []),
      ...(resource.exclusiveField ? [resource.exclusiveField.split(".")[0]] : []),
      ...((resource.source as { defaultFields?: string[] } | undefined)?.defaultFields ?? []).map((f) => f.split(".")[0]),
    ])];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colonnes/champs dérivés de la config (stables)
  }, [columns.map((c) => c.path).join(","), resource.status?.field, resource.exclusiveField]);

  const src = (resource.source ?? {}) as { defaultFields?: string[]; defaultFilters?: Record<string, unknown> } & Record<string, unknown>;
  const baseParams = useMemo(() => {
    const filters: Record<string, unknown> = { ...(src.defaultFilters ?? {}) };
    if (adminMode && statusFilter !== "all" && costumSlug) {
      // Double flag (preferences + source), cf. validationStatusFilter / SearchNew::getQueries:783-818.
      Object.assign(filters, validationStatusFilter(costumSlug, statusFilter));
    }
    if (fieldStatus && fieldFilter !== "all") {
      // Match EXACT de la valeur brute (les rows sans le champ ne sortent que sur « Tous »).
      filters[fieldStatus.field] = fieldFilter;
    }
    // Projection :
    //  - mode ADMIN : AUCUN `fields` → la route admin renvoie les DOCUMENTS COMPLETS (sémantique
    //    legacy searchAdmin, moins pwd). Indispensable au-delà du badge : la résolution d'édition
    //    (`editModalMatch`, ex. {type:"recoveryCenter"}) lit serverData.type, et le form costum
    //    d'édition doit être PRÉREMPLI (champs equip_*) — une projection partielle ouvrait le form
    //    générique et/ou des champs vides. Coût maîtrisé : pagination par 10.
    //  - SAUF `events` : réduits même sur la route admin → `champsProjetes`.
    //  - mode statusField (`fieldStatus`) : route PUBLIQUE, documents RÉDUITS sur `fields` vide
    //    (cf. champsProjetes) → projection explicite OBLIGATOIRE, sinon colonnes vides et
    //    rattachement (source/reference) invisible.
    //  - mode public : `source` FORCÉ (M3, absent du jeu legacy par défaut) → le toggle
    //    Référencer/Détacher reflète l'appartenance réelle à source.keys.
    return {
      defaultTypes: [resource.entityType] as SearchType[],
      ...src,
      ...(adminMode
        // Route ADMIN : pas de checkFields → "preferences" passe (badge toBeValidated), et le bug
        // du trou d'index ne s'applique pas.
        ? { defaultFields: resource.entityType === "events" ? [...champsProjetes, "preferences"] : undefined }
        : fieldStatus
          ? { defaultFields: champsProjetes }
          : { defaultFields: [...new Set(["source", "reference", ...(src.defaultFields ?? [])])] }),
      ...(Object.keys(filters).length > 0 ? { defaultFilters: filters } : {}),
      ...(sort ? { defaultSortBy: { [sort.col]: sort.dir } } : {}),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- src/fieldStatus dérivés de la config (stables par rendu)
  }, [adminMode, statusFilter, fieldFilter, costumSlug, sort, resource.entityType, champsProjetes, JSON.stringify(src)]);

  const { transformedResults, totalCount, isLoading, lastItemRef, refetch, error: searchError } = useSearchQuery({
    queryKeyPrefix: ADMIN_QUERY_KEYS.RESOURCE_PREFIX(resource.entityType),
    searchText,
    searchTags: {},
    // Le type de recherche DOIT passer par `searchType` (et non le seul `baseParams.defaultTypes`) :
    // useSearchQuery mappe `searchType:null` en `type=[]` (tableau vide), or buildSearchPayload ne
    // retombe sur `defaultTypes` que si `type===undefined` → sans ça, `param.searchType` reste vide et
    // le queryFn court-circuite (résultat vide, AUCUN appel réseau). Idiome repris de SearchProStatic.
    searchType: { type: [resource.entityType] },
    mapUsed: false,
    baseParams,
    ...(adminMode ? { variant: "admin" as const } : {}),
  });
  const rows = transformedResults ?? [];

  const toggleSort = (col: string) =>
    setSort((s) => (s?.col === col ? (s.dir === 1 ? { col, dir: -1 } : null) : { col, dir: 1 }));

  // La sélection est liée à la VUE : recherche/filtre/tri changent → reset (sinon on peut agir
  // sur des éléments sortis de l'écran — audit robustesse). Pattern adjust-during-render (repo).
  const [selected, setSelected] = useState<Map<string, unknown>>(new Map());
  const selectionScopeKey = `${searchText}|${statusFilter}|${fieldFilter}|${sort ? `${sort.col}:${sort.dir}` : ""}`;
  const [lastScopeKey, setLastScopeKey] = useState(selectionScopeKey);
  if (selectionScopeKey !== lastScopeKey) {
    setLastScopeKey(selectionScopeKey);
    if (selected.size) setSelected(new Map());
  }

  const [editEntity, setEditEntity] = useState<EntityTypes | null>(null);
  const [toDelete, setToDelete] = useState<{ entity: DeletableEntity; label: string } | null>(null);
  // Détacher = action FORTE (l'élément sort du scope costum et disparaît de la table) → confirmation.
  const [toDetach, setToDetach] = useState<{ item: unknown; id: string; label: string } | null>(null);
  // ── bulkActions (config resource.bulkActions : validate/delete/export) ──────────────────────────
  const bulkActions = resource.bulkActions ?? [];
  const queryClient = useQueryClient();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  // bulkAction `transfer` : migration d'appropriation en mode ids[] sur la sélection cochée —
  // même dialog que la section ownershipMigration (contrôles + gate re-déroulés serveur).
  // Le cédant vient de la CONFIG (`transferFrom`) : les lignes de searchCostum ne projettent pas
  // toujours `source`, on ne peut pas le dériver des fiches de façon fiable.
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const canBulkTransfer = bulkActions.includes("transfer") && !!resource.transferFrom;
  const invalidateAdmin = () =>
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
  const toggleSelect = (id: string, item: unknown) =>
    setSelected((m) => { const n = new Map(m); if (n.has(id)) n.delete(id); else n.set(id, item); return n; });
  const rowId = (item: unknown): string | null => {
    const rid = (item as { id?: unknown }).id ?? ((item as { serverData?: { id?: unknown } }).serverData?.id);
    return rid != null ? String(rid) : null;
  };
  // Progression des mutations en masse (boucle séquentielle potentiellement longue — 10-20s sur
  // 50 éléments) : sans compteur, le seul feedback était des boutons grisés (audit UX).
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  /** Fin de mutation en masse : les ÉCHECS restent SÉLECTIONNÉS (retry ciblé via l'action du
   *  toast ou les boutons de la barre) au lieu d'être silencieusement désélectionnés (audit UX). */
  const finishBulk = (total: number, failed: Map<string, unknown>, firstError: string | null, verb: string, retry: () => void) => {
    const ok = total - failed.size;
    if (failed.size === 0) {
      setSelected(new Map());
      toast.success(tAdmin("AdminResourceTable.bulkSuccess", undefined, { ok: String(ok), verb }));
    } else {
      setSelected(new Map(failed));
      toast.warning(
        tAdmin("AdminResourceTable.bulkPartial", undefined, {
          ok: String(ok),
          verb,
          failed: String(failed.size),
          error: firstError ? ` : ${firstError}` : "",
        }),
        { action: { label: tAdmin("AdminResourceTable.retry"), onClick: retry } },
      );
    }
    void invalidateAdmin();
  };

  /** Validation en masse — API unitaire : boucle SÉQUENTIELLE (pas de Promise.all, évite les races). */
  const bulkValidate = async (valid: boolean) => {
    setBulkBusy(true);
    const c = scopedCarrier() as ValidatableCarrier;
    const failed = new Map<string, unknown>();
    let firstError: string | null = null;
    const total = selected.size;
    let done = 0;
    setBulkProgress({ current: 0, total });
    for (const [id, item] of selected) {
      try { await c.validateGroup(resource.entityType, id, valid); }
      catch (e) { failed.set(id, item); if (!firstError) firstError = e instanceof Error ? e.message : String(e); }
      setBulkProgress({ current: ++done, total });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    finishBulk(
      total,
      failed,
      firstError,
      tAdmin(valid ? "AdminResourceTable.bulkVerbValidated" : "AdminResourceTable.bulkVerbInvalidated"),
      () => void bulkValidate(valid),
    );
  };

  const bulkDelete = async () => {
    setBulkBusy(true);
    setBulkDeleteOpen(false);
    const failed = new Map<string, unknown>();
    let firstError: string | null = null;
    const total = selected.size;
    let done = 0;
    setBulkProgress({ current: 0, total });
    for (const [id, item] of selected) {
      try { await grantCostumAdmin(item as DeletableEntity).delete("admin bulk delete"); }
      catch (e) { failed.set(id, item); if (!firstError) firstError = e instanceof Error ? e.message : String(e); }
      setBulkProgress({ current: ++done, total });
    }
    setBulkBusy(false);
    setBulkProgress(null);
    finishBulk(total, failed, firstError, tAdmin("AdminResourceTable.bulkVerbDeleted"), () => setBulkDeleteOpen(true));
  };

  /** Export CSV de la sélection : colonnes configurées (serverData). */
  const bulkExport = () => {
    const rowsCsv = [...selected.values()].map((item) => {
      const d = (item as { serverData?: Record<string, unknown> }).serverData ?? {};
      const out: Record<string, unknown> = {};
      for (const col of columns) out[col.path] = getColumnValue(d, col.path);
      return out;
    });
    const csv = toCsv(rowsCsv as Parameters<typeof toCsv>[0], columns.map((c) => c.path) as Parameters<typeof toCsv>[1]);
    downloadCsv(csv, `selection-${resource.entityType}.csv`);
  };
  const [createOpen, setCreateOpen] = useState(false);
  // Pas de refetch() dans les callbacks : les hooks invalident déjà par prédicat admin-* (queryKeys),
  // ce qui couvre cette table ET les tuiles dashboard (le refetch doublait la requête — audit réseau).
  const del = useDeleteEntity(() => {
    setToDelete(null);
  });
  const validate = useValidateGroup(() => {});
  const reference = useReferenceElement(() => {});
  /** Mode statusField : écrit le champ métier via `entity.updateField` (UPDATE_PATH_VALUE — un $set
   *  ciblé ; PAS le save d'answer complet, qui exigerait un re-fetch pour ne rien effacer). Les rows
   *  sont des entités revivifiées (`helper.fromEntityJSON`) — garde défensive sinon. Invalidation :
   *  tables/tuiles admin ET listes publiques (liste + carte lisent le même champ, ex. /creneaux). */
  const setStatus = useMutationWithToast<void, { item: unknown; value: string; display: string }>({
    mutationFn: async ({ item, value }) => {
      if (!fieldStatus) return;
      const target = grantCostumAdmin(item) as { updateField?: (path: string, v: string) => Promise<unknown> };
      if (typeof target.updateField !== "function") throw new Error("updateField indisponible sur cette ligne");
      await target.updateField(fieldStatus.field, value);
    },
    successKey: "AdminResourceTable.statusSuccess",
    errorKey: "AdminResourceTable.statusError",
    getSuccessParams: (_, v) => ({ state: v.display }),
    namespace: "modules/admin",
    onSuccessCallback: () => {
      void invalidateAdmin();
      queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_LIST_PREFIX) });
      queryClient.invalidateQueries({ queryKey: SEARCH_QUERY_KEYS.RESULTS_PREFIX(SEARCH_STATIC_MAP_PREFIX) });
    },
  });
  const setExclusiveFlag = useSetExclusiveFlag(() => {});
  // Périmètre SERVEUR de l'exclusivité (review MR 44, resserré par la review finale) : les fiches
  // `exclusiveField:true` du périmètre déclaré par la CONFIG de la resource — jamais les lignes
  // chargées (l'ex-« une » peut vivre hors de la fenêtre de l'infinite scroll), et jamais
  // `baseParams` : il porte les filtres UI TRANSITOIRES (état métier, filtre de validation, tri)
  // qui rétréciraient le périmètre au filtre courant de l'admin — un « Brouillon » filtré mettrait
  // à la une sans jamais dé-marquer la « Publié » (double-flag PERSISTANT, mesuré par la review).
  // Miroir du canal de LECTURE de la table : variant admin quand adminMode (docs complets),
  // sinon projection EXPLICITE portant la racine du champ exclusif (la route publique sans
  // `fields` peut la raboter — ex. whitelist events).
  const fetchFlagged = async (): Promise<ExclusiveFlagEntity[]> => {
    if (!carrier || !resource.exclusiveField) return [];
    const champ = resource.exclusiveField;
    const params = expandCostumSubType(
      {
        ...src,
        indexStepList: 50,
        defaultSortBy: undefined,
        defaultFields: adminMode ? champsProjetes : [...new Set([champ.split(".")[0]!, "source", "reference"])],
        defaultFilters: { ...(src.defaultFilters ?? {}), [champ]: true },
      },
      (config as { costumForms?: Record<string, never> } | undefined)?.costumForms,
      (carrier as { slug?: string } | null)?.slug,
    ) ?? {};
    const param = buildSearchPayload(params, {
      name: "", tags: [], type: [resource.entityType], mapUsed: false,
      ...(adminMode ? { variant: "admin" as const } : {}),
    });
    if (!param.searchType) return [];
    const sdk = carrier as unknown as { searchCostum: (p: unknown, o?: unknown) => Promise<{ results?: unknown[] }> };
    const res = adminMode ? await sdk.searchCostum(param, { variant: "admin" }) : await sdk.searchCostum(param);
    return (res.results ?? []) as ExclusiveFlagEntity[];
  };
  // Choix costum/standard par CONFIG (`create`/`edit`) — cf. resourceHelpers. En `inherit`, la
  // création prend le form COSTUM du site s'il en existe un pour ce type (config.costumForms,
  // même form que le bouton public), et l'édition suit la résolution publique (editModal/Match).
  const { config } = useSite();
  // ⚠ REVIEW HIGH : les mutations validate/reference s'appellent sur le CARRIER ctx-ifié
  // (ensureCostumScope → slug DU SITE), PAS sur l'entité de ligne : le _costumCtx d'un item est
  // dérivé de SON source.key — pour un élément créé sous un AUTRE costum mais référencé ici,
  // item.validateGroup aurait écrit toBeValidated.<autre-slug> (mauvais costum) ; et un élément
  // seulement référencé (sans source) n'a aucun ctx → échec avant réseau.
  const scopedCarrier = (): unknown => {
    ensureCostumScope(carrier, { contextId, contextType });
    return carrier;
  };

  const createModal = resolveCreateModal(
    resource,
    (config as { costumForms?: Record<string, CostumFormDocLike> }).costumForms,
    costumSlug,
  );
  const editModal = resolveEditModal(resource);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">
          {resource.label ? t(resource.label) : <span className="capitalize">{resource.entityType}</span>}
          {totalCount != null ? ` (${totalCount})` : ""}
        </CardTitle>
        {createModal && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> {tAdmin("AdminResourceTable.create")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Barre d'outils : recherche plein-texte (débouncée) + filtre statut (mode admin). */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchTextInput className="max-w-xs" placeholder={tAdmin("AdminResourceTable.searchPlaceholder")} value={q} onChange={setQ} />
          {adminMode && costumSlug && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tAdmin("AdminResourceTable.statusAll")}</SelectItem>
                <SelectItem value="pending">{tAdmin("AdminResourceTable.statusPending")}</SelectItem>
                <SelectItem value="validated">{tAdmin("AdminResourceTable.statusValidated")}</SelectItem>
              </SelectContent>
            </Select>
          )}
          {fieldStatus && (
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tAdmin("AdminResourceTable.statusAll")}</SelectItem>
                {statusStates.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label ? t(s.label) : s.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {bulkActions.length > 0 && selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">
              {tAdmin(selected.size > 1 ? "AdminResourceTable.selectedCountPlural" : "AdminResourceTable.selectedCount", undefined, { count: String(selected.size) })}
            </span>
            {bulkActions.includes("validate") && (
              <>
                <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkValidate(true)}>
                  <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminResourceTable.bulkValidate")}
                </Button>
                <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => void bulkValidate(false)}>
                  <BadgeX className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminResourceTable.bulkInvalidate")}
                </Button>
              </>
            )}
            {bulkActions.includes("export") && (
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkExport}>
                {tAdmin("AdminResourceTable.bulkExport")}
              </Button>
            )}
            {canBulkTransfer && (
              <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => setBulkTransferOpen(true)}>
                <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminResourceTable.bulkTransfer")}
              </Button>
            )}
            {bulkActions.includes("delete") && (
              <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {tAdmin("AdminResourceTable.bulkDelete")}
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelected(new Map())}>
              {tAdmin("AdminResourceTable.bulkCancel")}
            </Button>
            {bulkProgress && (
              <div className="flex w-full items-center gap-2 sm:w-64">
                <Progress value={bulkProgress.total ? (bulkProgress.current / bulkProgress.total) * 100 : 0} className="h-2" />
                <span className="text-xs tabular-nums text-muted-foreground">{bulkProgress.current}/{bulkProgress.total}</span>
              </div>
            )}
          </div>
        )}
        {/* Hauteur bornée + scroll interne : la sentinelle du scroll infini (lastItemRef) est CLIPPÉE hors
            de cette zone tant qu'on n'a pas scrollé → l'IntersectionObserver ne re-déclenche pas en cascade.
            Sans ça, un gros costum (p.ex. 3120 POI = 312 pages) enchaîne des dizaines de fetchNextPage
            d'affilée dans une table non virtualisée → gel du renderer. Le chargement reste incrémental au scroll. */}
        {/* Wrapper = UNIQUE scrolleur (X+Y) : le conteneur interne shadcn (data-slot=table-container,
            overflow-x-auto) est neutralisé — sinon sticky top (en-tête) et sticky right (actions)
            se réfèrent à deux ancêtres différents et se cassent mutuellement (audit mobile). */}
        <div className="max-h-[60vh] overflow-auto [&_[data-slot=table-container]]:overflow-x-visible">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-background">
            <TableRow>
              {bulkActions.length > 0 && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label={tAdmin("AdminResourceTable.selectAll")}
                    checked={rows.length > 0 && selected.size > 0 && rows.every((it) => { const rid = rowId(it); return rid == null || selected.has(rid); })}
                    onCheckedChange={(v) => {
                      if (!v) { setSelected(new Map()); return; }
                      const m = new Map<string, unknown>();
                      rows.forEach((item) => {
                        const rid = (item as { id?: unknown }).id ?? ((item as { serverData?: { id?: unknown } }).serverData?.id);
                        if (rid != null) m.set(String(rid), item);
                      });
                      setSelected(m);
                    }}
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                // Tri SERVEUR au clic (asc → desc → aucun) — les données étant paginées en scroll
                // infini, un tri client ne trierait que les pages chargées.
                <TableHead
                  key={col.path}
                  aria-sort={sort?.col === col.path ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                >
                  {/* `sortable: false` → libellé simple : proposer un tri qui ne trie pas (colonne
                      FABRIQUÉE après la requête, absente en base) coûterait le tri par défaut. */}
                  {col.sortable === false ? (
                    <span className={col.label ? "px-3 text-sm font-medium" : "px-3 text-sm font-medium capitalize"}>
                      {col.label ? t(col.label) : col.path}
                    </span>
                  ) : (
                  /* Vrai <button> (pattern shadcn data-table) : tri accessible au CLAVIER + aria-sort. */
                  <Button
                    variant="ghost"
                    size="sm"
                    className={col.label ? "-ml-3 h-8" : "-ml-3 h-8 capitalize"}
                    onClick={() => toggleSort(col.path)}
                  >
                    {col.label ? t(col.label) : col.path}
                    {sort?.col === col.path && (sort.dir === 1 ? <ChevronUp className="ml-1 h-3 w-3 text-primary" /> : <ChevronDown className="ml-1 h-3 w-3 text-primary" />)}
                  </Button>
                  )}
                </TableHead>
              ))}
              {(adminMode || fieldStatus) && <TableHead>{tAdmin("AdminResourceTable.statusColumn")}</TableHead>}
              <TableHead className="sticky right-0 z-10 w-12 bg-background" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, i) => {
              const data = (item as { serverData?: Record<string, unknown> }).serverData ?? {};
              // H1 : privilégier le GETTER d'entité `item.id` (serverData.id pas toujours peuplé par
              // searchCostum — cf. SearchListView) ; l'index i n'est qu'un ultime repli anti-crash.
              const realId = (item as { id?: unknown }).id ?? (data as { id?: unknown }).id;
              // REVIEW LOW : sans id réel, l'index n'est qu'une clé React — JAMAIS envoyé aux mutations.
              const id = String(realId ?? i);
              const hasRealId = realId != null;
              const label = String((data as { name?: unknown }).name ?? id);
              const isLast = i === rows.length - 1;
              // 3 états de rattachement (source ET reference projetés) : sourcé → « Détacher » ;
              // seulement référencé → « Retirer la référence » (re-référencer dupliquerait,
              // add/reference ne déduplique pas — parité) ; sinon → « Référencer ».
              const sourceKeys = (data as { source?: { keys?: unknown[] } }).source?.keys;
              const isAttached = Array.isArray(sourceKeys) && !!costumSlug && sourceKeys.includes(costumSlug);
              const refCostum = (data as { reference?: { costum?: unknown[] } }).reference?.costum;
              const isReferenced = !isAttached && Array.isArray(refCostum) && !!costumSlug && refCostum.includes(costumSlug);
              // Statut de validation costum — LISIBLE en mode admin (le variant admin renvoie preferences/source,
              // strippés sur l'endpoint public). EN ATTENTE si l'UNE des deux voies a le flag (double flag
              // legacy SearchNew::getQueries:783-818) : preferences.toBeValidated.<slug> OU source.toBeValidated.<slug>.
              const d = data as { preferences?: { toBeValidated?: Record<string, unknown> }; source?: { toBeValidated?: Record<string, unknown> } };
              const prefTbv = d.preferences?.toBeValidated;
              const srcTbv = d.source?.toBeValidated;
              const isPending = adminMode && !!costumSlug && (
                (!!prefTbv && typeof prefTbv === "object" && prefTbv[costumSlug] === true) ||
                (!!srcTbv && typeof srcTbv === "object" && srcTbv[costumSlug] === true)
              );
              const isFeatured = !!resource.exclusiveField && getPath(data, resource.exclusiveField) === true;
              // Gating par APPARTENANCE (opt-in `restrictActionsToOwned`, cf. schema.ts) : une ligne
              // non possédée ne garde que lecture + (dé)référencement — les écritures d'élément
              // (edit/delete/validate/statusField) seraient de toute façon refusées par le Node
              // durci sur une entité étrangère.
              const actionnable = !resource.restrictActionsToOwned || isAttached;
              return (
                <TableRow key={id} ref={isLast ? lastItemRef : undefined}>
                  {bulkActions.length > 0 && (
                    <TableCell className="w-10">
                      <Checkbox
                        aria-label={tAdmin("AdminResourceTable.selectRow", undefined, { label })}
                        disabled={!hasRealId}
                        checked={selected.has(id)}
                        onCheckedChange={() => toggleSelect(id, item)}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.path}
                      className={col.type === "audio" ? "min-w-[13rem]" : "max-w-[14rem] truncate"}
                      title={col.type === "audio" ? undefined : formatColumnCell(data, col.path, tSearch)}
                    >
                      {col.type === "audio"
                        ? <AudioCell value={getPath(data, col.path)} />
                        : formatColumnCell(data, col.path, tSearch)}
                    </TableCell>
                  ))}
                  {fieldStatus && (
                    <TableCell>
                      {(() => {
                        const raw = readStatusValue(data, fieldStatus.field);
                        const current = statusStates.find((s) => s.value === raw);
                        if (!current) {
                          // Champ absent (answer jamais statuée) ou valeur hors config : neutre, valeur brute visible.
                          return <Badge variant="outline">{typeof raw === "string" && raw ? raw : tAdmin("AdminResourceTable.statusUnset")}</Badge>;
                        }
                        const tone = current.tone ? STATUS_TONE_CLASS[current.tone] : undefined;
                        return (
                          <Badge variant={tone ? undefined : "secondary"} className={tone}>
                            {current.label ? t(current.label) : current.value}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  )}
                  {adminMode && (
                    <TableCell>
                      {isPending ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400">{tAdmin("AdminResourceTable.badgePending")}</Badge>
                      ) : (
                        <Badge variant="secondary">{tAdmin("AdminResourceTable.badgeValidated")}</Badge>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="sticky right-0 bg-background">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={tAdmin("AdminResourceTable.rowActions", undefined, { label })}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actionnable && rowActions.includes("edit") && editModal.enabled && (
                          <DropdownMenuItem onClick={() => void openEditEntity(item, hasRealId ? id : undefined)}>
                            <Pencil className="mr-2 h-4 w-4" /> {tAdmin("AdminResourceTable.edit")}
                          </DropdownMenuItem>
                        )}
                        {actionnable && fieldStatus && rowActions.includes("validate") && hasRealId && (() => {
                          // Une action par ÉTAT CIBLE (l'état courant est omis) — le libellé porte
                          // l'état, l'icône (ton) n'est qu'un repère. Écrit la valeur brute config.
                          const raw = readStatusValue(data, fieldStatus.field);
                          return statusStates.filter((s) => s.value !== raw).map((s) => {
                            const Icon = (s.tone && STATUS_TONE_ICON[s.tone]) || CircleDot;
                            const display = s.label ? t(s.label) : s.value;
                            return (
                              <DropdownMenuItem
                                key={s.value}
                                disabled={setStatus.isPending}
                                onClick={() => setStatus.mutate({ item, value: s.value, display })}
                              >
                                <Icon className="mr-2 h-4 w-4" />
                                {tAdmin("AdminResourceTable.setStatus", undefined, { state: display })}
                              </DropdownMenuItem>
                            );
                          });
                        })()}
                        {actionnable && !fieldStatus && rowActions.includes("validate") && carrier && hasRealId && (
                          // Le statut est LISIBLE en mode admin (variant admin → preferences projeté) : on
                          // n'affiche que l'action PERTINENTE (« Valider » un en-attente, « Dévalider » un validé).
                          // ⚠ On appelle sur `item` (l'entité de la ligne) et NON `carrier` : validateGroup/addReference
                          // exigent un `_costumCtx` COMPLET (slug+costumId+costumType) via `_requireCostumCtx`, que l'hôte
                          // costum (carrier) n'a pas forcément ; l'item l'auto-dérive de sa `source.keys` (projetée par M3).
                          <DropdownMenuItem
                            onClick={() =>
                              validate.mutate({ carrier: scopedCarrier() as ValidatableCarrier, type: resource.entityType, id, valid: isPending })
                            }
                          >
                            {isPending ? <BadgeCheck className="mr-2 h-4 w-4" /> : <BadgeX className="mr-2 h-4 w-4" />}
                            {tAdmin(isPending ? "AdminResourceTable.validate" : "AdminResourceTable.invalidate")}
                          </DropdownMenuItem>
                        )}
                        {rowActions.includes("reference") && carrier && costumSlug && hasRealId && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (isAttached) { setToDetach({ item, id, label }); return; }
                              reference.mutate({
                                carrier: scopedCarrier() as ReferencingCarrier,
                                op: isReferenced ? "unreference" : "reference",
                                type: resource.entityType,
                                id,
                                // L'ENTITÉ de la ligne — porte les écritures d'annotation
                                // (`reference.costumTypes.<slug>`) via SA méthode `updateField`, comme
                                // AdminReferenceSection. Sans elle, `ecrire()` lève « cible manquante »
                                // AVANT tout appel réseau : au retrait, l'annotation survit au
                                // désréférencement et reclasse l'entité si elle est re-référencée plus tard.
                                cible: item as AnnotableEntity,
                              });
                            }}
                          >
                            <Link2 className="mr-2 h-4 w-4" />{" "}
                            {tAdmin(isAttached ? "AdminResourceTable.detach" : isReferenced ? "AdminResourceTable.unreference" : "AdminResourceTable.reference")}
                          </DropdownMenuItem>
                        )}
                        {actionnable && rowActions.includes("setFeatured") && resource.exclusiveField && hasRealId && (
                          // Exclusivité gérée DEPUIS CE TABLEAU (décision produit) : mettre en avant
                          // pose d'abord la CIBLE puis dé-marque les fiches flaggées du PÉRIMÈTRE
                          // SERVEUR (fetchFlagged — jamais les lignes chargées) ; retirer ne touche
                          // que cette ligne. Cf. runExclusiveFlag.
                          <DropdownMenuItem
                            disabled={setExclusiveFlag.isPending}
                            onClick={() =>
                              setExclusiveFlag.mutate({
                                field: resource.exclusiveField!,
                                value: !isFeatured,
                                target: grantCostumAdmin(item) as unknown as ExclusiveFlagEntity,
                                fetchFlagged,
                              })
                            }
                          >
                            <Star className={isFeatured ? "mr-2 h-4 w-4 fill-current" : "mr-2 h-4 w-4"} />
                            {tAdmin(isFeatured ? "AdminResourceTable.unfeature" : "AdminResourceTable.feature")}
                          </DropdownMenuItem>
                        )}
                        {actionnable && rowActions.includes("delete") && hasRealId && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setToDelete({ entity: grantCostumAdmin(item) as unknown as DeletableEntity, label })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> {tAdmin("AdminResourceTable.delete")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        {isLoading && (
          <div className="space-y-2 py-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {!isLoading && rows.length === 0 && !searchError && (
          <p className="py-8 text-center text-sm text-muted-foreground">{tAdmin("AdminResourceTable.empty")}</p>
        )}
        {searchError != null && (
          // REVIEW M6 : une erreur de recherche n'est PAS « Aucun élément » — l'afficher.
          <p className="py-8 text-center text-sm text-destructive">
            {tAdmin("AdminResourceTable.searchFailed", undefined, {
              message: searchError instanceof Error ? searchError.message : tAdmin("AdminResourceTable.serverError"),
            })}
          </p>
        )}
        {rows.length > 0 && totalCount != null && (
          <p className="pt-2 text-xs text-muted-foreground">
            {tAdmin(rows.length > 1 ? "AdminResourceTable.shownCountPlural" : "AdminResourceTable.shownCount", undefined, {
              shown: String(rows.length),
              total: String(totalCount),
            })}
          </p>
        )}
      </CardContent>

      {editEntity && (
        <DynamicEditModal
          open
          onOpenChange={(o) => {
            // Même patron que la modale de création (REVIEW M4) : sans ça, une modification
            // restait invisible dans le tableau tant qu'on ne rechargeait pas la page.
            if (!o) { setEditEntity(null); void refetch(); }
          }}
          entity={editEntity}
          {...(editModal.modalName ? { modalName: editModal.modalName } : {})}
        />
      )}
      {createModal && (
        <DynamicModal
          modalName={createModal}
          createDefaults={resource.createDefaults}
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            // REVIEW M4 : à la fermeture de la modale de création, refetch (un élément vient
            // peut-être d'être créé — staleTime 60s sinon).
            if (!o) void refetch();
          }}
          parent={carrier}
        />
      )}

      {/* Confirmations via le ConfirmDialog PARTAGÉ (pattern du site — MembersSection l'utilisait
          déjà via son wrapper profil) : style destructif uniforme, ~70 lignes en moins. */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={() => void bulkDelete()}
        title={tAdmin(selected.size > 1 ? "AdminResourceTable.bulkDeleteTitlePlural" : "AdminResourceTable.bulkDeleteTitle", undefined, { count: String(selected.size) })}
        description={tAdmin("AdminResourceTable.irreversible")}
        confirmLabel={tAdmin("AdminResourceTable.delete")}
        isDestructive
        isPending={bulkBusy}
      />

      <ConfirmDialog
        open={!!toDetach}
        onOpenChange={(o) => { if (!o) setToDetach(null); }}
        onConfirm={() => {
          if (toDetach) {
            reference.mutate({ carrier: scopedCarrier() as ReferencingCarrier, op: "detach", type: resource.entityType, id: toDetach.id });
            setToDetach(null);
          }
        }}
        title={tAdmin("AdminResourceTable.detachTitle", undefined, { label: toDetach?.label ?? "" })}
        description={tAdmin("AdminResourceTable.detachDescription")}
        confirmLabel={tAdmin("AdminResourceTable.detach")}
        isPending={reference.isPending}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        onConfirm={() => {
          if (toDelete) del.mutate({ entity: toDelete.entity, reason: "admin delete" });
        }}
        title={tAdmin("AdminResourceTable.deleteTitle", undefined, { label: toDelete?.label ?? "" })}
        description={tAdmin("AdminResourceTable.irreversible")}
        confirmLabel={tAdmin("AdminResourceTable.delete")}
        isDestructive
        isPending={del.isPending}
      />

      {/* bulkAction `transfer` : le dialog partagé de migration d'appropriation, en mode ids[] sur
          la sélection. `open &&` remonte la sélection au moment de l'ouverture (le dialog relance
          son analyse à chaque ouverture) ; apply/rollback réussi → invalidation + désélection. */}
      {canBulkTransfer && bulkTransferOpen && (
        <OwnershipMigrationDialog
          open={bulkTransferOpen}
          onOpenChange={setBulkTransferOpen}
          from={resource.transferFrom!}
          collection={resource.entityType}
          selection={{ ids: [...selected.keys()] }}
          onApplied={() => {
            setSelected(new Map());
            void invalidateAdmin();
          }}
        />
      )}
    </Card>
  );
}
