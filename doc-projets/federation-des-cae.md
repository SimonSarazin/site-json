[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Fédération des CAE — Appel à Communs

> **Document de travail du projet de configuration.** Il porte le contexte, le modèle de données
> réel, l'architecture, l'avancement, les impacts et les dépendances SDK du site
> **`federationDesCae`**. À tenir à jour à chaque lot livré, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module AAC](../doc/34-module-aac.md) · [Module coform](../doc/21-module-coform.md) ·
> [Module Search](../doc/07-module-search.md). Le module `toolsCatalog`, partagé avec le
> [Navigateur des tiers-lieux](tiers-lieux.md), est documenté dans **son** dossier — seuls les
> correctifs propres à ce site figurent ici.
>
> ⚠️ **Ce dossier a été extrait de [`tiers-lieux.md`](tiers-lieux.md) le 31/08.** Le travail AAC
> vit sur la branche `aac-dev` et n'a rien à voir avec le site des tiers-lieux, qui vit sur `jdev`
> et `main` : leurs dossiers devaient être séparés. Cf. §10 31/08.

Dernière mise à jour : **2026-09-28** (profil de l'entité Fédération : onglet « Membres » ajouté à
`profiles.default.tabs`, cf. §10 28/09).

---

## 1. Contexte du projet

La **Fédération des coopératives d'activité et d'emploi** anime un **Appel à Communs** auprès de son
réseau : recueillir les communs portés par les CAE, les présenter, les financer et en suivre
l'avancement. Le site `federationDesCae` est la vitrine et l'outil de ce dispositif, bâti sur
SiteForge (site-json) au-dessus du backend Communecter.

Il se double d'un second usage : un **catalogue des besoins et solutions** — quels outils les CAE
emploient au quotidien, pour quel besoin, avec quelle satisfaction. Ce catalogue s'appuie sur un
formulaire d'observatoire distinct de l'appel lui-même (cf. §5).

### Identité

| | |
|---|---|
| Slug (`sites.json`) | `federationDesCae` |
| Config | [`../config.prod.federationDesCae.json`](../config.prod.federationDesCae.json) |
| Feuille CSS | `index-rezo-la-mer` (partagée — les couleurs vivent dans `config.theme`) |
| Entité Cocolight | `organizations` / `677e7e13bd08b2478f5f5314` — « Fédération des CAE » |
| Costum backend | **embarqué sur l'entité** : `costum.slug: "costumize"`, hôte `communs.les-cae.coop`, `connectOnlyBySSO` + SSO `lescaecoop` (sondé en production le 24/09 — la mention « aucun » des versions précédentes était inexacte). Un élément créé sous ce costum reçoit `source.keys: ["federationDesCae"]` (cf. §5) |
| Formulaire de l'appel | `677e7e389058e31575550ac8` — « Les communs des CAEs » (type `aap`), **20 réponses** |
| Formulaire d'observatoire | `6525865cdeaf281bbc7280e9` — « Observatoire des besoins et solutions des CAEs », **35 réponses** |
| Branche | **`main`** depuis le 09/09 (merge `287bb35a` de `fix/mr-53-bloquants`) — le config venait de `aac-dev` |
| SDK | `@communecter/cocolight-api-client` **1.0.191** |

⚠️ Les deux formulaires sont rattachés à **deux organisations différentes** : l'appel à la Fédération
des CAE (`677e7e13…`), l'observatoire à « Communs des CAEs » (`65255cbf…`). Le catalogue d'usages
n'est donc pas ancré sur l'entité du site — ne pas déduire l'un de l'autre.

### Historique des chantiers

| Date | Intervenant | Lot |
|---|---|---|
| — | Schumann | `init aac` — création du config et des premières pages |
| 27/08 | Schumann + Claude | Le lien d'un commun peut désigner la fiche site-json ; clic en navigation SPA ; enregistrement d'un enrichissement (cf. §10 27/08 et §12.1) |
| 30/08 | Schumann + Claude | Page « Besoins et solutions » (`7bf3417a`) |
| 31/08 | Schumann + Claude | Extraction de ce dossier ; règle de satisfaction et sous-catégorie du catalogue d'usages (cf. §10 31/08) |
| 03/09 | Schumann + Claude | Cagnotte d'un commun déposé sur un autre appel (cf. §10 03/09) |
| 08-09/09 | Anatole (MR 53) · Aboire · Claude | Revue de la MR 53 « module AAC » puis **112 commits de correctifs** en deux lots, mergés dans `main` (cf. §10 08-09/09) |
| 14/09 | Anatole + Claude | Footer `sidebar-columns` recopié de Rézo la mer remis aux routes du site ; pages `/mentions-legales` et `/confidentialite` (cf. §10 14/09) |
| 24/09 | Anatole + Claude | Page `/annuaire` — annuaire de la communauté et bouton « Ajouter une organisation » (cf. §10 24/09) |
| 28/09 | Mirana + Claude | Onglet « Membres » sur le profil de l'entité Fédération (cf. §10 28/09) |

---

## 2. Objectifs de la configuration

- Présenter l'Appel à Communs de la Fédération et son avancement (page d'accueil).
- Offrir l'**annuaire des communs** déposés, avec fiche de détail par commun.
- Offrir l'**annuaire de la communauté** (page `/annuaire`) : les CAE et organisations rattachées au
  site, et l'ajout d'une organisation par un utilisateur connecté.
- Publier le **catalogue des besoins et solutions** des CAE (page `/usages`), avec le détail par
  outil : qui l'utilise, pour quel besoin, avec quelle satisfaction.
- Permettre à un administrateur d'**enrichir** un outil (lien, description, rattachement à un
  commun) depuis le site, sans passer par l'interface legacy.

---

## 3. Architecture générale

```
config.prod.federationDesCae.json
   ├── bloc `aac`        → module AAC (doc/34-module-aac.md)
   │      formId 677e7e38…  +  directory.fields (mapping des chemins de réponse)
   ├── page /            → hero · aac-highlight · aac-directory · aac-highlight
   ├── page /aac/communs → aac-directory (annuaire complet)
   ├── page /usages      → toolsCatalog (module partagé avec tiers-lieux / RELIEF)
   │                          formId 6525865c… (observatoire), pas le formulaire de l'appel
   ├── page /annuaire    → searchHeader (titre, recherche, bouton d'ajout) · searchProStatic
   │                          organisations du périmètre sourceKey federationDesCae
   ├── pages /mentions-legales · /confidentialite → html (socle légal, à compléter)
   └── footer sidebar-columns → uniquement des routes servies par le site
```

Deux chaînes de données **indépendantes** cohabitent : le module AAC lit le formulaire de l'appel,
le module `toolsCatalog` lit celui de l'observatoire. Elles ne partagent ni formulaire, ni
organisation porteuse, ni collection de réponses. L'annuaire de la communauté lit, lui, les
**organisations** du périmètre costum (`sourceKey: ["federationDesCae"]`) — le même ensemble que
le finder « J'utilise » de la fiche d'un commun (`aac.detail.placeKind: "cae"`).

Côté backend, le catalogue d'usages est servi par deux actions du costum `franceTierslieux`
(`ToolsCatalogListAction`, `ToolUsersAction`) qui servent **aussi** le Navigateur des tiers-lieux et
RELIEF : tout changement s'y répercute sur trois sites (cf. §10 31/08 et §13).

---

## 4. Ce que la config met en œuvre

| Page | Sections | Détail |
|---|---|---|
| `/` | 4 | `hero` · `aac-highlight` · `aac-directory` · `aac-highlight` |
| `/aac/communs` | 1 | `aac-directory` — annuaire complet des communs déposés |
| `/usages` | 1 | `toolsCatalog` — catalogue des besoins et solutions |
| `/annuaire` | 2 | `searchHeader` (titre, recherche, bouton « Ajouter une organisation ») · `searchProStatic` — annuaire de la communauté (cf. §10 24/09) |
| `/mentions-legales` | 1 | `html` — mentions légales (LCEN) : faits établis seulement, le reste en `[à compléter]` (cf. §10 14/09) |
| `/confidentialite` | 1 | `html` — politique de confidentialité (RGPD), même règle |
| `/profil/:slug` | — | servie par le module `profil`, pas déclarée dans `pages[]` — cf. §10 09/09 |
| `/login` · `/register` | — | servies par le module `auth`, pas déclarées dans `pages[]` |

Blocs racine présents : `meta`, `theme` (dont `customCSS` depuis le 24/09 : la bande des
`searchHeader` suit la charte du site, cf. §7), `header` (`standard` ; `utilities` : `auth`, `themeSwitch`,
`piggyBank`, `pledge`), `footer` (`sidebar-columns`), `aac`, `cagnotteModuleConfig`
(`defaultType: "aac"`), `profiles` (`projects` + `default`, ce dernier avec un onglet « Membres »
depuis le 28/09, cf. §10 28/09).
**Absents** : `auth`, `admin`, `commandPalette`, `costumForms` — le site est en lecture publique,
l'enrichissement d'un outil reposant sur le droit admin du costum côté backend.

