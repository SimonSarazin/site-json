[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Saint-Paul Sport — commune de Saint-Paul

> **Document de travail du projet de configuration.** Déclinaison du site
> [Équipements sportifs](equipements-sportifs.md) filtrée sur la **commune de Saint-Paul**,
> 100 % config, sans entité costum dédiée. **À tenir à jour à chaque lot livré**, selon le
> formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Sections dynamiques](../doc/06-sections-dynamiques.md) ·
> [Module Articles/Blog](../doc/32-module-articles-blog.md) ·
> [Module Agenda](../doc/29-module-agenda.md).
> Mémoire : `[[project-cocolight-siteforge]]` (le projet y est suivi — pas de fiche dédiée).

Dernière mise à jour : **2026-09-23** (lot « observatoire embarqué » — 3ᵉ vue dans la page Équipements).

---

## 1. Contexte du projet

Le site « Saint-Paul Sport » est une **déclinaison** du site Équipements sportifs
(`config.prod.equipements-Sportifs.json`) recentrée sur la commune de **Saint-Paul**
(`address.localityId = 54c0965cf6b95c141800a518`). Approche retenue dès l'origine :
**une config JSON seule** — pas d'entité costum backend dédiée à l'exploitation des données ;
seule l'entité `saintpaulSport1` existe en base comme référence de slug et source
(`source.key`) des contenus éditoriaux du site.

Les données **équipements** restent sourcées `equipementsSportifs974` (dataset RES du site
parent) ; les contenus **éditoriaux** (news/events, et désormais articles) relèvent du périmètre
commune **ou** de la source `saintpaulSport1` (union `$or`).

### Identité

| | |
|---|---|
| Slug | `saintpaulSport1` (entité de référence en base) |
| Config | [`../config.prod.saint-paul-sport.json`](../config.prod.saint-paul-sport.json) — 10 pages / 17 sections (validées le 2026-07-30) |
| CSS | `index-equipements-sportifs` (partagé avec le site parent, cf. `../sites.json`) |
| Images | dossier `public/images/saintpaulSport1/` présent mais **non déclaré** dans `sites.json` (préflight `site-assets` rouge — voir §12) |
| Langues | `fr` (défaut) + `en` |
| Backend dev | `http://communecter74-dev` |
| SDK | `@communecter/cocolight-api-client` **1.0.170** (symlink vers le dépôt frère) |
| Branche | `peter-dev` |
| Chef de projet | Peterson |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| 2026-06-28 | Peterson | Création de la déclinaison (config + slug `saintPaulSport` + thème réutilisé) |
| 2026-07-08 | Peterson | Slug renommé `saintpaulSport1` ; ajout pages `/actualites` (news, bloquée par l'enum) et `/agenda` |
| 2026-07-20 | Aboire | SDK : `news` ajouté à l'enum `searchType` de `GLOBAL_AUTOCOMPLETE_COSTUM` (commit `ceaff2a`, livré en 1.0.170) |
| 2026-07-30 | Peterson (+ Claude) | **Lot « page Actualités à onglets »** : `/actualites` = tabs Actus (POI `article`) / Événements (layout `timeline` développé dans le module search) ; plan `../.claude/plans/plan-saint-paul-sport-actualites-onglets.md` |
| 2026-08-15 | Peterson | Onglet admin « Migration » (reprise de propriété des fiches communales) — cf. section dédiée en fin de page |
| 2026-09-01 | Peterson | Script de génération des **organisations usagères** (41 orgas taguées `usagerEquipementSportif`) côté `communecter74-dev` |
| 2026-09-01/02 | Peterson (+ Claude) | **Lot « usagers des équipements »** : annuaire `/annuaire`, organisateur des événements, grille de réservation ; plan `../../.claude/plans/plan-saint-paul-sport-usagers-annuaire-events-reservation.md` |
| 2026-09-09 | Peterson (+ Claude) | **Lot « lien créneau ↔ organisation »** : champ `finder` sur les organisations taguées ajouté au formulaire de créneaux, champ texte « Usager » masqué, 63 réponses historiques rattachées par identifiant ; 7 associations manquantes taguées (48 au total) ; plan `../../.claude/plans/plan-creneaux-lien-organisation-usagere.md` |
| 2026-09-10 | Peterson (+ Claude) | **Outillage de mise en production** : action de migration `creneauxlienorga` (`communecter-php74`, calquée sur `CreneauxUsagersOrgsAction`) — taguer, poser le champ, reprendre l'historique, en simulation puis application, idempotente ; éprouvée en local par un aller-retour complet. Scripts mongo de secours et retours arrière dans `../../scripts-prod-creneaux/` |
| 2026-09-07 | Peterson (+ Claude) | **Recette complète du lot** : `oneAnswerPerPers` repassé à `false` par Peterson, deux réservations créées et vérifiées de bout en bout, portes rejouées (rendu 12/12, sonde 6/6, `config:validate` ✅), recette en éventail sur 5 dimensions — 3 constats mineurs confirmés (§12) |
| 2026-09-23 | Peterson (+ Claude) | **Lot « liens croisés équipement ↔ organisation »** : bouton vers la fiche du club dans la section réservations, section « équipements réservés » dans la fiche d'une organisation, ouverture d'une fiche par identifiant (`list.previewFetch`) — cf. section dédiée en fin de page |
| 2026-09-23 | Peterson (+ Claude) | **Lot « observatoire embarqué »** : le tableau de bord devient une configuration réutilisable (`ObservatoryPanel`), appelable depuis une section search ; page Équipements → 3ᵉ vue « Observatoire » à côté de liste et carte, et liste à gauche en mode carte — cf. section dédiée en fin de page |

## 2. Objectifs de la configuration

- Décliner le site équipements sportifs sur le périmètre de la commune de Saint-Paul
  (annuaire, observatoire, data — filtrés `address.localityId`).
- Offrir une page **Actualités** à deux onglets : **Actus** (POI `type:"article"`) et
  **Événements** (events du périmètre commune, rendus en **timeline** — maquette Transiter).
- Conserver une page **Agenda** dédiée (grille de cartes, accès historique).
- Aucun développement spécifique au site : tout passe par la config et des briques
  génériques du moteur (la vue timeline est une brique **réutilisable**, pas un dev « site »).

## 3. Architecture générale

```
SiteForge (config.prod.saint-paul-sport.json, slug saintpaulSport1)
   │  searchProStatic → useSearchQuery → buildSearchPayload
   ▼
POST /co2/search/globalautocomplete  (GLOBAL_AUTOCOMPLETE_COSTUM)
   │  searchType: ["poi"] + filters {type:"article", $or{localityId, source.key(s)}}   ← onglet Actus
   │  searchType: ["events"] + filters {$or{localityId, source.key(s)}}                ← onglet Événements & /agenda
   │  searchType: ["poi"] + filters {type:"recoveryCenter", source.key, localityId}    ← équipements/observatoire/data
   ▼
MongoDB (co)
```

Deux idiomes de périmètre coexistent (hérités, assumés) :
**AND** source+localité pour les données RES (`sourceKey` ou `source.key` + `address.localityId`),
**OR** (`$or` objet — jamais tableau) pour l'éditorial : « de la commune OU de la source du site »,
avec `notSourceKey: true` (recherche réseau-wide, gate de modération désactivé — voir §12).
La section `agenda` (module agenda, `searchEventsCostum`) est **inutilisable** ici : le SDK force
toujours le scope `sourceKey` de l'entité (pas d'union commune possible).

