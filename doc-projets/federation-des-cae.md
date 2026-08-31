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

Dernière mise à jour : **2026-08-31** (extraction du dossier ; règle de satisfaction et
sous-catégorie du catalogue d'usages — cf. §10).

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
| Costum backend | **aucun** (pas d'entrée `costum` pour ce slug) |
| Formulaire de l'appel | `677e7e389058e31575550ac8` — « Les communs des CAEs » (type `aap`), **20 réponses** |
| Formulaire d'observatoire | `6525865cdeaf281bbc7280e9` — « Observatoire des besoins et solutions des CAEs », **35 réponses** |
| Branche | **`aac-dev`** (le config est absent de `jdev` et de `main`) |
| SDK | `@communecter/cocolight-api-client` **1.0.189** |

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

---

## 2. Objectifs de la configuration

- Présenter l'Appel à Communs de la Fédération et son avancement (page d'accueil).
- Offrir l'**annuaire des communs** déposés, avec fiche de détail par commun.
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
   └── page /usages      → toolsCatalog (module partagé avec tiers-lieux / RELIEF)
                              formId 6525865c… (observatoire), pas le formulaire de l'appel
```

Deux chaînes de données **indépendantes** cohabitent : le module AAC lit le formulaire de l'appel,
le module `toolsCatalog` lit celui de l'observatoire. Elles ne partagent ni formulaire, ni
organisation porteuse, ni collection de réponses.

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

Blocs racine présents : `meta`, `theme`, `header` (`standard`), `footer` (`default`), `aac`,
`cagnotteModuleConfig` (`defaultType: "aac"`). **Absents** : `auth`, `admin`, `profiles`,
`commandPalette`, `costumForms` — le site est en lecture publique, l'enrichissement d'un outil
reposant sur le droit admin du costum côté backend.

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
| Saisies portant `happiness` (la satisfaction) | 158 |
| Outils au catalogue après agrégation | 83 |

**Deux faits de modèle à ne pas réapprendre :**

1. Un **`criteriaId` est une ligne de besoin partagée par toutes les réponses** du formulaire, pas la
   saisie d'un lieu. Sélectionner dessus seul mélange les outils de lieux différents.
2. Le **libellé du besoin appartient à cette ligne**, pas à la saisie. Il vit dans
   `answers.criterias<inputKey>`, porté par les quelques réponses qui l'ont semé, et une saisie ne le
   recopie que si le formulaire l'a écrit à ce moment-là (36 sur 261). Il est **indexé par input** :
   `criteria1747166631` vaut « Agenda événementiel » en Communication externe et « Chat de discussion
   entre membres » en Coopération interne.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.federationDesCae.json`](../config.prod.federationDesCae.json), `../sites.json` |
| Module AAC | [`../src/modules/aac/`](../src/modules/aac/) — cf. [`../doc/34-module-aac.md`](../doc/34-module-aac.md) |
| Catalogue d'usages | [`../src/modules/toolsCatalog/`](../src/modules/toolsCatalog/) (partagé — cf. [tiers-lieux.md](tiers-lieux.md)) |
| Lien de commun | `../src/modules/toolsCatalog/utils/communLink.ts`, `toolHref.ts`, `enrichmentResult.ts` |
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
| 2 | Page `/usages` — catalogue | ✅ | 83 outils, 9 catégories, 37 facettes de besoin |
| 3 | Fiche d'un outil — lieux utilisateurs | ✅ | filtrée sur le nom normalisé ET les `criteriaId` |
| 4 | Fiche d'un outil — sous-catégorie | ✅ | 31/08 — repli catalogue ajouté au détail |
| 5 | Enrichissement d'un outil (admin) | ✅ | enregistrement, rattachement d'un commun, deux formes de lien |
| 6 | Bloc « Informations liées au commun » | 🟡 | rendu, mais `CommunInfoAction` fige des `FIELD_*` propres au formulaire tiers-lieux → réduit au titre et à la description sur un commun de CET appel (cf. §13) |
| 7 | Logo du site | ❌ | `header.logo` pointe `images/federationDesCae/logo.png`, absent de `public/` — seul constat d'audit |
| 8 | Version mobile du catalogue | 🟡 | lot en cours, non commité |
| 9 | Vérification navigateur | ❌ | **jamais faite** sur les lots du 27/08 et du 31/08 |

**Gates au 31/08** : `typecheck` ✅ · `eslint` ✅ · `test:unit` 3343 ✅ ·
`config:validate` ✅ · `audit:config` 1 constat (le logo, ci-dessus) ·
`config:render` 3/3 pages, 6/6 sections avec contenu SSR · `config:probe` aucun `baseParams` à sonder.
Le préflight `site-assets` est **rouge** : `public/images/federationDesCae/` est un dossier vide
qu'aucun slug ne réclame — même cause que le point 7.

---

## 10. Impacts des modifications

### 31/08 — un usage non évalué n'est pas un usage, et le besoin a un nom

**Deux constats sur le catalogue d'usages, tranchés ensemble parce qu'ils touchent la même paire
d'actions backend.**

**(a) Les saisies muettes comptaient.** Une saisie de `commonTable` dont la **satisfaction
fonctionnelle** (`happiness`) est vide n'est pas un usage constaté : le lieu a coché l'outil sans
rien en dire. La fiche d'un outil listait ces lieux avec un « Non évalué » sans information, et la
liste les COMPTAIT parmi les usages — le compteur d'une carte ne correspondait donc pas à ce que sa
fiche montrait. Ce n'est pas marginal : **103 saisies sur 216 (48 %)** ici, 52 % chez les tiers-lieux.

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

**Vérifié en réel** (A/B sur l'endpoint) : 83 → 83 outils, occurrences **216 → 113**, 32 outils à
`usagesCount: 0`, facettes d'usage 39 → 37 (deux besoins n'existaient que par des saisies muettes —
autant d'options de filtre qui ne ramenaient rien), catégories 9 → 9. Le paramètre
`requireSatisfaction` envoyé à `true`, à `false` ou absent donne désormais **la même réponse**. Et
sur la fiche Framateam, les deux lignes remontent enfin leur besoin (« Débat et décisions en ligne »,
« Chat de discussion entre membres »).

**Portée hors de ce site** : le Navigateur des tiers-lieux et RELIEF sont servis par la même action
et héritent de la règle — 27 de leurs 69 outils perdent leur pastille d'usage, facettes 51 → 41.
Assumé, c'est le même défaut de donnée là-bas ; consigné dans [tiers-lieux.md](tiers-lieux.md).

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

---

## 14. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| Fournir le logo `public/images/federationDesCae/logo.png` (débloque l'audit ET le préflight `site-assets`) | Schumann |
| `showOpenSourceToggle` : 2 outils sur 83 sont marqués open source — garde-t-on le filtre ? | Schumann |
| Passer `communUrlTemplate` en URL absolue une fois l'hôte du site arrêté | Schumann |
| Rendre configurables les `FIELD_*` de `CommunInfoAction` | à arbitrer |
| Vérification navigateur des lots 27/08 et 31/08 — **jamais faite** | Schumann |
