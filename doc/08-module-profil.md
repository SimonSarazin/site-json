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
│   ├── add/                        // Modales d'ajout d'entités
│   │   ├── AddEventModal.tsx
│   │   ├── AddOrganizationModal.tsx
│   │   ├── AddPoiModal.tsx
│   │   ├── AddProjectModal.tsx
│   │   ├── JsonFormModal.tsx
│   │   ├── ModalRegistry.tsx
│   │   ├── RegisterCyberReunionModal.tsx
│   │   └── index.ts
│   ├── members/                    // Gestion des membres
│   │   ├── ConfirmationDialog.tsx
│   │   ├── InviteMemberDialog.tsx
│   │   ├── MemberListRenderer.tsx
│   │   └── MemberManagementDialog.tsx
│   ├── profile-edit/               // Édition de profil
│   │   ├── EditBasicInfoTab.tsx
│   │   ├── EditContactTab.tsx
│   │   ├── EditEventDatesTab.tsx
│   │   ├── EditLocationTab.tsx
│   │   ├── EditProfileModal.tsx
│   │   ├── EditScheduleTab.tsx
│   │   ├── EditSocialTab.tsx
│   │   ├── ProfileEditDropdown.tsx
│   │   ├── ProfileImageUpload.tsx
│   │   └── fields/                 // Champs de formulaire
│   │       ├── FormFieldDescription.tsx
│   │       ├── FormFieldName.tsx
│   │       ├── FormFieldPublic.tsx
│   │       ├── FormFieldSelect.tsx
│   │       ├── FormFieldShortDescription.tsx
│   │       ├── FormFieldSlug.tsx
│   │       ├── FormFieldTags.tsx
│   │       ├── FormFieldType.tsx
│   │       ├── FormFieldUrl.tsx
│   │       ├── IconFormField.tsx
│   │       ├── ParentInfoReadonly.tsx
│   │       ├── SelectParent.tsx
│   │       ├── TextareaFormField.tsx
│   │       ├── TranslatedFormMessage.tsx
│   │       └── index.ts
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
├── actions/
│   ├── index.ts                    // Barrel
│   └── mutations/                  // Factories de mutations (createEntityMutation, etc.)
│       ├── core.ts                 // Factory générique createEntityMutation
│       ├── friend.ts               // Mutations amis (add/accept/decline/remove)
│       ├── member.ts               // Mutations members (join/leave/promote/demote)
│       └── relationship.ts         // Mutations relations entité↔entité
├── hooks/
│   ├── mutationUtils.ts            // Utilitaires pour mutations
│   ├── useAddMutations.tsx         // Mutations d'ajout d'entités
│   ├── useCommentVotes.tsx         // Votes sur commentaires
│   ├── useConfirmationDialog.tsx   // Dialog de confirmation
│   ├── useEditTiersLieu.tsx        // Mutation édition tiers-lieu (entity-oriented)
│   ├── useEntityLabels.tsx         // Labels d'entité
│   ├── useFormatProfileEntity.tsx  // Hook pour formater les données
│   ├── useFriendsQuery.tsx         // Query amis
│   ├── useGetAnwersByFormsQuery.tsx // Query réponses formulaires
│   ├── useMembershipQuery.tsx      // Query membership
│   ├── useMembersQuery.tsx         // Query membres
│   ├── useNewsDetailUrlGenerator.tsx // Générateur URL détail news
│   ├── useOrganizationMutations.tsx // Mutations organisation
│   ├── useProfileEntity.tsx        // Hook pour accéder à l'entité typée
│   ├── useProfileFormData.tsx      // Données formulaire profil
│   ├── useProfileMutations.tsx     // Mutations profil
│   ├── useProfileSetup.ts          // Setup profil
│   ├── useProfilMembersQuery.tsx   // Query membres profil
│   ├── useProfilOrganizationsQuery.tsx // Query organisations
│   ├── useProfilPermissions.ts     // Hook local pour permissions profil
│   ├── useProfilProjectsQuery.tsx  // Query projets
│   ├── useProfilSubscribersQuery.tsx // Query abonnés
│   ├── useProjectMutations.tsx     // Mutations projet
│   ├── useRelatedEntities.tsx      // Entités liées
│   └── useUserStatusBadge.tsx      // Badge statut utilisateur
│   // Note : les anciens hooks useProfilContributorsQuery, useProfilFriendsQuery,
│   // useProfilSubscriptionsQuery, useRelationshipMutations ont été supprimés
│   // (commit 60454d0) — remplacés par les factories de mutations dans actions/.
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
| `profile-related`          | ProfileRelatedSection        | relationType, limit                            | Entités liées (projects, events, poi)     |
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
import i18n from "@/lib/i18n";
import enTranslations from "./i18n/en.json";
import frTranslations from "./i18n/fr.json";

i18n.addResourceBundle("en", "modules/profil", enTranslations);
i18n.addResourceBundle("fr", "modules/profil", frTranslations);
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
| `useAddMutations` | `hooks/useAddMutations.tsx` | Mutations d'ajout d'entités |
| `useMembershipQuery` | `hooks/useMembershipQuery.tsx` | Query membership |
| `useMembersQuery` | `hooks/useMembersQuery.tsx` | Query membres |
| `useProfileMutations` | `hooks/useProfileMutations.tsx` | Mutations profil (edit, upload) |
| `useRelatedEntities` | `hooks/useRelatedEntities.tsx` | Entités liées (projets, events, poi) |
| `useRelationshipMutations` | `hooks/useRelationshipMutations.ts` | Mutations relations (follow, friend) |
| `useProfileSetup` | `hooks/useProfileSetup.ts` | Setup initial du profil |
| `useOrganizationMutations` | `hooks/useOrganizationMutations.tsx` | Mutations organisation |
| `useProjectMutations` | `hooks/useProjectMutations.tsx` | Mutations projet |