## 4. Cahier des charges (lot 2026-07-30)

Demande de Peterson (30/07/2026, avec maquettes) :

1. Page **Actualités** : sous-menu à **deux onglets** « Actus » / « Événements », comme la page
   Communauté de Rezo la Mer (section générique `tabs`) — réutiliser, ne pas recréer.
2. **Actus** : récupérer les **POI de type Article** au lieu des News.
3. **Événements** : récupérer les events avec **le même filtre** (périmètre commune de `/agenda`)
   et les afficher selon la **maquette timeline** fournie (capture Transiter) : ligne verticale
   pointillée, bulles de date, cartes alternées gauche/droite (image, heure, catégorie,
   « En savoir plus »).

Arbitrages rendus par Peterson le 30/07 : timeline **fidèle à la maquette** (dev front d'un layout
de liste réutilisable) ; détail d'un article en **drawer** (pas de navigation `/blog/:slug`) ;
page `/agenda` **conservée telle quelle**.

## 5. Modèle de données réel

**Non sondé au 2026-07-30** : backend dev indisponible au moment du lot
(`MongoConnectionException` — mongo42 à relancer, cf. §12). À compléter dès que la base répond :

| Question | Requête (lecture seule) | Résultat |
|---|---|---|
| Nb d'events du périmètre (`$or` localityId/source) | `config:probe` ou count Mongo | à confirmer |
| Nb de POI `type:"article"` en `source.key(s) saintpaulSport1` | count Mongo | **à confirmer — très probablement 0** (aucune voie de création d'articles dans le site, cf. §13) |
| Champs réellement portés par ces articles (image, shortDescription, tags) | findOne | à confirmer |

Fait structurel connu (doc moteur, [doc/32](../doc/32-module-articles-blog.md)) : les POI articles
**n'ont pas d'adresse** → la branche `address.localityId` du `$or` est **morte** pour eux ; le
périmètre réel des articles est `source.key(s) = saintpaulSport1`. Le `$or` est conservé par
symétrie avec `/agenda` (inoffensif, et prêt si des articles géolocalisés apparaissaient).

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config du site | [`../config.prod.saint-paul-sport.json`](../config.prod.saint-paul-sport.json) (page `/actualites` réécrite ; nav ; le reste inchangé) · `../sites.json` (entrée `saintpaulSport1`, inchangée) |
| Layout timeline (moteur, réutilisable) | `../src/modules/search/schema.ts` (clé `list.layout`) · `../src/modules/search/components/SearchListView.tsx` (dispatch lazy) · `../src/modules/search/components/TimelineListView.tsx` (nouveau) · `../src/modules/search/components/card/CardEventTimeline.tsx` (nouveau) |
| Tests | `TimelineListView.test.tsx` · `card/CardEventTimeline.test.tsx` · `SearchListView.test.tsx` (étendu) · `../tests/preflight/prop-descriptions.test.ts` (planchers relevés) |
| Outillage / doc moteur | `../scripts/lib/prop-descriptions.ts` (description `list.layout`) · [`../doc/07-module-search.md`](../doc/07-module-search.md) (table + §SearchListView) · skill `config-assistant` (checklist presenters) |
| Plan approuvé (30/07) | `../../.claude/plans/plan-saint-paul-sport-actualites-onglets.md` |
| Plan approuvé (01/09) | `../../.claude/plans/plan-saint-paul-sport-usagers-annuaire-events-reservation.md` |
| Spec Aboire (historique) | `../../spec-cocolight-api-saintpaul-news.md` (cf. §11) |
| Spec Aboire (01/09) | `../../spec-cocolight-api-saintpaul-usagers.md` (cf. §11) |
| **Lot usagers — config** | `../config.prod.saint-paul-sport.json` : page `/annuaire` + entrée de nav · champ `organizer` de `costumForms["saintpaul-event"]` · clé `booking` sur les 4 blocs `reservations` |
| **Lot usagers — moteur** | `../src/modules/search/lib/reservations.ts` (conflit + grille horaire) · `../src/modules/search/lib/reservationPrefill.ts` (nouveau) · `../src/modules/search/components/preview/PreviewReservations.tsx` · `../src/modules/search/components/preview/PreviewPoiAmenities.tsx` (passe `resourceName`) · `../src/modules/search/schema.ts` (clé `reservations.booking`) · `../src/components/ui/select-objet.tsx` (correctif du filtre client) · i18n `fr`/`en` |
| **Lot usagers — tests** | `../src/modules/search/lib/reservations.test.ts` (étendu) · `../src/modules/search/lib/reservationPrefill.test.ts` (nouveau) · `../tests/preflight/__effective__/saint-paul-sport.json` · `../.claude/skills/config-assistant/examples/data-observatory.json` (resynchronisé) |

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| **POI `type:"article"` plutôt que `news`** pour l'onglet Actus | `poi` est dans l'enum `searchType` **et** la voie est prouvée en prod (parent62, 6 434 articles). La voie `news` dépendait de la demande 2 backend (indexation dans `globalautocomplete`), jamais vérifiée — voir §11. |
| **Section `tabs` réutilisée** (pattern `/communaute` Rezo la Mer/parent62) | Onglets 100 % config, contenu par onglet = sections arbitraires, fetch lazy par onglet (contenu inactif démonté). Zéro dev. |
| **`searchProStatic` pour les deux onglets** (pas `articleFeed`, pas `agenda`) | `articleFeed` force `sourceKey:[costumSlug]` (pas de périmètre commune) ; la section `agenda` force le scope entité via `searchEventsCostum`. |
| **Nouveau layout `list.layout:"timeline"`** dans le module search (pas une nouvelle section) | L'alternance/ligne/bulles exigent le contexte de liste (index) ; en s'accrochant dans `SearchListView`, drawer, deep-link `?preview=`, `itemRules` et scroll infini sont conservés gratuitement. Défaut **côté code** = grille (config jamais parsée par Zod au runtime) → rétrocompat totale du parc. |
| **Carte `resource` + preview `resource` en drawer** pour les articles | Contrat mappable champ à champ (gabarit parent62) ; drawer = arbitrage Peterson, cohérent avec les événements. Pas d'`itemAction` link `/blog/:slug`. |
| **`descriptionField: "description"`** (pas `shortDescription`) | Le contrat `resource` est unique pour carte ET preview : avec `description`, le drawer rend le corps complet (markdown) et la carte tronque à 180 caractères. Trade-off : l'extrait de carte = début du corps. |
| **`previewParam` distincts** (`preview-actus`/`preview-events`) | Deux listes sur la même page → collision du deep-link `?preview=` sinon. |
| **Tri events `defaultSortBy {"startDate": -1}`** | Maquette : du plus récent au plus ancien, événements passés inclus. |
| **`defaultFields` explicites sur les deux onglets** | Tout champ lu par les presenters doit être projeté (échec silencieux sinon) ; liste couvrant `useItem`/CardEventTimeline/PreviewEvent (`organizer` → `organizerName`) et `useResourceData`/`useResourceEntity` (`slug` obligatoire). |
| **Alternance timeline par index** (pas par date) | Pur et déterministe : stable en scroll infini, identique SSR/client (pas d'horloge, pas d'aléa). |

## 8. Étapes de mise en place

1. Lot livré ensemble le 30/07 (config + moteur) — pas de fenêtre `cle-strippee`.
2. **Prérequis données (bloquant fonctionnel, hors dépôt)** : créer/importer des POI
   `type:"article"` en `source.key: "saintpaulSport1"` (backoffice co/communecter ou import —
   à trancher, cf. §14). Sans eux, l'onglet Actus est vide (état vide propre).
3. Rejouer `config:probe -- config.prod.saint-paul-sport.json --slug saintpaulSport1` et
   l'aperçu `VITE_SLUG=saintpaulSport1 npm run dev` dès que mongo42 est relancé.
4. Déploiement : inchangé (`SITE_CONFIG_PATH` en prod, cf. checklist du site parent).

## 9. Impacts des modifications

### 01–02/09/2026 — lot « usagers des équipements » (branche `peter-dev`, non committé)

Trois fonctionnalités, livrées par lots successifs.

**Lot 1 — annuaire `/annuaire` (config seule).** Page + entrée de nav. Périmètre = **tag seul**
(`{"$or": {"tags": {"$in": ["usagerEquipementSportif"]}}}`) avec `notSourceKey: true` et **sans**
`sourceKey` : les organisations générées sont volontairement **neutres** (décision Peterson du
01/09, elles ne portent plus de `source`). Carte `profile`, détail en drawer `structure`.
Recherche texte seule — l'activité n'existe que dans le texte de `shortDescription` (§13).

**Lot 2 — organisateur des événements (config seule).** La machinerie existait déjà :
`costumForms["saintpaul-event"]`, bouton `/agenda`, contexte costum, modération, onglet admin.
Seul manquait un champ `organizer` (widget `finder`, requis, restreint aux `organizations`).
`requiresAdmin` reste à `true` : aucun contrôle serveur ne vérifie encore qui réserve pour qui
(§11). C'est le **premier usage du widget `finder` dans un `costumForms` du parc**.

**Lot 3 — filtrer les événements par organisation : aucun changement.** L'objectif est atteint par
l'existant — `profiles.organizations.tabs[events]` (`profile-related`, `relationType: "events"`)
lit `links.events`, que le lot 2 alimente. Chaîne vérifiée : annuaire → drawer → « Aller sur la
page » → `/profil/<slug>/events`. Un filtre déroulant « Organisateur » sur `/agenda` serait
**inexprimable en config** (l'organisateur est une clé dynamique `organizer.<id>` avec `$exists`,
or les filtres dynamiques ne produisent que `{champ: {$in: […]}}`) — arbitrage : on s'en passe.

**Lot 4 — réservation d'un créneau (moteur, opt-in).** Nouvelle clé `reservations.booking` : sans
elle, rien ne change (le site parent Équipements sportifs est intact). Avec elle, la grille en
blocs empilés est remplacée par une **grille à l'échelle horaire** dont les cases libres ouvrent le
formulaire CoForm pré-rempli (équipement verrouillé, jour et heures repris). Helpers purs ajoutés :
`slotsOverlap`, `periodsOverlap`, `reservationConflicts`, `buildBookingGrid`, `minutesToLabel`,
`buildReservationPrefill`.

**Correctif hors périmètre initial, assumé** : `select-objet.tsx` activait le filtre client de
`cmdk` **par-dessus** une recherche serveur — toute frappe vidait la liste. Une ligne
(`shouldFilter={!onSearch && …}`). Sans ce correctif le sélecteur d'organisateur est inutilisable.
Bénéficie aussi à `SelectMember` et aux recherches de ville/rue (`AddressEditor`,
`EditLocationTab`).

**Intouché** : `/actualites`, `/observatoire`, `/data`, `/blog`, les pages légales, `sites.json`,
les dépendances, les 17 autres configs, `cocolight-api-client` (lecture seule).

#### Gates au 02/09/2026

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 12 pages / 20 sections |
| `audit:config --file …saint-paul-sport.json` | ✅ **RAS** (0 constat) |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx eslint` (fichiers modifiés) | ✅ 0 constat |
| `test:unit` | ✅ **2820/2823** — 3 échecs préexistants (`bundle-size`, `environment`, `site-assets`) |
| dont nouveaux tests | ✅ 31 (conflit 17, grille horaire 8, préremplissage 6) |
| `config:render` | ✅ 12/12 pages à 200, 20/20 sections avec contenu SSR |
| `config:probe --slug saintpaulSport1` | ✅ **6 périmètres, 0 vide** (annuaire → 41 ; agenda et onglet Événements passés de 0 à 1) |
| Recette navigateur | ✅ annuaire, création d'événement de bout en bout, grille de réservation · ⛔ création de réservation bloquée (§12) |

⚠ Deux artefacts partagés ont été resynchronisés **en conscience** : la fixture
`tests/preflight/__effective__/saint-paul-sport.json` (garde d'impact inter-configs) et l'exemple
`config-assistant/examples/data-observatory.json` — `saintpaulSport1` étant un archétype, son bloc
Observatoire sert de snapshot canonique. Les deux diffs se limitent au lot.

### 30/07/2026 — lot « page Actualités à onglets » (branche `peter-dev`, non committé)

- **Page `/actualites` intégralement réécrite** (searchHeader + tabs ; titre et SEO élargis
  « Actus & Événements ») ; ajout `showSearch` au header (aucune recherche texte ne fonctionnait).
- **Moteur search** : clé de schéma `list.layout` + dispatch + 2 composants — additif, la grille
  historique reste le défaut code ; aucun autre site n'est affecté.
- **Intouché** : `/agenda` (grille `card.type:"profile"` conservée, cf. §14), nav (entrée
  « Actualités » ajoutée dans un diff antérieur au lot), autres pages, autres sites, `sites.json`,
  dépendances, `cocolight-api-client` (lecture seule).
- Rollback : restaurer le bloc page + retirer les 2 nouveaux fichiers et les 4 edits — un seul
  dépôt, git revert trivial.

### Gates au 30/07/2026

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 10 pages / 17 sections |
| `audit:config --file …saint-paul-sport.json` | ✅ RAS (0 constat) |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx eslint` (fichiers modifiés) | ✅ 0 constat |
| `test:unit` | ✅ 2081/2086 — **5 échecs préexistants hors périmètre**, vérifiés un à un : `bundle-size` (dist obsolète), `environment` (`.env` quoté), `site-assets` (dossier `public/images/saintpaulSport1` non déclaré), `skill-integrity` (agent `siteforge-config-auditor.md` référencé absent), `section-meta` (`site-json/CLAUDE.md` inexistant) |
| dont nouveaux tests timeline | ✅ 27/27 (TimelineListView 6 + schéma 1, CardEventTimeline 6, SearchListView +5 et 9 historiques) |
| `config:render` | ✅ 10/10 pages à 200, 17/17 sections avec contenu SSR |
| `config:probe --slug saintpaulSport1` | ❌ **non exécutable** — backend `communecter74-dev` en `MongoConnectionException` (mongo42 à relancer) ; à rejouer |
| Aperçu navigateur | ❌ à faire (même dépendance backend) |

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Socle du site (annuaire, observatoire, data scopés commune) | ✅ | Depuis le 28/06 (cf. mémoire) |
| 2 | Page `/agenda` scopée commune | ✅ | `$or` localityId/source, grille |
| 3 | Page `/actualites` — onglets Actus/Événements | ✅ | Config livrée 30/07 |
| 4 | Onglet Actus en POI `article` | 🟡 | Config ✅ ; **données absentes** (prérequis §8.2) ; rendu réel à vérifier au probe |
| 5 | Onglet Événements en timeline | 🟡 | Moteur + config ✅, 27 tests verts ; contrôle visuel navigateur à faire (backend down) |
| 6 | Recherche texte sur `/actualites` | ✅ | `showSearch` ajouté (pilote l'onglet visible) |
| 7 | Création d'articles depuis le site | ❌ | Aucune voie (ni admin, ni costumForm) — question §13 |
| 8 | Annuaire des organisations usagères (`/annuaire`) | ✅ | 41 organisations, sonde à 41, drawer `structure` vérifié au navigateur (02/09) |
| 9 | Création d'événements avec organisateur | ✅ | Événement créé de bout en bout : `source.key saintpaulSport1`, `links.organizer`, lien réciproque, modération puis publication sur `/agenda` **et** `/actualites` (02/09) |
| 10 | Filtrer les événements par organisation | ✅ | Par l'onglet « Événements » de la fiche d'organisation — aucun développement (arbitrage : pas de filtre sur `/agenda`) |
| 12 | Lien créneau ↔ organisation par identifiant | ✅ | Sélecteur filtré sur le tag, texte masqué, 63 réponses reprises, 64/64 portent l'identifiant et le lien ; vérifié au navigateur (création + affichage d'une réservation historique) |
| 11 | Réservation d'un créneau depuis la fiche | ✅ | `oneAnswerPerPers` passé à `false` le 07/09 → **deux réservations créées de bout en bout** sur un même équipement (mardi 18 h, jeudi 10 h) par le même compte, stockées à la forme historique (`finder<step>` + tableau de créneaux), grille passée de 98 à 96 cases libres et créneaux pris rendus non réservables |

## 11. Dépendances SDK ↔ `cocolight-api-client`

| Demande | État | Preuve / substitut |
|---|---|---|
| Spec `spec-cocolight-api-saintpaul-news.md` — demande 1 : `news` dans l'enum `searchType` de `GLOBAL_AUTOCOMPLETE_COSTUM` | ✅ **Livrée** | Commit SDK `ceaff2a` (20/07/2026), en 1.0.170 (version consommée, symlink) |
| Demande 2 : le backend `globalautocomplete` **retourne** des news filtrables localityId/source | 🟡 Non vérifiée | **Rendue sans objet pour `/actualites`** par la bascule POI article. La voie news reste théoriquement utile ailleurs — statut de la spec à clore/archiver, décision Peterson (§14) |
| Lecture des POI `type:"article"` | ✅ Aucune demande | `poi` déjà dans l'enum ; `filters` libre (`additionalProperties:true`) |
| Création d'articles depuis le site (si retenue) | ❌ À spécifier | `ADD_POI` n'accepte pas `type:"article"` sans variant costum (`costum-extensions.json`) — nouvelle demande Aboire à rédiger le cas échéant |
| Spec `spec-cocolight-api-saintpaul-usagers.md` — **autoriser l'organisateur côté serveur** (`ADD_EVENT`) | ❌ Transmise le 02/09 | Le backend reprend `organizer` tel quel : n'importe quel appel direct peut publier au nom d'un club. Condition pour ouvrir le bouton `/agenda` au public (`requiresAdmin: false`) |
| Modération des événements sous costum (`preferences.toBeValidated`) | ✅ Conforme | Vérifié en base : `{"toBeValidated": {"saintpaulSport1": true}}`, invisible avant validation, publié après. Aucune demande |
| Estampillage `source.key` des créations sous costum | ✅ Conforme | Vérifié : `{"insertOrign":"costum","key":"saintpaulSport1"}` + stamps `reference.costum`. Aucune demande |

## 12. Points d'attention / limitations

- **`notSourceKey: true` désactive le gate de modération** (`applyValidationGate`) sur les deux
  onglets — conforme à l'existant `/agenda`, assumé : un contenu « à valider » du périmètre est
  visible.
- **Onglet actif non synchronisé dans l'URL** (section `tabs` sans `?tab=`) : un deep-link
  `?preview-events=<id>` n'ouvre son drawer que si l'utilisateur active l'onglet Événements
  (l'onglet par défaut est Actus). Accepté ; évolution possible (§14).
- **Extrait de carte article = début du corps** (`descriptionField:"description"`), pas le chapô.
- **Timeline** : ignorée en vue détaillée et en mode split (grille conservée) ; alternance par
  index ; item sans `startDate` → bulle de repli neutre.
- **Backend dev fragile** : `MongoConnectionException` intermittente — relancer mongo42
  (opération à la main de Peterson).
- **Préflights rouges préexistants** (hors lot) : cf. table des gates §9 — dont
  `public/images/saintpaulSport1` non déclaré dans `sites.json` (à déclarer, supprimer, ou
  ajouter à `KNOWN_UNCLAIMED` — décision Peterson).
- **⛔ `oneAnswerPerPers: true` sur le formulaire de créneaux `6a4e4e4105e5972f7b4b1823`** — appliqué
  **côté serveur** (`Coform::getFormAccessInfo` → `PHDB::find(answers, {form, user})`, puis
  `SaveAnswerAction`), et pas seulement par le garde-fou client que la modale contourne. Un même
  utilisateur ne peut donc créer qu'**une seule** réservation, jamais plus : la fonctionnalité est
  inopérante tant que le drapeau n'est pas à `false`. Les mises à jour d'une réponse existante
  restent autorisées.
- **Les 14 équipements porteurs de réservations sont hors du périmètre du site** : ils sont en
  `source.keys: ["equipementsSportifs974"]`, alors que `/equipements-sportifs` liste les POI
  estampillés `saintpaulSport1`. **Mesure du 09/09 (corrige le constat du 02/09)** : 16 équipements
  portent au moins une réservation, dont **3 sont dans le périmètre** — `Gymnase de vue belle`
  (3 réservations réelles : BADMINTON DE LA SALINE, JS SALINE, SALINE VOLLEY BALL), `Boulodrome`
  (1) et `Plateau Vert Synthétique` (les 2 réservations de recette). Les **13 autres restent hors
  périmètre** : la section Réservations est donc alimentée sur 2 fiches visibles seulement, et vide
  sur les 205 autres. À traiter par la migration de propriété (§ Onglet admin « Migration ») ou par
  un élargissement du périmètre de la page (§13).
- ~~**Une réservation ne porte aucun identifiant d'organisation**~~ — **RÉSOLU le 09/09.** Le
  formulaire porte désormais un champ `finder` sur les organisations, filtré sur le tag
  `usagerEquipementSportif`, qui enregistre `{<id>: {id, name, type}}` et pose
  `links.organizations` sur la réponse. Le champ texte « Usager » est **masqué** (`hide: true`),
  ses valeurs conservées. Les 63 réponses historiques ont été rattachées (55 au nom exact, 8 après
  pliage casse/accents), sans un seul cas ambigu. Le suffixe du nouveau champ est
  `n0a7usagerorga1k9z`, déclaré sous `reservations.fields.userOrga` dans les **3** configs qui
  consomment ce formulaire.
- **Le site ignorait `hide`** : découvert à cette occasion, `formParser` affichait les champs que
  le back-office masque. Corrigé (garde + test). Aucun effet sur le parc : aucun des formulaires
  consommés par site-json ne portait de champ masqué.
- **Le sélecteur d'association plafonne à 30 propositions** (`FINDER_INDEX_STEP`, en dur, sans
  pagination) pour 48 associations taguées : une saisie très large peut en masquer une partie,
  sans message. Limitation **assumée** (décision du 09/09) — taper le nom du club suffit.
- **48 usagers distincts dans les créneaux, 41 organisations générées.** Manquent : `KARATE CLUB
  LEO`, `EN FORME` et `MONTAGNE REUNION` (existent en base sous `cressReunion` /
  `sportSanteBienetre`, **sans** le tag) ; `JKA Réunion`, `EN MOUV EN`, `BDN SAINT-PAUL SPORTS` et
  `BASKET CLUB  SAINT-PAULOIS` (aucune organisation). Dette assumée pour ce lot.
- **La grille de réservation est une grille de RÉFÉRENCE** (8 h–22 h par défaut) : aucun horaire
  d'ouverture n'existe sur les équipements en base (0 POI avec `openingHours`). Une case libre
  signifie « aucune réservation connue », pas « l'équipement est ouvert ». L'amplitude est élargie
  automatiquement pour ne jamais masquer une réservation hors cadre.
- **Le correctif `select-objet.tsx` a un effet de bord clavier**, vérifié au navigateur le 07/09.
  En passant `shouldFilter` à `false` dès qu'un `onSearch` est fourni, on rend bien visibles les
  résultats serveur (c'était le blocage), mais on désactive aussi le **tri par score** et le
  **masquage des options à score nul** de `cmdk`. Conséquences mesurées : sur « Organisateur »,
  des résultats sans rapport restent listés (`Lingaya's vidyapeeth` pour « BAD ») et **aucune
  option n'est présélectionnée** — la touche Entrée ne valide rien, la sélection est à la souris ;
  sur « Entité parente » (`includeMe`), la ligne présélectionnée reste **le compte de
  l'utilisateur** au lieu du meilleur résultat. Le composant est partagé : 3 des 9 appelants sont
  concernés (`EditLocationTab` ville et rue, `SelectParent`). Arbitrage à rendre (§13).
- **Le champ « Organisateur » n'affiche pas l'astérisque de champ requis** alors qu'il est
  `required: true`. La validation, elle, **s'applique** (`buildZodSchema` → « Ce champ est
  requis », 0 appel `element/save` déclenché à la soumission vide, vérifié le 07/09). Le manque est
  strictement visuel : le widget `finder` de `registerWidgets.tsx:150` est le seul à ne pas relayer
  `required` à son `FormLabel`. `organizer` est le **seul champ `finder` requis du dépôt** — le cas
  n'avait jamais été exercé.
- **Le drawer de détail est bridé à 384 px**, ce qui tronque le contenu sur `/annuaire`
  (764 px de contenu hors champ, sans barre de défilement). Conflit de classes préexistant, hors
  lot : `CustomDrawer.tsx` demande `lg:w-1/3` mais `drawer.tsx` impose
  `data-[vaul-drawer-direction=right]:sm:max-w-sm`, qui l'emporte. Défaut de mise en page, sans
  effet fonctionnel.
- **Les créneaux créés depuis le site ne portent pas `duree`**, contrairement à 123 des 126
  créneaux historiques. C'est **conforme** : `duree` et `prix` sont des champs d'import legacy que
  la couche coform préserve en relecture mais n'écrit pas (cf. `formParser.ts:1118`).

## 13. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| **Voie de création des POI articles** (backoffice co ? import ? onglet admin + costumForm dans le site — impliquerait une demande Aboire, cf. §11) | Peterson (+ Aboire le cas échéant) |
| Statut de la spec `spec-cocolight-api-saintpaul-news.md` (clore/archiver « obsolète pour /actualites » ?) | Peterson |
| Synchro URL de l'onglet actif (`?tab=`) pour des deep-links complets | à prioriser |
| Harmoniser la carte de `/agenda` (`card.type:"profile"` → `"event"`, voire timeline) | hors scope noté, décision Peterson |
| Dossier `public/images/saintpaulSport1` non déclaré (préflight `site-assets`) | Peterson |
| **`oneAnswerPerPers` → `false`** sur le formulaire de créneaux (bloquant pour la réservation, cf. §12) | Peterson (back-office CoForm) |
| Rendre les champs du formulaire de créneaux **obligatoires** (équipement, créneau, dates, usager, activité) — aucun ne l'est aujourd'hui | Peterson (back-office CoForm) |
| Rattacher les 14 équipements réservés au périmètre `saintpaulSport1` (migration de propriété) ou élargir le périmètre de `/equipements-sportifs` | Peterson |
| Champ `finder` vers `organizations` sur le formulaire de créneaux, pour lier une réservation à une organisation | Peterson (back-office CoForm) |
| Écrire l'**activité** dans `tags` des organisations générées, pour rendre le filtre possible dans l'annuaire sans développement | Peterson (script) |
| Compléter les **7 usagers sans organisation taguée** (cf. §12) | Peterson (script) |
| Rattacher des comptes aux 41 organisations (aucune n'a de `links.members`) — condition pour que les clubs agissent eux-mêmes | Peterson (+ Aboire) |
| Conserver ou retirer le correctif `select-objet.tsx` (hors périmètre initial du lot, cf. §9) | Peterson |

## Onglet admin « Migration » (2026-08-15)

L'onglet `migration` (section costum `{type:"ownershipMigration"}`) porte la **reprise du stock** :
transférer la propriété des fiches `equipementsSportifs974` de la commune (sélecteur
`address.codeInsee = 97415`, sous-type auto = `type` des fiches) vers `saintpaulSport1`, le
régional restant référencé — le geste que le script CLI `tools/commune-ownership-migration/`
(désormais secours offline) faisait en Mongo direct. Dry-run, contrôles bloquants, snapshot +
rollback serveur, historique. Doc : [ownership-migration.md](ownership-migration.md) ; spec
serveur : `cocolight-backend/docs/28-OWNERSHIP-MIGRATION.md`. ⚠ Ordre : **migration avant
déploiement de la config communale** (aucune coupure) ; BUG-L-236 (l'update d'import écrasait
`reference` des deux côtés) est CORRIGÉ en miroir L+B le 2026-08-17 — déployer le fix legacy
avant tout rafraîchissement RES d'un dataset migré.

## Observatoire en split view (2026-09-10)

Refonte de l’AFFICHAGE de `/observatoire` sur la proposition de Tibor (message du 09/09) :
KPI en bandeau sous les filtres, puis liste des équipements à gauche et graphes à droite.
Aucune fonctionnalité retirée du
site — le moteur gagne trois options opt-in, dont le défaut reproduit l’existant à l’identique
(les 3 autres consommateurs de `data-observatory` — Institut Bleu, Relief, Tiers-Lieux — sont
inchangés).

**Ce que la page fait maintenant.** La colonne de gauche liste les équipements (nom, puis
installation et commune en sous-titre), par tranches de 50. Un clic sur le libellé filtre les
KPI, les graphes et la liste ; un bouton « Fiche » ouvre le détail habituel — même
`SwitchDetailsMode`, mêmes réservations, même tableau de bord d’installation. Le tableau
quitte cette page ; il reste ENTIER sur `/data` (tri par colonne, pagination, export CSV),
d’où le « zéro perte » à l’échelle du site. L’export CSV est aussi repris en tête de liste.

**Sélection ≠ recherche texte.** Arbitrage Peterson du 10/09 : le champ de recherche garde son
comportement historique (`?q=`, `contains` sur la saisie entière). Le clic est un filtre
DISTINCT (`?selection=`) qui découpe le libellé en mots et exige chaque mot dans la réunion du
nom de l’équipement ET du nom de son installation — « pour qu’on ne rate rien ». Les deux
filtres se cumulent et s’effacent séparément ; `resetAll` les efface tous.

**Config** (page `/observatoire` seulement) : `layout: "split"` + `list`
(`titleDimension: "equipName"`, `subtitleDimensions: ["name","commune"]`,
`selectDimensions: ["equipName","name"]`, `splitRatio: "40-60"`, `pageSize: 50`), et le bloc
`rowAction` REMONTE de `table` au niveau de la section — il alimente la liste et le deep-link
`?installation=`. Le bloc `table` est supprimé de cette page.

**Mesuré, pas supposé.** Sur `saintpaulSport1` (207 équipements, serveur de dev réel) : un clic
sur « base Nautique » ramène 2 équipements dans deux installations distinctes, là où la
recherche texte de la même chaîne n’en ramène qu’1 — le clic élargit, il ne restreint jamais.
`config:validate`, `audit:config` (RAS) et `config:render` au vert sur les 3 sites ; 704 tests
passent, les 3 échecs restants (`bundle-size`, `environment`, `site-assets`) étant
préexistants et sans lien.

**Non vérifié à ce stade** : le rendu MOBILE (repli de la liste sous le tableau de bord) —
aucun navigateur Playwright installé sur le poste, la vérification s’est faite sur le HTML
servi par le serveur de dev, qui rend la variante desktop.

**Ajustements du 2026-09-10 (retour sur capture).** `maxWidth: "full"` sur la page : le défaut
`8xl` (1440 px) bridait le contenu et laissait de larges marges sur un écran plus grand — en
`full`, la section occupe la largeur moins le seul padding (`lg:px-8`), soit ~96 %. Et le scroll
a été inversé : le tableau de bord se déroule entier, c'est la liste qui s'adapte à sa hauteur
et défile seule.

Détail du mécanisme : [doc/27-module-observatoire.md](../doc/27-module-observatoire.md),
section « Split view ».

## Liens croisés équipement ↔ organisation (2026-09-23)

Les deux bouts du formulaire de créneaux se répondent enfin. Dans la fiche d'un **équipement**,
chaque club de la section réservations porte un bouton « Fiche » qui ouvre sa fiche sur
`/annuaire`. Dans la fiche d'une **organisation**, une section « Équipements réservés » liste
les équipements du club, leurs créneaux et leur période, chacun avec un bouton qui ouvre la
fiche de l'équipement sur `/equipements-sportifs`.

**Le lien passe par l'identifiant, jamais par le nom.** Sondage du 2026-09-22 sur
`communecter74-dev` avant la reprise : 0 réponse sur 62 portait l'identifiant du club, 7 noms
d'usagers sur 48 correspondaient exactement à une organisation de l'annuaire (pliage casse,
accents et ponctuation), et les « quasi-correspondances » étaient fausses — `TWIRL CLUB OUEST
974` ≈ `Fight Club de l'Ouest (FCO 974)`. La recherche texte du backend ne rattrape pas l'écart
non plus : `BASKET CLUB  SAINT-PAULOIS` (double espace, trait d'union) renvoie 0 résultat, là où
`BASKET CLUB SAINT PAULOIS` en renvoie 1. D'où la règle : **pas d'identifiant, pas de bouton**.

**Après la reprise** (`/co2/migration/creneauxlienorga?apply=1&step=reprise`, jouée par Peterson
le 2026-09-22) : 61 réponses sur 62 rattachées, 47 organisations distinctes, toutes dans le
périmètre de l'annuaire (233 fiches taguées). Reste « MONTAGNE REUNION » (mur d'escalade), dont
la fiche existe et a dû être taguée après le passage — un second passage la rattachera.

**Le socle : ouvrir une fiche par son identifiant.** `?preview=<id>` n'était résolu que DANS la
page de résultats chargée — 10 items par défaut, 24 sur l'annuaire. Un lien venu d'une autre
page n'ouvrait donc presque jamais rien, en silence. `list.previewFetch` (`"poi"` sur
`/equipements-sportifs`, `"organizations"` sur `/annuaire`) charge la fiche complète par son id
quand la liste ne la porte pas. Effet de bord bienvenu : les liens « Partager » d'une fiche
profonde dans la pagination deviennent fiables.

**Config ajoutée** : `orgaLink: {path: "/annuaire"}` sur les TROIS blocs `reservations` du site
(page équipements, `/observatoire`, `/data`) ; sur `/annuaire`, le bloc `reservations` (même
formulaire, `maxAnswers: 500`) + `bookedResources: {link: {path: "/equipements-sportifs"}}` ;
`previewFetch` sur les deux pages. Rien sur les sites Équipements Sportifs et Scolaires : ils
n'ont pas de page annuaire.

**Vérifié** : `tsc`, `eslint`, 638 tests des modules search et observatoire — dont 3 nouveaux
cas sur l'ouverture par identifiant (chargé et ouvert quand absent de la liste ; pas de requête
quand présent ; rien sans `previewFetch`) et 3 sur le regroupement par équipement. Préflights au
vert après régénération de l'exemple `data-observatory` de la skill ; les 3 échecs restants
(`bundle-size`, `environment`, `site-assets`) sont préexistants. Requête inverse éprouvée sur
les données réelles : `BOUGER O` → 1 réservation (dojo salle de combat), `CENTRE ETUDE KARATE
SALINE` → 2 (dojo, salle de danse). **Non vérifié** : le rendu à l'écran (aucun navigateur
installé sur le poste) — pages servies en 200, config présente dans le HTML.

