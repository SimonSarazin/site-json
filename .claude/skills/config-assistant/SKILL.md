---
name: config-assistant
description: Génère et édite les configs JSON de sites SiteForge (créer un site complet, ajouter/modifier des pages ou sections, choisir header/footer/thème, activer des modules, changer le slug d'entité). À utiliser dès qu'on demande de créer un site, modifier un config.prod.*.json, ajouter une section/page, ou ajuster le design d'un site via sa config.
---

# Assistant de config SiteForge

Tu génères/édites des configs de site **pilotés par le schéma Zod réel** —
jamais de mémoire. Design complet : [doc/26-assistant-config.md](../../../doc/26-assistant-config.md).

## Règle d'or : dériver, ne pas réciter

Les faits volatils se LISENT à l'usage, ils ne sont pas écrits ici :

| Besoin | Commande |
|---|---|
| Liste des sections + description | `npm run config:schema sections` |
| Forme exacte d'une section | `npm run config:schema section:<type>` (ex. `section:pricing`) |
| Forme de `header`/`footer`/`theme`/`meta`/`auth`/`page`/`profiles`/`integrations` | `npm run config:schema <bloc>` |
| Forme d'un document de **form costum** (`config.costumForms.<id>`) | `npm run config:schema costumForm` |
| Forme du bloc **admin** (`config.admin` — back-office /admin, cf. doc/30) | `npm run config:schema admin` |
| Squelette de form costum (artefact build-time) | `npm run config:costum -- <slugCostum> <collection> --format costumForm` |
| Squelette de form costum depuis le costum RÉEL en base (tout costum) | `CONFIG_LIVE_BACKEND=… CONFIG_LIVE_EMAIL=… CONFIG_LIVE_PWD=… npm run config:costum -- <slugCostum> <collection> --format costumForm --live` |
| Squelette du bloc **admin** dérivé du site (types gérés) | `npm run admin:scaffold -- <config.prod.X.json>` (`--write` pour insérer, `--force` pour remplacer) |
| Valider UN config (boucle de correction) | `npm run config:validate -- <fichier.json>` |
| Chercher / vérifier un slug d'entité | `npm run entity:slug -- search <nom>` / `check <slug>` |
| Qualité (liens morts, i18n, thème) | `npm run audit:config` |
| Validation finale stricte | `npm run test:preflight` |

**En cas de contradiction entre ce fichier et le code : le code a raison.**
Vérifie via les scripts, puis propose une mise à jour de cette skill (§ Maintenance).

## Workflow

1. **Interview** (si nouveau site) : nom, langues, pages voulues, ton/couleurs,
   features (recherche ? actus ? formulaires ? cagnotte ?), **assets disponibles**
   (logo ? photos ?).
2. **Conception design** : propose **2-3 directions argumentées** (archétype le
   plus proche, header/footer, composition de pages, direction de thème) —
   **l'utilisateur tranche avant de générer**. Appuie-toi sur les tables ci-dessous
   et sur `config:schema sections` pour composer les pages.
3. **Slug** : `npm run entity:slug -- check <slug>` — prérequis DUR : le slug de
   `sites.json` charge AUSSI l'entité Cocolight au boot ; sans entité, le site ne
   démarre pas. (`search <nom>` pour trouver l'existant ; la création d'entité
   exige une auth → faire créer in-app, cf. point ouvert doc/26.)
4. **Setup** : partir du config archétype le plus proche (jamais d'une page
   blanche) ; entrée `sites.json` `{slug, config, css}` ; dossier
   `public/images/<slug>/` ; CSS : réutiliser un `src/index-<theme>.css` existant
   (les couleurs vivent dans `config.theme`, pas dans le CSS — cf. § Thème).
5. **Génération PAR MORCEAU** (jamais le config entier d'un coup) :
   `meta`+`theme` → `header`/`footer` → page par page. Avant chaque morceau :
   `config:schema` pour la forme ; après : `config:validate` → corriger → re-valider.
6. **Gates qualité** : `npm run audit:config` puis `npm run test:preflight`.
7. **Préversion live** : `VITE_SLUG=<slug> npm run dev` — le watcher pousse chaque
   écriture du config au navigateur sans reload. ⚠️ Utiliser le slug de
   `sites.json` (ex. `rezoLaMer`), PAS le nom du fichier config : un slug inconnu
   retombe silencieusement sur le site par défaut.
8. **Édition incrémentale** (cas le plus fréquent) : localiser le morceau
   (page/section), `config:schema` si besoin, patch minimal, valider, HMR.

## Mode réparation : partir d'un audit

Pour corriger/améliorer un config existant :

1. `npm run audit:config -- --file <x.json> --json` — chaque constat porte
   `{category, path, message, severity, fixability}`.
2. **Classer par `fixability`** et présenter un PLAN priorisé — l'utilisateur
   valide avant toute écriture :
   - `auto` (mécanique, ex. `cle-strippee`, `locale-extra`) → un lot d'un coup ;
   - `proposer` (jugement, ex. `lien-mort` : typo ? page à créer ? à retirer ?
     `asset-manquant` : corriger le chemin ou fournir le fichier ? `theme` :
     playbook migration rezo-la-mer 90b5200) → proposer la correction, choisir ;
   - `suggestion` → opt-in explicite.
3. **Corriger par LOTS — un lot = un commit relisible**, ordre : schéma →
   assets/liens → clés mortes → i18n → améliorations. `config:validate` après
   chaque lot.
4. **Traductions** : tu les écris directement, mais TOUJOURS en lot séparé
   présenté pour relecture au diff — jamais mélangées à du mécanique.
5. **Constats assumés** (choix délibérés) : `.audit-baseline.json` à la racine
   (versionné) — `{ "<config>.json": [{ "category", "path" }] }`. Un constat
   assumé n'échoue pas `--strict`. N'y mettre que ce que l'utilisateur assume
   explicitement.
6. Re-audit → vert (ou assumés) ; `--strict` comme gate final.

⚠️ Une `cle-strippee` a TROIS lectures possibles — vérifier avant de purger :
1. **config mort** (aucun consommateur) → purge ;
2. **trou de schéma** (clé lue par un composant — le runtime ne strip pas,
   seul le schéma l'ignore) → compléter le schéma, pas purger ;
3. **clé transmise au backend** via un payload pass-through (`filtersByAnswers`
   → `coformFiltersSearch(searchedData)`, `baseParams`… sont envoyés TELS
   QUELS) → seul un **appel A/B réel** (avec/sans la clé, comparer les
   réponses) prouve que le backend l'ignore. Précédent : `domGroup`
   (héritage costum) — envoyé, ignoré (réponses byte-identiques), purgé.

## Tables de design (semi-stables — vérifiées par le test `skill-integrity`)

### Headers (`header.type`)

| type | identité | champs spécifiques |
|---|---|---|
| `standard` | barre horizontale sticky, fond plein, dropdowns | `height`, `announcement` |
| `mega-menu` | méga-menu au survol en colonnes | `nav[].megaMenu` |
| `transparent-scroll` | transparent sur le hero → opaque au scroll | `transparent`, `urgenceButton`, `ctaButton` |
| `minimal` | barre compacte, typo uppercase espacée | `logoTitle`, `logoIcon` |
| `underline-nav` | nav soulignée animée, fond marqué | `piggyBank`, `urgenceButton`, `ctaButton` |
| `transparent-dark` | barre sombre fixe (teinte : token `--header-bar`) | `logoTitle`, `entityLogoOverride` |

### Footers (`footer.type`)

| type | identité | champs spécifiques |
|---|---|---|
| `rich` | newsletter + colonnes + socials | `newsletter`, `columns[]`, `socials[]` |
| `minimal-centered` | logo centré + nav + légal | `columns[0].links`, `legalLinks` |
| `sidebar-columns` | sidebar (logo+desc+socials) + colonnes | `style: "plain"\|"card"` |
| `contact-partners` | bloc contact + logos partenaires | `contactSection`, `partners.logos[]` |

### Modules (recette d'activation)

| module | surface | clés JSON | prérequis backend |
|---|---|---|---|
| `search` | sections `searchPro`/`searchProStatic`/`filters`/`searchHeader`/`cardCountCT`/`thematics` | `baseParams` (`sourceKey`…), `list` (card/detailsMode/preview), `map` (`itemAction`/`marker`), `filters[].select`/`optionStyle`/`order` (widgets par groupe) | données indexées (sourceKey) ; carte : fond MapTiler via env `VITE_MAPTILER_API_KEY` (sinon repli OSM/Carto) + `integrations.map.styleLight/Dark` |
| `agenda` | section `agenda` (vues liste/calendrier/carte/split) | `baseParams`, `filters` (text/type/tags), `defaultMode`/`tabs`/`detailsMode`, `enableMap`/`map` | événements indexés (`searchEventsCostum`) |
| `news` | section `news` | `props.entitySlug`, `maxItems` | fil d'actus de l'entité |
| `coform` | routes `/coform` | réf. de formulaire | CoForm défini côté backend |
| `cagnotte` | sections `actions`/`finance`/`*-summary` | `idProjet` | projet + Stripe/HelloAsso |
| `profil` | `/profil/:slug`, section `member` | `config.profiles` (tabs, editModal) | types d'entités |
| `auth` | `loginForm`/`registerForm`/`recoverPasswordForm`, `<AuthMenu>` | `config.auth`, `header.utilities.auth` | comptes/SSO Communecter |
| `notification` | cloche header, section `notifications` | `header.utilities.notifications` | notifications backend |
| `commandPalette` | palette ⌘K | `config.commandPalette`, `header.utilities.search` | — |
| `ampli` | routes ampli | `config.ampli` | campagne ampli |
| `interop` | pods Discourse/Mediawiki | clés interop | instances externes |
| `observatoire` | section `data-observatory` (dashboard déclaratif : dimensions, KPI, charts, table, filtres) | `props.baseParams` (périmètre) + `dimensions`/`filters`/`kpis`/`charts`/`table` | données indexées (sourceKey + type) |
| `formEngine` | modales costum **add/edit pilotées par données** (moteur de formulaire générique) | `config.costumForms.<id>` (document `CostumFormSchema`) + déclencheur `floatingActionButton.modal:"add-<id>"` / `profiles.<type>.editModal:"edit-<id>"` | entité costum porteuse (`costumSlug`) ; clés read/write/scope déjà enregistrées (sinon `fns.ts`) — cf. § Formulaires costum |
| `admin` | page `/admin` config-driven (onglets Membres/Contenu/Import-Export/Validation) | `config.admin` (`tabs[].sections[]`, `access.min`) | endpoints admin (`getMembersAdmin`, import/export, `validategroup`…) ; accès siteAdmin/superAdmin — cf. commentaire/plan-module-admin-generique.md |

**Refuse d'activer un module dont le prérequis backend n'est pas confirmé**
(ex. pas de `searchPro` sans `sourceKey` réel).

## Formulaires costum (`config.costumForms`)

Une modale **add+edit d'une entité scopée costum** (tiers-lieu, équipement sportif…) se déclare **EN DONNÉES**
dans `config.costumForms.<id>` — aucun composant ni schéma TS. Mécanisme, forme du document et recette
canonique : **[doc/28-module-formengine.md](../../../doc/28-module-formengine.md)** (couche 3). Forme
introspectable (règle d'or « dériver ») : `npm run config:schema costumForm`.

**Recette d'un costum « simple » (0 code)** — possible UNIQUEMENT si le formulaire ne référence que des clés
**déjà enregistrées** (codecs/scope/validate partagés : `address:read/write`, `openingHours:read/write`,
`social:read/write`, `geo:write`, `image:profilUrl`, `monthYear`, `validateFn:"addressComplete"`…) :

1. **Le document** `config.costumForms.<id>` = un `CostumFormSchema`. Obligatoire : `id` (= `<id>`), `entityType`
   (`organization|project|event|poi|citoyen`), `layout` (`{kind:"wizard"|"tabs"|"flat"}`), `sections`, `fields`
   (chaque champ : au moins `widget`), `chrome.title.{add,edit}`, `mutation.entityType`. Recommandé : `costumSlug`
   (slug du costum porteur — sert au create), `icon`, `submitLabel`. Laisser `payloadFn`/`defaultsBase` ABSENTS
   = pipeline générique (read/write/defaults dérivés des widgets).
2. **Déclencher l'ajout** : `floatingActionButton.modal = "add-<id>"` (ou un bouton de section `modal:"add-<id>"`).
3. **Déclencher l'édition** : `profiles.<entityTypePluriel>.editModal = "edit-<id>"`, + `editModalMatch`
   (`{champ_serverData: valeur}`) si plusieurs sous-types partagent le même `entityType`. La résolution
   `add-/edit-<id>` → table runtime est **automatique** (aucune entrée hardcodée à ajouter).
4. **Valider** : un test qui appelle `registerCostumForm(doc)` (cf. `costumFormRegistry.test.ts`) joue
   `CostumFormSchemaZod` (structure) **puis** `assertCostumKeysRegistered` (existence des clés). Une clé citée
   (`read`/`write`/`enumFrom`/`scope.derive`/`payloadFn`/`validateFn`/`slots`…) non enregistrée **lève une erreur
   claire au load** (nom de la clé + où la définir), plus de `console.warn` silencieux au rendu. Si la garde
   pointe une clé absente → c'est une clé **métier** → il te faut un `fns.ts` (voir ci-dessous).

**Point de départ GÉNÉRÉ (recommandé)** : `npm run config:costum -- <slugCostum> <collection> --format costumForm`
émet un `CostumFormSchema` complet et VALIDE (auto-vérifié zod + clés partagées uniquement) depuis la
connaissance costum de la lib. Ajoute `--live` (+ env CONFIG_LIVE_BACKEND/EMAIL/PWD) pour partir du costum
RÉEL en base (getcostumjson) — couvre TOUT costum, même absent de l'artefact bundlé (lib ≥ 1.0.164). Contenu : sections base+costum, widgets déduits des types, pattern adresse
(groupe + codecs), image de profil, mutation/invalidation standard, presets → `mutation.inject.extraFields`.
Ce squelette se pose tel quel dans `config.costumForms.<id>` puis s'ENRICHIT conversationnellement — les
5 écarts attendus vs un costum fini : (1) layout `flat` → `wizard`/groups/colonnes ; (2) labels humanisés →
libellés fr/en curés ; (3) `text`/`tags` → `selectFromLists`/`urlList`/`checkboxGroup` selon le sens métier ;
(4) scope/type dérivés (`scope.derive` métier) + masquage des champs stampés ; (5) `visibleIf`/`computedFrom`/
`cleanValues` métier. Le préflight `tests/preflight/costum-forms.test.ts` re-valide tous les costumForms du
repo (zod + garde des clés) à chaque run.

**Quand il faut du code (PAS 100 % config)** : transfo métier inédite (`payloadFn` propre), `scope` dérivé,
defaults structurés, **slot React** (placé par `"$slot:<id>"` dans `sections`), codec `serializeGroup` inédit,
`validate` cross-champ inédit. Créer alors `src/modules/profil/forms/costum/<id>/fns.ts`
(`registerXxx("clé", impl)`) + l'ajouter au barrel `registerSpecFns.ts`.

> **Clés génériques garanties** : les clés « partagées » (codecs/coercions/geo/validators/`image:profilUrl`/
> `cleanValues:*`/`invalidate:standard`) sont enregistrées inconditionnellement par le barrel
> `forms/costum/sharedRegistrations.ts` (importé par `registerSpecFns` et par le loader `registerCostumForms`
> avant toute compilation) — un costum 100 %-config qui ne réutilise que ces clés se compile sans dépendre
> d'aucun costum métier. Toute clé MÉTIER manquante est signalée par la garde du loader (cf. point 4).

## Administration (`config.admin`)

Le back-office `/admin` (gestion membres/contenu/import-export/référencement/modération) est 100 %
config-driven — référence : **[doc/30-module-admin.md](../../../doc/30-module-admin.md)**. PAS de
dérivation runtime : le bloc se GÉNÈRE explicitement puis se personnalise.

1. **Squelette** : `npm run admin:scaffold -- <config> [--write]` — dérive les onglets des types
   gérés par le site (`profiles.addConfig` ∪ `costumForms.entityType`), auto-validé par le schéma.
2. **Personnaliser** : colonnes (`columns` : `"chemin"` ou `{path,label}` localisé), `rowActions`/
   `bulkActions`, filtres `source` (mêmes `baseParams` que searchProStatic), `access` par
   page/onglet/section (`superAdmin`|`siteAdmin`|`entityAdmin`), `condition` (VisibilityCondition).
   Forme exacte : `npm run config:schema admin`. ⚠ `status.*` = contrat futur (ne pas configurer),
   l'export est réservé super-admin (plancher backend).
3. **Valider + voir** : `config:validate` (le discriminatedUnion attrape toute section fautive avec
   l'erreur précise) puis préversion `/admin` (l'entrée apparaît dans le menu avatar + Ctrl+K pour
   les admins du carrier).

## Règles maison

- `header.type` / `footer.type` / `card.type` / `preview.type` / types de
  section = **noms de DESIGN, jamais de site** (doc/03, doc/07).
- `LocalizedString` : `fr` obligatoire ; couvrir toutes les langues de
  `meta.languages` (audit:config le vérifie).
- Chemins internes : doivent exister dans `pages[].path` ou les routes de
  modules (`/profil`, `/login`, `/coform`…) — **aucun chemin inventé**.
- **Aucune URL d'image inventée** : asset fourni (copié dans
  `public/images/<slug>/`, référencé en absolu `/images/<slug>/…`), asset
  existant, ou rien. Sans logo : `logoIcon` (nom Lucide ou SVG inline).
- Valeurs de filtres/variants : pas de virgule dans une valeur de filtre
  (format URL `?param=v1,v2` partagé avec les sidebars).

## Thème

- **Les couleurs vivent dans `config.theme.colors.{light,dark}`** (injectées au
  runtime par `SiteTheme`, rendu SSR) — modèle prouvé par
  `config.prod.equipements-Sportifs.json` et la famille rezo-la-mer. Forme :
  `npm run config:schema theme`. Toujours fournir **light ET dark**.
- Le CSS de thème (`src/index-<theme>.css`) ne porte que le mapping
  `@theme inline`, d'éventuelles vars bespoke et les utilities — plusieurs
  configs peuvent **partager** un même CSS et diverger par `config.theme`.
- Les effets génériques (ombres, glow, animations, `--header-bar`,
  `--hero-tint`, `--gradient-section`) viennent de `src/styles/shared.css`
  (tokens par défaut) — un thème les surcharge en `:root`/`.dark`, on ne
  recopie JAMAIS de classe.

## Maintenance (anti-dérive)

- Le test préflight `skill-integrity` croise les tables ci-dessus avec le code
  (enums header/footer, modules, scripts) : s'il échoue, **mets cette skill à
  jour, pas le test**.
- Sur demande « mets-toi à jour » (ou si tu détectes une dérive) : analyse les
  commits récents touchant `src/types/site-schema.ts`, `src/modules/*/`,
  `src/components/admin/section-meta.ts`, `sites.json`, mets à jour les tables
  semi-stables de ce fichier et propose le diff.
