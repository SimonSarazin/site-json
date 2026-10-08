import { LocalizedString } from "@/types/locale-schema";
import { ActionButtonSchema } from "@/types/action-button-schema";
import { GeoShapeSourceSchema } from "@/types/geo-shape-schema";
import { PredicateJson } from "@/modules/formEngine/config";
import type { SearchEntity, News } from "@communecter/cocolight-api-client";
import { IconName } from "lucide-react/dynamic";
// Primitives du tableau de bord (dimensions/KPI/graphes) : fichier SANS import
// search — `observatoire/schema.ts`, lui, importe celui-ci (cf. son en-tête).
import { ObservatoryPanelConfSchema } from "@/modules/observatoire/dashboardSchema";
import { z } from "zod";

/**
 * Nom d'icône lucide. Typé `IconName` (au lieu de `z.string()`) sans énumérer les
 * ~1500 littéraux : `z.custom` est permissif au runtime mais expose le bon type
 * → plus de cast `as IconName` côté composant. Réutilisable par tous les champs icône.
 */
export const IconNameSchema = z.custom<IconName>();

//──────────────── Filters Section
// Section sidebar qui pilote le state des filtres (selectedFilters,
// searchByFields, searchQuery) consommé par SearchPro/SearchProStatic via
// PageFiltersContext. Vit dans le module search car elle n'a de sens qu'avec
// un consommateur search dans le même PageFiltersProvider.

// ─── Schémas de filtres (partagés) ───────────────────────────────────────────
// Source unique réutilisée par `FiltersSectionSchema` (UI /lieux) ET par le hero
// (applicateur headless de la home) — évite la duplication inline.

/** Widget COMPACT au lieu de l'accordéon à cases (matrice observatoire) :
 *  {} → Select simple · {multiple} → combobox multi coche-à-droite ·
 *  {searchable} → MultipleSelector (sélection unique) · {multiple, searchable}
 *  → MultipleSelector multi. Absent → accordéon (défaut). Disponible sur les
 *  groupes statiques, scopeList ET les groupes « par réponses ». */
export const FilterSelectConfigSchema = z.object({
  multiple: z.boolean().optional(),
  searchable: z.boolean().optional(),
});

/** Style des lignes d'option en mode ACCORDÉON : cases à cocher (défaut) ou
 *  lignes à coche à DROITE (look SelectItem). Disponible sur les trois familles
 *  de groupes. Sans effet si un widget `select` est déclaré. */
export const FilterOptionStyleSchema = z.enum(["checkbox", "check"]);

/**
 * Source DYNAMIQUE des options d'un filtre — deux origines, exclusives l'une de l'autre :
 *
 *  • `list` — une liste déclarée du costum (`costum.lists.<nom>`, forme `{collection, distinct,
 *    where}`), résolue par `costum/co/listvalues`. Les valeurs viennent de la DONNÉE : le filtre
 *    suit ce que les fiches contiennent, au lieu d'une liste figée qui dérive (mesuré sur
 *    institutBleu : 12 territoires déclarés contre 64 en base, soit 52 valeurs injoignables).
 *
 *  • `shapes` — le RÉFÉRENTIEL d'une couche de contours (cf. `GeoShapeSourceSchema`) : une option
 *    par contour, `id`/`value` = l'`_id` du document, libellé = son `name`. C'est ce qui permet de
 *    filtrer sur un IDENTIFIANT stable (`address.zonirisId`) plutôt que sur un nom, qu'une
 *    correction en base peut changer sans préavis.
 *    ⚠️ La déclaration doit REPRODUIRE celle de la couche que la page dessine — `source`, `filters`
 *    ET `simplify`, les trois seuls champs dont la clé de cache est faite (cf. `geoShapesQueryKey`).
 *    À l'identique, filtre et carte partagent UN SEUL appel réseau ; diverger d'un champ télécharge
 *    le référentiel deux fois (147 Ko gzip pour les 7 bassins de vie de Saint-Paul). Le test
 *    preflight `options-from-shapes` refuse une déclaration qui ne s'apparie à aucune couche.
 *    ⚠️ Les options sont les contours DESSINABLES : un document sans `geoShape` est écarté en amont
 *    par `toFeatureCollection` et n'a donc pas d'option.
 *
 * REMPLACE par défaut les `options` écrites à la main — pas de fusion. Les valeurs dynamiques n'ont
 * donc PAS de libellé traduit : elles s'affichent telles qu'elles sont stockées. C'est un choix :
 * traduire supposerait de maintenir une table en config, donc de recréer la dérive qu'on vient de
 * supprimer. Avec `withDeclared`, les `options` déclarées deviennent au contraire un SOCLE fusionné en
 * tête, et gardent leur libellé.
 *
 * Sans `optionsFrom`, rien ne change : les options déclarées font foi, comme aujourd'hui.
 */
export const OptionsFromSchema = z.union([
  z.object({
    /** Nom de la liste dans `costum.lists`, ou PLUSIEURS à fusionner (ordre = priorité) — cas d'un
     *  même champ alimenté depuis plusieurs collections, qui demande une recette par collection.
     *  Chacune est résolue SELON SA FORME : statique (tableau/map) lue en mémoire, recette
     *  (`{collection, distinct, where}`) envoyée à `costum/co/listvalues`. La détection est
     *  automatique — le rédacteur de config n'a pas à savoir sous quelle forme la liste est déclarée. */
    list: z.union([z.string(), z.array(z.string()).min(1)]),
    /** Costum porteur ; par défaut celui du site. */
    costumSlug: z.string().optional(),
    /** Les `options` déclarées deviennent le SOCLE (fusionné en tête, libellés i18n conservés) au lieu
     *  d'un simple repli de chargement. Opt-in : fusionner partout ferait réapparaître des valeurs de
     *  config absentes de la base, donc des filtres qui ne rendent rien. */
    withDeclared: z.boolean().optional(),
  }),
  z.object({
    /** Couche de contours servant de référentiel — même déclaration que celle de la carte. */
    shapes: GeoShapeSourceSchema,
  }),
]);

export const FilterGroupSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  // `searchTargets` : filtre « type d'info » (CDC parents62) — sélection UNIQUE
  // (radio) ; chaque option porte sa cible `target` (defaultTypes/defaultFilters)
  // appliquée par SearchProStatic (cf. searchByFieldsToQuery.searchTarget).
  // `dateRange` : filtre par date (CDC parents62) — champ date « À partir du »
  // traduit en `filters[field].$gt` (SEUL opérateur date converti par le
  // backend, cf. SearchNew::getQueries). La borne de fin existe dans le state
  // mais son rendu est conditionné à `withEnd` (activable quand le backend
  // convertira $lte — demande transmise à Aboire).
  type: z.enum(['scopeList', "filters", "entityList", "searchTargets", "dateRange"]).default("filters"),
  /** Champ filtré. Sur un groupe `filters`, sa présence bascule le groupe du
   *  filtrage par TAG (défaut historique) au filtrage par CHAMP de l'entité :
   *  la sélection part dans `searchByFields` → `{ <field>: { $in: [noms
   *  d'options] } }`. Les `options[].name` doivent alors porter la valeur EXACTE
   *  stockée en base (ex. parent62 : `field:"territoires"`, name `"Arrageois"`). */
  field: z.string().optional(),
  /** `dateRange` : affiche aussi la borne de fin (nécessite le support backend $lte). */
  withEnd: z.boolean().optional(),
  options: z.array(z.object({
    id: z.string(),
    label: LocalizedString,
    level: z.string().optional(),
    name: z.string().optional(),
    defaultChecked: z.boolean().optional(),
    /** Pastille de couleur de l'option (ex. territoire — valeur CSS `var(--…)`). */
    color: z.string().optional(),
    /** Cible de recherche (groupes `searchTargets`) — forward-ref car
     *  SearchTargetSchema dépend de SearchTypeSchema, défini plus bas. */
    target: z.lazy(() => SearchTargetSchema).optional(),
    /** Graphies regroupées derrière la valeur affichée — POSÉ AU RUNTIME par `useDynamicFilterOptions`
     *  (jamais écrit en config). Le filtre doit interroger tout le groupe : n'envoyer que « Le Port »
     *  laisserait de côté les fiches portant « LE PORT » ou « Le port ». Déclaré ici pour que les
     *  consommateurs le lisent sans cast. */
    variants: z.array(z.string()).optional(),
  })).optional(),
  /** Source des options : une ou plusieurs listes `costum.lists` (cf. `OptionsFromSchema` du
   *  searchHeader). Sur un groupe à `field`, chaque option reçoit `name` = la valeur stockée, donc le
   *  filtrage par champ fonctionne tel quel. */
  optionsFrom: OptionsFromSchema.optional(),
  /** DÉPRÉCIÉ — alias de `optionsFrom.list`. Distinguait autrefois la source STATIQUE de la source
   *  dynamique ; la forme est désormais détectée à la lecture (`useDynamicFilterOptions`), le rédacteur
   *  de config n'a plus à choisir. Conservé pour les configs existantes. */
  optionsKey: z.string().optional(),
  config: z.object({
    countryCode: z.array(z.string()).optional(),
    level: z.array(z.string()).optional(),
    upperLevelId: z.string().optional(),
    sortBy: z.string().optional(),
  }).optional(),
  // Pour `type: "entityList"` — recherche backend qui peuple les options
  // dynamiquement (réseaux régionaux, etc.). Réutilise le shape baseParams
  // des sections search. Forward-ref car SearchBaseParamsSchema est défini
  // plus bas dans le fichier.
  baseParams: z.lazy(() => SearchBaseParamsSchema).optional(),
  // Comment l'option sélectionnée filtre les résultats à droite.
  // "sourceKey" → injecte la valeur dans baseParams.sourceKey (param natif
  // SDK : matching source.key/source.keys/reference.costum côté backend).
  filterType: z.enum(["sourceKey"]).optional(),
  // Champ de l'entité utilisé comme valeur de filtre (défaut: "slug").
  filterBy: z.string().optional(),
  /** Widget compact (cf. {@link FilterSelectConfigSchema}). Absent → accordéon. */
  select: FilterSelectConfigSchema.optional(),
  /** Style des lignes en accordéon (cf. {@link FilterOptionStyleSchema}). */
  optionStyle: FilterOptionStyleSchema.optional(),
  /** Position d'affichage (tri croissant) — permet d'intercaler un groupe
   *  d'une famille (statique/scope/entity) parmi les groupes « par réponses »
   *  et inversement. Défaut : ordre naturel (filterGroups puis par-réponses). */
  order: z.number().optional(),
  /** Par défaut les options d'un groupe sont triées par libellé localisé.
   *  `true` conserve l'ordre DÉCLARÉ (ex. tranches de prix croissantes). */
  keepOptionOrder: z.boolean().optional(),
});
export const FilterGroupsSchema = z.array(FilterGroupSchema);

export const FiltersByAnswersSchema = z.record(z.string(), z.object({
  id: z.string().optional(),
  label: LocalizedString,
  type: z.enum(["form", 'answers']).default("answers"),
  path: z.string().optional(),
  forms: z.string().optional(),
  finderPath: z.string().optional(),
  /**
   * Quel document la sélection filtre-t-elle ?
   *  - `linkedElements` (défaut, comportement historique) : la liste porte les
   *    éléments LIÉS aux réponses (organisations de `/lieux`) → `_id: {$in: orgaNameArray}` ;
   *  - `answers` : la liste porte les RÉPONSES elles-mêmes (`defaultTypes: ["answers"]`,
   *    ex. `/creneaux`) → prédicat sur le chemin de la réponse (cf. `answerFilterClause`).
   * Sans ce réglage, une facette posée sur une liste d'answers filtre par id
   * d'organisation et ne rend jamais rien.
   */
  filterTarget: z.enum(["answers", "linkedElements"]).optional(),
  /** Widget compact (cf. {@link FilterSelectConfigSchema}). Absent → accordéon. */
  select: FilterSelectConfigSchema.optional(),
  /** Style des lignes en accordéon (cf. {@link FilterOptionStyleSchema}). */
  optionStyle: FilterOptionStyleSchema.optional(),
  /** Position d'affichage (tri croissant) — cf. FilterGroupSchema.order. */
  order: z.number().optional(),
  value: z.record(z.string(), z.object({
    id: z.string(),
    finder: z.string(),
  })).optional(),
}));

