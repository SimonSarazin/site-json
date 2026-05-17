# Module Command Palette (Cmd+K)

> Document d'architecture — vision pour l'ajout d'un module `commandPalette` fournissant une palette de commandes globale accessible via raccourci clavier (Cmd/Ctrl+K), disponible sur toutes les pages d'un site SiteForge.

## 1. Contexte & objectifs

### Périmètre — ce que la palette cherche (et ne cherche pas)

La palette Cmd+K est une **recherche globale limitée à ce qui existe pour le site courant**. Elle ne fait jamais de recherche web, ne scanne pas le DOM, ne devine rien. Elle indexe **trois sources strictement délimitées** :

1. **Données configurées dans le JSON du site** (synchrone, lues depuis `useSite().config`) :
   - `config.pages[]` → une commande de navigation par page (path + title localisé).
   - `config.header.nav[]` → items et dropdowns navigables (exclut `path === "#"`).
   - Actions globales conditionnées par `config.header.utilities` : bascule thème (si `themeSwitch`), changement de langue (si `langSwitch`, itère `config.meta.languages`), login/logout (si `auth`).
   - Filtrage par `config.commandPalette.sources[]` (si défini) : ex. `["core:navigation", "profil"]` → seules ces sources apparaissent.

2. **Données vivantes du backend Cocolight** (asynchrone, via `useCocolight().api`) :
   - Entités recherchées en live dès que `query.length >= 2` : organisations, projets, events, POI, users (tout ce que le module `profil` expose).
   - News si le module `news` enregistre sa source.
   - Requêtes débouncées (200 ms) + cachées par React Query.

3. **Actions métier enregistrées par les modules** (via `registerCommandSource`) :
   - Ex. `profil` peut enregistrer "Créer une organisation", "Aller à mon profil".
   - Ex. `admin` (futur) peut enregistrer "Vider le cache images" conditionné sur `canRunAdminActions`.

**Corollaire** : un site minimaliste (pas de backend connecté, pas de modules optionnels activés) verra uniquement les pages et la navigation configurées — c'est **intentionnel**. La palette reflète le contenu réel du site, elle ne fabrique pas de résultats.

### Pourquoi un module dédié ?
- La palette Cmd+K est **transverse** : navigation rapide vers n'importe quelle page, recherche d'entités (organisations, projets, events, POI, users), actions globales (changer la langue, basculer le thème, se déconnecter), ouverture d'écrans admin.
- Elle **n'est pas une section** au sens JSON (`pages[].sections[]`) : une section est un bloc de contenu contextuel à une page, lazy-loadé via `vite-preload`. La palette est un **overlay global** monté au niveau racine, comme `FloatingQRCode` ou `Toaster`.
- Elle ne doit **pas vivre dans `src/modules/search/`** : ce module est dédié aux sections de recherche contextuelle (`searchPro`, `searchProStatic`, `cardCountCT`, `thematics`). La palette a un cycle de vie différent (toujours montée, jamais rendue dans une page) et expose une API d'enregistrement que d'autres modules doivent consommer. Mélanger les deux créerait un couplage inverse.

### Objectifs fonctionnels
1. **Raccourci global** : Cmd+K (macOS) / Ctrl+K (Linux/Windows) ouvre la palette depuis n'importe quelle route.
2. **Sources pluggables** : chaque module enregistre ses propres commandes via un registry (pattern miroir de `src/lib/permissions/`).
3. **Recherche fuzzy locale** pour commandes statiques (navigation, actions) + **recherche asynchrone débouncée** pour entités backend.
4. **Config JSON par site** : activation, sources actives, placeholder localisé, raccourcis personnalisés.
5. **Permissions-aware** : les commandes filtrées selon l'utilisateur (via le registry `permissions`).
6. **SSR-safe** : aucun code dépendant de `window` ou `document` au chargement initial.
7. **i18n** : placeholder, groupes, labels traduisibles via namespace `modules/commandPalette`.

### Objectifs non-fonctionnels
- Zero flash : la palette n'apparaît **pas** au load (pas de splash, juste un listener clavier).
- Bundle léger : pas de dépendance nouvelle — `cmdk@1.1.1` est déjà présent via `src/components/ui/command.tsx`.
- Extensible : ajouter une nouvelle source de commandes ne doit pas toucher au core du module.

## 2. Analyse fine de l'existant

### 2.1. Composants réutilisables déjà en place

