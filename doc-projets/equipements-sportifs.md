[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Équipements sportifs — Région Réunion

> **Document de travail du projet de configuration.** État des lieux d'une config **aboutie et
> saine**, dont l'observatoire sert de référence au module. **À tenir à jour à chaque lot livré**,
> selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Observatoire](../doc/27-module-observatoire.md) ·
> [Module Search](../doc/07-module-search.md) · [Module formEngine](../doc/28-module-formengine.md) ·
> [Module Admin](../doc/30-module-admin.md) · [Module CoForm](../doc/21-module-coform.md).
> Mémoire : `[[project-equipements-sportifs]]`.

Dernière mise à jour : **2026-08-03** (création du dossier — état des lieux ; rafraîchi SDK 1.0.172, aucun commit projet depuis le 28/07).

---

## 1. Contexte du projet

Annuaire public des **équipements sportifs de La Réunion**, porté par la **Région Réunion**. Les
données proviennent du **Recensement des équipements sportifs (RES)** — un jeu de données ouvert,
donc un cas différent du reste du parc : le contenu n'est pas produit par une communauté, il est
importé.

C'est la config dont l'**observatoire est cité en exemple** dans la documentation du module
([doc/27](../doc/27-module-observatoire.md)) : 13 dimensions, 7 filtres, 7 KPI, 5 graphes, table à
9 colonnes avec export CSV et détail au clic.

### Identité

| | |
|---|---|
| Slug | `equipementsSportifs974` |
| Costum backend | `equipementsSportifs974` (collection `organizations` — « Equipements Sportifs Réunionais ») |
| Config | [`../config.prod.equipements-Sportifs.json`](../config.prod.equipements-Sportifs.json) |
| CSS | [`../src/index-equipements-sportifs.css`](../src/index-equipements-sportifs.css) — 72 variables, bloc `theme` complet |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `transparent-scroll` / `contact-partners` |
| SDK | `@communecter/cocolight-api-client` **1.0.172** (publiée le 2026-08-03) |
| Historique | **53 commits** · dernier `227f65b7` (25/07) |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction complète ; dernier passage sur la lisibilité des titres de bandeaux |
| 28/07 | Claude | État des lieux et création de ce dossier |

---

## 2. Objectifs de la configuration

1. **Rendre cherchable** le recensement des équipements sportifs de l'île (3 052 fiches).
2. En donner une **lecture analytique** : répartition par commune, EPCI, type, nature, accessibilité.
3. Offrir une **table brute exportable** pour les réutilisateurs de données.
4. Permettre la **réservation de créneaux** sur un équipement.
5. Permettre à un gestionnaire de **compléter ou corriger** une fiche.

---

## 3. Architecture générale

```
                 ┌────────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                     │
                 │   8 pages · 13 sections                    │
                 │   /equipements-sportifs  ← recherche       │
                 │   /observatoire  ← tableau de bord         │
                 │   /data          ← table brute + export    │
                 └──────────────┬─────────────────────────────┘
                                │ searchCostum
                 ┌──────────────▼─────────────────────────────┐
                 │  Backend Cocolight — equipementsSportifs974│
                 │  3 052 équipements (source RES)            │
                 └────────────────────────────────────────────┘
```

---

## 4. Ce que la config met en œuvre

### 4.1 Les 8 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 3 | `hero-parallax` · `categories-grid` · `hero-quick-access` |
| `/equipements-sportifs` | 2 | `searchHeader` + `searchProStatic` — la recherche |
| `/observatoire` | 2 | `searchHeader` + `data-observatory` — **le tableau de bord** |
| `/data` | 2 | `searchHeader` + `data-observatory` — **la table brute** |
| `/rejoindre` | 1 | `registerForm` — le formulaire d'inscription du module auth, posé en section |
| `/mentions-legales` · `/confidentialite` · `/accessibilite` | 1 chacune | socle légal complet |

### 4.2 Deux observatoires, deux usages

Même section `data-observatory`, même périmètre (3 052), **mêmes 13 dimensions et 7 filtres** — mais
deux configurations opposées :

| | `/observatoire` | `/data` |
|---|---|---|
| KPI | **7** | 0 |
| Graphes | **5** | 0 |
| Table | oui (9 colonnes) | oui |
| Export CSV | oui | oui |
| Drill-down | **oui** | non |

`/observatoire` **raconte** le jeu de données ; `/data` le **livre**. C'est un patron réutilisable :
la même déclaration de dimensions sert les deux, seuls les widgets changent.