// Filtres par thématique CoForm via `coformFilterByPath` (un appel par entrée).
// Même structure de sortie que filtersByAnswers (sélection → filters._id.$in =
// orgaNameArray, ou prédicat de chemin si `filterTarget: "answers"`) mais appel
// backend différent.
export const FiltersByPathSchema = z.record(z.string(), z.object({
  id: z.string().optional(),
  label: LocalizedString,
  thematicPath: z.string(),
  finderPath: z.string().optional(),
  // notSourceKey: true → cherche dans tout le réseau (cf. coformFilterByPath).
  notSourceKey: z.boolean().optional(),
  /**
   * Quel document la sélection filtre-t-elle ?
   *  - `linkedElements` (défaut, comportement historique) : la liste porte les
   *    éléments LIÉS aux réponses (organisations de `/lieux`) → `_id: {$in: orgaNameArray}` ;
   *  - `answers` : la liste porte les RÉPONSES elles-mêmes (`defaultTypes: ["answers"]`,
   *    ex. `/creneaux`) → prédicat sur le chemin de la réponse (cf. `answerFilterClause`).
   * Sans ce réglage, une facette posée sur une liste d'answers filtre par id
   * d'organisation et ne rend jamais rien.
   */
  filterTarget: z.enum(["answers", "linkedElements"]).optional(),
  /** Widget compact (cf. {@link FilterSelectConfigSchema}). Absent → accordéon. */
  select: FilterSelectConfigSchema.optional(),
  /** Style des lignes en accordéon (cf. {@link FilterOptionStyleSchema}). */
  optionStyle: FilterOptionStyleSchema.optional(),
  /** Position d'affichage (tri croissant) — cf. FilterGroupSchema.order. */
  order: z.number().optional(),
}));

export const FiltersSectionSchema = z.object({
  type: z.literal("filters"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    filterGroups: FilterGroupsSchema,
    filtersByAnswers: FiltersByAnswersSchema.optional(),
    filtersByPath: FiltersByPathSchema.optional(),
    defaultOpenGroups: z.array(z.string()).optional(),
    className: z.string().optional(),
    /** Masque le champ de recherche texte du panneau (ne garde que les groupes de filtres). */
    hideSearch: z.boolean().optional(),
  }),
});

export type FiltersSection = z.infer<typeof FiltersSectionSchema>;
export type FiltersSectionProps = z.infer<typeof FiltersSectionSchema>["props"];

//──────────────── Search Pro Section
const TagsFilterSchema = z.object({
  type: z.union([z.literal("tags"), z.literal("type")]),
  name: LocalizedString.or(z.string()),
  list: z.array(LocalizedString.or(z.string()))
         .or(z.record(z.string(), LocalizedString.or(z.string()))),
  active: z.boolean().optional(),
  previewVisible: z.boolean().optional(),
  previewIcon: z.string().optional(),
});

export type TagsFilter = z.infer<typeof TagsFilterSchema>;

/** Contenu du détail (rendu DANS le conteneur `detailsMode`). Axe indépendant
 *  de la carte : `Preview.tsx` dispatche dessus. Noms design/fonctionnalité.
 *  Exporté : réutilisé par le module observatoire (rowAction preview). */
/**
 * Une facette du preview générique `facets` : un champ `serverData` affiché et,
 * s'il est indexé par un dropdownFilter (`filter.field === field`), cliquable
 * pour filtrer le listing (cf. `ClickableFacet` / `useDropdownFilterNav`).
 */
export const PreviewFacetSchema = z.object({
  /** Chemin `serverData` (dot-path supporté, ex. `address.postalCode`). */
  field: z.string(),
  label: LocalizedString.optional(),
  /** Nom d'icône lucide (via `DynamicIcon`). */
  icon: z.string().optional(),
});
export type PreviewFacetConfig = z.infer<typeof PreviewFacetSchema>;

/**
 * Lien vers la fiche d'une entité portée par une AUTRE page du site : le chemin
 * de la page + le param d'URL qui y ouvre le détail.
 *
 * ⚠️ La page visée doit savoir charger l'item PAR IDENTIFIANT
 * (`list.previewFetch`) : sans ça, le param n'ouvre que ce que sa liste a déjà
 * chargé (10 résultats par défaut) et le lien resterait sans effet, en silence.
 */
export const EntitySheetLinkSchema = z.object({
  /** Chemin de la page qui porte la fiche (ex. `/annuaire`). */
  path: z.string(),
  /** Param d'URL qui y ouvre le détail — doit valoir le `list.previewParam` de
   *  cette page. Défaut : "preview". */
  previewParam: z.string().optional(),
});
export type EntitySheetLink = z.infer<typeof EntitySheetLinkSchema>;

/** Param d'URL par défaut d'ouverture d'une fiche (cf. `list.previewParam`). */
export const DEFAULT_PREVIEW_PARAM = "preview";

/**
 * Réservations récurrentes d'une ressource : answers d'un formulaire CoForm
 * reliées à l'entité affichée par un champ finder. Tout l'ancrage (form, étape,
 * suffixes de champs) vient de la CONFIG du site — le code ne connaît que des
 * RÔLES. Clé réelle d'un champ = `<step><suffixe>` (et `finder<step><suffixe>`
 * pour le finder), sous `serverData.answers[<step>]`.
 */
