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

Dernière mise à jour : **2026-09-02** (lot « usagers des équipements » — annuaire, événements, réservation).

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
| 2026-09-07 | Peterson (+ Claude) | **Recette complète du lot** : `oneAnswerPerPers` repassé à `false` par Peterson, deux réservations créées et vérifiées de bout en bout, portes rejouées (rendu 12/12, sonde 6/6, `config:validate` ✅), recette en éventail sur 5 dimensions — 3 constats mineurs confirmés (§12) |

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
  `source.keys: ["equipementsSportifs974"]`, alors que `/equipements-sportifs` liste les 206 POI
  estampillés `saintpaulSport1`. Aucun des 206 n'a de réservation ⇒ aujourd'hui, sur ce site, la
  section Réservations est vide sur **toutes** les fiches visibles. À traiter par la migration de
  propriété (§ Onglet admin « Migration ») ou par un élargissement du périmètre de la page (§13).
- **Une réservation ne porte aucun identifiant d'organisation** : le champ « Usager » du formulaire
  est un texte libre. Le rapprochement avec l'annuaire se fait donc **par le nom**. Arbitrage du
  01/09 : hybride — l'historique reste rapproché par nom, un lien structuré suppose l'ajout d'un
  champ `finder` sur le formulaire (§13).
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
déploiement de la config communale** (aucune coupure) ; ré-imports RES via le backend Node
uniquement tant que BUG-L-236 (legacy) n'est pas déployé.