**Les 13 dimensions** : `name`, `equipName`, `numero`, `commune`, `epci`, `type`, `nature`, `prop`,
`aps`, `surface`, `pmr`, `pshs`, `handi`.
**Les 7 KPI** : total · communes distinctes · **% accessible PMR** · **% PSHS** · répartition par
nature · type le plus fréquent · **somme des surfaces**.
**Les 5 graphes** : `donut` (type) · `pie` (nature, **avec `colors` nommées**) · `booleanGroups` ·
`barsHorizontal` (activités) · `bars` (commune).

### 4.3 Réservation de créneaux

Le clic sur une ligne de la table ouvre un détail `poi-amenities` **doublé d'un module de
réservation** : `table.rowAction.preview.reservations` référence un **CoForm** (`form`, `step`) et
la correspondance de ses champs (créneaux, période, activité, utilisateur…).

C'est le seul site du parc à employer ce dispositif. Il est desservi par
`InstallationUrlModal`, monté uniquement sur deep-link.

### 4.4 Formulaire costum

**`equipements-sportifs`** — `poi`, **52 champs déclarés, 47 placés** + 2 slots
(`$slot:parentInfo`, `$slot:doublons`), 4 sections (général · légal · structure · usage).

Les 5 champs non placés — `geo`, `geoPosition`, `localityId`, `tags`, `description` — sont dérivés
du widget adresse ou renseignés autrement : **ce n'est pas du code mort**, contrairement à ce qu'on
observe sur sport-sante-bien-etre.

### 4.5 Back-office et palette

Back-office à **5 onglets** : tableau de bord · membres · contenu · import/export · référencement.
Palette ⌘K activée avec `entitySearch`. `auth` déclare **login et register** — cohérent avec la page
`/rejoindre`.

---

## 5. Modèle de données réel (sondé le 2026-07-28)

`config:probe` — **3 périmètres, 3 peuplés, 0 vide** :

| Page | Résultats |
|---|---|
| `/equipements-sportifs` · `/observatoire` · `/data` | **3 052** (les trois, même périmètre) |

Troisième jeu de données du parc par le volume, après tiers-lieux (4 303) et les créneaux de
sport-sante-bien-etre.

La projection est **explicite** : `baseParams.defaultFields` énumère les champs RES
(`equip_type_name`, `equip_nature`, `equip_sol`, `equip_surf`, `equip_larg`…). C'est nécessaire — un
champ non projeté est invisible pour les dimensions de l'observatoire, quel que soit son contenu en
base.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.equipements-Sportifs.json`](../config.prod.equipements-Sportifs.json) |
| Thème | [`../src/index-equipements-sportifs.css`](../src/index-equipements-sportifs.css) |
| Déclaration | [`../sites.json`](../sites.json) → `equipementsSportifs974` |
| Observatoire | [`../src/modules/observatoire/`](../src/modules/observatoire) |
| Réservations | [`../src/modules/observatoire/components/installation/`](../src/modules/observatoire/components/installation) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| **Deux pages** pour un même jeu | Un tableau de bord et un explorateur de données ne s'adressent pas au même public. Les fusionner obligerait à faire défiler 5 graphes avant d'atteindre la table |
| `defaultFields` **explicite** | Les champs RES ne sont pas projetés par défaut ; sans cette liste, les 13 dimensions de l'observatoire seraient vides |
| `colors` nommées sur le `pie` « nature » | Une carte de couleurs par VALEUR, et non le repli automatique — celui-ci colore par rang dans la liste triée, donc une valeur changerait de couleur au fil des mises à jour |
| Socle légal **rédigé et complet** | Site public porté par une collectivité : les mentions légales et la déclaration d'accessibilité ne sont pas optionnelles |

---

## 8. Étapes de mise en place

```bash
PORT=5248 VITE_SLUG=equipementsSportifs974 \
  SITE_CONFIG_PATH=config.prod.equipements-Sportifs.json \
  SITE_CSS_PATH=src/index-equipements-sportifs.css \
  node server/dev-server.js

