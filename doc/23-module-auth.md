[← Retour à l'index](README.md)

# Module Auth

**Sommaire**

- [Vue d'ensemble](#vue-densemble)
- [Arborescence](#arborescence)
- [Routes fournies par le module](#routes-fournies-par-le-module)
- [Deux modes d'affichage : modal et pages](#deux-modes-daffichage--modal-et-pages)
- [Variants de design](#variants-de-design)
- [Configuration `config.auth`](#configuration-configauth)
- [Composants](#composants)
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

Il fournit ses **routes prêtes** (`/login`, `/register`, `/recover-password`) — il
n'est donc plus nécessaire de redéclarer ces pages dans chaque config JSON. Il
expose un mécanisme de **variants de design** (extensible par site) et permet de
personnaliser textes, header/footer et SEO via la section `config.auth`.

## Arborescence

```
src/modules/auth/
  module.config.ts        { name: "auth", type: "core", enabled: true }
  routes.tsx              routes: ModuleRouteFactory → /login, /register, /recover-password
  index.ts                barrel (AuthModal, forms, sections, routes, schema, hooks…)
  i18n.ts                 addResourceBundle("fr"/"en", "modules/auth", …, true, true)
  i18n/{fr,en}.json
  schema.ts               schémas des sections auth + AuthConfigSchema
  AuthSeo.tsx             Helmet noindex + titre/description (pattern AmpliSeo/ProfileSeo)
  components/
    AuthModal.tsx         modal multi-mode (login / register / recover)
    AuthModalLazy.tsx     point de montage lazy de la modal (montage conditionnel + Suspense)
    AuthPageLayout.tsx    layout des pages auth (header/footer configurables + AuthSeo + Suspense)
    forms/
      LoginForm.tsx
      RegisterForm.tsx
      RecoverPasswordForm.tsx
      SSOLoginButton.tsx
    variants/
      registry.ts         resolveAuthVariant(variant?) → AuthVariantSet (composants lazy)
  pages/
    LoginPage.tsx
    RegisterPage.tsx
    RecoverPasswordPage.tsx
  sections/
    LoginFormSection.tsx
    RegisterFormSection.tsx
    RecoverPasswordFormSection.tsx
  hooks/
    useSSOAuth.ts
    __tests__/useSSOAuth.test.ts
```

## Routes fournies par le module

`routes.tsx` exporte une `ModuleRouteFactory` injectée par la découverte de
modules (`src/lib/modules.ts` → `src/lib/buildRoutes.tsx`) :

```tsx
export const routes: ModuleRouteFactory = (): RouteObject[] => [
  { path: "login", element: <LoginPage /> },
  { path: "register", element: <RegisterPage /> },
  { path: "recover-password", element: <RecoverPasswordPage /> },
];
```

Ces paths sont montés en enfants de `/`. Les pages auth ne doivent donc **pas**
être déclarées dans `config.pages` — sinon elles entreraient en collision avec
les routes du module.

## Deux modes d'affichage : modal et pages

Les mêmes formulaires servent dans deux contextes :

- **Modal** (`AuthModal`) — pour les sites où l'auth se fait en overlay. Les 3
  formulaires basculent en interne via les callbacks `onSwitchToRegister` /
  `onSwitchToRecover` / `onSwitchToLogin` (pas de navigation).
- **Pages** (`/login`, `/register`, `/recover-password`) — montés sans callbacks,
  les formulaires naviguent alors entre les routes.

Chaque formulaire redirige vers `/` s'il détecte un utilisateur déjà connecté
(`!loading && me?.isConnected` dans un `useEffect`), ce qui remplace l'ancien
middleware config `redirect-if-authenticated` sur ces pages.

## Variants de design

Le set de composants d'auth est résolu par `resolveAuthVariant(config.auth?.variant)`
(`components/variants/registry.ts`). C'est calqué sur le switch de `SiteHeader.tsx`
qui résout le header par `header.type`, mais **découplé** : un site peut combiner
un header X et un variant d'auth Y.

```ts
export interface AuthVariantSet {
  LoginForm: LazyComponent;
  RegisterForm: LazyComponent;
  RecoverPasswordForm: LazyComponent;
  AuthModal: LazyComponent;
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

Tous les composants du `DEFAULT_SET` sont des constantes module-level créées avec
`lazy()` de `vite-preload` (évaluées une seule fois pour rester stables entre les
rendus).

## Configuration `config.auth`

Bloc top-level optionnel de la config site (validé par `AuthConfigSchema`) :

```jsonc
{
  "auth": {
    "variant": "default",     // discriminant du registry (absent → "default")
    "hideHeader": false,       // masquer le SiteHeader sur les pages auth
    "hideFooter": false,       // masquer le SiteFooter sur les pages auth
    "login":    { "title": { "fr": "Se connecter", "en": "Sign in" },
                  "subtitle": { "fr": "…", "en": "…" } },
    "register": { "title": { … }, "subtitle": { … } },
    "recover":  { "title": { … }, "subtitle": { … } }
  }
}
```

- `title` / `subtitle` alimentent le titre et le sous-titre de chaque formulaire.
  En l'absence de texte, le formulaire retombe sur ses libellés i18n par défaut
  (codés en dur dans les composants).
- Le `subtitle` est passé comme `description` à `AuthPageLayout` → `AuthSeo`,
  qui l'utilise comme balise `<meta name="description">`.
- `hideHeader` / `hideFooter` s'appliquent uniquement au mode pages
  (`/login` etc.) ; la modal n'a pas de header/footer.

## Composants

### `AuthModal`

`Dialog` shadcn multi-mode. Props :

```ts
interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

Repart sur `login` à chaque réouverture : `AuthModalLazy` démonte la modal quand
elle est fermée (`!open → return null`), donc le state `mode` est réinitialisé au
remontage — pas besoin d'un effet de reset. Un `<DialogTitle className="sr-only">`
est rendu (accessible aux lecteurs d'écran) sans être visible, pour éviter un
double titre (les formulaires rendent déjà leur propre `<h2>`).

Les formulaires sont rendus directement (pas de bordure/ombre propre) pour
éviter un double cadre avec le `DialogContent`.

### `AuthModalLazy`

Point de montage utilisé par les headers. Props identiques à `AuthModal`. Ne
monte `AuthModal` que lorsque `open === true` (`if (!open) return null`), sous
`<Suspense fallback={null}>`. Le variant de design est résolu via
`config.auth?.variant` (registry).

Utilisé par : `HeaderTiersLieux`, `HeaderRezoLaMer`, `HeaderNosCommunes`,
`HeaderCommuneTransparente`, `HeaderJuliePotVin`.

Exporté depuis le barrel en tant que **named export** `{ AuthModalLazy }` et
également comme default export depuis son propre fichier.

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

- En mode modal (`hideBackButton=true`, callbacks fournis) : après succès appelle
  `onSuccess()` sans naviguer vers `/`.
- En mode page (pas de callbacks) : navigue vers `/register` ou `/recover-password`
  via les boutons de bascule ; navigue vers `/` après connexion réussie.
- Erreurs HTTP 401/404 → message "Email ou mot de passe incorrect".
- Affiche les `SSOLoginButton` si `entity?.serverData.costum.sso` contient des
  providers (voir [SSO](#sso)).

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
| `AuthModal` (+ forms) | au clic sur « Se connecter » (`AuthModalLazy` monte au `open`) |
| `LoginForm` | modal ouverte, `/login`, ou dialog login de `CoFormPage` |
| `RegisterForm` | bascule register ou `/register` |
| `RecoverPasswordForm` | bascule recover ou `/recover-password` |

Le `registry` expose donc des composants lazy ; les consommateurs les rendent
sous `Suspense` :
- `AuthPageLayout` pour les pages (`Suspense` avec fallback texte)
- `AuthModalLazy` pour la modal (`Suspense fallback={null}`)
- `CoFormPage` pour son dialog login (son propre `Dialog` + `Suspense` avec
  spinner `Loader2`, sans passer par `AuthModal` ni `AuthModalLazy`)

Les `import` directs de `LoginForm` / `RegisterForm` / `RecoverPasswordForm` qui
subsistent dans `AuthModal.tsx` et les `*Section` sont eux-mêmes contenus dans
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
viennent de `entity?.serverData.costum.sso` (liste de slugs, typé `string[]`).
`LoginForm` affiche un `SSOLoginButton` par provider si la liste est non vide,
précédé d'un séparateur "ou continuer avec".

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
7. Cleanup au démontage du composant (`useEffect` retournant la fonction de
   nettoyage via `cleanupRef`).

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

## Schéma

`schema.ts` exporte les schémas des 3 sections auth et `AuthConfigSchema`.
`src/types/site-schema.ts` les importe et les ré-exporte (rétro-compat) ; le
champ `auth` de la config site est `AuthConfigSchema.optional()`. C'est le même
pattern de modularisation des schémas que `cagnotte` et `search`.

Les 3 schémas de sections ont des `props` vides (`z.object({})`) — aucune prop
de config n'est attendue :

```ts
export const LoginFormSectionSchema = z.object({
  type: z.literal("loginForm"),
  id: z.string().optional(),
  props: z.object({}),
});
// idem RegisterFormSectionSchema, RecoverPasswordFormSectionSchema

export const AuthConfigSchema = z.object({
  variant: z.string().optional(),
  hideHeader: z.boolean().optional(),
  hideFooter: z.boolean().optional(),
  login:    AuthPageTextSchema.optional(),  // { title?, subtitle? }
  register: AuthPageTextSchema.optional(),
  recover:  AuthPageTextSchema.optional(),
});
```
