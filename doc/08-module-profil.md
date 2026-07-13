[← Retour à l'index](README.md)

# Module Profil

**Sommaire**

- [Module Profil](#module-profil)
  - [Architecture interne](#architecture-interne)
  - [Configuration de module (`module.config.ts`)](#configuration-de-module-moduleconfigts)
  - [Routes dynamiques avec loader SSR](#routes-dynamiques-avec-loader-ssr)
  - [Context et Provider](#context-et-provider)
    - [ProfileEntityContext](#profileentitycontext)
    - [ProfileEntityProvider](#profileentityprovider)
  - [Hook useProfileEntity](#hook-useprofileentity)
  - [Hook useFormatProfileEntity](#hook-useformatprofileentity)
  - [Schéma de configuration (`schema.ts`)](#schéma-de-configuration-schemats)
  - [Sections de profil](#sections-de-profil)
  - [ProfileRenderer](#profilerenderer)
  - [ProfileSectionRenderer](#profilesectionrenderer)
  - [SEO dynamique (ProfileSeo)](#seo-dynamique-profileseo)
  - [i18n et traductions](#i18n-et-traductions)
  - [Configuration JSON dans site-config.json](#configuration-json-dans-site-configjson)
  - [Flux d'exécution complet](#flux-dexécution-complet)
  - [Hooks principaux](#hooks-principaux)
  - [Champs de formulaire partagés (`profile-edit/fields/`)](#champs-de-formulaire-partagés-profile-editfields)
  - [Formulaire POI équipement sportif](#formulaire-poi-équipement-sportif)
  - [Actions et boutons : comportement non connecté](#actions-et-boutons--comportement-non-connecté)
  - [Récapitulatif](#récapitulatif)
  - [Voir aussi](#voir-aussi)

---

Le module **profil** gère l'affichage des pages de profil pour tous les types d'entités du système (organizations, events, projects, citoyens, poi). Il s'agit d'un **module core** (chargé en eager) pour éviter tout flash de loading lors de l'accès aux profils.

## Architecture interne

```
src/modules/profil/
├── actions/                        // Système d'actions refactorisé (config-driven)
│   ├── config/                     // Configurations des actions
│   │   ├── entity-actions.ts       // Config des actions d'entité (follow, join, etc.)
│   │   ├── member-actions.ts       // Config des actions de membres
│   │   └── icons.ts                // Mapping des icônes pour les actions
│   ├── hooks/                      // Hooks d'actions par type d'entité
│   │   ├── useAdminActions.tsx     // Actions admin
│   │   ├── useEntityActions.tsx    // Actions génériques d'entité
│   │   ├── useUserEntityActions.tsx
│   │   ├── useOrgEntityActions.tsx
│   │   ├── useProjectEntityActions.tsx
│   │   └── useEventEntityActions.tsx
│   ├── mutations/                  // Mutations par domaine
│   │   ├── core.ts                 // Mutations de base
│   │   ├── friend.ts              // Mutations ami/follow
│   │   ├── member.ts              // Mutations membership
│   │   └── relationship.ts        // Mutations relations
│   ├── builders/                   // Builders d'objets action
│   │   ├── buildEntityAction.tsx
│   │   └── buildUserAction.tsx
│   └── index.ts
├── components/
│   ├── action-buttons/             // Boutons d'action UI
│   │   ├── AddEntityDropdown.tsx
│   │   ├── ConfirmationDialog.tsx
│   │   ├── SeparateButtonsLayout.tsx
│   │   └── StatusDropdownLayout.tsx
│   ├── actions/                    // Composants d'actions
│   │   ├── EntityStatusButton.tsx
│   │   └── ProfileActions.tsx
│   ├── add/                        // Câblage des modales d'AJOUT (résolution par nom logique `add-<id>`)
│   │   └── ModalRegistry.tsx       // registry statique standards + costumModalThunk (table runtime costum)
│   │                               //   → toutes les modales rendues par forms/EntityFormModal (descripteurs)
│   ├── members/                    // Gestion des membres
│   │   ├── ConfirmationDialog.tsx
│   │   ├── InviteMemberDialog.tsx
│   │   ├── MemberListRenderer.tsx
│   │   └── MemberManagementDialog.tsx
│   ├── profile-edit/               // Édition de profil
│   │   ├── EditBasicInfoTab.tsx
│   │   ├── EditContactTab.tsx
│   │   ├── EditEventDatesTab.tsx
│   │   ├── EditLocationTab.tsx     // Coordonnées géo injectées sur sélection code postal/rue
│   │   ├── EditModalRegistry.tsx   // Registry lazy modales édition (edit-profile + costumEditThunk → table runtime)
│   │   ├── EditProfileModal.tsx
│   │   ├── EditScheduleTab.tsx
│   │   ├── EditSocialTab.tsx
│   │   ├── ProfileEditDropdown.tsx
│   │   ├── ProfileImageUpload.tsx
│   │   └── fields/                 // Champs de DOMAINE profil (montés par les widgets de forms/registerWidgets)
│   │       ├── FormFieldTags.tsx          // widget `tags` ; prop searchable?: boolean (défaut true)
│   │       ├── ImageUploadField.tsx       // widget `image` : upload + recadrage (ImageCropDialog)
│   │       ├── IconFormField.tsx
│   │       ├── ParentInfoReadonly.tsx     // slot parent (lecture seule)
│   │       ├── SelectParent.tsx
│   │       ├── TranslatedFormMessage.tsx
│   │       └── index.ts
│   │                               // (primitives génériques FormFieldText/Number/… + FormFieldUrlList
│   │                               //  déplacées dans formEngine/widgets/fields/)
│   ├── sections/
│   │   ├── ProfileHeader.tsx       // En-tête du profil (hero, simple, cover, minimal)
│   │   ├── ProfileInfo.tsx         // Informations générales (sidebar, inline, tabs)
│   │   ├── ProfileAbout.tsx        // Description et à propos
│   │   ├── ProfileMap.tsx          // Carte de localisation
│   │   ├── ProfileMapLeaflet.tsx   // Carte Leaflet
│   │   ├── ProfileMapWrapper.tsx   // Wrapper carte
│   │   ├── ProfileOrganizer.tsx    // Organisateur/Porteur de projet
│   │   ├── ProfileMembers.tsx      // Liste des membres
│   │   ├── ProfileGallery.tsx      // Galerie d'images
│   │   ├── ProfileRelated.tsx      // Entités liées
│   │   ├── ProfileActions.tsx      // Boutons d'action
│   │   ├── ProfileEventDates.tsx   // Dates d'événement
│   │   ├── ProfileBadges.tsx       // Badges et certifications
│   │   ├── ProfileTags.tsx         // Tags et mots-clés
│   │   ├── ProfileOpeningHours.tsx // Horaires d'ouverture
│   │   ├── ProfileTabLayout.tsx    // Layout deux colonnes pour tabs
│   │   ├── custom/                 // Sections personnalisées
│   │   │   ├── ProfileTiersLieuxInfo.tsx   // Info tiers-lieux
│   │   │   ├── ProfilTiersLieuxAbout.tsx   // À propos tiers-lieux
│   │   │   └── SectionTitleTL.tsx          // Titre tiers-lieux
│   │   └── headers/                // Variantes d'en-tête
│   │       ├── ProfileHeaderBannerOverlay.tsx
│   │       ├── ProfileHeaderComplete.tsx
│   │       ├── ProfileHeaderCover.tsx
│   │       ├── ProfileHeaderHero.tsx
│   │       ├── ProfileHeaderMinimal.tsx
│   │       ├── ProfileHeaderSimple.tsx
│   │       └── index.ts
│   ├── shared/                     // Composants partagés
│   │   ├── CountBadge.tsx
│   │   ├── EmptyState.tsx
│   │   ├── EntityCard.tsx
│   │   ├── EntityCardDetailed.tsx
│   │   ├── EntityEmptyState.tsx
│   │   ├── EntityGrid.tsx
│   │   ├── EntityGridView.tsx
│   │   ├── LoadingState.tsx
│   │   ├── UserListItem.tsx
│   │   └── index.ts
│   ├── social/
│   │   └── FriendRequestDialog.tsx
│   ├── tabs/                       // Tabs spécialisés
│   │   ├── MembershipTab.tsx
│   │   ├── MembershipTabWrapper.tsx
│   │   ├── NewsTab.tsx
│   │   ├── SocialTab.tsx
│   │   └── SocialTabWrapper.tsx
│   ├── templates/
│   │   └── ProfileTemplateDynamic.tsx  // Template dynamique basé sur config
│   ├── EntityActionButtons.tsx
│   ├── ProfileErrorBoundary.tsx
│   └── TabDetailRenderer.tsx
├── constants/
│   ├── index.ts
│   └── queryKeys.ts                // Clés React Query
├── contexts/
│   ├── ProfileEntityContext.tsx    // Context React pour l'entité du profil
│   └── ProfileEntityProvider.tsx   // Provider du context
├── forms/                          // Moteur de formulaires config-driven (voir 28-module-formengine.md)
│   ├── EntityFormModal.tsx         // Modale GÉNÉRIQUE unique (consomme une EntityModalSpec)
│   ├── entityModalSpec.ts          // Type EntityModalSpec (données + clés, sérialisable)
│   ├── resolveModalSpec.ts         // Résout descripteur/defaults/slots/scope/payload depuis les clés
│   ├── specRegistries.ts           // Registres « par clé » (scope/payload/defaults/slots/cleanValues…)
│   ├── registerSpecFns.ts          // Peuple les registres (side-effect)
│   ├── registerWidgets.tsx         // Widgets DOM : location/image/tags/openingHours…
│   ├── jsonFormSubmit.ts           // Pipeline READ/WRITE (buildPipelineDefaults/Payload)
│   ├── EditProfileGenericModal.tsx // Édition de profil standard
│   ├── *.descriptor.ts             // Descripteurs des entités standard (org/projet/event/poi)
│   ├── addPoi.payload.ts           // POI standard (buildAddPoiPayload + POI_SPEC)
│   ├── configs/                    // Specs standard (addStandard, editProfile)
│   └── costum/                     // FORMULAIRES COSTUM
│       ├── compileCostumSchema.ts  // CostumFormSchema → { descriptor, spec } (WIDGET_DEFAULTS)
│       ├── costumFormRegistry.ts   // Table runtime id→EntityModalSpec (+ registerCostumForm zod)
│       ├── registerCostumForms.ts  // Loader : lit window.__CONFIG__.costumForms
│       ├── costumFormSchema.zod.ts // Validation du document costum
│       ├── sharedCodecs.ts         // address/openingHours/social + codecs paramétrés
│       ├── sharedFns.ts            // image:profilUrl, cleanValues, invalidate:standard
│       ├── tiers-lieux/            // schema.ts (LA source) + fns.ts + spec.ts
│       └── equipements-sportifs/   // schema.ts + fns.ts + spec.ts
├── hooks/
│   ├── mutationUtils.ts            // Utilitaires de transformation pour mutations
│   ├── submitEntityEdit.ts         // Cœur d'ÉDITION (patch + save), réutilisé par useEntityMutation
│   ├── useEntityMutation.tsx       // Mutations CRUD GÉNÉRIQUES (runEntityMutation pur + hook React)
│   ├── usePoiEquipementMatches.ts  // Détection doublons POI (useSearchQuery + debounce)
│   ├── useCommentVotes.tsx         // Votes sur commentaires
│   ├── useConfirmationDialog.tsx   // Dialog de confirmation
│   ├── useEntityLabels.tsx         // Labels d'entité
│   ├── useFormatProfileEntity.tsx  // Formatage des données du profil
│   ├── useFriendsQuery.tsx         // Query amis
│   ├── useGetAnwersByFormsQuery.tsx // Query réponses formulaires
│   ├── useMembershipQuery.tsx      // Query membership
│   ├── useMembersQuery.tsx         // Query membres
│   ├── useNewsDetailUrlGenerator.tsx // Générateur URL détail news
│   ├── useProfileEntity.tsx        // Accès à l'entité typée
│   ├── useProfileMutations.tsx     // Mutations de profil
│   ├── useProfileSetup.ts          // Setup profil
│   ├── useProfilMembersQuery.tsx   // Query membres profil
│   ├── useProfilOrganizationsQuery.tsx // Query organisations
│   ├── useProfilPermissions.ts     // Permissions profil (hook local)
│   ├── useProfilProjectsQuery.tsx  // Query projets
│   ├── useProfilSubscribersQuery.tsx // Query abonnés
│   ├── useRelatedEntities.tsx      // Entités liées
│   └── useUserStatusBadge.tsx      // Badge statut utilisateur
│   // Mutations create/edit unifiées dans useEntityMutation (ex-useAddMutations/useEditTiersLieu/
│   // useOrganizationMutations/useProjectMutations supprimés) ; logique métier costum registrée par clé.
├── permissions/                    // Système de permissions modulaire (voir 10-permissions.md)
│   ├── types.ts                    // ProfilPermissions (27 champs)
│   ├── defaults.ts                 // DEFAULT_PROFIL_PERMISSIONS
│   ├── calculators/                // Calculateurs par type d'entité
│   │   ├── user.ts                 // calculateOwnProfilePermissions, calculateOtherUserPermissions
│   │   ├── organization.ts         // calculateOrganizationPermissions
│   │   ├── project.ts              // calculateProjectPermissions
│   │   ├── event.ts                // calculateEventPermissions
│   │   └── poi.ts                  // calculatePoiPermissions
│   ├── register.ts                 // Enregistrement namespace "profil"
│   └── index.ts                    // Exports
├── prefetch/
│   ├── index.ts                    // Exports
│   └── prefetchProfile.ts         // Pré-chargement SSR du profil
├── pages/
│   └── ProfilePage.tsx             // Page principale des profils
├── utils/
│   ├── errorHandling.ts            // Gestion d'erreurs
│   ├── fileValidation.ts           // Validation de fichiers
│   └── imageCompression.ts         // Compression d'images
├── i18n/
│   ├── en.json                     // Traductions anglaises
│   └── fr.json                     // Traductions françaises
├── module.config.ts                // Configuration du module (type: "core")
├── routes.tsx                      // Routes dynamiques avec loader SSR
├── schema.ts                       // Schémas Zod des profils
├── schemaForm.ts                   // Schémas Zod pour formulaires
├── types.ts                        // Types TypeScript
├── ProfileRenderer.tsx             // Renderer principal de profil
├── ProfileSectionRenderer.tsx      // Renderer des sections
├── ProfileSeo.tsx                  // SEO dynamique
├── i18n.ts                         // Pont vers react-i18next
└── index.ts                        // Exports centralisés
```

## Configuration de module (`module.config.ts`)

```ts
const config: ModuleConfigSchema = {
  name: "profil",
  type: "core",          // Module core = chargé en eager (synchrone)
  enabled: true
};
```

Le module profil est **core** pour garantir qu'il est toujours disponible sans code-splitting, évitant ainsi tout flash de loading lors de l'accès à un profil.

## Routes dynamiques avec loader SSR

Le fichier `routes.tsx` exporte une fonction `routes` (de type `ModuleRouteFactory`) qui crée la route dynamique `/profil/:slug` avec génération automatique des sous-routes pour les tabs:

```ts
export const routes: ModuleRouteFactory = (
  queryClient?: QueryClient,
  config?: SiteConfig
): RouteObject[] => [
  {
    path: "profil/:slug",
    element: <ProfilePage />,
    errorElement: <ProfileErrorBoundary />,
    loader: (args) => profileLoader(args, queryClient, config),
    children: generateTabRoutes(config),
  }
];
```

**Convention**: Les profils sont accessibles via `/profil/:slug`.

**Loader SSR intelligent** (`profileLoader`):
1. Pré-charge les données de l'entité via `prefetchProfileQuery(queryClient, slug)`
2. Détecte le tab actif depuis l'URL (`/profil/:slug/news` → tab "news")
3. Pré-charge les données du tab si nécessaire (ex: news pour les types supportés)
4. Retourne `preloadImages` en plus de `entity` et `activeTab`

```ts
const profileLoader = async (
  { params, request }: LoaderFunctionArgs,
  queryClient?: QueryClient,
  config?: SiteConfig
) => {
  if (!queryClient) return null; // Côté client, skip

  const slug = params.slug;
  if (!slug) {
    throw new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const activeTab = pathSegments.length > 2 ? pathSegments[2] : 'about';

  try {
    // 1. Pré-charger les données du profil côté serveur
    const entity = await prefetchProfileQuery(queryClient, slug);

    // Collecter les images critiques pour le préchargement LCP
    const preloadImages: string[] = [];
    const serverData = entity.serverData;
    if (serverData) {
      if (serverData.profilMediumImageUrl && typeof serverData.profilMediumImageUrl === 'string') {
        preloadImages.push(serverData.profilMediumImageUrl);
      }
      // ... bannière, thumb, etc.
    }

    // 2. Pré-charger les données du tab actif (si news)
    if (entity && config?.profiles) {
      const entityType = entity.getEntityType?.() || "";
      const profileConfig = config.profiles[entityType as keyof typeof config.profiles];
      if (profileConfig?.tabs) {
        const tabConfig = profileConfig.tabs.find((tab) => tab.id === activeTab);
        if (tabConfig?.sections?.some(s => s.type === 'news') && NEWS_SUPPORTED_TYPES.has(entityType)) {
          await prefetchNewsQuery(queryClient, entity);
        }
      }
    }

    return { entity, activeTab, preloadImages };
  } catch (error) {
    console.error('Erreur lors du chargement du profil:', error);
    throw new Response('Not Found', { status: 404 });
  }
};
```

**Génération dynamique des routes de tabs** (`generateTabRoutes`):
- Collecte tous les tabs configurés dans `config.profiles`
- Génère les routes enfants: `/profil/:slug/{tabId}`
- Support des sous-routes: `/profil/:slug/news/:newsId`

```ts
const generateTabRoutes = (config?: SiteConfig): RouteObject[] => {
  if (!config?.profiles) return [{ index: true, element: null }];

  const tabsMap = new Map<string, { subRoutes?: ProfileTabSubRoute[] }>();

  // Collecter tous les tabs de tous les types de profils
  Object.values(config.profiles).forEach(profileConfig => {
    profileConfig.tabs?.forEach(tab => {
      tabsMap.set(tab.id, { subRoutes: tab.subRoutes });
    });
  });

  // Générer les routes
  return [
    { index: true, element: null },
    ...Array.from(tabsMap.entries()).map(([tabId, data]) => ({
      path: tabId,
      element: null,
      children: data.subRoutes?.map(sub => ({
        path: sub.path,
        element: null,
      })),
    })),
  ];
};
```

## Context et Provider

### ProfileEntityContext

Le context expose l'entité du profil, sa configuration et son type:

```ts
interface ProfileEntityContextType {
  entity: SearchEntity;      // Entité brute (union type)
  config: ProfileConfig;     // Configuration des sections
  entityType: ProfileType;   // Type: "organizations" | "events" | ...
}
```

### ProfileEntityProvider

Le provider injecte ces valeurs dans le contexte:

```tsx
<ProfileEntityProvider
  entity={entity}
  config={profileConfig}
  entityType={entityType}
>
  <ProfileRenderer />
</ProfileEntityProvider>
```

## Hook useProfileEntity

Ce hook expose l'entité et sa configuration depuis le contexte:

```ts
export function useProfileEntity() {
  const context = useContext(ProfileEntityContext);
  if (!context) {
    throw new Error('useProfileEntity must be used within a ProfileEntityProvider');
  }
  return context;
}
```

**Usage**:

```tsx
function MyProfileComponent() {
  const { entity, config, entityType } = useProfileEntity();
  return <div>{entity.serverData?.name}</div>;
}
```

**Retourne**:
- `entity: SearchEntity` - L'entité brute du profil
- `config: ProfileConfig` - Configuration des sections et tabs
- `entityType: string` - Type d'entité ("organizations", "events", etc.)

## Hook useFormatProfileEntity

Ce hook formatte et normalise les données de l'entité pour l'affichage:

```ts
const {
  logoUrl,
  bannerUrl,
  address,
  organizer,
  name,
  tags,
  badges,
  membersCount,
  projectsCount,
  openingHours,
} = useFormatProfileEntity(entity);
```

## Schéma de configuration (`schema.ts`)

Le module profil utilise **Zod** pour valider la configuration des profils. La configuration principale est définie dans `site-config.json` sous la clé `profiles`:

```ts
// Types d'entités supportés
export const ProfileTypeSchema = z.enum([
  "events",
  "organizations",
  "projects",
  "citoyens",
  "poi"
]);

// Variantes de sections
export const ProfileHeaderVariantSchema = z.enum([
  "hero", "simple", "cover", "minimal", "banner-overlay", "complete"
]);
export const ProfileInfoVariantSchema = z.enum(["sidebar", "inline", "tabs"]);
export const ProfileLayoutVariantSchema = z.enum([
  "default", "modern", "compact", "full-width"
]);

// Schema pour les sous-routes d'un tab
export const ProfileTabSubRouteSchema = z.object({
  path: z.string(),           // ex: ":newsId" pour /profil/:slug/news/:newsId
  component: z.string(),      // ex: "NewsDetailPage"
  loader: z.string().optional(),
});

// Schema pour un tab de profil
export const ProfileTabSchema = z.object({
  id: z.string(),
  label: LocalizedString,
  path: z.string().optional(),    // chemin URL personnalisé (par défaut = id)
  sections: z.array(ProfileSectionSchema).optional(), // Option 1: sections composables
  component: z.enum(["SocialTab", "MembershipTab", "NewsTab"]).optional(), // Option 2: composant dédié
  subRoutes: z.array(ProfileTabSubRouteSchema).optional(), // Sous-routes (ex: news/:newsId)
  condition: ProfileTabConditionSchema, // Conditions d'affichage
}).refine(
  (data) => (data.sections && data.sections.length > 0) || data.component,
  { message: "Un tab doit avoir soit 'sections' soit 'component'" }
);

// Conditions d'affichage des tabs
export const ProfileTabConditionSchema = z.object({
  entityTypes: z.array(ProfileTypeSchema).optional(), // Types d'entités compatibles
  permissions: z.array(z.string()).optional(),         // Permissions requises
  userContext: z.enum(["own", "other", "any"]).optional(), // Contexte utilisateur
}).optional();

// Configuration d'un type de profil
export const ProfileConfigSchema = z.object({
  layout: ProfileLayoutVariantSchema.optional().default("default"),
  tabs: z.array(ProfileTabSchema).optional(),     // NOUVEAU: tabs configurables
  sections: z.array(ProfileSectionSchema),        // sections globales (hors tabs)
  hideHeader: z.boolean().optional().default(false),
  hideFooter: z.boolean().optional().default(false),
  seo: z.object({
    titleTemplate: z.string().optional(),
    descriptionTemplate: z.string().optional(),
  }).optional(),
});

// Configuration globale
export const ProfilesConfigSchema = z.object({
  default: ProfileConfigSchema.optional(),
  events: ProfileConfigSchema.optional(),
  organizations: ProfileConfigSchema.optional(),
  projects: ProfileConfigSchema.optional(),
  citoyens: ProfileConfigSchema.optional(),
  poi: ProfileConfigSchema.optional(),
}).optional();
```

## Sections de profil

Le module profil propose **17 types de sections** configurables:

| Section                    | Type                         | Variantes/Options                              | Description                               |
| -------------------------- | ---------------------------- | ---------------------------------------------- | ----------------------------------------- |
| `profile-header`           | ProfileHeaderSection         | hero, simple, cover, minimal, banner-overlay, complete | En-tête avec bannière et logo |
| `profile-info`             | ProfileInfoSection           | sidebar, inline, tabs                          | Informations générales et contact         |
| `profile-info-tl`          | ProfileTiersLieuxInfoSection | —                                              | Informations tiers-lieux (variante custom)|
| `profile-about`            | ProfileAboutSection          | layout: column, grid                           | Description et à propos                   |
| `profile-about-tl`         | ProfileTiersLieuxAboutSection| —                                              | À propos tiers-lieux (variante custom)    |
| `profile-map`              | ProfileMapSection            | height, zoom, showMarker                       | Carte de localisation (Leaflet)           |
| `profile-organizer`        | ProfileOrganizerSection      | showLogo, showDescription, showLink            | Organisateur/Porteur de projet            |
| `profile-members`          | ProfileMembersSection        | limit, showRole, showManagement                | Liste des membres                         |
| `profile-gallery`          | ProfileGallerySection        | columns, lightbox                              | Galerie d'images avec lightbox            |
| `profile-related`          | ProfileRelatedSection        | relationType, limit                            | Entités liées (projects, events, poi, organizations) |
| `profile-actions`          | ProfileActionsSectionSchema  | showEditButton, showAddDropdown, layout        | Boutons d'action (éditer, ajouter, email) |
| `profile-event-dates`      | ProfileEventDatesSectionSchema | showType, dateFormat                         | Dates d'événement (start/end)             |
| `profile-badges`           | ProfileBadgesSectionSchema   | layout (grid, flex, list), maxDisplay          | Badges et certifications                  |
| `profile-tags`             | ProfileTagsSectionSchema     | maxDisplay, linkable, searchOnClick            | Tags et mots-clés                         |
| `profile-opening-hours`    | ProfileOpeningHoursSectionSchema | format (table, list, compact), showCurrentStatus | Horaires d'ouverture          |
| `profile-tab-layout`       | ProfileTabLayoutSectionSchema | leftSections, rightSections                   | Layout deux colonnes pour tabs            |
| `profile-template-dynamic` | ProfileTemplateDynamicSchema | —                                              | Template dynamique basé sur config        |

Chaque section a son propre schéma Zod avec des options configurables. Exemple pour `profile-header`:

```ts
export const ProfileHeaderSectionSchema = z.object({
  type: z.literal("profile-header"),
  variant: ProfileHeaderVariantSchema.optional().default("hero"),
  showBackButton: z.boolean().optional().default(true),
  showShareButton: z.boolean().optional().default(true),
  showEditButton: z.boolean().optional().default(false),
  showBanner: z.boolean().optional().default(true),
  showAvatar: z.boolean().optional().default(true),
  bannerHeight: z.string().optional().default("384px"),
  avatarSize: z.string().optional().default("160px"),
  avatarOverlap: z.boolean().optional().default(true),
  showLocation: z.boolean().optional().default(true),
  allowUpload: z.boolean().optional().default(true),
  showActions: z.boolean().optional().default(true),
  showAddDropdown: z.boolean().optional().default(true),
  addConfig: AddConfigSchema,
  addDropdownLabel: LocalizedString.optional(),
  showEmailButton: z.boolean().optional().default(true),
  showReservationButton: z.boolean().optional().default(false),
  // Opt-in : le bouton « Voir toutes les photos » ne s'affiche QUE si le type de
  // profil courant possède un onglet `gallery` dans sa config (`profiles[type].tabs`).
  // Ce flag permet de le forcer masqué même si l'onglet gallery existe.
  // Lien généré via buildProfileTabUrl(siteConfig, entity, tab => tab.id === "gallery").
  showAllPhotosButton: z.boolean().optional().default(true),
});
```

## ProfileRenderer

Le `ProfileRenderer` est le composant principal qui:
1. Récupère la configuration via `useProfileEntity()`
2. Applique le layout configuré
3. Rend les sections via `ProfileSectionRenderer`

```tsx
export function ProfileRenderer() {
  const { config } = useProfileEntity();

  return (
    <div className={`profile-layout-${config.layout}`}>
      {config.sections.map((section, idx) => (
        <ProfileSectionRenderer key={idx} section={section} />
      ))}
    </div>
  );
}
```

## ProfileSectionRenderer

Le `ProfileSectionRenderer` utilise `lazy()` de **vite-preload** (pas `lazyNamed`) pour chaque type de section. Il distingue les sections de profil des sections de site generiques :

```tsx
import { lazy } from "vite-preload";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { useProfileEntity } from "./hooks/useProfileEntity";

// Lazy load des sections
const ProfileHeader = lazy(() => import("./components/sections/ProfileHeader"));
const ProfileInfo = lazy(() => import("./components/sections/ProfileInfo"));
const ProfileAbout = lazy(() => import("./components/sections/ProfileAbout"));
const ProfileTiersLieuxInfo = lazy(() => import("./components/sections/custom/ProfileTiersLieuxInfo"));
const ProfileTiersLieuxAbout = lazy(() => import("./components/sections/custom/ProfilTiersLieuxAbout"));
// ... etc (17 sections profil + 1 template)

// Profile-specific section types
const PROFILE_SECTION_TYPES = [
  "profile-header", "profile-info", "profile-info-tl",
  "profile-about", "profile-about-tl", "profile-map",
  "profile-organizer", "profile-members", "profile-gallery",
  "profile-related", "profile-actions", "profile-event-dates",
  "profile-badges", "profile-tags", "profile-opening-hours",
  "profile-tab-layout", "profile-template-dynamic",
] as const;

export function ProfileSectionRenderer({ section }: ProfileSectionRendererProps) {
  const { entity } = useProfileEntity();

  // Check if it's a profile-specific section
  const isProfileSection = PROFILE_SECTION_TYPES.includes(section.type as typeof PROFILE_SECTION_TYPES[number]);

  if (!isProfileSection) {
    // Special handling for news sections - inject profile entity
    if (section.type === 'news') {
      return <SectionRenderer section={{
        ...section,
        props: { ...section.props, entitySlug: entity?.slug }
      }} />;
    }
    // It's a site section - use the SectionRenderer
    return <SectionRenderer section={section as Section} />;
  }

  // Handle profile-specific sections via switch
  switch (section.type) {
    case "profile-header":
      return <ProfileHeader section={section} />;
    case "profile-info-tl":
      return <ProfileTiersLieuxInfo section={section} />;
    case "profile-about-tl":
      return <ProfileTiersLieuxAbout section={section} />;
    // ... etc
    default:
      console.warn(`Unknown profile section type: ${section.type}`);
      return null;
  }
}
```

**Points cles** :
* Utilise `lazy()` de vite-preload (pas `lazyNamed`) -- tous les composants ont un `export default`
* Les sections non-profil sont deleguees au `SectionRenderer` global
* Les sections `news` recoivent automatiquement le `entitySlug` du profil courant

### Variante `complete` — comportements spécifiques

`ProfileHeaderComplete` (`components/sections/headers/ProfileHeaderComplete.tsx`) intègre deux comportements notables :

**Bouton « Voir toutes les photos » — opt-in** :
Le bouton n'est rendu que si le type de profil courant a un onglet `gallery` configuré. Le check est fait via `buildProfileTabUrl(siteConfig, entity, tab => tab.id === "gallery")` : si aucun onglet `gallery` n'existe pour ce type, `galleryHref` est `null` et le bouton est supprimé. Le flag `showAllPhotosButton: false` dans la config permet de le masquer même quand l'onglet existe. Le lien pointe vers `/profil/:slug/gallery`.

**Bouton « Contacter par email »** :
Utilise `<Button asChild>` avec un `<a href="mailto:…">` natif au lieu de `window.location.href`. Cette approche est plus fiable (respect du client mail par défaut, ouverture dans un nouvel onglet possible) et accessible.

**`ProfileActions` (`components/sections/ProfileActions.tsx`)** applique le même correctif mailto (`<Button asChild><a href="mailto:…">`), alignant le comportement de la section `profile-actions` avec la variante `complete`.

## SEO dynamique (ProfileSeo)

Le composant `ProfileSeo` génère les meta tags dynamiquement:

```tsx
<ProfileSeo
  entity={entity}
  isLoading={false}
  entityType={entityType}
/>
```

Il génère:
- `<title>` avec template configurable
- `<meta name="description">` avec template configurable
- Open Graph tags (og:title, og:description, og:image, og:type)
- Twitter Card tags
- Données structurées JSON-LD (Organization, Event, Person, Place)

## i18n et traductions

Le module profil gère ses propres traductions:

```ts
// i18n.ts
import i18n from "@/i18n";
import enTranslations from "./i18n/en.json";
import frTranslations from "./i18n/fr.json";

i18n.addResourceBundle("en", "modules/profil", enTranslations, true, true);
i18n.addResourceBundle("fr", "modules/profil", frTranslations, true, true);
```

Utilisation dans les composants:

```tsx
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";

function ProfilePage() {
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  return <h1>{t("ProfilePage.title")}</h1>;
}
```

Clés i18n ajoutées récemment :

| Clé (namespace `modules/profil`) | fr | en |
|-----|----|----|
| `ProfileRelated.empty.organizations` | `"Aucune organisation liée"` | `"No related organizations"` |
| `ImageUploadField.dropHint` | `"Glisser-déposer ou cliquer pour choisir"` | `"Drag & drop or click to choose"` |
| `ImageUploadField.remove` | `"Retirer l'image"` | `"Remove image"` |
| `ImageUploadField.imageOnly` | `"Seules les images sont acceptées."` | `"Only images are accepted."` |
| `AddPoiEquipement.*` (100+ clés) | Libellés/étapes/champs du wizard équipement | (parité fr/en complète) |

Les clés `AddPoiEquipement` couvrent : titres/descriptions par mode (add/edit), 4 étapes (`general`, `legal`, `structure`, `usage`), indicateur de progression (`stepIndicator`/`stepAria`), section matches (doublons détectés), tous les champs et placeholders des sélecteurs, blocs PMR, PSHS, boutons de navigation. La parité fr/en est complète dans `i18n/fr.json` et `i18n/en.json` (`src/modules/profil/i18n/`).

Ces clés sont utilisées par `ProfileRelated.tsx` (`getEmptyTitle()`) et les nouveaux composants décrits ci-dessous.

## Configuration JSON dans site-config.json

Exemple de configuration des profils avec **tabs** dans `site-config.json`:

```json
{
  "profiles": {
    "default": {
      "layout": "default",
      "sections": [
        { "type": "profile-header", "variant": "complete" }
      ],
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "À propos", "en": "About" },
          "sections": [
            { "type": "profile-about" },
            { "type": "profile-map", "zoom": 15 }
          ]
        },
        {
          "id": "news",
          "label": { "fr": "Actualités", "en": "News" },
          "sections": [
            { "type": "news", "props": { "maxItems": 20, "showAddButton": true } }
          ],
          "subRoutes": [
            { "path": ":newsId", "component": "NewsDetailPage" }
          ],
          "condition": {
            "entityTypes": ["organizations", "projects", "citoyens"]
          }
        },
        {
          "id": "members",
          "label": { "fr": "Membres", "en": "Members" },
          "component": "MembershipTab",
          "condition": {
            "entityTypes": ["organizations", "projects"]
          }
        }
      ],
      "hideHeader": false,
      "hideFooter": false
    },
    "organizations": {
      "layout": "modern",
      "sections": [
        { "type": "profile-header", "variant": "banner-overlay", "showAddDropdown": true }
      ],
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "À propos", "en": "About" },
          "sections": [
            { "type": "profile-tab-layout",
              "leftSections": [{ "type": "profile-about" }],
              "rightSections": [{ "type": "profile-info" }]
            }
          ]
        },
        {
          "id": "social",
          "label": { "fr": "Réseau", "en": "Network" },
          "component": "SocialTab"
        },
        {
          "id": "organizations",
          "label": { "fr": "Organisations partenaires", "en": "Partner organizations" },
          "sections": [
            { "type": "profile-related", "relationType": "organizations" }
          ]
        }
      ],
      "seo": {
        "titleTemplate": "{name} - Organisation",
        "descriptionTemplate": "{shortDescription}"
      }
    },
    "events": {
      "layout": "default",
      "sections": [
        { "type": "profile-header", "variant": "cover" },
        { "type": "profile-event-dates", "showType": true }
      ],
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "Détails", "en": "Details" },
          "sections": [
            { "type": "profile-about" },
            { "type": "profile-organizer" },
            { "type": "profile-map", "zoom": 15 }
          ]
        }
      ]
    }
  }
}
```

**Système de tabs**:
- Chaque tab génère une route: `/profil/:slug/{tabId}`
- Les sous-routes permettent des pages de détail: `/profil/:slug/news/:newsId`
- `condition` contrôle l'affichage selon le type d'entité ou les permissions

**Onglet « Organisations partenaires » (`relationType: "organizations"`)** :
L'onglet affichant les organisations partenaires doit être placé sous `profiles.organizations` (pas `projects`). Il repose sur le cas `"organizations"` de `useRelatedEntities` qui n'est accessible que si `isOrganization(entity)` est vrai. En config `config.prod.tiers-lieux.json`, le tab est déclaré avec `"id": "organizations"` et `"relationType": "organizations"` directement dans `profiles.organizations.tabs`.

**Hiérarchie de configuration**:
1. Configuration spécifique au type (`organizations`, `events`, etc.)
2. Si absente, fallback sur `default`
3. Si `default` absente, configuration hardcodée dans ProfilePage

## Flux d'exécution complet

1. **URL**: Utilisateur accède à `/profil/mon-organisation`
2. **Route matching**: React Router match la route `profil/:slug` du module profil
3. **Loader SSR** (côté serveur uniquement):
   - Appel API `entityBySlug(slug)`
   - Détection du tab actif depuis l'URL
   - Pre-fetch des données de l'entité ET du tab actif (ex: news)
4. **ProfilePage**:
   - Détection du type d'entité via `entity.getEntityType()`
   - Récupération de la config profil depuis `siteConfig.profiles[type]`
   - Injection dans ProfileEntityProvider
5. **ProfileRenderer / ProfileTemplateDynamic**:
   - Récupération entity + config via `useProfileEntity()`
   - Rendu des sections globales et des tabs via React Router Outlet
6. **Sections individuelles**:
   - Accès à l'entité typée via `useProfileEntity()`
   - Utilisation des type guards si nécessaire
   - Formatage des données via `useFormatProfileEntity()`

## Hooks principaux

Le module profil expose de nombreux hooks specialises :

| Hook | Fichier | Usage |
|------|---------|-------|
| `useProfileEntity` | `hooks/useProfileEntity.tsx` | Accès à l'entité typée depuis le contexte |
| `useFormatProfileEntity` | `hooks/useFormatProfileEntity.tsx` | Formatage des données pour l'affichage |
| `useProfilPermissions` | `hooks/useProfilPermissions.ts` | Permissions du profil courant |
| `useEntityMutation` | `hooks/useEntityMutation.tsx` | Mutations CRUD **génériques** (create/edit) — remplace `useAddPoi`/`useUpdatePoi`/`useAddTiersLieu`/`useEditTiersLieu`/`useOrganizationMutations`/`useProjectMutations` |
| `usePoiEquipementMatches` | `hooks/usePoiEquipementMatches.ts` | Détection doublons POI par adresse/type (debounce 400 ms) |
| `useMembershipQuery` | `hooks/useMembershipQuery.tsx` | Query membership |
| `useMembersQuery` | `hooks/useMembersQuery.tsx` | Query membres |
| `useProfileMutations` | `hooks/useProfileMutations.tsx` | Mutations profil (edit, upload) |
| `useRelatedEntities` | `hooks/useRelatedEntities.tsx` | Entités liées (projets, events, poi, organisations partenaires) |
| `useProfileSetup` | `hooks/useProfileSetup.ts` | Setup initial du profil |
| _(mutations relationnelles)_ | `actions/mutations/` | follow / friend / join / leave — voir [Système d'actions](#système-dactions-entity-actions) |

### `useRelatedEntities` — détail

```ts
// types.ts
export type RelationType = "organizations" | "projects" | "events" | "poi";

export interface UseRelatedEntitiesResult {
  entities: (Organization | Project | Event | Poi)[];
  // ...
}
```

Le hook `useRelatedEntities(entity, relationType, params?)` gère quatre `case` dans son switch :

| `relationType` | Condition sur `entity` | Appel API |
|---|---|---|
| `"projects"` | `isOrganization(entity)` | `entity.getProjects(queryParams)` |
| `"events"` | `isOrganization` ou `isProject` | `entity.getEvents(queryParams)` |
| `"poi"` | `isOrganization(entity)` | `entity.getPois(queryParams)` |
| `"organizations"` | `isOrganization(entity)` | `entity.searchCostum({ searchType: ["organizations"], filters: { ["links.members." + entity.id]: { $exists: true } }, count: true, countType: ["organizations"], notSourceKey: true, ... })` |

Le cas `"organizations"` remonte les **organisations partenaires** : les entités `Organization` dont le champ `links.members` contient l'id de l'organisation courante (c'est-à-dire les organisations dont la courante est membre). Il n'existe pas de méthode dédiée dans le SDK, d'où le recours à `searchCostum` avec un filtre MongoDB.

> `UseRelatedEntitiesResult.entities` est typé `(Organization | Project | Event | Poi)[]` — l'union inclut donc `Organization` depuis l'ajout de ce cas.

**Note schéma** : `ProfileRelatedSectionSchema.relationType` dans `schema.ts` énumère `["organizations", "projects", "events", "poi"]` — `"organizations"` est validé par le schéma Zod, géré par `mapRelationType`/`getEmptyTitle` dans `ProfileRelated.tsx`, et utilisé en config (`config.prod.tiers-lieux.json`).

---

## Formulaires costum (tiers-lieu & équipement sportif)

> **Refonte config-driven (branche `feat/costum-scope`).** Les deux formulaires costum — création de
> **tiers-lieu** et de **POI équipement sportif** — ne reposent plus sur des composants ni des schémas Zod
> dédiés (`AddTiersLieuxModal`/`TiersLieuxForm`/`EditTiersLieuxModal`, `tiersLieuxSchema`, `tiersLieuxMapping`,
> les hooks `useAddTiersLieu`/`useEditTiersLieu`) : tout cela a été **supprimé** de ce module. Chaque costum est
> désormais décrit par **un seul document de données** (`CostumFormSchema`) que `compileCostumSchema` transforme
> en descripteur + spec de modale, rendus par la modale générique unique **`EntityFormModal`**. Le mécanisme
> complet (WIDGET_DEFAULTS, codecs, `enumFrom`, traductions `{fr,en}` inline, table runtime, déclaration en
> config globale `config.costumForms`) est documenté dans **[Module formEngine](28-module-formengine.md)** —
> cette section ne couvre que ce qui est spécifique au module profil.

### Où vit un costum

```
src/modules/profil/forms/costum/<id>/
  schema.ts   # le document CostumFormSchema (champs + widgets + sections + chrome + i18n inline) — LA source
  fns.ts      # code irréductible registré PAR CLÉ : payloadFn, scope, defaults structurés, slots, options dynamiques
  spec.ts     # EntityModalSpec = compileCostumSchema(schema), s'auto-enregistre dans la table runtime costumFormRegistry
```

`<id>` ∈ `{ tiers-lieux, equipements-sportifs }`. Ajouter un 3ᵉ costum = copier un dossier — ou poser le document
directement dans `config.costumForms` **sans aucun fichier TS** — cf. [formEngine § recette d'ajout](28-module-formengine.md).

### Logique métier irréductible (registrée par clé)

Le document ne porte que des **clés string** ; le code correspondant est enregistré dans `fns.ts` (pattern
`registerPayloadFn`/`registerScopeFn`/`registerOptions`/slots) :

- **tiers-lieu** — `tl:payload` : merge des `tags` costum (`config.costum.mainTag`) via `Set`, sans dédoublonner
  ni écraser les tags existants — un seul `organization.save()`, l'image `profil_avatar` routée dans le même
  aller-retour. Codec du widget `openingHours` (`openingHours:read/write`, jours `Mo…Su` schema.org).
  `enumFrom:"tl:years"` : les années d'ouverture sont calculées au runtime (et non figées dans le JSON).
  `buildTiersLieuxPayload`/`getDefaultTiersLieuxValues` survivent ici (registrés), et non plus comme util séparé.
- **équipement sportif** — `poi:scope` (création scopée `me.costum(slug)`), `poi:emptyDefaults` (défauts
  structurés), slots `parentInfo`/`poiDoublons`, `image:profilUrl`, nettoyage des URLs vides.

### Mutation : `useEntityMutation` générique

Les anciens hooks par entité (`useAddTiersLieu`, `useEditTiersLieu`, `useAddPoi`, `useUpdatePoi`) sont remplacés
par le couple **`runEntityMutation` (cœur pur, testable) + `useEntityMutation` (hook React)**
(`src/modules/profil/hooks/useEntityMutation.tsx`) : il construit le payload via le pipeline READ/WRITE, exécute
le `payloadFn` registré (ex. `tl:payload`), crée (`scope.X(payload).save()`) ou édite (`submitEntityEdit`),
invalide React Query puis navigue. La byte-parité des defaults/payloads est figée par
`tiers-lieux.configDriven.test`, `costum/*/fns.test.ts`, `costum/*/spec.test.ts` et `useEntityMutation.test.ts`.

---

### Édition inline d'une propriété `serverData` (pattern `updateField` + `refresh`)

Pour éditer une **propriété simple** de l'entité (hors formulaire de création/édition complet), le pattern est :

1. **Lecture** réactive : `useReactiveProperty(entity.serverData, "<champ>")` (Proxy réactif du SDK).
2. **Écriture** : `entity.updateField("<champ>", value)` (équivalent React du `path2Value` legacy ; `$set` du champ).
3. **Refresh** : dans `onSuccessCallback`, `await entity.refresh()` — re-fetch qui met à jour le `serverData` réactif → re-render (cf. `useProfileMutations.useUploadProfileBanner`). ⚠️ **Ne pas** faire `entity.serverData.x = …` : ESLint `react-hooks/immutability` interdit de muter une prop.
4. **Gate** : `useProfilPermissions(entity).canEditProfile` (édition réservée aux admins du lieu).
5. **Mutation** : `useMutationWithToast({ mutationFn, successKey, errorKey, namespace: "modules/profil", onSuccessCallback })`.
6. Modale **montée conditionnellement** (`{isOpen && <Dialog open …/>}`) → état frais à chaque ouverture.

**Instance concrète — éditeur des outils du lieu (`ourTools`).** Section « Nos outils » de `ProfileTiersLieuxInfo` : bouton « Modifier » (gaté `canEditProfile`) → `OurToolsEditDialog`. La donnée `entity.serverData.ourTools` = `{ [catégorie]: [{name, url?}] }` (catégorie ∈ `TOOLS_MAP`, 11 clés alignées sur le legacy `co2/views/pod/yourTools.php`). Helpers purs `parseRows`/`rowsToOurTools` dans `sections/custom/toolsMap.ts` (testés).

**⚠️ Gotchas `updateField`** (à connaître pour tout champ objet/array) :
- **Objet vide `{}` → 500.** En `application/x-www-form-urlencoded`, un objet vide n'émet **aucun** paramètre `value` → `$_POST["value"]` undefined côté backend. La lib gère l'array vide (`[]` → `""`) mais **pas** l'objet vide. → envoyer **`null`** ($unset) quand la valeur est vide : `updateField("champ", Object.keys(v).length ? v : null)`.
- **`$set` remplace tout le champ.** Un éditeur qui reconstruit l'objet à partir de ses seules clés connues **efface** les clés inconnues présentes en base (le legacy, lui, les préserve). → les recopier depuis la valeur brute avant le merge.

---

### Condition d'auth sur les tabs

Depuis la branche `review`, les tabs de profil supportent une `condition.auth` en config JSON :

```json
{
  "id": "mes-actions",
  "label": { "fr": "Mes actions" },
  "condition": {
    "auth": "required"
  }
}
```

Valeurs : `"required"` (connecté seulement), `"anonymous"` (déconnecté seulement), `"any"` (tous). Évalué via `useVisibility()` du système de visibilité.

---

## Système d'actions (entity-actions)

Le système d'actions est **config-driven** : un tableau de configuration déclaratif définit toutes les actions disponibles, que les hooks du module assemblent et filtrent selon les permissions.

> **À ne pas confondre.** Cette section couvre les **mutations relationnelles** appliquées à une entité
> existante (follow, join, leave, friend…) via la factory `createEntityMutation` (`actions/mutations/`). La
> **création / édition** d'entités (citoyen, orga, projet, event, POI, costums) passe par un système distinct,
> `useEntityMutation` (`hooks/useEntityMutation.tsx`) piloté par les descripteurs/specs — cf.
> [Formulaires costum](#formulaires-costum-tiers-lieu--équipement-sportif) et
> [Module formEngine](28-module-formengine.md).

### Architecture

```
actions/
├── config/
│   ├── entity-actions.ts   # ENTITY_ACTION_CONFIG — configuration déclarative des actions
│   ├── member-actions.ts   # Configuration des actions membres (promote, remove, etc.)
│   └── icons.ts            # ActionIconKey → mapping icône Lucide
├── hooks/
│   ├── useEntityActions.tsx         # Routeur principal : délègue selon type d'entité
│   ├── useUserEntityActions.tsx     # Actions User (ami, follow, message)
│   ├── useOrgEntityActions.tsx      # Actions Organisation (follow, join, leave)
│   ├── useProjectEntityActions.tsx  # Actions Projet (follow, join, leave)
│   ├── useEventEntityActions.tsx    # Actions Événement (follow, register)
│   └── useAdminActions.tsx          # Actions admin (promote, demote, remove)
├── mutations/
│   ├── core.ts           # Factories createEntityMutation + createUserMutation
│   ├── friend.ts         # useFollowEntity, useUnfollowEntity, useFriendRequest, etc.
│   ├── member.ts         # useLeaveMember, useJoinRequest, useAcceptMember, etc.
│   └── relationship.ts   # Mutations de relations sociales
└── builders/
    ├── buildEntityAction.tsx  # Construit un objet EntityAction depuis la config
    └── buildUserAction.tsx    # Construit une action de type user
```

### `ENTITY_ACTION_CONFIG`

Registre déclaratif de toutes les actions supportées :

| Action | Type | Icon | Confirmation |
|---|---|---|---|
| `follow` | follow | userPlus | Non |
| `unfollow` | unfollow | userCheck | Oui |
| `sendFriendRequest` | friend | userPlus | Non |
| `removeFriend` | unfriend | userX | Non |
| `acceptFriendRequest` | accept | check | Non |
| `declineFriendRequest` | decline | x | Non |
| `join` | join | userPlus | Non |
| `leave` | leave | userMinus | Oui (destructive) |
| `cancelJoinRequest` | cancelJoin | x | Oui |
| `adminActions` | admin | shield | Non |

### Factory `createEntityMutation`

```ts
// actions/mutations/core.ts
interface EntityMutationConfig<TParams = void> {
  entityTypes?: EntityType[];
  action: (entity: EntityTypes, params: TParams) => Promise<void>;
  i18n: { successKey: string; errorKey: string };
  invalidate: (entity: EntityTypes, me: User | null) => QueryKey[];
  getSuccessParams?: (entity, params) => Record<string, string>;
  getErrorParams?: (error, entity, params) => Record<string, string>;
}

function createEntityMutation<TParams>(config) → (entity: EntityTypes | null) => UseMutationResult
```

**Ce que la factory encapsule :**
- `useMutationWithToast` (namespace `modules/profil`)
- Validation entity non-null + validation entityType si `config.entityTypes` défini
- Invalidation React Query via `config.invalidate(entity, me)` au succès

**Factory `createUserMutation`** — similaire mais reçoit un `User` en paramètre (ex: actions admin sur un membre spécifique).

### `useEntityActions(entity)`

Hook routeur principal. Détecte le type d'entité et délègue :

```ts
function useEntityActions(entity: EntityTypes | null): EntityActionsResult | null

interface EntityActionsResult {
  actions: EntityAction[];
  layout: "separate-buttons" | "status-dropdown";
}
```

Les hooks par type (`useOrgEntityActions`, `useUserEntityActions`, etc.) filtrent les actions selon les permissions de l'utilisateur courant et construisent les objets `EntityAction` via `buildEntityAction`.

---

## EditModalRegistry

`src/modules/profil/components/profile-edit/EditModalRegistry.tsx` choisit, par **nom logique**, la modale
d'édition à monter pour une entité — en lazy.

**Registry statique** — une seule entrée en dur, la modale générique d'édition de profil :

```ts
const editModalRegistry: Record<string, () => Promise<{ default: ComponentType<EditModalProps> }>> = {
  "edit-profile": () => import("../../forms/EditProfileGenericModal").then(/* wrap */),
  // edit-tiers-lieux / edit-equipements-sportifs : PLUS listés ici — résolus dynamiquement (costumEditThunk).
};
```

**Résolution dynamique des costums (`costumEditThunk`)** — les modales costum ne sont **plus hardcodées**. Un nom
`edit-<id>` (ex. `edit-tiers-lieux`, `edit-equipements-sportifs`) est résolu au vol : le thunk extrait `<id>`,
importe `EntityFormModal` + le loader `registerCostumForms`, récupère la spec via `getCostumModalSpec(id)`
(**table runtime `costumFormRegistry`**, alimentée par les `spec.ts` auto-enregistrés *et* par
`config.costumForms`), puis rend `<EntityFormModal spec=… mode="edit" entity=… />`. Même schéma côté création
dans `components/add/ModalRegistry.tsx` (`costumModalThunk`, noms `add-<id>`). `ensureLazyEditModal` essaie
d'abord le registry statique, puis `costumEditThunk` en repli. Mécanique détaillée :
[Module formEngine § le loader](28-module-formengine.md).

**`resolveEditModalName(entity, config)`** — détermine le nom à monter, **config-driven** :
1. `kind = entity.getEntityType()` (déjà au pluriel : `organizations`, `projects`, …) ;
2. lit `config.profiles[kind].editModal` ; absent → `"edit-profile"` (générique) ;
3. si `profiles[kind].editModalMatch` est défini → la modale custom ne s'applique que si `serverData` satisfait
   la condition — objet `{clé: valeur}`, AND implicite sur toutes les clés ; `.includes(valeur)` si
   `serverData[clé]` est un array, sinon `===`. Sinon → `"edit-profile"`.

```jsonc
{ "profiles": { "organizations": {
  "editModal": "edit-tiers-lieux",
  "editModalMatch": { "tags": "TiersLieux" }   // orga taggée TiersLieux → modale costum ; sinon édition générique
} } }
```

**`DynamicEditModal`** — wrapper monté par les headers de profil / `ProfileActions` : appelle
`resolveEditModalName`, `ensureLazyEditModal`, puis rend la modale en `Suspense`. Cache `lazyComponents` pour
éviter les imports dupliqués.

---

## Gestion des membres

### `InviteMemberDialog`

Modale d'invitation par email ou recherche. Supporte :
- Recherche d'utilisateurs existants (autocomplete)
- Invitation par email si non trouvé
- Rôle assignable (member, admin, etc.)

### `MemberManagementDialog`

Modale de gestion d'un membre spécifique. Actions disponibles selon permissions :
- Promouvoir en admin (`useAdminActions`)
- Rétrograder
- Retirer de l'organisation

### `MemberListRenderer`

Liste les membres avec `UserListItem`. Supporte pagination et rôles.

---

## `TabDetailRenderer`

`src/modules/profil/components/TabDetailRenderer.tsx` gère le rendu des pages de détail dans les tabs (ex: `NewsDetailPage` dans le tab "news").

Il lit le paramètre `component` de la sous-route active et rend dynamiquement le composant correspondant. Supporte actuellement `"NewsDetailPage"`.

---

## `ProfileErrorBoundary`

`src/modules/profil/components/ProfileErrorBoundary.tsx` est défini comme `errorElement` sur la route principale `profil/:slug`. Affiche un message d'erreur adapté (profil non trouvé, accès refusé, erreur réseau) sans casser le layout global.

---

---

## Champs de formulaire partagés (`profile-edit/fields/`)

Ce dossier ne contient plus que les champs **spécifiques au domaine profil**, désormais consommés par les
**widgets du moteur générique** (`forms/registerWidgets.tsx`, cf. [Module formEngine](28-module-formengine.md)) et
non plus par des formulaires écrits à la main. `fields/index.ts` exporte : `ImageUploadField`, `FormFieldTags`,
`IconFormField`, `ParentInfoReadonly`, `SelectParent` (+ `TranslatedFormMessage` en standalone).

> Les **primitives génériques** (`FormFieldText`/`Number`/`Switch`/`SelectObject`/`Date`/`CheckboxGroup` de
> `genericFields.tsx`, et `FormFieldUrlList`) ont été **déplacées** vers `src/modules/formEngine/widgets/fields/` :
> elles font maintenant partie de la couche widgets du moteur. Voir [Module formEngine](28-module-formengine.md).

### `ImageUploadField` (`fields/ImageUploadField.tsx`)

Champ contrôlé d'upload d'image avec recadrage intégré (réutilise `ImageCropDialog` du module news). Monté par le
**widget `image`** de `registerWidgets.tsx`.

**Props :**

| Prop | Type | Description |
|------|------|-------------|
| `value` | `File \| null` | Fichier choisi (déjà recadré). Contrôlé. |
| `onChange` | `(file: File \| null) => void` | Callback à chaque changement de fichier. |
| `existingUrl?` | `string` | URL de l'image actuelle (édition), affichée en aperçu tant qu'aucune nouvelle n'est choisie — résolue par la clé `image:profilUrl`. |
| `aspect?` | `number` | Ratio de recadrage imposé (défaut `1` = carré). |
| `shape?` | `"square" \| "circle"` | Forme de l'aperçu. Défaut `"square"`. |
| `label?` / `hint?` | `string` | Label / texte d'aide. |

**Comportement :** sélection par clic ou drag-and-drop (valide `file.type.startsWith("image/")`) → `ImageCropDialog`
au ratio `aspect` → renvoie un `File` recadré (`objectURL` révoqué à chaque changement). Le fichier transite par le
champ `_imageFile`, posé dans le draft SDK sous `profil_avatar` avant `save()` (un seul aller-retour).

### `FormFieldTags` — prop `searchable` (`fields/FormFieldTags.tsx`)

Monté par le **widget `tags`**. Prop `searchable?: boolean` (défaut `true`) : à `false`, le `TagInput` interne
passe en saisie libre (valeurs hors tags existants acceptées, sans autocomplète) — p. ex. pour les types de
partenariat de l'équipement sportif.

### Autres champs domaine

`IconFormField` (sélecteur d'icône), `ParentInfoReadonly` (slot parent en lecture seule), `SelectParent`
(sélection de l'entité parente) et `TranslatedFormMessage` (message de validation traduit) sont également
réutilisés par les widgets / slots costum.

---

## Formulaire POI équipement sportif

> **Costum config-driven.** L'ancien couple `AddPoiEquipementModal` + `PoiEquipementForm` (wizard
> react-hook-form) et le module `components/add/poiEquipement.ts` (constantes, helpers de coercion,
> `createEmptyDefaults`, `addPoiSchema`, hooks `useAddPoi`/`useUpdatePoi`) ont été **supprimés**. L'équipement
> sportif est maintenant un document `CostumFormSchema` sous
> `src/modules/profil/forms/costum/equipements-sportifs/` (`schema.ts` + `fns.ts` + `spec.ts`), rendu par la
> modale générique `EntityFormModal` — cf. [Formulaires costum](#formulaires-costum-tiers-lieu--équipement-sportif)
> et [Module formEngine](28-module-formengine.md). Cette section ne décrit que les parties **spécifiques au
> domaine équipement** qui ont survécu.

### Câblage modale

Le wizard 4 étapes (`general` / `legal` / `structure` / `usage`) et tous ses champs (~50 : `equip_*`, `inst_*`,
`aps_name`, accessibilité PMR / PSHS…) sont déclarés **comme données** dans `equipements-sportifs/schema.ts`. La
modale est résolue par la table runtime via les noms `add-equipements-sportifs` / `edit-equipements-sportifs`
(`costumModalThunk`/`costumEditThunk`, cf. [EditModalRegistry](#editmodalregistry)) — référencés par les configs
(`config.prod.equipements-Sportifs.json`, `config.prod.sport-sante-bien-etre.json`).

### Scope costum (`poi:scope`)

La création est scopée au costum parent. `resolvePoiEquipementScope(entity)` (registré sous la clé `poi:scope`
dans `fns.ts`) déduit le scope depuis `useCocolight().entity` :

```ts
interface PoiEquipementScope {
  parentId: string;        // id de l'entité costum (source : useCocolight().entity.id)
  sourceKey: string;       // slug du costum
  poiType: string;         // type POI SDK
  addressCountry: string;  // code pays (ex. "RE")
}
```

Un fallback `DEFAULT_POI_EQUIPEMENT_SCOPE` (SSBE Réunion : `sourceKey: "equipementsSportifs974"`) ne sert qu'en
l'absence d'entité. La création passe ensuite par `useEntityMutation` (`scope.X(payload).save()`), l'image posée
en `profil_avatar` dans le même aller-retour.

### Détection de doublons — `usePoiEquipementMatches` (`hooks/usePoiEquipementMatches.ts`)

Toujours d'actualité — consommé par le slot `PoiEquipementDoublonsSlot` (`forms/PoiEquipementDoublonsSlot.tsx`)
pendant l'étape `general`. Affiche les équipements existants à la même adresse via le hook canonique
`useSearchQuery` :

- debounce 400 ms sur `postalCode` / `equipTypeName` / `streetAddress` ;
- recherche déclenchée seulement si `postalCode` **et** `equipTypeName` sont remplis (sinon `searchType: null` →
  court-circuit réseau) ;
- `buildPoiMatchFilters(scope, params)` filtre sur `address.postalCode`, `equip_type_name`,
  `address.streetAddress` (si renseignée) et le scope costum (`source.key` / `source.keys` / `parent.{parentId}`) ;
- `POI_DETAIL_FIELDS` : ~50 champs projetés (dont `profilImageUrl`/`profilMediumImageUrl`/`profilThumbImageUrl`)
  pour que `PoiDetailSSBE`/`CardPoiSSBE` s'affichent sans re-fetch ;
- préfixe de clé React Query `"poi-equipement-matches"`, invalidé par `useEntityMutation` après save.

### `EditLocationTab` — coordonnées géo automatiques

`src/modules/profil/components/profile-edit/EditLocationTab.tsx` est désormais le **widget `location`** du moteur
générique (monté par `forms/registerWidgets.tsx`, donc partagé par tiers-lieu, POI et profil). Il injecte
`geo`/`geoPosition` **en même temps que l'adresse** (champs `writeOnly`, cf. `forms/geoTransforms.ts`) à trois
moments :

1. **Sélection de la ville** (code postal unique auto-sélectionné) : pose `geo`/`geoPosition` depuis
   `pc.geo`/`pc.geoPosition` (coordonnées niveau ville).
2. **Sélection du code postal** (liste) : met à jour `geo`/`geoPosition` depuis le code postal choisi.
3. **Sélection de la rue** (API BAN) : affine au numéro — `street.geo = [lon, lat]` →
   `{ "@type": "GeoCoordinates", latitude, longitude }` pour `geo`, `{ type: "Point", coordinates: [lon, lat] }`
   pour `geoPosition`.

---

## Actions et boutons : comportement non connecté

### `ProfileActions` (`components/actions/ProfileActions.tsx`)

Depuis le commit `c8ad1e6`, la barre d'actions du profil affiche un `<LoginButton size="sm" />` (module auth) pour les visiteurs non connectés qui ne sont pas sur leur propre profil :

```tsx
{!isOwnProfile && !isConnected && <LoginButton size="sm" />}
```

Ce bouton remplace l'absence de bouton d'action visible pour un utilisateur anonyme. Il déclenche l'`AuthModal` du module auth (voir [doc/23-module-auth.md](23-module-auth.md)).

### `ActionButtonGroup` (`components/ActionButtonGroup.tsx`)

Les deux composants internes `DynamicModalButton` et `JoinDropdownButton` utilisaient `toast.error(t("Vous devez être connecté"))` lorsqu'un utilisateur non connecté cliquait sur un bouton d'action. Ce comportement a été remplacé par `openLogin()` du hook `useAuthModal` (module auth) :

```ts
// Avant
toast.error(t("Vous devez être connecté"));

// Maintenant
const { openLogin } = useAuthModal();
openLogin();
```

L'utilisateur voit ainsi le formulaire de connexion au lieu d'un simple toast d'erreur. Le mécanisme `useAuthModal` / `AuthModal` est décrit dans [doc/23-module-auth.md](23-module-auth.md).

---

## Récapitulatif

| Module | Type | Routes | Usage |
|--------|------|--------|-------|
| **profil** | `core` | Oui (`/profil/:slug` + tabs dynamiques) | Affichage profils entités (orga/projet/user/poi/event) |

---

## Voir aussi

- [Module Search](07-module-search.md)
- [Module News](09-module-news.md)
- [Permissions](10-permissions.md)
- [Backend & SSR](14-backend-ssr.md)
