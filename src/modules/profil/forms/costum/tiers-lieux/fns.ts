// Pipeline (P3) — imports DIRECTS (pas le barrel formEngine) pour rester un util pur. cf. doc/refactor-field-treatment.md.
import { registerTransform, registerOptions } from "@/modules/formEngine/engine/transforms";
import "@/modules/formEngine/engine/coercions"; // side-effect : enregistre coerce:string/pickString/orUndef référencés par le descripteur tiers-lieu
import "../../geoTransforms"; // enregistre geo:write / geoPosition:write (partagés)
// Codecs COMMUNS (l'import déclenche l'enregistrement de address:read + openingHours:read/write).
// `openingHours:*` est désormais livré PAR le widget (WIDGET_DEFAULTS) — plus de tl:hoursRead/Write ici.
import { emptyOpeningHours, buildOpeningHoursPayload, type DayHours } from "../sharedCodecs";
export { buildOpeningHoursPayload }; // re-export (consommé par fns.test)
export type { DayHours };
import { buildPayload, buildEditPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import type { FormValues, FormDescriptor } from "@/modules/formEngine";
import { getSlug } from "@/lib/constant/common";
import { carrierSlug } from "../carrier";
import type { EntityModalCtx } from "../../entityModalSpec";
import { registerDefaultsFn, registerPayloadFn, registerScopeFn, getDescriptor } from "../../specRegistries";
import "../sharedFns"; // side-effect : enregistre la clé commune image:profilUrl

/** Lien social (fieldArray). */
export interface TiersLieuxSocialLink { platform: string; url: string }
/**
 * FORME des valeurs de form tiers-lieu (type TS uniquement, AUCUNE validation : la validation vient du
 * descripteur via zodGen). Remplace l'ex-zod hand-written `tiersLieux.schema.ts` (supprimé) — on ne garde
 * que la forme typée (consommée par le pipeline + les tests), plus le zod redondant.
 */
export interface TiersLieuxFormData {
  name: string;
  openingMonth?: string;
  openingYear?: string;
  shortDescription: string;
  structureName?: string;
  managementType: string;
  managementTypeOther?: string;
  family?: string[];
  familyOther?: string;
  surfaceBuilt?: string;
  surfaceOutdoor?: string;
  // Adresse : 16 champs SIG (level1..5/codeInsee posés par EditLocationTab).
  addressCountry?: string;
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  localityId?: string;
  level1?: string; level1Name?: string;
  level2?: string; level2Name?: string;
  level3?: string; level3Name?: string;
  level4?: string; level4Name?: string;
  level5?: string; level5Name?: string;
  codeInsee?: string;
  geo?: { latitude: string | number; longitude: string | number };
  geoPosition?: { type: "Point"; coordinates: number[] };
  logo?: string;
  photos: string[];
  socialLinks?: TiersLieuxSocialLink[];
  websiteUrl?: string;
  hours: {
    monday: DayHours; tuesday: DayHours; wednesday: DayHours; thursday: DayHours;
    friday: DayHours; saturday: DayHours; sunday: DayHours;
  };
  email: string;
  phone?: string;
  videoUrl?: string;
  description?: string;
}

/** Socle de defaults tiers-lieu (clé `tl:emptyDefaults`). Hours 7-DOW décochés 08:00–18:00 (opt-in) ; cf.
 *  `parseOpeningHours` réutilise ces défauts comme base/fallback. Déplacé de l'ex-`tiersLieux.schema.ts`. */
export function getDefaultTiersLieuxValues(): TiersLieuxFormData {
  return {
    name: "", openingMonth: "", openingYear: "", shortDescription: "", managementType: "",
    family: [], addressCountry: "", addressLocality: "", postalCode: "", streetAddress: "", localityId: "",
    level1: "", level1Name: "", level2: "", level2Name: "",
    level3: "", level3Name: "", level4: "", level4Name: "",
    level5: "", level5Name: "", codeInsee: "",
    logo: "", photos: [], socialLinks: [],
    hours: emptyOpeningHours(), // socle 7 jours décochés 08:00–18:00 (codec commun openingHours)
    email: "",
  };
}

// READ (seedEntity) ET WRITE (buildPayload/buildEditPayload) passent par le DESCRIPTEUR fourni au runtime
// (DI : `getDescriptor("tiers-lieux")`, enregistré par registerCostumForm — TS ou config). `fns.ts` ne dépend
// donc NI de descriptor.ts NI de schema.ts (plus de descripteur figé importé). La parité byte est garantie
// par les tests configDriven (le descripteur registre = celui round-trippé par EntityFormModal au rendu).

export interface CostumConfig {
  /** Tag principal du costum (filtre observatoire). Ajouté à `tags`. NB : la lib pose aussi le *champ* mainTag via presets. */
  mainTag?: string;
  /** Tag « compagnon » spécifique au déploiement (filtre observatoire). Ajouté à `tags`. */
  compagnon?: string;
  // `slug` / `id` / `type` / `editMode` retirés : le slug du costum = slug de l'entité porteuse
  // (useCocolight().entity = VITE_SLUG, constant) ; costumId/costumType viennent du registry lib via
  // `me.costum(slug)`. config.costum ne sert plus qu'aux TAGS (mainTag/compagnon) de l'observatoire.
}

// openingDate/manageModel/typePlace : codecs de GROUPE PARAMÉTRÉS communs (monthYear/enumOrOther/multiCsv,
// cf. sharedCodecs) — params dans serializeGroups du schéma. Ex-helpers locaux (buildOpeningDatePayload/
// parseOpeningDate/parseFamily/parseManagementType/buildTypePlace + KNOWN_MANAGEMENT_TYPES) SUPPRIMÉS.

function pickString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
// pickNumberString retiré : ses appels (tl:pickNumberString) sont repointés sur coerce:string (byte-identique,
// prouvé) ; ce helper reste utilisé par les transforms DOMAINE (video0/typePlaceRead/addressRead).

export interface EntityLike {
  serverData?: Record<string, unknown> | null;
}

// ── READ via pipeline (P3) ──────────────────────────────────────────────────
// Transformers nommés réutilisant les helpers ci-dessus (side-effect à l'import). Champs 1→1 (path +
// read) + 4 GROUPES décompose (1 champ serveur → N champs form) : openingDate, manageModel,
// typePlace (+typePlaceOther via le 2e arg `all`), address. cf. doc/refactor-field-treatment.md (P3).
// tl:pickString → coerce:stringStrict ; tl:pickNumberString → coerce:string (byte-identique, prouvé) : GÉNÉRIQUES (formEngine/coercions).
registerTransform("tl:video0", (v) => pickString(Array.isArray(v) ? v[0] : undefined));
// tl:socialRead/tl:socialWrite SUPPRIMÉS → codec commun `social:read`/`social:write` (sharedCodecs).
// tl:hoursRead SUPPRIMÉ → codec du widget `openingHours:read` (sharedCodecs), hérité via WIDGET_DEFAULTS.
// tl:openingDateRead/manageModelRead/typePlaceRead SUPPRIMÉS → codecs paramétrés monthYear/enumOrOther/multiCsv (read).
// Lit les 16 champs SIG (parité profil `pf:addressRead`) → round-trip COMPLET des niveaux (level1..5/
// codeInsee). Sans eux, une édition sans toucher l'adresse reconstruisait un objet partiel ; et le schéma
// stripait les niveaux posés par EditLocationTab. cf. doc/refactor-field-treatment.md (asymétrie adresse).
// READ adresse : codec COMMUN `address:read` (cf. ../sharedCodecs, omit-empty — le socle getDefaultTiersLieuxValues
// fournit les vides ""). Remplace l'ex-`tl:addressRead` (pickString) ≡ pour des strings.
// WRITE (P3) — réutilisent les helpers de build. `undefined` sur vide = clé OMISE par valuesToPayload
// (parité de l'omit-empty de l'ancien buildTiersLieuxPayload ; en ÉDITION le vide est émis via clear/emitEmpty,
// le delta réel étant calculé par le SDK `save()`).
// tl:emptyToUndef → coerce:orUndef ET tl:numOrUndef → coerce:numOrUndef (`v ? Number(v) : undefined`) : GÉNÉRIQUES
// (formEngine/coercions). Seul tl:videoWrite reste ici (array↔scalaire, spécifique vidéo).
registerTransform("tl:videoWrite", (v) => (v ? [v] : undefined));
// tl:hoursWrite SUPPRIMÉ → codec du widget `openingHours:write` (sharedCodecs), hérité via WIDGET_DEFAULTS.
// tl:openingDateWrite/manageModelWrite/typePlaceWrite SUPPRIMÉS → codecs paramétrés monthYear/enumOrOther/multiCsv (write).
// tl:addressWrite SUPPRIMÉ → codec commun `address:write` (sharedCodecs), référencé par serializeGroups.address.
// geo/geoPosition : transforms PARTAGÉS `geo:write`/`geoPosition:write` (liés à localityId), uniformes
// pour toutes les entités à composant adresse. cf. ../forms/geoTransforms (importé pour le side-effect).


/** FormSpec tiers-lieu construit À LA DEMANDE sur le descripteur fourni (DI) + socle typé. */
const tiersLieuSpec = (descriptor: FormDescriptor): FormSpec => ({
  descriptor,
  baseDefaults: () => getDefaultTiersLieuxValues() as unknown as FormValues,
});

// READ : pas de fonction propre. La lecture entité→form du tiers-lieu = pipeline GÉNÉRIQUE
// (`seedEntity(descripteur + socle)`), AUCUNE logique costum → le runtime passe par `buildPipelineDefaults`.
// (Contraste : le WRITE garde `buildTiersLieuxPayload` car il a le merge tags observatoire, irréductible.)

export interface BuildPayloadOptions {
  /**
   * Si fourni, injecte les constantes costum (mainTag, compagnon, costumSlug…) dans le payload.
   * À utiliser pour la **création** d'une entité costum (les valeurs viennent du site config).
   * Pour l'**édition**, on omet ce champ : l'entité existante porte déjà ses costum fields.
   *
   * Note : si `costum.mainTag` et/ou `costum.compagnon` sont définis, ils sont
   * auto-ajoutés à `payload.tags` (mergés sans dupliquer avec `existingTags` +
   * `addTags`). `compagnon` est une valeur de tag, jamais un champ propre du payload.
   */
  costum?: CostumConfig;
  /**
   * Tags supplémentaires à garantir présents dans `payload.tags` (mergés sans dupliquer).
   * Combiné avec `costum.mainTag` (auto-ajouté si fourni).
   */
  addTags?: string[];
  /**
   * Tags actuels de l'entité (depuis `serverData.tags`) — mergés sans écrasement.
   * Au CREATE : omettre (rien à merger). À l'EDIT : passer `organization.serverData.tags`
   * pour préserver les tags existants quand `payload.tags` écrase via `.save()`.
   */
  existingTags?: string[];
  /**
   * ÉDITION (pattern unifié S6) : produit un payload COMPLET (vides typés `""`/`[]`) destiné à
   * `Object.assign(entity.data)` + `save()` — le SDK diffe et le backend efface ($unset). Au CREATE :
   * omettre (omit-empty natif, pour ne pas envoyer "" aux champs typés que l'AJV ADD rejetterait).
   */
  complete?: boolean;
}

export function buildTiersLieuxPayload(
  data: TiersLieuxFormData,
  descriptor: FormDescriptor,
  options: BuildPayloadOptions = {}
): Record<string, unknown> {
  // Assemblage via le pipeline sur le descripteur FOURNI (write transforms + path + groupes openingDate/
  // manageModel/typePlace/address). Un write renvoyant `undefined` sur vide → clé OMISE (parité exacte de
  // l'ancien omit-empty ; prouvé par tiersLieuxMapping.test.ts). EditLocationTab a posé level1..4/codeInsee/geo
  // dans `data` → l'objet `address` reconstruit reste COMPLET. Le contexte costum (presets + merge tags)
  // dépend de la config (hors descripteur) → géré ci-dessous.
  const spec = tiersLieuSpec(descriptor);
  const payload = (options.complete
    ? buildEditPayload(spec, data as unknown as FormValues)
    : buildPayload(spec, data as unknown as FormValues)) as Record<string, unknown>;

  // Contexte costum CREATE (type/preferences) = STAMP déclaratif `spec.mutation.inject.extraFields` (appliqué
  // au create par runEntityMutation) — PLUS fusionné dans le payload ici. role/mainTag/source restent des
  // presets de la lib (`me.costum(slug)` → CostumScope.create = `{...presets, ...data}`) ; seul le merge `tags`
  // ci-dessous (valeurs observatoire) reste à la charge du payload.

  // Merge tags : `costum.mainTag` + `costum.compagnon` (auto) + `addTags` (manuel)
  // mergés à `existingTags`. `compagnon` est une *valeur de tag* (cf. dimension
  // observatoire `kind: "contains"` sur `tags`), pas un champ propre du payload.
  // Dédoublonne via Set (préserve l'ordre d'insertion). N'écrase pas, n'enlève rien.
  const tagsToAdd: string[] = [];
  if (options.costum?.mainTag) tagsToAdd.push(options.costum.mainTag);
  if (options.costum?.compagnon) tagsToAdd.push(options.costum.compagnon);
  if (options.addTags) tagsToAdd.push(...options.addTags);

  const existing = options.existingTags ?? [];
  const allTags = [...existing, ...tagsToAdd].filter(Boolean);
  if (allTags.length > 0) {
    payload.tags = Array.from(new Set(allTags));
  }

  return payload;
}

// ── Enregistrement des seules CLÉS DE CODE irréductibles référencées par le schéma ─────────────────────────
// Le descripteur + la spec sont compilés et enregistrés par le LOADER (`spec.ts` → `registerCostumForm`),
// EXACTEMENT comme un costum de config — plus de `registerDescriptor` ici.
// Options DYNAMIQUES `tl:years` (champ openingYear via enumFrom) : années courante+5 → 1900, recalculées au rendu
// (PAS figées dans le JSON). new Date() à chaque appel → toujours à jour.
registerOptions("tl:years", () => {
  const now = new Date().getFullYear();
  return Array.from({ length: now + 5 - 1900 + 1 }, (_, i) => String(now + 5 - i)).map((y) => ({ value: y, label: y }));
});
registerDefaultsFn("tl:emptyDefaults", () => getDefaultTiersLieuxValues() as unknown as Record<string, unknown>);
// Scope = slug du costum porteur (VITE_SLUG), fallback getSlug() — exposé via {slug} (slugKey "slug").
registerScopeFn("tl:scope", (carrier) => ({ slug: carrierSlug(carrier) || getSlug() }));
// Payload mode-aware : create scopé costum (merge presets extraData + tags) ; edit complet (vides typés) + merge tags existants.
// Descripteur résolu au RUNTIME depuis le registre (registerCostumForm — TS ou config) → plus de descripteur figé.
registerPayloadFn("tl:payload", (form, ctx: EntityModalCtx) => {
  const descriptor = getDescriptor("tiers-lieux");
  if (!descriptor) throw new Error("[tiers-lieux] descripteur non enregistré (registerCostumForm)");
  const co = ctx.costum as CostumConfig | undefined;
  if (ctx.mode === "edit") {
    const existingTags = (ctx.entity?.serverData?.tags as string[] | undefined) ?? [];
    const addTags = co?.mainTag ? [co.mainTag] : [];
    return buildTiersLieuxPayload(form as unknown as TiersLieuxFormData, descriptor, { existingTags, addTags, complete: true });
  }
  return buildTiersLieuxPayload(form as unknown as TiersLieuxFormData, descriptor, co ? { costum: co } : undefined);
});
// tl:invalidate SUPPRIMÉ → clé générique `invalidate:standard` (sharedFns) + params {userList:"organizations"} dans le schéma.
// image:profilUrl : clé COMMUNE enregistrée dans ../sharedFns (importé en side-effect en tête de fichier).
