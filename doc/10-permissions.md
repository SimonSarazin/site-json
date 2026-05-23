[← Retour à l'index](README.md)

# Système de permissions modulaire

**Sommaire**

- [Système de permissions modulaire](#système-de-permissions-modulaire)
  - [Architecture](#architecture)
  - [Types de base](#types-de-base)
  - [Registre des calculateurs](#registre-des-calculateurs)
  - [Hook générique `usePermissions`](#hook-générique-usepermissions)
  - [Créer des permissions pour un module](#créer-des-permissions-pour-un-module)
  - [Permissions du module Profil](#permissions-du-module-profil)
  - [Permissions du module News](#permissions-du-module-news)
  - [Permissions du module Cagnotte](#permissions-du-module-cagnotte)
  - [Permissions du module CoForm](#permissions-du-module-coform)
  - [Hook rétrocompatible `useUserPermissions`](#hook-rétrocompatible-useuserpermissions)
  - [Avantages de l'architecture modulaire](#avantages-de-larchitecture-modulaire)
  - [Type helper `PermissionsResult`](#type-helper-permissionsresult)
  - [Voir aussi](#voir-aussi)

---

Le système de permissions de SiteForge est conçu pour être **extensible par module**. Chaque module peut enregistrer ses propres calculateurs de permissions sans modifier le code central.

## Architecture

```
src/lib/permissions/
├── types.ts           # Interfaces PermissionContext, PermissionCalculator
├── registry.ts        # Registre central (Map) des calculateurs
├── usePermissions.ts  # Hook générique pour calculer les permissions
└── index.ts           # Exports publics
```

**Principe** : Chaque module enregistre un calculateur dans un **registre central** via `registerPermissions()`. Le hook `usePermissions()` agrège les résultats des calculateurs demandés.

## Types de base

```ts
// src/lib/permissions/types.ts
import type { EntityTypes, User } from "@communecter/cocolight-api-client";

/**
 * Contexte passé aux calculateurs de permissions
 */
export interface PermissionContext {
  entity: EntityTypes | null;  // Entité concernée
  me: User | null;             // Utilisateur connecté
  data?: Record<string, unknown>; // Données additionnelles (news, etc.)
}

/**
 * Interface pour un calculateur de permissions
 */
export interface PermissionCalculator<T = Record<string, unknown>> {
  namespace: string;           // ex: "profil", "news"
  calculate: (context: PermissionContext) => T;
}
```

## Registre des calculateurs

```ts
// src/lib/permissions/registry.ts
const calculators = new Map<string, PermissionCalculator>();

/**
 * Enregistre un calculateur de permissions pour un module
 */
export function registerPermissions<T>(calculator: PermissionCalculator<T>): void {
  if (calculators.has(calculator.namespace)) {
    console.warn(
      `[permissions] Calculator "${calculator.namespace}" already registered, overwriting`
    );
  }
  calculators.set(calculator.namespace, calculator as PermissionCalculator);
}

export function getCalculator(namespace: string): PermissionCalculator | undefined {
  return calculators.get(namespace);
}

/**
 * Récupère tous les calculateurs enregistrés
 */
export function getAllCalculators(): Map<string, PermissionCalculator> {
  return calculators;
}

export function hasCalculator(namespace: string): boolean {
  return calculators.has(namespace);
}

/** @internal — utilisé uniquement dans les tests */
export function _resetForTesting(): void {
  calculators.clear();
}
```

## Hook générique `usePermissions`

```ts
// src/lib/permissions/usePermissions.ts
export function usePermissions<T extends Record<string, unknown>>(
  namespaces: string[],
  entity: EntityTypes | null,
  data?: Record<string, unknown>
): T {
  const { me } = useCocolight();

  return useMemo(() => {
    const context: PermissionContext = { entity, me, data };
    const result: Record<string, unknown> = {};

    for (const ns of namespaces) {
      const calculator = getCalculator(ns);
      if (calculator) {
        result[ns] = calculator.calculate(context);
      } else {
        console.warn(`[permissions] No calculator registered for namespace "${ns}"`);
        result[ns] = {};
      }
    }

    return result as T;
  }, [entity, me, data, namespaces]);
}
```

**Usage** :

```ts
// Demander plusieurs namespaces
const { profil, news } = usePermissions<{
  profil: ProfilPermissions;
  news: NewsPermissions;
}>(["profil", "news"], entity, { news: currentNews });

// Utiliser les permissions
if (profil.canEditProfile) { /* ... */ }
if (news.canAddNews) { /* ... */ }
```

## Créer des permissions pour un module

**Étape 1 : Définir les types**

```ts
// src/modules/mymodule/permissions/types.ts
export interface MyModulePermissions {
  canDoSomething: boolean;
  canDoOther: boolean;
}
```

**Étape 2 : Définir les valeurs par défaut**

```ts
// src/modules/mymodule/permissions/defaults.ts
export const DEFAULT_PERMISSIONS: MyModulePermissions = {
  canDoSomething: false,
  canDoOther: false,
};
```

**Étape 3 : Créer le(s) calculateur(s)**

```ts
// src/modules/mymodule/permissions/calculators/main.ts
import type { MyModulePermissions } from "../types";
import { DEFAULT_PERMISSIONS } from "../defaults";

export function calculateMyPermissions(entity: EntityTypes): MyModulePermissions {
  // Logique de calcul selon le type d'entité
  return {
    canDoSomething: entity.userContext?.isAdmin ?? false,
    canDoOther: true,
  };
}
```

**Étape 4 : Enregistrer dans le registre**

```ts
// src/modules/mymodule/permissions/register.ts
import { registerPermissions } from "@/lib/permissions";
import type { PermissionContext } from "@/lib/permissions";
import type { MyModulePermissions } from "./types";
import { DEFAULT_PERMISSIONS } from "./defaults";
import { calculateMyPermissions } from "./calculators/main";

function calculate(ctx: PermissionContext): MyModulePermissions {
  if (!ctx.entity?.isConnected || !ctx.me?.isConnected) {
    return DEFAULT_PERMISSIONS;
  }
  return calculateMyPermissions(ctx.entity);
}

// Enregistrement automatique à l'import
registerPermissions<MyModulePermissions>({
  namespace: "mymodule",
  calculate,
});
```

**Étape 5 : Créer un hook local (optionnel mais recommandé)**

```ts
// src/modules/mymodule/hooks/useMyModulePermissions.ts
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { usePermissions } from "@/lib/permissions";
import type { MyModulePermissions } from "../permissions";

// Déclenche l'enregistrement du calculateur
import "../permissions/register";

export function useMyModulePermissions(entity: EntityTypes | null): MyModulePermissions {
  const { mymodule } = usePermissions<{ mymodule: MyModulePermissions }>(
    ["mymodule"],
    entity
  );
  return mymodule;
}
```

## Permissions du module Profil

Le module profil enregistre le namespace `"profil"` avec **27 permissions** :

```
src/modules/profil/permissions/
├── types.ts              # ProfilPermissions (27 champs)
├── defaults.ts           # DEFAULT_PROFIL_PERMISSIONS
├── calculators/
│   ├── user.ts           # calculateOwnProfilePermissions, calculateOtherUserPermissions
│   ├── organization.ts   # calculateOrganizationPermissions
│   ├── project.ts        # calculateProjectPermissions
│   ├── event.ts          # calculateEventPermissions
│   └── poi.ts            # calculatePoiPermissions
├── register.ts           # Enregistrement "profil"
└── index.ts              # Exports
```

**Interface `ProfilPermissions`** :

| Catégorie | Permissions |
|-----------|------------|
| **Profil** | `canEditProfile`, `editProfileReason` |
| **Relations** | `canFollow`, `isFollowing`, `canSendFriendRequest`, `isFriend` |
| **Organisation** | `canRequestMembership`, `canRequestOrganizationAdmin`, `isMember` |
| **Projets** | `isContributor`, `canRequestContributor`, `canRequestProjectAdmin` |
| **Admin** | `isAdmin`, `canRequestPromotion` |
| **Événements** | `isAuthor`, `isParticipant`, `canParticipate` |
| **Invitations** | `isToBeValidated`, `isInviting`, `isInvitingAdmin`, `isAdminPending` |
| **Amis** | `hasSentFriendRequest`, `hasReceivedFriendRequest` |
| **Création** | `canAddOrganization`, `canAddProject`, `canAddEvent`, `canAddPoi` |

**Hook local** :

```ts
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";

const { canEditProfile, isAdmin, isMember } = useProfilPermissions(entity);
```

## Permissions du module News

Le module news enregistre le namespace `"news"` avec **6 permissions** :

```
src/modules/news/permissions/
├── types.ts              # NewsPermissions (6 champs)
├── defaults.ts           # DEFAULT_NEWS_PERMISSIONS
├── calculators/
│   └── news.ts           # calculateNewsPermissions
├── register.ts           # Enregistrement "news"
└── index.ts              # Exports
```

**Interface `NewsPermissions`** :

```ts
export interface NewsPermissions {
  canAddNews: boolean;       // Peut créer une news
  canEditNews: boolean;      // Peut éditer la news courante
  canDeleteNews: boolean;    // Peut supprimer la news courante
  canModerateNews: boolean;  // Peut modérer (admin)
  canEditComment: boolean;   // Peut éditer un commentaire
  canDeleteComment: boolean; // Peut supprimer un commentaire
}
```

**Hook local** :

```ts
import { useNewsPermissions } from "@/modules/news/hooks/useNewsPermissions";

const { canAddNews, canEditNews, canModerateNews } = useNewsPermissions(entity, news);
```

## Permissions du module Cagnotte

Le module cagnotte enregistre le namespace `"cagnotte"`. Contexte attendu dans `data.cagnotte` : un objet `CagnottePermissionData` (action courante, montants, membres, etc.). Voir `src/modules/cagnotte/permissions/types.ts`.

**Hook local** :

```ts
import { useCagnottePermissions } from "@/modules/cagnotte/hooks/useCagnottePermissions";
const { canEditAction, canCandidateToAction, canMarkDone } = useCagnottePermissions(entity, cagnotteData);
```

## Permissions du module CoForm

Le module coform enregistre le namespace `"coform"`. Contexte attendu dans `data.coform` : un objet `CoFormPermissionData` (form, currentAnswer, accessInfo). Retourne `CoFormPermissions` — voir [Module CoForm](21-module-coform.md#permissions).

**Hook local** :

```ts
import { useCoFormPermissions } from "@/modules/coform/permissions";
const { canSubmitAnswer, canViewForm, isConnected } = useCoFormPermissions(entity, formData);
```

---

## Hook rétrocompatible `useUserPermissions`

Pour la rétrocompatibilité, le hook global `useUserPermissions` agrège **tous** les namespaces :

```ts
// src/hooks/useUserPermissions.tsx
import { usePermissions } from "@/lib/permissions";
import "@/modules/profil/permissions/register";
import "@/modules/news/permissions/register";

export type UserPermissions = ProfilPermissions & NewsPermissions;

export function useUserPermissions(
  entity: EntityTypes | null,
  news?: News | null
): UserPermissions {
  const permissions = usePermissions<{
    profil: ProfilPermissions;
    news: NewsPermissions;
  }>(["profil", "news"], entity, { news });

  // Flatten pour rétrocompatibilité
  return {
    ...permissions.profil,
    ...permissions.news,
  };
}
```

**Usage** :

```ts
// Ancien code (toujours fonctionnel)
const { canEditProfile, canAddNews } = useUserPermissions(entity);

// Nouveau code recommandé (plus performant)
const { canEditProfile } = useProfilPermissions(entity);
const { canAddNews } = useNewsPermissions(entity);
```

## Avantages de l'architecture modulaire

| Aspect | Avant | Après |
|--------|-------|-------|
| **Fichier principal** | 434 lignes monolithique | 63 lignes wrapper |
| **Ajouter un module** | Modifier `useUserPermissions` | Créer `permissions/` dans le module |
| **Ajouter un type d'entité** | Modifier `useUserPermissions` | Créer un calculateur |
| **Testabilité** | Difficile (tout couplé) | Facile (fonctions pures isolées) |
| **Couplage** | Fort (tout dans un fichier) | Faible (par module) |
| **Performance** | Calcule tout | Ne calcule que les namespaces demandés |

## Type helper `PermissionsResult`

Le fichier `src/lib/permissions/types.ts` exporte egalement un type helper pour typer les resultats de `usePermissions` :

```ts
/**
 * Type helper pour typer les résultats de usePermissions
 */
export type PermissionsResult<T extends Record<string, unknown>> = T;
```

---

## Voir aussi

- [Module Profil](08-module-profil.md)
- [Module News](09-module-news.md)
- [API & Authentification](11-api-authentification.md)
