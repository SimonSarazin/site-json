[← Retour à l'index](README.md)

# Module Auth

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Arborescence](#arborescence)
- [Déclencheur global : `AuthModalProvider` + `useAuthModal()`](#déclencheur-global--authmodalprovider--useauthmodal)
- [Routes fournies par le module](#routes-fournies-par-le-module)
- [Deux modes d'affichage : modal et pages](#deux-modes-daffichage--modal-et-pages)
- [Variants de design](#variants-de-design)
- [Configuration `config.auth`](#configuration-configauth)
- [Composants](#composants)
  - [AuthModal](#authmodal)
  - [AuthModalLazy](#authmodallazy)
  - [AuthMenu](#authmenu)
  - [LoginButton](#loginbutton)
  - [LoginPrompt](#loginprompt)
  - [AuthGate](#authgate)
  - [GatedPageNotice](#gatedpagenotice)
  - [CurrentUserAvatar](#currentuseravatar)
  - [AuthPageLayout](#authpagelayout)
- [Hooks](#hooks)
  - [useAuthModal()](#useauthmodal)
  - [useAuthActions()](#useauthactions)
- [Formulaires — props et comportements](#formulaires--props-et-comportements)
- [Chargement (lazy)](#chargement-lazy)
- [Sections](#sections)
- [SEO (`AuthSeo`)](#seo-authseo)
- [SSO](#sso)
- [i18n](#i18n)
- [Schéma](#schéma)

## Vue d'ensemble

Le module `auth` (`src/modules/auth/`) regroupe toute l'authentification : connexion,
inscription, récupération de mot de passe, SSO et modal d'auth. C'est un module
`core` (chargé en eager, sans flash) découvert automatiquement comme les autres
modules (voir [Architecture](03-architecture.md) et la section *Module System*).

Il fournit ses **routes prêtes** — pages auth (`/login`, `/register`,
`/recover-password`) **et** les liens e-mail du backend (activation, invitation,
adhésion par lien) : voir [Routes fournies par le module](#routes-fournies-par-le-module).
Il n'est donc plus nécessaire de redéclarer ces pages dans chaque config JSON. Il
expose un mécanisme de **variants de design** (extensible par site) et permet de
personnaliser textes, header/footer et SEO via la section `config.auth`.

## Arborescence

```
src/modules/auth/
  module.config.ts          { name: "auth", type: "core", enabled: true }
  routes.tsx                routes: ModuleRouteFactory (_queryClient, config) → 12 routes (11 montées + `recover/:user/:code` en mode `node`) (cf. « Routes fournies par le module »)
  index.ts                  barrel (composants, contexte, hooks, sections, schema…)
  i18n.ts                   addResourceBundle("fr"/"en", "modules/auth", …, true, true)
  i18n/{fr,en}.json
  schema.ts                 schémas sections auth + AuthConfigSchema + AuthMenuConfigSchema
  AuthSeo.tsx               Helmet noindex + titre/description (pattern AmpliSeo/ProfileSeo)
  context/
    AuthModalContext.ts     AuthMode, AuthModalOptions, AuthModalContextValue, createContext
    AuthModalProvider.tsx   provider global monté dans SiteShell (autour de <Outlet />)
  components/
    AuthModal.tsx           modal multi-mode responsive (Sheet mobile / Dialog desktop)
    AuthModalLazy.tsx       point de montage lazy + transmet onSuccess/initialMode
    AuthPageLayout.tsx      layout des pages auth (header/footer configurables + AuthSeo + Suspense)
    AuthMenu.tsx            widget de compte configurable (header desktop/stack mobile)
    LoginButton.tsx         bouton générique « Se connecter » → openLogin()
    LoginPrompt.tsx         invite de connexion inline ou card
    AuthGate.tsx            garde client (connecté → children, sinon → LoginPrompt/fallback)
    CurrentUserAvatar.tsx   avatar utilisateur courant (OptimizedImage + repli initiales/icône)
    GatedPageNotice.tsx     ce qu'une page GARDÉE affiche à la place de ses sections (cf. 34-gardes-de-page.md)
    forms/
      LoginForm.tsx
      RegisterForm.tsx
      RecoverPasswordForm.tsx
      SSOLoginButton.tsx
    variants/
      registry.ts           resolveAuthVariant(variant?) → AuthVariantSet (lazy vite-preload)
  pages/
    LoginPage.tsx
    RegisterPage.tsx
    RecoverPasswordPage.tsx
    ResetPasswordPage.tsx        saisie d'un nouveau mot de passe (mode `node` seulement)
    ActivateAccountPage.tsx      activation de compte (liens Node + legacy Yii)
    ValidateInvitationPage.tsx   passerelle d'invitation → inscription
    AcceptInvitationPage.tsx     réponse Accepter/Refuser d'une invitation par e-mail
    JoinByLinkPage.tsx           lien d'adhésion partageable (connect/ref/:ref)
  sections/
    LoginFormSection.tsx
    RegisterFormSection.tsx
    RecoverPasswordFormSection.tsx
  hooks/
    useAuthModal.ts         accès au contexte global du modal (openLogin, close, isOpen)
    useAuthActions.ts       état + actions auth partagés (me, isConnected, logout, profileUrl…)
    useSSOAuth.ts
    __tests__/useSSOAuth.test.ts
```

## Déclencheur global : `AuthModalProvider` + `useAuthModal()`

Depuis le commit `537a9f3`, l'ouverture du modal de connexion est **centralisée**
en un seul point. Plus aucun header (ni aucun module) ne déclare son propre
`<AuthModalLazy>` ni son propre état `open`.

### Montage

`AuthModalProvider` est monté **une seule fois** dans `SiteShell`
(`src/RootLayout.tsx:44`), à l'intérieur de `CommandPaletteProvider`, autour
de `<Outlet />`. Il rend en interne le `<AuthModalLazy>` global et expose le
contexte `AuthModalContext`. Pattern calqué sur `CommandPaletteProvider`.

```tsx
// src/RootLayout.tsx (extrait)
<CommandPaletteProvider>
  <AuthModalProvider>
    <Outlet />
    {/* … Toaster, DiscourseGlobalModal, FloatingQRCode, FloatingActionButton */}
  </AuthModalProvider>
</CommandPaletteProvider>
```

### Contexte et types

`src/modules/auth/context/AuthModalContext.ts` définit :

```ts
/** Modes d'affichage du modal (basculés en interne, sans navigation). */
export type AuthMode = "login" | "register" | "recover";

/** Options passées à `openLogin()`. */
export interface AuthModalOptions {
  /** Joué quand la connexion réussit, AVANT la fermeture du modal (ex. `refetch`). */
  onSuccess?: () => void;
  /** Mode affiché à l'ouverture (défaut : `"login"`). */
  initialMode?: AuthMode;
}

export interface AuthModalContextValue {
  isOpen: boolean;
  openLogin: (options?: AuthModalOptions) => void;
  close: () => void;
}
```

### `useAuthModal()`

`src/modules/auth/hooks/useAuthModal.ts` — accès au contexte depuis n'importe
quel composant sous le provider :

```ts
import { useAuthModal } from "@/modules/auth";

const { openLogin, close, isOpen } = useAuthModal();

// Ouvrir la connexion depuis une action utilisateur :
openLogin();

// Ouvrir avec callback post-succès (ex. CoForm refetch) :
openLogin({ onSuccess: refetch });

// Ouvrir directement sur l'inscription :
openLogin({ initialMode: "register" });
```

Lève `Error("useAuthModal doit être utilisé sous <AuthModalProvider>")` si
appelé hors du provider.

### Consommateurs actuels

| Consommateur | Usage |
|---|---|
| Tous les headers (6 variantes) | via `<AuthMenu>` → `<LoginButton>` → `openLogin()` |
| `CoFormPage` | `openLogin({ onSuccess: refetch })` si non connecté |
| `NewsItem` | `openLogin()` pour réagir/commenter |
| `ActionButtonGroup` (profil) | `openLogin()` pour adhérer/suivre |
| `CardProfile` (search) | `openLogin()` pour suivre/contacter/ajouter |
| `GatedPageNotice` | `openLogin()` **une seule fois** sur une page gardée en mode `prompt` face à un anonyme |

## Routes fournies par le module

`routes.tsx` exporte une `ModuleRouteFactory` injectée par la découverte de
modules (`src/lib/modules.ts` → `src/lib/buildRoutes.tsx`). La factory reçoit
`(_queryClient, config)` — elle lit donc la config du site pour monter (ou non)
une de ses routes. `src/modules/auth/routes.tsx:32-72` déclare :

| path | page | rôle |
|---|---|---|
| `login` | `LoginPage` | connexion |
| `register` | `RegisterPage` | inscription |
| `recover-password` | `RecoverPasswordPage` | demande de récupération |
| `recover/:user/:code` | `ResetPasswordPage` | saisie d'un nouveau mot de passe — **montée seulement si `config.auth.recover.mode === "node"`** |
| `validate/:user/:validationKey?` | `ActivateAccountPage` | activation de compte (liens du backend Node) |
| `co2/person/activate/user/:user/validationKey/:validationKey` (+ forme avec splat `/*`) | `ActivateAccountPage` | mêmes liens, forme LEGACY Yii — le splat absorbe les suffixes `/costum/true`, `/redirect/…` |
| `co2/person/validateinvitation/user/:user/validationKey/:validationKey` (+ splat `/*`) | `ValidateInvitationPage` | passerelle d'invitation vers l'inscription (compte *pending*) |
| `co2/link/validateinvitationbymail/userId/:userId/targetType/:targetType/targetId/:targetId/answer/:answer` (+ splat `/*`) | `AcceptInvitationPage` | réponse Accepter/Refuser d'une invitation reçue par e-mail |
| `co2/link/connect/ref/:ref` | `JoinByLinkPage` | lien d'adhésion partageable (`costum.invitationLink`) |

Les deux formes (moderne et legacy) sont servies pour que les e-mails **déjà
envoyés** restent valides quand le domaine d'un costum pointe sur site-json.

Ces paths sont montés en enfants de `/`. Les pages auth ne doivent donc **pas**
être déclarées dans `config.pages` — sinon elles entreraient en collision avec
les routes du module.

## Deux modes d'affichage : modal et pages

Les mêmes formulaires servent dans deux contextes :

- **Modal global** (`AuthModalProvider` → `AuthModal`) — ouvert par
  `useAuthModal().openLogin()` depuis n'importe quel composant. Les 3
  formulaires basculent en interne via les callbacks `onSwitchToRegister` /
  `onSwitchToRecover` / `onSwitchToLogin` (pas de navigation). Responsive :
  `Sheet` ancrée en bas sur mobile, `Dialog` centré sur desktop (via
  `useIsMobile`, même pattern que `NotificationBell` et `CommandPalette`).
- **Pages** (`/login`, `/register`, `/recover-password`) — montés sans
  callbacks, les formulaires naviguent alors entre les routes. Toujours
  disponibles comme deep-links (ex. liens e-mail, guards `auth-required`).

### Modal vs route : quand utiliser lequel

| Contexte | Mécanisme recommandé |
|---|---|
| Déclenchement en cours de navigation (header, CTA, action utilisateur) | `openLogin()` → modal global |
| Page gardée, mode `prompt` (défaut) | `openLogin()` → modal global, sans quitter la page |
| Page gardée, mode `redirect` | route `/login` (deep-link), page visée mémorisée |
| Lien direct (e-mail, QR code) | route `/login` |
| Intégration dans un CoForm ou une section custom | `openLogin({ onSuccess })` → modal global |

La route `/login` reste disponible et fonctionnelle. Depuis l'introduction de
`page.auth.mode`, une page gardée ouvre par DÉFAUT la modale sans naviguer
(`prompt`) ; elle ne redirige vers `/login` que si le site pose
`"mode": "redirect"` — auquel cas la page visée est mémorisée et l'utilisateur y
revient après connexion. Voir [Gardes de page](34-gardes-de-page.md).

Chaque formulaire redirige s'il détecte un utilisateur déjà connecté
(`!loading && me?.isConnected` dans un `useEffect`), ce qui remplace l'ancien
middleware config `redirect-if-authenticated` sur ces pages. La destination
diffère selon le formulaire : `LoginForm` (`LoginForm.tsx:47`, `:95`) et
`RegisterForm` (`RegisterForm.tsx:58`, `:71`) renvoient vers
`returnTo = returnToOrHome(location.state)`, c'est-à-dire la page mémorisée par
la garde (`{ from: pathname + search }`), avec repli sur `/` ;
`RecoverPasswordForm` renvoie encore vers `/` en dur (`RecoverPasswordForm.tsx:61`).
Voir `src/lib/authRedirect.ts` et [Gardes de page](34-gardes-de-page.md).

## Variants de design

Le set de composants d'auth est résolu par `resolveAuthVariant(config.auth?.variant)`
(`components/variants/registry.ts`). C'est calqué sur le switch de `SiteHeader.tsx`
qui résout le header par `header.type`, mais **découplé** : un site peut combiner
un header X et un variant d'auth Y.

```ts
// Constantes module-level (évaluées une seule fois pour la stabilité entre rendus)
const LoginForm          = lazy(() => import("../forms/LoginForm"));
const RegisterForm       = lazy(() => import("../forms/RegisterForm"));
const RecoverPasswordForm = lazy(() => import("../forms/RecoverPasswordForm"));
const AuthModal          = lazy(() => import("../AuthModal"));

export interface AuthVariantSet {
  LoginForm: typeof LoginForm;
  RegisterForm: typeof RegisterForm;
  RecoverPasswordForm: typeof RecoverPasswordForm;
  AuthModal: typeof AuthModal;
}

export function resolveAuthVariant(variant?: string): AuthVariantSet {
  switch (variant) {
    default:
      return DEFAULT_SET; // composants par défaut (lazy vite-preload)
  }
}
```

Aujourd'hui un seul variant (`default`). Le switch est extensible : ajouter
`case "mon-variant": return MON_SET;` et un dossier de composants dédié.

Les membres de `AuthVariantSet` sont typés `typeof <constante>` (référence directe
à la constante `lazy()` locale) — il n'existe pas de type `LazyComponent` dans ce
module. Le `DEFAULT_SET` réutilise ces mêmes constantes module-level (évaluées une
seule fois pour rester stables entre les rendus).

## Configuration `config.auth`

Bloc top-level optionnel de la config site (validé par `AuthConfigSchema`,
`src/modules/auth/schema.ts:48`) :

```jsonc
{
  "auth": {
    "variant": "default",     // discriminant du registry (absent → "default")
    "menu": {                  // pilote AuthMenu dans tous les headers
      "density": "compact",    // "compact" | "normal" (défaut "normal")
      "showName": false,        // afficher le nom à côté de l'avatar
      "showDropdownHeader": true, // en-tête nom+email dans le dropdown
      "loginLabel": { "fr": "Rejoindre", "en": "Join" } // libellé bouton login
    },
    "hideHeader": false,       // masquer le SiteHeader sur les pages auth
    "hideFooter": false,       // masquer le SiteFooter sur les pages auth
    "login":    { "title": { "fr": "Se connecter", "en": "Sign in" },
                  "subtitle": { "fr": "…", "en": "…" } },
    "register": { "title": { "fr": "…" }, "subtitle": { "fr": "…" } },
    "recover":  { "title": { "fr": "…" }, "subtitle": { "fr": "…" },
                  "mode": "legacy" }   // "legacy" (défaut de fait) | "node" — cf. ci-dessous
  }
}
```

### `config.auth.menu` — `AuthMenuConfigSchema`

Ce sous-bloc pilote la présentation du widget de compte (`AuthMenu`) dans
**tous les headers** simultanément. Il prime sur les props du header, qui
restent utilisées comme défaut si le bloc `menu` est absent.

| Champ | Type | Description |
|---|---|---|
| `density` | `"compact" \| "normal"` | Taille de l'avatar (compact : `h-7 w-7 lg:h-8 lg:w-8`, normal : `h-8 w-8`) |
| `showName` | `boolean` | Afficher le nom de l'utilisateur à côté de l'avatar |
| `showDropdownHeader` | `boolean` | Afficher un en-tête nom + email dans le dropdown |
| `loginLabel` | `LocalizedString` | Libellé du bouton « Se connecter » — surchargé par la prop `loginLabel` du header |
| `kanban` | `boolean` | Opt-in : entrée « Kanban » (nouvel onglet vers la vue actions de la plateforme), réservée aux admins du costum — gate `isKanbanEntryVisible` (modules/admin), détails dans [doc/30-module-admin.md](30-module-admin.md) |

Le `tone` (défaut / onColor) et le `loginVariant` (ghost / solid / outline)
restent couplés au design du header (props du composant), pas à `config.auth.menu`.

### `config.auth.recover.mode` — quel flux « mot de passe oublié »

`recover` n'est pas un simple bloc de textes (`AuthRecoverConfigSchema =
AuthPageTextSchema.extend({ mode })`, `src/modules/auth/schema.ts:43-46`) : sa clé
`mode` commande **un changement de flux complet**.

| valeur | flux | route `/recover/:user/:code` |
|---|---|---|
| absente (= `"legacy"`) | le backend legacy régénère un mot de passe aléatoire et l'envoie par e-mail — ni lien, ni page de saisie | **non montée** |
| `"node"` | le backend Node envoie un lien `/recover/:user/:code` → `ResetPasswordPage` (endpoint `PASSWORD_RESET`) | montée |

La route est gatée sur cette valeur dans `routes.tsx:40-42` : en `legacy`,
`ResetPasswordPage` n'existe pas — pour ne pas exposer une page morte contre un
backend qui n'émet jamais ce lien. À n'activer que sur un déploiement servi par le
backend Node.

> ⚠️ La config n'est **jamais** parsée par Zod au runtime : le `.optional()` du schéma
> ne pose aucun défaut. Le repli `legacy` vit dans le code (la comparaison
> `config?.auth?.recover?.mode === "node"` de `routes.tsx`) — pour opter, il faut
> écrire la clé **explicitement** dans le JSON. Une clé oubliée n'échoue pas : le
> lien reçu par e-mail tombe sur le catch-all du routeur
> (`{ path: "*", element: <SiteRenderer /> }`, `src/lib/buildRoutes.tsx:216`), servi
> en 200 — **sans erreur, donc invisible en recette**.

### Autres champs

- `title` / `subtitle` alimentent le titre et le sous-titre de chaque formulaire
  des pages auth. En l'absence de texte, le formulaire retombe sur ses libellés
  i18n par défaut.
- Le `subtitle` est passé comme `description` à `AuthPageLayout` → `AuthSeo`
  (`<meta name="description">`).
- `hideHeader` / `hideFooter` s'appliquent uniquement au mode pages
  (`/login` etc.) ; la modal n'a pas de header/footer.

## Composants

### `AuthModal`

Modal multi-mode responsive (`src/modules/auth/components/AuthModal.tsx`). Props :

```ts
interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Joué quand la connexion réussit, avant fermeture (ex. `refetch` côté CoForm). */
  onSuccess?: () => void;
  /** Mode affiché à l'ouverture (défaut : `"login"`). */
  initialMode?: AuthMode;  // "login" | "register" | "recover"
}
```

**Responsive** : sur mobile (`useIsMobile()`), rend un `<Sheet side="bottom">` (panel
glissant en bas, `max-h-[90vh]`, `rounded-t-2xl`) ; sur desktop, rend un `<Dialog>`
centré (`sm:max-w-md`). Même pattern que `NotificationBellImpl` et `CommandPalette`.

Repart sur `initialMode` à chaque réouverture : `AuthModalLazy` démonte la modal
quand elle est fermée (`!open → return null`), donc le state `mode` est réinitialisé
au remontage — pas besoin d'un effet de reset. Un `<DialogTitle className="sr-only">`
(ou `<SheetTitle>`) est rendu pour les lecteurs d'écran sans être visible.

Quand `onSuccess` est fourni, il est appelé **avant** `close()` — ce qui permet
de rejouer un refetch avant que l'overlay disparaisse.

### `AuthModalLazy`

Point de montage lazy du modal global (`src/modules/auth/components/AuthModalLazy.tsx`).
Props :

```ts
interface AuthModalLazyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialMode?: AuthMode;
}
```

Ne monte `AuthModal` que lorsque `open === true` (`if (!open) return null`), sous
`<Suspense fallback={null}>`. Le variant de design est résolu via
`config.auth?.variant` (registry). Transmet `onSuccess` et `initialMode` à
`AuthModal`.

Utilisé exclusivement par `AuthModalProvider` (plus par les headers directement).

### `AuthMenu`

Widget de compte configurable pour les headers (`src/modules/auth/components/AuthMenu.tsx`).
Remplace les anciens widgets auth dupliqués dans chaque variante de header.

```ts
interface AuthMenuProps {
  density?: "compact" | "normal";        // surchargée par config.auth.menu.density
  tone?: "default" | "onColor";          // "onColor" : texte blanc sur fond sombre
  layout?: "menu" | "stack";             // "menu" = dropdown desktop ; "stack" = mobile
  loginVariant?: "ghost" | "solid" | "outline";
  loginLabel?: LocalizedString;          // libellé bouton — surchargé par config.auth.menu.loginLabel
  loginClassName?: string;               // classes extras du bouton login (ex. shadow-glow)
  showName?: boolean;                    // surchargée par config.auth.menu.showName
  showDropdownHeader?: boolean;          // surchargée par config.auth.menu.showDropdownHeader
  showChevron?: boolean;                 // défaut true
  onAction?: () => void;                 // appelé après une action (ex. refermer le menu mobile)
  className?: string;
}
```

**Connecté** : affiche un `<DropdownMenu>` (layout `"menu"`) ou des boutons pleine
largeur (layout `"stack"`) avec « Profil » (`/profil/:slug`) et « Se déconnecter ».
**Déconnecté** : affiche un `<LoginButton>` qui ouvre le modal global.

Toujours sous `<ClientOnly>` (pas de flash de contenu privé en SSR, cf. gotcha #10).

Précédence des props affichage : `config.auth.menu` > prop du header > défaut.

**Utilisé par tous les 6 headers** :

| Header | `tone` | `layout desktop` | `loginVariant` |
|---|---|---|---|
| `HeaderStandard` | default | menu | ghost |
| `HeaderMegaMenu` | default | menu | solid |
| `HeaderMinimal` | default | menu | ghost |
| `HeaderTransparentDark` | onColor | menu | outline |
| `HeaderTransparentScroll` | default | menu | solid |
| `HeaderUnderlineNav` | default | menu | solid |

### `LoginButton`

Bouton générique « Se connecter » (`src/modules/auth/components/LoginButton.tsx`).
Ouvre le modal global via `useAuthModal().openLogin`. Props :

```ts
interface LoginButtonProps {
  label?: ReactNode;           // libellé déjà résolu ; défaut : « Se connecter »
  variant?: ButtonVariant;     // défaut "default"
  size?: ButtonSize;           // défaut "sm"
  className?: string;
  openOptions?: AuthModalOptions;  // { onSuccess?, initialMode? }
  onClick?: () => void;        // effet de bord avant ouverture (ex. refermer menu mobile)
}
```

Utilisé par `AuthMenu` et `LoginPrompt`. Réutilisable partout pour déclencher
la connexion de manière cohérente.

### `LoginPrompt`

Invite de connexion contextuelle (`src/modules/auth/components/LoginPrompt.tsx`).
S'utilise à la place d'un bouton désactivé ou d'un `toast.error`. Props :

```ts
interface LoginPromptProps {
  message?: ReactNode;             // incitation (ex. « Connectez-vous pour commenter »)
  loginLabel?: ReactNode;          // libellé du bouton (défaut : « Se connecter »)
  openOptions?: AuthModalOptions;
  variant?: "inline" | "card";     // défaut "inline"
  className?: string;
}
```

- **`inline`** : bandeau discret (`flex`, `rounded-lg`, `bg-muted/40`) avec le
  message à gauche et le `LoginButton` à droite.
- **`card`** : encadré centré (`rounded-xl`, `border-border`, `bg-muted/30`) avec
  icône `LogIn`, message et bouton empilés.

### `AuthGate`

Garde d'accès générique (`src/modules/auth/components/AuthGate.tsx`). Montre
`children` si connecté, sinon une invite de connexion. Sous `ClientOnly` pour
éviter tout flash de contenu privé en SSR. Props :

```ts
interface AuthGateProps {
  children: ReactNode;
  fallback?: ReactNode;        // rendu si non connecté (défaut : <LoginPrompt>)
  message?: ReactNode;         // message du LoginPrompt par défaut
  openOptions?: AuthModalOptions;
}
```

Généralise le pattern `CoFormAccessGuard` (cas `not_logged_in`).

### `GatedPageNotice`

Ce qu'une **page gardée** (`page.auth`) affiche à la place de ses sections
(`src/modules/auth/components/GatedPageNotice.tsx`), rendu par `SiteRenderer`.
Voir [Gardes de page](34-gardes-de-page.md). Props :

```ts
interface GatedPageNoticeProps {
  mode: PageGateMode;   // "prompt" | "redirect" | "hide" (src/lib/pageAccess.ts)
  reason: GateReason;   // "anonymous" | "role"
  resolved: boolean;    // l'accès est-il déjà tranché ? Avant hydratation : aucun refus affiché
}
```

Trois rendus :
- `!resolved` ou `mode === "redirect"` → message d'attente neutre
  (« Vérification de votre accès… ») — au SSR `me` vaut toujours `null`, donc aucun
  verdict n'est jamais rendu côté serveur ;
- `resolved` + `reason === "anonymous"` + `mode === "prompt"` → `<LoginPrompt variant="card">`,
  et `useAuthModal().openLogin()` est appelé **une seule fois** (verrou `useRef`) : la modale
  s'ouvre par-dessus, l'invitation reste derrière si l'utilisateur la ferme ;
- `mode === "hide"`, ou `reason === "role"` quel que soit le mode → un refus (icône `Lock`),
  sans proposer une connexion qui ne changerait rien à un utilisateur déjà connecté.

### `CurrentUserAvatar`

Avatar de l'utilisateur courant (`src/modules/auth/components/CurrentUserAvatar.tsx`).
Sert via l'optimiseur `/img` (`OptimizedImage`), avec repli initiales → icône `User`.

```ts
interface CurrentUserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;            // taille Tailwind, ex. "h-8 w-8"
  fallbackClassName?: string;    // couleurs du repli selon le tone
  size?: number;                 // résolution source demandée à /img (px). Défaut 32
}
```

Le repli est rendu **en dessous** de l'image : visible tant que l'image ne s'est
pas peinte, et de nouveau si elle échoue (`onError` mémorise l'URL en erreur — pas
un booléen, pour que l'image réapparaisse si `avatarUrl` change). Les initiales
sont les 2 premières lettres des mots du nom (`"Jean Dupont"` → `"JD"`).

Réservé à l'utilisateur **courant** (`me`). Pour les avatars d'autres entités
(cards, commentaires, membres), utiliser `@/components/ui/avatar`.

### `AuthPageLayout`

Enveloppe les pages auth. Props :

```ts
function AuthPageLayout({
  children,
  title,          // LocalizedString optionnel → AuthSeo + titre form
  description,    // LocalizedString optionnel → AuthSeo meta description
}: {
  children: ReactNode;
  title?: LocalizedString;
  description?: LocalizedString;
})
```

Rend : `<AuthSeo>`, `<SiteHeader>` / `<SiteFooter>` conditionnels
(`config.auth.hideHeader` / `hideFooter`, défaut : affiché), formulaire centré
(`max-w-md px-4`) sous `<Suspense>` avec fallback texte (`Loading…`). Le
`SiteHeader` importé est `@/components/layout/SiteHeader` (composant générique
résolvant lui-même le variant de header).

### `LoginForm` / `RegisterForm` / `RecoverPasswordForm`

Formulaires en `<form onSubmit>` (soumission clavier), composants shadcn (`Input`,
`Button`, `Checkbox` + `Label` pour le « Se souvenir de moi » dans `LoginForm`,
`PasswordToggleTextInput`), validation `isValidEmail`, retours utilisateur via
`sonner`. Chaque formulaire affiche un spinner de chargement tant que le namespace
i18n n'est pas chargé (`useLoadNamespace` → `!loaded → return <Loading…>`).

## Hooks

### `useAuthModal()`

`src/modules/auth/hooks/useAuthModal.ts` — consomme `AuthModalContext`. Retourne
`{ isOpen, openLogin, close }`. Lève une erreur hors provider. Voir la section
[Déclencheur global](#déclencheur-global--authmodalprovider--useauthmodal) pour
l'usage complet.

### `useAuthActions()`

`src/modules/auth/hooks/useAuthActions.ts` — source unique de vérité pour l'état
d'authentification partagé entre composants (indépendant de l'UI).

Remplace l'ex-`useHeaderAuth` (supprimé), qui vivait dans
`src/components/layout/header/`.

```ts
// Retour du hook
{
  me: User | null;           // utilisateur connecté (via useCocolight())
  isConnected: boolean;      // !!me?.isConnected
  logout: () => void;        // api?.logout() + navigate("/")
  profileUrl: string;        // "/profil/:slug" ou "/profile" si slug absent
  name: string | null;       // me.serverData.name (réactif via useReactiveProperty)
  avatarUrl: string | null;  // me.serverData.profilThumbImageUrl (réactif)
  email: string | null;      // me.serverData.email (réactif)
}
```

Les propriétés réactives (`name`, `avatarUrl`, `email`) sont extraites via
`useReactiveProperty<string>(me?.serverData, "…")` — elles se mettent à jour
si le serveur pousse une modification sans remontage de composant.

NB : le React Compiler gère la mémoïsation — pas de `useCallback`/`useMemo`
manuels dans ce hook (règle eslint `react-hooks/preserve-manual-memoization`).

**Utilisé par** : `AuthMenu`, `CurrentUserAvatar` (via `AuthMenu`), `AuthGate`.

## Formulaires — props et comportements

### `LoginForm`

```ts
interface LoginFormProps {
  onSuccess?: () => void;        // appelé après connexion réussie
  hideBackButton?: boolean;      // masque le bouton "Retour à l'accueil" (défaut: false)
  onSwitchToRegister?: () => void; // mode modal : bascule interne
  onSwitchToRecover?: () => void;  // mode modal : bascule interne
}
```

- Après connexion réussie : `onSuccess?.()` est toujours appelé (si fourni), puis
  `navigate(returnTo)` est déclenché **uniquement si `hideBackButton === false`** (valeur
  par défaut). C'est `hideBackButton` — et lui seul — qui discrimine le comportement
  de navigation, pas la présence ou l'absence des callbacks.
- `returnTo` est calculé **une fois** en haut du composant (`LoginForm.tsx:47`) par
  `returnToOrHome(location.state)` : la page mémorisée par la garde en mode `redirect`
  (`{ from: pathname + search }`, filtre d'URL compris), repli `/`, refus des URL
  externes et protocole-relatives (`src/lib/authRedirect.ts`). Les trois points de
  navigation post-succès l'utilisent (effet centralisé `:95`, `handleLogin` `:159`,
  `onSuccess` du bouton SSO `:278`).
- En mode modal (`hideBackButton=true`) : pas de navigation après succès.
- En mode page (`hideBackButton=false`) : navigue vers `/register` ou
  `/recover-password` via les boutons de bascule — en **transmettant le même `state`**
  (`LoginForm.tsx:292`, `:303`), pour que la destination mémorisée survive à la
  bascule ; navigue vers `returnTo` après connexion réussie.
- Erreurs HTTP 401/404 → message "Email ou mot de passe incorrect".
- Affiche les `SSOLoginButton` si `entity?.serverData.costum.sso` contient des
  providers (voir [SSO](#sso)).
- **Mode SSO-only** (`costum.connectOnlyBySSO === true` + au moins un provider) :
  le formulaire email/mot de passe **et** les liens inscription / mot de passe
  oublié sont masqués ; seuls les `SSOLoginButton` restent (sans le séparateur
  « ou continuer avec »). Voir [SSO → Mode SSO-only](#mode-sso-only-connectonlybysso).
- **Auto-trigger SSO** : si `connectOnlyBySSO` est actif **et** qu'il n'y a
  **qu'un seul** provider, la popup SSO s'ouvre automatiquement au montage du
  formulaire (typiquement juste après le clic « Se connecter » dans le header,
  donc encore dans la fenêtre de *user gesture* → pas de blocage popup).
- Redirection centralisée : un `useEffect` unique observe `me.isConnected` et
  déclenche `onSuccess?.()` + `navigate(returnTo)` (si `!hideBackButton`), quel que soit
  le chemin de connexion (email/pwd, SSO classique, auto-trigger). Évite la course
  entre le `postMessage` SSO et la détection `popup.closed`.

### `RegisterForm`

```ts
interface RegisterFormProps {
  onSwitchToLogin?: () => void; // mode modal : bascule interne
}
```

Champs : nom complet (`name`), nom d'utilisateur (`username`), e-mail, mot de
passe, confirmation mot de passe. Validation : nom requis, username requis, email
valide, mot de passe ≥ 6 caractères, mots de passe identiques. Après succès :
bascule sur login (modal) ou navigue vers `/login` (page). Le bouton "Retour à
l'accueil" n'apparaît qu'en mode page (`!onSwitchToLogin`).

### `RecoverPasswordForm`

```ts
interface RecoverPasswordFormProps {
  onSwitchToLogin?: () => void; // mode modal : bascule interne
}
```

Deux états visuels :
1. **Formulaire** — saisie de l'email + bouton "Envoyer le lien de récupération".
   Gère spécifiquement `errId === "UNKNOWN_ACCOUNT_ID"` (message dédié "Aucun
   compte n'est associé à cette adresse e-mail.").
2. **Confirmation** — après envoi réussi, affiche un écran avec icône
   `CheckCircle`, l'adresse e-mail confirmée, et deux boutons : "Retour à la
   connexion" et "Renvoyer l'e-mail" (remet le formulaire dans l'état initial).

Le bouton "Retour à l'accueil" n'apparaît qu'en mode page (`!onSwitchToLogin`).

### `SSOLoginButton`

```ts
interface SSOLoginButtonProps {
  provider: string;      // slug OAuth (ex: "tierslieuxorg") — sert à construire l'URL du logo
  label?: string;        // libellé bouton (défaut: provider)
  onSuccess?: () => void;
  className?: string;
}
```

- Logo chargé depuis `{getBaseUrl()}/images/logoOauth/{provider}.jpg` ; en cas
  d'erreur de chargement (`onError`), l'image est masquée proprement.
- Appelle `useSSOAuth().openSSOPopup(provider)` ; gère loading state et affiche
  `toast.error` si `result.error` est défini.

## Chargement (lazy)

Bien que le module soit `core` (sa **découverte** et ses **routes** sont eager,
pour le routing SSR sans flash), ses composants lourds sont **code-splittés** via
`lazy()` de `vite-preload` — rien de tout ça n'est dans le bundle initial :

| Chunk | Chargé quand |
|---|---|
| `AuthModal` (+ forms) | à la première ouverture du modal global (`AuthModalLazy` monte au `open === true`) |
| `LoginForm` | modal ouverte en mode `"login"` ou page `/login` |
| `RegisterForm` | bascule register dans le modal ou page `/register` |
| `RecoverPasswordForm` | bascule recover dans le modal ou page `/recover-password` |

Le `registry` expose des composants lazy ; les consommateurs les rendent sous
`Suspense` :
- `AuthPageLayout` pour les pages (Suspense avec fallback texte `Loading…`)
- `AuthModalLazy` (via `AuthModalProvider`) pour le modal global (`Suspense fallback={null}`)

`CoFormPage` utilise désormais `useAuthModal().openLogin({ onSuccess: refetch })`
au lieu d'un dialog login privé.

Les imports directs de `LoginForm` / `RegisterForm` / `RecoverPasswordForm`
subsistant dans `AuthModal.tsx` et les `*Section` sont eux-mêmes contenus dans
des chunks déjà lazy.

## Sections

Pour un usage custom en config, 3 sections sont enregistrées dans
`SectionRenderer` via `lazy(() => import("@/modules/auth/sections/…"))` :
`loginForm`, `registerForm`, `recoverPasswordForm`. Elles rendent le formulaire
correspondant dans un `<section>` centré (`max-w-md`, `py-16`). Les routes du
module couvrant déjà `/login` etc., ces sections ne sont nécessaires que si l'on
veut embarquer un formulaire dans une page existante du config.

Les sections ne wrappent pas elles-mêmes dans un `Suspense` — le lazy loading
est géré par `SectionRenderer`. Les formulaires gèrent leur propre état de
chargement i18n (`!loaded → spinner`).

## SEO (`AuthSeo`)

`AuthSeo.tsx` suit le pattern des autres modules (`AmpliSeo`, `ProfileSeo`) :
un `<Helmet>` dédié (`@dr.pogodin/react-helmet`). Il force `robots: noindex,
nofollow` sur les pages auth (parité avec l'ancien `seo.noIndex` des pages
config). Le titre est résolu ainsi : `title` prop en priorité, sinon fallback
sur `config.meta?.title` (titre du site). La `description` prop alimente
`<meta name="description">` uniquement si non vide. Il est monté par
`AuthPageLayout` et reçoit les valeurs de `config.auth?.login/register/recover`.

Props :

```ts
interface AuthSeoProps {
  title?: LocalizedString;       // absent → fallback sur config.meta.title
  description?: LocalizedString; // absent → pas de meta description
}
```

## SSO

Le SSO est piloté par le **backend**, pas par la config JSON : les providers
viennent de `entity?.serverData.costum.sso`, extraits via un cast local
(`(entity?.serverData.costum as { sso?: string[] })?.sso || []`) — il n'y a pas
de garantie de type en amont sur ce champ.
En mode standard, `LoginForm` affiche un `SSOLoginButton` par provider sous le
formulaire email/mot de passe, précédé d'un séparateur « ou continuer avec ».

### Mode SSO-only (`connectOnlyBySSO`)

Quand l'entité costum définit `connectOnlyBySSO: true` (champ frère de `sso`, lu
via `(entity?.serverData?.costum as { connectOnlyBySSO?: boolean })?.connectOnlyBySSO`),
`LoginForm` masque entièrement le formulaire email/mot de passe et les liens
inscription / mot de passe oublié : seuls les boutons SSO restent.

- **Plusieurs providers** : la liste des `SSOLoginButton` est affichée, sans le
  séparateur « ou continuer avec ».
- **Un seul provider** : l'**auto-trigger** s'active — la popup SSO s'ouvre dès le
  montage du formulaire, piloté par une machine à états
  `"idle" | "running" | "failed"` :
  - `running` → un spinner « Connexion en cours… » remplace le bouton SSO ;
  - succès → redirection via l'effet centralisé `me.isConnected` ;
  - annulation (popup fermée → `success:false` sans `error`) **ou** erreur (popup
    bloquée, `SSO_AUTH_ERROR`) → bascule en `failed` : le bouton SSO manuel
    réapparaît pour réessayer. Une fois sorti de `idle`, l'auto-trigger ne se
    redéclenche **jamais** seul (ni boucle de popups, ni spinner figé).

Le hook `useSSOAuth` gère le flux complet :

```ts
// Retour du hook
{ openSSOPopup: (service: string) => Promise<SSOAuthResult> }

interface SSOAuthResult {
  success: boolean;
  error?: string; // défini si success===false et erreur explicite ; absent si annulation
}
```

`openSSOPopup(service)` :
1. Ouvre une popup vers `{backendUrl}/co2/sso/services?authclient={service}&origin={origin}`
   centrée (600×700).
2. En cas de popup bloqué par le navigateur : résout immédiatement `{ success: false, error: "Popup bloqué par le navigateur" }`.
3. Écoute `window.addEventListener("message")` ; filtre strictement sur
   `event.origin === backendOrigin` (sécurité CSRF).
4. `SSO_AUTH_SUCCESS` → appelle `apiClient.setToken(accessToken)`,
   `apiClient.setRefreshToken(refreshToken)` (si fourni), `apiClient.emit("userLoggedIn")`
   pour que `CocolightProvider` mette à jour l'état. Résout `{ success: true }`.
5. `SSO_AUTH_ERROR` → résout `{ success: false, error: event.data.error }`.
6. Polling (`setInterval` 500 ms) : si popup fermé manuellement avant réponse →
   résout `{ success: false }` sans `error`.
7. Cleanup au démontage du composant : un `useEffect` à deps `[]` appelle
   `cleanupRef.current?.()` lors du démontage. La fonction de nettoyage effective
   est assignée dans `openSSOPopup` via `cleanupRef.current = cleanup` — le
   `useEffect` se contente de la déclencher si elle existe.

Le hook est testé par `hooks/__tests__/useSSOAuth.test.ts` (Vitest + jsdom,
`@testing-library/react`). Les cas couverts : ouverture popup, encodage service,
popup bloqué, filtrage d'origine, payload SSO_AUTH_SUCCESS/ERROR, type inconnu
ignoré, fermeture manuelle, apiClient null, cleanup au démontage.

Pour le flux complet, voir aussi [API & Authentification](11-api-authentification.md#sso--single-sign-on).

## i18n

Namespace `modules/auth`. `i18n.ts` appelle :

```ts
i18n.addResourceBundle("fr", "modules/auth", fr, true, true);
i18n.addResourceBundle("en", "modules/auth", en, true, true);
```

(Les arguments `true, true` activent le mode deep merge + override.)

Le bundle est chargé en side-effect par le barrel (`import "./i18n"`). Les
composants chargent via `useLoadNamespace("modules/auth")` + `useT("modules/auth")`.
Voir [i18n](13-i18n.md).

Clés notables dans les bundles `i18n/{fr,en}.json` :
- Login : `Se connecter`, `Adresse e-mail`, `Mot de passe`, `Se souvenir de moi`,
  `Mot de passe oublié ?`, `Pas encore de compte ?`, `S'inscrire`,
  `Retour à l'accueil`, `Email ou mot de passe incorrect`
- Register : `Créer un compte`, `Nom complet`, `Nom d'utilisateur`,
  `Confirmer le mot de passe`, `Créer mon compte`, `Déjà un compte ? Se connecter`,
  `Le mot de passe doit contenir au moins 6 caractères`,
  `Les mots de passe ne correspondent pas`
- Recover : `Mot de passe oublié`, `Envoyer le lien de récupération`,
  `E-mail envoyé`, `Renvoyer l'e-mail`, `Retour à la connexion`,
  `Compte introuvable`, `Aucun compte n'est associé à cette adresse e-mail.`
- Page gardée (`GatedPageNotice`) : `Vérification de votre accès…`,
  `Cette page est réservée. Connectez-vous pour y accéder.`,
  `Votre compte n'a pas les droits nécessaires pour voir cette page.`,
  `Cette page est réservée.`

## Schéma

`schema.ts` (`src/modules/auth/schema.ts`) exporte les schémas des 3 sections
auth, `AuthMenuConfigSchema`, `AuthConfigSchema` et leurs types dérivés.
`src/types/site-schema.ts` les importe et les ré-exporte (rétro-compat) ; le
champ `auth` de la config site est `AuthConfigSchema.optional()`. Même pattern
de modularisation que `cagnotte` et `search`.

Les 3 schémas de sections ont des `props` vides — aucune prop de config attendue :

```ts
export const LoginFormSectionSchema = z.object({
  type: z.literal("loginForm"),
  id: z.string().optional(),
  props: z.object({}),
});
// idem RegisterFormSectionSchema, RecoverPasswordFormSectionSchema

const AuthMenuConfigSchema = z.object({
  density: z.enum(["compact", "normal"]).optional(),
  showName: z.boolean().optional(),
  showDropdownHeader: z.boolean().optional(),
  loginLabel: LocalizedString.optional(),
  kanban: z.boolean().optional(),          // entrée « Kanban », opt-in (cf. tableau config.auth.menu)
});
export type AuthMenuConfig = z.infer<typeof AuthMenuConfigSchema>;

// Textes + MÉCANISME du « mot de passe oublié » (cf. config.auth.recover.mode).
const AuthRecoverConfigSchema = AuthPageTextSchema.extend({
  mode: z.enum(["legacy", "node"]).optional(),
});
export type AuthRecoverConfig = z.infer<typeof AuthRecoverConfigSchema>;

export const AuthConfigSchema = z.object({
  variant: z.string().optional(),
  menu: AuthMenuConfigSchema.optional(),   // ← nouveau
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  login:    AuthPageTextSchema.optional(), // { title?, subtitle? }
  register: AuthPageTextSchema.optional(),
  recover:  AuthRecoverConfigSchema.optional(), // { title?, subtitle?, mode? }
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
```