Détail du mécanisme : [doc/07-module-search.md](../doc/07-module-search.md), section « Liens
croisés équipement ↔ organisation usagère ».

---

## Observatoire embarqué dans la page Équipements (2026-09-23)

**Demande.** Pouvoir consulter l'observatoire **sans quitter la page Équipements** : une icône
de plus à côté des bascules annuaire / carte. En mode carte, la liste des équipements doit
apparaître à gauche, comme sur la page Observatoire ; en mode observatoire, les graphes
remplacent la carte et la liste reste en place. Deux chantiers, donc : rendre l'observatoire
appelable depuis une autre section, et poser la liste à gauche de la carte.

**Liste à gauche de la carte : rien à écrire.** Le split liste + carte existait déjà dans
`searchProStatic` (`map.layout: "split"`, `map.splitRatio`), éprouvé sur d'autres sites. Une
ligne de config a suffi. Clic sur une carte → `flyTo` + popup ; clic sur un marqueur →
highlight et scroll dans la liste.

**L'observatoire réutilisable.** `ObservatoryPanel` est le tableau de bord détaché de sa page :
il reçoit des résultats DÉJÀ CHARGÉS et une conf `{dimensions, kpis, charts}`, et rend les KPI
puis les graphes. Ni requête, ni filtres, ni table — c'est ce qui le rend appelable ailleurs.
`searchProStatic` l'expose sous `props.observatory` ; sa seule présence affiche le bouton.

