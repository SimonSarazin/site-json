[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet RELIEF — réseau des tiers-lieux d'Auvergne-Rhône-Alpes

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config, le
> périmètre de données mesuré et les points d'attention. Créé le 14/08 sur une config **jeune**
> (5 commits, 12/08 → 14/08), dérivée de la config nationale
> [tiers-lieux](tiers-lieux.md) et recentrée sur le costum régional `relief`.
> **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module Observatoire](../doc/27-module-observatoire.md) ·
> [Module Agenda](../doc/29-module-agenda.md) · [Module CoForm](../doc/21-module-coform.md) ·
> [Projet Tiers-Lieux.org](tiers-lieux.md) (config mère). Mémoire : `[[project-relief]]`.

Dernière mise à jour : **2026-08-14** (création du dossier ; entrée de déploiement Coolify posée
dans `sites.json` le matin même, commit `0363d79d` — déploiement effectif **à confirmer**).

---

## 1. Contexte du projet

**RELIEF** est le réseau des tiers-lieux d'Auvergne-Rhône-Alpes. Son site historique est le costum
Communecter `relief` (moteur `reseauTierslieux`), servi sur **cartographie.relief-aura.fr**. Le
projet consiste à lui donner un site SiteForge en **dérivant la config nationale
`config.prod.tiers-lieux.json`** et en la recentrant sur le périmètre régional : chaque retrait ou
conservation a été **mesuré en base** (0/522 → retiré, vivant → conservé), pas supposé
(commit fondateur `27d50412`).