export const ReservationsConfSchema = z.object({
  /** ObjectID du formulaire CoForm des réservations (champ `form` des answers). */
  form: z.string(),
  /** Clé d'étape CoForm (préfixe des clés de champs). */
  step: z.string(),
  /** Mapping rôle → SUFFIXE de champ. */
  fields: z.object({
    /** Finder vers la ressource (valeur = objet `{<id>: {id, name, type}}`). */
    finder: z.string(),
    /** Nom de l'usager (texte). Champ HISTORIQUE : conservé en repli tant que
     *  toutes les réponses n'ont pas été rattachées par `userOrga`. */
    user: z.string(),
    /**
     * Finder vers l'ORGANISATION usagère (valeur = objet `{<id>: {id, name, type}}`),
     * qui rattache la réservation à un club par IDENTIFIANT et non plus par son nom.
     * Optionnel : sans lui, la lecture retombe sur le texte de `user`, et un même club
     * saisi des deux façons ne fait qu'un seul groupe (la clé de regroupement plie
     * casse et accents à défaut d'identifiant).
     * Noter que la valeur est rangée sous la clé PRÉFIXÉE `finder<step><suffixe>`,
     * comme `finder` — pas sous `<step><suffixe>`.
     */
    userOrga: z.string().optional(),
    /** Activité pratiquée (texte). */
    activity: z.string(),
    /** Créneaux hebdo récurrents (timeSlots `{day, startHour, …}`). */
    slots: z.string(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    bookingType: z.string().optional(),
  }),
  /** Plafond d'answers chargées (garde de pagination). Défaut : 200. */
  maxAnswers: z.number().int().positive().optional(),
  /**
   * Bouton « fiche » de l'ORGANISATION usagère, sur sa rangée dans la section
   * réservations (OPT-IN). Il n'apparaît que sur les réservations rattachées par
   * IDENTIFIANT (finder `userOrga`) : le texte historique ne désigne aucune
   * fiche — deux clubs peuvent porter le même nom, et un nom saisi à la main ne
   * correspond pas toujours à une organisation existante. Pas d'identifiant,
   * pas de bouton : jamais de lien mort.
   */
  orgaLink: EntitySheetLinkSchema.optional(),
  /**
   * Prise de réservation depuis la fiche (OPT-IN). Absent = comportement
   * historique : grille hebdo en blocs empilés, lecture seule. Présent = grille
   * à l'échelle horaire, cases libres cliquables ouvrant le formulaire CoForm
   * pré-rempli (équipement verrouillé, créneau repris).
   *
   * L'amplitude n'est qu'une GRILLE DE RÉFÉRENCE : aucun horaire d'ouverture
   * n'existe sur les équipements en base. Une case libre signifie « aucune
   * réservation connue », pas « l'équipement est ouvert ».
   */
  booking: z.object({
    /** Première heure affichée (0-23). Défaut code : 8. */
    startHour: z.number().int().min(0).max(23).optional(),
    /** Dernière heure affichée, exclue (1-24). Défaut code : 22. */
    endHour: z.number().int().min(1).max(24).optional(),
    /** Pas de la grille, en minutes (5-240). Défaut code : 60. Borné : `positive()` laissait
     *  passer `slotMinutes: 1`, soit 840 rangées × 7 = 5 880 cases cliquables sur une amplitude
     *  8 h–22 h, pour un pas qui n'a aucun sens sur un équipement sportif. */
    slotMinutes: z.number().int().min(5).max(240).optional(),
    /** Réserver réservé aux admins de l'entité du site. Défaut code : true. */
    adminOnly: z.boolean().optional(),
  })
    // Les deux bornes étaient valides SÉPARÉMENT (0-23 et 1-24) mais jamais l'une par rapport à
    // l'autre : `startHour: 22, endHour: 8` passait la validation et donnait une grille réduite à
    // la rangée de repli. C'est à `config:validate` de l'attraper, pas au rendu.
    .refine(
      (b) => b.startHour === undefined || b.endHour === undefined || b.startHour < b.endHour,
      { message: "booking.startHour doit être strictement inférieur à booking.endHour", path: ["startHour"] },
    )
    .optional(),
});
export type ReservationsConf = z.infer<typeof ReservationsConfSchema>;

/**
 * Tableau de bord d'installation : modal ouverte depuis le détail
 * `poi-amenities` en cliquant le nom de l'installation. Agrège les équipements
 * partageant `groupKey` et leurs réservations (requiert `reservations` dans le
 * même bloc preview).
 */
export const InstallationDashboardConfSchema = z.object({
  /** Champ `serverData` identifiant STABLE de l'installation (regroupement). */
  groupKey: z.string().default("inst_numero"),
  /** Champ `serverData` du libellé affiché. */
  labelKey: z.string().default("inst_nom"),
  /** Champ `serverData` du type d'équipement — affiché dans la liste de repli
   *  quand l'installation n'a aucun créneau. */
  typeKey: z.string().default("equip_type_name"),
  /** Amplitude hebdomadaire de référence du taux d'utilisation
   *  (ex. 8h–22h × 7j = 98 h/sem). */
  referenceAmplitude: z.object({
    startHour: z.number().int().min(0).max(24),
    endHour: z.number().int().min(0).max(24),
    days: z.number().int().min(1).max(7),
  }),
  /** Périmètre de la requête POI (fusionné avec `{[groupKey]: <valeur>}`) —
   *  requis, comme pour l'observatoire : aucun défaut métier dans le code. */
  poiFilters: z.record(z.string(), z.unknown()),
  /** Périmètre `source.key` de la requête POI (param SDK natif). À renseigner
   *  quand les équipements vivent sous un AUTRE costum que le site courant
   *  (ex. site saintpaulSport1 → données equipementsSportifs974). Absent →
   *  scope au costum courant. */
  sourceKey: z.array(z.string()).optional(),
  /** Pondération de la répartition des activités. Défaut : "hours". */
  activityMetric: z.enum(["hours", "slots"]).optional(),
  /** Champs POI additionnels projetés (en plus de name/groupKey/labelKey…). */
  extraPoiFields: z.array(z.string()).optional(),
  /** Nom du param d'URL qui ouvre la fiche (partage/deep-link) — miroir de
   *  `list.previewParam` pour l'équipement. Défaut : "installation". */
  param: z.string().optional(),
});
export type InstallationDashboardConf = z.infer<typeof InstallationDashboardConfSchema>;

/** Param d'URL par défaut de la fiche installation (cf. `installationDashboard.param`). */
export const DEFAULT_INSTALLATION_PARAM = "installation";

/**
 * Section « équipements réservés » du preview `structure` : les réservations de
 * l'ORGANISATION affichée, lues dans le même formulaire que la fiche
 * équipement. Le sens inverse de `reservations.orgaLink`.
 *
 * Requiert, dans le MÊME bloc preview, un `reservations` (l'ancrage
 * form/étape/champs) dont les `fields.userOrga` sont renseignés : c'est ce
 * finder qui relie une réservation à un club.
 */
export const BookedResourcesConfSchema = z.object({
  /** Lien « fiche » de l'équipement (ex. `{ path: "/equipements-sportifs" }`).
   *  Absent = les équipements sont listés sans bouton. */
  link: EntitySheetLinkSchema.optional(),
  /** Titre de la section. Défaut : libellé i18n du module search. */
  label: LocalizedString.optional(),
});
export type BookedResourcesConf = z.infer<typeof BookedResourcesConfSchema>;

export const PreviewConfSchema = z.object({
  type: z.enum(["default", "poi-amenities", "coform-answer", "event", "facets", "news", "testimonial", "resource", "resource-directory", "structure"]).default("default"),
  // Mapping rôle→suffixe de champ CoForm (pour `coform-answer`). Surcharge la
  // table par défaut du composant — découple les IDs de champs du code.
  fields: z.record(z.string(), z.string()).optional(),
  // Bouton « Modifier » sur le détail `coform-answer` (admins de l'entité du
  // site) : ouvre l'édition de l'answer en CoFormModal. Opt-in — sans ce flag,
  // le preview reste strictement lecture seule (aucun changement des sites existants).
  editButton: z.boolean().optional(),
  /** Facettes du preview générique (`type: "facets"`) — data-driven, sans code. */
  facets: z.array(PreviewFacetSchema).optional(),
  /**
   * Affiche le résumé sous le titre du preview générique (`type: "facets"`). Défaut : affiché — une
   * fiche réduite à ses facettes perdrait sa présentation. `false` quand les facettes se suffisent.
   * Lu par `PreviewFacets`.
   */
  showDescription: z.boolean().optional(),
  /** Section « réservations » du preview `poi-amenities` (absente = masquée). */
  reservations: ReservationsConfSchema.optional(),
  /** Modal tableau de bord installation (requiert `reservations`). */
  installationDashboard: InstallationDashboardConfSchema.optional(),
  /** Section « équipements réservés » du preview `structure` (requiert
   *  `reservations` + `reservations.fields.userOrga`). Absente = masquée. */
  bookedResources: BookedResourcesConfSchema.optional(),
  /**
   * Affiche le lien « Voir en page » (permalien vers le détail/profil) dans l'en-tête de la
   * modal de détail. Défaut : affiché (mettre `false` pour le masquer). Lu par `PreviewNews`.
   */
  showDetailLink: z.boolean().optional(),
  /**
   * Largeur MAX du conteneur de détail en mode `dialog` (échelle Tailwind `max-w-*`). Découple la
   * taille de la modale du type de preview : un témoignage (lecture) veut une mesure resserrée
   * (`2xl` ≈ 672px), un contenu riche (news+images, POI+carte) profite de `5xl`. Défaut code : `5xl`
   * (comportement historique). Sans effet en mode `drawer` (panneau latéral). Lu par `DetailsModeDialog`.
   */
  width: z.enum(["sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "full"]).optional(),
}).partial();

/**
 * Filtre de listing déclenché par une valeur cliquable de la CARTE (pas de
 * dropdown : la cardinalité — plus de 1000 installations — l'interdit).
 *
 * On filtre sur `groupKey` (identifiant STABLE) et non sur le libellé affiché :
 * un libellé peut contenir une virgule (séparateur multi-valeurs de l'URL) et
 * deux installations distinctes peuvent être homonymes. Même symétrie que
 * `installationDashboard.groupKey`/`labelKey`.
 */
export const InstallationFilterConfSchema = z.object({
  /** Champ `serverData` filtré — identifiant stable. */
  groupKey: z.string().default("inst_numero"),
  /** Nom du param d'URL (miroir de la sélection). */
  param: z.string().default("poi-installation"),
});
export type InstallationFilterConf = z.infer<typeof InstallationFilterConfSchema>;

/**
 * Contrat « testimonial » (témoignage) — GÉNÉRIQUE et config-driven : découple le composant des noms de
 * champs / couleurs d'un site. Un `design` sélectionne une paire cohérente Card+Preview, toutes deux nourries
 * par le même contrat (`useTestimonialData`). Les couleurs (badge/accent) vivent en config (map valeur→couleur,
 * matchée par `normalizeFilterValue`) avec repli palette déterministe ; les repères réutilisent
 * `PreviewFacetSchema` (aucun champ en dur).
 */
export const TestimonialConfSchema = z.object({
  /** Look — sélectionne `CardTestimonial{Design}` + `PreviewTestimonial{Design}` (repli code : "bubble"). */
  design: z.enum(["bubble"]).default("bubble"),
  /** Champ `serverData` de la citation (le héros). Repli code : "description". */
  quoteField: z.string(),
  /** Champ du titre / attribution. Repli code : "name". */
  titleField: z.string().optional(),
  /** Champ de la date. Repli code : "created". */
  dateField: z.string().optional(),
  /** Champ secondaire affiché en pied de la carte teaser (ex. thème). Optionnel. */
  subtitleField: z.string().optional(),
  /** Champ du média audio (`[{type:"audio", url}]`). Repli code : "medias". */
  audioField: z.string().optional(),
  /** Champ de l'illustration (bannière de la carte et de la preview). Repli code : "profilMediumImageUrl",
   *  puis "profilImageUrl", puis la 1re image de `medias` — un témoignage sans image reste rendu tel quel. */
  imageField: z.string().optional(),
  /** Cadrage de l'illustration : `cover` (défaut, rognée sur un ratio 16/9) ou `contain` (image ENTIÈRE,
   *  centrée, sur un fond flou tiré de la même image — pour une affiche ou un visuel dont le ratio n'est
   *  pas 16/9). Opt-in : sans lui, le rendu historique est inchangé. */
  imageFit: z.enum(["cover", "contain"]).optional(),
  /** Catégorie : pilote la teinte de la bulle + la pastille. `colors` = map valeur→couleur (`var()` ou hex). */
  badge: z.object({ field: z.string(), colors: z.record(z.string(), z.string()).optional() }).optional(),
  /** Accent (ex. territoire) : pilote le point coloré. `colors` = map valeur→couleur (`var()` ou hex). */
  accent: z.object({ field: z.string(), colors: z.record(z.string(), z.string()).optional() }).optional(),
  /** Repères (taxonomies) — data-driven, réutilise le mécanisme facettes générique (aucun champ en dur). */
  facets: z.array(PreviewFacetSchema).optional(),
}).partial();

export type TestimonialConf = z.infer<typeof TestimonialConfSchema>;

/**
 * Contrat « resource » (ressource) — GÉNÉRIQUE et config-driven, même esprit que `testimonial` : découple la
 * card/preview des noms de champs / couleurs d'un site. Une ressource est image-first (galerie/photo) + liens
 * + documents, avec une catégorie (badge coloré), une ville (adresse) et des repères (taxonomies). Alimenté
 * par `useResourceData` (défauts génériques : name/description/created/profilMediumImageUrl/urls/address).
 */
export const ResourceConfSchema = z.object({
  /** Look — sélectionne `CardResource{Design}` + `PreviewResource{Design}` (repli code : "card").
   *  `document` : ligne compacte qui ouvre directement le document hébergé, sinon le lien — pour une
   *  archive de publications où chaque entrée n'est qu'un titre et un fichier.
   *  `portrait` : une PERSONNE présentée en entier — photo ronde (initiales à défaut), nom,
   *  `subtitleField`, puis la présentation markdown (`descriptionField`) et ses liens. Carte non
   *  cliquable : pas de preview. */
  design: z.enum(["card", "document", "portrait"]).default("card"),
  /** Champ du titre. Repli code : "name". */
  titleField: z.string().optional(),
  /** Champ du sous-titre (ex. la fonction d'une personne), lu par `portrait`. Pas de repli : absent =
   *  pas de sous-titre — un repli sur la description répéterait le texte affiché juste dessous. */
  subtitleField: z.string().optional(),
  /** Champ de la description (extrait card / markdown preview). Repli code : "description". */
  descriptionField: z.string().optional(),
  /** Champ de la date. Repli code : "created". */
  dateField: z.string().optional(),
  /** Champ de l'image de vignette. Repli code : "profilMediumImageUrl". */
  imageField: z.string().optional(),
  /** Catégorie (pilote la pastille colorée + l'icône de type). `colors`/`icons` = maps valeur→(couleur|nom
   *  d'icône lucide). Repli code : `field="category"` + map d'icônes par défaut (vidéo→video, photo→images…). */
  badge: z.object({
    field: z.string(),
    colors: z.record(z.string(), z.string()).optional(),
    icons: z.record(z.string(), z.string()).optional(),
    /**
     * Map valeur STOCKÉE → libellé AFFICHÉ (localisé). Troisième carte, à côté de `colors` et
     * `icons`, pour le cas où le champ stocke une CLÉ (`mss`, `has`…) et non un libellé : sans
     * elle la pastille afficherait la clé brute. Indispensable sur un site multilingue, où
     * stocker le libellé français rendrait la version anglaise fausse. Valeur absente de la map
     * (ou map absente) → la valeur stockée est affichée telle quelle, comportement historique.
     */
    labels: z.record(z.string(), LocalizedString).optional(),
  }).optional(),
  /** Champ de la ville affichée. Repli code : "address.addressLocality". */
  cityField: z.string().optional(),
  /** Champ des liens externes (`string[]`). Repli code : "urls". */
  urlsField: z.string().optional(),
  /** Champ des médias (`[{type,url,name}]`) → galerie (images), documents (fichiers), audio, vidéo. Repli : "medias". */
  mediasField: z.string().optional(),
  /** Repères (taxonomies) — data-driven, réutilise le mécanisme facettes générique. */
  facets: z.array(PreviewFacetSchema).optional(),
}).partial();

export type ResourceConf = z.infer<typeof ResourceConfSchema>;

/**
 * Contrat « resource-directory » (cf. section `coform-resource-directory`) — lu
 * par Card/PreviewResourceDirectory dans `list.resourceDirectory`. La section le
 * remplit depuis ses propres props ; il n'est pas destiné à être écrit à la main.
 */
export const ResourceDirectoryConfSchema = z.object({
  resourceTypes: z.array(z.object({
    id: z.string(),
    kind: z.enum(["coworking", "meeting", "accommodation"]),
    formId: z.string(),
    stepPrefix: z.string(),
    label: LocalizedString,
    linkSuffix: z.string().optional(),
    descriptionSuffix: z.string().optional(),
    servicesSuffix: z.string().optional(),
  })),
  finderSuffix: z.string(),
  fieldSuffixes: z.object({
    name: z.string().optional(),
    equipments: z.string().optional(),
    area: z.string().optional(),
    bookingUrl: z.string().optional(),
  }).optional(),
});
export type ResourceDirectoryConf = z.infer<typeof ResourceDirectoryConfSchema>;

/** Coloration data-driven par VALEUR de `serverData` (ex. tag territoire →
 *  couleur du territoire, CDC parents62). `mapping` : valeur exacte → couleur
 *  CSS — `var(--…)` recommandé (suit light/dark via le thème), jamais d'hex.
 *  `path` : dot-path serverData (déf. `tags`) ; valeur string ou tableau —
 *  le premier tag de l'item présent dans le mapping gagne (cf. lib/colorBy). */
export const ColorByConfSchema = z.object({
  path: z.string().optional(),
  mapping: z.record(z.string(), z.string()),
});
export type ColorByConf = z.infer<typeof ColorByConfSchema>;

/** Chips de tags des cartes : couleur par tag (`mapping`), libellé lisible
 *  (`labels`, déf. namespace retiré + capitalisation) et MASQUAGE des tags
 *  techniques (`hidePrefixes`, ex. `public:`/`age:` — filtrants mais pas
 *  affichables bruts ; `hideTags`, égalité STRICTE, pour un marqueur complet
 *  comme `lieux-sante` qui ne doit pas emporter `lieux-sante-mentale`).
 *  Consommé par `decorateTags` (lib/colorBy).
 *  `paths` : dot-paths serverData dont les valeurs s'ajoutent aux chips —
 *  nécessaire quand la taxonomie vit dans des CHAMPS et non dans `tags`
 *  (parent62 : `["territoires"]`), cf. `collectChipValues`. */
export const TagColorsConfSchema = z.object({
  mapping: z.record(z.string(), z.string()),
  labels: z.record(z.string(), z.string()).optional(),
  hidePrefixes: z.array(z.string()).optional(),
  hideTags: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
});
export type TagColorsConf = z.infer<typeof TagColorsConfSchema>;

/**
 * Bloc `card` d'une liste. Extrait de {@link ListConfSchema} pour être réutilisable par
 * {@link ListItemRuleSchema} (une règle par item surcharge la carte) sans `z.lazy`.
 */
export const CardConfSchema = z.object({
    tagLimit:        z.number().int().min(1).max(50).optional(),
    /** Chips colorées / masquage des tags techniques (cf. TagColorsConfSchema). */
    tagColors:       TagColorsConfSchema.optional(),
    showDescription: z.boolean().optional(),
    showAddress:     z.boolean().optional(),
    shareButton:     z.boolean().optional(),
    showStar:        z.boolean().optional(),
    // Bloc de compteurs de la carte `profile` (aujourd'hui : nombre de projets liés).
    // Absent = affiché, pour ne rien changer aux 24 usages existants du parc.
    // `false` sur un annuaire de structures qui ne portent pas de projets : le
    // compteur y afficherait « 0 » sur toutes les fiches, ce qui n'informe de rien.
    showStats:       z.boolean().optional(),
    // Boutons « Contacter » / « Suivre » de la carte `profile`. Absent = affichés (24 usages du
    // parc inchangés). `false` sur un annuaire de LIEUX : on ne « suit » pas un cabinet, et
    // « Contacter » n'ouvre aujourd'hui qu'un toast « à venir ».
    showActions:     z.boolean().optional(),
    // Affiche la barre de progression de financement (cagnotte) sur la carte +
    // déclenche la query useFundingEnvelope. Découple la feature funding du style
    // de carte. Défaut : actif uniquement pour le variant "rezo-la-mer" (rétrocompat).
    showFunding:     z.boolean().optional(),
    /**
     * Carte `card-answer` : le bouton « Fiche structure ». DEUX axes orthogonaux, tous deux
     * optionnels — un site peut ne régler QUE la visibilité sans toucher à l'action.
     *
     * `kind` — CE QUE FAIT le bouton :
     *  - absent / `profil` (DÉFAUT côté code) — navigue vers `/profil/:slug`, historique ;
     *  - `preview` — ouvre la fiche EN MODALE (même `preview.type: "structure"` que les cartes de
     *    l'annuaire), sans quitter la liste. Sur une page où l'usager COMPARE des créneaux, la
     *    navigation lui fait perdre liste, filtres et position de défilement.
     *  Optionnel pour pouvoir poser `audience` SEUL : `CardAnswer` teste `=== "preview"`, donc
     *  clé absente = navigation — le schéma dit désormais la même chose que le code.
     *
     * `audience` — QUI VOIT le bouton :
     *  - absent / `all` (DÉFAUT côté code) — tout le monde, comportement historique ;
     *  - `managers` — les seuls gestionnaires du créneau : super-admin plateforme, admin du costum
     *    porteur, ou admin VALIDÉ de la structure organisatrice de CETTE carte
     *    (`isCoformAnswerManager`, le prédicat du bouton « Modifier » du détail). La fiche
     *    structure est un outil de gestion, elle n'informe pas qui cherche un créneau.
     *  Volontairement PAS nommé `adminOnly` : `addButton.adminOnly` désigne une règle STRICTEMENT
     *  plus étroite (admin du carrier costum seul) — même nom pour deux règles serait un piège.
     *  ⚠️ Pertinence d'AFFICHAGE, pas une sécurité : `/profil/:slug` et `/structure` restent
     *  publics et le slug de la structure part déjà dans le HTML servi à tout visiteur.
     *
     * Même forme que `MapConf.itemAction`, à dessein : un seul vocabulaire d'action dans le module.
     */
    structureAction: z.object({
      kind: z.enum(["profil", "preview"]).optional(),
      audience: z.enum(["all", "managers"]).optional(),
    }).optional(),
    detailsMode: z.enum(["drawer", "dialog"]).default("drawer"),
    detailedMode: z.enum(["default", "service-pricing"]).default("default"),
    // Coin haut-droit des cartes à image (`image-cover`) : par défaut les
    // badges génériques (serverData.badges / tags) ; "service-pricing" les
    // remplace par les pastilles de capacité (postes/personnes/couverts).
    overlayStats: z.enum(["service-pricing"]).optional(),
    // Ajustement de l'image des cartes `image-cover` : "cover" (défaut, remplit
    // la carte en rognant — idéal pour des photos plein cadre) ou "contain"
    // (logo entier visible, centré sur un FOND FLOUTÉ de la même image — idéal
    // pour des LOGOS d'aspect hétérogène qui, en cover, seraient rognés).
    imageFit: z.enum(["cover", "contain"]).optional(),
    // Chemins CoForm des données service-pricing (cartes `detailedMode` /
    // `overlayStats`). Surcharge PAR CATÉGORIE la table par défaut du code
    // (précédent : `preview.fields`) — découple les IDs de formulaires/champs.
    // `meeting.room` pointe une commonTable : ligne 0 = en-têtes, colonnes
    // [2..6] = capacité min, capacité max, prix horaire, demi-journée, journée.
    servicePricing: z.object({
      meeting: z.object({ id: z.string(), room: z.string() }).optional(),
      coworking: z.object({
        id: z.string(),
        place: z.string(),
        price: z.object({ hourly: z.string(), halfDay: z.string(), fullDay: z.string() }),
      }).optional(),
      accommodation: z.object({
        id: z.string(),
        place: z.string(),
        price: z.object({ bed: z.string(), room: z.string() }),
      }).optional(),
    }).optional(),
    /** Rend l'installation de la carte (`poi-amenities`) cliquable → filtre le
     *  listing. Absent = valeur affichée en texte simple. */
    installationFilter: InstallationFilterConfSchema.optional(),
    /** Carte DENSE : mêmes informations, moins de place (vignette et interlignes
     *  réduits, puces d'équipement resserrées). Pour une colonne étroite — liste
     *  latérale d'un split, grille à 4 colonnes. Honoré aujourd'hui par
     *  `poi-amenities` ; les autres variantes l'ignorent. */
    compact: z.boolean().optional(),
    /** Carte PLIABLE, repliée par défaut : une ligne titre + sous-titre, dépliée
     *  par un chevron. Une colonne latérale devient ainsi parcourable d'un coup
     *  d'œil — même lecture que la liste de la section `data-observatory` — sans
     *  renoncer au détail. Le clic sur la ligne ouvre la fiche comme d'habitude ;
     *  seul le chevron déplie. Honoré aujourd'hui par `poi-amenities`. */
    collapsible: z.boolean().optional(),
    // Valeurs DESIGN/FONCTIONNALITÉ (jamais de nom de site). `Preview`/détail =
    // axe séparé (`preview.type`/`detailsMode`).
    type: z.enum(["overlay", "default", "image-cover", "event", "funding", "profile", "event-featured", "resource-booking", "poi-amenities", "image-panel", "contact-card", "card-answer", "news", "testimonial", "resource", "resource-directory"]).default("default"),
    variant: z.enum(["default", "image-cover", "event", "funding", "profile", "event-featured", "resource-booking", "poi-amenities", "image-panel", "contact-card", "card-answer"]).optional(),
}).partial();
export type CardConf = z.infer<typeof CardConfSchema>;

/**
 * Action au clic sur une carte de liste.
 *  - `preview` (défaut) — ouvre le détail (`SwitchDetailsMode`) : comportement historique ;
 *  - `profil`  — navigue vers `/profil/:slug` ;
 *  - `link`    — navigue vers un gabarit d'URL (ex. un POI `type:"article"` doit mener au reader
 *    blog `/blog/:slug`, pas ouvrir un drawer).
 */
export const ListItemActionSchema = z.object({
  kind: z.enum(["preview", "profil", "link"]).default("preview"),
  /** `link` : gabarit d'URL, `:slug` substitué. Ex. `/blog/:slug`. */
  to: z.string().optional(),
  /** `link` : gabarit de repli quand l'item n'a pas de slug, `:id` substitué. Ex. `/blog/id/:id`. */
  toById: z.string().optional(),
  /** Ouvre dans un nouvel onglet (liens externes). */
  newTab: z.boolean().optional(),
});
export type ListItemAction = z.infer<typeof ListItemActionSchema>;

/**
 * Règle de rendu PAR ITEM d'une liste HÉTÉROGÈNE (recherche globale sans filtre : articles, paroles,
 * ressources, événements, projets et structures mélangés). Le choix du presenter ne peut alors pas
 * venir du filtre coché — il se décide sur la donnée de chaque item.
 *
 * `when` est évalué (grammaire `PredicateJson` du formEngine) contre
 * `{...serverData, collection, sourceKey, sourceKeys}`, chemins pointés résolus — cf.
 * `entityMatchData` (`src/lib/entityMatch.ts`). PREMIÈRE règle qui matche gagne ; une règle SANS
 * `when` est un catch-all, **à placer en dernier**. Aucune règle ne matche → `list` de base.
 *
 * Une règle porte SA tranche complète (carte + preview + contrat de presenter + action) : carte et
 * détail sont cohérents PAR CONSTRUCTION, puisqu'ils sortent de la même résolution.
 *
 * ⚠ `serverData.type` a DEUX sémantiques — sous-type POI (`article`/`affiche`/`recoveryCenter`) et
 * sous-type d'organisation (`NGO`/`Group`/…). Toujours ancrer sur `collection` AVANT `type`.
 * ⚠ Les champs testés doivent être PROJETÉS (`baseParams.defaultFields`), sinon la règle ne matchera
 * jamais, en silence.
 */
export const ListItemRuleSchema = z.object({
  /** Identifiant lisible (debug / tests / warning DEV). Non fonctionnel. */
  id: z.string().optional(),
  when: PredicateJson.optional(),
  /** Surcharges FUSIONNÉES (shallow) sur `list.card` — `tagColors`/`detailsMode`… restent hérités. */
  card: CardConfSchema.optional(),
  /** Surcharges FUSIONNÉES (shallow) sur `list.preview` — `width`/`showDetailLink`… restent hérités. */
  preview: PreviewConfSchema.optional(),
  /** Contrat presenter — REMPLACE `list.testimonial` (un contrat de mapping est atomique). */
  testimonial: TestimonialConfSchema.optional(),
  /** Contrat presenter — REMPLACE `list.resource`. */
  resource: ResourceConfSchema.optional(),
  /** Action au clic — REMPLACE `list.itemAction`. */
  itemAction: ListItemActionSchema.optional(),
});
export type ListItemRule = z.infer<typeof ListItemRuleSchema>;

export const ListConfSchema = z.object({
  /**
   * Disposition de la liste. `"grid"` (défaut CÔTÉ CODE — la config n'est jamais parsée par
   * Zod au runtime, `SearchListView` retombe lui-même sur la grille quand la clé est absente)
   * ou `"timeline"` : frise verticale — ligne pointillée centrale, bulle-date (jour/mois/année)
   * posée sur la ligne, cartes alternées gauche/droite en desktop, colonne unique avec ligne à
   * gauche en mobile. Pensée pour des événements triés par `baseParams.defaultSortBy:
   * {"startDate": -1}`. Ignorée en vue détaillée (`isDetailedView`) et en mode split (`onFocusItem`).
   * `"grouped"` : la grille découpée en blocs titrés par la valeur de `groupBy.field` (une année,
   * un territoire…) — pour une archive qui se parcourt par période plutôt que d'un seul tenant.
   */
  layout: z.enum(["grid", "timeline", "grouped"]).optional(),
  /**
   * Regroupement de `layout: "grouped"`. `field` : chemin pointé dans `serverData`. `order` : ordre
   * des GROUPES (défaut `asc`). Les items d'un groupe gardent l'ordre du serveur, sauf `itemsSortBy`
   * — nécessaire dès que cet ordre tient à une 2e clé : le backend ne lit que la PREMIÈRE clé de
   * `baseParams.defaultSortBy`. `itemsSortBy` ne trie que les résultats chargés. Les fiches sans
   * valeur forment un dernier bloc, libellé `emptyLabel`, plutôt que d'être écartées en silence.
   */
  groupBy: z.object({
    field: z.string(),
    order: z.enum(["asc", "desc"]).optional(),
    itemsSortBy: z.object({
      field: z.string(),
      order: z.enum(["asc", "desc"]).optional(),
    }).optional(),
    emptyLabel: LocalizedString.optional(),
  }).optional(),
  columns: z.object({
    lg: z.number().int().min(1).max(6).optional(),
    md: z.number().int().min(1).max(6).optional(),
    sm: z.number().int().min(1).max(6).optional(),
    xl: z.number().int().min(1).max(6).optional(),
  }).partial().optional(),
  card: CardConfSchema.optional(),
  preview: PreviewConfSchema.optional(),
  /** Contrat « testimonial » (générique, config-driven) — lu par Card/PreviewTestimonial via `useTestimonialData`. */
  testimonial: TestimonialConfSchema.optional(),
  /** Contrat « resource » (générique, config-driven) — lu par Card/PreviewResource via `useResourceData`. */
  resource: ResourceConfSchema.optional(),
  /** Contrat « resource-directory » — rempli par la section `coform-resource-directory`. */
  resourceDirectory: ResourceDirectoryConfSchema.optional(),
  /**
   * Nom du paramètre URL pour synchroniser l'item en preview. Défaut : "preview".
   * Utile pour plusieurs sections sur une même page (ex. "preview-equipements").
   */
  previewParam: z.string().optional(),
  /**
   * Charge l'item visé par `previewParam` PAR IDENTIFIANT quand il n'est pas
   * dans la page de résultats déjà chargée (10 items par défaut) — la valeur dit
   * QUELLE collection interroger. Absent = comportement historique : le param
   * n'ouvre que ce que la liste porte déjà.
   *
   * Indispensable à tout lien venu d'une AUTRE page (fiche équipement → fiche du
   * club usager, et retour), et accessoirement aux liens « Partager » d'une
   * fiche profonde dans la pagination.
   */
  previewFetch: z.enum(["poi", "organizations", "projects", "events", "citoyens"]).optional(),
  /**
   * Règles de rendu PAR ITEM (cf. {@link ListItemRuleSchema}) — pour les listes hétérogènes.
   * ABSENT = comportement mono-carte historique (`card`/`preview` valent pour toute la liste).
   */
  itemRules: z.array(ListItemRuleSchema).optional(),
  /** Action au clic par DÉFAUT de la liste, surchargeable par règle. Absent = ouvrir le détail. */
  itemAction: ListItemActionSchema.optional(),
  /**
   * Libellé additionnel PAR ITEM (map id → texte), affiché en petit badge sur la carte quand
   * présent — id = `getEntryId(item)` (id racine prioritaire, même formule que le param preview).
   * Générique et rétrocompatible : absent partout ailleurs, donc sans effet sur les autres
   * consommateurs de `CardDefault`/`CardEvent`. Cas d'usage : un digest multi-entités (« Mes lieux »)
   * où chaque item vient d'un lieu membre différent — le lieu lié n'est pas un champ de l'item lui
   * même, il se calcule côté appelant (croisement `links.*` × la liste de lieux connus).
   */
  linkedLabels: z.record(z.string(), z.string()).optional(),
}).partial();

export type ListConf = z.infer<typeof ListConfSchema>;


/**
 * Apparence d'un marqueur de la carte — chaîne de repli (par PRIORITÉ) :
 *   1. `useItemImage` ET l'item a une image → vignette RONDE de l'item ;
 *   2. `colorBy` ET une valeur mappée       → pin/pastille coloré PAR VALEUR ;
 *   3. `iconUrl`                            → icône custom (image/SVG, ex. pin brandé) ;
 *   4. `style: "pin"`/`"circle"` ou `icon`  → pin/pastille aux couleurs du thème,
 *      avec le pictogramme lucide d'`icon` en son centre s'il est déclaré ;
 *   5. sinon                                → pin par défaut (primary).
 * Schéma PARTAGÉ : configurable PAR SITE (`integrations.map.marker`, cf.
 * site-schema) et surchargeable PAR SECTION (`map.marker`) — les champs de la
 * section l'emportent sur ceux du site, sinon repli sur le défaut.
 * Ce bloc ne porte QUE l'apparence : le choix du marqueur par valeur de donnée
 * vit dans `by` (cf. `MarkerByConfSchema`), résolu AVANT cette chaîne.
 */
export const MarkerVisualConfSchema = z.object({
  /** Vignette ronde = image de l'item (si présente), sinon repli (icône/pin). */
  useItemImage: z.boolean().optional(),
  style: z.enum(["default", "pin", "circle"]).optional(),
  /** Couleur du pin en JETON de thème (jamais d'hex — suit light/dark). */
  color: z.enum(["primary", "secondary", "accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]).optional(),
  /** Couleur du contour + de la pastille du pin, en JETON de thème (déf.
   *  `background` — contraste lisible sur tout fond). Même palette que `color`. */
  borderColor: z.enum(["background", "primary", "secondary", "accent", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]).optional(),
  /** Pictogramme LUCIDE (kebab-case, ex. `waves`) au centre de la goutte ou de
   *  la pastille — le marqueur reste aux couleurs du THÈME, aucun asset requis
   *  (à la différence de `iconUrl`, image brandée servie par le backend).
   *  Implique le pin quand `style` est absent ; nom hors catalogue → glyphe
   *  absent, la forme reste (audit `icone-inconnue`). */
  icon: z.string().optional(),
  /** URL d'une icône custom (relative → préfixée par baseUrl, ou absolue http). */
  iconUrl: z.string().optional(),
  /** Taille du marqueur en px — s'applique à TOUTES les formes : vignette
   *  (`useItemImage`, déf. 36), pastille (`style: "circle"`, déf. 30), goutte
   *  (`style: "pin"`, `icon` ou défaut, déf. 34) et icône custom (`iconUrl`,
   *  déf. 34). Les pictogrammes lucide sont mis à l'échelle avec la forme.
   *  `z.coerce` : les configs écrivent souvent `"45"` — sans coercition la
   *  valeur était rejetée à la validation et, en cas d'oubli, atterrissait telle
   *  quelle dans un style inline (`width: 45` sans unité = marqueur invisible). */
  iconSize: z.coerce.number().int().min(8).max(128).optional(),
  /** Ancrage de l'icône custom : "bottom" (pointe sur le point, déf.) ou "center". */
  iconAnchor: z.enum(["bottom", "center"]).optional(),
  /** Marqueur coloré PAR VALEUR de l'item (code couleur par territoire, CDC
   *  parents62) : prioritaire sur le jeton `color` quand une valeur matche le
   *  mapping, et implique le pin (ou la pastille si `style: "circle"`). */
  colorBy: ColorByConfSchema.optional(),
});

export type MarkerVisualConf = z.infer<typeof MarkerVisualConfSchema>;

/**
 * Marqueur choisi PAR VALEUR d'un attribut de l'item (famille d'équipement,
 * type de POI…) : `path` est un dot-path `serverData` (valeur string/nombre/
 * booléen, ou TABLEAU — la première valeur listée dans `mapping` gagne, l'ordre
 * de l'item fait foi). Chaque cas de `mapping` est un marqueur PARTIEL fusionné
 * sur le marqueur de base ; `default` couvre les valeurs NON listées (sans lui,
 * c'est le marqueur de base qui sert de défaut).
 *
 * ⚠ Un cas qui déclare un SÉLECTEUR de rendu (`useItemImage`, `colorBy`, `icon`,
 * `iconUrl` ou `style`) remplace TOUS les sélecteurs du marqueur de base — sans
 * cette règle, un `iconUrl` de base masquerait en silence le `style: "pin"` d'un
 * cas (l'icône gagne plus haut dans la chaîne) ; un cas qui change de forme
 * redéclare donc son `icon`. Il n'hérite alors que de
 * `color`/`borderColor`/`iconSize`/`iconAnchor`.
 *
 * ⚠ `path` DOIT être projeté par `baseParams.defaultFields` : absent de la
 * projection il vaut `undefined`, aucun cas ne matche et tous les marqueurs
 * tombent sur le défaut (même piège silencieux que `list.itemRules`).
 */
export const MarkerByConfSchema = z.object({
  path: z.string(),
  mapping: z.record(z.string(), MarkerVisualConfSchema),
  default: MarkerVisualConfSchema.optional(),
});

export type MarkerByConf = z.infer<typeof MarkerByConfSchema>;

export const MarkerConfSchema = MarkerVisualConfSchema.extend({
  /** Marqueur PAR VALEUR d'un attribut de la donnée — cf. `MarkerByConfSchema`.
   *  Résolu AVANT la chaîne de repli : il choisit le marqueur, la chaîne le rend. */
  by: MarkerByConfSchema.optional(),
});

export type MarkerConf = z.infer<typeof MarkerConfSchema>;

export const MapConfSchema = z.object({
  initialZoom: z.number().min(1).max(20).optional(),
  cluster:     z.boolean().optional(),
  /** Disposition de la vue carte (SearchProStatic) : "full" (défaut, plein
   *  écran) ou "split" (liste + carte côte à côte, sélection synchronisée). */
  layout: z.enum(["full", "split"]).optional(),
  /** En mode split, répartition de largeur liste/carte : "30-70" (liste
   *  resserrée), "40-60" (défaut — liste étroite 1 colonne + carte large,
   *  aligné sur l'agenda), "50-50" ou "60-40" (liste plus large, 2 colonnes).
   *  Pilote aussi les colonnes de la liste. */
  splitRatio: z.enum(["30-70", "40-60", "50-50", "60-40"]).optional(),
  popup: z.object({
    type: z.enum(["default"]).default("default"),
  }).partial().optional(),
  /** Action du bouton de la popup : détail du module search (défaut
   *  `preview` — `SwitchDetailsMode` avec `list.card`/`list.preview`) ou
   *  navigation `/profil/:slug` (pattern rowAction observatoire / palette). */
  itemAction: z.object({ kind: z.enum(["profil", "preview"]) }).optional(),
  /** Apparence des marqueurs — cf. `MarkerConfSchema` (surcharge le site). */
  marker: MarkerConfSchema.optional(),
  /** Couches de CONTOURS géographiques superposées aux marqueurs (bassins de vie, communes,
   *  quartiers…) — cf. `GeoShapeSourceSchema`. Plusieurs couches = autant d'appels (le legacy
   *  ANDe ses filtres, il n'a pas de OR), fusionnés et dédoublonnés par id de document. Chaque
   *  couche porte SA politique de chargement (`load`), la volumétrie allant de 57 Ko à 9,4 Mo. */
  shapes: z.array(GeoShapeSourceSchema).optional(),
}).partial();

export type MapConf = z.infer<typeof MapConfSchema>;

export const SearchTypeSchema = z.enum([
  "NGO",
  "LocalBusiness",
  "Group",
  "GovernmentOrganization",
  "Cooperative",
  "organizations",
  "projects",
  "events",
  "citoyens",
  "poi",
  "answers",
  "news",
  "proposals",
]);

export type SearchType = z.infer<typeof SearchTypeSchema>;

/** Cible de recherche portée par une option de groupe `searchTargets` (filtre
 *  « type d'info ») : REMPLACE les `defaultTypes` de la section et FUSIONNE ses
 *  `defaultFilters` (ex. Paroles = `{ defaultTypes: ["poi"], defaultFilters:
 *  { type: "affiche" } }`). Étendre le moteur en P2/P3 (actualités, ressources)
 *  = ajouter des options en config, sans code. */
export const SearchTargetSchema = z.object({
  defaultTypes: z.array(SearchTypeSchema).optional(),
  defaultFilters: z.record(z.string(), z.unknown()).optional(),
});
export type SearchTarget = z.infer<typeof SearchTargetSchema>;

/**
 * Variant du endpoint backend pour `searchCostum` (cf. SDK v1.0.132).
 * - `default` (ou absent) → `/co2/search/globalautocomplete` (comportement historique)
 * - `navigator-tl` → `/costum/navigator/gettl` (payload enrichi avec auto-link Answer)
 * - `navigator-tl-ressource` → `/costum/navigator/getsressourcetl` (annuaire À PLAT des
 *   ressources d'un tiers-lieu — `searchType: ["answers"]` : drop-in de `globalautocomplete`
 *   + post-traitement serveur — tiers-lieu porteur résolu via l'input `finder`, adresse/geo/image
 *   remontées, filtre `filters["address.level1"]`, `documents` attachés. Consommé par
 *   `coform-resource-directory`.)
 * - `admin` → `/co2/search/globalautocompleteadmin/…` (SDK ≥ 1.0.161 : réservé aux admins de
 *   l'hôte costum ; `fields` = projection EXACTE, `preferences` renvoyé → badge/filtre
 *   `toBeValidated` des tables d'administration ; tri serveur via `sort`)
 */
export const SearchVariantSchema = z.enum(["default", "navigator-tl", "navigator-tl-ressource", "admin"]);
export type SearchVariant = z.infer<typeof SearchVariantSchema>;

/**
 * Champs sur lesquels le backend effectue la recherche texte (`searchCostum.name`).
 * 3 formes acceptées par le SDK v1.0.132+ :
 * - `"ALL"` — mot-clé spécial, tous les champs par défaut côté backend
 * - `"name,slug,tags"` — CSV de noms de champs
 * - `["name", "address.addressLocality"]` — array de paths (supporte les paths imbriqués)
 * Le fix paginator du SDK v1.0.132 rend la pagination cohérente entre les 3 formes.
 */
export const SearchBySchema = z.union([z.string(), z.array(z.string())]);
export type SearchBy = z.infer<typeof SearchBySchema>;

/**
 * Paramètres de recherche backend (searchCostum). Partagé entre les sections
 * search (searchPro / searchProStatic) et les groupes de filtre dynamiques
 * (`entityList`) qui peuplent leurs options via une recherche d'entités.
 */
export const SearchBaseParamsSchema = z.object({
  fediverse:     z.boolean().optional(),
  indexStepList: z.number().optional(),
  indexStepMap:  z.number().optional(),
  defaultTypes: z.array(SearchTypeSchema).optional(),
  defaultTags:   z.array(z.string()).optional(),
  defaultFilters: z.record(z.string(), z.unknown()).optional(),
  defaultFields: z.array(z.string()).optional(),
  defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
  // Champs sur lesquels le texte de recherche est matché (cf. SearchBySchema).
  searchBy: SearchBySchema.optional(),
  /**
   * SOUS-TYPE de costum ciblé (clé `subType` d'un form de `costumForms`). EXPANSÉE par le client
   * (`buildSearchPayload`) en la disjonction canonique :
   *   `$or [ { …identity du form, "source.keys": <slug du site> },      // les NATIFS
   *          { "reference.costumTypes.<slug>": <subType> } ]`           // les RÉFÉRENCÉS classés
   * Le discriminant (`identity`) vit UNE fois, dans la déclaration du form — pas dupliqué ici, et le
   * slug vient du scope du site, pas de la config. Écrire le `$or` à la main dans `defaultFilters`
   * reste possible ; cette clé est le chemin recommandé.
   */
  costumSubType: z.string().optional(),
  // Accepte `boolean` (ne pas sourcer par clé) ou `number` (limite custom).
  // Certaines configs historiques utilisent un nombre — schéma assoupli pour compat.
  notSourceKey: z.union([z.boolean(), z.number()]).optional(),
  locality: z.record(z.string(), z.object({
    id: z.string(),
    type: z.string(),
    name: z.string().optional(),
    countryCode: z.string().optional(),
    level: z.union([z.string(), z.number()]).optional(),
    active: z.boolean().optional(),
    key: z.string().optional(),
  })).optional(),
  contextId: z.string().optional(),
  contextType: z.enum(["projects", "organizations"]).optional(),
  costumSlug: z.string().optional(),
  costumEditMode: z.union([z.boolean(), z.string(), z.number()]).optional(),
  sourceKey: z.array(z.string()).optional(),
});
export type SearchBaseParams = z.infer<typeof SearchBaseParamsSchema>;

export const SEARCH_TYPE_ICON_NAMES: Record<SearchType, IconName> = {
  NGO: "hand-heart",
  LocalBusiness: "store",
  Group: "users",
  GovernmentOrganization: "land-plot",
  Cooperative: "handshake",
  organizations: "building-2",
  projects: "layout-dashboard",
  events: "calendar-days",
  citoyens: "user",
  poi: "map-pin",
  answers: "file-text",
  news: "newspaper",
  proposals: "lightbulb",
};

export const SearchProSectionSchema = z.object({
  type: z.literal("searchPro"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString,
    useFilter:   z.boolean().default(true),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    defaultViewMode: z.enum(["list", "map", "graph"]).optional(),
    showActiveFiltersTypes: z.boolean().default(true),
    showActiveFiltersTags: z.boolean().default(true),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    /**
     * Variant SDK pour `searchCostum`. Absent ou `"default"` → endpoint
     * historique `globalautocomplete`. `"navigator-tl"` → endpoint enrichi
     * `costum/navigator/gettl` (auto-link Answer dans `serverData.answers`).
     * Le backend du site doit supporter le variant choisi.
     */
    searchVariant: SearchVariantSchema.optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      linkIcon: IconNameSchema.optional(),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      indexStepMap:  z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      defaultFields: z.array(z.string()).optional(),
      defaultSortBy: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),
      // Champs sur lesquels le texte de recherche est matché (cf. SearchBySchema).
      searchBy: SearchBySchema.optional(),
      // Accepte `boolean` (ne pas sourcer par clé) ou `number` (limite custom).
      // Certaines configs historiques utilisent un nombre — schéma assoupli pour compat.
      notSourceKey: z.union([z.boolean(), z.number()]).optional(),
      locality: z.record(z.string(), z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        countryCode: z.string().optional(),
        level: z.union([z.string(), z.number()]).optional(),
        active: z.boolean().optional(),
        key: z.string().optional(),
      })).optional(),
    }).optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
  }),
});

