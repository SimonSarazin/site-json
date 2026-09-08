[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Équipements sportifs scolaires — La Réunion (`ESS974`)

> **Document de travail du projet de configuration.** Déclinaison scolaire du site
> [Équipements sportifs — Région Réunion](equipements-sportifs.md), livrée en **consultation
> seule** (lot 1). **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Observatoire](../doc/27-module-observatoire.md) ·
> [Module Search](../doc/07-module-search.md) · [Module formEngine](../doc/28-module-formengine.md).
> Mémoire : `[[project-ess974]]` · Plan : `.claude/plans/plan-ess974-equipements-sportifs-scolaires.md`
> · Demande backend : [`demande-backend-ess974.md`](../../demande-backend-ess974.md).

Dernière mise à jour : **2026-08-06** (création du site — lot 1 livré, gates au vert).

---

## 1. Contexte du projet

Le site parent `equipementsSportifs974` publie le **Recensement des équipements sportifs (RES)**
de La Réunion (3 061 fiches). Une partie de ce parc — **708 équipements** — relève des
**établissements scolaires** (écoles, collèges, lycées) et a été taguée en base avec la clé
`ESS974`. Le besoin : un site dédié à ce périmètre, avec la même chaîne annuaire /
observatoire / data, mais des contenus adaptés au contexte scolaire.

C'est la **deuxième déclinaison** du site équipements, après
[Saint-Paul Sport](../config.prod.saint-paul-sport.json) (filtrage par commune, 28/06). Elle en
diffère sur un point structurant : ESS974 dispose de sa **propre entité costum**, ce qui rend le
scoping automatique — là où Saint-Paul devait filtrer explicitement (cf. §7).

### Identité

| | |
|---|---|
| Slug | `ESS974` |
| Entité backend | `projects` · `6a69e64c7f77a86acc6c9e38` · « ESS974 Equipepement Sportif Scolaire Réunion » |
| Config | [`../config.prod.equipements-Sportifs-Scolaire.json`](../config.prod.equipements-Sportifs-Scolaire.json) — 164 Ko, 8 pages, 15 sections |
| CSS | [`../src/index-equipements-sportifs.css`](../src/index-equipements-sportifs.css) — **partagé** avec le site parent et Saint-Paul Sport (jamais modifié : la palette vit dans `theme`, propre au site) |
| Images | `public/images/equipementsSportifs974/` — **mutualisées** avec le site parent |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `transparent-scroll` / `contact-partners` |
| Déploiement | `site-json-equipements-sportifs-scolaires` · `equipements-sportifs-scolaires.00.re` |
| SDK | `@communecter/cocolight-api-client` **1.0.173** |
| Branche | `ess974` (depuis `main` @ `c2023f65`) |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| 06/08 | Peterson | Création de l'entrée `sites.json` et du fichier de config (vide) |
| 06/08 | Claude | Sondage du périmètre, lot 1 (config complète en consultation), demande backend |
| 06/08 | Claude | Lot « design » : refonte de la page d'accueil et du footer sur la maquette `campus-sports-kit`, nouvelle palette (§4.4) |

---

## 2. Objectifs de la configuration

1. **Rendre cherchable** le sous-ensemble scolaire du RES (708 équipements).
2. En donner une **lecture analytique** : répartition par commune, EPCI, type, nature, accessibilité.
3. Offrir une **table brute exportable** pour les réutilisateurs de données.
4. *(lot 2, bloqué)* Permettre à un établissement de **compléter ou corriger** une fiche.

---

## 3. Architecture générale

```
                 ┌────────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json) — slug ESS974       │
                 │   8 pages · 13 sections                    │
                 │   /equipements-sportifs  ← recherche       │
                 │   /observatoire  ← tableau de bord         │
                 │   /data          ← table brute + export    │
                 └──────────────┬─────────────────────────────┘
                                │ searchCostum (contexte costum ESS974)
                 ┌──────────────▼─────────────────────────────┐
                 │  Backend Cocolight — projet ESS974         │
                 │  708 POI  (sous-ensemble scolaire du RES)  │
                 │  source.keys = [equipementsSportifs974,     │
                 │                 ESS974]                     │
                 └────────────────────────────────────────────┘
```