L'organisation porteuse est **RELIEF** (`organizations/6146059c9348791eac133dd1`, Grenoble,
tag « Réseau de tiers-lieux »). Le périmètre de données est l'union que le serveur calcule pour
`sourceKey: ["relief"]` : `$or [ source.keys, reference.costum ]` = **522 organisations**
(12 créées sur le site + 513 référencées, 3 d'intersection — mesuré le 14/08, base locale).

### Identité

| | |
|---|---|
| Slug | `relief` |
| Costum backend | `relief` — org porteuse « RELIEF » (`6146059c9348791eac133dd1`), moteur `reseauTierslieux`, legacy `cartographie.relief-aura.fr`. ⚠ **Absent de la base locale** (65 costums, pas de `relief`) → `VITE_COSTUM_FORCE_LIVE=true`, cf. §12 |
| Config | [`../config.prod.relief.json`](../config.prod.relief.json) — 9 pages, 19 sections (validate-config, 14/08) |
| CSS | [`../src/index-relief.css`](../src/index-relief.css) — 330 lignes, bloc `theme` complet (audit : `theme:complet`) |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `mega-menu` / `minimal-centered` (hérités de tiers-lieux) |
| Marqueurs costum | `mainTag: "TiersLieux"` · `compagnon: "Compagnon France Tiers-Lieux"` |
| SDK | `@communecter/cocolight-api-client` **1.0.184** (lu dans `node_modules`, 14/08) |
| Branche | `feat/relief-config` — **5 commits d'avance sur `main`, non mergée** (14/08) |
| Déploiement | Coolify `site-json-relief`, domaine **aura.00.re**, env `VITE_COSTUM_FORCE_LIVE=true` (`sites.json`) |
| Chef de projet | à confirmer |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| 12/08 | aboire + Claude | `27d50412` — création du site, dérivé de tiers-lieux : recentrage périmètre (`notSourceKey` retiré ×10, `sourceKey: ["relief"]`), retraits mesurés (pages réseaux, variant `navigator-tl`, ampli, filtres pays/régions…), identité mint 152, garde d'édition `when` sur `profiles.organizations` |
| 12/08 | aboire + Claude | `4f79d5b4` — logo officiel du réseau (wordmark de cartographie.relief-aura.fr, détourage, `logoDark`, favicon recadré — le favicon officiel du costum est en 404) |
| 12/08 | aboire + Claude | `7d90bfd8` — observatoire : 9 références vers les dimensions supprimées (région/pays/équipements) purgées ; maille département (13 territoires AURA) |
| 12/08 | aboire + Claude | `bf4c195e` — agenda : rattachement par lien (`links.organizer` + `notSourceKey`), pas par provenance ; passthrough `notSourceKey` ajouté au module agenda |
| 14/08 | aboire | `0363d79d` — entrée de déploiement dans `sites.json` : `coolifyApp: site-json-relief`, `domain: aura.00.re`, `env.VITE_COSTUM_FORCE_LIVE: true` |
| 14/08 | Claude | Création de ce dossier ; gates rejoués (§10) |

---

## 2. Objectifs de la configuration

1. **Cartographier et rendre cherchables** les tiers-lieux de la région (522 au périmètre) :
   `/lieux` (panneau de filtres typologies/départements + recherche) et `hero-search` d'accueil
   avec CTA pré-filtrés (Coworker / Fabriquer / Manger / S'instruire).
2. **Donner un observatoire régional** : `/observatoire`, 7 dimensions (nom, commune, département,
   typologie, portage, surface, compagnon), 5 KPI, 4 graphiques, 5 filtres, export.
3. **Afficher la communauté du réseau** : `/communaute`, membres par `links.memberOf` de l'org
   porteuse (548 mesurés le 14/08).
4. **Publier l'agenda du réseau** : `/evenements` + teaser d'accueil, events rattachés par
   `links.organizer` à l'org RELIEF.
5. **Permettre l'ajout d'un tiers-lieu** : bouton flottant (`add-tiers-lieux`, connexion requise)
   → formulaire costum `tiers-lieux` (5 sections, 27 champs, stamps de tags).
6. **Relayer les outils mutualisés du réseau national** : nav « Outils et ressources » (forum,
   chat, wiki Movilab, notes, visio, fichiers) et `/usages` (catalogue `toolsCatalog` sur le
   formulaire national Les Communs).
7. **Cadre légal et bilinguisme** : mentions légales, confidentialité, CGU ; fr + en.

---

## 3. Architecture générale

```
cartographie.relief-aura.fr          site legacy (costum `relief`, moteur reseauTierslieux)
        │  même backend, mêmes données
        ▼
Communecter (co2) ──────────────── costum `relief` + org RELIEF 6146059c9348791eac133dd1
        │  API cocolight (SDK 1.0.184)
        ▼
SiteForge `config.prod.relief.json` ── aura.00.re (Coolify site-json-relief)
```

Trois voies de rattachement des données, à ne pas confondre :

| Voie | Où | Mécanisme |
|---|---|---|
| **Périmètre costum** | `/lieux`, accueil, observatoire, commandPalette | `sourceKey: ["relief"]` → le serveur applique `$or [source.keys, reference.costum]` (522 orgas). C'est le recentrage clé vs tiers-lieux (qui pose `notSourceKey` pour chercher national) |
| **Liens de l'org porteuse** | `/communaute` | `links.memberOf.6146059c9348791eac133dd1` + `contextId`/`costumSlug` |
| **Hors périmètre, par lien** | agenda (accueil + `/evenements`) | `notSourceKey: true` + filtre `links.organizer.6146059c9348791eac133dd1` — les events du réseau appartiennent au costum `communLundi`, pas à `relief` (cf. §8) |

---

## 4. Cahier des charges (intégré)

— Pas de CDC formel connu à ce jour. Le cadrage implicite est « l'équivalent régional du portail
national, sur le périmètre RELIEF ». Budget, phasage et exigences client : **à confirmer**.

---

## 5. Modèle de données réel

Mesures du **14/08/2026** sur la base locale (lecture seule, Mongo `communecter`) :

| Fait | Valeur | Requête |
|---|---|---|
| Périmètre costum (union serveur) | **522 orgas** | `$or [source.keys: relief, reference.costum: relief]` |
| — dont créées sur le site | 12 | `source.keys: "relief"` |
| — dont référencées | 513 (3 d'intersection) | `reference.costum: "relief"` |
| — taguées `TiersLieux` | 512/513 référencées | l'org RELIEF elle-même porte `RéseauTiersLieux`, pas `TiersLieux` |
| Tag `TiersLieux` national (comparaison) | 4 319 | dont 533 en `address.level3Name: "Auvergne-Rhône-Alpes"` |
| Membres du réseau | **548** (citoyens + orgas) | `links.memberOf.6146059c…` |
| Événements du réseau | **7** (6 passés, 1 à venir le 07/09/2026) | `links.organizer.6146059c…` — tous « Accueil Outils Numériques Relief » sauf une réunion de 2022 |
| Événements portés par le costum | **0** | `reference.costum`/`source.keys` = relief sur `events` — d'où le fix agenda `bf4c195e` |
| Citoyens / projets / POI au costum | 0 / 0 / 0 | `reference.costum: "relief"` |
| Costum `relief` en base locale | **absent** | `db.costum` : 65 documents, aucun `slug: "relief"` |

**Encodage** : les `address.level4Name` du périmètre sont hétérogènes (`RHONE`, `RHôNE`, `Rhône`,
`ISèRE`, `ISERE`, `Isère`…). L'observatoire s'en protège en groupant par **code** (`keyPaths:
["address.level4"]`) — 13 territoires sortent (12 départements + Métropole de Lyon). Toute
nouvelle dimension géographique doit suivre ce patron, jamais le libellé seul.

**Costum backend** : marqueurs `mainTag: "TiersLieux"` + `compagnon`, formulaire `tiers-lieux`
(costumForm, `entityType: organizations`, stamps de tags via `$costum`), garde d'édition `when`
sur `profiles.organizations` bornant la modale au périmètre (`sourceKeys` ∪ `reference.costum`
contient `relief` ; repli `horsPerimetre: edit-profile`, visible dans la fixture `__effective__`).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.relief.json`](../config.prod.relief.json) (9 pages, 19 sections, 1 costumForm, 6 profils, commandPalette, FAB) |
| CSS / identité | [`../src/index-relief.css`](../src/index-relief.css) · `public/images/relief/` (logo ×3, favicon, 5 visuels de contenu) |
| Multi-site / déploiement | `sites.json` (entrée `relief` : css, images, `coolifyApp`, `domain`, `env`) |
| Moteur touché par le projet | `src/modules/agenda/lib/buildAgendaParams.ts` + `src/modules/agenda/schema.ts` (passthrough `notSourceKey`, `bf4c195e`) |
| Tests | `tests/preflight/__effective__/relief.json` (fixture des menus/gardes effectifs, consommée par `tests/preflight/stamps.test.ts`) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Dériver de `config.prod.tiers-lieux.json` | Même costum-mère (`mainTag: TiersLieux`, même compagnon, mêmes formulaires nationaux) ; seul le périmètre change |
| `sourceKey: ["relief"]` partout, `notSourceKey` retiré (×10) | Le périmètre costum doit s'appliquer (522) au lieu d'être court-circuité — tiers-lieux fait l'inverse car il est national |
| Retraits **mesurés, pas supposés** | Pages réseaux régionaux/thématiques (tag `RéseauTiersLieux` : 0/522), variant `navigator-tl` + service-pricing + module ampli (5 formulaires navigator : 0 réponse au périmètre), filtre pays (522/522 France), portage « Universités/Écoles » (0) |
| Conservations mesurées vivantes | `franceTierslieux` (218 réponses non vides au périmètre — activité + équipement de fiche), `lesCommuns` (4 et 2) → `/usages` conservé |
| Agenda : `notSourceKey` + `links.organizer` | Les events du réseau appartiennent au costum `communLundi` — aucun ne porte la provenance `relief`. Le filtre par lien seul, intersecté avec un périmètre vide, donnait 0 : il fallait désactiver le périmètre. Le module agenda ne relayait pas `notSourceKey` → passthrough ajouté (impact nul ailleurs : aucun autre site ne le pose) |
| Observatoire à la maille **département** | Après retrait des dimensions région/pays (périmètre mono-région, mono-pays), 9 consommateurs orphelins purgés ; 13 territoires = la maille utile d'un réseau régional |
| Identité mint `hsl(152, 56%, 40%)` + slate | Palette du costum transposée (hue 182 → 152, `#63bf94`) ; le jaune reste sémantique `warning` |
| `logoDark` câblé | Wordmark slate invisible en mode sombre ; swap CSS sans flash SSR. Favicon recadré du wordmark car le favicon officiel du costum est en 404 |
| FAB `add-tiers-lieux` avec `condition.auth: required` | L'ajout d'un lieu passe par le formulaire costum, connecté uniquement (pas de dead-end : modale de login) |

---

## 8. Étapes de mise en place

1. ✅ Config + CSS + images (`27d50412` → `bf4c195e`, 12/08).
2. ✅ Entrée `sites.json` complète (14/08) : `coolifyApp: "site-json-relief"`, `domain:
   "aura.00.re"`, `env.VITE_COSTUM_FORCE_LIVE: "true"` — indispensable tant que le costum
   `relief` n'est pas dans la base cible (cf. §12).
3. ❌ **Merge de `feat/relief-config` dans `main`** — la branche a 5 commits d'avance (14/08).
4. ❌ **Déploiement Coolify + DNS `aura.00.re`** — à confirmer (rien dans le dépôt ne prouve un
   déploiement effectué).
5. ❌ Vérification navigateur post-déploiement (cf. `[[project-verif-css-navigateur]]` : backend
   requis, pièges de mesure).

---

## 9. Impacts des modifications

### 9.1 `7d90bfd8` (12/08) — observatoire purgé de ses dimensions fantômes

Le retrait des dimensions `region`/`pays`/`equipements` avait laissé 9 consommateurs en place,
affichés sans jamais rien tracer : KPI « Régions » et graphique « Répartition par région » →
département ; graphiques « Par pays » et « Équipements déclarés (PoC CoForm) » retirés ; table
Région→Département, colonne Pays retirée ; filtres 7 → 5. Rendu vérifié : 13 départements AURA,
plus aucun libellé orphelin. Gates au commit : validate-config OK, préflight 468/468.

### 9.2 `bf4c195e` (12/08) — agenda rattaché par lien

`/evenements` affichait 0 (cf. §7). Changements : `AgendaBaseParams`/`fromBaseParams` relaient
`notSourceKey` (le schéma annonçait déjà « même convention que `searchProStatic.baseParams` ») ;
les deux agendas de la config passent en `notSourceKey` + filtre `links.organizer`. Mesuré sur le
legacy :5080 : 0 avant, 7 après. Gates au commit : typecheck OK, préflight + agenda 491/491.
**Régression à surveiller ailleurs : aucune** (aucun autre site ne pose `notSourceKey` en agenda).

### 9.3 Validation (gates) — rejoués le 14/08 sur `feat/relief-config`

| Gate | Résultat |
|---|---|
| `config:validate config.prod.relief.json` | ✅ 9 pages, 19 sections |
| `audit:config` (volet relief) | 🟡 **1 constat** : `header.nav.4.children.2.path` — « Décider ensemble » en lien `#` inerte ; theme:complet, 0 trad manquante |
| `typecheck` (`tsc -b`) | ✅ |
| `test:unit` | ✅* 2 348/2 350 puis 2 332/2 333 — seul `tests/preflight/archetypes.test.ts` (gate de fraîcheur des archétypes, sous-processus `audit:config`) flanche **sous charge de la suite complète** et passe 3/3 rejoué isolément. Flake d'infra, sans lien avec relief |
| `lint` | ✅ 0 erreur (20 warnings `react-hooks/preserve-manual-memoization` connus, cf. `[[project-lint-react-compiler-rules]]`) |
| `build` | ✅ client + serveur, 1 min 06 (14/08) |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Accueil (hero-search + carte teaser + agenda teaser + éditorial outils) | ✅ | CTA pré-filtrés cohérents avec les options de `/lieux` (vérifié 14/08 : 0 désaccord de valeurs) |
| 2 | `/lieux` — filtres + liste (522) | ✅ | typologies (8) + départements ; `defaultOpenGroups` |
| 3 | `/observatoire` — 7 dimensions, 5 KPI, 4 graphiques | ✅ | corrigé `7d90bfd8` |
| 4 | `/communaute` — membres du réseau | ✅ | 548 membres (14/08) |
| 5 | `/evenements` + teaser accueil | ✅ | corrigé `bf4c195e` — mais 1 seul event à venir (07/09), cf. §13 |
| 6 | `/usages` — catalogue d'outils | ✅ | formulaire national Les Communs (`636cd563…`) |
| 7 | Pages légales ×3 | ✅ | mentions, confidentialité, CGU |
| 8 | Ajout d'un tiers-lieu (FAB + costumForm) | ✅ | garde d'édition au périmètre ; **non testé en navigateur connecté** — à confirmer |
| 9 | Auth (login/register/recover) + commandPalette | ✅ | variant `default` ; palette sur 4 types d'entités, `sourceKey: ["relief"]` |
| 10 | Nav « Décider ensemble » | ❌ | lien `#` inerte — destination à arbitrer (§14) |
| 11 | Merge dans `main` | ❌ | 5 commits d'avance |
| 12 | Déploiement aura.00.re | ❌ | entrée Coolify posée le 14/08, déploiement à confirmer |

---

## 11. Dépendances SDK ↔ cocolight-api-client

Aucune demande SDK propre à ce projet. Le besoin `notSourceKey` de l'agenda était côté **module
SiteForge** (passthrough), pas côté SDK. Le projet hérite du SDK `1.0.184` (bump `c12f2e43`,
chantier tiers-lieux — incluant `normalizedName`, dont profite `/usages`).

---

## 12. Points d'attention / limitations

1. **Costum `relief` absent de la base locale** : `db.costum` n'a pas de document `slug: relief`
   (14/08). En dev local comme en prod sur cette base, tout ce qui lit la config costum ne
   fonctionne que via `VITE_COSTUM_FORCE_LIVE=true` (posée dans `sites.json` pour Coolify).
   Vérifier ce que fait le site si la récupération live échoue.
2. **Agenda vivant par un seul fil** : seuls les events liés `organizer` → org RELIEF
   apparaissent. Un événement créé depuis le site sans ce lien (il porterait `source.keys:
   relief`) sera **invisible** de l'agenda, qui est en `notSourceKey`. Consigne de saisie ou
   évolution à prévoir.
3. **Agenda maigre** : 7 events dont 1 seul à venir (07/09/2026) — la page et le teaser d'accueil
   paraîtront vides entre deux « Accueil Outils Numériques ».
4. **Lien nav inerte** : « Se gouverner → Décider ensemble » pointe sur `#` (seul constat d'audit).
5. **Libellés de départements hétérogènes en base** (`RHONE`/`Rhône`/`ISèRE`…) : l'observatoire
   groupe par code `level4` (sain), mais tout affichage direct de `level4Name` (recherche,
   cartes) peut exposer ces graphies. Correctif = donnée backend, pas config.
6. **`/usages` dépend du national** : le catalogue lit le formulaire Les Communs national ; le
   filtrage « lieux du périmètre » dans le détail d'un outil repose sur `normalizedName`
   (cf. bug des 61 % corrigé côté tiers-lieux, `[[project-tiers-lieux]]`).
7. **Config jamais parsée par Zod au runtime** (`[[project-zod-defaults-never-applied]]`) : toute
   clé nouvelle doit être écrite explicitement dans le JSON.

---

## 13. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| Destination de « Décider ensemble » (outil de décision du réseau ? page à créer ?) | RELIEF / à confirmer |
| Le déploiement Coolify `site-json-relief` → aura.00.re a-t-il été lancé ? DNS posé ? | Thomas |
| CDC / budget / phasage formels du projet | Thomas / RELIEF |
| Chef de projet côté réseau RELIEF | à confirmer |
| Politique de saisie des événements (lien `organizer` obligatoire ? cf. §12.2) | RELIEF |
| Le favicon officiel du costum est en 404 sur le legacy — le signaler au réseau ? | Thomas |