**La décision qui compte : aucune donnée en propre.** Le panneau lit les résultats que la
section a déjà chargés — exactement ceux de la carte, même cache. Conséquences : la bascule
carte ↔ observatoire ne recharge rien, et surtout les chiffres suivent la recherche et les
filtres courants de la page. Une requête séparée aurait affiché deux totaux différents sur le
même écran, sans le moindre signal. Contrepartie assumée : tout champ lu par une dimension doit
figurer dans `baseParams.defaultFields` de la section — c'était déjà le cas pour les huit
dimensions reprises (type, nature, commune, APS, surface, PMR, PSHS, handi).

**Une contrainte d'architecture rencontrée en chemin.** `observatoire/schema.ts` importe le
module search (`PreviewConfSchema`) ; faire importer l'inverse aurait fermé un cycle, et Zod,
évalué au chargement du module, y aurait lu des `undefined`. Les primitives du dashboard
(dimensions, KPI, graphes) sont donc passées dans `observatoire/dashboardSchema.ts`, qui
n'importe que zod — `schema.ts` les ré-exporte, aucun import existant ne bouge.

**Config ajoutée** (page `/equipements-sportifs` uniquement) : `map.layout: "split"`, et un bloc
`observatory` reprenant les 7 KPI et 5 graphes de la page `/observatoire`, restreint aux 8
dimensions qu'ils consomment. La page `/observatoire` n'est pas touchée : elle garde ses
filtres, sa liste latérale et son export.

