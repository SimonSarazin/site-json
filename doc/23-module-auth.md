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
  i18n.ts                 addResourceBundle("modules/auth", fr|en)
  i18n/{fr,en}.json
  schema.ts               schémas des sections auth + AuthConfigSchema
  AuthSeo.tsx             Helmet noindex + titre/description (pattern AmpliSeo/ProfileSeo)
  components/
    AuthModal.tsx         modal multi-mode (login / register / recover)
    AuthPageLayout.tsx    layout des pages auth (header/footer configurables + AuthSeo)
    forms/
      LoginForm.tsx
      RegisterForm.tsx
      RecoverPasswordForm.tsx
      SSOLoginButton.tsx
    variants/
      registry.ts         resolveAuthVariant(variant?) → AuthVariantSet
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

Chaque formulaire se redirige lui-même vers `/` s'il détecte un utilisateur déjà
connecté (`me?.isConnected`), ce qui remplace l'ancien middleware config
`redirect-if-authenticated` sur ces pages.

## Variants de design

Le set de composants d'auth est résolu par `resolveAuthVariant(config.auth?.variant)`
(`components/variants/registry.ts`). C'est calqué sur le switch de `SiteHeader.tsx`
qui résout le header par `header.type`, mais **découplé** : un site peut combiner
un header X et un variant d'auth Y.

```ts
export interface AuthVariantSet {
  LoginForm; RegisterForm; RecoverPasswordForm; AuthModal;
}

export function resolveAuthVariant(variant?: string): AuthVariantSet {
  switch (variant) {
    default:
      return DEFAULT_SET; // composants par défaut
  }
}
```

Aujourd'hui un seul variant (`default`). Le switch est extensible : ajouter
`case "mon-variant": return MON_SET;` et un dossier de composants dédié.

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
- Le `subtitle` sert aussi de **description SEO** (cf. `AuthSeo`).
- En l'absence d'un texte, le formulaire retombe sur ses libellés i18n par défaut.

## Composants

- **`AuthModal`** — `Dialog` shadcn multi-mode. Repart sur `login` à chaque
  réouverture, fournit le cadre (`DialogContent`) ; les formulaires sont rendus
  « plats » (pas de bordure/ombre propre) pour éviter un double cadre.
- **`AuthPageLayout`** — enveloppe les pages : `<AuthSeo>`, `<SiteHeader>` /
  `<SiteFooter>` conditionnels (`config.auth.hideHeader` / `hideFooter`),
  formulaire centré (`max-w-md`).
- **`LoginForm` / `RegisterForm` / `RecoverPasswordForm`** — formulaires en
  `<form onSubmit>` (soumission clavier), composants shadcn (`Input`, `Button`,
  `Label`, `Checkbox`), `PasswordToggleTextInput`, validation `isValidEmail`,
  retours utilisateur via `sonner`.
- **`SSOLoginButton`** — bouton par provider (voir [SSO](#sso)).

## Sections

Pour un usage custom en config, 3 sections restent enregistrées dans
`SectionRenderer` (importées depuis `@/modules/auth/sections/*`) :
`loginForm`, `registerForm`, `recoverPasswordForm`. Elles rendent le formulaire
correspondant. Les routes du module couvrant déjà `/login` etc., ces sections ne
sont nécessaires que si l'on veut embarquer un formulaire dans une page existante.

## SEO (`AuthSeo`)

`AuthSeo.tsx` suit le pattern des autres modules (`AmpliSeo`, `ProfileSeo`) :
un `<Helmet>` dédié. Il force `robots: noindex, nofollow` sur les pages auth
(parité avec l'ancien `seo.noIndex` des pages config) et reprend titre /
description depuis `config.auth`. Il est monté par `AuthPageLayout`.

## SSO

Le SSO est piloté par le **backend**, pas par la config JSON : les providers
viennent de `entity.serverData.costum.sso` (liste de slugs). `LoginForm` affiche
un `SSOLoginButton` par provider. Le flux complet (`useSSOAuth`) est documenté
dans [API & Authentification](11-api-authentification.md#sso--single-sign-on).

## i18n

Namespace `modules/auth` (`i18n.ts` → `addResourceBundle`). Les composants
chargent via `useLoadNamespace("modules/auth")` + `useT("modules/auth")`. Le
bundle est chargé en side-effect par le barrel (`import "./i18n"`). Voir
[i18n](13-i18n.md).

## Schéma

`schema.ts` exporte les schémas des 3 sections auth (`LoginFormSectionSchema`,
`RegisterFormSectionSchema`, `RecoverPasswordFormSectionSchema`) et
`AuthConfigSchema`. `src/types/site-schema.ts` les importe et les ré-exporte
(rétro-compat) ; le champ `auth` de la config site est `AuthConfigSchema.optional()`.
C'est le même pattern de modularisation des schémas que `cagnotte` et `search`.