npm run config:validate -- config.prod.equipements-Sportifs.json
npm run audit:config    -- --file config.prod.equipements-Sportifs.json
npx tsx scripts/config-probe.ts config.prod.equipements-Sportifs.json
```

---

## 9. Impacts des modifications

### 28/07 — aucun changement de config

Ce site est en revanche **le premier bénéficiaire** de deux correctifs du moteur livrés pour
institut-bleu :

| Correctif | Effet ici |
|---|---|
| **`--container-8xl`** dans `shared.css` (`23cdbd94`) | **Correctif majeur.** `DataObservatorySection` employait `max-w-8xl`, une classe qui ne générait **aucun CSS** — l'échelle Tailwind s'arrête à `7xl`. Ses deux observatoires s'étalaient donc **bord à bord**, sans largeur maximale, sur des pages en `layout: "fullwidth"`. Ils sont désormais bornés à 1 440 px |
| `charts[].colors` sur bars (`5269fc8e`) | Sans effet : ses `colors` sont sur un `pie`, qui les honorait déjà |
| `maxWidth` / `kpiLayout` (`23cdbd94`) | Props disponibles, non employées — les valeurs par défaut conviennent à des pages dédiées |

> Le défaut `max-w-8xl` était **invisible à l'audit et au typecheck** : une classe Tailwind inexistante
> ne produit ni erreur ni avertissement, seulement l'absence de la règle CSS.

### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 8 pages / 13 sections |
| `audit:config` | ✅ **0 constat** |
| `config:probe` | ✅ 3 périmètres, 3 OK |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `equipementsSportifs974` → `index-equipements-sportifs` |
| 2 | Thème | ✅ | Bloc `theme` complet, 72 variables |
| 3 | Recherche des équipements | ✅ | 3 052 fiches |
| 4 | Observatoire | ✅ | 13 dimensions, 7 filtres, 7 KPI, 5 graphes, table, export, drill-down |
| 5 | Table brute exportable | ✅ | `/data` — mêmes dimensions, sans widgets d'analyse |
| 6 | Réservation de créneaux | ✅ | Via `rowAction.preview.reservations` → CoForm. **Seul site du parc** |
| 7 | Édition d'une fiche | ✅ | Formulaire costum 52 champs, 4 sections |
| 8 | Back-office | ✅ | 5 onglets |
| 9 | Inscription | ✅ | Page `/rejoindre` (`registerForm`) + `auth.register` |
| 10 | Palette ⌘K | ✅ | `entitySearch` |
| 11 | Socle légal | ✅ | Mentions légales, confidentialité, accessibilité — rédigées |
| 12 | Rendu navigateur | ❌ | **Jamais vérifié** dans le cadre de ce dossier |
| 13 | Mode sombre | ❌ | Jamais vérifié |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours.

---

## 12. Points d'attention / limitations

- ⚠️ **Les 3 pages légales sont BYTE-IDENTIQUES à celles de `saint-paul-sport`** (vérifié le 28/07 sur
  les trois). Elles forment de fait un **gabarit partagé** du parc — c'est d'ailleurs celui qui a
  servi de modèle aux 5 pages légales de rezo-la-mer. **Toute correction doit être reportée dans les
  deux configs** : rien ne les synchronise.
- Ces pages portent **3 marqueurs de complétion**, sous trois formes différentes :
  `[à compléter]` (directeur de la publication),
  `[Dénomination de l'hébergeur — adresse complète — téléphone]`, et
  `[à préciser, ex. 12 mois]` dans la politique de confidentialité.
  ⚠️ Ce dernier **introduit un exemple chiffré dans un texte juridique** : publié tel quel, « 12 mois »
  se lira comme une durée de conservation engagée. Le marqueur est à retirer, pas seulement à
  compléter. (Le même écueil a été relevé et écarté en rédigeant les pages de rezo-la-mer.)
- **`defaultFields` est indispensable ici.** Retirer un champ de cette liste rend la dimension
  correspondante de l'observatoire vide, sans erreur ni avertissement.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.
- Le jeu de données est **importé** (RES), non produit par une communauté : sa fraîcheur dépend d'un
  processus d'import extérieur à SiteForge.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Les 3 pages légales sont dupliquées** avec saint-paul-sport, sans mécanisme de synchronisation. Faut-il les factoriser, ou accepter la duplication et documenter la règle « corriger les deux » ? | Thomas |
| 2 | Compléter les 3 marqueurs : directeur ou directrice de la publication, hébergeur — et surtout **retirer `[à préciser, ex. 12 mois]`** de la politique de confidentialité, qui fait lire « 12 mois » comme une durée de conservation engagée | Région Réunion |
| 3 | Rendu navigateur et mode sombre : jamais vérifiés — d'autant plus utile que le correctif `--container-8xl` du 28/07 change la largeur des deux observatoires | Thomas |
| 4 | La fraîcheur des données RES dépend d'un import extérieur. Quelle est sa périodicité, et est-elle affichée quelque part sur le site ? | Région Réunion |