| Élément | Localisation | Note |
|---|---|---|
| shadcn `CommandDialog` + sous-composants | `src/components/ui/command.tsx` (184 l.) | `cmdk@1.1.1` — prêt à l'emploi : `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator` |
| `useDebounce` | `src/hooks/useDebounce.ts:20-37` | Utilisable tel quel pour débouncer les requêtes backend |
| `useLoadNamespace` / `useT` | `src/hooks/` | Pattern i18n standard pour charger un namespace à la volée |
| `usePermissions` | `src/lib/permissions/usePermissions.ts:27-49` | Hook générique — filtrer les commandes par namespace |
| `useSite` / `useCocolight` / `useLocalization` | `src/hooks/` | Accès config, API backend, locale courante |

### 2.2. Système de modules (`src/lib/modules.ts`)

- `discoverModules()` : glob eager `"/src/modules/*/module.config.ts"` → extrait `{ name, type, enabled }`.
- Deux globs distincts pour routes : `"/src/modules/*/routes.tsx"` eager pour `core`, dynamique pour `optional`.
- Un module **sans `routes.tsx`** reste valide : il enregistre seulement des side-effects (i18n, permissions, commandes).
- Format exact attendu dans `module.config.ts` :

```ts
import type { ModuleConfigSchema } from "@/lib/modules";
const config: ModuleConfigSchema = {
  name: "commandPalette",
  type: "core",
  enabled: true,
};
export default config;
```

### 2.3. Registry de permissions (pattern à cloner)

Le module s'inspire directement de `src/lib/permissions/` :

```ts
// src/lib/permissions/registry.ts
const calculators = new Map<string, PermissionCalculator>();
export function registerPermissions<T>(calc: PermissionCalculator<T>): void { ... }
export function getCalculator(ns: string): PermissionCalculator | undefined { ... }
export function _resetForTesting(): void { ... }
```

L'enregistrement se fait **par side-effect d'import** : `import "@/modules/profil/permissions/register"` dans `src/hooks/useUserPermissions.tsx`. On reproduira exactement ce schéma pour les commandes (`registerCommandSource`), avec un hook d'agrégation `useCommands()` qui appelle toutes les sources inscrites.

### 2.4. RootLayout (`src/RootLayout.tsx`)

Hiérarchie actuelle des providers (vérifiée ligne par ligne) :

```
<ErrorBoundary>                        L.69
  <Suspense>                           L.70
    <CocolightProvider>                L.71
      <ThemeProvider>                  L.72
        <SiteProvider>                 L.73
          <SiteShell>                  L.23-58
            <LocalizationProvider>     L.27
              <I18nBridge>             L.31
                <SiteTheme />
                <GoogleFontsLoader />
                <Outlet />             L.35  ← pages rendues ici
                <IntegrationsLoader />
                <Toaster />            L.37
                {AdminPanel}           L.39-43 (DEV)
                {FloatingQRCode}       L.45-55 (conditionnel)
```

