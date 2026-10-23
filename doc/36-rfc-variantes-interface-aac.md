[← Retour à l'index](README.md)

# RFC — Variantes d'interface du module AAC (maquette projets.re)

> Document de DÉCISION, branche `aac-dev`. **Implémenté** : variantes d'interface de
> l'annuaire et de la fiche, interface `editorial`, et le site `projetsre` qui l'utilise
> (`config.prod.projetsre.json`). Reste le déploiement. La référence d'usage est [doc/34 §3.4](34-module-aac.md) ; ce document garde le
> POURQUOI — la maquette, les écarts, les décisions, les options écartées.

## 0. L'état des lieux en une page

Un nouveau site, **`projetsre`** (projets.re, La Réunion), veut **tout le module AAC** avec
l'interface d'une maquette Lovable (`lovable-project-23e1b63d`), sur deux écrans : l'**annuaire**
des communs et la **fiche** d'un commun.

Avant ce chantier, l'AAC était **mono-interface** : le rendu écrit en dur dans
`AacCommunDetailPage` (783 lignes) et `AacDirectorySection`, rien en config pour en choisir un
autre, et un seul site AAC en production (`federationDesCae`).

La maquette et le dépôt parlent la **même langue** — React 19, Vite, Tailwind 4 CSS-first, shadcn
« new-york », Radix, `oklch()` : les 46 composants `ui/` de la maquette existent déjà dans
`src/components/ui/`. Le portage est un **rebranchement**, pas une réécriture. Tout ce que la
maquette fait avec Supabase, TanStack Start ou l'IA disparaît, remplacé par le view-model des
contrôleurs ou par du contenu de démonstration.

## 1. Correspondance maquette → AAC

| Maquette (`Project`) | AAC |
|---|---|
| `name` · `tagline` · `description` | rôle `title` · rôle `description` · descriptif long de l'étape de dépense |
| `theme` · `stage` · `need_types[]` | rôle `tags` · rôle `maturity` · usages catégorisés (`usage.categories`) |
| `budget_needed` · `budget_secured` | `totalRequested` · `totalFunded` — mais la fiche montre la **vraie** carte de financement |
| `community_size` | `usersCount` (rôle `users`) |
| `Milestone` · `ProjectAction` | paliers et actions (`CommunActionsSection` ; interface editorial : `CommunMilestonesList` + `CommunActionsFeed` ; dialogues `CommunActionDialogs`, montés par la page) |
| `Expense` · `Funder` | besoins financiers · cofinanceurs (`CommunFinancingSection`, `CommunCofinancersTable`) |
| `value_added`, `needs_answered`, `objectives[]` | blocs de prose `detail.sections` |
| `slug` | `answerId` (route `/aac/commun/:answerId`, cf. `lib/communPath.ts`) |

## 2. Les trois écarts qui ont décidé du découpage

**Écart 1 — trois onglets de la fiche sont des fonctionnalités neuves, pas une interface.**
« Actus et agenda », « Maturation » (IA) et « Coopérations » s'appuient sur Supabase et des
fonctions serveur sans équivalent Communecter — comme « Avis et idées », « Soutiens », les
indicateurs d'impact et le compagnon appels à projets. **Décision** : rendus avec du **contenu de
démonstration**, figé et identique sur tous les communs, marqué « Exemple », commandes désactivées
(`variants/editorial/demo/`). L'export du dossier reste un bouton désactivé : imprimer des données
de démo produirait un faux document. **Mise à jour** : « Actus et agenda » est désormais réel — les
actualités et les événements Communecter du projet lié au commun (doc/34, « Actualités et agenda »).
**Mise à jour** : ce contenu n'est rendu que si `aac.detail.demoBlocks` est vrai (faux par défaut ;
doc/34 §3.4).

**Écart 2 — la fiche de la maquette est à ONGLETS, celle de l'AAC un défilement à sommaire.**
Un `IntersectionObserver` sur des ancres d'onglets fermés — que Radix ne rend pas — tourne à vide.
**Décision** : le sommaire quitte la page et devient **opt-in** (`useCommunToc`, appelé par la vue
qui en a un). C'est le point de conception que seule la maquette révélait.

**Écart 3 — des champs sans équivalent.** `commune` est un **filtre** de la maquette ; un vrai filtre
demanderait un rôle de plus ET un passage par le chemin balayage du transport. **Décision** :
**masqué en v1** — la règle de l'annuaire est de masquer un filtre inopérant, jamais de l'afficher
inerte. `carrier_name`, `impact[]` : pas de v1 (`impact` passe par la démo).

## 3. La règle qui tient tout

> **La logique vit dans des contrôleurs ; une interface n'est qu'une vue.**