**Voie de filtrage** : aucune. Les `baseParams` ne portent **ni `sourceKey` ni `notSourceKey`** —
le scoping vient du contexte costum de l'entité résolue par `VITE_SLUG` au boot
([`../src/lib/apiClient.ts:117-126`](../src/lib/apiClient.ts)). Seul
`defaultFilters.type = "recoveryCenter"` discrimine le type de POI, comme sur le site parent.

---

## 4. Ce que la config met en œuvre

### 4.1 Les 8 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 5 | `hero-parallax` · `categories-grid` · `searchProStatic` · `hero-quick-access` · `gridLayout` — cf. §4.4 |
| `/equipements-sportifs` | 2 | `searchHeader` + `searchProStatic` — la recherche |
| `/observatoire` | 2 | `searchHeader` + `data-observatory` — le tableau de bord |
| `/data` | 2 | `searchHeader` + `data-observatory` — la table brute |
| `/rejoindre` | 1 | `registerForm` |
| `/mentions-legales` · `/confidentialite` · `/accessibilite` | 1 chacune | socle légal |

Structure **identique au site parent**. L'observatoire reprend ses 13 dimensions, 7 KPI,
5 graphes et sa table à 9 colonnes sans modification.

### 4.2 Les 5 filtres, dimensionnés sur la donnée réelle

| Filtre | Champ | Options | vs parent |
|---|---|---|---|
| `poi-postalCode` | `address.postalCode` | **27** | 25 → **+6 CP réels manquants**, −4 sans donnée |
| `type` | `equip_type_name` | **34** | 109 → réduit aux types présents |
| `poi-amenities` | 5 booléens | **5** | inchangé — tous discriminants (sondés) |
| `propertyType` | `equip_prop_type` | **6** | 12 → réduit |
| `availableSpaces` | `equip_loc_type` | **10** | inchangé, **1 valeur corrigée** |

Le filtre `utilisateur` du parent a été **retiré** : non discriminant sur ce périmètre
(~92 % des POI portent « Scolaires,universités »), et sa valeur contient une virgule —
incompatible avec le format d'URL `?param=v1,v2`.

`availableSpaces` : la valeur `"Salle(s) de réunion / cours"` du parent ne matche **aucun**
document (la donnée écrit `"Salle(s) de réunion/cours"`, sans espaces). Corrigée ici ; le
défaut subsiste côté parent.

### 4.3 Accès rapides

Les 14 cartes de la home ont été reconstruites sur les **14 types les plus fréquents du
périmètre** — 3 des 14 cartes du parent (Boucle de randonnée, Bassin ludique de natation,
Terrain de boules) ne ramenaient aucun résultat ici. Couverture : **444 / 500 POI** de
l'échantillon. 11 icônes reprises du parent, **3 SVG neufs** (Aire de saut, Terrain de handball,
Salle de danse).

---

## 5. Modèle de données réel (sondé le 2026-08-06, backend `communecter74-dev`)

Périmètre : **708 POI**, tous `type: "recoveryCenter"`. Agrégations sur un échantillon de 500.

| Champ | Distribution |
|---|---|
| `source.key` | `equipementsSportifs974` (100 %) |
| `source.keys` | `["equipementsSportifs974", "ESS974"]` (100 %) |
| `equip_type_name` | 34 distincts — Multisports/City-stades 139 · Volley 43 · Gymnase 43 · SAE 42 · Piste d'athlé 31 |
| `address.postalCode` | 27 CP / 27 communes — Saint-Denis 79 · Saint-Pierre 61 · Bois-de-Nèfles 59 |
| `equip_prop_type` | Commune 185 · Région 135 · Département 130 · Ét. d'enseignement privé 34 · Ét. Public 9 · Association(s) 7 |
| `equip_gest_type` | Commune 271 · Département 85 · Ét. d'enseignement privé 41 · État 41 · Région 33 |
| `equip_nature` | Découvert 350 · Intérieur 129 · Extérieur couvert 16 |
| `inst_nom` | **215 installations**, 0 avec virgule, 0 `inst_numero` manquant |
| `equip_surf` | renseignée à **100 %** |
| Accessibilité | `inst_acc_handi_bool` 279 TRUE / 221 FALSE · `equip_pmr_acc` 11 TRUE seulement |

