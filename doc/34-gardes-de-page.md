# Gardes de page (`page.auth`)

Comment restreindre l'accès à une page de `config.pages`, ce que le mécanisme
garantit réellement, et ce qu'il ne garantit pas.

> **En un mot** : `page.auth` protège l'**expérience**, pas la **donnée**. Les
> sections ne sont pas rendues et la page n'est pas indexée, mais aucune
> décision d'accès n'est prise côté serveur — elle est aujourd'hui impossible.
> Voir [Ce que ça ne protège pas](#ce-que-ça-ne-protège-pas).

## Déclarer une garde

```jsonc
{
  "path": "/espace-pro",
  "title": { "fr": "Espace professionnel" },
  "auth": { "required": true },          // → mode "prompt" par défaut
  "sections": [ /* … */ ]
}
```

| clé | valeurs | effet |
|---|---|---|
| `auth.required` | `true` | exige une session |
| `auth.access` | `"siteAdmin"` \| `"superAdmin"` | exige un niveau d'administration |
| `auth.mode` | `"prompt"` (défaut) \| `"redirect"` \| `"hide"` | ce qui se passe quand l'accès est refusé |
| `auth.roles` | `string[]` | ⚠️ **déprécié** — voir plus bas |
| `middleware` | `string[]` | ⚠️ **déprécié** — voir plus bas |

Une page est **gardée** dès qu'elle porte `auth.required`, `auth.access`, un
`auth.roles` non vide, ou un `middleware` `auth-required`/`admin-only`.
Le prédicat vit dans `src/lib/pageAccess.ts` (`isGatedPage`).

> ⚠️ La config n'est **jamais** parsée par Zod au runtime : un `.default()` de
> schéma n'y tourne pas. Le défaut `prompt` est donc codé en dur dans
> `gateMode()`. Une valeur de `mode` inconnue retombe sur le défaut plutôt que
> de casser.

## Les trois modes

### `prompt` — le défaut

On **reste sur la page**. Les sections cèdent la place à une invitation, et la
modale de connexion s'ouvre par-dessus. Si l'utilisateur la ferme, l'invitation
reste : il garde une porte au lieu d'une page vide.

C'est la convention déjà en vigueur pour les **actions** d'un déconnecté (news,
profil, search, CoForm appellent tous `openLogin()` plutôt que d'afficher un
bouton désactivé), enfin étendue aux pages. Comme on ne navigue pas, il n'y a
ni destination perdue ni historique cassé.

### `redirect`

Navigation vers `/login`, en `replace` (la page refusée ne reste pas dans
l'historique — sinon le bouton Retour y renvoyait et la faisait re-rediriger
aussitôt). La page visée voyage dans le `state` de React Router
(`{ from: pathname + search }`), et les formulaires d'auth y ramènent après
connexion. Le filtre en cours est conservé : `/blog?categorie=autre` revient tel
quel.

À choisir quand le site veut une vraie page de connexion dédiée.

### `hide`

Rien n'est rendu, un refus est affiché, aucune navigation. C'est le patron de
`AdminPage` — historiquement le seul endroit du dépôt à faire les choses
correctement.

## Restreindre par droit

`auth.access` reprend **exactement** le vocabulaire du module admin
(`admin.access.min`, cf. [30-module-admin](30-module-admin.md)) :

| niveau | résolu par |
|---|---|
| `superAdmin` | `me.isSuperAdmin()` ou `me.isAdminPlatform()` |
| `siteAdmin` | `superAdmin`, ou `entity.isAdmin()` sur le carrier du costum |

`entityAdmin` n'existe pas ici : il se résout **par ligne** dans les tables
d'administration, il n'a pas de sens pour une page entière.

À un utilisateur **déjà connecté** à qui il manque le niveau requis, on affiche
un refus — pas une invitation à se connecter, qui ne changerait rien. C'est la
raison pour laquelle la décision d'accès porte un motif
(`reason: "anonymous" | "role"`).

### Pourquoi `auth.roles` est déprécié

`roles` teste des clés **brutes** de `me.serverData.roles`. Le SDK n'en peuple
que deux : `superAdmin` et `adminPlatform`. Tout autre nom rend le test faux
pour **tout le monde**, superAdmin compris — et sans le moindre signal.
`config.prod.json` a longtemps déclaré `roles: ["admin"]` sur son `/admin` : la
page refusait l'accès à l'univers entier.

Une garde préflight (`tests/preflight/page-guards.test.ts`) refuse désormais
tout nom hors de ces deux-là.

### Pourquoi `middleware` est déprécié

Trois noms seulement sont résolus, contre le registre d'`usePageGuards` :

| nom | équivalent moderne |
|---|---|
| `auth-required` | `auth.required` (doublon exact) |
| `admin-only` | `auth.access` |
| `redirect-if-authenticated` | aucun — seul cas encore utile |

`registry[mw]?.(…)` : l'optional chaining fait qu'un nom **inconnu ne déclenche
rien**. Une page se croit gardée et ne l'est pas. Le moteur avertit désormais en
dev, et la garde préflight refuse les noms hors registre.

## Ce que la garde fait vraiment

Quatre surfaces consomment le même prédicat — elles ne peuvent pas diverger :

| surface | effet |
|---|---|
| `SiteRenderer` | les sections ne sont pas rendues tant que l'accès n'est pas accordé |
| `Seo` | `robots: noindex` d'office, sans avoir à le redire en config |
| `server/lib/sitemap.js` | la page sort du `sitemap.xml` |
| `scripts/config-render.ts` | le gate sait que son vide est **attendu** (avertissement, pas échec) |

Mesuré sur `/espace-pro` avant/après la mise en place :

| | avant | après |
|---|---|---|
| texte rendu dans le HTML | 2 624 car. | 552 car. (header/footer seuls) |
| balise `robots` | aucune | `noindex,follow` |
| dans `sitemap.xml` | oui | non |
| contenu privé visible avant redirection | ~1 s | supprimé |

## Ce que ça ne protège pas

**Il n'y a aucune décision d'accès côté serveur, et elle est aujourd'hui
impossible.** `entry-server.tsx` appelle `initApi()` sans transmettre les
cookies de la requête, et le stockage de jeton au SSR est `"memory"` : `me` vaut
**toujours** `null` au rendu. La garde vit dans un `useEffect`, qui ne s'exécute
jamais au SSR.

**Le contenu voyage encore dans `window.__CONFIG__`.** La config entière est
injectée dans **chaque** page : le texte d'une page gardée est présent dans le
HTML des pages publiques. Il n'est plus rendu, plus indexé, plus affiché — mais
il est livré.

Conséquence pratique : si le besoin est « cette donnée ne doit pas atteindre un
anonyme », `page.auth` ne suffit pas. Il faut sortir la donnée de la config et
la charger par requête (comme le font les sections data-backed : `articleFeed`,
`searchProStatic`, `agenda`…), le backend appliquant alors ses propres droits.

## Où c'est implémenté

| fichier | rôle |
|---|---|
| `src/lib/pageAccess.ts` | `isGatedPage`, `gateMode`, `evaluatePageAccess` — décision pure, testée hors React |
| `src/hooks/usePageGuards.ts` | applique la décision : ne navigue qu'en mode `redirect` |
| `src/components/SiteRenderer.tsx` | applique la décision : rend ou non les sections |
| `src/modules/auth/components/GatedPageNotice.tsx` | ce qui s'affiche à la place des sections |
| `src/lib/authRedirect.ts` | destination de retour et sa validation (refus des URL externes et protocole-relatives) |
| `server/lib/sitemap.js` | miroir JS du prédicat (chargé par node, sans TypeScript) — tenu d'accord par `server/__tests__/sitemap.test.ts` |
| `tests/preflight/page-guards.test.ts` | garde : ce qui est déclaré doit avoir un effet |

## Voir aussi

- [Module auth](23-module-auth.md) — modale, routes, variants, SSO
- [Système de visibilité](19-visibility-system.md) — masquer un élément (`visibleIf`,
  `VisibilityCondition`), ce qui est un sujet distinct de l'accès à une page
- [Module admin](30-module-admin.md) — `admin.access.min` et le modèle de niveaux
