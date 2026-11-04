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

Dernière mise à jour : **2026-10-28** (review de la MR 114, lot D : nettoyage — une seule notion de date, heures affichées en « h », sablier et garde d'erreur alignés, mentions « non committé » remplacées par les commits ; 27/10, lot C : l'annuaire des associations ne relit plus toutes les réservations à chaque page servie, et les contrôles de créneaux ne se recalculent plus à chaque rendu ; lot B : la fiche équipement des sites d'équipements devient une option, `equipmentDetails`, et sport-santé retrouve la sienne ; un club créé depuis le formulaire de réservation porterait l'étiquette ; semaine type et `periods` annoncés sur les deux sites en ligne ; lot A : la garde de « Modifier l'horaire » compare aussi la période, les contrôles lisent toutes les réservations d'un équipement, le bouton d'ajout de la fiche association est masqué hors connexion) ; 26/10 : filtre Commune de l'observatoire corrigé : les 5 communes à deux codes postaux se sélectionnent de nouveau, libellés sans virgule ; fusion de `main` dans `ess974`, conflits réglés des deux côtés, lots 8 à 11 revérifiés sur le code fusionné ; lot 11 — ajout d'associations par les admins depuis l'annuaire, avec la clé ESS974, et modification de celles qu'ils ont ajoutées, relu pour la conformité aux règles de Thomas ; ajustements du lot 8 — contrôle en direct des créneaux occupés, à l'ajout et à la modification d'horaire ; bouton d'ajout par association sur la fiche équipement ; fiche association avec les réservations à gauche ; indicateurs agrandis, survol lisible) ; lots 8 et 9 du 23/10 ; mise à jour des données depuis dataES préparée, à exécuter en production (§13).

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
| Config | [`../config.prod.equipements-Sportifs-Scolaire.json`](../config.prod.equipements-Sportifs-Scolaire.json) — 186 Ko, 9 pages, 14 sections (20/10) |
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
                 │   9 pages · 14 sections                    │
                 │   /equipements-sportifs  ← recherche       │
                 │   /annuaire  ← associations usagères       │
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

### 4.1 Les 9 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 5 | `hero-parallax` · `categories-grid` · `searchProStatic` · `hero-quick-access` · `gridLayout` — cf. §4.4 |
| `/equipements-sportifs` | 2 | `searchHeader` + `searchProStatic` — la recherche ; vue carte en liste + carte (icône et couleur par type), vue observatoire intégrée (§9 lot 4) |
| `/annuaire` | 2 | `searchHeader` + `searchProStatic` — les associations usagères des équipements scolaires (périmètre calculé, §9 lot 3) ; les admins y ajoutent une association et modifient celles qu'ils ont ajoutées (§9 lot 11) |
| `/observatoire` | 2 | `searchHeader` + `data-observatory` — le tableau de bord, avec les heures réservées (§9 lot 6) |
| `/data` | 2 | `searchHeader` + `data-observatory` — la table brute |
| `/rejoindre` | 1 | `registerForm` |
| `/mentions-legales` · `/confidentialite` · `/accessibilite` | 1 chacune | socle légal |

Structure **identique au site parent**. L'observatoire reprend ses 13 dimensions, 7 KPI,
5 graphes et sa table à 9 colonnes ; `/observatoire` y ajoute 2 KPI d'heures réservées (lot 6).

### 4.2 Les 9 filtres, dimensionnés sur la donnée réelle

> Mis à jour le 15/10/2026 (lot 2 — fiche équipement, filtres multi-valeurs et communes, cf. §9) ; filtre « Sport pratiqué » ajouté le 23/10 (lot 8).
> L'état d'origine (06/08) comptait 5 filtres.

| Filtre | Champ | Options | Comparaison |
|---|---|---|---|
| `poi-postalCode` | `address.postalCode` | **23 communes** (28 codes regroupés, 97434 compris depuis le 23/10) — liste reprise par l'observatoire (`valueMapFrom`), donc libellés sans virgule (« Saint-Paul (97411 / 97434) », 26/10) | exacte, `values` par commune |
| `type` — « Type d'équipement » | `equip_type_name` | **34** | exacte |
| `categorie` — « Catégorie » | `categorie` | **2** (structurant, proximité) | exacte |
| `sport` — « Sport pratiqué » (23/10, lot 8) | `aps_name` | **50** sports présents | **jeton** |
| `particularite` — « Type de particularité » | `inst_part_type` | **5** (valeurs présentes) | **jeton** |
| `poi-amenities` | 5 booléens | **5** | inchangé |
| `propertyType` | `equip_prop_type` | **6** | exacte |
| `utilisateur` — « Type d'utilisateur » | `equip_utilisateur` | **9** (repris du parent) | **jeton** |
| `availableSpaces` | `equip_loc_type` | **10**, 1 valeur corrigée | **jeton** |

Le filtre `utilisateur` avait été **retiré** le 06/08 (non discriminant — ~92 % des POI portent
« Scolaires » — et une valeur à virgule jugée incompatible avec l'URL). **Rétabli le 15/10 à la
demande de Peterson** : les options utilisent des identifiants sans virgule (`scolaires-universites`),
et la comparaison par jeton rend les autres options utiles (Clubs sportifs 163, Individuel(s) 190).

`availableSpaces` : la valeur `"Salle(s) de réunion / cours"` du parent ne matche **aucun**
document (la donnée écrit `"Salle(s) de réunion/cours"`, sans espaces). Corrigée ici le 06/08 ; le
parent et Saint-Paul sont corrigés le 15/10 en interrogeant les deux graphies (`values`), celle du
formulaire de saisie comprise — sans objet ici tant que la saisie reste bloquée (§12).

À ces 9 dropdowns s'ajoute, depuis le 20/10, le filtre **« Créneau disponible »** (`slotFilter`,
param `?creneau=`) : une plage horaire, des jours de la semaine et une période facultative, il retire
les équipements réservés sur ce créneau hebdomadaire — §9, lot 5.

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
| **Carte sans contours de bassins de vie** (lot 4, décision de Peterson du 16/10) | Les seuls contours en base (`zoniris`, spec `bassins_vie_saintpaul`) sont les 7 bassins de vie de Saint-Paul ; le site couvre toute l'île — ils ne dessineraient que Saint-Paul. |

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

### Review de la MR 114, lot D — nettoyage (2026-10-28)

**Contexte** : les 5 points « Nettoyage » de la note de Thomas, sans changer de résultat sur les données
actuelles. Déjà réglés en route : la phrase du skill (lot B), le doublon `DEFAULT_MAX_ANSWERS` (lot A), les tests
de `useBookingChecks` et `useUpdateSlotHours` (lot C).

**Ce qui change** :
- **Une seule borne ISO** : `isIsoDay` (jour calendaire réel) passe dans `reservations.ts`, et `isoBound` s'en sert
  pour les chevauchements comme pour les heures (`reservationHours`). Une date impossible (un 30 février) est une
  borne ouverte partout : chevauchement présumé, comme une date absente. Aucune date invalide sur 384 en base locale.
- **Doublons** : `JOUR_MS` et `JOURNEE_MINUTES` exportés de `reservations.ts` ; `localIsoDay` passe par `format`
  de date-fns, même date locale.
- **Affichage** : la fiche équipement masque ses 2 indicateurs d'heures après un rafraîchissement en échec, comme
  la fiche organisation ; les KPI en ligne de l'observatoire (`KpiCards`, `inline`) montrent un sablier pendant le
  calcul.
- **Formulaire** : la lecture seule de `SmartCoForm` respecte `hideStepHeaders` ; aucun appelant ne combine les deux
  aujourd'hui.
- **Docs et config** : exemple de la doc 07 sans virgule ; les 21 mentions « non committé » ou « peter-dev » des trois
  docs projet remplacées par leurs commits, vérifiés dans `git log` ; 3 descriptions de props et la JSDoc de
  `slotFilter.label` ; `"unit": "h"` sur les 2 KPI d'heures d'ESS974.

**Validation** (base locale, serveur de dev sur 5174, visiteur) : `/observatoire` affiche « 135 h » et « 7 044 h ».

