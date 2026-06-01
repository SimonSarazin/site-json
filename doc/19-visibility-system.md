[← Retour à l'index](README.md)

# Système de visibilité

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Schéma `VisibilityCondition`](#schéma-visibilitycondition)
- [Hooks](#hooks)
  - [`useVisibility`](#usevisibility)
  - [`useVisibilityList`](#usevisibilitylist)
- [Comportement SSR](#comportement-ssr)
- [Usages dans la config JSON](#usages-dans-la-config-json)
  - [FloatingActionButton (bouton global)](#floatingactionbutton-bouton-global)
  - [Items custom du dropdown "Ajouter" (profil)](#items-custom-du-dropdown-ajouter-profil)
  - [NavItem.roles (navigation)](#navitemroles-navigation)
  - [Tabs de profil (ProfileTabConditionSchema)](#tabs-de-profil-profiletabconditionschema)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le système de visibilité (`src/lib/visibility/`) permet de déclarer dans la config JSON si un élément UI doit être visible ou masqué selon l'état courant de l'application : statut d'authentification, route active, permissions de l'utilisateur.

Il est composé de trois fichiers :
- `schema.ts` — schéma Zod + type TypeScript (`VisibilityConditionSchema`)
- `useVisibility.ts` — hooks React (`useVisibility`, `useVisibilityList`)
- `index.ts` — re-export public

---

## Schéma `VisibilityCondition`

```ts
// src/lib/visibility/schema.ts
export const VisibilityConditionSchema = z.object({
  auth: z.enum(["required", "anonymous", "any"]).optional(),
  routes: z.array(z.string()).optional(),
  excludeRoutes: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
}).optional();

export type VisibilityCondition = z.infer<typeof VisibilityConditionSchema>;
```

| Champ | Valeurs | Sémantique |
|---|---|---|
| `auth` | `"required"` | Visible uniquement si l'utilisateur est connecté |
| `auth` | `"anonymous"` | Visible uniquement si l'utilisateur n'est PAS connecté |
| `auth` | `"any"` ou absent | Visible pour tous |
| `routes` | `["/profil/*", "/about"]` | Whitelist de routes. Visible uniquement sur ces routes. Supporte `*` en fin de segment. |
| `excludeRoutes` | `["/admin/*"]` | Blacklist de routes (prioritaire sur `routes`). |
| `permissions` | `["canAddOrganization"]` | Toutes ces permissions doivent être `true` (AND). |

**Toutes les clés sont optionnelles.** Un objet vide ou une condition absente signifie "visible pour tous". Les clés présentes sont combinées avec AND.

---

## Hooks

### `useVisibility`

```ts
import { useVisibility } from "@/lib/visibility";

function MyButton() {
  const visible = useVisibility({ auth: "required" });
  if (!visible) return null;
  return <button>Action réservée aux connectés</button>;
}
```

```ts
// Combinaisons possibles
useVisibility(undefined)                    // → toujours true
useVisibility({ auth: "required" })         // → true si connecté
useVisibility({ auth: "anonymous" })        // → true si non connecté
useVisibility({ routes: ["/profil/*"] })    // → true sur /profil/... uniquement
useVisibility({ excludeRoutes: ["/admin"] }) // → false sur /admin uniquement
useVisibility({
  auth: "required",
  permissions: ["canAddOrganization"],
})                                          // → true si connecté ET permission
```

### `useVisibilityList`

Évalue plusieurs conditions en une seule passe. Utile pour éviter d'appeler `useVisibility` dans un `.map()` (règle des hooks).

```ts
import { useVisibilityList } from "@/lib/visibility";

const conditions = [
  { auth: "required" },
  { auth: "anonymous" },
  undefined,
];

const [showForConnected, showForGuest, alwaysShow] = useVisibilityList(conditions);
```

Retourne un tableau `boolean[]` aligné avec le tableau de conditions d'entrée.

---

## Comportement SSR

Avant hydration côté client :

- Si la condition dépend de `auth` ou `permissions` → l'élément est **masqué** (retourne `false`). Cela évite un flash de contenu privé lors du rendu SSR puis de l'hydratation.
- Si seules `routes`/`excludeRoutes` sont utilisées → le pathname est stable entre SSR et client, la condition est évaluée normalement.

Ce comportement est géré via le hook `useHydrated()` interne. La variable `dependsOnUser` dans `evaluateCondition` détecte si la condition nécessite `auth !== "any"` ou des permissions non vides, et retourne `false` immédiatement si `!ctx.hydrated`.

---

## Usages dans la config JSON

### FloatingActionButton (bouton global)

La config `floatingActionButton` de `SiteConfig` est un **bouton unique** (non un tableau). Son champ optionnel `condition` contrôle la visibilité de l'ensemble du bouton via `useVisibility`.

Schema (`src/types/site-schema.ts`) :

```ts
floatingActionButton: z.object({
  enabled: z.boolean(),
  modal: z.enum(["add-organization", "add-project", "add-event", "add-poi",
                  "add-tiers-lieux", "register-cyber-reunion", "json-form"]),
  label: LocalizedString,
  icon: z.string().optional(),
  position: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]),
  condition: VisibilityConditionSchema,
}).optional()
```

Exemple JSON — bouton affiché uniquement pour les utilisateurs connectés avec la permission `canAddOrganization` :

```json
{
  "floatingActionButton": {
    "enabled": true,
    "modal": "add-tiers-lieux",
    "label": { "fr": "Ajouter un lieu" },
    "condition": {
      "auth": "required",
      "permissions": ["canAddOrganization"]
    }
  }
}
```

Le composant `FloatingActionButton` (`src/components/layout/FloatingActionButton.tsx`) appelle `useVisibility(condition)` et retourne `null` si la condition n'est pas satisfaite. Il est chargé laziment depuis `RootLayout`.

### Items custom du dropdown "Ajouter" (profil)

Dans la section `profile-header` (variante `"complete"`), le champ `addConfig.custom` permet de définir des items personnalisés dans le dropdown "Ajouter une entité". Chaque item custom accepte une `condition` de type `VisibilityConditionSchema`.

Schema (`src/modules/profil/schema.ts`) :

```ts
custom: z.array(z.object({
  modalKey: z.string(),
  label: LocalizedString,
  icon: z.string().optional(),
  condition: VisibilityConditionSchema,
})).optional()
```

Exemple JSON :

```json
{
  "type": "profile-header",
  "variant": "complete",
  "addConfig": {
    "custom": [
      {
        "modalKey": "add-tiers-lieux",
        "label": { "fr": "Ajouter un tiers-lieu" },
        "icon": "building-2",
        "condition": {
          "auth": "required",
          "permissions": ["canAddOrganization"]
        }
      }
    ]
  }
}
```

Le composant `AddEntityDropdown` (`src/modules/profil/components/action-buttons/AddEntityDropdown.tsx`) évalue toutes les conditions en une seule passe via `useVisibilityList` pour respecter les règles des hooks (pas d'appel dans un `.map()`).

### NavItem.roles (navigation)

Les items de navigation (`NavItem`, `EnhancedNavItem`) exposent un champ `roles: string[]` distinct du système `VisibilityCondition`. Il s'agit d'un filtrage RBAC simple : l'item n'est rendu que si l'utilisateur possède au moins un des rôles listés.

```ts
// src/types/site-schema.ts
roles: z.array(z.string()).optional(), // visibilité RBAC
```

Ce filtrage est appliqué directement dans les composants header (`SiteHeader2.tsx`, `DefaultHeader.tsx`) via :

```ts
if (item.roles && item.roles.length) {
  const userRoles = me?.serverData?.roles || {};
  if (!item.roles.some(r => userRoles[r] === true)) return null;
}
```

**Différence clé avec `VisibilityCondition`** : `roles` utilise une logique OR (au moins un rôle suffit), n'est pas hydration-aware (pas de masquage SSR explicite), et ne supporte ni filtrage par route ni liste de permissions granulaires.

Exemple JSON :

```json
{
  "nav": [
    {
      "label": { "fr": "Administration" },
      "path": "/admin",
      "roles": ["admin", "moderator"]
    }
  ]
}
```

### Tabs de profil (ProfileTabConditionSchema)

Les onglets de profil utilisent un schéma de condition **différent** de `VisibilityConditionSchema` : `ProfileTabConditionSchema` (`src/modules/profil/schema.ts`). Ce schéma est propre au module profil et étend les capacités de filtrage.

```ts
export const ProfileTabConditionSchema = z.object({
  entityTypes: z.array(ProfileTypeSchema).optional(),
  permissions: z.array(z.string()).optional(),
  userContext: z.enum(["own", "other", "any"]).optional(),
  auth: z.enum(["required", "anonymous", "any"]).optional(),
}).optional();
```

| Champ | Sémantique |
|---|---|
| `auth` | Même sémantique que dans `VisibilityCondition` (`"required"` / `"anonymous"` / `"any"`) |
| `permissions` | ⚠️ **NON IMPLÉMENTÉ** — voir note ci-dessous |
| `entityTypes` | L'onglet n'apparaît que pour certains types d'entité (`"organizations"`, `"projects"`, `"events"`, `"citoyens"`, `"poi"`) |
| `userContext` | `"own"` = uniquement sur son propre profil, `"other"` = sur le profil d'autrui, `"any"` = toujours |

Le filtre s'applique côté client après hydration de `me` pour éviter les mismatches SSR (cf. `ProfileTemplateDynamic`).

> ⚠️ **`ProfileTabCondition.permissions` est déclaré dans le schéma Zod mais N'EST PAS évalué au runtime.**
>
> Dans `ProfileTemplateDynamic.tsx`, la vérification des permissions est commentée en attente d'implémentation :
>
> ```ts
> // TODO: Implémenter la vérification des permissions
> // if (tab.condition.permissions) { ... }
> ```
>
> **Conséquence concrète** : un tab dont la `condition` ne contient que `permissions` restera **toujours visible**, quelle que soit la permission réelle de l'utilisateur. Seuls `auth`, `entityTypes` et `userContext` sont effectivement pris en compte.
>
> **Contraste avec `VisibilityCondition.permissions`** : dans le système global (sections, boutons, dropdown "Ajouter"), le champ `permissions` de `VisibilityConditionSchema` est, lui, **réellement évalué** par `useVisibility.ts` / `evaluateCondition` via le registre de permissions. Ce n'est donc pas une limitation du système de visibilité en général, mais uniquement du filtre de tabs de profil (`ProfileTemplateDynamic`).
>
> Ne pas s'appuyer sur `ProfileTabCondition.permissions` pour contrôler l'accès aux onglets tant que le TODO n'est pas levé.

Exemple JSON :

```json
{
  "profiles": {
    "organizations": {
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "À propos", "en": "About" },
          "sections": []
        },
        {
          "id": "private-tab",
          "label": { "fr": "Privé" },
          "sections": [],
          "condition": {
            "auth": "required"
          }
        },
        {
          "id": "admin-tab",
          "label": { "fr": "Gestion" },
          "sections": [],
          "condition": {
            "auth": "required",
            "userContext": "own",
            "entityTypes": ["organizations"]
          }
        }
      ]
    }
  }
}
```

---

## Voir aussi

- [Architecture](03-architecture.md) — section "Système de visibilité"
- [Module Profil](08-module-profil.md) — condition sur les tabs et le dropdown d'ajout
- [Permissions](10-permissions.md) — les permissions vérifiables via `condition.permissions`