---

## Création de Tiers-lieu (modale 5 étapes)

La modale `AddTiersLieuxModal` (`src/modules/profil/components/add/AddTiersLieuxModal.tsx`) permet de créer un tiers-lieu en 5 étapes via un formulaire structuré.

### Composants

- `AddTiersLieuxModal` — Dialog principal, branche sur `useAddTiersLieu()` et délègue le rendu à `TiersLieuxForm`
- `TiersLieuxForm` (`src/modules/profil/components/add/TiersLieuxForm.tsx`) — Formulaire react-hook-form + Zod en 5 onglets :
  1. **Identification** : nom, description courte, type de structure, mode de gestion
  2. **Localisation** : adresse, code postal, localité (via `EditLocationTab`)
  3. **Médias** : logo, photos (upload)
  4. **Contacts & réseaux** : email, téléphone, site web, liens sociaux, URL vidéo
  5. **Horaires & description** : horaires d'ouverture par jour de la semaine, description longue (Markdown)

### Schéma Zod (`tiersLieuxSchema`)

```ts
// src/modules/profil/components/add/TiersLieuxForm.tsx
export const tiersLieuxSchema = z.object({
  name: z.string().min(1),
  shortDescription: z.string().min(1),
  managementType: z.string().min(1),
  email: z.string().email().min(1),
  hours: z.object({ monday: dayHoursSchema, /* ... 7 jours */ }),
  // ... autres champs optionnels
});
```

### Mapping config → payload API (`tiersLieuxMapping.ts`)

Le fichier `src/modules/profil/utils/tiersLieuxMapping.ts` contient toutes les fonctions de conversion entre les données du formulaire et le format attendu par l'API :

- `buildOpeningHoursPayload(hours)` — convertit `{ monday: { enabled, start, end } }` en `[{ dayOfWeek: "Mo", hours: [{ opens, closes }] }]`
- `buildTiersLieuxPayload(data, parent?)` — construit le payload de création complet
- `entityToTiersLieuxFormData(entity)` — convertit une entité API en données de formulaire (pour l'édition)

Les jours sont mappés avec les codes `Mo/Tu/We/Th/Fr/Sa/Su` (format schema.org).

### Édition de Tiers-lieu

- `EditTiersLieuxModal` (`src/modules/profil/components/edit/EditTiersLieuxModal.tsx`) — même formulaire en mode édition, pré-rempli via `entityToTiersLieuxFormData()`
- `EditModalRegistry` (`src/modules/profil/components/profile-edit/EditModalRegistry.tsx`) — registry lazy des modales d'édition

Le registry permet d'associer un nom logique à une modale chargée en lazy :

```ts
const editModalRegistry: Record<string, () => Promise<{ default: ComponentType<EditModalProps> }>> = {
  "edit-profile": () => import("./EditProfileModal").then(/* wrap */),
  "edit-tiers-lieux": () => import("../edit/EditTiersLieuxModal").then(/* wrap */),
};
```

La fonction `resolveEditModalName(entity, config)` lit `profiles[kind].editModal` depuis la config pour déterminer quel modal ouvrir. Si l'entité correspond au `costum` du site, le modal configuré est utilisé ; sinon le modal générique `"edit-profile"` est appliqué.

### `useEditTiersLieu(organization)`

Mutation d'édition d'une organisation tiers-lieu existante. Pattern entity-oriented :

1. Construit le payload via `buildTiersLieuxPayload(data)`
2. Assigne les champs directement sur `organization.data` (mutation de l'objet SDK)
3. Appelle `organization.save()` pour persister (diff/patch géré par le SDK)
4. Si `data._logoFile` présent → `organization.updateImageProfil({ profil_avatar: file })`

Invalide `PROFIL_QUERY_KEYS.ELEMENT_ABOUT_PREFIX(slug)` après succès.

> Note : depuis le commit `2fb46b8`, la constante a été renommée `QUERY_KEYS` → `PROFIL_QUERY_KEYS` (préfixée par le module pour cohérence avec `CAGNOTTE_QUERY_KEYS`, `COFORM_QUERY_KEYS`, etc.). Type associé : `ProfilQueryKeyType` (via `ReturnType<...>`).

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

`src/modules/profil/components/profile-edit/EditModalRegistry.tsx` implémente un système de modales d'édition lazy par nom logique.

**Registry déclaratif :**

```ts
const editModalRegistry: Record<string, () => Promise<{ default: ComponentType<EditModalProps> }>> = {
  "edit-profile":     () => import("./EditProfileModal"),
  "edit-tiers-lieux": () => import("../edit/EditTiersLieuxModal"),
};
```

**`resolveEditModalName(entity, config)`** — Détermine quel modal ouvrir :
1. Si `entity.serverData.costumSlug !== config.costum?.slug` → `"edit-profile"` (profil générique)
2. Sinon lit `config.profiles[kind].editModal` pour le modal customisé du costum
3. Fallback → `"edit-profile"`

**`DynamicEditModal`** — Wrapper config-driven utilisé par les headers et `ProfileActions` :

```tsx
<DynamicEditModal
  open={editModalOpen}
  onOpenChange={setEditModalOpen}
  entity={entity}
/>
```

Le chargement est lazy via `React.lazy()` + cache dans `lazyComponents` pour éviter les imports dupliqués.

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