export type SearchProSection = z.infer<typeof SearchProSectionSchema>;
export type SearchProSectionProps = z.infer<typeof SearchProSectionSchema>["props"]

const AddButtonConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  modal: z.string().optional(),
  formConfig: z.any().optional(),
  // Cible CoForm : le bouton ouvre la CRÉATION d'une answer de ce form
  // (CoFormModal) au lieu d'une modale d'entité — ex. « Ajouter un créneau »
  // (1 créneau = 1 answer). Prioritaire sur modal/organization/project/poi.
  coform: z.string().optional(),
  // `false` → le bouton s'affiche dès que `show: true`, sans exiger le rôle
  // admin du site (un non-connecté qui clique passe par le login). Cas d'usage :
  // déclaration publique d'answer CoForm modérée en aval (filtre `state`).
  // Défaut `true` = comportement historique (bouton réservé aux admins).
  adminOnly: z.boolean().optional().default(true),
  organization: z.boolean().optional().default(true),
  project: z.boolean().optional().default(true),
  event: z.boolean().optional().default(true),
  poi: z.boolean().optional().default(true),
}).optional();

export type AddButtonConfig = z.infer<typeof AddButtonConfigSchema>;

const ZoneSelectorConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  placeholder: LocalizedString.optional(),
  countryCode: z.array(z.string()).optional().default(["RE"]),
  level: z.array(z.union([z.number(), z.string()])).optional().default([1]),
  sortBy: z.string().optional().default("name"),
  costumSlug: z.string().optional(),
  costumEditMode: z.union([z.boolean(), z.string(), z.number()]).optional().default(false),
  costumId: z.string().optional(),
  costumType: z.string().optional(),
}).optional();