`useCommunDetailController` et `useAacDirectoryController` rendent un view-model : union discriminée
sur `status` (l'ordre des gardes n'est pas réinventable), blocs `| null` (TypeScript impose la
garde), paquets de props **prêts à épandre** (`{...vm.actions}` pour `CommunActionBar` : impossible de
passer un autre `contextId`). Aucun `useQuery`, mutation ni `navigate` dans une vue ; les overlays sans
position restent dans la coquille.

Les **tests de conformité**, paramétrés sur les clés des registres, tiennent la promesse « mêmes
fonctionnalités » pour toute interface ajoutée — c'est eux, et non la revue, qui l'engagent.

## 4. Décisions tranchées

| # | Décision |
|---|---|
| 1 | Fonctionnalités absentes : **contenu de démonstration** marqué « Exemple », commandes désactivées. |
| 2 | Filtre **Commune** masqué en v1. |
| 3 | Clé **`editorial`** — pas `lagoon` : `lagoon`/`basalt` ne servent à aucun des deux écrans ; une clé nomme un design, jamais un site. |
| 4 | Fonctions de l'AAC absentes de la maquette **conservées et restylées** : grille/liste, tri, dépôt, suppression, sélection, projet, édition, galerie, défilement infini. |
| 5 | Filtres de la barre en **choix multiple** (popover à cases), pas en `Select` : un choix unique perdait la sémantique OU/ET de l'annuaire. |
| 6 | « Soutenir ce projet » = la **vraie carte de financement** : l'ancre `#soutenir` de la maquette visait un onglet fermé, donc rien. La carte a une mise en page `layout="hero"` qui reproduit la grille de la maquette ; ses réactions sont un composant à part (`CommunReactionStats`), placé par la vue. Ses liens vers une section passent par `useShowSection` : une interface à onglets fournit `tabbedSectionNav` et sa table ancre → onglet, l'onglet s'ouvre puis on défile. |
| 7 | Polices Manrope + Instrument Serif par `config.theme` (slot `serif` = police d'affichage) ; `GoogleFontsLoader` inchangé (vérifié : 200). |
| 8 | `default` **embarqué**, variantes code-splittées **déclarées depuis le chunk d'entrée** (`variants/lazyVariants.ts`). |

## 5. Options écartées

- **Thème CSS seul** — la maquette change la STRUCTURE (onglets, barre de filtres), pas seulement
  les couleurs.
- **Fork des composants de page** — deux copies de la logique divergent au premier correctif ;
  la garantie « mêmes fonctionnalités » ne tiendrait qu'à la vigilance.
- **Un registre par bloc** (héros, carte de financement…) — huit registres pour un besoin qui porte
  sur une FICHE entière.
- **Variantes chargées en `lazy` depuis leur registre** — essayé, et c'est le piège mesuré de la
  décision 8 : Rollup remonte les dépendances communes dans le chunk de la page, qui perd sa façade
  de manifest ; vite-preload n'émet plus ses `modulepreload` SSR (75 → 48 sur la fiche de
  federationDesCae), pour TOUS les sites. Préflight `lazy-entry-facades`, qui a au passage révélé
  sept modules déjà touchés hors AAC (dette listée dans le test).

## 6. Découpage et état

| Lot | Contenu | État |
|---|---|---|
| 0 | Entité `projetsre` + formulaire AAC côté Communecter ; correctif legacy du 500 de `getformbyid` en prod | entité et formulaire faits (21/09) ; correctif legacy **à déployer** |
| 1 | `src/lib/variants.ts` (registre générique, `staticVariant`, `allEmbedded`) | fait |
| 2 | Fiche : contrôleur + coquille + vue par défaut (diff SSR vide) | fait |
| 3 | Registre de la fiche, `detail.pageVariant`, conformité, préflight `aac-variants` | fait |
| 4 | Annuaire : contrôleur, coquilles, registres cartes/lignes/squelettes, `directoryFilterActions` | fait |
| 5 | Interface `editorial` + démo + `index-projetsre.css` + i18n `editorial.*` | fait |
| 6 | Site `projetsre` : config, `sites.json`, logo, fixture `__effective__` | fait (21/09) ; déploiement à faire |
| 7 | Documentation | fait (ce document, doc/34 §3.4, `doc-projets/projetsre.md`) |

## Voir aussi

- [Module AAC](34-module-aac.md) — §3.4 pour l'usage, §5 pour l'arborescence, §12 pour les tests
- [Doc projet projetsre](../doc-projets/projetsre.md)
- [RFC assistant config](31-rfc-assistant-config-costum.md) — le formalisme de ce document