**Largeur** : les 6 pages n'ont pas de `layout` (gabarit `default`, 1280 px) et les deux profils sont
en `layout: "default"`. Ce gabarit enveloppe aussi le header et le footer ; les pages de module (fiche
d'un commun, connexion, coform) ont leur propre enveloppe, pleine largeur. ⚠️ Ne pas passer ce site en
`fullwidth` sans traiter les deux régressions mesurées le 14/09 (cf. §10 14/09bis).

Footer (`sidebar-columns`, libellés `fr` seuls comme le reste du site) :

| Colonne | Liens |
|---|---|
| L'appel à communs | Accueil `/` · Les communs `/aac/communs` · Besoins et solutions `/usages` · Annuaire `/annuaire` |
| Participer | Déposer un commun `/aac/communs` · Rejoindre l'annuaire `/annuaire` · Créer un compte `/register` **(anonyme)** · Se connecter `/login` **(anonyme)** · Mon profil `@profile` **(connecté)** |
| Informations | La Fédération `/profil/federationDesCae` · Mentions légales `/mentions-legales` · Confidentialité `/confidentialite` |

Ni `socials` ni `legalLinks` : la fiche Communecter de l'organisation ne porte ni e-mail, ni site, ni
réseaux (cf. §14). Aucune ancre : aucun gestionnaire global ne fait défiler vers un `#id`. Logo via
`footer.logo`, rendu en 32×32. La grille compte autant de parts que de blocs (bloc logo + une par
colonne) : 4 parts égales ici (cf. §10 14/09ter). Trois liens portent une condition d'affichage
`visibility` (cf. §10 15/09).

Réglages notables de la section `toolsCatalog` :

| Prop | Valeur | Pourquoi |
|---|---|---|
| `formId` | `6525865cdeaf281bbc7280e9` | l'observatoire, pas l'appel |
| `communFormId` | `677e7e389058e31575550ac8` | les communs proposés au rattachement sont ceux de CET appel |
| `communUrlTemplate` | `/aac/commun/{communId}` | la fiche du commun est servie par CE site (cf. §10 27/08) |
| `enableEnrichmentEditing` | `true` | encore soumis au droit admin du costum |

---

## 5. Modèle de données réel (sondé le 2026-08-31)

| Objet | Mesure |
|---|---|
| Réponses à l'appel (`form: 677e7e38…`) | 20 |
| Réponses à l'observatoire (`form: 6525865c…`) | 35 |
| Questions `commonTable` de l'observatoire | 19 inputs, dont 8 seulement portent des réponses |
| Saisies d'outils (`answers.yesOrNo<input>.<criteriaId>`) | **261** |
| Saisies portant `usage` (la sous-catégorie) | **36** — cf. §10 31/08 |
| Saisies portant `happiness` (la satisfaction fonctionnelle) | 125 |
| Saisies portant une `note` > 0 (le besoin d'alternative), **sans** `happiness` | 22 |
| Saisies sans aucune évaluation | 86 |
| Outils au catalogue après agrégation | 83 |

**Deux faits de modèle à ne pas réapprendre :**

1. Un **`criteriaId` est une ligne de besoin partagée par toutes les réponses** du formulaire, pas la
   saisie d'un lieu. Sélectionner dessus seul mélange les outils de lieux différents.
2. Le **libellé du besoin appartient à cette ligne**, pas à la saisie. Il vit dans
   `answers.criterias<inputKey>`, porté par les quelques réponses qui l'ont semé, et une saisie ne le
   recopie que si le formulaire l'a écrit à ce moment-là (36 sur 261). Il est **indexé par input** :
   `criteria1747166631` vaut « Agenda événementiel » en Communication externe et « Chat de discussion
   entre membres » en Coopération interne.

**Organisations de la communauté** (sondé en production le 2026-09-24, lecture seule) :

| Objet | Mesure |
|---|---|
| Organisations du périmètre `sourceKey: federationDesCae` | **9**, toutes `type: "Cooperative"`, toutes `source: {insertOrign: "costum", key: "federationDesCae"}` (aucune par `reference.costum`) |
| Membres de l'entité Fédération (`links.members`) | 9 citoyens, **0 organisation** |

Les deux ensembles ne se recoupent pas : aucune des 9 coopératives n'est membre de la Fédération au
sens des liens. L'annuaire s'appuie sur le premier (cf. §7).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.federationDesCae.json`](../config.prod.federationDesCae.json), `../sites.json` |
| Module AAC | [`../src/modules/aac/`](../src/modules/aac/) — cf. [`../doc/34-module-aac.md`](../doc/34-module-aac.md) |
| Catalogue d'usages | [`../src/modules/toolsCatalog/`](../src/modules/toolsCatalog/) (partagé — cf. [tiers-lieux.md](tiers-lieux.md)) |
| Lien de commun | `../src/modules/toolsCatalog/utils/communLink.ts`, `toolHref.ts`, `enrichmentResult.ts` |
| Annuaire (bouton d'ajout) | [`../src/types/action-button-schema.ts`](../src/types/action-button-schema.ts) (`createDefaults`), [`../src/modules/profil/components/ActionButtonGroup.tsx`](../src/modules/profil/components/ActionButtonGroup.tsx) + `ActionButtonGroup.test.tsx` |
| Modale d'ajout d'organisation | [`../src/modules/profil/forms/addOrganization.descriptor.ts`](../src/modules/profil/forms/addOrganization.descriptor.ts), `forms/configs/addStandard.tsx` (`addOrganizationConfig`) — sans mention d'entité parente |
| Backend costum | `modules/costum/controllers/actions/franceTierslieux/ToolsCatalogListAction.php`, `ToolUsersAction.php`, `CommunInfoAction.php` |
| Backend citizenToolKit | `modules/citizenToolKit/models/Coform.php` (`criteriaUsageCatalog`, `resolvePlaceMeta`) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Le catalogue lit l'observatoire, pas l'appel | ce sont deux dispositifs distincts ; les besoins des CAE préexistent à l'appel |
| `communUrlTemplate` pointe la fiche site-json | le site sert lui-même la fiche du commun ; un onglet vers le CMS legacy rejouerait un démarrage complet pour une page que le SPA affiche instantanément. Contrepartie legacy mesurée et bornée — cf. §10 27/08 |
| Le backend reconnaît le **segment** `commun/<24hex>`, pas un préfixe en dur | ce qui précède appartient au routeur du site et n'a pas à être connu du costum ; couvre du même coup la forme absolue |
| La règle de satisfaction est **inconditionnelle**, sans paramètre | c'est une règle d'honnêteté de la donnée, pas un réglage de site ; et s'en passer évite un paramètre de contrat côté SDK — cf. §10 31/08 |
| Le catalogue de besoins est un **helper partagé** (`Coform::criteriaUsageCatalog`) | c'est l'asymétrie entre la liste et le détail qui produisait le bug ; le dupliquer l'aurait reproduit |
| L'annuaire lit le **périmètre costum** (`sourceKey`), pas les membres de l'entité (`links.memberOf`) | c'est l'ensemble que le site utilise déjà pour les CAE (« J'utilise ») ; les membres ne comptent aucune organisation (§5), l'annuaire serait vide. Et une organisation créée depuis le site y entre d'elle-même : la création passe par le scope costum, le legacy estampille `source.keys`. Les membres auraient demandé ≈ 2 jours : `ADD_ORGANIZATION` n'accepte pas de parent, pas de wrapper SDK pour rattacher une organisation (`INVITE_MEMBERS` le permet), et un créateur non membre produit une demande `toBeValidated` qu'aucune page de ce site ne valide |
| Bouton d'ajout dans le `searchHeader`, pas dans `searchProStatic.addButton` | recette du parc (`searchHeader > searchProStatic`) ; un visiteur non connecté passe par la connexion puis la modale s'ouvre, là où `addButton` le laisse re-cliquer |
| `createDefaults: { "type": "Cooperative" }` sur le bouton | la modale d'ajout part sur `NGO` ; les 9 organisations existantes sont des coopératives. Nouvelle clé d'`ActionButtonSchema`, même canal que `admin.tabs[].sections[].createDefaults` |
| `--gradient-section` surchargé dans `theme.customCSS` | la feuille `index-rezo-la-mer.css` est partagée et teinte ce jeton en turquoise. Seuls `searchHeader` et `cta-newsletter` le consomment, et ce site n'avait ni l'un ni l'autre. Le dégradé est mélangé à `--background` pour suivre le mode clair/sombre. Précédent : `equipements-Sportifs-Scolaire` |

---

## 8. Étapes de mise en place

1. Entité `organizations/federationDesCae` existante (prérequis dur du boot).
2. Entrée `sites.json` : `{slug: "federationDesCae", config: "config.prod.federationDesCae.json",
   css: "index-rezo-la-mer"}`.
3. Backend : déployer **ensemble** `costum` et `citizenToolKit` (cf. §13).
4. Prévisualisation : `VITE_SLUG=federationDesCae npm run dev`.

---

## 9. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Accueil + annuaire des communs | ✅ | 4 sections, `aac-directory` sur 2 pages |
| 2 | Page `/usages` — catalogue | ✅ | 83 outils, 9 catégories, 39 facettes de besoin |
| 3 | Fiche d'un outil — lieux utilisateurs | ✅ | filtrée sur le nom normalisé ET les `criteriaId` ; n'affiche que les saisies évaluées (cf. §10 31/08) |
| 4 | Fiche d'un outil — sous-catégorie | ✅ | 31/08 — repli catalogue ajouté au détail |
| 5 | Enrichissement d'un outil (admin) | ✅ | enregistrement, rattachement d'un commun, deux formes de lien |
| 6 | Bloc « Informations liées au commun » | 🟡 | rendu, mais `CommunInfoAction` fige des `FIELD_*` propres au formulaire tiers-lieux → réduit au titre et à la description sur un commun de CET appel (cf. §13) |
| 7 | Logo du site | ✅ | livré le 09/09 (`24fe861b`, `f47e87a3`) : lockup officiel « les SCOP — Fédération des coopératives d'activité et d'emploi », **détouré** (50 % de marge blanche retirée → ×1,6 à hauteur égale) et **réellement transparent** (le fichier d'origine avait un fond blanc incrusté → rectangle blanc en mode sombre). `logoSize: "lg"` + `height: "md"`. ⚠️ provenance : fiche annuaire Avise, 2023 — à remplacer si la Fédération fournit un SVG ou une version plus récente |
| 8 | Version mobile du catalogue | ✅ | `ToolFiltersSheet` — commité sur **`jdev`** (`cb26991d`), le module `toolsCatalog` étant partagé |
| 9 | Brouillon du formulaire de dépôt | ✅ | actif sur une étape extraite, et le reprendre ne l'efface plus (cf. §10 31/08ter) |
| 10 | Vérification navigateur | ❌ | **jamais faite** sur AUCUN lot du 27/08 au 31/08, ni sur celui du 03/09 |
| 11 | Cagnotte d'un commun déposé sur un autre appel | 🟡 | modale ciblée, paliers/actions gérables par le déposant et l'admin du **projet lié** (cf. §10 03/09) — reste à confirmer sur données réelles que l'enveloppe du contexte d'origine répond |
| 12 | Bloc financement de la fiche | 🟡 | gaté sur `form.coremu` (09/09) — **le formulaire de l'appel ne porte pas cette clé**, donc le financement est masqué, exactement comme dans le legacy. À activer côté legacy si la Fédération veut le financement (cf. §14) |
| 13 | Campagnes de l'appel | ❌ | `POST /survey/coform/getformbyid` répond **500** sur un form de type `aapConfig` — bug legacy **corrigé mais non déployé**. Tant qu'il l'est, `campagne` et tout `config.*` sont invisibles côté front, avalés en best-effort silencieux (cf. §14) |
| 14 | Vérification navigateur du lot 08-09/09 | 🟡 | SSR de production vérifié (4 pages + un site sans AAC) et l'en-tête inspecté à l'écran ; `test:integration` et `test:e2e` **jamais lancés** |
| 15 | Footer et socle légal | 🟡 | 14/09 — 9 liens, tous vers une route servie par le site ; `/mentions-legales` et `/confidentialite` posées mais **à compléter par la Fédération avant publication** ; réseaux sociaux et contact retirés faute de coordonnées (cf. §10 14/09 et §14) |
| 16 | Annuaire de la communauté `/annuaire` | 🟡 | 24/09 — 9 coopératives listées, rendu vérifié (SSR + navigateur, clair/sombre, mobile). **Création d'une organisation depuis le bouton non vérifiée** : aucun compte de test disponible (cf. §10 24/09 et §14) |
| 17 | Onglet « Membres » du profil de l'entité | ✅ | 28/09 — 9 membres, rôles affichés (« Conseil d'administration »), rendu vérifié (SSR + navigateur, clair/sombre, desktop/mobile), cf. §10 28/09 |

**Gates au merge `287bb35a` (09/09)** : `typecheck` ✅ · `eslint` ✅ **0 erreur** (24 avertissements
préexistants) · `test:unit` **4 230** ✅ dont préflight **635** ✅ · `build` ✅ · `config:validate` ✅
3 pages / 6 sections · `audit:config` ✅ **RAS** (le constat du logo est levé) ·
SSR de production vérifié sur `/`, `/aac/communs`, `/usages`, `/aac/commun/:id`.
`test:integration` et `test:e2e` **non lancés**.

*Pour mémoire, gates au 31/08 (`d48dd882`) : `test:unit` 3 351 ✅ ; le préflight `site-assets` était
rouge — `public/images/federationDesCae/` vide et non déclaré. Réglé le 09/09 par le logo + l'entrée
`images` de `sites.json`.*

---

## 10. Impacts des modifications

### 28/09 — onglet « Membres » sur le profil de l'entité

**Le besoin.** Afficher les membres de l'entité Fédération (organisation) sur son propre profil
(`/profil/federationDesCae`), à côté de « À propos », « Galerie » et « Localisation ».

**Ce qui change (config seule, aucun code).** Un onglet `members` ajouté à
`profiles.default.tabs` :

- `profile-tab-layout` avec, à gauche, `profile-members` (`showRole: true`, `showManagement: true`)
  et à droite, en barre latérale, `profile-info` (`variant: "sidebar"`, `sticky: true`,
  `showCounts`, `showAddress`, `showOrganizer`) — même agencement que les autres onglets du profil.
- Les deux types de section (`profile-members`, `profile-tab-layout`) existent déjà dans
  `src/modules/profil/schema.ts` et sont utilisés par 13 autres configs du parc (parent62,
  rezo-la-mer, tiers-lieux, institut-bleu…) : aucune divergence de props introduite ici.
- Il atterrit sur `profiles.default`, donc partagé par tout type d'entité sans `profiles.<type>`
  dédié sur ce site — ici, seule l'organisation Fédération l'utilise en pratique (`profiles.projects`
  reste inchangé, sans onglet membres).

**Correction apportée pendant la revue.** Le libellé de l'onglet portait une clé `en` (« Members »)
alors que `meta.languages` de ce site vaut `["fr"]` — la même règle déjà appliquée à tout le site le
09/09 (cf. §10 09/09). `audit:config` l'a signalé en `locale-extra` ; clé `en` retirée, l'audit
repasse à ✅ RAS.

**Vérifié.** `config:validate` ✅ 6 pages / 10 sections (le compte ne change pas : l'onglet vit sous
`profiles`, hors `pages[]`, comme les autres onglets — cf. §9 09/09). `audit:config` ✅ RAS.
`test:preflight` ✅ 728/730 (2 échecs préexistants et sans rapport, confirmés reproductibles hors de
ce lot par `git stash` : `bundle-size` dépasse 2 Mo sur ce poste, et un dossier
`public/images/EcosystemeSanteReunion` non déclaré par `sites.json` — aucun des deux n'a de lien avec
`federationDesCae`). Module `profil` ✅ 53 fichiers / 576 tests. `typecheck` ✅. SSR de production
(`config:render`) ✅ sur les 6 pages de `pages[]` — le profil n'y figurant pas, vérifié séparément :
`/profil/federationDesCae/members` sert 200 avec le contenu de l'onglet. Navigateur (Playwright,
Chromium) : 9 membres listés avec rôle (« Conseil d'administration ») et sidebar Informations
(9 membres, 6 projets), en clair et en sombre à 1440 px, et en mobile à 390 px (défilement, cartes
lisibles). Aucun échec, aucun `ErrorBoundary`.

**Non vérifié.** Le comportement pour un visiteur **admin connecté** (`showManagement: true`
autorise des actions de gestion des membres depuis cet onglet) — aucun compte de test disponible,
comme pour l'annuaire (cf. §10 24/09).

**Gates (28/09, arbre de travail non commité)** : `config:validate` ✅ · `audit:config` ✅ RAS ·
`test:preflight` ✅ 728/730 (2 échecs préexistants, cf. ci-dessus) · `test:unit` (module `profil`)
✅ 576 · `typecheck` ✅ · SSR (`config:render` + sondage direct de la route de profil) ✅ · navigateur
✅ clair/sombre/mobile. `eslint`, `test:unit` complet, `test:integration`, `test:e2e`, `build` **non
relancés** : aucun fichier de code touché.

### 24/09 — l'annuaire de la communauté

**Le besoin.** Une page d'annuaire de la communauté, avec un bouton pour ajouter une nouvelle
organisation.

**Le périmètre.** « Communauté » recouvre deux ensembles disjoints (§5) : les 9 coopératives du
périmètre costum, et les membres de l'entité, qui ne comptent aucune organisation. Le premier a été
retenu (§7) : il est non vide, c'est celui de « J'utilise », et une organisation créée depuis le site
y entre sans code supplémentaire.

**Ce qui change.**

- **Config** : page `/annuaire` (`searchHeader` puis `searchProStatic`, carte `profile` en tiroir,
  compteur de projets masqué, carte activable) ; entrée « Annuaire » au header ; liens « Annuaire » et
  « Rejoindre l'annuaire » au footer (le lien mène à la page, il n'ouvre pas la modale : un libellé
  d'action l'aurait promis) ; `theme.customCSS` pour la bande du `searchHeader`.
- **Bouton** : `action: "add-organization"`, `requiresAdmin: false` (tout utilisateur connecté ; un
  visiteur passe par la connexion), `createDefaults: { "type": "Cooperative" }`.
- **Code** : `ActionButtonSchema` accepte `createDefaults`, transmis par `ActionButtonGroup` à la
  modale — partagé par `searchHeader` et `hero-parallax` sur tout le parc, sans effet là où la clé est
  absente. Documenté dans [`../doc/05-schemas-sections.md`](../doc/05-schemas-sections.md).
- **Modale d'ajout d'organisation** : elle n'affiche plus « Entité parente : <entité du site> ».
  `ADD_ORGANIZATION` n'a pas de champ `parent` (contrat en `additionalProperties: false`) et rien ne
  rattache l'organisation créée : la mention était fausse sur tout le parc, mais seuls les admins la
  voyaient. Retrait du `$slot:parentInfo` dans `addOrganization.descriptor.ts` et des `slots` dans
  `addOrganizationConfig` ; projet, POI et événement la gardent, eux reçoivent bien leur parent.

**Vérifié.** SSR : les 6 pages rendent (`config:render`, 10/10 sections avec contenu). Navigateur
(Chrome, serveur de dev) : header, footer, 9 cartes, bouton ; captures à 1440 px en clair et en
sombre, et à 390 px. `config:probe` : 9 résultats sur `communecter-dev`.

**Non vérifié.** La **création réelle** d'une organisation depuis le bouton — aucun compte de test
n'est configuré, et l'entité impose le SSO `lescaecoop`. Le raisonnement (scope costum ⇒
`costumSlug` ⇒ `source.keys` estampillé par `Element.php`) s'appuie sur le code et sur les 9
organisations existantes, toutes créées ainsi, pas sur un essai. À contrôler : `source.keys` posé,
apparition sans rechargement, redirection vers `/profil/<slug>`, présence dans « J'utilise ».

**Observé en passant.** La carte affiche `Coop&amp;Bât` : le nom est stocké encodé en base (donnée,
pas rendu).

**Gates** (branche `aac-dev`, non commité) : `typecheck` ✅ · `eslint` ✅ sur les fichiers
touchés · `config:validate` ✅ 6 pages / 10 sections · `audit:config` ✅ **RAS** · `test:unit`
**4 453/4 454** (dont 2 nouveaux tests) — le seul échec, `site-assets.test.ts`, vient d'un dossier
vide `public/images/projetsre/` présent sur la machine et absent du dépôt ; snapshot
`__effective__/federationDesCae.json` mis à jour (la seule différence est la nouvelle page).
`build` et `test:e2e` **non lancés**. Note : `config:render` échoue au premier lancement sur cette
machine (préchauffage SSR ≈ 147 s, délai de l'outil 120 s) ; un second passage réussit.

### 15/09 — les liens du footer suivent l'état de connexion

**Le besoin.** « Se connecter » et « Créer un compte » restaient affichés dans le pied de page à un
visiteur déjà connecté.

**Le mécanisme existait déjà, mais pas pour le footer.** `@/lib/visibility` expose une condition
(`auth` / `routes` / `permissions`) et le hook `useVisibilityList`, utilisés par les headers
`transparent-scroll` et `stacked`. Les liens de pied de page, eux, n'avaient que `href`, `label`,
`external` et `icon`.

**Ce qui change** (code partagé par tout le parc) :

- **Schéma** : un objet `FooterLink` commun aux colonnes, aux `legalLinks` et aux `bottomLinks`, avec
  la clé `visibility`. Aucune config du parc ne l'utilisait jusqu'ici.
- **`useFooterLinks`** ([src/components/layout/footer/useFooterLinks.ts](../src/components/layout/footer/useFooterLinks.ts)) :
  filtre les liens par condition et résout le jeton d'adresse `@profile` en `/profil/<slug>` de
  l'utilisateur connecté. Un lien de config est une chaîne fixe : sans ce jeton, « Mon profil » ne
  pouvait pas s'écrire en config. Le lien disparaît tant que le slug est inconnu.
- **Les 4 designs de footer** qui rendent des liens (`sidebar-columns`, `rich`, `minimal-centered`,
  `contact-partners`) passent par ce hook — une clé honorée par un seul composant serait un piège
  silencieux pour qui la pose ailleurs. Les colonnes passent par `useFooterColumns` (une seule
  évaluation pour toutes) et le composant partagé `FooterLinkColumn`. Une colonne dont tous les
  liens sont masqués n'est plus rendue, plutôt qu'un titre sans liens.
- **Config** : `visibility: { "auth": "anonymous" }` sur « Créer un compte » et « Se connecter » ;
  nouveau lien « Mon profil » (`@profile`) en `{ "auth": "required" }`.

⚠️ **Rendu serveur** : toute condition dépendant de l'authentification est masquée jusqu'à
l'hydratation, pour ne jamais laisser filtrer un état privé. Les trois liens apparaissent donc juste
après l'affichage de la page — vérifié : ils sont absents du HTML servi, présents ensuite.

**Gates (15/09)** : `config:validate` ✅ 5 pages / 8 sections · `audit:config` ✅ RAS · `typecheck` ✅
(hors `communDeletion.test.ts`, fichier non suivi déjà cassé) · `eslint` ✅ · `test:preflight` ✅ 637 ·
tests `layout` + `visibility` ✅ 22 · `config:render` ✅ sur **les 4 variantes de footer** :
rezo-la-mer 10/10, parent62 46/46, tiers-lieux 12/12, commune-transparente 8/8, cyber-reunion 4/4.

**Vérifié en navigateur, déconnecté** : « Créer un compte » et « Se connecter » présents, « Mon
profil » absent. **L'état connecté n'a pas été vérifié** (pas de compte de test) — cf. §14.

### 14/09ter — colonnes du footer réparties ; bug « nouvel onglet » du header diagnostiqué

**Footer.** La grille de `FooterSidebarColumns` était figée à 5 parts (`lg:grid-cols-5`) : avec 3
colonnes de liens, un vide restait à droite. Elle compte désormais autant de parts que de blocs, soit
le bloc logo plus une part par colonne, via une table de classes écrites en toutes lettres (Tailwind ne
génère que les classes qu'il trouve littéralement). Au-delà de 5 colonnes, elle plafonne à 6 parts.
Rézo la mer, avec 4 colonnes, garde ses 5 parts.

Mesure à 1440 px : classe `lg:grid-cols-4`, et 4 blocs à parts égales couvrant toute la largeur du
contenu (112→392, 424→704, 736→1016, 1048→1328). Gates : `eslint` ✅, tests `src/components/layout`
✅ 22.

**Header : bug remonté, non reproduit** (« impossible d'ouvrir une page dans un nouvel onglet »).
Diagnostic, sans correctif pour l'instant, sur décision :

- **Déconnecté**, les entrées du menu et le logo sont de vrais liens `<a href>` (`NavLink` →
  `<Link>`) : Ctrl+clic, clic molette et clic droit fonctionnent. Aucun intercepteur de clic global
  n'existe dans le code, et React Router gère correctement les touches de modification, `metaKey` du
  Mac compris. Cela explique qu'on ne reproduise pas le bug en testant sans compte.
- **Connecté**, le menu du compte (`AuthMenu`) rend « Profil » et « Administration » comme des
  éléments qui naviguent par `navigate()`, pas comme des liens, sur ordinateur (`DropdownMenuItem
  onClick`) comme sur mobile (`Button onClick`). Aucune ouverture en nouvel onglet n'y est possible.
  C'est la cause la plus probable.
- **« Se connecter »** (`LoginButton`) est un bouton qui ouvre la modale : on ne peut pas ouvrir
  `/login` dans un nouvel onglet.
- **Hors header**, le CTA du hero (« Découvrir les communs », `HeroSection`) est aussi un bouton qui
  navigue par `navigate()`.

Ces trois composants sont partagés par tout le parc (cf. §14).

### 14/09bis — la pleine largeur, tentée puis annulée ; seules restent les marges du footer

**Le constat de départ.** Le header et le footer se décalaient d'une page à l'autre. Le gabarit de
page de `SiteRenderer` (`getLayoutClasses`) enveloppe **tout l'écran, header et footer compris**, et
le site mélangeait deux largeurs :

- 1280 px (`sm:max-w-7xl mx-auto`) pour les pages sans `layout` et les profils ;
- pleine largeur pour les pages de module (fiche d'un commun, `/login`, `/register`, coform).

S'y ajoutait un désalignement propre au footer : `px-4` là où le header utilise
`px-4 sm:px-6 lg:px-8`.

**Tentative : tout passer en pleine largeur.** Pages en `fullwidth`, profils en `full-width`, et
`container` ajouté à `AacDirectorySection` et `AacHighlightSection`. Les bords du header et du footer
devenaient identiques partout, mais le rendu des pages s'est dégradé, ce qui a été constaté le jour
même :

- **Profil cassé à toutes les largeurs.** Bannière de bord à bord, avatar et titre collés à gauche
  (x = 24), onglets étirés. Le gabarit de profil (`ProfileTemplateDynamic`, `ProfileRenderer`) n'a
  **aucun conteneur** : il compte sur l'enveloppe 1280 px de `ProfilePage`. Les fiches de projet
  partagent ce gabarit.
- **Désalignement à partir de 1536 px.** `container` passe à 1536 px, mais les deux sections
  annuaire portent dans le config `className: "max-w-7xl mx-auto px-6"`, et ce depuis leur création.
  À 1920 px, l'annuaire démarrait à x = 352 contre x = 224 pour le header.

**Annulée**, sur décision :

- aucune page n'a plus de `layout`, pages légales comprises ;
- les profils repassent en `layout: "default"` ;
- `AacHighlightSection` est restauré à HEAD ;
- `AacDirectorySection` retrouve ses `className` d'origine.

**Ce qui reste du lot** : les marges du footer (`FooterSidebarColumns` : `px-4 sm:px-6 lg:px-8`), qui
l'alignent sur le header quelle que soit l'enveloppe. Rézo la mer, qui partage ce footer, gagne le
même alignement.

**Leçon.** Avant de passer ce site en `fullwidth` :

1. donner un conteneur au gabarit de profil, ou garder les profils en `default` ;
2. retirer les `max-w-7xl` des `className` de section ;
3. vérifier à 1440 **et** à 1920 px : jusqu'à 1440 px, la pleine largeur paraît correcte.

**Mesure après annulation** (Playwright sur le serveur de dev, CSS appliqué) :

| Largeur | Pages | Header et footer | Contenu du header et du footer | Annuaire, bande colorée |
|---|---|---|---|---|
| 1440 px | `/`, `/aac/communs`, `/profil/federationDesCae`, `/mentions-legales` | 80 → 1360 | x = 112 | x = 104 |
| 1920 px | idem | 320 → 1600 | x = 352 | x = 344 |

Sur ces 4 pages, header et footer occupent la même boîte, et la bannière du profil est revenue dans
l'enveloppe (81 → 1359 à 1440 px). L'écart de 8 px de l'annuaire (`px-6` du config contre `px-8`)
existait déjà à HEAD. Aucun débordement horizontal.

**Gates (14/09, après annulation)** :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 5 pages / 8 sections |
| `audit:config` | ✅ RAS |
| `eslint` sur les 3 fichiers concernés | ✅ |
| `test:preflight` | ✅ 637 |
| `config:render` | ✅ 5/5 pages, 8/8 sections |
| `typecheck` | non relancé — échouait déjà sur `src/modules/aac/lib/communDeletion.test.ts`, fichier non suivi par git, sans lien avec ce lot |
| `test:unit` complet, `build` | non relancés |

**Reste** : le décalage entre les pages de config (1280 px) et les pages de module (pleine largeur),
et la gouttière de barre de défilement (cf. §14). La grille du footer a été traitée ensuite (cf.
14/09ter).

### 14/09 — le footer recopié de Rézo la mer ne menait nulle part

**Le constat.** Le footer (modif non commitée) était passé de `default` vide à `sidebar-columns` en
recopiant **tel quel** celui de Rézo la mer. `audit:config` relevait **54 constats** sur le site :

- 19 `lien-mort` : `/projets`, `/equipe`, `/cagnotte`, `/contact`, les 5 pages légales,
  `/plan-du-site`… ;
- 4 `ancre-morte` : `#actions`, `#donnees`, `/#mission`, `/confidentialite#cookies` ;
- 30 `locale-extra` : libellés `en` sur un site déclaré `fr` seul ;
- 1 erreur de **schéma** : `footer.logoIcon` recevait un chemin PNG, que `IconOrSvg` prend pour un nom
  d'icône Lucide. Logo invisible, config invalide.

Les réseaux sociaux et l'e-mail étaient ceux de Rézo la mer (`facebook.com/rezolamer`,
`contact@rezolamer.org`). Rien de tout cela ne se voyait en recette : un lien mort ne lève aucune
erreur, le catch-all sert la **page d'accueil en 200** (vérifié sur `/projets`).

**Ce qui change** (config seul, aucun code) :

- **Footer** : 3 colonnes de 3 liens, uniquement des routes servies par le site (cf. §4). `socials` et
  `legalLinks` retirés ; `logo` + `logoAlt` à la place de `logoIcon` ; libellés `en` purgés.
- **Aucune ancre** : `NavLink` rend un `#id` par `<Link>` React Router, et aucun gestionnaire global
  ne fait défiler jusqu'à l'élément. Une ancre de footer ne mène nulle part.
- **« Faire un don » retiré** : il n'a pas de route, le don passe par la modale `CagnotteDialog` du
  bouton tirelire. « Déposer un commun » pointe l'annuaire, où `AacDepositButton` ouvre la modale de
  dépôt.
- **Pages `/mentions-legales` et `/confidentialite`** : section `html` (d'abord posées en
  `layout: fullwidth`, ramenées au gabarit par défaut le jour même — cf. 14/09bis), gabarit de Rézo
  la mer. Elles n'affirment que des faits prouvés par le dépôt :
  - la dénomination reprise du copyright ;
  - la plateforme Communecter ;
  - les fonctionnalités déclarées par la config (comptes, dépôt, cagnotte, catalogue) ;
  - l'absence de bandeau de consentement (aucune section `CookieConsentSection`).

  Tout le reste est en `[à compléter]`, et **aucune coordonnée n'est publiée** : la fiche de
  l'organisation n'en porte pas. Pas de mention MIT, que le copyright de ce site ne revendique pas.
- **Hors de ce lot**, mais dans la même modif non commitée : `header.utilities.piggyBank` et `pledge`
  sont activés.

**Gates (14/09, arbre de travail non commité)** :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 5 pages / 8 sections |
| `audit:config` | ✅ **RAS** (54 → 0) |
| `test:preflight` | ✅ 637 |
| `config:render` | ✅ 5/5 pages, 8/8 sections |
| SSR dev | `/register`, `/login` et `/profil/federationDesCae` rendent leur propre contenu, pas la home ; le footer SSR porte exactement les 9 liens et le logo |
| Navigateur (Playwright, Chromium) | footer en clair et en sombre, largeur 400 px sans débordement horizontal, `/mentions-legales` lisible en mobile ; logo chargé mais **à peine lisible en 32×32** |
| `typecheck`, `test:unit`, `build` | non relancés : aucun fichier de code touché |

**À revalider** : rien côté code. Les pages légales restent **non publiables en l'état** (cf. §14).

### 09/09 — le profil d'un projet n'avait aucune interface

**Le constat.** `/profil/<slug>` — l'adresse qu'ouvre le bouton « Ouvrir le projet » de la fiche d'un
commun (`CommunProjectControl`) — servait une page nue : un bandeau, une description, un porteur, et
**rien d'autre**. Aucun onglet, là où le même type d'entité sur rezolamer en affiche sept. Aucune
erreur, aucun avertissement : la page rendait exactement ce qu'on lui avait demandé, c'est-à-dire
rien.

**La cause.** Pas un bug de code : l'absence, ici assumée et documentée (§4), du bloc racine
`profiles`. Deux replis s'enchaînaient. `generateTabRoutes` (`profil/routes.tsx:111`) rend une seule
route index quand `config.profiles` manque — **aucune route d'onglet n'existait**, donc
`/profil/x/news` tombait à côté. Et `ProfilePage.tsx:205` termine sa cascade
`profiles[type] → profiles.default → objet codé en dur` sur ce dernier étage : header en variant
`hero`, trois blocs empilés, et surtout **pas de `profile-template-dynamic`** — la section qui branche
tout le système d'onglets. Un site sans `profiles` n'a donc pas « un profil par défaut » : il a un
profil amputé.

**Le correctif.** `profiles.projects` et `profiles.default` portés depuis `config.prod.rezo-la-mer.json`,
avec trois écarts délibérés :

| Écart | Pourquoi |
|---|---|
| `showAddDropdown: false`, pas d'`addConfig` | le site est en lecture publique ; rezolamer y ouvre la création d'`event` et de `poi`, sans objet ici |
| Onglets `actions` et `finance` **non portés** | le financement est gaté par `form.coremu`, non activé côté Fédération (§13) : ils s'afficheraient vides. Réactivables sans code — cf. §14 |
| Onglet `organizations` **non porté** | il est **structurellement mort sur une fiche projet**, chez rezolamer comme ici — voir ci-dessous |

**L'onglet mort de rezolamer.** Son onglet « Organisations partenaires » (`profiles.projects.tabs[3]`)
porte `relationType: "projects"`. Or le cas `"projects"` de `useRelatedEntities` (l. 51-66) ne fait un
appel réseau que `if (isOrganization(entity))` ; sur un **projet**, la branche `else` renvoie
`{results: [], count: {total: 0}}`. `doc/08-module-profil.md:944` le dit d'ailleurs : cet onglet
appartient à `profiles.organizations`, avec `relationType: "organizations"`. Le recopier n'aurait pas
reproduit une interface, seulement un onglet vide. L'onglet `events`, lui, traite bien `isProject`
(l. 68-76) : il est porté.

**Ce qui reste `default`.** Les trois onglets `about` / `gallery` / `map`, sans onglet `news` — et
c'est délibéré. La cascade vers `default` n'existe QUE dans `ProfilePage`. Quatre autres lecteurs
indexent `config.profiles[entityType]` **sans repli** : `routes.tsx:63` (préfetch SSR de l'onglet),
`TabDetailRenderer.tsx:30` et `:61`, `useNewsDetailUrlGenerator.tsx:20` et `:42`. Un type servi par
`default` seul afficherait ses onglets mais rendrait `null` sur `/profil/:slug/news/:newsId`. C'est
la raison pour laquelle `projects` est écrit **explicitement** plutôt que délégué à `default`.

**Les libellés anglais ont été purgés.** Le bloc recopié portait 8 valeurs `en` ; `meta.languages` de
ce site vaut `["fr"]`. `audit:config` les a toutes signalées en `locale-extra` — retirées, l'audit
repasse à ✅ RAS.

**Vérifié.** `validate-config` ✅ · `audit:config` ✅ RAS · `config:surface --key profiles` liste
désormais 14 sites dont celui-ci · préflight **41 fichiers / 637 tests** ✅ · module `profil`
**36 fichiers / 434 tests** ✅. La fixture `tests/preflight/__effective__/federationDesCae.json` n'a
**pas** bougé, et c'est correct : la projection `addMenus` ne retient que les headers à
`showAddDropdown`, et `profileRelated` ne parcourt que les `sections` de premier niveau — celle de
rezolamer est vide pour la même raison. Le générateur de routes a été exercé sur la vraie config
(routes obtenues : index, `about`, `gallery`, `map`, `news` + sous-route `:newsId`, `contributors`,
`events`), ce qui a confirmé au passage que `generateTabRoutes` **agrège les onglets de tous les
types** de `profiles` : le filtrage par type est fait à l'affichage par `ProfileTemplateDynamic`, pas
au routage.

⚠️ **Vérification navigateur impossible ce jour** : le serveur de dev tronquait toutes ses réponses
(`/` et `/profil/…` byte-identiques, sans `<div id="root">`), `src/modules/aac/routes.tsx` portant des
marqueurs de conflit d'un `git stash pop` non résolu. Sans rapport avec ce lot, mais l'écran reste à
contrôler — cf. §14.

---

### 08-09/09 — la revue de la MR 53, et les 112 commits qui en sont sortis

**Le lot.** La MR !53 d'Anatole (`aac-dev` → `main`) livrait le **module AAC** — annuaire, fiche d'un
commun, financement par paliers, droits — plus ce site : 216 fichiers, **+28 322 / −2 737**. Trop gros
pour une relecture linéaire : elle a été conduite par périmètres, chaque constat passant ensuite
devant des vérificateurs chargés de le **réfuter** et de reconstruire son déclencheur jusqu'à un point
d'entrée réel. Rapport complet : `commentaire/review-mr53-aac.md` (hors git, `commentaire/` est
ignoré) ; tests de reproduction dans `commentaire/review-mr53-verif/`.

**Résultat de la revue.** 164 constats bruts → **83 confirmés** (5 critiques, 29 hauts, 49 moyens),
10 contestés, 25 rejetés. Puis 421 références `fichier:ligne` du rapport contrôlées une à une :
19 écarts, dont **un qui changeait une conclusion** (voir plus bas).

**Les quatre bloquants**, tous reproduits par exécution avant d'être corrigés :

| # | Défaut | Correctif |
|---|---|---|
| 1 | Le wizard CoForm **ré-émettait un instantané périmé** des cinq inputs de décision (`selection`, `admissibility`, `pourContre`, `evaluation`, `choose`) et **effaçait les notes des autres évaluateurs** — la protection existait mais ne couvrait que le chemin mono-étape | `denormalizeAnswerData` ne ré-émet plus **rien qui ne soit parsé** (cf. « la règle de sauvegarde », ci-dessous) |
| 2 | La **clé de brouillon ignorait l'élément** : le brouillon saisi sur un tiers-lieu était proposé sur un autre, et écrasait le champ finder pourtant verrouillé | segment élément dans `buildKey`, propagé de `CoFormModal` jusqu'à `useCoFormDraft` ; l'élément ne qualifie que la clé d'une **nouvelle** réponse |
| 3 | `buildItemsFromRawDepenses` faisait **gagner la photo serveur sur la saisie locale** : supprimer, clôturer ou modifier une ligne n'avait aucun effet visible, et « Modifier » éditait la mauvaise ligne | fusion au lieu de remplacement, appariement par `milestoneId` seul |
| 4 | Toute la branche **« palier sans projet lié »** était inatteignable : les 4 handlers levaient `syncContextMissing` avant d'atteindre le repli `answerDepenseIndex` | court-circuit quand l'index est fourni ; la description est désormais écrite sur la dépense, projet lié ou non |

**La règle de sauvegarde, tranchée avec le backend (Aboire, 09/09) — c'est elle qui a donné sa forme
définitive au correctif n°1** : *une étape absente du payload est **préservée** à la sauvegarde sur les
deux backends (PHP et port Node) ; une étape présente est **écrasée clé par clé**.* La bonne règle
n'était donc pas « nettoyer les clés de décision d'une étape masquée » mais **ne jamais ré-émettre ce
qui n'est pas parsé**. Cela supprime du même coup une heuristique fragile et l'instantané périmé des
champs ordinaires d'une étape invisible.

**Trois autres faits backend ont fermé des questions ouvertes** :

| Question | Réponse |
|---|---|
| Gate de financement | **`form.coremu`**, à la racine du form AAP (`coRemuneration` n'existe nulle part dans le legacy) |
| Où vit `campagne` | à la **racine de l'`aapConfig`** — la lecture du front était juste |
| `financerLimitRoles` | **pas contrôlé à l'écriture** : c'est un niveau d'affichage, pas une sécurité |

**Ce que la revue a corrigé dans ses propres conclusions.** Deux fois, un fait backend a invalidé un
constat que la revue tenait pour acquis :

- `priceInt` **n'est jamais stocké** : il est fabriqué par un `$addFields` dans les trois pipelines
  d'enveloppe de `Aap.php`. Le vrai défaut n'était pas « `parseAacAnswer` ignore `priceInt` » mais
  **178 montants stockés en `string`** (plus 75 bool, 200 null) que `toInt`/`toNote` lisaient comme
  `1` ou `0`. Règle retenue : `toSafeInt(price)` sur un **document**, `priceInt ?? price` sur
  l'**enveloppe**.
- `CLAUDE.md` est **gitignoré** : le « cinquième bloquant » (compteur de sections périmé, préflight
  rouge) n'en était pas un — la CI est verte, le rouge n'apparaît que sur une machine dont le fichier
  local est en retard.

**Une régression introduite par les correctifs eux-mêmes, et rattrapée.** La relecture adversariale du
lot 2 a trouvé une **perte de données critique** créée par le lot 2 : `coerceValueToShape`, en rangeant
`milestoneList` dans la branche `array`, **jetait** toute map serveur non vide au lieu de la convertir.
Un admin ouvrant « Modifier » sur un commun dont `depense` revient en map (indices non contigus après
suppression legacy), corrigeant un titre et enregistrant, supprimait **tous ses paliers**, leurs
`financer[]` et leur `historique[]`. Corrigé par `coerceObjectToArray` (tri numérique des clés
d'index, `{}` reste `[]`). C'est l'argument le plus net pour ne jamais fusionner un lot sans sa
relecture.

**Le site lui-même.** Le logo a enfin été livré (cf. checklist n°7) : le fichier officiel portait
**50 % de marge blanche** — l'en-tête imposant la hauteur, la marque n'occupait que 30 px sur 48 —
et un **fond blanc incrusté** malgré un canal alpha, invisible en clair mais rectangle blanc en mode
sombre. Détouré et rendu transparent par remplissage depuis les bords (les lettres « SCOP » sont
préservées), il est ×1,6 plus grand à hauteur d'en-tête égale. Un en-tête `stacked` a été essayé et
**écarté** : sa case de logo est carrée (`160×160`, `object-contain`), donc un lockup 2,15:1 y est
bridé par la largeur, et son fond anthracite rend le pavé « FÉDÉRATION DES COOPÉRATIVES… » illisible.

**Gates au merge `287bb35a`** : `typecheck` ✅ · `eslint` ✅ 0 erreur (24 avertissements préexistants ;
une erreur `react-hooks/rules-of-hooks` introduite par le lot 2 a été corrigée en `6256d3fa`) ·
`test:unit` **4 230** ✅ dont préflight **635** ✅ · `build` ✅ · `config:validate` ✅ 3 pages / 6 sections ·
`audit:config` ✅ RAS · SSR de production vérifié sur `/`, `/aac/communs`, `/usages`,
`/aac/commun/:id` (SEO présent côté serveur) et sur un site **sans** AAC (la route tombe bien sur le
catch-all). **`test:integration` et `test:e2e` n'ont jamais été lancés** (cf. §14).

---

### 03/09 — la cagnotte d'un commun déposé ailleurs

**Le constat.** Sur la fiche d'un commun **étranger** — déposé sur l'appel France Tiers-Lieux, et
présent ici parce qu'un admin CAE l'a *sélectionné* — la modale « Financer » affichait **un autre
commun**, et la section « Objectifs / Actions » n'apparaissait jamais.

**La cause, unique.** `entity.fundingEnvelope()` est scopée à l'entité **appelante** : le SDK
(`BaseEntity._withCostumContext`) écrase le `contextId` du payload. Lue depuis l'entité du site,
l'enveloppe ne contient que les communs de l'appel d'ici. Un commun étranger n'y étant pas :

1. `savedSelectedResource` sortait `undefined` ;
2. `CagnotteDialog` retombait alors sur `allResourcesIds[0]` — **la première ressource de la
   liste** — avec `hideResourceSelect: true`, donc sans recours visible. Une contribution s'y
   serait écrite dans le `depense[].financer[]` du mauvais commun ;
3. sans `projectId`, `canManageObjectiveActions` restait faux : pas de section « Objectifs », pas
   de bouton « Ajouter un palier », `CreateMilestoneDialog` sans projet ;
4. et même débloqué, éditer / clôturer / supprimer un palier aurait échoué sur
   `milestone.errors.syncContextMissing`, l'enveloppe servant aussi à retrouver les index du jalon.

À quoi s'ajoutait un cinquième point, indépendant du contexte : les droits se calculaient sur
l'**org du site**, donc seul un admin CAE gérait paliers et actions — jamais le **déposant**.

**Le correctif.** Le financement d'un commun suit LE COMMUN :

| Ce qui change | Où |
|---|---|
| L'enveloppe s'interroge sur une entité donnée (`hostEntity`), défaut inchangé | `useFundingEnvelope` |
| Le contexte du commun = `form.parent` de l'appel où il a été **déposé** (0 requête de plus : la fiche fetchait déjà ce form pour son nom) | `useCommunFundingContext`, `lib/formParent.ts` |
| L'entité de ce contexte, résolue par `resolveHostEntity` (aucun fetch si c'est celle du site) | `useCommunFundingHost` |
| La ressource se reconstruit depuis le document réponse quand l'enveloppe ne la porte pas | `buildResourceFromAnswer` |
| La synchro d'un palier accepte les documents bruts en repli | `resolveMilestoneSyncContextFromDocs`, `MilestoneMutationContext.docs` |
| **Une ressource forcée introuvable ne retombe plus sur une autre** : message explicite, contribution impossible | `CagnotteDialog` |
| Droits = entité du **projet lié** + `ownerIds` (le déposant seul — l'admin de l'appel n'y est pas, cf. doc/34 §6) | `useCommunObjectivesController`, `resolveCommunOwnerIds`, `CagnottePermissionData.ownerIds` |
| « Générer / Associer un projet » ouvert au déposant | `CommunProjectControl.canManageProject` |

**Arbitrage produit** : le déposant gère les paliers, les actions **et** le rattachement du projet
de son commun. L'admin de l'appel peut générer / associer le projet, mais n'écrit dans les paliers et
actions que s'il administre le **projet lié** — porter l'appel ne donne pas la main sur le plan de
financement d'autrui (cf. doc/34 §6, doc/18 §Pièges n°4). Un simple visiteur, non.

**Reste ouvert** :

- 🚧 **à confirmer sur données réelles** — l'enveloppe du contexte d'origine renvoie-t-elle bien la
  proposition à un utilisateur CAE ? Si non, la fiche fonctionne quand même (ressource reconstruite
  depuis la réponse), mais sans les financeurs consolidés côté FTL ;
- l'input `newDepenseList` du **formulaire** (`MilestoneListField`) n'a que l'`answerId`, donc pas
  de contexte à résoudre : sur un commun étranger, sa projection des paliers vers le projet reste
  inopérante (best-effort par conception, la réponse fait foi). Commentée sur place ;
- la vérification navigateur (point 10 de la checklist) reste à faire.

### 31/08ter — le brouillon du dépôt : absent, puis destructeur

**Le bouton « Déposer un commun » ouvre UNE étape extraite** (`resolveAacDepositStepKey` : l'étape
qui porte le titre, sinon la première), donc `SmartCoForm` passe en mode *standalone*. Deux défauts
s'y sont révélés coup sur coup.

**(a) Le brouillon n'existait pas.** `enableDraft` excluait le mode standalone, et pour une raison
réelle : la clé `coform-draft:v1:<formId>:<userId>:<answerId|new>` **ignorait le périmètre rendu**.
Un brouillon d'étape restauré dans le parcours complet aurait remplacé `stepsData` par cette seule
étape, et placé le wizard sur un index calculé pour un formulaire à une étape. Sauf que c'est
exactement la forme du dépôt — un bouton, une étape, une modale — donc le cas où fermer par erreur
coûte le plus cher.

La clé porte désormais son périmètre, **et seulement s'il y en a un** : le parcours complet garde
`…:new`, à l'octet près, sinon on rendait orphelin tout brouillon déjà enregistré chez un
utilisateur. Le périmètre dérive de `resolvedStepKey` (ce qui est *rendu*), pas du `stepKey` brut —
les deux ne divergent aujourd'hui que sur la branche `inputKey` seul, s'y appuyer serait un accident.

**(b) Reprendre un brouillon le détruisait.** `handleRestoreDraft` appelait `discardDraft()` en
comptant sur l'auto-save pour réécrire aussitôt, `reset(…, { keepDirty: true })` étant censé le
garder actif. Or **`keepDirty` conserve l'état courant, il ne le force pas** : au montage `isDirty`
vaut `false`, et le seul geste de l'utilisateur est justement d'avoir cliqué « Reprendre ».
L'auto-save restait donc bloqué sur `if (!isDirty) return` alors que l'entrée venait d'être
supprimée. Séquence vécue : ouvrir → saisir → fermer → rouvrir → « Reprendre » → fermer sans rien
toucher → **saisie définitivement perdue**. Et tant que rien n'était modifié, plus rien n'était
jamais sauvegardé.

Reprendre n'est pas jeter : le hook gagne `acknowledgeRestored()`, symétrique d'`acknowledgeStale`,
qui masque la bannière **sans rien effacer**. Rien n'est supprimé avant une soumission réussie
(`purgeDraft`) ou un rejet explicite (`discardDraft`).

**(c) La fiche restait en retard.** `CoFormModal` ne transmettait pas `baseUpdatedAt` : sans lui,
`computeDraftState` ne peut pas voir qu'un brouillon local est plus vieux que la réponse serveur.
Transmis depuis la fiche du commun. ⚠️ **4 autres call-sites ne le passent toujours pas** — au
BACKLOG, avec le piège : l'union discriminée sur `CoFormModalProps` ne marchera pas, les appelants
passant un `answerId: string | undefined` que TS ne narrowe pas.

**Revue de conformité — ce qu'elle a rattrapé.** Passée par l'agent `module-review` (mode B), elle a
sorti un BLOQUANT que la relecture manuelle avait manqué : `purgeDraft` reconstruisait la clé
« new » **sans le périmètre**, donc soumettre depuis une étape extraite effaçait le brouillon de
création du parcours complet — la collision même que ce lot interdit — tout en laissant traîner le
sien. Corrigé par la variante minimale (purger le résidu **du périmètre courant**) et non par un
balayage de préfixe, qui aurait transformé une sur-suppression en une autre.

Elle a aussi révélé un défaut plus large que le lot : **`npx vitest run <chemin>` sans `-c` ne
collecte aucun `.test.tsx`** (`vitest.config.ts` déclare `include: ["src/**/*.test.ts", …]`).
Mesuré : 24 fichiers / 459 tests contre **39 / 648** avec `npm run test:unit -- …`. Un lot peut donc
être déclaré vert sans qu'aucun de ses tests n'ait tourné. La norme #11 de l'agent, qui prescrivait
la mauvaise commande et un seuil de tests, a été corrigée.

Dernier point rattrapé, introduit par ce lot : la réécriture à la reprise prenait `baseUpdatedAt` du
hook. Si l'answer n'est pas encore chargée elle vaut `null`, et un brouillon à `null` ne peut **plus
jamais** être déclaré obsolète — il se restaurerait un jour par-dessus une réponse modifiée
entre-temps. La reprise transmet maintenant la lignée du brouillon repris.

**Gates** : `typecheck` ✅, `eslint` ✅ sur les fichiers touchés, `test:unit` **3351** ✅ (seul rouge
le `site-assets` pré-existant). Huit tests ajoutés ; les correctifs ont été annulés un à un pour
vérifier que les tests correspondants tombent — et eux seuls. ⚠️ Rien n'a été rejoué dans un
navigateur.

⚠️ **Reste au BACKLOG** : le câblage lui-même (`DynamicCoForm.handleRestoreDraft` appelle bien
`acknowledgeRestored` et non `discardDraft`) n'est couvert par aucun test — c'est pourtant là que
vivait le bug. Condition posée pour le prochain lot sur cette zone.

---

### 31/08bis — le formulaire de dépôt : « le choix n'a pas pu être enregistré », puis « rien ne bouge »

**Deux bugs enchaînés sur les inputs de décision** du formulaire de l'appel
(`677e7e389058e31575550ac8`), tous deux visibles sur `choose` (`chooseProposal`) et sur `decide`
(`multiDecide`, résolu en `tpls.forms.aap.selection` par `inputConfig`).

**(a) L'enregistrement échouait — un mensonge de type.** `MultiStepCoForm` dérivait le `formId` de
ces champs depuis `formData._id.$id`. Or l'API ne sérialise pas comme ça :

```
Form.get(677e7e38…)  →  _id = {"_str":"677e7e389058e31575550ac8"}
```

`_id.$id` valait donc `undefined`, la mutation levait `errors.formIdMissing`, et le message BRUT
s'affichait tel quel dans le toast — d'où une clé i18n à l'écran. Le type déclarait
`_id: { $id: string }` et **les trois fixtures de test reproduisaient ce mensonge** : typecheck vert,
tests verts, production cassée.

Correctif à trois niveaux, parce que le premier seul laisserait le piège : les quatre champs
utilisent le `formId` local (`coform.formData.id`, celui que consomment déjà `CommonTableField` et
`UploaderField`) ; le type devient `_id: { _str: string }`, si bien que toute nouvelle lecture de
`_id.$id` **échoue au typecheck** ; les fixtures cessent d'affirmer le faux. À noter, car l'anomalie
invite à la « corriger » : les **196 formulaires `aap` n'ont aucun champ `id` en base** — c'est le SDK
qui y réinjecte l'identifiant demandé, ce qui en fait la source fiable côté client.

**(b) L'affichage ne suivait pas.** Une fois (a) réparé, le choix partait bien mais le bouton restait
sur l'ancienne valeur. La valeur AFFICHÉE vient de l'instantané du formulaire —
`stepState.stepsData`, un `useState` initialisé **une seule fois** — que rien ne resynchronise.

⚠️ **Ce n'est PAS corrigé par une invalidation de cache depuis le formulaire**, et c'est le point
d'attention du lot : une donnée de formulaire qui pilote le rafraîchissement de ce qui vit hors du
formulaire peut le remonter ou l'effacer en pleine saisie. Vérifié pour lever le doute :
`isLoading` de React Query 5 est faux pendant un refetch de fond, il n'y a aucun `reset()` sur
changement de `defaultValues`, et `stepsData` n'est jamais réinitialisé — l'invalidation existante
est donc inoffensive, mais elle ne rafraîchit rien non plus. (Elle ne tirait d'ailleurs **jamais**
avant (a) : `formId` valant `""`, la clé ne matchait aucune requête.)

Chaque champ garde donc localement ce qu'il vient d'écrire (`hooks/useEcrituresLocales`), **après**
confirmation du serveur et jamais de façon optimiste — un échec doit laisser la valeur réelle. Une
mémoire par clé écrite, parce qu'un jury note plusieurs critères à la suite et que
`mutation.variables` ne retient que le dernier appel. Les quatre champs de la famille sont traités
(`chooseProposal`, `selection`, `pourContre`, `aapEvaluation`), pas seulement les deux signalés.

**(c) La fiche du commun restait en retard.** Ces champs enregistrent sans soumettre : fermer la
modale d'édition ne déclenchait pas `onAfterSubmit`, donc pas le `refetch`. Corrigé **au bord de la
page** (`onOpenChange`), pas depuis le formulaire — même règle qu'en (b). Le bouton de sélection de
la fiche, lui, rafraîchissait déjà (`onDone` + `extraInvalidate` sur les clés d'annuaire).

**Gates** : `typecheck` ✅, `eslint` ✅ sur les fichiers touchés, `test:unit` 3337 ✅. Deux tests de
régression ajoutés sur `ChooseProposalField` — l'un vérifie que le nouveau choix s'affiche après
succès, l'autre qu'un échec laisse la valeur réelle ; le premier a été vu **rouge** en retirant le
correctif. ⚠️ Rien n'a été rejoué dans un navigateur.

---

### 31/08 — un usage non évalué n'est pas un usage, et le besoin a un nom

**Deux constats sur le catalogue d'usages, tranchés ensemble parce qu'ils touchent la même paire
d'actions backend.**

**(a) Les saisies muettes comptaient.** Une saisie de `commonTable` sans **aucune** évaluation n'est
pas un usage constaté : le lieu a coché l'outil sans rien en dire. La fiche d'un outil listait ces
lieux sans rien à montrer, et la liste les COMPTAIT parmi les usages — le compteur d'une carte ne
correspondait donc pas à ce que sa fiche montrait. Ce n'est pas marginal : **86 saisies sur 233
(37 %)** ici, 128 sur 355 (36 %) chez les tiers-lieux.

> ⚠️ **Piège — la première version de la règle n'exigeait que `happiness`, et c'était trop strict.**
> Le `commonTable` pose DEUX questions : la satisfaction fonctionnelle (`happiness`) et le besoin
> d'alternative éthique (`note`, sur 5). Un lieu qui n'a répondu qu'à la seconde **n'est pas muet**.
> N'exiger que `happiness` faisait disparaître **22 saisies ici et 47 aux tiers-lieux** qui portaient
> une vraie évaluation. Repéré sur « App calendar » : son unique lieu l'a noté **4,5/5**, l'outil
> comptait pourtant zéro usage alors que le legacy montrait bien ce lieu.
> La règle retenue est donc `happiness` non vide **OU** `note` numérique **> 0**
> (`ToolsCatalogListAction::estEvaluee`, répliquée dans `ToolUsersAction`). Le `0` — numérique ou la
> chaîne `"0"`, 35 saisies ici et 46 aux tiers-lieux — est le curseur jamais touché, pas une réponse.

**(b) La sous-catégorie ne s'affichait presque jamais.** Le libellé du besoin appartient à la ligne
de catalogue, pas à la saisie (cf. §5) : **36 saisies sur 261** portent `usage`.
`ToolsCatalogListAction` avait déjà le repli, **pas `ToolUsersAction`** — d'où une fiche muette là où
la liste, elle, nommait le besoin. Constaté sur Framateam : deux lignes « MINE DE TALENTS » sans
aucune sous-catégorie, alors que la donnée existait sur d'autres réponses du même `criteriaId`.

**Correctif — backend seul, aucun changement de contrat.**

- La règle de satisfaction devient **inconditionnelle** dans les deux actions (costum `ce7e367fa`).
  Elle était partie sur un paramètre `requireSatisfaction` opt-in ; l'arbitrage a été inversé : c'est
  une règle d'honnêteté de la donnée, elle vaut pour tous les costums servis par l'endpoint, et un
  site neuf doit en bénéficier sans le savoir. **Conséquence directe : plus rien à demander au SDK.**
  Le paramètre aurait exigé une déclaration d'endpoint, une régénération de types et une méthode
  d'entité, parce que `getToolUsers` construit son payload clé par clé et n'aurait jamais laissé
  passer une clé inconnue — c'est tout l'objet de la convention entity-based. La lib est restée à
  l'identique de `master`, `dist` reconstruit.
- Le catalogue « criteriaId → usage » est extrait en helper partagé
  `Coform::criteriaUsageCatalog($formId, $inputKey)` (citizenToolKit `f40121d2` ; cache
  request-scoped, patron de `resolvePlaceMeta`), consommé par les **deux** actions, avec la même
  chaîne de repli jusqu'au « Autre » final — sinon les deux écrans nomment différemment le même
  besoin.

**Arbitrage produit** (tranché par le porteur) : un outil dont plus aucune saisie ne compte **reste
dans la liste**, et n'y affiche simplement **pas** d'information de lieu — pas de « 0 lieu ». Le
rendu le faisait déjà (`usagesCount > 0` sur `ToolCard` et `ToolListRow`), aucune ligne d'affichage
n'a été nécessaire. L'alternative — sortir ces outils — aurait retiré **32 des 83** entrées du
catalogue, dont des outils réellement enrichis à la main (Gitlab, HumHub, Collabora, ZeenDoc, Louty,
Loot).

**Vérifié en réel**, A/B sur l'endpoint (`indexStep=200` — au-delà, le serveur retombe sur 24 et la
mesure ne porte que sur la première page) :

| | legacy (aucune règle) | `happiness` seul (écarté) | règle retenue |
|---|---|---|---|
| outils | 83 | 83 | **83** — aucun ne sort |
| occurrences | 216 | 113 | **135** |
| outils sans pastille d'usage | 0 | 32 | **22** |
| facettes d'usage | 39 | 37 | **39** |
| catégories | 9 | 9 | **9** |

Le paramètre `requireSatisfaction` envoyé à `true`, à `false` ou absent donne désormais **la même
réponse**. Sur la fiche Framateam, les deux lignes remontent enfin leur besoin (« Débat et décisions
en ligne », « Chat de discussion entre membres »). Sur App calendar, le lieu manquant est de retour :
`MINE DE TALENTS · Agenda partagé interne · satisfaction non renseignée · note 4,5/5`.

**Portée hors de ce site** : le Navigateur des tiers-lieux et RELIEF sont servis par la même action
et héritent de la règle — 17 de leurs 69 outils perdent leur pastille d'usage, occurrences 183 → 111,
facettes 51 → 43. Assumé, c'est le même défaut de donnée là-bas ; consigné dans
[tiers-lieux.md](tiers-lieux.md).

**Reste ouvert** : `normalizeToolName` demeure dupliquée entre les deux actions, avec son commentaire
« réplique exacte ». Refactor orthogonal aux deux correctifs, laissé hors du lot.

---

### 31/08 — ce dossier est extrait de celui des tiers-lieux

Le travail AAC vit sur `aac-dev` ; `config.prod.federationDesCae.json` est **absent de `jdev` et de
`main`**. Or ses lots étaient consignés dans [tiers-lieux.md](tiers-lieux.md), le dossier d'un site
qui vit, lui, sur `jdev` — deux projets sans rapport dans un même document, et un fichier qui
divergeait de 117 lignes entre les deux branches.

Ce dossier reprend donc ce qui est propre à la Fédération des CAE : l'entrée 27/08 (les trois
correctifs du lien de commun, dont le code n'existe que sur `aac-dev`) et la dépendance SDK §12.1.
Ce qui reste dans le dossier des tiers-lieux est ce qui le concerne : le module `toolsCatalog`
lui-même, né pour lui et partagé, et l'impact du lot du 31/08 sur son propre catalogue.

---

### 27/08 — le lien d'un commun peut désigner la fiche site-json

**Constat** : le catalogue d'un site site-json affiche les communs sur **sa propre** page de détail
(`/aac/commun/<id>`), pas sur la page CMS legacy. Or `ToolsCatalogListAction::extractCommunId`
n'extrayait la `communId` que de l'ancre historique `#detail-un-commun.communId.<24hex>`. Rattacher
un commun depuis la modale React écrivait donc un lien que le serveur ne savait pas relire : la
valeur partait bien en base, mais revenait `communId: ""` — select retombé sur « Aucun commun »,
bloc « Informations liées au commun » jamais rendu, **et aucune erreur nulle part**.

**Correctif — backend** : `extractCommunId` reconnaît désormais **deux** formes. L'ancre legacy
d'abord (sur un lien qui porterait les deux, c'est elle qui a été écrite en connaissance du domaine
cible), puis le **segment** `commun/<24hex>`. Un segment, jamais un préfixe en dur : ce qui le
précède appartient au routeur du site (`/aac/…` aujourd'hui) et n'a pas à être connu du costum — ce
qui couvre du même coup la forme absolue `https://<hôte>/aac/commun/<id>`. Un `[0-9a-f]{24}` isolé
ne serait PAS un critère suffisant : toute URL portant un identifiant Mongo (une image, un profil)
deviendrait un lien de commun ; c'est le libellé `commun/` qui porte l'intention.

**Correctif — front** : `toolsCatalog/utils/communLink.ts`, **miroir exact** de la fonction PHP
(`extractCommunId` / `isCommunLink` / `replaceCommunId` / `templateYieldsCommunId`), consommé par
`ToolEditDialog` — qui repointe désormais un lien existant **sans convertir sa forme** : un outil
enrichi depuis le legacy garde son ancre, un outil enrichi depuis un site site-json garde sa route.

**Garde-fou** : le `refine` de `communUrlTemplate` ne cherche plus un motif — il substitue une
communId factice et relit le résultat avec le même code que le serveur. Un gabarit non relisible
échoue à `config:validate` au lieu de se corrompre en silence dans la base.

Il substitue **DEUX identifiants distincts** et exige de relire chaque fois **celui qu'il vient d'y
mettre**. Relire « une » communId ne suffisait pas : un gabarit portant déjà une communId **en dur**
— l'URL d'une vraie fiche copiée-collée à la place du gabarit — en rend une aussi, et chaque outil
rattaché aurait alors pointé le **même** commun, sans la moindre erreur. La double substitution est
la preuve que le marqueur `{communId}` est présent **et** que c'est lui que le serveur lira ; un tel
gabarit est désormais rejeté par `config:validate`.

**Vérifié en réel** (endpoint `toolscatalog`, catalogue CAE paginé, 83 outils) : 3 outils portaient
une `communId` avant, **4** après — « Framateam » résout maintenant sur la valeur DÉJÀ en base
(`/aac/commun/6a33be10fbb6f52b76632076`), sans migration, et les deux ancres legacy continuent de
résoudre. `communinfo` sur ce commun rend bien la fiche.

**Corollaire — le clic sur le lien d'un outil** : dès lors qu'il peut désigner une page DE CE SITE,
le rendre en `<a target="_blank">` était faux — un nouvel onglet rejouait tout le démarrage de l'app
pour une page qu'un `<Link>` affiche instantanément. Les deux ancres en dur du module
(`ToolDetailDialog`, `ContactRow` de `CommunInfoSection`) passent donc par **`NavLink`**, qui
consomme le contrat 4 voies déjà partagé du parc (`classifyHref`, `src/lib/linkKind.ts`) : route SPA,
nouvel onglet, handler OS (`mailto:`/`tel:` — qui laissaient un onglet vide derrière eux), ou
`<span>` inerte. L'icône « lien externe » ne s'affiche plus que sur ce qui part vraiment ailleurs.

Une normalisation précède la classification : `normalizeToolHref` (`toolsCatalog/utils/toolHref.ts`).
`classifyHref` a été écrit pour des liens de CONFIG et range tout ce qui n'a ni schéma ni `//` ni `#`
dans `internal` ; or ces liens-ci sont saisis par un admin et le serveur tolère DÉLIBÉRÉMENT la forme
sans schéma (`SaveCriteriaAction::safeUrl`, mesurée en base sur Peertube :
`lescommuns.tiers-lieux.org#detail-un-commun.…`). Sans schéma rendu, ce lien partait en navigation
SPA et servait la PAGE D'ACCUEIL en 200 — le silence exact que `linkKind` avait été écrit pour
empêcher. 14 tests, chacun vérifié jusqu'à la VOIE de rendu (`classifyHref`) et pas seulement
jusqu'à la chaîne produite.

⚠️ **Contrepartie assumée, mesurée et bornée** : un lien de forme site-json n'est pas relisible par
le JS des vues legacy, qui découpe sur `split("communId.")[1]`. Les **4** sites de parsing ont été
relus (`listTools` des deux vues, au rendu de la modale et au retour d'enregistrement) : tous sont
gardés par `typeof … != "undefined"` — **aucun crash**. Les conséquences sont donc : le select du
commun n'est plus pré-sélectionné, `getInfoAapTool` n'est pas appelé, et le `href` rendu est relatif
donc mort sur la page CMS. **Aucune perte de donnée** : un enregistrement legacy sans commun choisi
n'envoie pas `urlTool` (`if($("#idCommun").val() != "")`), donc `applyOptionalFields` ne le touche
pas et le lien survit. Le gabarit peut être passé en URL absolue
(`https://<hôte>/aac/commun/{communId}`) sans une ligne de code : le segment reste reconnu des deux
côtés.

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

| Demande | État | Preuve / substitut |
|---|---|---|
| `BaseEntity.saveToolEnrichment()` — édition d'un outil (`COSTUM_SAVE_TOOL_ENRICHMENT`, bearer) | ✅ `1.0.183` — **aucune demande** | `SaveCriteriaAction.php` durcie (elle écrivait sans aucun contrôle d'accès). ⚠️ Sur `BaseEntity`, pas `Organization`. ⚠️ La méthode déballe sa clé métier `data` et perd `results` : **contourné côté site-json**, la lib n'est pas à modifier — cf. §12.1 |
| Filtre de satisfaction du catalogue d'usages | ✅ **aucune demande** | Envisagé en paramètre `requireSatisfaction` sur `COSTUM_TOOLS_CATALOG` et `COSTUM_TOOL_USERS` ; abandonné au profit d'une règle backend inconditionnelle — cf. §10 31/08 |

---

## 12. Détail des dépendances

### 12.1 ✅ Contourné côté site-json — `saveToolEnrichment()` perd `results`

> **Statut** : **aucune demande adressée à la lib.** Le défaut est réel et présent dans les
> versions publiées `1.0.183` → `1.0.189` (commit `6f1a932`, qui a introduit les 5 endpoints du
> catalogue), mais il se neutralise entièrement côté consommateur, sans dépendre d'une republication.
> C'est le choix retenu : `readEnrichmentVerdict` (`toolsCatalog/utils/enrichmentResult.ts`).

**Symptôme** : enregistrer une modification d'outil affiche « L'enregistrement a échoué. » alors que
`POST /costum/francetierslieux/savecriteria` répond **200** et que la base **est bien mise à jour**.
Mesuré sur `navigatorcriteria` : le document « Framateam » porte l'`updated` de la tentative dite
« en échec ».

**Cause** : l'enveloppe de cet endpoint est `{results, msg, data?, name?}`, `results` **à la racine**
(contrat `COSTUM_SAVE_TOOL_ENRICHMENT` : `results` et `msg` sont `required`). La méthode applique
pourtant l'idiome de déballage de ses endpoints voisins — `return (res?.data ?? res)` — alors qu'ici
`data` n'est pas une enveloppe mais une clé **métier** : le document `navigatorcriteria` écrit, que
`SaveCriteriaAction` renseigne dans ses **trois** branches de succès. La lib rend donc toujours le
document, jamais l'enveloppe.

**Pourquoi les voisins ne sont pas touchés** : `getCommunList`, `toolsCatalog` et `getToolUsers`
emploient le même idiome, mais leurs actions ne renvoient jamais de clé `data`
(`Rest::json(["results" => …])`) — le `?? res` les sauve par accident. `savecriteria` est le seul de
la famille dont la réponse porte les deux clés à la fois.

**Pourquoi on peut trancher sans la lib** : `data` et `results` ne sont pas indépendants côté serveur.

| branche serveur                     | `results` | `data`      |
|-------------------------------------|-----------|-------------|
| admin refusé (HTTP 401)             | `false`   | absent      |
| jeton invalide (HTTP 401)           | —         | absent      |
| `name` vide (HTTP 200)              | `false`   | absent      |
| insert / update / insert (HTTP 200) | `true`    | **présent** |

`data` n'est renseigné QUE par les branches de succès, et il y est toujours non vide (`created` /
`updated` au minimum). Les deux 401 ne parviennent jamais au consommateur : axios rejette les 4xx
(aucun `validateStatus` n'est posé) et la promesse est rompue avant. Il ne reste donc que deux formes
en retour, et elles se distinguent : un `results` booléen **présent** est l'enveloppe et fait foi ;
son **absence** signe le déballage d'un `data`, donc un succès.

L'ordre compte : le `results` explicite prime toujours. Le jour où la lib cesserait de déballer, le
module continuerait de dire vrai sans être touché — et n'aurait alors plus qu'à disparaître.

**Les deux comportements de lib sont couverts, et l'équivalence est testée comme telle** : les trois
réponses HTTP 200 de `SaveCriteriaAction::run()` sont rejouées à travers les DEUX implémentations
plausibles — la déballante (`res?.data ?? res`, celle en place) et la fidèle (`res`, une lib corrigée
ou patchée en local) — et le verdict doit être identique et correct dans les deux cas. Sans quoi le
module dépendrait de la version installée : une simple réinstallation de `node_modules` ferait
réapparaître le toast d'échec sur un enregistrement réussi. 16 tests au total ; vérifié discriminant
en cassant la fonction dans les deux sens (ne gérer que la lib déballante → 4 rouges ; ne gérer que
la fidèle → 6 rouges).

Corollaire de typage : le hook déclare `unknown` et non `ToolEnrichmentResult` — selon la lib
installée, la valeur rendue est l'enveloppe OU le document déballé, et la typer en enveloppe serait
une affirmation fausse. Aucun appelant ne lit `mutation.data` ; seul le verdict compte.

---

---

## 13. Points d'attention / limitations

- ⚠️ **Trois sites partagent les deux actions backend** (`toolscatalog`, `toolusers`) : ce site, le
  Navigateur des tiers-lieux et RELIEF. Aucune modification n'y est locale.
- ⚠️ **`costum` et `citizenToolKit` se déploient ensemble** depuis le 31/08 : sans le second,
  `Coform::criteriaUsageCatalog` n'existe pas et les deux actions tombent.
- ⚠️ **`CommunInfoAction` fige des `FIELD_*`** propres au formulaire tiers-lieux
  (`6438366673d20a0de1533c77`). Sur un commun de CET appel, ces clés d'input sont absentes → le bloc
  « Informations liées au commun » se réduit au titre et à la description. Piste : les rendre
  configurables par props de section.
- ⚠️ **Le lien de commun de forme site-json est dégradé côté legacy** — contrepartie assumée du
  27/08, mesurée et bornée (aucun crash, aucune perte de donnée). Se règle sans une ligne de code en
  passant le gabarit en absolu dès que l'hôte est arrêté.
- ⚠️ Le catalogue d'usages est ancré sur une organisation **différente** de celle du site (cf. §1).
- ⚠️ **`priceInt` n'est jamais stocké** — il est calculé par les pipelines d'enveloppe de `Aap.php`.
  Règle de lecture d'un montant : `toSafeInt(price)` sur un **document**, `priceInt ?? price` sur
  l'**enveloppe**. La base porte 178 `price` en `string`, 75 en bool, 200 null (cf. §10 08-09/09).
- ⚠️ **Le gate de financement est `form.coremu`**, à la racine du form AAP — pas `coRemuneration`,
  qui n'existe nulle part dans le legacy. `financerLimitRoles` / `limitTypes` ne sont **pas**
  contrôlés à l'écriture : affichage seulement, jamais une sécurité.
- ⚠️ **L'optimiseur `/img` ne peut pas préserver l'alpha en JPEG** (servi aux clients qui n'annoncent
  ni AVIF ni WebP). Sans effet sur les navigateurs, mais un logo transparent y apparaît sur fond
  blanc. Corollaire pratique : `.cache/images` et le `Cache-Control: immutable` masquent tout
  changement d'image à URL identique — vider `.cache/images` **et** forcer le rechargement pour
  vérifier à l'écran.
- ⚠️ **`CLAUDE.md` est gitignoré** : le préflight `section-meta` le contrôle *s'il est présent*. Un
  compteur périmé rougit en local sans rien dire de la CI.
- ⚠️ **L'ajout d'une organisation n'est pas modéré** : avec `requiresAdmin: false`, toute personne
  connectée crée une organisation qui entre aussitôt dans l'annuaire **et** dans le finder
  « J'utilise » des communs, les deux lisant le même périmètre.
- ⚠️ **`--gradient-section` est surchargé pour tout le site** (`theme.customCSS`) : toute future
  section `searchHeader` ou `cta-newsletter` prendra la bande rose, pas le turquoise de la feuille
  partagée.

---

## 14. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| ~~Fournir le logo~~ — **fait le 09/09** ; reste à obtenir de la Fédération un **SVG ou une version à jour** (l'actuel vient d'un annuaire tiers, 2023) | Schumann |
| **Activer la préconfiguration « Système de coremuneration »** sur le formulaire de l'appel si la Fédération veut le financement — sans `form.coremu`, les trois blocs sont masqués (comme dans le legacy) | Aboire / Fédération |
| **Déployer le correctif legacy du 500 de `POST /survey/coform/getformbyid`** (form de type `aapConfig`) **avant** la mise en production du module AAC — sinon `campagne` et tout `config.*` restent invisibles | Aboire |
| `showOpenSourceToggle` : 2 outils sur 83 sont marqués open source — garde-t-on le filtre ? | Schumann |
| Passer `communUrlTemplate` en URL absolue une fois l'hôte du site arrêté | Schumann |
| Rendre configurables les `FIELD_*` de `CommunInfoAction` | à arbitrer |
| Vérification navigateur des lots 27/08, 31/08 et 03/09 — **jamais faite** (celui du 08-09/09 a été vérifié en SSR de production) ; **s'y ajoute le profil projet du 09/09**, bloqué ce jour-là par un `git stash pop` non résolu sur `src/modules/aac/routes.tsx` | Schumann |
| **Réactiver les onglets « Actions » et « Financements » du profil projet** (retirés le 09/09) — ≈ 30 min de config, mais subordonné à l'activation de `form.coremu` ci-dessus, faute de quoi ils s'affichent vides | Schumann / Fédération |
| Étendre `profiles` aux types `organizations` / `citoyens` / `events` / `poi` si des liens du site s'y mettent à pointer — aujourd'hui ils tombent sur `default`, dont les sous-routes de détail ne sont pas résolues (cf. §10 09/09) | à arbitrer |
| **Fournir les coordonnées publiques** (e-mail de contact, site web, réseaux sociaux) — le footer n'en affiche aucune depuis le 14/09, la fiche Communecter de l'organisation n'en portant pas | Fédération |
| **Compléter les 2 pages légales avant publication** : forme juridique, SIREN/RNA, siège, téléphone, courriel, directeur de la publication, hébergeur, prestataires, licence des contenus, cookies et traceurs, durées de conservation, prestataires de paiement, statut RGAA | Fédération |
| Créer les pages CGU, licences et accessibilité ? Non créées le 14/09 : les 2 pages obligatoires d'abord | à arbitrer |
| Logo du footer rendu en 32×32 : le lockup 662×308 y est peu lisible — un pictogramme carré réglerait le rendu sans code | Fédération |
| **`scrollbar-gutter: stable`** absent de `src/index-rezo-la-mer.css` (feuille partagée avec Rézo la mer) : une page longue et une page courte décalent encore le contenu centré de la largeur de l'ascenseur, et l'ouverture d'une modale fait sauter le header. Correctif déjà en place sur `index-parent62.css` et `index-rezo-sante-reunion.css` — écarté le 14/09 | à arbitrer |
| ~~Grille du footer figée à 5 colonnes pour 3 colonnes de liens~~ — **fait le 14/09** : autant de parts que de blocs (cf. §10 14/09ter) | — |
| **Vérifier le footer connecté** (lot du 15/09) : « Créer un compte » et « Se connecter » masqués, « Mon profil » pointant sur `/profil/<son slug>`. Demande un compte de test — l'entité impose le SSO `lescaecoop` (cf. ci-dessous) | Schumann |
| Le header `standard`, celui de ce site, **ignore la clé `visibility`** de ses entrées de menu, contrairement à `transparent-scroll` et `stacked` — écarté le 15/09, à traiter si une entrée de menu doit dépendre de la connexion | à arbitrer |
| **Bug « nouvel onglet » du header, mis de côté le 14/09** : « Profil » et « Administration » du menu du compte (`AuthMenu`, visible une fois connecté) naviguent par `navigate()` et ne s'ouvrent pas dans un nouvel onglet ; « Se connecter » (`LoginButton`) et le CTA du hero (`HeroSection`) sont aussi des boutons. Correctif : les rendre en `<Link>` (pattern de l'entrée Kanban). Composants partagés par tout le parc (cf. §10 14/09ter) | à arbitrer |
| Aligner les pages de module (fiche d'un commun, connexion, coform) sur le gabarit 1280 px ? Leur header et leur footer restent plus larges que ceux des pages de config : trait de bordure plus long au-delà de 1280 px, contenu décalé de 128 px à partir de 1536 px (cf. §10 14/09bis). Le passage inverse, tout en pleine largeur, a été tenté et annulé le 14/09 | à arbitrer |
| **Qui peut ajouter une organisation depuis `/annuaire` ?** `requiresAdmin: false` posé le 24/09 (tout utilisateur connecté, sans modération — cf. §13). Le passer à `true` réserve le bouton aux admins du site | Fédération |
| **Vérifier une création réelle depuis `/annuaire`** : `source.keys: ["federationDesCae"]` posé, type « Coopérative » présélectionné, apparition sans rechargement, présence dans « J'utilise ». Demande un compte de test (SSO `lescaecoop`) | à confirmer |
| Ajouter à l'annuaire un onglet « Personnes » (les 9 membres de l'entité, via `links.memberOf`) ? | à arbitrer |
| Nom `Coop&amp;Bât` stocké encodé en base — à corriger dans la fiche de l'organisation | Fédération |