export type ZoneSelectorConfig = z.infer<typeof ZoneSelectorConfigSchema>;

const CsvColumnSchema = z.object({
  header: z.string(),
  path: z.string(),
});

const CsvButtonConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  separator: z.string().default(";"),
  filename: z.string().optional(),
  columns: z.array(CsvColumnSchema).optional(),
}).optional();

export type CsvButtonConfig = z.infer<typeof CsvButtonConfigSchema>;

const TagSelectorConfigSchema = z.object({
  show: z.boolean().default(false),
  label: LocalizedString.optional(),
  placeholder: LocalizedString.optional(),
  options: z.record(z.string(), LocalizedString.or(z.string())),
}).optional();

export type TagSelectorConfig = z.infer<typeof TagSelectorConfigSchema>;

// SearchProStatic: Version sans synchronisation URL pour affichage multiple par page
export const SearchProStaticSectionSchema = z.object({
  type: z.literal("searchProStatic"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    icon: z.string().optional(),
    description: LocalizedString.optional(),
    placeholder: LocalizedString.optional(),
    showSearch:  z.boolean().default(false),
    useFilter:   z.boolean().default(false),
    showMap:     z.boolean().default(false),
    enableMap: z.boolean().default(true),
    enableRegions: z.boolean().default(false),
    // Cible de navigation quand on clique sur la carte regions : on redirige
    // vers `path` avec `filterId=<slugs>` en query (le groupe entityList
    // correspondant dans la page cible pré-coche le filtre). Ex. cliquer un
    // réseau régional → /lieux?reseauxRegionaux=<slug>.
    regionsTarget: z.object({
      path: z.string(),
      filterId: z.string(),
    }).optional(),
    // Vue "thematics" : grille de cards (nom + image) des valeurs d'un filtre
    // thématique CoForm (`coformFilterByPath`). S'active via
    // `defaultViewMode: "thematics"` + `thematicSource` (page dédiée, sans toggle).
    // Source de l'appel coformFilterByPath (même forme qu'une entrée
    // `filtersByPath` de la section `filters`).
    thematicSource: z.object({
      id: z.string().optional(),
      label: LocalizedString,
      thematicPath: z.string(),
      finderPath: z.string().optional(),
      notSourceKey: z.boolean().optional(),
    }).optional(),
    // Cible de navigation au clic sur une card thématique : `path` avec
    // `filterId=<name>` en query → la page cible pré-active le filtre. Ex.
    // cliquer un réseau thématique → /lieux?reseauxThematiques=<name>.
    thematicsTarget: z.object({
      path: z.string(),
      filterId: z.string(),
    }).optional(),
    enableGraph: z.boolean().default(false),
    graphTags: z.array(z.string()).optional(),
    graphCategories: z.array(z.string()).optional(),
    graphDefaultGroupMode: z.enum(["country", "category"]).optional(),
    graphEnableCountryGrouping: z.boolean().optional(),
    graphDetailsMode: z.enum(["drawer", "dialog", "link"]).default("drawer"),
    defaultViewMode: z.enum(["list", "map", "graph", "regions", "thematics", "split"]).optional(),
    showActiveFiltersTypes: z.boolean().default(false),
    showActiveFiltersTags: z.boolean().default(false),
    disableInfiniteScroll: z.boolean().optional(),
    showDetailedViewToggle: z.boolean().optional(),
    width: z.enum(["container"]).optional(),
    defaultDetailedView: z.boolean().optional(),
    /**
     * Variant SDK pour `searchCostum`. Cf. note sur `SearchProSectionSchema`.
     */
    searchVariant: SearchVariantSchema.optional(),
    addButton: AddButtonConfigSchema,
    zoneSelector: ZoneSelectorConfigSchema,
    tagSelector: TagSelectorConfigSchema,
    csvButton: CsvButtonConfigSchema,
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
      linkIcon: IconNameSchema.optional(),
    }).optional(),

    filters: z.record(z.string(), TagsFilterSchema).optional(),

    baseParams: SearchBaseParamsSchema.optional(),

    list: ListConfSchema.optional(),
    map:  MapConfSchema.optional(),
    /**
     * Tableau de bord (KPI + graphes) affiché DANS la section, en troisième vue
     * à côté de la liste et de la carte — sa présence suffit à faire
     * apparaître le bouton de bascule.
     *
     * Il n'a pas de périmètre à lui : il lit les résultats déjà chargés par la
     * section, donc les mêmes que la carte, et suit la recherche et les filtres
     * courants. Les champs consommés par ses dimensions doivent donc figurer
     * dans `baseParams.defaultFields` — un champ non projeté ne se compte pas.
     * Pour une page dont le tableau de bord EST le sujet (filtres propres,
     * table, export), c'est la section `data-observatory` qu'il faut.
     */
    observatory: ObservatoryPanelConfSchema.optional(),
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent", "page-accent"]).optional(),
  }),
});