**Gates** :
- tests : 9 fichiers, 221 tests ✅, dont 10 cas nouveaux — date impossible, sablier (`KpiCards`), lecture seule
  (`SmartCoForm.test.tsx`, d'aboire, Schumann Juda et cael), `slotCheck` et `hideStepHeaders`
  (`CoFormModal.test.tsx`, d'aboire et cael), `useSlotFilter` et `usePeriodFilter` (nouveaux) ;
- lint ✅ (0 erreur, 23 avertissements préexistants) · typecheck ✅ ;
- `config:validate` ✅ ESS974 9/14 · `audit:config` RAS ;
- préflight en lecture seule : 898/903, avec les seuls 4 échecs d'environnement (§12) ; références inchangées.

### Review de la MR 114, lot C — performances (2026-10-27)

**Contexte** : points 3 et 9 de la note de Thomas. Choix de Peterson : le mémo serveur est ajouté, mais une
association ajoutée doit s'afficher au rafraîchissement et au retour sur la page.

**Ce qui change** :
- **Mémo serveur de l'annuaire** (point 3). Le périmètre est découpé : `fetchReservationPerimeter` (toutes les
  réservations, puis leurs équipements du site) et les organisations rattachées au costum. Au rendu serveur, seule
  la première passe par le mémo des facettes (`facetCache`, 5 min par défaut), sous la clé de la liste sans
  `includeCostumOrganizations`.
  - Les organisations du costum sont relues à chaque rendu : une association ajoutée apparaît au rechargement. Au
    retour sur la page, le cache du navigateur la contient déjà (insertion immédiate, puis relecture).
  - Limite : un club hors costum n'entre au rendu serveur qu'au renouvellement du mémo qui suit son premier
    créneau, 5 min au plus. Le navigateur ne passe pas par ce mémo.
- **Contrôles et mémos stables** (point 9). `useBookingChecks`, `useUpdateSlotHours` et `useResolvedDimensions`
  dépendent de la langue (`useTranslation().i18n.language`) au lieu de `t`, que `useT` recrée à chaque rendu
  (idiome de `useAacDetailSections`). Les avertissements en direct ne repartent plus à chaque rendu du parent,
  seulement à la saisie ou au changement de langue. Le refus d'enregistrer garde son contrôle sur des réservations
  relues. `useT` n'est pas touché.
- Doc 07 (annuaire, mémo des facettes, contrôles), en-têtes de `facetCache.ts` et du préchargement.

**Validation** (base locale, serveur de dev sur 5174) :
- **annuaire `/annuaire`, visiteur** : sans le mémo (`SSR_FACET_CACHE_TTL_MS=0`, le comportement d'avant), chaque
  rendu prend 11,4 à 11,7 s, dont 11 s de chargement des données. Avec le mémo, 0,85 à 0,98 s une fois l'entrée
  remplie. Les 23 organisations et 7 équipements servis sont identiques dans les deux cas ;
- **« Modifier l'horaire », admin, sans enregistrer** : l'avertissement suit la saisie. Une fin à 6 h affiche
  « L'heure de fin doit suivre l'heure de début. » ; une fin corrigée l'efface et le contrôle relancé signale un
  chevauchement déjà présent en base (samedi 14 h, Salle de danse, AD2S et TWIRL CLUB OUEST 974) ;
- le formulaire d'ajout s'ouvre depuis une case libre, avec ses champs.

**Gates** :
- tests : 5 fichiers, 25 tests ✅, dont 15 cas nouveaux (`useBookingChecks`, `useUpdateSlotHours` et
  `useResolvedDimensions` testés pour la première fois). Contre-épreuve : sans le mémo, ou avec `t` remis en
  dépendance, les tests du mémo et de l'identité échouent ;
- lint ✅ (0 erreur, 23 avertissements préexistants) · typecheck ✅ ;
- préflight en lecture seule : 898/903, avec les seuls 4 échecs d'environnement (§12).

### Review de la MR 114, lot B — sites en ligne (2026-10-27)

**Contexte** : points 4, 6, 7 et 8 de la note de Thomas, selon les choix de Peterson.
- La fiche de sport-santé-bien-être ne doit pas bouger.
- La semaine type du tableau de bord et le réglage `periods` de Saint-Paul sont à annoncer.
- Un club créé depuis le formulaire doit porter l'étiquette.

**Ce qui change** :
- **Fiche équipement en option, `preview.equipmentDetails`** (point 4). Sans l'option, `PreviewPoiAmenities` rend
  la fiche de main : « Catégorie » sur `equip_type_name`, sport en texte, rangée « Partenariat », ni SIRET ni UAI.
  - L'option est posée sur les 4 aperçus poi-amenities des 3 sites d'équipements (liste, observatoire, table Data,
    palette) et sur la fenêtre des doublons (slot écrit en dur). Ces sites gardent leur fiche du lot 2.
  - Sport-santé, qui ne la pose pas, retrouve exactement main, avec la traduction « Partenariat » rétablie.
  - La colonne de droite de la fiche organisation reprend aussi la classe de main hors `placement: "column"`.
  - Doc 05, doc 07 (dont sa table des champs, encore fausse sur `partenariat`), `prop-descriptions` et skill sont
    à jour.
- **Club créé depuis le formulaire de réservation** (point 8) : `coform.finderAddNew` déclare le formulaire
  `ess974-association` pour la seule question « club usager »
  (`finderequipementsSportifs974872026_1619_0n0a7usagerorga1k9z`). Le club créé porterait l'étiquette et le
  rattachement à ESS974. Les autres finders d'organisations gardent le formulaire standard.
  - Aucun effet visible aujourd'hui : le bouton « Ajouter » de cette question est désactivé en base (`addNew:
    false`, §13).
- **Annonces** (points 6 et 7) dans les docs d'[Équipements sportifs](equipements-sportifs.md) et de
  [Saint-Paul](saint-paul-sport.md) : la semaine type du tableau de bord d'installation, et l'effet de `periods`
  sur Saint-Paul (réglage non demandé, posé par cohérence).
- **Skill** : la phrase du patron « ajouter une association » dit que `profileAdd: false` garde le formulaire
  standard dans l'« Ajouter » des profils, et que c'est `addButton.adminOnly` qui réserve l'ajout aux admins. Cela
  règle par avance un point de nettoyage de Thomas.

**Validation** (base locale, serveur de dev sur 5174, visiteur, aucune écriture) :
- **ESS974** : la fiche « Salle de danse » ouverte depuis la liste, puis depuis la table Data, montre « Type
  d'équipement », « Catégorie », « Type de particularité », SIRET et UAI, sans « Partenariat » ;
- **sport-santé-bien-être** (même serveur, relancé le temps du contrôle sur sa config) : la fiche « Boulodrome »
  montre « Catégorie : Terrain de pétanque », le sport en texte et « Partenariat : Complexe sportif, Etablissement
  scolaire », sans type, particularité, SIRET ni UAI. C'est la fiche de main ;
- **résolution de la déclaration** : la question « club usager » ouvre `add-ess974-association`, tout autre finder
  d'organisations `add-organization`.

**Gates** :
- tests : `PreviewPoiAmenities.test.tsx` (nouveau, 5 cas, avec et sans l'option) et `PreviewStructure.test.tsx`
  (Nicolas, lancé avec l'accord de Peterson) ✅ ;
- lint ✅ (0 erreur, 23 avertissements préexistants, aucun dans les fichiers du lot) · typecheck ✅ ;
- `config:validate` ✅ ESS974 9/14, Équipements sportifs 8/14, Saint-Paul 12/21 · `audit:config` RAS sur les 3 ;
  config de sport-santé inchangée ;
- références du préflight vérifiées écart par écart :
  - `__effective__` d'ESS974 : une seule ligne, la question « club usager », resynchronisée ;
  - les photos d'Équipements sportifs et de Saint-Paul ne bougent pas ;
  - l'exemple `data-observatory` du skill, extrait de Saint-Paul : seul écart `equipmentDetails`, resynchronisé
    avec l'accord de Peterson ;
- préflight en lecture seule : 898/903, avec les seuls 4 échecs d'environnement (§12).

### Review de la MR 114, lot A — sûreté des créneaux (2026-10-27)

**Contexte** : la note de Thomas sur la MR 114 (`ess974` → `main`, relue au commit `5f66f905`) n'a rien de
bloquant. Peterson a demandé de corriger tous ses points, en 4 lots validés un par un (plan
`plan-ess974-mr114-corrections-review-thomas.md`). Ce lot traite les points 1, 2 et 5.

**Ce qui change** :
- **« Modifier l'horaire »** : avant d'écrire, la garde vérifie aussi la PÉRIODE du créneau relu (`isSameSlot`).
  Deux cycles jumeaux (même jour, mêmes heures, périodes différentes) ne se confondent plus si le tableau des
  créneaux change entre l'ouverture de la fenêtre et l'enregistrement.
- **Fiche équipement et contrôles d'enregistrement** : ils lisent toutes les réservations d'un équipement, jusqu'à
  5 000, au lieu de 200 au plus. Ils ne tiennent plus compte de `maxAnswers`, qui ne borne plus que la fiche
  association. Au-delà de 200 réponses, un doublon pouvait s'enregistrer sans avertissement.
- **Fiche association** : le bouton « Ajouter un créneau » n'apparaît jamais à un visiteur déconnecté, même avec
  `adminOnly: false`. Aucune config ne pose ce réglage aujourd'hui.

**À savoir** : rien ne change à l'écran avec les données actuelles. En base locale, un équipement d'ESS974 a au
plus 18 réservations.

**Validation** (base locale `prod201026`, serveur de dev sur 5174, Chrome sans fenêtre, aucune écriture en base) :
- **préalable** : le compte de test a été refait admin d'ESS974. Réappliquer le dump retire ce lien, et le rôle de
  super-admin ne suffit pas, car l'ajout de créneaux lit le lien d'admin de l'entité ;
- **fiche « Salle de danse », en admin** :
  - 69 cases libres cliquables ;
  - dans le détail d'AD2S, le bouton « Ajouter un créneau » et 3 crayons ;
  - « Modifier l'horaire » affiche l'avertissement en direct (fin avant début), et la fenêtre se ferme sans
    enregistrer ;
- **fiche de l'association KAFLOW 974** : 1 bouton « Ajouter un créneau » en admin, 0 en visiteur déconnecté.

**Gates** :
- tests : 6 fichiers, 139 tests ✅, dont 2 cas nouveaux (cycle jumeau refusé, lecture au-delà de 200 réponses) ;
- lint ✅ (0 erreur, 23 avertissements préexistants) · typecheck ✅ ;
- préflight en lecture seule : 897/902, avec les seuls 4 échecs d'environnement (§12).

### Correction — filtre Commune de l'observatoire (2026-10-26)

**Constat**, pendant les captures du guide utilisateur : dans l'observatoire, les 5 communes à deux codes postaux ne
se sélectionnaient pas. Ce sont Le Tampon, Saint-Benoît, Saint-Denis, Saint-Louis et Saint-Paul. Le filtre restait sur
« Tous » et les chiffres ne bougeaient pas. C'est une régression du lot 9 : ses vérifications avaient compté les
options sans en sélectionner aucune.

**Cause** : depuis `valueMapFrom` (lot 9), le filtre de l'observatoire prend le libellé de l'option pour valeur. Or il
joint les valeurs choisies par des virgules (`MultiCheckboxField` de `search/components/filterFields.tsx`,
`observatoire/dashboard.ts`). « Saint-Paul (97411, 97434) » était donc coupé en deux morceaux qui ne correspondaient à
aucune option.

**Ce qui change**, en config seule, comme pour « Type d'utilisateur » le 15/10 :
- les 5 libellés de `poi-postalCode` s'écrivent sans virgule, par exemple « Saint-Paul (97411 / 97434) », en français
  et en anglais ;
- les identifiants (`saint-paul`…) et les codes interrogés ne changent pas : les liens existants
  (`?poi-postalCode=saint-paul`) restent valables ;
- la règle est écrite là où `valueMapFrom` est décrit : [doc/27](../doc/27-module-observatoire.md), skill
  `config-assistant` et `prop-descriptions`.

**À savoir** :
- seul ESS974 déclare `valueMapFrom` ;
- aucune autre valeur des filtres de l'observatoire ne contient de virgule. Les sports en contiennent (`aps_name`), mais
  la dimension `list` les découpe un par un.

**Validation** (base locale `prod201026`, Chrome sans fenêtre, visiteur anonyme, aucune écriture) :
- **observatoire** :
  - 0 option à virgule parmi les 23 communes (24 entrées avec « Tous ») ;
  - chaque commune se sélectionne et donne le compte de la base, avec 1 commune : Saint-Benoît 37, Saint-Denis 108,
    Saint-Louis 49, Saint-Paul 89, Le Tampon 85 ;
  - une fois décochée, on revient à 703 ;
  - Saint-Paul et Saint-Denis ensemble : 197 équipements, 2 communes, « 2 sélectionnés » ;
  - Saint-Paul seule : 135 h/sem et 7 044 h cumulées ;
- **page Équipements** : « Saint-Paul (97411 / 97434) » donne 89 équipements, URL `?poi-postalCode=saint-paul` ;
- **page Data** : même sélection, 89 équipements ;
- **non testé** : le clic sur une barre de graphique (sélection, drill-down), ici comme dans la vue observatoire de la
  page Équipements.

**Gates** :
- `config:validate` ✅ ESS974 (9 pages, 14 sections) · `audit:config` ESS974 RAS ;
- lint ✅ · typecheck ✅ (`prop-descriptions.ts`) ;
- préflight en lecture seule : 897/902, avec les seuls 4 échecs d'environnement (§12). Un premier passage avait relevé
  la description de `valueMapFrom` trop longue (294 caractères pour 220 au plus) ; elle est raccourcie.

### Fusion de `main` et vérification des lots 8 à 11 (2026-10-26)

**Ce qui change** : Peterson a fusionné `main` (91 commits) dans `ess974` (merge `7dac007a`), puis réappliqué le
travail des lots 8 à 11, alors non committé (committé depuis : `d66c426e`, `e0afde8d`, `4de0553f`, `56d4edd5`, fichiers communs `ef67807c`). Les conflits sont réglés en gardant les deux côtés :
- **merge** (5 fichiers) :
  - `SmartCoForm` garde `beforeSubmit` et `slotPeriods` (lot 7) avec `submitButtonText` et `hideBanner` (`main`).
    Son enveloppe `withFormContext` pose les catalogues, puis les discussions des questions (`main`), puis la
    période des créneaux ;
  - les tests de `SmartCoForm` et de `CoFormReadOnly` gardent les cas des deux côtés ;
  - la doc 21 garde les deux contextes et les deux paragraphes ;
  - `config.prod.equipements-Sportifs.json` garde la mise en forme de `main` avec `inst_siret` et `inst_uai`
    (lot 2) ;
- **travail réappliqué** (3 fichiers) :
  - `SmartCoForm` et `CoFormModal` portent aussi `slotCheck` et `hideStepHeaders` ;
  - l'enveloppe ajoute le contrôle en direct des créneaux au plus près du formulaire ;
  - la doc 21 range `TimeSlotCheckContext.ts` et place le paragraphe `slotCheck` après `beforeSubmit`.

Contrôles faits pendant la résolution :
- toute ligne ajoutée par l'un ou l'autre côté depuis la base commune est dans le résultat ;
- pour la config, toutes les valeurs changées de chaque côté y sont aussi.

**Conformité** : `fetchResourceReservations` et `resourcesReservations` (lot 8 et ajustements) sont exportés
par `useReservationsQuery.ts` sans être testés dans son `useReservationsQuery.test.ts` (règle `X.ts` ↔
`X.test.ts`). Cinq cas y sont ajoutés :
- le chemin du finder ;
- le cache lu pour l'avertissement en direct ;
- la relecture avant l'enregistrement ;
- plusieurs équipements à la fois ;
- le repli sur le cache quand le réseau manque.

**Validation** sur le code fusionné (base locale `prod201026`, Chrome sans fenêtre) :
- **lot 8** :
  - fiche du Gymnase de vue belle : 29,5 h par semaine, 1 538 h cumulées, périodes affichées ;
  - un clic sur « Badminton » filtre la page (`?sport=badminton`) ;
  - filtre de période et crayon d'horaire sur les deux fiches ;
- **lot 9** :
  - le filtre créneau a quatre listes (heure puis minutes ; minutes 00, 15, 30 et 45, grisées sans heure) ;
  - observatoire : 703 équipements et 23 communes ; le filtre Commune a 24 options, dont « Saint-Paul (97411, 97434) » ;
  - les KPI d'heures affichent le sablier pendant le calcul, puis 383,9 h par semaine et 13 562,7 h cumulées ;
- **ajustements**, mêmes résultats que le 26/10 :
  - grille de 576 px et survol ;
  - avertissement en direct et refus d'enregistrer, à l'ajout comme dans la fenêtre d'horaire ;
  - réservations à gauche sur la fiche association, au-dessus sur téléphone ;
- **Saint-Paul** : même avertissement à l'ajout ;
- **lot 11** : mêmes résultats que dans son entrée ci-dessous. L'association de test a été retirée avec
  sauvegarde.

Les réservations de la base sont identiques, octet pour octet, à leur sauvegarde d'avant les essais.

**Gates** :
- typecheck ✅ ;
- lint ✅ : 0 erreur, et les 23 avertissements du dépôt sont tous hors de nos fichiers ;
- tests ✅ 466/466, sur 31 fichiers : les nôtres, et, avec l'accord de Peterson, ceux des composants coform et
  de `PreviewStructure` ;
- `config:validate` ✅ : équipements, scolaire et Saint-Paul ;
- préflight en lecture seule : 897/902, avec les seuls 4 échecs d'environnement (§12).

### Lot 11 — ajout et modification des associations (2026-10-26)

**Ce qui change** (commit `56d4edd5`, fichiers communs `ef67807c` ; demande de Peterson du 26/10, plan `plan-ess974-lot-11-associations-ajout-modification.md`) :
- **Bouton « Ajouter une association »** dans l'en-tête de l'annuaire, réservé aux admins du site. Ce sont les
  mêmes que pour les créneaux : admins du projet ESS974 et de la DRAJES. Le formulaire a trois onglets :
  - Association : nom, logo, présentations ;
  - Contact : e-mail, téléphone, site ;
  - Adresse.

  Le type « Association » est imposé.
- **Clé ESS974** : le serveur la pose à la création (`source` = `{insertOrign: "costum", key: "ESS974",
  keys: ["ESS974"]}`), sans code, parce que la création passe par le costum du site.
- **Étiquette usager** ajoutée d'office (`usagerEquipementSportif`) : l'association est aussitôt proposée par le
  finder « club usager » du formulaire de réservation, sans quoi elle ne pourrait recevoir aucun créneau.
- **Doublons** : pendant la saisie, les associations étiquetées usager au nom proche sont signalées. Il y en a
  280 en base, dont 185 de Saint-Paul, et 37 seulement dans l'annuaire. Un club existant se réserve, il ne se
  recrée pas.
- **Apparition immédiate** (décision de Peterson) : l'association ajoutée est listée tout de suite, même sans
  créneau.
- **Modification** (décision de Peterson) : l'admin qui ajoute une association en devient l'administrateur. Le
  bouton « Éditer » de sa fiche ouvre le même formulaire. Les 37 associations existantes n'ont ni administrateur
  ni clé ESS974 : elles restent non modifiables depuis le site, ce qui pourra faire l'objet d'un lot suivant.
- **Ajout réservé aux admins** (décision de Peterson) :
  - le menu « Créer » des profils garde le formulaire d'organisation standard ;
  - l'annuaire ne liste que les organisations étiquetées usager.

  Une organisation créée par un inscrit depuis son profil est elle aussi rattachée à ESS974 par le costum du
  site, mais elle n'apparaît pas dans l'annuaire.

**Côté moteur** (cf. [doc/05](../doc/05-schemas-sections.md), [doc/07](../doc/07-module-search.md), [doc/28](../doc/28-module-formengine.md)), inactif
sans configuration — aucun autre site ne change :
- **search** :
  - option `reservationUsers.includeCostumOrganizations` : le périmètre réunit les usagères et les organisations
    rattachées au costum (clé et périmètre testés dans `useReservationUsersQuery.test.ts`) ;
  - helper pur `withCostumOrganizations` (testé) ;
  - pagination `searchCostumIds`, partagée avec la recherche des équipements (testée dans
    `useResourcesInPerimeterQuery.test.ts`) ;
  - hook `useAddCostumOrganization`, branché sur `onCreated` de la modale d'ajout.
- **profil** : option `profileAdd` des formulaires de configuration (`siteCostumAddModal`), testée dans
  `addModals.test.ts` (nouveau).

**Conformité aux règles de Thomas**, signalée par le préflight et corrigée :
- `costumSlug: "ESS974"` est déclaré sur le formulaire (préflight `costum-form-slug`). La création passe alors
  par `me.costum("ESS974")`, résolu en direct, et la clé posée reste `ESS974` (vérifié en base) ;
- l'inventaire des stamps du parc (préflight `stamps`) reçoit la ligne du formulaire, avec sa justification ;
- la route de modification est bornée par la provenance (`sourceKeys` / `reference.costum`, préflight
  `edit-modal-scope`).

**Relecture de conformité** (26/10, à la demande de Peterson), corrigée :
- le nouveau contrat a ses tests, dans les fichiers de tests des hooks modifiés (règle `X.ts` ↔ `X.test.ts`) :
  la clé et le périmètre avec l'option, et `searchCostumIds`. Ces deux fichiers couvraient déjà le code modifié,
  mais n'avaient pas été lancés à la première validation ;
- la doc 05 et la description du schéma citent l'option : la doc 05 suit le schéma ;
- la doc moteur et le commentaire du hook ne citent plus le délai mesuré en local, qui reste ici (« À savoir »).

**À savoir** :
- **Délai de relecture.** En local, la relecture du périmètre prend environ 25 s : les 305 réservations sont
  relues en 3 pages de 7 à 8 s, faute d'index sur `answers` (seul `_id` en a un). L'insertion immédiate le
  rend invisible.
- **Identité du site.** La modification d'une association rattachée part en `element/save` avec
  `costumSlug: ESS974` et l'identité du projet. D'après le code PHP, un autre admin direct du projet est donc
  reconnu par le serveur. Ce n'est pas testé avec un compte non super-admin.
- **Édition ouverte.** Créée sans réglage explicite, l'association reçoit le défaut du SDK,
  `preferences.isOpenEdition: true` (schéma `common253`), comme une organisation créée par le formulaire
  standard, qui ne le règle pas non plus ; le formulaire CAE de Thomas le pose même explicitement. Côté serveur,
  `updateField` et `updatePathValue` acceptent alors la modification par tout utilisateur connecté
  (`Authorisation::canEditItemOrOpenEdition`). Le site ne montre « Éditer » qu'aux admins. Hors du lot, à
  trancher par Peterson.

**Validation** (base locale `prod201026`, Chrome sans fenêtre ; associations de test créées puis supprimées,
sauvegardes dans le scratchpad ; passage complet refait le 26/10 sur le code final, après la relecture de
conformité, avec les mêmes résultats) :
- **Visiteur anonyme** : pas de bouton ; l'annuaire reste à 37 avec le filtre d'étiquette.
- **Admin, ajout** :
  - le bouton est présent ;
  - « JS SALINE » est signalé en doublon pendant la saisie ;
  - la création affiche « Organisation créée avec succès » et l'on reste sur l'annuaire ;
  - le compteur passe de 37 à 38 en 2 s, sans recharger.
- **En base** : `source` `{insertOrign: "costum", key: "ESS974", keys: ["ESS974"]}`, type NGO, étiquette usager,
  compte de test administrateur.
- **Fiche, modification** :
  - « Éditer » ouvre « Modifier l'association » (onglets Association, Contact, Adresse) ;
  - l'enregistrement affiche « Profil mis à jour avec succès » et la fiche est à jour ;
  - la requête `element/save` porte `costumSlug: ESS974` et `costumType: projects` ;
  - en base, seule la présentation change : les champs vides envoyés avec elle (`geo`, `description`,
    `telephone`, `url`…) ne sont pas écrits.
- **Formulaire de réservation** : le finder « Rechercher un club usager » propose l'association. Rien n'est
  enregistré.
- **Profil du compte de test** : « Créer » → « Organisation » ouvre « Créer une organisation », le formulaire
  standard.
- **Nettoyage** :
  - organisations, slugs, activité, actualités et liens d'appartenance sont retirés ;
  - les compteurs sont revenus à l'état initial : 32 369 organisations, 305 réponses, aucun mail en file.

**Gates** (relancés après la relecture de conformité) :
- typecheck ✅ ;
- lint ✅ : 0 erreur, et les 23 avertissements du dépôt sont tous hors du lot ;
- tests ✅ 36/36 : `addModals`, `reservationUsers`, `prefetchReservationUsers`, `useReservationUsersQuery`,
  `useResourcesInPerimeterQuery` ;
- `config:validate` ✅ · `audit:config` RAS ;
- préflight en lecture seule : 893/898, avec les seuls 4 échecs d'environnement (§12). La référence
  `effective-config` d'ESS974 est resynchronisée après vérification de chaque écart.

### Ajustements du lot 8 — contrôle des créneaux en direct (2026-10-26)

**Ce qui change** (commit `4de0553f`, fichiers communs `ef67807c` ; demande de Peterson du 26/10, plan `plan-ess974-ajustements-creneaux-26-10.md`) :
- **Fiche association** : les réservations passent à gauche, dans la colonne large, et la localisation à
  droite. Sur téléphone, les réservations viennent en premier.
- **Fiche équipement** : chaque association rattachée à une fiche porte, dans son détail, un bouton
  « Ajouter un créneau ». L'équipement et l'association y sont pré-remplis et verrouillés, comme depuis la
  fiche de l'association.
- **Contrôle en direct à l'ajout** : dès que les dates de la réservation et l'horaire d'un créneau sont
  saisis, le formulaire indique sous ce créneau s'il est déjà occupé sur la période saisie, par quelle
  association et à quelles dates. Il signale aussi un chevauchement avec un autre créneau du formulaire.
  Le contrôle vaut pour les trois formulaires d'ajout : case libre de la grille, bouton par association,
  fiche association.
- **Contrôle en direct à la modification d'horaire** : même avertissement sous les heures, dès qu'elles
  diffèrent de l'horaire actuel.
- **Blocage** : « Envoyer » et « Enregistrer » restent cliquables, mais un créneau occupé est refusé,
  avertissement lu ou non. Ce contrôle relit les réservations au moment d'enregistrer.
- **Visuel** :
  - les indicateurs d'heures de la fiche équipement sont agrandis ;
  - au survol, les cartes de créneaux passent en gris clair au lieu du jaune de l'accent, sur lequel le
    texte gris ne se lisait plus.
- **Saint-Paul** reçoit les mêmes ajouts, sans changement de config (décision de Peterson du 26/10).
  Aucune autre plateforme n'est touchée.

**Côté moteur** (cf. [doc/07](../doc/07-module-search.md), [doc/21](../doc/21-module-coform.md)) :
- **coform** :
  - option `slotCheck` de `CoFormModal` / `SmartCoForm` ;
  - contexte `TimeSlotCheckContext` et hook `useTimeSlotNotices`, partagés par `DynamicCoForm` et `MultiStepCoForm` ;
  - propriété `TimeSlotsField.notices`.

  Sans `slotCheck`, rien ne change : SSBE, Le Tampon et les autres formulaires ne voient rien.
- **search** :
  - `slotIssues` (pur, testé) dans `lib/reservationBooking.ts` ;
  - hook `useBookingChecks`, qui porte l'avertissement et le contrôle d'enregistrement des trois formulaires d'ajout ;
  - `resourcesReservations` : les réservations en cache de la fiche pour l'avertissement, relues pour l'enregistrement ;
  - `useUpdateSlotHours` porte aussi la fenêtre de modification (`editing`, `submit`, `checkLive`) ; avec
    `SlotHoursDialog.onCheck` ;
  - mise en page `bookedResources.placement: "column"` inversée.
- **observatoire** : `KpiCard` gagne une taille `size="lg"`.

**Relecture de conformité aux règles d'aboire** (demandée par Peterson le 26/10, sur tout le travail non
committé des lots 8, 9 et de ces ajustements) :
- les deux fiches chargeaient le formulaire avec le `lazy` de React. Elles passent au `lazy` de
  `vite-preload` (règle §1), comme les cinq autres appelants de `CoFormModal` ;
- quatre doublons entre les deux fiches sont mis en commun (règle §11) :
  - l'état du filtre de période, dans un hook `usePeriodFilter` ;
  - l'envoi et l'avertissement de la fenêtre d'horaire, dans `useUpdateSlotHours` ;
  - le rafraîchissement après un ajout, dans `useBookingChecks.afterSave`. La fiche équipement ne relisait que
    son propre équipement : elle fait désormais relire aussi les fiches association et le filtre créneau ;
  - la relecture « fraîche » de la fiche équipement, qui passe par `resourcesReservations` ;
- trois commentaires devenus faux sont corrigés (règle §10) : deux sur les clés de cache, qui disaient
  « aucune invalidation », et un qui parlait de la colonne de droite.

L'exemple `data-observatory` de l'assistant est resynchronisé avec l'accord de Peterson. Seule la ligne
`editHours` change.

**À savoir** :
- l'avertissement se calcule sur les réservations en cache de la fiche (5 minutes) ; l'enregistrement les
  relit ;
- il n'y a toujours aucun contrôle côté serveur.

**Validation** (base locale `prod201026`, Chrome sans fenêtre, aucune écriture) :

Fiche du Gymnase de vue belle (JS SALINE y occupe le mercredi de 16 h 30 à 20 h 30, du 17/08/2026 au 13/08/2027) :
- le bouton « Ajouter un créneau pour BADMINTON DE LA SALINE » ouvre le formulaire, équipement et club verrouillés ;
- aucun avertissement tant que la date de fin manque ;
- mercredi 18 h – 19 h, du 02/11 au 18/12 : « Mercredi 18:00 – 19:00 est déjà réservé par JS SALINE (Du 17 août
  2026 au 13 août 2027). » s'affiche sous le créneau ;
- « Envoyer » est refusé et le formulaire reste ouvert ;
- à 10 h – 11 h, l'avertissement disparaît ;
- case libre du mercredi 10 h (début pré-rempli au 26/10), déplacée sur 18 h – 19 h : même avertissement ;
- crayon du lundi 17 h – 19 h de BADMINTON, fin passée à 20 h : « Lundi 17:00 – 20:00 est déjà réservé par
  JS SALINE (…) » en direct, puis « Enregistrer » refusé ; revenu à 19 h, plus rien ;
- grille des indicateurs : 576 px au lieu de 448 ;
- survol d'une carte : fond blanc → gris clair du thème.

Fiche BADMINTON DE LA SALINE :
- réservations à gauche, localisation à droite ;
- en 390 px, réservations au-dessus ;
- ajout sur le Gymnase de vue belle : même avertissement.

Saint-Paul : même scénario d'ajout, même avertissement.

Base inchangée : 304 réponses, aucune créée le 26/10, créneaux de BADMINTON intacts.

Gates :
- tests ✅ 299/299, sur 13 fichiers : réservations, observatoire, et, avec l'accord de Peterson, `TimeSlotsField`,
  `DynamicCoForm`, `MultiStepCoForm`, `SmartCoForm`, `CoFormModal` et `PreviewStructure` ;
- typecheck ✅ · lint ✅ (0 erreur ; les 23 avertissements du dépôt sont tous hors de nos fichiers) ;
- préflight en lecture seule : 888/894 avant la relecture de conformité, puis 889/894 une fois l'exemple de
  l'assistant resynchronisé. Ne restent que les 4 échecs d'environnement (§12) ;
- après la relecture de conformité, nouveau passage au navigateur sur les deux fiches. Le filtre de période
  donne « Aucun créneau sur cette période. » au 01/01/2028, signale une fin avant le début, puis l'effacement
  remet les créneaux. Le crayon et l'ajout donnent les mêmes avertissements et refus qu'avant. La base reste
  inchangée.

### Lot 9 — filtres et observatoire (2026-10-23)

**Ce qui change** (commit `e0afde8d`, fichiers communs `ef67807c` ; plan `plan-ess974-lots-8-9-fiches-creneaux-filtres.md`) :
- **Filtre « Créneau disponible »** : chaque borne horaire se choisit en deux listes, l'heure puis la
  minute (00, 15, 30, 45 seulement). Une minute d'un lien plus ancien reste proposée telle quelle.
- **Observatoire : les 23 communes de la page Équipements.** Plutôt qu'une seconde liste écrite en dur,
  la dimension « Commune » lit désormais les options du filtre des communes de la page Équipements
  (`valueMapFrom`, option générique du moteur). Filtre, KPI « Communes » (28 lieux-dits → 23 communes),
  graphique « Équipements par commune » et recherche affichent les mêmes libellés que la page
  Équipements. C'est aussi le cas pour la vue observatoire de la page Équipements et pour la page Data.
- **Code postal 97434** ajouté à l'option Saint-Paul, désormais « Saint-Paul (97411, 97434) ». C'est le
  code d'un équipement importé de dataES : « Plateau polyvalent 2 », collège Les Aigrettes, La Saline-les-Bains.
  Jusqu'ici, aucune commune ne permettait de le trouver. Il est aussi ajouté à l'EPCI TCO de l'observatoire.
- **KPI d'heures de l'observatoire** : un sablier s'affiche pendant le chargement des réservations, qui
  prend plusieurs secondes, à la place de « — ».

**Côté moteur** (cf. [doc/27](../doc/27-module-observatoire.md), [doc/07](../doc/07-module-search.md)) :
- clé de dimension `valueMapFrom` (`withFilterValueMaps`, pur, testé ; hook `useResolvedDimensions`) ;
- `KpiCard` extraite dans son propre fichier, avec un état `loading` ;
- helpers `SLOT_HOURS`, `SLOT_QUARTERS`, `splitTime`, `joinTime`, `minuteOptions` dans `lib/slotFilter.ts`, testés.

**À savoir** : les listes de communes et de sports restent des listes de configuration. Un nouveau code
postal n'y entre pas tout seul ; il apparaît brut dans l'observatoire, sans erreur, ce qui rend l'oubli
visible.

**Validation** (base locale `prod201026`, Chrome sans fenêtre) :
- filtre créneau : 4 listes (heure et minute pour chaque borne), minute grisée sans heure, minutes
  « 00, 15, 30, 45 » ; 14 h 45–17 h appliqué donne `?creneau=_14h45-17h00` ;
- observatoire chargé en entier (703 équipements) : KPI Communes = 23, filtre « Commune » = « Tous » + 23
  communes aux libellés de la page Équipements, dont « Saint-Paul (97411, 97434) » ;
- sablier visible sur les deux KPI d'heures pendant un chargement retardé exprès ;
- valeurs une fois chargées : 376,9 h/semaine, 13 499,7 h cumulées ;
- tests ✅ (lots 8 et 9 : 10 fichiers, 208 cas) · typecheck ✅ · lint ✅ (0 erreur, aucun avertissement
  sur les fichiers touchés) · `config:validate` ✅.

### Lot 8 — fiches et créneaux (2026-10-23)

**Ce qui change** (commit `d66c426e`, fichiers communs `ef67807c`), demandes de Peterson du 23/10 et vérification face à l'import
« une réservation par période » (option B, communecter-php74) :

- **Fiche équipement** :
  - chaque sport pratiqué est cliquable et filtre la liste, comme le type et la catégorie. Un filtre
    « Sport pratiqué » rejoint la page Équipements : 50 sports tirés des 703 équipements, comparaison par
    jeton. Un sport absent de la liste reste du texte, par exemple celui de la piscine Michel-Debré, qui
    n'est pas dans le périmètre scolaire ;
  - le volume horaire s'affiche en deux indicateurs bien visibles : heures / semaine et heures cumulées ;
  - sous chaque association, même repliée, ses périodes s'affichent (« Du 19 août 2026 au 5 nov. 2026 ·
    Du 9 nov. 2026 au 18 févr. 2027 · … »).
- **Grille des créneaux** :
  - une plage continue ne fait plus qu'une carte. Un créneau de 7 h 35 à 15 h 10 était répété dans les 9
    rangées d'une heure qu'il recouvre ; il occupe désormais une seule cellule ;
  - les créneaux d'un même club qui se suivent sans interruption (même activité, même période) sont
    fusionnés en une carte ;
  - les autres jours ne bougent pas ;
  - chaque carte porte la période de son créneau (« 19/08/2026 → 06/11/2026 »).
- **Modifier l'horaire d'un créneau** : un crayon sur chaque créneau, dans le détail d'une association sur
  la fiche équipement et dans la liste d'un équipement sur la fiche association. Seules les heures se
  modifient, ni le jour ni la période. Le contrôle refuse une fin avant le début, un chevauchement avec un
  autre créneau de la même réservation ou avec un autre club sur une période commune. L'occupant est nommé.
- **Fiche association** :
  - localisation à gauche, équipements réservés à droite (`bookedResources.placement: "column"`) ;
  - deux indicateurs d'heures au-dessus de la liste ;
  - même filtre « du … au … » que la fiche équipement (défaut : en cours ou à venir) ;
  - un bouton « Ajouter un créneau » sur chaque équipement : formulaire pré-rempli, équipement et
    association verrouillés, même contrôle des chevauchements.
- **Formulaire de réservation** :
  - plus de mention « Étape 1 » ;
  - « Type usager » et « Président » sont masqués dès qu'une association est choisie. C'est une règle
    d'affichage conditionnel posée dans la définition du formulaire, et non du code : elle vaut aussi pour
    Saint-Paul et pour communecter.org. Elle est écrite en base locale et reste à poser en production (§13).
- **Conséquences de l'option B** (décisions de Peterson du 23/10) :
  - le total « par semaine » se lit au jour de référence : les créneaux actifs aujourd'hui, ou au début de la
    période choisie, sinon la prochaine semaine réservée. Additionner tout ce qui était en cours ou à venir
    comptait chaque trimestre : à la piscine Michel-Debré, 128,6 h/sem affichées pour 47,6 h réelles.
    Le cumul est inchangé ;
  - la saisie d'une période par créneau, ajoutée au lot 7, est retirée du formulaire du site : une
    réservation correspond à une période. Les créneaux déjà datés restent lus ;
  - le tableau « installation » calcule désormais son taux d'occupation sur la même semaine type, et plus
    sur toutes les saisons ensemble.

**Côté moteur** (cf. [doc/07](../doc/07-module-search.md), [doc/21](../doc/21-module-coform.md)) :
- options `reservations.booking.editHours` et `bookedResources.placement` ;
- `booking` et `periods` lus aussi sur le bloc `reservations` de l'annuaire ;
- prop `hideStepHeaders` du formulaire générique ;
- helpers purs et testés dans `lib/reservations.ts`, `reservationHours.ts`, `reservationBooking.ts`,
  `reservationPrefill.ts` et `reservationPeriod.ts` ;
- écriture d'un créneau par `updateField` sur le seul élément du tableau (`useUpdateSlotHours`).

Aucune modification de l'API client ni du backend.

**Prérequis données en production** (§13) : poser la règle d'affichage conditionnel et décocher « Une
réponse par personne ».

**À savoir** :
- le contrôle des chevauchements reste côté site, sans contrôle serveur ;
- une modification d'horaire ne porte que sur la réservation de SA période : un horaire changé pour l'année
  se modifie trimestre par trimestre ;
- la plateforme n'écrit pas d'historique (`answerChanges`) pour une modification d'horaire, seulement
  pour un ajout ;
- droit de modifier : `Answer::canEdit`, soit les admins du contexte de la réponse (DRAJES ES974, dont
  Tibor) et le super-admin. Ce droit a été lu dans le code, pas éprouvé avec un compte admin ordinaire ;
- le formulaire d'édition complet d'un équipement fera l'objet d'un lot séparé, après la demande backend (§13).

**Validation** (base locale `prod201026`, Chrome sans fenêtre). Écritures locales préalables, avec
sauvegarde :
- règle d'affichage conditionnel ;
- `oneAnswerPerPers` à false ;
- compte de test admin du projet `ESS974`.

Piscine Michel-Debré :
- indicateurs 47,6 h/sem et 1 879,3 h cumulées ; 47,6 h est la valeur recalculée en base pour la semaine en
  cours ;
- périodes sous chaque association ;
- 9 cellules fusionnées, aucune carte répétée dans une colonne ;
- périodes sur les cartes.

Salle de tennis de table :
- le Collège Mille Roches occupe une seule carte de 8 h à 16 h par jour (8 rangées) ;
- un clic sur « Tennis de table » ajoute `?sport=tennis-de-table`.

Fiche BADMINTON DE LA SALINE (association à droite de la localisation, indicateurs 4 h/sem) :
- formulaire d'ajout sans « Étape 1 », sans Type usager ni Président, avec 2 champs date seulement ;
- refus attendu : « Mercredi 18:00 – 19:00 est déjà réservé par JS SALINE (Du 17 août 2026 au 13 août 2027) » ;
- un créneau de test le mercredi de 10 h à 11 h est enregistré ;
- modification de l'horaire : refus d'une fin avant le début, puis 10 h–11 h 30 enregistré (« Horaire modifié. ») ;
- la réservation de test est ensuite supprimée de la base locale, avec sa ligne d'historique (sauvegardes
  dans le scratchpad).

Fiche équipement, compte admin :
- 14 crayons ;
- formulaire de réservation sans « Étape 1 », avec Type usager et Président visibles tant qu'aucune
  association n'est choisie.

Saint-Paul :
- cellules fusionnées, périodes sous les clubs, crayons ;
- fiche association avec filtre et bouton d'ajout ;
- pas d'indicateurs d'heures, option absente.

Gates :
- tests ✅ 208/208 (10 fichiers, réservations et observatoire) · typecheck ✅ · lint ✅ (0 erreur) ;
- `config:validate` ✅ ESS974 (9 pages, 14 sections), Saint-Paul (12 pages, 21 sections) et parent ;
- préflight 887/894 en lecture seule : les 4 échecs d'environnement (§12), plus l'exemple `data-observatory`
  de l'assistant, dont la seule dérive est `editHours` sur Saint-Paul. Sa resynchronisation, acte conscient,
  attend l'accord de Peterson.

### Conformité aux règles d'aboire — suite du préflight (2026-10-23)

Le préflight du 23/10 a relevé un vrai écart du lot 3. Il a été lancé sans écriture ni réseau, avec
l'accord de Peterson. Le préchargement SSR du périmètre « organisations usagères »
(`prefetch/prefetchReservationUsers.ts`) appelait `initApi()` lui-même. Le garde-fou
`ssr-init-api-unique` d'aboire (15/10) l'interdit : chaque init directe recrée un client API et refait
la résolution du porteur à chaque page servie. Le préchargement passe désormais par l'init de la requête
(`ensureInitApi(queryClient)`, partagée avec entry-server et les autres loaders) ; un test est ajouté
dans `prefetch/__tests__/`. Dans la même passe :
- un test est ajouté à `lib/reservationPeriod.ts`, helper pur sans test depuis le 23/09 (§9 des bonnes
  pratiques), dont le cas « date seule lue à minuit local » ;
- les fixtures `effective-config` des 3 sites équipements sont resynchronisées. Leurs écarts, tous
  voulus, viennent des lots 3 à 6 : `inst_siret`/`inst_uai`, `equip_numero`, page `/annuaire` ;
  `periods` n'y est pas projeté ;
- l'exemple `data-observatory` de l'assistant config est resynchronisé lui aussi.

**Validation** :
- préflight ✅ 889/894. Restent les 4 échecs d'environnement (§12) ; le test réseau est écarté ;
- tests ✅ 28/28 (préchargements, période, périmètre usagers) ;
- typecheck ✅ · lint ✅ (0 erreur) · `config:validate` ✅ sur les 3 configs équipements.

### Lot 7 — ajout de créneaux par période (2026-10-23)

**Ce qui change** (commit `97e5699c`, fichiers communs `35df7f94`) : les admins ajoutent des créneaux depuis la fiche équipement, et un
créneau ne bloque plus que SA période.

- **Filtre « du … au … »** dans la section Réservations de la fiche : ne restent que les créneaux dont
  la période recouvre l'intervalle. Sans date, les créneaux en cours ou à venir (décision de Peterson,
  la règle du filtre « Créneau disponible » et des heures). La liste des clubs, le nombre de créneaux,
  les heures et la grille suivent.
- **Prise de réservation** (grille horaire, cases « + ») activée sur les 4 points d'entrée de la fiche
  (Équipements, Observatoire, Data, palette de recherche), réservée aux admins du site (ceux du projet
  `ESS974` et, par la hiérarchie, ceux de DRAJES ES974). Une case n'est occupée que par un créneau de la
  période choisie : un créneau d'août à septembre ne bloque plus octobre à décembre. Le formulaire
  s'ouvre avec Date début / Date fin pré-remplies (la période choisie ; sans date, Date début =
  aujourd'hui).
- **Période propre à chaque créneau** (décision de Peterson du 23/10 : une réservation par saison,
  chaque créneau porte sa période — contrat partagé avec l'import des créneaux des communes,
  communecter-php74, plan `import-creneaux-ess974-communes.md` § 5.5) : dans le formulaire, chaque
  créneau reçoit deux dates facultatives (vides = toute la réservation) ; elle s'affiche à côté du
  créneau sur les fiches équipement et association quand elle diffère de celle de la réservation ;
  conflits, filtre « Créneau disponible » et heures la prennent en compte partout.
- **Enregistrement refusé** (formulaire laissé ouvert, message clair) : sans Date début et Date fin,
  ou fin avant début ; période d'un créneau à l'envers ou hors de la réservation ; deux créneaux du
  formulaire qui se chevauchent ; créneau qui chevauche un créneau déjà enregistré sur l'équipement
  (même jour, heures sécantes, périodes communes — l'occupant et sa période sont nommés).

**Côté moteur** (cf. [doc/07](../doc/07-module-search.md), « Périodes — `reservations.periods` », et
[doc/21](../doc/21-module-coform.md)) : option `reservations.periods` (opt-in, exige les champs de
dates) ; lecture de la période par créneau (`slotPeriod`) pour tous les sites ; logique de la prise de
réservation dans `lib/reservationBooking.ts` (testée) ; deux options facultatives du formulaire générique,
`beforeSubmit` et `slotPeriods`, inactives par défaut — les formulaires de créneaux de SSBE (424
réponses) et du Tampon (65), qui partagent le champ, ne changent pas. Aucune modification de l'API
client ni du backend.

**Prérequis données** : le formulaire « Formulaire créneaux E.S. » doit accepter plusieurs réponses par
personne. Avec `oneAnswerPerPers: true` (valeur du dump de production du 20/10), le serveur refuse
toute nouvelle réservation à un compte qui en a déjà une (« Vous avez déjà soumis une réponse à ce
formulaire »), alors que la fenêtre s'ouvre normalement. Décoché en local le 23/10 (avec le compte de
test rendu admin du projet `ESS974`) ; à faire en production (§13).

**À savoir** : aucun contrôle serveur des chevauchements — deux admins qui enregistrent au même
instant peuvent encore se chevaucher (fenêtre réduite par les relectures). Le formulaire PHP de
communecter.org efface encore la période d'un créneau modifié : chantier d'import (décision de Peterson).
Saint-Paul reçoit la même gestion des périodes (décision de Peterson, cf. son §9).

**Validation** (base locale `prod201026`, Chrome sans fenêtre, fiche « Salle EPS / expression
corporelle ») : par défaut, 5 clubs de la saison en cours et le mardi 19 h–20 h libre (Karaté Club Léo
l'occupait la saison passée) ; période du 01/03 au 30/06/2026 : 6 clubs, case occupée par Karaté Club
Léo ; formulaire ouvert avec Date début = 23/10/2026 et les dates par créneau ; enregistrement refusé
sans date de fin, puis « Mardi 19:00 – 21:00 est déjà réservé par UNIVERS METISS (Du 18 août 2026 au
10 août 2027) », puis réservation 19 h–20 h enregistrée (dates et créneau au format des réponses
importées) et case devenue occupée ; cette réponse de test a été supprimée ensuite de la base locale.
Filtre lisible en 1440 et 390 px, sans défilement horizontal ;
message « La date de fin doit suivre la date de début » sur une saisie inversée. Tests ✅ 227/227
(13 fichiers des réservations, fiches et observatoire) et ✅ 289/289 (6 fichiers du module formulaire,
dont 16 cas ajoutés ; tests de Juda, Cael et Thomas lancés avec l'accord de Peterson) · typecheck ✅ · lint ✅ (0 erreur, aucun avertissement sur les fichiers touchés) ·
`config:validate` ✅ (9 pages, 14 sections) · `audit:config` RAS. Préflight et fixtures
`effective-config` repassés le même jour (entrée « Conformité » ci-dessus).

### Lot 6 — volume horaire des réservations (2026-10-20)

**Ce qui change** (commit `cb978210`, fichiers communs `35df7f94`) : le volume horaire réservé s'affiche en deux valeurs — **par
semaine** (somme des durées des créneaux hebdomadaires) et **cumulé** (chaque créneau multiplié par le
nombre de fois où son jour tombe réellement dans la période de la réservation, bornes incluses) :

- fiche **association** (`/annuaire`) : le total de l'association sur les équipements listés, puis
  celui de chaque équipement ;
- fiche **équipement** : le total de l'équipement sous le titre « Réservations », puis celui de chaque
  association, sur une ligne sous sa rangée ;
- **observatoire** (`/observatoire`) : deux cartes, « Heures réservées / semaine » et « Heures
  réservées cumulées », recalculées sur les équipements affichés (filtres, recherche, sélection).

**Règle tranchée par Peterson (20/10)** : seules comptent les réservations **en cours ou à venir** —
celle du filtre « Créneau disponible » (lot 5). Deux saisons coexistent en base (janv.–août 2026,
terminée ; août 2026–août 2027, en cours) : compter la saison passée doublerait l'hebdomadaire d'un
club qui a reconduit ses créneaux (277,9 h au lieu de 135). Deux cartes plutôt qu'une seule à deux
valeurs (Peterson).

- **Moteur** (opt-in, cf. [doc/07](../doc/07-module-search.md), « Volume horaire », et
  [doc/27](../doc/27-module-observatoire.md), « KPI `reservationHours` ») : `reservations.hours`,
  `bookedResources.hours` et le KPI `reservationHours` (`period`). Logique pure dans
  `lib/reservationHours.ts`, testée ; arrondi au dixième d'heure. Le KPI lit les réservations du
  formulaire de la fiche de la page (`rowAction.preview.reservations`), chargées seulement s'il est
  déclaré, par la requête du filtre créneau. Aucune modification de l'API client ni du backend.
- **Config** : `hours: true` sur les 4 blocs de fiche équipement (Équipements, Observatoire, Data,
  palette de recherche) et sur `bookedResources` de l'Annuaire ; 2 KPI ajoutés à `/observatoire`.
- **5 cartes par ligne** (Peterson, 21/10) : les 9 KPI de `/observatoire` se répartissent 5 + 4 dès
  1024 px — option moteur `kpiColumns` (3 à 6, opt-in, section `data-observatory` seule), posée sur
  cette page uniquement ; la vue observatoire intégrée à la page Équipements garde la grille
  automatique. Sans l'option, la grille se remplissait seule et laissait la 9ᵉ carte seule sur sa
  ligne en pleine largeur.

**À savoir** : le temps « effectivement utilisé » du cahier des charges n'est pas mesurable — le champ
« Valide » vaut « Non » sur toutes les réservations (non filtré, décision antérieure). **Tranché par
Peterson (21/10)** : on affiche le seul temps OCCUPÉ PAR LES RÉSERVATIONS — ce que fait le lot. Ni
jours fériés ni vacances ne sont déduits du cumul (aucune donnée) ; deux réservations qui se
chevauchent s'additionnent, le total restant la somme des lignes. Le nombre de créneaux affiché à côté
compte toutes les réservations listées, saison passée comprise ; les heures, non. À 1024 px, la
valeur « 174 / 534 » (Intérieur) frôle son icône — même largeur de carte qu'avec la grille
automatique, donc préexistant.

**Régressions à revalider** : fiches et observatoire sont partagés ; sans l'option, ils rendent le
même balisage (ajouts conditionnels uniquement) — vérifié sur Saint-Paul : fiches équipement et
association rendues sans heures, observatoire sans carte d'heures, aucune erreur.

**Validation** (base `prod230926`, Chrome sans fenêtre), contre un calcul indépendant en base — 26
réservations scolaires en cours ou à venir : observatoire sans filtre 135 h/sem · 7 044 h ; nature
« Découvert » 8,5 · 442 ; type « Salle multisports (gymnase) » 73,3 · 3 817 ; fiche « Salle de
danse » total 27,5 h/sem · 1 440 h, AD2S 5,5 · 288, TWIRL CLUB OUEST 974 6 · 318, EKOP REUNION
1,8 · 91 ; fiche « Centre étude karaté Saline » total 4,8 · 247, Salle de danse 3,5 · 182, Salle EPS
1,3 · 65 ; mobile : lignes d'heures entières, pas de défilement horizontal de la page. Tests unitaires
✅ 155/155 (6 fichiers) · typecheck ✅ · lint ✅ · knip : rien sur le lot · `config:validate` ✅
(9 pages, 14 sections) · `audit:config` ESS974 RAS. Préflight et fixtures `effective-config` à
repasser avec l'acquittement en attente. Grille des KPI (21/10) : 5 + 4 à 1440 et 1024 px, 3 + 3 + 3
à 800 px, 2 par ligne à 390 px, aucun défilement horizontal ni erreur ; Saint-Paul (sans l'option) :
classes de la grille inchangées, 7 cartes sur une ligne. Tests ✅ 40/40 (`dashboard.test.ts`, cas
`kpiColumns` compris) · typecheck ✅ · lint ✅ · `config:validate` ✅.

### Lot 5 — filtre « Créneau disponible » (2026-10-20)

**Ce qui change** (commit `ed279c6b`, fichiers communs `35df7f94`) : le bandeau de `/equipements-sportifs` reçoit un filtre de
disponibilité, `slotFilter` (param `?creneau=`), à la suite des 8 dropdowns. Une réservation étant un
créneau **hebdomadaire** valable sur une période, on y cherche comme on réserve : une **plage
horaire** (critère principal), des **jours de la semaine** et, au besoin, une **période** — « chaque
lundi et chaque jeudi de 15 h à 18 h, du 17/08/2026 au 12/08/2027 ». **Règles tranchées par Peterson
(20/10)**, qui remplacent le jour même, à sa demande, une première version à jour daté : plusieurs
jours → libre **chacun** d'eux, aucun jour → les 7 ; début seul → jusqu'à 22 h, fin seule → depuis
8 h (amplitude déclarée), aucune heure → toute la journée ; période facultative qui, sans début, part
d'aujourd'hui — une réservation **terminée** ne bloque plus, une réservation **à venir** bloque déjà ;
une période de moins d'une semaine ne garde que ses jours ; un équipement **sans réservation
enregistrée est disponible** — le filtre ne retire que les occupés.

- **Moteur** (opt-in, cf. [doc/07](../doc/07-module-search.md), « Filtre créneau ») : occupé = une
  réservation du formulaire dont un créneau chevauche la plage l'un des jours cherchés et dont la
  période recouvre celle de la recherche — la détection de conflit de la prise de réservation,
  réutilisée. Les occupés partent en `_id: {$nin}` par `searchByFieldsToQuery` : le filtre se combine
  en ET avec les autres, et la liste, son compteur, la carte, l'observatoire intégré et l'export CSV
  le suivent.
  Même URL, même pastille, même compteur et même réinitialisation que les dropdowns. Aucune
  modification de l'API client ni du backend.
- **Réservations chargées à la demande** (ouverture du filtre, ou créneau dans l'URL) : les 192
  réponses du formulaire qui pointent un équipement, tous sites confondus — les occupés hors
  périmètre sont sans effet sur la liste.
- **Config** : `slotFilter` avec le bloc `reservations` de la liste et `amplitude` 8 → 22.
- **Prise de réservation** (« l'ajout d'un créneau doit contenir la période », Peterson, 20/10) :
  c'est déjà le cas. Le formulaire « Formulaire créneaux E.S. » porte « Date début » et « Date fin »
  juste après les horaires, et « Ajouter un créneau » pour d'autres jours — vérifié à l'écran sur
  Saint-Paul (compte admin local, ouverture depuis une case libre de la grille, rien enregistré). Sur
  ESS974, la fiche n'a pas de prise de réservation : `booking` n'est pas activé, le site est en
  consultation.

**Régressions à revalider** : le bandeau est partagé par tous les sites ; sans `slotFilter`, il rend
la même barre, la même requête au caractère près (tests de `searchByFieldsToQuery`) — vérifié sur
Saint-Paul (cf. son §9 du 20/10).

**Validation** (base `prod230926`, Chrome sans fenêtre), contre un calcul indépendant en base — 7
équipements scolaires ont des réservations : lundi 14:00–17:00 → 708 (aucune réservation le lundi
avant 17 h) ; lundi + jeudi 15:00–18:00 → 702 ; 17:00–17:30 : lundi 704, jeudi 704, les deux 703 ;
sans jour 18:00–20:00 → 702 ; début seul 20:30 → 704 ; fin seule 09:00 → 706 ; lundi seul → 702 ;
lundi 17:00–17:30 sur la saison passée (01/02 → 30/06/2026) → 706 ; sans jour 17:00–17:30 sur le seul
lundi 26/10 → 704 ; lundi + jeudi 15–18 du 17/08/2026 au 12/08/2027 → 702 ; avec le type « Salle
multisports (gymnase) » 55 → 52, pastille du créneau retirée → 55, type conservé ; « Réinitialiser »
→ 708, URL vidée ; « expression corporelle » : 0 le lundi 18–20 h, 1 de 20:30 à 22:00 ; lien partagé
avec période → 702 et pastille ; observatoire sous le créneau : 702 ; heures inversées, période
inversée, jour absent de la période : refusés par le formulaire et ignorés dans l'URL, ancien format
compris ; mobile : fenêtre dans l'écran, 702, pas de défilement horizontal. Tests unitaires ✅
318/318 (18 fichiers : circuit des filtres et routage) · typecheck ✅ · lint ✅ 0 erreur · knip :
rien sur le lot · `config:validate` ✅ 18 configs · `config:render` ✅ 17/18 sites (seul échec : la 404 préexistante de `nos-commune` `/manifeste`), ESS974 9/9 pages, Saint-Paul 12/12, sans erreur serveur. Préflight à
repasser avec l'acquittement du lot 3.

**Limite constatée** : en local, le premier chargement des réservations prend ~12 s (2 appels de
~6 s). `answerslist` joint à chaque réponse ses documents, et le dump n'a pas d'index sur
`documents.id` (97 345 documents parcourus par réponse). La production a probablement cet index —
non vérifié. Pendant l'attente, le bouton affiche un indicateur et aucune pastille ne paraît.

### Lot 4 — page Équipements alignée sur Saint-Paul (2026-10-16)

**Ce qui change** (config seule, fichiers communs `35df7f94`) : à la demande de Peterson, la section
`section-equipements-cards` de `/equipements-sportifs` reprend **tels quels** trois blocs de la même
section de Saint-Paul Sport. 100 % config, aucun fichier de `src/` touché.

- **Bouton « Fiche » de chaque association** dans la fiche équipement
  (`list.preview.reservations.orgaLink` → `/annuaire`) : il ouvre la fiche de l'association dans
  l'annuaire du lot 3. Toute organisation qui a un créneau sur un équipement scolaire est, par
  construction, dans cet annuaire, et `/annuaire` porte `list.previewFetch` : le lien aboutit
  toujours. Pas d'organisation reliée (2 réservations aujourd'hui), pas de bouton — comme à Saint-Paul.
- **Vue carte** : `map.layout: "split"` + `splitRatio: "30-70"` (liste resserrée à gauche, carte
  synchronisée à droite) et marqueurs à **icône et couleur par type** (`marker.by` sur
  `equip_type_name`, table de 109 types de Saint-Paul — elle couvre les 41 types du périmètre).
  **Sans** les contours des bassins de vie (§7).
- **Vue observatoire intégrée** (`observatory`, bouton « Observatoire ») : 7 KPI et 5 graphes calculés
  sur les résultats et les filtres en cours, sélection au clic et drill-down. Tous les champs lus
  sont déjà projetés par la liste et renseignés sur les 708 équipements.

Poids : environ 10 Ko de plus dans la page servie (config compacte), 25 Ko dans le fichier (indentation).

**Régressions à revalider** : aucune — une seule section de cette config ; la garde d'impact
(`effective-config`) ne projette ni la carte, ni l'observatoire, ni ce lien.

**Validation** (base `prod230926`, Chrome sans fenêtre) : vue carte en liste + carte, carte à 70 % de
la largeur, épingles à pictogramme par type ; observatoire : 708 équipements, 27 communes
(`address.addressLocality`, comme la page `/observatoire`), graphes rendus ; fiche « Salle EPS /
expression corporelle » : 7 associations, 7 boutons « Fiche » — clic → `/annuaire?preview=<id>`,
fiche de CENTRE ETUDE KARATE SALINE ouverte ; mobile 390 px (liste, carte, observatoire) sans
défilement horizontal ; aucune erreur navigateur. `config:validate` ✅ 9 pages, 14 sections ·
`audit:config` RAS · `config:render` ✅ 9/9 pages, aucune erreur serveur. Préflight à repasser avec
l'acquittement du lot 3.

### Lot 3 — annuaire des associations usagères (2026-10-16)

**Ce qui change** (commit `2a2ba6f9`, fichiers communs `35df7f94`) : nouvelle page `/annuaire` (recette
`page-recherche` : bandeau de recherche + liste) et entrée de menu « Annuaire » / « Directory »
entre « Equipements » et « Observatoire ». **Règle métier (Peterson, 16/10)** : la page liste les
organisations usagères d'**au moins un créneau sur un équipement scolaire** — 23 aujourd'hui (base
locale), toutes à Saint-Paul (lycées Evariste de Parny et Vue Belle). La liste est **générique** :
elle suit seule les nouveaux créneaux, saisis ou importés, les nouvelles organisations et les
équipements nouvellement étiquetés `ESS974`.

- **Moteur** : périmètre calculé `searchProStatic.reservationUsers` (réservations rattachées à une
  organisation → équipements du site parmi ceux réservés → organisations), préchargé au SSR sous la
  clé du client — cf. [doc/07-module-search.md](../doc/07-module-search.md), « Annuaire des
  organisations usagères ». Aucune modification de l'API client ni du backend.
- **Fiche organisation** : modale centrée (`structure`), section « Équipements réservés » restreinte
  aux équipements scolaires (`bookedResources.poiFilters`, option B de Peterson) — une association
  réserve aussi des salles municipales, qui n'y figurent plus.
- **`/equipements-sportifs`** reçoit `list.previewFetch: "poi"` : le bouton « Fiche » d'un équipement
  réservé ouvre sa fiche même hors de la tranche déjà chargée.

**Régressions à revalider** : aucune attendue ailleurs — les deux réglages sont opt-in et seule cette
config les déclare ; vérifié sur Saint-Paul (cf. son §9 du 16/10).

**Validation** (base `prod230926`) : au navigateur, page servie DÉJÀ restreinte (compteur 23, les 23
noms, aucune des 225 autres organisations taguées « usager ») ; même liste après hydratation, sans
flash ; fiche GRS LA SALINE : ses 2 équipements scolaires sur 4 ; bouton « Fiche » → fiche
équipement ouverte ; lien `?preview=<id>` ; mobile 390 px sans défilement horizontal ; aucune erreur
de page, d'hydratation ni du backend. `config:validate` ✅ 9 pages, 14 sections · `audit:config` RAS ·
`config:render` ✅ 9/9 pages · tests unitaires ✅ 319/319 (23 fichiers) · préflight 845/851 : 2 échecs
préexistants (`bundle-size` sur un `dist` de juillet, guillemets du `.env`) et 4 écarts VOULUS à acquitter
— fixtures `__effective__` des 3 sites équipements, exemple `data-observatory` de l'assistant.

**20/10, après la fusion de `main` par Peterson** : le commit de Thomas `8984670a` charge le module
prefetch dans le loader serveur, hors du bundle client. La fusion avait laissé à côté l'import statique
de ce lot (`prefetchReservationUsers`) : 4 imports morts au typecheck, et le module de nouveau dans le
bundle client. `prefetchReservationUsers` rejoint l'import dynamique de Thomas — typecheck ✅, test du
routage de Thomas (`buildRoutes.test.tsx`) ✅.

### Lot 2 — fiche équipement, filtres multi-valeurs et communes (2026-10-15)

**Ce qui change** : lot commun aux trois sites équipements (commit `7f240d4c`, fichiers communs `35df7f94`) —
fiche, moteur et justification détaillés dans le §9 de [saint-paul-sport.md](saint-paul-sport.md).
Ici, les filtres passent de 5 à 8 (tableau du §4.2) :

- **codes postaux regroupés par commune** : les 27 codes deviennent 23 options « Commune (codes) » —
  ex. « Saint-Denis (97400, 97490) », « Le Tampon (97418, 97430) » — portées par `values` (cf.
  [doc/07-module-search.md](../doc/07-module-search.md), « Option à plusieurs valeurs »). Rattachement
  code → commune tiré de la donnée (`address.localityId` → `cities`), noms officiels reconstitués
  depuis `cities.name` et l'article de `cities.alternateName`. Les communes partitionnent exactement
  le périmètre (somme = 708). ⚠ Les listes de codes de `cities.postalCodes` ne sont PAS fiables :
  97411 y figure aussi sous Saint-Leu ;
- **Type d'utilisateur rétabli** (cf. §4.2), en `match: "token"` : « Scolaires » 661 ;
- « Catégorie » et « Type de particularité » ajoutés ; « Locaux disponibles » en `match: "token"`.

**Régressions à revalider** : les anciens liens `?poi-postalCode=97400` retombent sur la commune
(résultat élargi à Saint-Denis entier, voulu) ; la facette code postal de la fiche aussi.

**Validation** (base `prod230926`, navigateur) : Saint-Denis 102 ; ancien lien 97400 → 102 ;
Saint-Denis ET Scolaires 94 ; « Complexe sportif » 172 ; « structurant » 129 ; menu à 23 communes,
aucun ancien libellé « 97xxx - Quartier » ; clic sur « 97410 SAINT-PIERRE » dans une fiche → toute la
commune (89). `config:validate` ✅ 8 pages, 12 sections · `audit:config` RAS ; gates de code : cf. §9
de [saint-paul-sport.md](saint-paul-sport.md).

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
| 1 | Config valide (Zod) | ✅ | 9 pages, 14 sections (16/10) |
| 2 | Audit qualité | ✅ | **RAS** — 0 constat (i18n, liens, assets, thème, prérequis) |
| 3 | Rendu SSR | ✅ | 9/9 pages en 200 (16/10) |
| 4 | Périmètres de données | ✅ | **3/3 à 708 résultats** (annuaire, observatoire, data) |
| 5 | Filtres alignés sur la donnée | ✅ | 0 valeur orpheline, 0 type réel sans option, 0 virgule |
| 6 | Préflight | 🟡 | 898/903 (28/10, après le lot D de la review de la MR 114) : ne restent que les 4 échecs d'environnement (§12) ; référence `effective-config` d'ESS974 et exemple `data-observatory` de l'assistant resynchronisés avec l'accord de Peterson (§9 lot B) ; inventaire des stamps complété (§9 lot 11) |
| 7 | Aperçu navigateur | 🟡 | Équipements vérifiée les 15/10 (filtres, communes, fiche) et 16/10 (carte, observatoire, lien association) ; Annuaire le 16/10 (§9) ; le reste du site à faire |
| 8 | Déploiement | ❌ | à faire |
| 9 | Saisie / back-office | ❌ | **bloqué backend** (§12) |
| 10 | Fiche équipement, filtres multi-valeurs, communes | ✅ | Lot 2, vérifié au navigateur le 15/10 (§9) |
| 11 | Annuaire des associations usagères | ✅ | Lot 3 : 23 organisations, liste générique, fiche en modale, équipements réservés restreints au scolaire — vérifié au navigateur le 16/10 (§9) |
| 12 | Page Équipements alignée sur Saint-Paul | ✅ | Lot 4 : carte liste + carte à icônes par type (sans contours), observatoire intégré, bouton « Fiche » de l'association — vérifié au navigateur le 16/10 (§9) |
| 13 | Filtre « Créneau disponible » | ✅ | Lot 5 : plage horaire, jours de la semaine (libre chacun d'eux) et période facultative, combiné aux autres filtres — vérifié au navigateur le 20/10 contre un calcul indépendant en base (§9) |
| 14 | Volume horaire des réservations | ✅ | Lot 6 : fiches association et équipement (par semaine et cumulé, par ligne et total), 2 KPI d'observatoire qui suivent les filtres — vérifié au navigateur le 20/10 contre un calcul indépendant en base (§9) |
| 15 | Ajout de créneaux par période | ✅ | Lot 7 : prise de réservation par les admins, filtre « du … au … », chevauchements refusés à l'enregistrement — vérifié au navigateur le 23/10, réservation de test enregistrée en local (§9). La saisie d'une période par créneau a été retirée au lot 8. En production : décocher « une réponse par personne » (§13) |
| 16 | Fiches et créneaux | ✅ | Lot 8 : sport cliquable, indicateurs d'heures (semaine de référence), périodes sous chaque association, cartes fusionnées, modification d'horaire, fiche association en deux colonnes avec ajout de créneaux, formulaire sans « Étape 1 » — vérifié au navigateur le 23/10 (§9). Ajustements du 26/10 : créneau occupé signalé en direct à l'ajout et à la modification, bouton d'ajout par association, réservations à gauche de la fiche association, indicateurs agrandis — vérifiés au navigateur (§9). En production : règle d'affichage conditionnel du formulaire (§13) |
| 17 | Filtres et observatoire | ✅ | Lot 9 : minutes au quart d'heure, 23 communes dans l'observatoire (liste commune avec la page Équipements), sablier des KPI d'heures — vérifié au navigateur le 23/10 (§9). Le 26/10, les 5 communes à deux codes postaux se sélectionnent de nouveau (libellés sans virgule), ce qui est vérifié au navigateur (§9) |
| 18 | Formulaire d'édition complet d'un équipement | ❌ | Lot 10, après la demande backend (§13) |
| 19 | Ajout et modification des associations | ✅ | Lot 11 : ajout depuis l'annuaire réservé aux admins (clé ESS974 posée par le serveur, étiquette usager, doublons signalés, apparition immédiate) ; modification par l'admin qui a ajouté l'association — vérifié au navigateur le 26/10, puis de nouveau sur le code final après la relecture de conformité (§9). Les 37 associations existantes restent non modifiables depuis le site |
| 20 | Corrections de la review de la MR 114 | 🟡 | Lot A (27/10) : garde de modification d'horaire sur la période, contrôles sur toutes les réservations, bouton masqué hors connexion. Lot B (27/10) : fiche équipement en option (`equipmentDetails`), sport-santé revenu à main, club du formulaire avec l'étiquette, annonces sur les sites en ligne. Lot C (27/10) : mémo serveur de l'annuaire (11,5 s → moins d'1 s par rendu), contrôles et mémos stables. Lot D (28/10) : nettoyage, dont les heures affichées en « h ». Vérifiés au navigateur (§9). Restent la description de la MR et la réponse à Thomas, à publier par Peterson |

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

### Débordements en mobile préexistants (constatés le 20/10, lot 6)

Sur téléphone (390 px), dans la fiche équipement, la rangée d'une association au nom long passe sous
le bouton « Fiche » (balisage committé le 23/09, inchangé par le lot 6) ; la fiche organisation est
plus large que son dialogue (480 px pour 358) et se décale — c'est le bloc de la fiche qui déborde, pas
les lignes d'heures (mesuré). Non traités : hors périmètre du lot, à arbitrer.

### Écueil d'outillage — dossier d'images fantôme

`config:render` **et** `npm run dev` créent `public/images/<VITE_SLUG>/` au montage du
middleware d'upload ([`../server/middleware/imageUpload.js:23`](../server/middleware/imageUpload.js)),
même sans upload. Un `public/images/ESS974/` vide a ainsi été créé puis supprimé pendant le
lot 1. Le préflight `site-assets` échoue sur tout dossier qu'aucun slug ne déclare — c'est
l'origine du `public/images/saintpaulSport1/` vide qui traîne depuis le 16/07.

### Échecs préflight préexistants (4, vérifiés hors périmètre)

Au 23/10 :
- `environment` : `VITE_BASE_URL_BACKEND` est entre guillemets dans `.env` ;
- `bundle-size` (2,44 Mo > 2 Mo) et `lazy-entry-facades` ×2 : ils lisent le build `dist/` du 24/07,
  antérieur au code actuel.

`site-assets` (dossier désormais déclaré dans `sites.json`) et `skill-integrity`, rouges au 16/10,
passent.

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
| Doter l'entité `ESS974` de `serverData.lists` et `costum.typeObj.poi` — prérequis du formulaire d'édition complet d'un équipement (lot 10 : formulaire du parent repris en configuration, plus les champs absents : n° d'équipement et d'installation, UAI, SIRET, site web…) | backend — destinataire à trancher (Aboire ou admin Communecter) |
| Un équipement créé depuis ESS974 doit-il porter `source.key = "equipementsSportifs974"` (visible sur les deux sites) ou `"ESS974"` seul ? | Peterson + backend |
| Garder ou retirer le bouton « Ajouter équipement sportif » tant que le lot 2 est bloqué | Peterson |
| Créer un club depuis le formulaire de réservation : le bouton « Ajouter » du finder « club usager » est désactivé en base (`addNew: false`). La config d'ESS974 est prête depuis le 27/10 (`coform.finderAddNew` : le club créé porterait l'étiquette). Mais ce formulaire est partagé avec Équipements sportifs et Saint-Paul, qui n'ont pas de formulaire d'association : l'activer y créerait des clubs sans l'étiquette, à traiter d'abord | Peterson |
| Compléter les marqueurs légaux (directeur de publication, hébergeur, contact RGPD) — commun aux 3 sites équipements | Peterson |
| Poser le DNS `equipements-sportifs-scolaires.00.re` et déployer | Peterson |
| Vérifier les volumes réels en production | Peterson |
| Formulaire « Formulaire créneaux E.S. » en production : décocher « Une reponse par personne » (sans quoi chaque admin ne peut enregistrer qu'une réservation), et, si besoin, rendre Peterson admin du projet `ESS974` | Peterson |
| Formulaire « Formulaire créneaux E.S. » en production : poser la règle d'affichage conditionnel sur « Association usagère » (renseignée → masquer « Type usager » et « Président »), par le constructeur de formulaires (« Affichage conditionnel ») ou la commande Mongo du plan des lots 8-9 — posée en local le 23/10 | Peterson |
| Associations ajoutées depuis l'annuaire (lot 11) : garder l'édition ouverte, défaut du SDK, ou la fermer en déclarant `preferences.isOpenEdition: false` dans le formulaire (configuration seule) ? Ouverte, tout utilisateur connecté peut les modifier par l'API ; le site ne montre « Éditer » qu'aux admins | Peterson |
| Formulaire de communecter.org (PHP) : conserver la période d'un créneau modifié. Depuis le lot 8, le site ne saisit plus de période par créneau et l'import n'en écrit pas (une réservation par période) : seules d'éventuelles données anciennes sont concernées | Peterson (autre session) |
| Mise à jour depuis dataES, préparée le 21/10 côté communecter-php74 (`/co2/migration/majess974dataes`, plan `maj-ess974-dataes.md`) : en production, importer d'abord les 19 nouveaux équipements, puis lancer l'action, qui pose et retire elle-même la clé `ESS974` (ne plus lancer `addsourcekeyess974`). Le périmètre passera de 708 à 703 équipements : les 694 de dataES + 9 équipements de collèges sans numéro, gardés ; 26 fiches absentes de dataES quittent le site scolaire (aucune réservation). La part « Donnée non renseignée » quittera les graphiques | Peterson |

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
