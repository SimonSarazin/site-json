[← Retour à l'index](README.md)

# Panneau d'administration (AdminPanel)

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Activation et montage](#activation-et-montage)
- [Vues disponibles](#vues-disponibles)
- [Sauvegarde de la configuration](#sauvegarde-de-la-configuration)
- [Upload d'images](#upload-dimages)
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

`AdminPanel` est monté dans `RootLayout.tsx` uniquement quand `import.meta.env.DEV` vaut `true`. Le module n'est **jamais** importé ni inclus dans les bundles de production : la variable `AdminPanel` est `null` en prod, et le composant n'est donc pas rendu. En dev, il est lazy-loadé via `lazy()` de `vite-preload` et enveloppé dans `<Suspense fallback={null}>`.

```tsx
// RootLayout.tsx (extrait)
const AdminPanel = import.meta.env.DEV
  ? lazy(() => import("@/components/admin/AdminPanel"))
  : null;

// Dans SiteShell :
{AdminPanel && (
  <Suspense fallback={null}>
    <AdminPanel />
  </Suspense>
)}
```

Le bouton déclencheur est un bouton `Settings` (icône engrenage) circulaire de 48×48 px, fixé en bas à droite de la page (`fixed bottom-4 right-4`). Cliquer dessus ouvre le `Sheet` (drawer latéral droit de 500 px de large). Le `Sheet` est rendu en mode non-modal (`modal={false}` + `noOverlay`), ce qui laisse la page en arrière-plan interactive.

L'ouverture du `Sheet` (`sheetOpen === true`) déclenche l'injection du CSS de surbrillance via un `useEffect` (voir §Mise en surbrillance). Ce CSS est retiré automatiquement à la fermeture du Sheet (nettoyage du `useEffect`).

Il n'y a **pas** de raccourci clavier pour ouvrir le panneau : seul le bouton flottant fait office de déclencheur.

Il n'y a **pas** de vérification de rôle admin dans le code actuel : le panneau est accessible à tous les utilisateurs en mode dev. Le commentaire `// if (!isAdmin) return null;` est présent dans le code mais désactivé.

---

## Vues disponibles

Le composant implémente une machine à états via un discriminated union `View` :

| Mode | Contenu |
|---|---|
| `pages` | Liste de toutes les pages + accès Header, Footer, Paramètres |
| `sections` | Sections de la page sélectionnée (réordonnables par drag-and-drop) |
| `editSection` | Éditeur de props d'une section via ZodAutoForm |
| `addPage` | Formulaire d'ajout de page (titre fr + chemin URL) |
| `header` | Éditeur des champs header (hors nav) + liste des liens nav réordonnables |
| `editNavItem` | Éditeur d'un item de navigation (label fr/en, path, href, icon, description) |
| `footer` | Éditeur des champs footer (hors columns) + liste des colonnes réordonnables |
| `editFooterColumn` | Éditeur d'une colonne footer (titre + liste de liens réordonnables) |
| `settings` | Liste des settings globaux (tous les champs `SiteConfig` sauf `pages`, `header`, `footer`, `version`, `generated`) |
| `editSetting` | Éditeur d'un setting via ZodAutoForm |

La **vue initiale** est `{ mode: "sections", pageIndex: currentPageIndex }` où `currentPageIndex` correspond à la page dont le `path` correspond au `pathname` React Router courant (ou 0 si non trouvée).

La vue `pages` est en réalité **la vue "accueil" du panneau** : elle liste les pages existantes et affiche en haut des raccourcis vers Header/Navigation, Footer et Paramètres du site. Les pages sont listées sous un sous-titre "Pages", chacune affichant son titre (fr), son chemin, son nombre de sections et un bouton de suppression avec confirmation `AlertDialog`.

**Navigation entre vues** :
- `useLocation()` + `useNavigate()` sont importés mais `useNavigate` est utilisé uniquement dans la vue `sections` pour naviguer vers une page différente depuis le panneau (bouton "Voir").
- Un `useEffect` sur `pathname` réinitialise la vue sur `sections` (page courante) uniquement si la vue actuelle est `sections` ou `editSection`.
- Le bouton retour en tête de chaque vue utilise `ArrowLeft` (pas un fil d'Ariane textuel : il n'y a pas de breadcrumb affiché dans le header du panneau).

**Ajout de page** : crée automatiquement un item de navigation dans `header.nav` avec le même label et chemin. La vue bascule ensuite sur `sections` pour la nouvelle page.

**Suppression de page** : retire aussi l'item de navigation correspondant dans `header.nav` (par correspondance de `path`). Impossible de supprimer la dernière page restante.

---

## Sauvegarde de la configuration

```ts
async function saveConfig() {
  if (import.meta.hot) {
    // Dev : envoi via Vite HMR WebSocket
    import.meta.hot.send("config-save", config);
    toast.success("Config sauvegardée");
  } else {
    // Prod : API REST avec gestion d'erreur
    try {
      const res = await fetch("/api/admin/config-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.statusText);
      toast.success("Config sauvegardée");
    } catch (e) {
      toast.error(`Erreur: ${(e as Error).message}`);
    }
  }
}
```

**Mode développement** : le message `"config-save"` est intercepté par le dev-server (`server/dev-server.js`) via `vite.ws.on("config-save", ...)`. Le handler écrit le JSON sur disque à `SITE_CONFIG_PATH` (requis ; si non défini, l'opération échoue avec un message d'erreur serveur). La config est re-sanitisée via `normalizeSiteConfig` mais **aucun rechargement HMR de page n'est déclenché automatiquement** : les modifications live sont déjà appliquées via `setConfig` en temps réel côté client.

**Mode production** : appel `POST /api/admin/config-save` — cet endpoint **n'est pas monté** dans `prod-server.js` (le fichier ne contient aucune route admin). L'AdminPanel n'étant de toute façon pas inclus dans les bundles prod (voir §Activation et montage), ce chemin de code n'est accessible qu'en dev.

Le bouton "Sauvegarder" (`Save` icon + texte) est présent dans **chaque vue** pour permettre de sauvegarder à tout moment.

---

## Upload d'images

`ImageField` (voir §ZodAutoForm) appelle `POST /api/admin/upload-image` pour uploader un fichier image. Cet endpoint est monté **uniquement en développement** (`server/dev-server.js`), via le middleware `createImageUpload` (`server/middleware/imageUpload.js`).

Comportement du middleware :
- Sauvegarde dans `<staticRoot>/images/<VITE_SLUG>/` (e.g. `public/images/default/`)
- Nom de fichier : 8 octets aléatoires hex + extension originale
- Types autorisés : JPEG, PNG, GIF, WebP, SVG, AVIF
- Taille max : 10 Mo
- Retourne `{ path: "/images/<slug>/<hash>.<ext>" }`

`ImageField` supporte également la saisie d'URL directe, le glisser-déposer et le collage presse-papiers (`paste` d'image).

---

## SectionPicker

Composant interne permettant de sélectionner le type d'une nouvelle section à ajouter.

**Interface** :
- Deux éléments côte à côte : un bouton toggle (affiche le type sélectionné ou un placeholder) + un bouton `Plus` (déclenche l'ajout, désactivé si aucun type sélectionné)
- Cliquer le bouton toggle ouvre/ferme un dropdown custom (pas un Popover shadcn) ancré en bas du bouton, limité à 60 % de la hauteur de l'écran, avec un champ de recherche en tête
- Chaque entrée affiche : miniature (32×20 px), label ; la description n'est **pas** affichée dans la liste
- Entrée sélectionnée mise en évidence (`bg-accent font-medium`)
- Au **hover** sur une entrée, un panneau fixe de 384 px de large (`w-96`) apparaît positionné à droite du drawer (coordonnées fixes : `right: 508, bottom: 80`) avec l'image en pleine largeur (hauteur 240 px, `h-60`) et la description en dessous

**`ADDABLE_SECTIONS`** : dérivé automatiquement de `SectionSchema.options` (le discriminated union Zod de tous les types de sections). Pour chaque option, lit `SECTION_META[type]` pour obtenir label, description et image. Trié alphabétiquement par label.

---

## SECTION_META

`src/components/admin/section-meta.ts` contient les métadonnées d'affichage pour chaque type de section (label lisible, description, URL d'image placeholder `placehold.co`).

Structure :

```ts
export const SECTION_FAMILIES = [
  "hero", "contenu", "layout", "cta", "media", "presentation", "data", "utilitaires",
  "formulaire", "auth", "search", "news", "notification", "profil", "ampli", "coform",
  "cagnotte", "observatoire", "agenda", "blog",
] as const;
export type SectionFamily = (typeof SECTION_FAMILIES)[number];

export interface SectionMeta {
  label: string;
  desc: string;
  image: string; // URL placehold.co 300×180
  family: SectionFamily; // OBLIGATOIRE
}

const SECTION_META: Record<string, SectionMeta> = {
  hero: { label: "Hero", desc: "Bannière principale avec titre, sous-titre et CTA", image: "...", family: "hero" },
  cards: { label: "Cards", desc: "Grille de cartes avec image, titre et description", image: "...", family: "layout" },
  // ... tous les types de section
};
```

⚠ `family` est **requis** : une entrée copiée sans lui ne compile pas.

Pour ajouter une nouvelle section au panneau admin :
1. Ajouter le type dans `SectionSchema` (`src/types/site-schema.ts`)
2. Ajouter son entrée dans `SECTION_META` (`src/components/admin/section-meta.ts`) — avec une
   `family` prise dans `SECTION_FAMILIES` et une `desc` de **plus de 10 caractères**
3. La section apparaît automatiquement dans `ADDABLE_SECTIONS`
4. Lancer `npm run test:preflight` : `tests/preflight/section-meta.test.ts` vérifie la parité
   **exacte** dans les deux sens entre l'union `Section`, `SECTION_META` et la table `lazy()` de
   `SectionRenderer.tsx` (ni section sans description, ni entrée morte)

**Sections documentées dans SECTION_META** : la liste fait foi dans
`src/components/admin/section-meta.ts` — **source unique**, à consulter plutôt qu'à recopier ici
(toute énumération figée dans cette page dérive au premier ajout de section). Le **compte** de
sections est, lui, verrouillé par le préflight ci-dessus dans `CLAUDE.md`,
`doc/26-assistant-config.md` et la skill `config-assistant`.

---

## ZodAutoForm

`src/components/admin/zod-auto-form/ZodAutoForm.tsx` génère automatiquement un formulaire React depuis un schéma Zod. Utilisé pour l'édition des props de sections et des settings globaux.

Point d'entrée principal : `ZodAutoForm` (export default), qui résout le schéma via `resolveType` puis délègue à `ObjectFields`. `ObjectFields` est également exporté nommément et utilisé directement par `AdminPanel` pour les vues header/footer/settings.

`ZodAutoForm` : si le schéma résolu n'est pas un objet Zod, affiche un `JsonFallbackField` directement.

### Champs auto-générés

`ObjectFields` itère sur les entrées du `ZodObject` et choisit le composant selon le `kind` retourné par `classifyField` :

| `kind` (classifié) | Composant rendu | Description |
|---|---|---|
| `localizedString` | `LocalizedStringField` | Objet `{ fr: string; en: string; ... }` — un input par locale |
| `string` | `StringField` | Délègue à `CodeField`, `IconField`, `ImageField` ou `Textarea`/`Input` selon `fieldKey` |
| `number` | `NumberField` | Input `type="number"` |
| `boolean` | `BooleanField` | Toggle `Switch` |
| `enum` | `EnumField` | `Select` shadcn avec les valeurs de l'enum Zod |
| `unionLiterals` | `EnumField` | `Select` shadcn pour un `z.union([z.literal(...), ...])` |
| `array` | `ArrayField` | Liste avec ajout/suppression ; items édités en place (pas de drag-and-drop dans `ArrayField`) |
| `object` | `ObjectFields` récursif | Sous-objet requis : imbriqué avec bordure gauche. Sous-objet optionnel : `OptionalObjectField` (collapsible avec bouton d'activation/suppression) |
| `unsupported` | `JsonFallbackField` | Textarea JSON brut avec bouton "Appliquer" (fallback pour types non reconnus) |

Les champs `image`, `icon` et `code` ne sont **pas** des `kind` distincts : ils sont tous classifiés `"string"` et la distinction se fait dans `StringField` selon le nom du champ (`fieldKey`) :

- **`ImageField`** : activé si `fieldKey` correspond à des clés connues (`logo`, `image`, `src`, `avatar`, etc.) ou des suffixes (`Image`, `Logo`, `Src`, `Photo`, etc.), sauf si le champ est d'abord reconnu comme icône. Affiche un aperçu de l'image, une zone de drag-and-drop/clic pour upload, et un input URL. Prend en charge le collage presse-papiers. Appelle `POST /api/admin/upload-image`.

- **`IconField`** : activé si `fieldKey` est `icon`, `logoIcon`, `favicon` ou se termine par `Icon`. Sélecteur d'icône Lucide dans un `Popover` avec recherche textuelle, grille 6 colonnes, pagination par scroll (120 icônes par page), chargement lazy de la liste complète (`lucide-react/dynamicIconImports`). Affiche l'icône sélectionnée en temps réel via `DynamicIcon`.

- **`CodeField`** : activé si `fieldKey` est dans `{ html, css, js, code, customCSS, customJS, script, style }`. Éditeur **CodeMirror 6** (pas une simple textarea) avec coloration syntaxique (HTML, CSS, JS selon le champ), thème One Dark en mode sombre, indentation Tab, et formatage automatique du HTML à l'initialisation. Occupe toute la hauteur disponible.

- **`StringField` multiline** : activé si `fieldKey` est dans `{ content, description, markdown, body, template, snippet }`. Affiche une `Textarea` (police monospace) au lieu d'un `Input`.

**`LocalizedStringField`** : un `Input` par locale (depuis `LOCALES` de `src/types/locale-schema.ts`), avec le code locale affiché en préfixe monospace. La locale par défaut (`fr`) est marquée d'un astérisque rouge si le champ est requis. En mode `compact`, les inputs sont plus petits (`h-8 text-xs`) — il n'y a **pas** d'onglets horizontaux.

**`ArrayField`** : liste avec bouton "Ajouter" en tête et bouton de suppression par item. Les items sont édités en place (selon leur type : `ObjectFields`, `LocalizedStringField`, `NumberField` ou `StringField`). Il n'y a **pas** de drag-and-drop dans `ArrayField` ; le réordonnement n'est pas disponible pour les tableaux.

**`OptionalObjectField`** : pour les sous-objets optionnels. Affiche un bouton `+ NomDuChamp` si non défini. Une fois activé, affiche un header cliquable (toggle collapse) avec un bouton de suppression, puis les champs imbriqués via `ObjectFields`.

### schema-utils.ts

Utilitaires de classification des champs Zod exportés depuis `src/components/admin/zod-auto-form/schema-utils.ts` :

```ts
// Résout les wrappers optional/default/nullable pour accéder au type interne
function resolveType(schema: ZodTypeAny): ResolvedType
// → { innerSchema, isOptional, defaultValue }

// Détecte si un schéma est un LocalizedString (ZodObject avec toutes les clés = locales)
function isLocalizedString(schema: ZodTypeAny): boolean

// Retourne les valeurs d'un union de literals Zod, ou false si ce n'est pas un union de literals
function getUnionLiteralValues(schema: ZodTypeAny): unknown[] | false

// Classification principale → détermine le composant à rendre
function classifyField(schema: ZodTypeAny): FieldInfo
// → { kind: "string"|"number"|"boolean"|"enum"|"unionLiterals"|"localizedString"|"array"|"object"|"unsupported", isOptional, ... }

// Génère une valeur par défaut vide selon le schéma (ne génère pas les champs optionnels)
function createDefaultValue(schema: ZodTypeAny): unknown

// Convertit camelCase/kebab-case/snake_case → "Titre Capitalisé"
function humanizeKey(key: string): string

// Retourne le schéma de props pour un type de section donné (depuis un Map pré-construit)
function getSectionPropsSchema(sectionType: string): ZodTypeAny | null
```

`getSectionPropsSchema` construit un `Map<string, ZodTypeAny>` au module load depuis `Section.options` (discriminated union). Utilisé par `AdminPanel` pour générer le formulaire d'édition d'une section et par `addSection` pour créer les props par défaut.

`classifyField` retourne le `kind` `"unsupported"` (et non `"unknown"`) pour les types Zod non reconnus.

`humanizeKey` convertit aussi les séparateurs `-` et `_` en espaces, en plus du camelCase.

---

## SortableList

`src/components/admin/SortableList.tsx` — composant générique de liste réordonnée par drag-and-drop, exporté nommément (`export function SortableList`).

```ts
interface SortableListProps<T> {
  items: T[];
  getId: (item: T, index: number) => string;
  onReorder: (newItems: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
}
```

Basé sur `@dnd-kit/core` + `@dnd-kit/sortable`. Affiche une poignée `GripVertical` à gauche de chaque item (bouton séparé du contenu rendu par `renderItem`). Utilise :
- `PointerSensor` avec `activationConstraint: { distance: 5 }` — un déplacement d'au moins 5 px est requis avant activation (évite les clics accidentels)
- `KeyboardSensor` avec `sortableKeyboardCoordinates` (accessibilité)

Utilisé dans `AdminPanel` pour :
- Réordonner les sections d'une page (vue `sections`)
- Réordonner les items de navigation (vue `header`)
- Réordonner les colonnes du footer (vue `footer`)
- Réordonner les liens d'une colonne footer (vue `editFooterColumn`)

**Note** : `SortableList` n'est **pas** utilisé dans `ArrayField` (ZodAutoForm) — les tableaux de props n'ont pas de réordonnement.

---

## Mise en surbrillance des sections

Quand `sheetOpen` passe à `true`, `AdminPanel` injecte un élément `<style id="admin-hover-highlight">` dans `<head>` via un `useEffect` (cleanup automatique à la fermeture) :

```css
[data-section-index].admin-highlight {
  outline: 2px dashed var(--primary);
  outline-offset: 4px;
  margin-top: 6px;
  margin-bottom: 6px;
  position: relative;
  z-index: 10;
}
[data-section-index].admin-highlight::after {
  content: attr(data-section-type) " #" attr(data-section-index);
  position: absolute;
  top: -14px;
  left: 8px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  z-index: 50;
  pointer-events: none;
}
```

La fonction `highlightSection(index)` :
1. Retire la classe `admin-highlight` de tous les éléments `[data-section-index]`
2. Si `index !== null`, cherche `[data-section-index="${index}"]`, lui ajoute `admin-highlight` et appelle `scrollIntoView({ behavior: "smooth", block: "nearest" })`

Elle est appelée via `onMouseEnter`/`onMouseLeave` sur chaque item de la liste de sections (vue `sections`). `onMouseLeave` appelle `highlightSection(null)` pour retirer la surbrillance.

Pour que la surbrillance fonctionne, `SectionRenderer` doit poser les attributs `data-section-index={index}` et `data-section-type={section.type}` sur le wrapper de chaque section — ce qui est effectivement le cas dans `src/components/sections/SectionRenderer.tsx`.

---

## Voir aussi

- [Architecture](03-architecture.md) — SiteProvider, useSite
- [Schémas sections](05-schemas-sections.md) — tous les types de sections éditables
- [Configuration](02-configuration.md) — format JSON du site
- [Backend & SSR](14-backend-ssr.md) — dev-server, image optimizer