export type SearchProStaticSection = z.infer<typeof SearchProStaticSectionSchema>;
export type SearchProStaticSectionProps = z.infer<typeof SearchProStaticSectionSchema>["props"]

/**
 * Un type de ressource de l'annuaire `coform-resource-directory` : une option de
 * la facette gauche ET un formulaire CoForm. Les 3 formulaires du Navigator des
 * Tiers-Lieux (coworking / salle de réunion / hébergement) sont des copies l'un
 * de l'autre : `stepPrefix` distinct, suffixes d'input communs.
 */
const ResourceTypeConfSchema = z.object({
  /** Slug stable — id de l'option de facette (ex. `"coworking"`). */
  id: z.string(),
  /** Catégorie service-pricing : pilote la capacité/tarif affichés (cf. `helpers/servicePricingAnswers`). */
  kind: z.enum(["coworking", "meeting", "accommodation"]),
  /** `_id` du formulaire CoForm. */
  formId: z.string(),
  /** Clé d'étape de la réponse, ex. `navigatorDesTierslieux25112025_209_0`. */
  stepPrefix: z.string(),
  /** Libellé affiché (badge de carte + option de facette). */
  label: LocalizedString,
  /** Suffixe de l'input URL de réservation, PROPRE au formulaire (`linkPath` de `getNavigatorElement.suplment`). */
  linkSuffix: z.string().optional(),
  /** Suffixe de l'input « À propos », PROPRE au formulaire (meeting `miolbscdcrucb5a8uuq`, hébergement `miq88plgleoln5tmc7b`). */
  descriptionSuffix: z.string().optional(),
  /** Suffixe de l'input « Services proposés » (`string[]`), PROPRE au formulaire (hébergement `miq86g5vaw1kavrapkb`). */
  servicesSuffix: z.string().optional(),
});

/**
 * Annuaire À PLAT des ressources d'un tiers-lieu (coworking / salle de réunion /
 * hébergement) : une carte par réponse CoForm. Portage config-agnostique de
 * `Navigator::getRessourceTL` (costum `franceTierslieux`) — cet endpoint n'étant
 * qu'un `globalAutoComplete` (variant SDK `default`) + un post-traitement
 * (résolution du tiers-lieu porteur via l'input « finder », remontée de son
 * adresse, filtre région), reproduit ICI côté client : aucun endpoint ni SDK
 * nouveau. Divergence assumée avec `searchProStatic` (règle 9 des bonnes
 * pratiques) : liste d'`answers` + jointure sur le lieu porteur + garde région,
 * pour quoi `searchProStatic` n'offre aucun point d'accroche.
 */
