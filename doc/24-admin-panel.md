[← Retour à l'index](README.md)

# Panneau d'administration (AdminPanel)

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Activation et montage](#activation-et-montage)
- [Vues disponibles](#vues-disponibles)
- [Sauvegarde de la configuration](#sauvegarde-de-la-configuration)
- [SectionPicker](#sectionpicker)
- [SECTION_META](#section_meta)
- [ZodAutoForm](#zodautoform)
  - [Champs auto-générés](#champs-auto-générés)
  - [schema-utils.ts](#schema-utilsts)
- [SortableList](#sortablelist)
- [Mise en surbrillance des sections](#mise-en-surbrillance-des-sections)
- [Voir aussi](#voir-aussi)

---

## Vue d'ensemble

`src/components/admin/AdminPanel.tsx` est un panneau d'édition live du JSON de configuration du site. Il s'ouvre via un `Sheet` (drawer) et permet de modifier les pages, sections, en-tête, pied de page et paramètres globaux du site sans rechargement.

Toutes les modifications sont appliquées en temps réel via `setConfig` du `useSite()` hook, puis sauvegardées sur disque via WebSocket HMR (en développement) ou API REST (en production).

---

## Activation et montage

`AdminPanel` est monté dans `RootLayout.tsx` conditionnel à `import.meta.env.DEV` (ou un flag de config). Il n'est jamais inclus dans les bundles de production si correctement tree-shakeable.

Le bouton déclencheur est un `Settings` icon flottant en bas à droite de la page. L'ouverture du `Sheet` injecte également du CSS de surbrillance sur les sections (voir §Mise en surbrillance).

---

## Vues disponibles

Le composant implémente une machine à états via un discriminated union `View` :

| Mode | Contenu |
|---|---|
| `pages` | Liste de toutes les pages avec bouton d'ajout |
| `sections` | Sections de la page courante (réordonnables) |
| `editSection` | Éditeur de props d'une section via ZodAutoForm |
| `addPage` | Formulaire d'ajout de page (path + titre) |
| `header` | Éditeur des champs header (hors nav) |
| `editNavItem` | Éditeur d'un item de navigation |
| `footer` | Éditeur des champs footer (hors columns) |
| `editFooterColumn` | Éditeur d'une colonne footer |
| `settings` | Liste des settings globaux (hors pages/header/footer) |
| `editSetting` | Éditeur d'un setting via ZodAutoForm |

La vue initiale est `sections` sur la page correspondant à l'URL courante.

**Navigation** : `useLocation()` + `useNavigate()` pour synchroniser la vue avec le routing React Router. Un `useEffect` sur `pathname` réinitialise la vue sur `sections` lors d'un changement de page.

**Hiérarchie visuelle** :
- Bouton retour (`ArrowLeft`) pour remonter d'un niveau
- Fil d'Ariane textuel (page → section)

---

## Sauvegarde de la configuration

```ts
async function saveConfig() {
  if (import.meta.hot) {
    // Dev : envoi via Vite HMR WebSocket
    import.meta.hot.send("config-save", config);
    toast.success("Config sauvegardée");
  } else {
    // Prod : API REST
    await fetch("/api/admin/config-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }
}
```

**Mode développement** : le message `"config-save"` est intercepté par le dev-server (`server/dev-server.js`) via `server.ws.on("config-save", ...)` qui écrit le JSON sur disque et déclenche un rechargement HMR du module de config.

**Mode production** : appel `POST /api/admin/config-save` — cet endpoint doit être activé explicitement dans `prod-server.js` (désactivé par défaut pour des raisons de sécurité).

Le bouton "Sauvegarder" est présent dans chaque vue pour faciliter la sauvegarde après chaque modification.

---

## SectionPicker

Composant interne permettant de sélectionner le type d'une nouvelle section à ajouter.

**Interface** :
- Bouton toggle ouvrant un popover avec liste filtrée par recherche texte
- Chaque entrée affiche : miniature, label, description
- Preview étendue au hover sur un panneau fixe à droite (300×180px) avec description longue

**`ADDABLE_SECTIONS`** : dérivé automatiquement de `SectionSchema.options` (le discriminated union Zod de tous les types de sections). Pour chaque option, lit `SECTION_META[type]` pour obtenir label, description et image. Trié alphabétiquement.

---

## SECTION_META

`src/components/admin/section-meta.ts` contient les métadonnées d'affichage pour chaque type de section (label lisible, description, image placeholder).

Structure :

```ts
export interface SectionMeta {
  label: string;
  desc: string;
  image: string; // URL placeholder 300×180
}

const SECTION_META: Record<string, SectionMeta> = {
  hero: { label: "Hero", desc: "Bannière principale avec titre, sous-titre et CTA", image: "..." },
  cards: { label: "Cards", desc: "Grille de cartes avec image, titre et description", image: "..." },
  // ... tous les types de section
};
```

Pour ajouter une nouvelle section au panneau admin :
1. Ajouter le type dans `SectionSchema` (src/types/site-schema.ts)
2. Ajouter son entrée dans `SECTION_META` (section-meta.ts)
3. La section apparaît automatiquement dans `ADDABLE_SECTIONS`

**Sections documentées dans SECTION_META** : hero, cards, gallery, video, cta, faq, testimonials, team, stats, pricing, steps, timeline, accordion, tabs, table, map, newsletter, contactForm, html, markdown, banner, chart, logoCloud, comparison, featureComparison, title, content, blogList, blogPost, loginForm, registerForm, recoverPasswordForm, filters, gridLayout, searchPro, searchProStatic, news, member, socialFeed, eventList, productShowcase, breadcrumb, cookieConsent, hero-tiers-lieux, hero-rezo-la-mer, features-rezo-la-mer, action-buttons-rezo-la-mer, community-rezo-la-mer, cta-rezo-la-mer, title-with-filters-rezo-la-mer, hero-nos-communes, commune-transparente-actions.

---

## ZodAutoForm

`src/components/admin/zod-auto-form/ZodAutoForm.tsx` génère automatiquement un formulaire React depuis un schéma Zod. Utilisé pour l'édition des props de sections et des settings globaux.

Point d'entrée : `ObjectFields` (composant exporté nommé), qui itère sur les champs d'un schéma `ZodObject` et rend le composant approprié selon le type inféré.

### Champs auto-générés

| `kind` (classifié) | Composant | Description |
|---|---|---|
| `localizedString` | `LocalizedStringField` | Objet `{ fr: string; en: string; ... }` — un input par locale |
| `string` | `StringField` | Input texte ; si `fieldKey` contient "image", "url" ou "icon" → variante spécialisée |
| `number` | `NumberField` | Input numérique |
| `boolean` | `BooleanField` | Toggle switch |
| `enum` | `EnumField` | Select avec les valeurs de l'enum Zod |
| `array` | `ArrayField` | Liste réordonnables d'items (chaque item = `ObjectFields` récursif) |
| `object` | `ObjectFields` récursif | Sous-objet imbriqué (collapsible) |
| `image` | `ImageField` | Champ spécialisé avec prévisualisation |
| `icon` | `IconField` | Sélecteur d'icône Lucide |
| `code` | `CodeField` | Éditeur de code (textarea monospace) |
| Inconnu | `JsonFallbackField` | Textarea JSON brut (fallback) |

**`ImageField`** : si le champ représente une URL d'image, affiche un aperçu avec input URL.

**`IconField`** : sélecteur d'icône Lucide avec recherche par nom. Affiche l'icône sélectionnée en temps réel.

**`CodeField`** : textarea avec police monospace pour l'édition de HTML brut ou de code JSON.

**`LocalizedStringField`** : un input par locale configurée dans `LOCALES` (src/types/locale-schema.ts). En mode `compact`, affiche les locales en onglets horizontaux.

**`ArrayField`** : liste avec boutons d'ajout/suppression et réordonnement via drag-and-drop (`SortableList`). Chaque item est édité en place via `ObjectFields` récursif.

### schema-utils.ts

Utilitaires de classification des champs Zod :

```ts
// Résout les wrappers optional/default/nullable pour accéder au type interne
function resolveType(schema: ZodTypeAny): ResolvedType
// → { innerSchema, isOptional, defaultValue }

// Détecte si un schéma est un LocalizedString (ZodObject avec toutes les clés = locales)
function isLocalizedString(schema: ZodTypeAny): boolean

// Retourne les valeurs d'un union de literals (pour EnumField)
function getUnionLiteralValues(schema: ZodTypeAny): unknown[] | false

// Classification principale → détermine le composant à rendre
function classifyField(schema: ZodTypeAny): FieldInfo
// → { kind: "string"|"number"|"boolean"|"enum"|"localizedString"|"array"|"object"|"unknown", isOptional, ... }

// Génère une valeur par défaut vide selon le schéma
function createDefaultValue(schema: ZodTypeAny): unknown

// Convertit camelCase → "Camel Case"
function humanizeKey(key: string): string

// Retourne le schéma de props pour un type de section donné
function getSectionPropsSchema(sectionType: string): ZodTypeAny | null
```

`getSectionPropsSchema` lit `SectionSchema.options` (discriminated union) et retourne le schéma `props` correspondant au type demandé. Utilisé par `AdminPanel` pour générer le formulaire d'édition d'une section.

---

## SortableList

`src/components/admin/SortableList.tsx` — composant générique de liste réordonnée par drag-and-drop.

```ts
interface SortableListProps<T> {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (newItems: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
}
```

Basé sur `@dnd-kit/core` + `@dnd-kit/sortable`. Affiche une poignée `GripVertical` à gauche de chaque item. Utilise `PointerSensor` (clic) et `KeyboardSensor` (accessibilité) pour le déclenchement du drag.

Utilisé dans :
- `AdminPanel` pour réordonner les sections d'une page
- `ArrayField` (ZodAutoForm) pour réordonner les éléments d'un tableau

---

## Mise en surbrillance des sections

Quand le `Sheet` est ouvert, `AdminPanel` injecte du CSS dynamique dans `<head>` :

```css
[data-section-index].admin-highlight {
  outline: 2px dashed var(--primary);
  outline-offset: 4px;
}
[data-section-index].admin-highlight::after {
  content: attr(data-section-type) " #" attr(data-section-index);
  /* badge superposé affichant le type et l'index */
}
```

La fonction `highlightSection(index)` applique/retire la classe `admin-highlight` sur l'élément `[data-section-index="N"]` correspondant. Pour que la surbrillance fonctionne, les sections rendues par `SectionRenderer` doivent avoir l'attribut `data-section-index={index}` et `data-section-type={section.type}` sur leur wrapper.

---

## Voir aussi

- [Architecture](03-architecture.md) — SiteProvider, useSite
- [Schémas sections](05-schemas-sections.md) — tous les types de sections éditables
- [Configuration](02-configuration.md) — format JSON du site
- [Backend & SSR](14-backend-ssr.md) — endpoint /api/admin/config-save (prod)