**Point d'insertion identifié pour la palette** : ligne 43 (entre `AdminPanel` et `FloatingQRCode`), à l'intérieur de `I18nBridge` pour avoir accès à `useT` et au provider de localisation. Le `CommandPaletteProvider` doit envelopper au minimum ce qui consomme son contexte (en pratique, rien n'a besoin de le consommer sauf le `SiteHeader` et le composant lui-même — donc un provider placé juste avant `<Outlet />` suffit).

### 2.5. SiteHeader et `header.utilities`

`src/components/layout/SiteHeader.tsx` (lu intégralement) est un simple switch sur `config.header.type` qui délègue à 6 variantes (`HeaderTiersLieux`, `HeaderRezoLaMer`, `HeaderJuliePotVin`, `HeaderNosCommunes`, `HeaderCommuneTransparente`, `DefaultHeader`). Chaque variante consomme `header.utilities` individuellement.

Le `DefaultHeader` rend ligne 260 un bouton `search` passif (juste une icône, pas de onClick actif) :
```tsx
{header.utilities.search && <Button variant="ghost" size="sm"><Search /></Button>}
```

**Décision** : on **ne remplace pas** le flag `search` existant (rétro-compat). On ajoute un flag sibling `commandPalette` dans `header.utilities`, qui doit être déclaré **à la fois** dans le Zod `src/types/site-schema.ts:1485` et dans l'interface TS `src/types/site.ts:13-20` (la seconde est un miroir manuel, pas généré). Le bouton devient actif : `onClick={() => openCommandPalette()}` et affiche le raccourci `⌘K` via `<kbd>`.

### 2.6. Schéma JSON (`src/types/site-schema.ts`)

Patterns déjà utilisés pour les modules :
- `profiles: ProfilesConfigSchema` (non-optionnel, agrégé depuis `@/modules/profil/schema`)
- `ampli: z.array(AmpliConfigSchema).optional()`
- `floatingQRCode: z.object({...}).optional()`

On suivra le même pattern : un schéma exporté depuis `src/modules/commandPalette/schema.ts`, importé dans `site-schema.ts`, composé en tant que champ top-level **optionnel** (`commandPalette?: CommandPaletteConfig`).

### 2.7. i18n (`src/i18n.ts` et modules)

Pattern confirmé par `src/modules/ampli/i18n.ts` :
```ts
import i18n from "@/i18n";
import fr from "./i18n/fr.json";
import en from "./i18n/en.json";
i18n.addResourceBundle("fr", "modules/ampli", fr, true, true);
i18n.addResourceBundle("en", "modules/ampli", en, true, true);
```

Le module `commandPalette` créera son bundle `modules/commandPalette` sur ce modèle.

### 2.8. API backend (CocolightProvider)

`useCocolight()` expose `api: Api | null` (instance Cocolight SDK après login). Pour la recherche d'entités, deux approches :
- **Non connecté** : utiliser `api.search()` public (si exposé) — à valider.
- **Connecté** : `api.searchCostum()` comme dans `SearchPro.tsx:47-124`, avec React Query `useInfiniteQuery` pour la pagination. Pour la palette on se contente d'une page (top 10), pas d'infinite scroll.

## 3. Architecture proposée

### 3.1. Arborescence du module

```
src/modules/commandPalette/
├── module.config.ts               # { name: "commandPalette", type: "core" }
├── index.ts                       # Exports publics (hooks, types, register API)
├── schema.ts                      # Zod CommandPaletteConfigSchema
├── i18n.ts                        # addResourceBundle side-effect
├── i18n/
│   ├── fr.json
│   └── en.json
├── registry/
│   ├── types.ts                   # Command, CommandSource, CommandContext
│   ├── registry.ts                # registerCommandSource / getSources / _resetForTesting
│   └── index.ts
├── sources/                       # Sources fournies par le core
│   ├── navigationSource.ts        # Pages depuis config.pages + header.nav
│   ├── actionsSource.ts           # Toggle theme, switch lang, logout, home
│   └── index.ts                   # Auto-register via side-effect
├── hooks/
│   ├── useCommandPalette.ts       # open / close / toggle / isOpen
│   ├── useCommands.ts             # Agrège sources + fuzzy filter
│   └── useGlobalShortcut.ts       # Listener Cmd+K / Ctrl+K
├── contexts/
│   ├── CommandPaletteContext.ts   # createContext
│   └── CommandPaletteProvider.tsx # State provider + keybinding effect
├── components/
│   ├── CommandPalette.tsx         # Composant principal (CommandDialog)
│   ├── CommandGroupRenderer.tsx   # Rend un groupe (nav / entités / actions)
│   ├── CommandItemRenderer.tsx    # Rend une commande (icône + label + shortcut)
│   └── CommandTriggerButton.tsx   # Bouton header (pour SiteHeader)
├── permissions/
│   ├── types.ts                   # CommandPalettePermissions
│   ├── calculator.ts              # calculateCommandPalettePermissions
│   └── register.ts                # registerPermissions side-effect
└── __tests__/
    ├── registry.test.ts
    ├── useCommands.test.ts
    └── CommandPalette.test.tsx
```

### 3.2. Types centraux

```ts
// src/modules/commandPalette/registry/types.ts
import type { ReactNode } from "react";
import type { LocalizedString } from "@/types/locale-schema";
import type { User } from "@communecter/cocolight-api-client";

export type CommandId = string;

export interface Command {
  id: CommandId;                               // unique (ex: "nav:/about", "profil:org:abc123")
  label: string | LocalizedString;             // résolu via useT
  description?: string | LocalizedString;
  keywords?: string[];                         // termes indexés pour fuzzy search
  icon?: ReactNode;
  group: CommandGroupId;                       // "navigation" | "entities" | "actions" | ...
  shortcut?: string[];                         // ex: ["Cmd", "H"]
  perform: (ctx: CommandPerformContext) => void | Promise<void>;
}

export type CommandGroupId = string;

export interface CommandGroup {
  id: CommandGroupId;
  heading: string | LocalizedString;
  order?: number;                              // tri (bas = haut)
}

export interface CommandContext {
  query: string;                               // texte courant de CommandInput
  me: User | null;
  locale: string;
  pathname: string;
  permissions: Record<string, unknown>;        // agrégat usePermissions
}

export interface CommandPerformContext {
  navigate: (path: string) => void;
  close: () => void;
  locale: string;
  me: User | null;
}

export interface CommandSource {
  namespace: string;                           // unique : "core:navigation", "profil", "news", etc.
  groups?: CommandGroup[];                     // groupes déclarés par la source
  getCommands: (ctx: CommandContext) =>
    | Command[]
    | Promise<Command[]>;                      // async = débounce automatique côté hook
}
```

### 3.3. Registry (miroir exact de `lib/permissions`)

```ts
// src/modules/commandPalette/registry/registry.ts
const sources = new Map<string, CommandSource>();
const groups = new Map<CommandGroupId, CommandGroup>();

export function registerCommandSource(source: CommandSource): void {
  if (sources.has(source.namespace)) {
    console.warn(`[commandPalette] source "${source.namespace}" already registered, overwriting`);
  }
  sources.set(source.namespace, source);
  source.groups?.forEach((g) => groups.set(g.id, g));
}

export function getCommandSources(): CommandSource[] {
  return Array.from(sources.values());
}

export function getCommandGroup(id: CommandGroupId): CommandGroup | undefined {
  return groups.get(id);
}

export function _resetForTesting(): void {
  sources.clear();
  groups.clear();
}
```

### 3.4. Hook d'agrégation `useCommands`

```ts
// src/modules/commandPalette/hooks/useCommands.ts
export function useCommands(query: string): {
  groups: Array<{ group: CommandGroup; commands: Command[] }>;
  loading: boolean;
} {
  const debouncedQuery = useDebounce(query, 200);
  const { me } = useCocolight();
  const { locale } = useLocalization();
  const { pathname } = useLocation();
  const permissions = useUserPermissions(null);

  const ctx: CommandContext = { query: debouncedQuery, me, locale, pathname, permissions };

  // 1. Sync sources → immédiat
  // 2. Async sources → useQuery par namespace (clés distinctes), débounce via useDebounce
  // 3. Filtrage fuzzy local sur label + keywords (fuse.js ou implémentation maison simple)
  // 4. Groupement par group.id + tri par group.order
  // 5. Filtrage par permissions (si source.permissionNamespace défini → vérifie)
}
```

**Choix fuzzy** : pas de nouvelle dépendance. Une implémentation simple (sous-chaîne case-insensitive + score par distance de Levenshtein tronquée) suffit pour <1000 commandes. `fuse.js` seulement si le besoin devient réel (décision différée).

### 3.5. CommandPaletteProvider

```tsx
// src/modules/commandPalette/contexts/CommandPaletteProvider.tsx
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { config } = useSite();
  const enabled = config.commandPalette?.enabled ?? false;

  useGlobalShortcut(
    config.commandPalette?.keybinding ?? "mod+k",
    () => setOpen((o) => !o),
    { enabled }
  );

  const value = useMemo(
    () => ({ open, setOpen, openPalette: () => setOpen(true), closePalette: () => setOpen(false) }),
    [open]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {enabled && <CommandPalette />}
    </CommandPaletteContext.Provider>
  );
}
```

### 3.6. Composant `CommandPalette`

```tsx
// src/modules/commandPalette/components/CommandPalette.tsx
export function CommandPalette() {
  useLoadNamespace("modules/commandPalette");
  const t = useT("modules/commandPalette");
  const { open, setOpen, closePalette } = useCommandPalette();
  const [query, setQuery] = useState("");
  const { groups, loading } = useCommands(query);
  const navigate = useNavigate();
  const { me } = useCocolight();
  const { locale } = useLocalization();

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("dialog.title", "Rechercher")}
      description={t("dialog.description", "Tapez pour rechercher...")}
    >
      <CommandInput
        placeholder={t("input.placeholder", "Tapez une commande ou recherchez...")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && <CommandItem disabled>{t("loading", "Recherche...")}</CommandItem>}
        <CommandEmpty>{t("empty", "Aucun résultat")}</CommandEmpty>
        {groups.map(({ group, commands }) => (
          <CommandGroup key={group.id} heading={resolveLocalized(group.heading, locale, t)}>
            {commands.map((cmd) => (
              <CommandItemRenderer
                key={cmd.id}
                command={cmd}
                onSelect={() => cmd.perform({ navigate, close: closePalette, locale, me })}
              />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
```

### 3.7. Sources fournies par le core

**`navigationSource`** — consomme `useSite().config` :
- Toutes les `config.pages[]` (hors `path: "/"` séparé en première place) → commande `{ label: page.title, perform: navigate(page.path) }`.
- Récursion sur `config.header.nav[]` pour inclure les dropdowns (exclut `path === "#"`).
- Groupe : `core:navigation` heading "Navigation".

**`actionsSource`** — actions globales :
- Basculer thème (dark/light/system) — consomme `useTheme`.
- Changer de langue (itère `config.meta.languages`) — consomme `useLocalization`.
- Se connecter / Se déconnecter — consomme `useCocolight().userApi`.
- Aller à l'accueil (Cmd+H).
- Groupe : `core:actions` heading "Actions".

Ces deux sources sont auto-enregistrées via `src/modules/commandPalette/sources/index.ts` importé par `module.config.ts` ou via side-effect depuis `index.ts`.

### 3.8. Sources étendues (par d'autres modules)

Chaque module existant peut ajouter sa source en créant un fichier `src/modules/<m>/commands/register.ts` :

```ts
// src/modules/profil/commands/register.ts
import { registerCommandSource } from "@/modules/commandPalette";

registerCommandSource({
  namespace: "profil",
  groups: [{ id: "profil:entities", heading: { fr: "Entités", en: "Entities" } }],
  getCommands: async ({ query, me }) => {
    if (!query || query.length < 2) return [];
    const results = await searchEntities(query, me);   // via api.search / api.searchCostum
    return results.slice(0, 10).map((e) => ({
      id: `profil:${e.type}:${e._id}`,
      label: e.name,
      description: e.shortDescription,
      group: "profil:entities",
      icon: <EntityIcon type={e.type} />,
      keywords: [e.type, e.name],
      perform: ({ navigate, close }) => {
        navigate(`/profil/${e.slug}`);
        close();
      },
    }));
  },
});
```

Import du side-effect centralisé dans un fichier `src/modules/commandPalette/sources/bootstrap.ts` :
```ts
import "@/modules/profil/commands/register";
import "@/modules/news/commands/register";
// Ajout progressif, core-modules only
```

**Invariant** : un module **optional** ne doit **pas** être importé par `bootstrap.ts` (cela casserait le lazy-loading). Pour un module optional, on exposera une API `registerOnDemand()` qui s'enregistre dans le routeLoader async.

### 3.9. Schéma JSON — `commandPalette` top-level

```ts
// src/modules/commandPalette/schema.ts
import { z } from "zod";
import { LocalizedString } from "@/types/locale-schema";

export const CommandPaletteConfigSchema = z.object({
  enabled: z.boolean().default(true),
  keybinding: z.string().default("mod+k"),            // mod = Cmd sur mac, Ctrl sinon
  placeholder: LocalizedString.optional(),
  sources: z.array(z.string()).optional(),            // ["core:navigation", "profil", "news"] — undefined = toutes
  maxResultsPerGroup: z.number().int().positive().default(10),
  showRecent: z.boolean().default(true),              // historique localStorage
  showShortcuts: z.boolean().default(true),           // affiche les raccourcis kbd
}).strict();

export type CommandPaletteConfig = z.infer<typeof CommandPaletteConfigSchema>;
```

Intégration dans `src/types/site-schema.ts` :
```ts
import { CommandPaletteConfigSchema } from "@/modules/commandPalette/schema";

export const SiteConfig = z.object({
  // ... existant
  commandPalette: CommandPaletteConfigSchema.optional(),
});
```

**Extension `header.utilities`** — à modifier aux **deux endroits** (la vérité runtime est le Zod, l'interface TS est le miroir) :

1. **Zod (source de vérité runtime)** — `src/types/site-schema.ts:1485-1492` :
```ts
utilities: z.object({
  themeSwitch: z.boolean().default(true),
  langSwitch: z.boolean().default(true),
  search: z.boolean().default(false),
  auth: z.boolean().default(false),
  cart: z.boolean().default(false),
  notifications: z.boolean().default(false),
  commandPalette: z.boolean().default(false),  // ← AJOUT
}),
```
Ne pas oublier de mettre à jour les **exemples par défaut** plus bas dans le même fichier (lignes ~1822 et ~1868 : blocs `utilities: { themeSwitch: true, ... }`).

2. **Interface TS (miroir)** — `src/types/site.ts:13-20` :
```ts
utilities: {
  themeSwitch: boolean;
  langSwitch: boolean;
  search: boolean;
  auth: boolean;
  cart: boolean;
  notifications: boolean;
  commandPalette: boolean;  // ← AJOUT
};
```

### 3.10. Intégration RootLayout

Une seule modification à `src/RootLayout.tsx` dans `SiteShell` (ligne 35, juste avant `<Outlet />`) :

```tsx
<CommandPaletteProvider>
  <Outlet />
  <IntegrationsLoader />
  <Toaster />
  {AdminPanel && <Suspense fallback={null}><AdminPanel /></Suspense>}
  {config.floatingQRCode?.enabled && <FloatingQRCode ... />}
</CommandPaletteProvider>
```

Le provider enveloppe `Outlet` pour que `useCommandPalette()` soit accessible depuis les headers, et le composant `<CommandPalette />` est rendu à l'intérieur du provider (déjà dans son JSX).

### 3.11. Intégration SiteHeader

Chaque variante de header (`DefaultHeader`, `HeaderTiersLieux`, `HeaderRezoLaMer`, etc.) rend conditionnellement un `<CommandTriggerButton />` basé sur `header.utilities.commandPalette` :

```tsx
// Exemple DefaultHeader ligne ~260
{header.utilities.commandPalette && <CommandTriggerButton />}
```

```tsx
// src/modules/commandPalette/components/CommandTriggerButton.tsx
export function CommandTriggerButton() {
  const { openPalette } = useCommandPalette();
  const t = useT("modules/commandPalette");
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
  return (
    <Button variant="outline" size="sm" onClick={openPalette} className="gap-2">
      <Search className="h-4 w-4" />
      <span className="hidden md:inline">{t("trigger.label", "Rechercher")}</span>
      <kbd className="hidden md:inline px-1.5 py-0.5 text-xs bg-muted rounded">
        {isMac ? "⌘" : "Ctrl"}+K
      </kbd>
    </Button>
  );
}
```

### 3.12. Permissions

Le module expose ses propres permissions pour filtrer l'UI :

```ts
// src/modules/commandPalette/permissions/types.ts
export interface CommandPalettePermissions {
  canOpen: boolean;
  canRunAdminActions: boolean;
}
```

```ts
// src/modules/commandPalette/permissions/calculator.ts
export function calculateCommandPalettePermissions(ctx: PermissionContext): CommandPalettePermissions {
  return {
    canOpen: true,  // toujours
    canRunAdminActions: userHasRole(ctx.me, "admin"),
  };
}
```

```ts
// src/modules/commandPalette/permissions/register.ts
import { registerPermissions } from "@/lib/permissions";
import { calculateCommandPalettePermissions } from "./calculator";

registerPermissions({
  namespace: "commandPalette",
  calculate: calculateCommandPalettePermissions,
});
```

Ajout dans `src/hooks/useUserPermissions.tsx` :
```ts
import "@/modules/commandPalette/permissions/register";
```

### 3.13. i18n

Fichiers JSON minimalistes :

```json
// src/modules/commandPalette/i18n/fr.json
{
  "dialog": { "title": "Palette de commandes", "description": "Recherchez partout dans le site" },
  "input": { "placeholder": "Tapez une commande ou recherchez..." },
  "empty": "Aucun résultat",
  "loading": "Recherche...",
  "trigger": { "label": "Rechercher" },
  "groups": {
    "navigation": "Navigation",
    "actions": "Actions",
    "entities": "Entités",
    "news": "Actualités"
  }
}
```

Enregistrement dans `src/modules/commandPalette/i18n.ts` (side-effect importé par `index.ts`).

## 4. UX & raccourcis clavier

### Raccourcis natifs
- **Cmd+K / Ctrl+K** : toggle ouverture palette (configurable).
- **Esc** : ferme (géré par `CommandDialog`).
- **↑ / ↓** : navigation entre items (géré par `cmdk`).
- **Enter** : exécute la commande sélectionnée.
- **Tab** : (futur) autocomplétion.

### Raccourcis par commande
Une commande peut déclarer `shortcut: ["Cmd", "H"]` qui :
1. S'affiche à droite de l'item via `<CommandShortcut>`.
2. Est enregistré comme raccourci global via `useGlobalShortcut` (même hook que Cmd+K).

### Historique (Phase 2)
- Stocke les 5 dernières commandes exécutées dans `localStorage` (clé `commandPalette:recent:<siteSlug>`).
- Affiche un groupe "Récent" quand `query === ""`.

## 5. SSR & performance

### Contraintes SSR
- `CommandPaletteProvider` est rendu côté serveur (ne fait aucune requête au mount) → state initial `open: false`.
- `useGlobalShortcut` utilise `useEffect` → pas exécuté au SSR, pas de `document` accédé.
- `CommandDialog` de shadcn utilise Radix `Dialog` → gère déjà le portal SSR-safe.
- Le calcul `isMac` dans `CommandTriggerButton` : garde défensive `typeof navigator !== "undefined"` + default `Ctrl` au SSR (différence visuelle imperceptible côté client au premier paint).

### Bundle
- Aucun nouveau vendor chunk : `cmdk` est déjà dans le bundle via `src/components/ui/command.tsx`.
- Le module `commandPalette` est de type `core` → bundlé dans le chunk principal (pas de flash). Taille estimée < 10 KB gzip (logique hooks + registry).
- Sources asynchrones : chaque source qui requête le backend le fait **uniquement quand la palette est ouverte ET query.length >= 2** (condition dans `useCommands`).

### React Query
- Les sources async partagent le `QueryClient` déjà monté au niveau `entry-server` / `entry-client`.
- Clé de cache par source : `["commandPalette", namespace, debouncedQuery]`.
- `staleTime: 30_000` pour éviter les re-fetch identiques pendant une session.

## 6. Tests

### Unitaires (Vitest — `npm run test:unit`)
- `registry.test.ts` : enregistrement, doublons (warn + overwrite), reset testing.
- `useCommands.test.ts` : agrégation, débounce, filtrage fuzzy, tri par `group.order`.
- `calculator.test.ts` : permissions admin vs non-admin.
- `CommandPalette.test.tsx` : rendu des groupes, Empty state, Enter exécute `perform`, Esc ferme.

Pattern à cloner depuis `src/lib/__tests__/permissions.test.ts`.

### Intégration (SSR — `npm run test:integration`)
- Vérifie que le HTML SSR ne contient **pas** le dialog ouvert (sécurité : shortcut uniquement côté client).
- Vérifie que `CommandPaletteProvider` ne casse pas le streaming `renderToPipeableStream`.

### E2E (Playwright — `npm run test:e2e`)
- `e2e/command-palette.spec.ts` : press `Meta+K`, attend dialog visible, tape "accueil", sélectionne → URL devient `/`.
- Test config-driven : itère sur `config.pages` et vérifie qu'au moins la moitié des pages sont atteignables via la palette.

## 7. Roadmap d'implémentation

### Phase 1 — MVP (1-2 jours)
1. Créer l'arborescence `src/modules/commandPalette/` avec `module.config.ts`.
2. Implémenter `registry`, `types`, `CommandPaletteProvider`, `useCommandPalette`, `useGlobalShortcut`.
3. Composant `CommandPalette` branché sur `CommandDialog` shadcn.
4. Source `navigationSource` (pages depuis config).
5. Schéma Zod + extension `SiteConfig`.
6. Montage dans `RootLayout`.
7. i18n fr/en.
8. Tests unitaires registry + agrégation.

### Phase 2 — Actions & Profil (1 jour)
1. `actionsSource` : thème, langue, logout.
2. `src/modules/profil/commands/register.ts` : recherche entités backend.
3. `CommandTriggerButton` intégré à `DefaultHeader` derrière flag `header.utilities.commandPalette`.
4. Tests E2E basiques.

### Phase 3 — Finitions (1 jour)
1. Historique localStorage.
2. Raccourcis par commande (`useGlobalShortcut` générique).
3. Intégration dans toutes les variantes de header (`HeaderTiersLieux`, etc.).
4. Permissions filtering.
5. Docs utilisateur (capture vidéo, exemple JSON dans `doc/02-configuration.md`).

### Phase 4 — Extension (à la demande)
- Source `news` (dernières actualités).
- Source `admin` (liens rapides vers les panels de gestion, si `canRunAdminActions`).
- Support multi-touches (`Cmd+Shift+P` pour mode "palette avancée").

## 8. Risques & décisions à valider

| Risque | Décision proposée | Alternative |
|---|---|---|
| Conflit `Cmd+K` avec browser (certains navigateurs ouvrent la barre d'URL) | `preventDefault()` dans le listener + test E2E multi-browser | Fallback `Cmd+/` si détection browser connu |
| Palette ouverte pendant une saisie dans un `<input>` | Autoriser par défaut (UX attendue) mais ignorer si `e.target.tagName === "INPUT"` **et** config le demande | — |
| Variantes de headers custom (6 aujourd'hui) qui ne consomment pas `utilities.commandPalette` | Ajout incrémental avec un helper partagé `<HeaderUtilities />` à extraire (hors scope initial) | Tolérer que seule `DefaultHeader` expose le bouton en Phase 1 |
| Permission `canRunAdminActions` : rôle "admin" vient d'où dans `me.serverData.roles` ? | Utiliser `userRoles["admin"] === true` (voir CLAUDE.md §TypeScript) | Faire dépendre d'une permission profil existante |
| Sources async qui crashent silencieusement | `ErrorBoundary` autour de `CommandList` + try/catch dans `useCommands` qui marque la source comme `degraded` | Afficher une note "Source X indisponible" dans le groupe |

## 9. Arbre de décisions synthétique

```
Question                                        Réponse
─────────────────────────────────────────────── ────────────────────────
Section JSON ?                                  Non → overlay global
Dans src/modules/search/ ?                      Non → couplage inverse
Nouveau module ?                                Oui → src/modules/commandPalette/
Nouveau vendor chunk ?                          Non → cmdk déjà présent
Registry pattern ?                              Oui → miroir de lib/permissions
Config JSON top-level ?                         Oui → site.commandPalette (optionnel)
Flag header ?                                   Oui → header.utilities.commandPalette
Montage ?                                       RootLayout/SiteShell, avant <Outlet />
Permissions ?                                   namespace "commandPalette" dans registry existant
i18n ?                                          namespace "modules/commandPalette"
SSR-safe ?                                      Oui, aucun accès window/document au mount
Breaking change ?                               Non, tout est optionnel / par défaut off
```

## 10. Annexe — Fichiers impactés (récap)

| Fichier | Action | Lignes/nature |
|---|---|---|
| `src/modules/commandPalette/**/*` | **Créer** | Nouveau module complet |
| `src/RootLayout.tsx` | **Modifier** | Ajouter `CommandPaletteProvider` autour de `<Outlet />` (L.35) |
| `src/types/site-schema.ts` | **Modifier** | (a) Ajouter `commandPalette: CommandPaletteConfigSchema.optional()` dans `SiteConfig` ; (b) Ajouter `commandPalette: z.boolean().default(false)` dans `utilities` (L.1485-1492) ; (c) Mettre à jour les blocs d'exemple `utilities` plus bas (~L.1822, ~L.1868) pour qu'ils restent conformes |
| `src/types/site.ts` | **Modifier** | Ajouter `commandPalette: boolean` dans `HeaderConfig.utilities` (L.13-20) — **miroir TS du Zod** |
| `src/hooks/useUserPermissions.tsx` | **Modifier** | `import "@/modules/commandPalette/permissions/register"` |
| `src/components/layout/header/DefaultHeader.tsx` | **Modifier** | Ajouter `<CommandTriggerButton />` conditionnel (~L.260) |
| `src/modules/profil/commands/register.ts` | **Créer** | Source d'entités profil (Phase 2) |
| `src/modules/news/commands/register.ts` | **Créer** (Phase 4) | Source news |
| `src/modules/commandPalette/sources/bootstrap.ts` | **Créer** | Imports side-effect des sources modules |
| `config.prod.json` (et variantes) | **Modifier** | `commandPalette: { enabled: true }` + `header.utilities.commandPalette: true` |
| `doc/02-configuration.md` | **Mettre à jour** | Documenter le bloc `commandPalette` |
| `doc/10-permissions.md` | **Mettre à jour** | Ajouter namespace `commandPalette` |
| `e2e/command-palette.spec.ts` | **Créer** | Tests E2E |