export const CoformResourceDirectorySectionSchema = z.object({
  type: z.literal("coform-resource-directory"),
  id: z.string().optional(),
  props: z.object({
    title: LocalizedString.optional(),
    description: LocalizedString.optional(),
    customHeader: z.object({
      title: LocalizedString.optional(),
      linkText: LocalizedString.optional(),
      linkHref: z.string().optional(),
    }).optional(),
    /** Slug du costum porteur (périmètre de recherche). */
    costumSlug: z.string().optional(),
    /** Entité contexte (hôte du costum) — `contextId`/`contextType` du payload legacy. */
    contextId: z.string().optional(),
    contextType: z.string().optional(),
    /** Les types de ressources listés (≥ 1). Chaque entrée = une option de facette + un formulaire. */
    resourceTypes: z.array(ResourceTypeConfSchema).min(1),
    /** Suffixe de l'input « finder » (tiers-lieu porteur), commun aux formulaires. Ex. `miem3epsztzcm9dgim`. */
    finderSuffix: z.string(),
    /** Suffixes d'inputs COMMUNS aux formulaires copie (nom, équipements, surface, URL de réservation si partagée). */
    fieldSuffixes: z.object({
      /** Input du NOM de la ressource. Ex. `mieg4k7yxrito5j9e6` (`namePath` de `suplment`). Repli code : « Coworking » / « Hébergement » / « N salles de réunion ». */
      name: z.string().optional(),
      /** Input liste d'équipements. Ex. `mieg8j24m89gm99t5mi` (`extraPath`). */
      equipments: z.string().optional(),
      /** Input SURFACE (`areaPath` de `suplment`). Ex. `mieg4k7zslc8awrql2`. Détail uniquement. */
      area: z.string().optional(),
      /** URL de réservation si le suffixe est commun aux formulaires (sinon `resourceTypes[].linkSuffix`). */
      bookingUrl: z.string().optional(),
    }).optional(),
    /**
     * Garde géographique : ne conserve que les ressources dont le tiers-lieu
     * porteur est dans cette zone (`address.level1`). Reproduit
     * `filters[address.level1]` du legacy — appliqué CÔTÉ CLIENT après
     * résolution des lieux porteurs (l'`answer` ne porte pas d'adresse fiable).
     */
    scope: z.object({ addressLevel1: z.string() }).optional(),
    /** Colonnes de la grille de résultats. */
    columns: z.object({
      sm: z.number().int().min(1).max(6).optional(),
      md: z.number().int().min(1).max(6).optional(),
      lg: z.number().int().min(1).max(6).optional(),
      xl: z.number().int().min(1).max(6).optional(),
    }).optional(),
    /** Nombre maximal de cartes affichées. */
    limit: z.number().int().min(1).optional(),
    /** Masque les facettes et désactive le filtre par lieu porteur. Défaut : true. */
    showFilters: z.boolean().optional(),
    /** Titre de la colonne de filtres (défaut i18n « Filtres »). */
    filtersTitle: LocalizedString.optional(),
    /* Les facettes prix sont figées (3 groupes heure / demi-journée / journée,
       calqués sur Communecter — cf. `PRICE_FILTER_GROUPS`), pas de prop. */
    bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent"]).optional(),
  }),
});

export type CoformResourceDirectorySection = z.infer<typeof CoformResourceDirectorySectionSchema>;
export type CoformResourceDirectorySectionProps = z.infer<typeof CoformResourceDirectorySectionSchema>["props"];

// CardCountCT: Section dédiée à l'affichage des compteurs par type
const CardCountCTCardConfigSchema = z.object({
  countKey: z.string(),
  label: LocalizedString.or(z.string()),
  icon: z.string().optional(),
  color: z.string().optional(),
  href: z.string().optional(),
});

export const CardCountCTSectionSchema = z.object({
  type: z.literal("cardCountCT"),
  id:   z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    /**
     * Périmètre compté — c'est la clé qui décide si le chiffre DIT VRAI.
     *
     * La section élargit le `$or` des `defaultFilters` avec la localité et le
     * slug du costum courant. Sur un site TERRITORIAL c'est l'intention (« chez
     * moi OU de ma source »), mais sur un site scopé costum c'est un mensonge :
     * mesuré, le compteur d'institut-bleu passait de 49 à 530 organisations, et
     * celui de cyber-réunion de 693 à 2588 — l'union ramassant tout ce qui est
     * situé dans la commune du costum.
     *
     * `auto` (défaut) = comportement historique, aucune régression.
     * `config` = seuls les `baseParams` font foi : le chiffre concorde alors
     *            avec la liste que la page affiche à côté.
     * `costum` / `locality` = n'élargir que sur l'un des deux axes.
     */
    scope: z.enum(["auto", "config", "costum", "locality"]).optional(),
    // Accepte tokens sémantiques (énumérés) OU classe Tailwind brute (string libre,
    // ex. `bg-cyan-500`). Cette flexibilité permet aux sites costum d'utiliser
    // des couleurs spécifiques non listées comme tokens globaux.
    bg: z.union([
      z.enum([
        "default", "card", "muted", "primary", "secondary", "accent", "transparent",
        "gradient-teal", "gradient-blue", "gradient-indigo", "gradient-cyan",
      ]),
      z.string(),
    ]).optional(),

    baseParams: z.object({
      fediverse:     z.boolean().optional(),
      indexStepList: z.number().optional(),
      defaultTypes: z.array(SearchTypeSchema).optional(),
      defaultTags:   z.array(z.string()).optional(),
      defaultFilters: z.record(z.string(), z.unknown()).optional(),
      // Accepte `boolean` (ne pas sourcer par clé) ou `number` (limite custom).
      // Certaines configs historiques utilisent un nombre — schéma assoupli pour compat.
      notSourceKey: z.union([z.boolean(), z.number()]).optional(),
      locality: z.record(z.string(), z.object({
        id: z.string(),
        type: z.string(),
        name: z.string().optional(),
        countryCode: z.string().optional(),
        level: z.union([z.string(), z.number()]).optional(),
        active: z.boolean().optional(),
        key: z.string().optional(),
      })).optional(),
    }).optional(),

    cards: z.array(CardCountCTCardConfigSchema).optional(),
  }),
});

export type CardCountCTSection = z.infer<typeof CardCountCTSectionSchema>;
export type CardCountCTSectionProps = z.infer<typeof CardCountCTSectionSchema>["props"]

// Thematics Section - Icon mapping from FontAwesome to Lucide
/**
 * Mapping des icônes FontAwesome vers les icônes Lucide
 * Basé sur les filières disponibles
 */
export const FILIERE_ICON_MAPPING: Record<string, string> = {
  "fa-cutlery": "utensils",
  "fa-heart-o": "heart",
  "fa-chain": "link",
  "fa-link": "link",
  "fa-globe": "globe",
  "fa-bus": "bus",
  "fa-book": "book",
  "fa-user-circle-o": "circle-user",
  "fa-sun-o": "sun",
  "fa-universal-access": "accessibility",
  "fa-tree": "tree-pine",
  "fa-laptop": "laptop",
  "fa-futbol-o": "circle-dot",
  "fa-trash-o": "trash-2",
  "fa-android": "smartphone",
  "fa-leaf": "leaf",
  "fa-money": "banknote",
  "fa-arrows": "move",
  "fa-hand-o-up": "hand",
  "fa-flask": "flask-conical",
  "fa-lightbulb-o": "lightbulb",
  "fa-cross": "cross",
  "fa-gavel": "scale",
  "fa-anchor": "anchor"
};

// Thematics: Section pour afficher les filières de manière dynamique
export const ThematicsSectionSchema = z.object({
  type: z.literal("thematics"),
  id: z.string().optional(),

  props: z.object({
    title: LocalizedString.optional(),
    subtitle: LocalizedString.optional(),
    emptyMessage: LocalizedString.optional(),
  }),
});

export type ThematicsSection = z.infer<typeof ThematicsSectionSchema>;
export type ThematicsSectionProps = z.infer<typeof ThematicsSectionSchema>["props"]

//──────────────── Search Header (titre + filtres + boutons)
// Header de recherche horizontal (rendu par `sections/SearchHeaderSection`),
// producteur du PageFiltersContext au même titre que `<FiltersSection>`.
// Type config canonique `searchHeader`.
// `ActionButtonSchema` est un contrat partagé (rendu par `modules/profil`) →
// défini dans la feuille `@/types/action-button-schema` (cf. import ci-dessus).

const TitleWithFiltersDropdownOptionSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  value: z.string().optional(),
  field: z.string().optional(),
  icon: z.string().optional(),
});

const TitleWithFiltersDropdownSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  field: z.string().optional(),
  multiple: z.boolean().optional(),
  allLabel: LocalizedString.optional(),
  options: z.array(TitleWithFiltersDropdownOptionSchema).default([]),
  optionsFrom: OptionsFromSchema.optional(),
  /** Source STATIQUE : cf. `FilterGroupSchema.optionsKey` — même sémantique, même résolveur
   *  (`useDynamicFilterOptions`). */
  optionsKey: z.string().optional(),
  /** Le filtre continue de s'hydrater depuis l'URL et de filtrer le contenu, mais ne rend AUCUN
   *  contrôle visible (ni dans la barre desktop, ni dans la Sheet mobile, ni comme tag actif) — pour
   *  une page dont l'identité EST déjà ce filtre (ex. une page `/theme` où le thème vient du query
   *  param `?theme=…` posé par un menu externe) : afficher un sélecteur redondant avec le contexte
   *  de la page n'a pas de sens, contrairement à `public`/`territoire` qui restent des affinages. */
  hidden: z.boolean().optional(),
});

// Props partagées entre le type canonique `searchHeader` et son alias.
const SearchHeaderProps = z.object({
  /** Fond du bandeau. Défaut : le dégradé du thème (`--gradient-section`). `page-accent` = l'aplat de
   *  `page.accent` et son filet, pour un bandeau aux couleurs de la page (ex. filtres d'actualités
   *  d'une page de territoire parent62). */
  bg: z.enum(["default", "card", "muted", "primary", "secondary", "accent", "transparent", "page-accent"]).optional(),
  headline: LocalizedString.optional(),
  /** `id` d'un `dropdownFilters` dont la VALEUR SÉLECTIONNÉE remplace le `headline` (qui reste le repli
   *  quand rien n'est sélectionné). Pour une page dont l'identité EST ce filtre — `/theme?theme=…`,
   *  atteinte depuis le menu dynamique du header : « Nos thèmes » y perd l'information utile, DE QUEL
   *  thème on parle. Le filtre visé peut être `hidden`. Plusieurs valeurs sont jointes par « · ». */
  headlineFromFilter: z.string().optional(),
  subhead: LocalizedString.optional(),
  // Override de la classe couleur du titre `h1` (déf. `text-foreground`). Utile
  // quand le bandeau a un fond fixe sombre (ex. `bg-[image:var(--gradient-section)]`) où le token
  // `--foreground` (sombre en light) devient illisible : `text-white dark:text-foreground`.
  headlineClassName: z.string().optional(),
  // Override de la classe couleur du sous-titre (déf. `text-foreground`).
  // Remplace le hack par-slug historique : un site dont le subhead ne doit pas
  // forcer `text-foreground` met `subheadClassName: ""`.
  subheadClassName: z.string().optional(),
  // Override du conteneur flex de la rangée de filtres (recherche + dropdowns).
  // Déf. `flex flex-col lg:flex-row lg:items-center`. Permet d'éviter l'étalement
  // pleine largeur (ex. `flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:justify-center`).
  filtersClassName: z.string().optional(),
  types: z.array(
    z.object({
      id: z.string(),
      label: LocalizedString,
    })
  ).optional(),
  dropdownFilters: z.array(TitleWithFiltersDropdownSchema).optional(),
  buttons: z.array(ActionButtonSchema).optional(),
  showSearch: z.boolean().optional(),
  searchPlaceholder: LocalizedString.optional(),
  /** Padding vertical du bloc hero RÉDUIT (`py-4` au lieu de `py-12`). À activer quand le titre de la page
   *  vient d'une section `title` AU-DESSUS (le searchHeader n'est alors PAS le hero) — évite ~64px de vide.
   *  Défaut `false` : padding hero plein (un searchHeader nu qui EST le hero garde son air). */
  compact: z.boolean().optional(),
  /** Rangée de chips de filtres actifs (supprimables) sous la barre.
   *  `true`/absent = partout · `"desktop"` = uniquement ≥ lg · `"mobile"` =
   *  uniquement < lg · `false` = masquée. */
  showActiveFiltersTags: z.union([z.boolean(), z.enum(["mobile", "desktop"])]).optional(),
});

export const SearchHeaderSectionSchema = z.object({
  type: z.literal("searchHeader"),
  id: z.string().optional(),
  props: SearchHeaderProps,
});

export type SearchHeaderSection = z.infer<typeof SearchHeaderSectionSchema>;
export type SearchHeaderSectionProps = z.infer<typeof SearchHeaderSectionSchema>["props"];