**Vérifié** : `tsc` (le typecheck du dépôt était rouge sur deux lignes du test ajouté au lot
précédent — corrigées), `eslint`, `config:validate`, `audit:config` (site sans constat), 74
tests du module observatoire dont 5 nouveaux (convention `serverData` partagée, schéma du
panneau), préflights archétypes / prop-descriptions / skill-integrity / i18n au vert. Plafond
de taille des dumps de la skill relevé de 60 à 70 Ko, raison écrite dans le test : le bloc
`page` passe de 59 à 61 Ko. **Non vérifié** : le rendu à l'écran (aucun navigateur installé sur
le poste).

**Ajustements du 2026-09-23 (retour sur capture).** Quatre points, tous sur la même vue.
Les bascules de vue sont désormais portées par les vues plein panneau elles-mêmes
(`panelViewSwitch`) : depuis la carte on atteint l'observatoire, depuis l'observatoire on
revient à la carte, et les deux offrent le retour à la liste. C'était nécessaire parce qu'avec
un `customHeader`, l'en-tête de la section n'est rendu que dans la vue liste — le piège ne se
voit pas en lisant la branche de rendu. Le scroll suit maintenant la page observatoire : les
graphes se déroulent entiers, sans scroll propre, et c'est la liste de gauche qui s'ajuste à
leur hauteur. Les KPI passent en bandeau au-dessus des deux colonnes, ce qui a demandé de
découper le panneau en deux blocs (`part`). Enfin la colonne de gauche est resserrée à 30 %
(`splitRatio: "30-70"`, valeur nouvelle) et ses cartes passent en mode dense — même
information, vignette et interlignes réduits. La densité suit la LARGEUR, pas le site : les
cinq autres configurations en split gardent le ratio 40-60 et leur carte pleine.

Détail du mécanisme : [doc/07-module-search.md](../doc/07-module-search.md), section « Vue
observatoire », et [doc/27-module-observatoire.md](../doc/27-module-observatoire.md), section
« Panneau réutilisable ».
