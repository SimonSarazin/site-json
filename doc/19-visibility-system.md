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
  - [Tabs de profil](#tabs-de-profil)
  - [Items du FloatingActionButton](#items-du-floatingactionbutton)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

Le système de visibilité (`src/lib/visibility/`) permet de déclarer dans la config JSON si un élément UI doit être visible ou masqué selon l'état courant de l'application : statut d'authentification, route active, permissions de l'utilisateur.

Il est composé de trois fichiers :
- `schema.ts` — schéma Zod + type TypeScript
- `useVisibility.ts` — hooks React
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

Ce comportement est géré via le hook `useHydrated()` interne.

---

## Usages dans la config JSON

### Tabs de profil

Les onglets de profil acceptent un champ `condition.auth` :

```json
{
  "profiles": {
    "organizations": {
      "tabs": [
        {
          "id": "about",
          "label": { "fr": "À propos", "en": "About" }
        },
        {
          "id": "private-tab",
          "label": { "fr": "Privé" },
          "condition": {
            "auth": "required"
          }
        },
        {
          "id": "public-only",
          "label": { "fr": "Pour les visiteurs" },
          "condition": {
            "auth": "anonymous"
          }
        }
      ]
    }
  }
}
```

Le schéma Zod des tabs (`src/modules/profil/schema.ts`) accepte `condition: VisibilityConditionSchema`.

### Items du FloatingActionButton

Les items custom du `FloatingActionButton` (section JSON `floatingActionButton`) acceptent également une `condition` :

```json
{
  "type": "floatingActionButton",
  "items": [
    {
      "label": { "fr": "Ajouter un lieu" },
      "action": "add-tiers-lieux",
      "condition": {
        "auth": "required",
        "permissions": ["canAddOrganization"]
      }
    }
  ]
}
```

---

## Voir aussi

- [Architecture](03-architecture.md) — section "Système de visibilité"
- [Module Profil](08-module-profil.md) — condition.auth sur les tabs
- [Permissions](10-permissions.md) — les permissions vérifiables via `condition.permissions`