/**
 * Carrousel plein écran d'entités (typiquement des POI) filtrées par tag — une diapositive à la
 * fois : badge, titre, description, CTA et image. Réutilise `SearchBaseParamsSchema` (fetch/filtre,
 * `defaultTags` porte le tag ex. "A la une"), `ResourceConfSchema` (mapping titre/description/image,
 * défauts déjà adaptés à un POI) et `ListItemActionSchema` (résolution du lien du CTA) — aucun champ
 * dupliqué. Générique par construction (`defaultTypes` n'est pas limité à "poi") : pas de `list`/
 * `columns` (pas une grille) ni de filtres UI (le tag est statique, porté par la config).
 */
export const FeaturedCarouselSectionSchema = z.object({
  type: z.literal("featured-carousel"),
  id: z.string().optional(),
  props: z.object({
    /** Badge affiché au-dessus du titre de chaque diapositive, ex. "À la une :". */
    badgeLabel: LocalizedString.optional(),
    /** Icône (registre lucide, kebab-case) posée avant le texte du badge — ex. "megaphone". Absente,
     *  le badge reste texte seul (comportement historique). */
    badgeIcon: z.string().optional(),
    /** Couleur de l'icône du badge (CSS) — INDÉPENDANTE de la couleur du texte (ex. icône turquoise,
     *  titre marine en `headlineStyle:"text"`). Défaut : hérite de la couleur du texte (`currentColor`). */
    badgeIconColor: z.string().optional(),
    /** Libellé du bouton CTA. Repli : traduction "En savoir plus". */
    ctaLabel: LocalizedString.optional(),
    /** Fetch/filtre — `defaultTypes`/`defaultTags`/`sourceKey`/`defaultFields` etc. */
    baseParams: SearchBaseParamsSchema,
    /** Mapping titre/description/image. Défauts déjà adaptés à un POI (name/description/profilMediumImageUrl). */
    resource: ResourceConfSchema.optional(),
    /** Action au clic du CTA. Défaut : `kind:"profil"` → `/profil/:slug`. */
    itemAction: ListItemActionSchema.optional(),
    autoplay: z.boolean().default(true),
    autoplayIntervalMs: z.number().int().min(2000).max(30000).default(6000),
    /** Fond de la section — couleur CSS libre (hex, oklch, `var(--token)`…). Section volontairement
     *  à fond FIXE (identique quel que soit le mode clair/sombre du site, comme un footer) : le
     *  titre/texte reste donc en blanc fixe plutôt qu'en `text-foreground` (qui s'inverserait en
     *  mode clair et deviendrait illisible sur ce fond). Repli code : encre du thème (`--foreground`). */
    background: z.string().optional(),
    /** Couleur du badge et du bouton CTA — CSS libre, même logique que `background`. Repli : `--primary`. */
    accentColor: z.string().optional(),
    /** Encre posée SUR `accentColor` (badge, bouton). Défaut blanc — à fournir dès que l'accent est clair :
     *  blanc sur la turquoise de parent62 ne tient que 1,93:1, contre 5,68:1 pour son marine. */
    accentTextColor: z.string().optional(),
    /**
     * Habillage : `sticker` (défaut, historique) — badge incliné dans le flux, flèches de navigation, CTA
     * pleine largeur — ou `card` : badge en pilule débordant du haut du bloc, points de position à gauche
     * (les flèches disparaissent) et CTA compact à droite. `card` suppose un bloc DANS une carte, dont le
     * conteneur ne rogne pas (`overflow` visible), sinon la pilule est coupée.
     */
    design: z.enum(["sticker", "card"]).optional(),
    /** Forme du badge : `badge` (défaut, étiquette inclinée), `pill` (arrondi droit) ou `text` — texte
     *  seul, sans fond ni rotation, police `--font-sans` (celle du menu), plus grand. */
    headlineStyle: z.enum(["badge", "pill", "text"]).optional(),
    /** Encre de la section, posée avec `background`. Sans elle, un fond fourni impose le texte BLANC
     *  (rendu historique, pensé pour un fond sombre) — à fournir dès que le fond est clair. */
    textColor: z.string().optional(),
    /**
     * Habillage `card` : dégradé du PANNEAU qui porte la diapositive — même grammaire que
     * `map-bubbles.backgroundOverlay`, pour qu'une carte et un carrousel côte à côte se répondent.
     * Absent, la diapositive vit à même la carte.
     */
    backgroundOverlay: z.object({ from: z.string(), to: z.string(), angle: z.number().optional() }).optional(),
    /** Encre du texte POSÉ SUR le panneau (`backgroundOverlay`) : elle doit suivre le DÉGRADÉ, pas l'encre
     *  de la carte — donner un jeton qui change avec lui si le dégradé a une variante sombre. Sans elle,
     *  l'encre de la carte s'applique. Contraste AA à mesurer en clair ET en sombre. */
    overlayTextColor: z.string().optional(),
    /** Fond du badge de titre, quand il doit différer de `accentColor` (qui teinte le bouton).
     *  Défaut : `accentColor`. */
    badgeColor: z.string().optional(),
    /** Encre du badge de titre. Défaut : `accentTextColor`, sinon blanc. */
    badgeTextColor: z.string().optional(),
    /** Puces de pagination sous le carrousel, entre les flèches précédent/suivant (celles-ci
     *  restent toujours affichées). Défaut masquées — à activer explicitement si besoin. */
    showControls: z.boolean().default(false),
    /** Titre ET image de la diapositive deviennent des liens vers la même cible que le bouton.
     *  Défaut `false` : seul le bouton est cliquable (comportement historique). */
    linkTitleAndImage: z.boolean().optional(),
    /** Apparence du CTA : `button` (défaut, pilule pleine) ou `link` — texte + flèche, sans fond,
     *  dans `accentColor`. */
    ctaStyle: z.enum(["button", "link"]).optional(),
    /** Emplacement du CTA en habillage `card` UNIQUEMENT (`design:"card"`, sans effet en `sticker`,
     *  déjà posé dans le flux de la diapositive) : `footer` (défaut, historique) — partage la ligne des
     *  points de position, en pied de carte — ou `inline` — sous le texte de CHAQUE diapositive, comme
     *  en habillage `sticker`. Les points restent alors seuls au pied, centrés. */
    ctaPosition: z.enum(["footer", "inline"]).optional(),
  }),
});
export type FeaturedCarouselSection = z.infer<typeof FeaturedCarouselSectionSchema>;
export type FeaturedCarouselSectionProps = z.infer<typeof FeaturedCarouselSectionSchema>["props"];


export interface SearchListViewProps<T extends SearchListEntity = SearchEntity> {
  results: T[];
  columns?: ListConf["columns"];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  /** Config `list` COMPLÈTE — porte les configs PAR-TYPE (testimonial, resource, … futurs) que le
   *  CardX/PreviewX correspondant lit lui-même. Évite de tuyauter une prop par type (ne passe pas à
   *  l'échelle). Sert aussi de repli pour columns/card/preview/previewParam (call-sites search allégés). */
  list?: ListConf;
  isDetailedView?: boolean;
  /** Synchro liste↔carte (mode split) : id de l'item focalisé → highlight + scrollIntoView. */
  focusedItemId?: string | null;
  /** Synchro split : clic sur une carte de liste → focus carte (au lieu d'ouvrir le détail). */
  onFocusItem?: (id: string) => void;
  /** Tableau de bord embarqué : clic sur une carte → SÉLECTION (au lieu d'ouvrir le
   *  détail), et la carte reçoit alors un bouton « Fiche » qui, lui, ouvre le détail.
   *  Ne vaut QUE pour la vue grille et les variants qui rendent ce bouton
   *  (`cardHasSheetButton`, aujourd'hui `poi-amenities`) : ailleurs le clic ouvre la
   *  fiche, pour qu'elle reste accessible. Sans cette prop, rien ne change. */
  onSelectItem?: (item: SearchEntity) => void;
  /**
   * Nom du paramètre URL utilisé pour synchroniser l'item affiché en preview.
   * Défaut : "preview". Permet d'avoir plusieurs sections sur une même page
   * sans collision (ex. "preview-equipements", "preview-answer")
   */
  previewParam?: string;
}

/**
 * Entités affichables dans une liste de recherche. Élargit `SearchEntity` (lib) avec
 * `News` : les actualités sont un type de recherche à part entière (globalautocomplete),
 * mais héritent d'un `serverData` hétérogène — d'où un type LOCAL au module search plutôt
 * qu'un élargissement de `SearchEntity` côté lib (qui casserait `useItem` & co).
 */
export type SearchListEntity = SearchEntity | News;

export interface SwitchDetailsModeProps<T extends SearchListEntity = SearchEntity> {
  openDetails: boolean;
  setOpenDetails: (open: boolean) => void;
  item: T;
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  /** Config `list` complète — thread une fois pour les configs par-type (cf. SearchListViewProps.list). */
  list?: ListConf;
}

export interface DetailsModeProps<T extends SearchListEntity = SearchEntity> {
  openDetails: boolean;
  setOpenDetails: (open: boolean) => void;
  preview?: ListConf["preview"];
  /** Config `list` complète — thread une fois pour les configs par-type (cf. SearchListViewProps.list). */
  list?: ListConf;
  item: T;
}

export interface SearchCardProps<T extends SearchListEntity = SearchEntity> {
  item: T;
  onClick?: () => void;
  /** Ouverture EXPLICITE de la fiche, quand le clic sur la carte fait autre chose
   *  (sélection du tableau de bord embarqué). Fourni par `SearchListView` avec
   *  `onSelectItem`, jamais autrement : sans lui la carte n'affiche pas le bouton
   *  et son clic ouvre la fiche, comme partout ailleurs. */
  onOpenSheet?: () => void;
  card?: ListConf["card"];
  /** Config `list` complète — le CardX typé y lit SA tranche (`list.testimonial`, `list.resource`, …). */
  list?: ListConf;
}

export interface PreviewProps<T extends SearchListEntity = SearchEntity> {
  item: T;
  preview?: ListConf["preview"];
  /** Config `list` complète — le PreviewX typé y lit SA tranche (`list.testimonial`, `list.resource`, …). */
  list?: ListConf;
  /** Ferme le conteneur de détail (drawer/dialog) — fourni par le conteneur. */
  onClose?: () => void;
}

export interface SearchMapWrapperProps<T extends SearchListEntity = SearchEntity> {
  results: T[];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  /** Conf de liste COMPLÈTE — nécessaire aux presenters config-driven du détail (`resource`/
   *  `testimonial` lisent leur tranche) et aux règles par item (`itemRules`). */
  list?: ListConf;
  map?: MapConf;
  /** Synchro split : id focalisé → flyTo + openPopup du marqueur. */
  focusedItemId?: string | null;
  /** Synchro split : clic marqueur → remonte l'id (highlight liste). */
  onMarkerFocus?: (id: string) => void;
  /** Surcharge de l'action du bouton de popup, pour un appelant qui monte cette
   *  carte sur SES propres entités (cf. Meeteem/ampli) : renvoyer `true`
   *  consomme le clic et court-circuite la cascade déclarative `itemAction`. */
  onItemAction?: (item: SearchEntity) => boolean | void;
  /** Override du conteneur (mode split : la carte remplit sa colonne au lieu de min-h-screen). */
  containerClass?: string;
}

export interface SearchMapProps<T extends SearchListEntity = SearchEntity> {
  results: T[];
  card?: ListConf["card"];
  preview?: ListConf["preview"];
  /** Cf. {@link SearchMapWrapperProps.list}. */
  list?: ListConf;
  map?: MapConf;
  /** Synchro split : id focalisé → flyTo + openPopup du marqueur. */
  focusedItemId?: string | null;
  /** Synchro split : clic marqueur → remonte l'id (highlight liste). */
  onMarkerFocus?: (id: string) => void;
  /** Surcharge de l'action du bouton de popup, pour un appelant qui monte cette
   *  carte sur SES propres entités (cf. Meeteem/ampli) : renvoyer `true`
   *  consomme le clic et court-circuite la cascade déclarative `itemAction`. */
  onItemAction?: (item: SearchEntity) => boolean | void;
  /** Override du conteneur (mode split : la carte remplit sa colonne au lieu de min-h-screen). */
  containerClass?: string;
}

export interface MapPopupProps<T extends SearchListEntity = SearchEntity> {
  item: T;
  t: (key: string) => string;
  /** Libellé/intention du bouton d'action (cf. MapConf.itemAction). */
  actionKind?: "profil" | "preview";
  /** Handler du bouton d'action — fourni par SearchMap (popup react-map-gl). */
  onAction?: () => void;
  /** Chips de tags : la MÊME conf que la carte de liste (`list.card.tagColors`) — un tag masqué en liste l'est aussi ici. */
  tagColors?: TagColorsConf;
}