**Costum backend** : le projet `ESS974` porte un costum `costumize` **minimal** — pas de
`typeObj`, pas de `lists`, pas d'`import.mapping` (le parent a les trois). C'est la cause du
blocage du lot 2 (§12).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.equipements-Sportifs-Scolaire.json`](../config.prod.equipements-Sportifs-Scolaire.json) |
| Déclaration du site | [`../sites.json`](../sites.json) — entrée `ESS974` |
| CSS | [`../src/index-equipements-sportifs.css`](../src/index-equipements-sportifs.css) *(partagé, non modifié)* |
| Assets | `public/images/equipementsSportifs974/` *(partagés, non modifiés)* |
| Demande backend | [`demande-backend-ess974.md`](../../demande-backend-ess974.md) |
| Plan | `.claude/plans/plan-ess974-equipements-sportifs-scolaires.md` |

Aucun fichier de `src/` n'a été touché : le lot 1 est **100 % config**.

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| **Aucun `sourceKey` dans les `baseParams`** | `ESS974` est une vraie entité costum : le scoping par contexte donne 708, mesuré. Ajouter un filtre explicite serait redondant et fragile. |
| **Ne pas reprendre le pattern Saint-Paul Sport** | `notSourceKey` + `defaultFilters["source.key"] = "ESS974"` renvoie **0** — la clé `ESS974` vit dans `source.keys`, pas `source.key`. |
| **Consultation seule au lot 1** | Le formulaire costum est inutilisable tant que l'entité n'a pas ses `lists` (§12). Livrer un bouton qui mène à une impasse aurait été pire que ne pas le livrer. |
| **Filtres réduits au réel** | 6 codes postaux réels manquaient dans la liste du parent : 58 POI étaient inatteignables par le filtre. |
| **`valueMap` EPCI complété** | Le mapping du parent laissait 123 POI sur 500 sans EPCI (`97410`, `97418`, `97450`, `97470`, `97490` absents). Corrigé ici. |
| **Bloc `reservations` conservé** | Les 708 POI sont les **mêmes documents** que ceux du parent : le CoForm de réservation reste pertinent. |
| **Images et CSS mutualisés** | Même charte, même thème. Un dossier d'images dédié serait vide. |
| **Ids de sections renommés** | Le parent traîne `hero-rezo-la-mer` et `hero-sport-sante`, vestiges de copier-coller. Fichier neuf ⇒ `hero-accueil`, `piliers`, `acces-rapide`. |

---

## 8. Étapes de mise en place

1. Entité `ESS974` créée en base *(fait, hors dépôt)*.
2. Entrée `sites.json` + fichier de config *(fait)*.
3. Gates locales *(fait, §10)*.
4. **À faire** : merge vers `main`, puis déploiement Coolify
   (`site-json-equipements-sportifs-scolaires`, domaine `equipements-sportifs-scolaires.00.re`) —
   DNS à poser.

---

## 9. Impacts des modifications

### Lot 1 — création du site (2026-08-06)

**Ce qui change** : un fichier de config neuf, et l'entrée `sites.json` corrigée
(`coolifyApp` et `domain` dupliquaient ceux du parent, ce qui aurait fait échouer le
déploiement Coolify sur un conflit de domaine).

**Régressions à revalider** : aucune sur les autres sites — aucun fichier partagé n'a été
modifié (CSS, images, `src/`). Les préflights `sites-configs`, `config-integrity` et
`deploy-targets`, qui **échouaient** à cause du fichier vide et des doublons de domaine,
repassent au vert.

**Gates** : cf. §10.

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Config valide (Zod) | ✅ | 8 pages, 13 sections |
| 2 | Audit qualité | ✅ | **RAS** — 0 constat (i18n, liens, assets, thème, prérequis) |
| 3 | Rendu SSR | ✅ | 8/8 pages en 200, **13/13 sections** avec du contenu |
| 4 | Périmètres de données | ✅ | **3/3 à 708 résultats** (annuaire, observatoire, data) |
| 5 | Filtres alignés sur la donnée | ✅ | 0 valeur orpheline, 0 type réel sans option, 0 virgule |
| 6 | Préflight | 🟡 | 434/438 — **4 échecs tous préexistants** (§12) |
| 7 | Aperçu navigateur | ❌ | jamais ouvert |
| 8 | Déploiement | ❌ | à faire |
| 9 | Saisie / back-office | ❌ | **bloqué backend** (§12) |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune évolution du SDK n'est demandée. Le registre bundlé `costum-extensions.json` ne contient
pas d'entrée `ESS974`, mais c'est **sans effet** sur le lot 1 : la consultation n'utilise pas les
schémas costum.

La dépendance du lot 2 porte sur la **donnée backend**, pas sur le SDK — cf.
[`demande-backend-ess974.md`](../../demande-backend-ess974.md).

---

## 12. Points d'attention / limitations

### Saisie et back-office bloqués (lot 2)

Deux causes **indépendantes**, toutes deux côté backend :

1. L'entité `ESS974` n'a **pas de `serverData.lists`** (le parent en a 8). Le formulaire costum
   lit ses options exclusivement dans `carrier.serverData.lists`, où `carrier` est l'entité du
   slug du site ([`../src/modules/profil/forms/EntityFormModal.tsx:91,108`](../src/modules/profil/forms/EntityFormModal.tsx)).
   Les 8 selects sortiraient vides — dont `equip_type_name`, **requis en étape 1** d'un wizard
   `validatePerStep: true` : impasse dès le premier écran.
2. Le costum n'a **pas de `typeObj`** ⇒ les ~30 champs `equip_*`/`inst_*` seraient
   vraisemblablement rejetés au `element/save`.

⚠️ `VITE_COSTUM_FORCE_LIVE` **ne corrige ni l'un ni l'autre** : il ne pilote que le
`CostumRuntimeContext` du SDK.

### Le bouton « Ajouter équipement sportif » reste affiché

Avec `action: "add-poi"` seul (sans `modal`), il ouvre le formulaire POI **standard**, sans les
champs `equip_*`. Même comportement que sur Saint-Paul Sport. À arbitrer : le retirer, ou
l'assumer jusqu'au lot 2.

### Écueil d'outillage — dossier d'images fantôme

`config:render` **et** `npm run dev` créent `public/images/<VITE_SLUG>/` au montage du
middleware d'upload ([`../server/middleware/imageUpload.js:23`](../server/middleware/imageUpload.js)),
même sans upload. Un `public/images/ESS974/` vide a ainsi été créé puis supprimé pendant le
lot 1. Le préflight `site-assets` échoue sur tout dossier qu'aucun slug ne déclare — c'est
l'origine du `public/images/saintpaulSport1/` vide qui traîne depuis le 16/07.

### Échecs préflight préexistants (4, vérifiés hors périmètre)

`bundle-size` (2,44 Mo > 2 Mo) · `environment` (`VITE_BASE_URL_BACKEND` guillemeté dans `.env`) ·
`site-assets` (`public/images/saintpaulSport1/` vide et non déclaré) · `skill-integrity`
(agent `siteforge-config-auditor` absent).

### Données sondées sur l'instance de **dev**

Les 708 POI et toutes les agrégations viennent de `communecter74-dev`. Les volumes en production
sont **à confirmer**.

### Marqueurs légaux

Les 3 pages légales conservent l'éditeur et les coordonnées du site parent (Région Réunion,
Saint-Denis) et ses placeholders `[à compléter]` — mêmes trous que sur le parent et Saint-Paul
Sport. Le partenaire du footer (académie de La Réunion — Jeunesse, Engagement et Sports) est en
revanche pertinent pour un site scolaire.

---

## 13. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| Doter l'entité `ESS974` de `serverData.lists` et `costum.typeObj.poi` | backend — destinataire à trancher (Aboire ou admin Communecter) |
| Un équipement créé depuis ESS974 doit-il porter `source.key = "equipementsSportifs974"` (visible sur les deux sites) ou `"ESS974"` seul ? | Peterson + backend |
| Garder ou retirer le bouton « Ajouter équipement sportif » tant que le lot 2 est bloqué | Peterson |
| Compléter les marqueurs légaux (directeur de publication, hébergeur, contact RGPD) — commun aux 3 sites équipements | Peterson |
| Poser le DNS `equipements-sportifs-scolaires.00.re` et déployer | Peterson |
| Vérifier les volumes réels en production | Peterson |
