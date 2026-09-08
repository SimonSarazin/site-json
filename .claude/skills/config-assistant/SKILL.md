---
name: config-assistant
description: Génère et édite les configs JSON de sites SiteForge (créer un site complet, ajouter/modifier des pages ou sections, choisir header/footer/thème, activer des modules, changer le slug d'entité). À utiliser dès qu'on demande de créer un site, modifier un config.prod.*.json, ajouter une section/page, ou ajuster le design d'un site via sa config.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Assistant de config SiteForge

Tu génères/édites des configs de site **pilotés par le schéma Zod réel** —
jamais de mémoire. Design complet : [doc/26-assistant-config.md](../../../doc/26-assistant-config.md).

## Règle d'or : dériver, ne pas réciter

Les faits volatils se LISENT à l'usage, ils ne sont pas écrits ici :

| Besoin | Commande |
|---|---|
| **Amorcer un nouveau site** (config + sites.json + dossier images) | `npm run config:init -- <slug> --from <archétype> --pages /,/x [--dry-run]` |
| Clés RACINE d'un config (quels blocs existent, requis/optionnels) | `npm run config:schema root` |
| Liste des sections + description (groupée par famille) | `npm run config:schema sections` |
| Archétypes de référence (quel site imiter, ce qu'il démontre) + liste des exemples | `npm run config:example` |
| Exemple canonique d'un bloc réel (theme, command-palette, agenda, list-resource…) | `npm run config:example -- <feature>` |
| **Choix en cours dans une config** (listes figées, chaîne de rattachement…) — pose la question, ne juge pas | `npm run config:besoins -- <config>` · `-- --diff` en revue |
| **Depuis quand une clé existe, et qui l'a adoptée** | `npm run config:changelog key <nom>` · `since <config>` pour ce qui a bougé depuis |
| **Ce qui est possible et peu connu** (mécanismes jamais exercés, ou par un seul site — avec son nom) | `npm run config:changelog candidates` |
| **Composition de props réelle** d'une section / d'un header / d'un footer | `.design-sync/previews/<Composant>.tsx` (153 stories versionnées) — chemin exact imprimé en tête de `config:schema section:<type>`, et `◆` dans le catalogue `sections` |
| **Recette de composition de PAGE** (gabarit = une page réelle d'archétype) | `npm run config:example -- --recipe <id>` — imprime la page complète, prête à adapter |
| Forme exacte d'une section | `npm run config:schema section:<type>` (ex. `section:pricing`) |
| Forme de `header`/`footer`/`theme`/`meta`/`auth`/`page`/`profiles`/`integrations`/`commandPalette` | `npm run config:schema <bloc>` |
| Forme d'un document de **form costum** (`config.costumForms.<id>`) | `npm run config:schema costumForm` |
| Forme du bloc **admin** (`config.admin` — back-office /admin, cf. doc/30) | `npm run config:schema admin` |
| Squelette de form costum (artefact build-time) | `npm run config:costum -- <slugCostum> <collection> --format costumForm` |
| Squelette de form costum depuis le costum RÉEL en base (tout costum) | `CONFIG_LIVE_BACKEND=… CONFIG_LIVE_EMAIL=… CONFIG_LIVE_PWD=… npm run config:costum -- <slugCostum> <collection> --format costumForm --live` |
| Bundle MULTI-form (TOUS les sous-types d'un costum + routage `editModals`) | `CONFIG_LIVE_… npm run config:costum -- <slugCostum> [out.json] --all --live` |
| Squelette du bloc **admin** dérivé du site (types gérés) | `npm run admin:scaffold -- <config.prod.X.json>` (`--write` pour insérer, `--force` pour remplacer) |
| Valider UN config (boucle de correction) | `npm run config:validate -- <fichier.json>` |
| **Appliquer** des corrections en lot (chemins d'audit → valeurs) | `npm run config:fix -- <config.json> --set <patch.json> --dry-run` (aussi `--add-locale <l>` / `--strip-locale <l>`) |
| Chercher / vérifier un slug d'entité | `npm run entity:slug -- search <nom>` / `check <slug>` |
| Qualité (liens morts, i18n, thème) | `npm run audit:config` |
| **La config REND-elle ?** (SSR réel : sections déclarées vs rendues) | `npm run config:render -- <config.json>` |
| **Les données EXISTENT-elles ?** (chaque `baseParams` sondé sur le backend) | `npm run config:probe -- <config.json>` |
| Validation finale stricte | `npm run test:preflight` |

Pour PARSER une sortie (jq, extraire un sous-arbre, script), appeler
`npx tsx scripts/<x>.ts …` : `npm run` préfixe 4 lignes de préambule qui
cassent le JSON.

Les dumps `config:schema` portent la SÉMANTIQUE des props (`description` sur
les nœuds, registre `scripts/lib/prop-descriptions.ts`) et impriment en
commentaire les contraintes NON exportables (refinements, gates, précédences)
— lis-les avant de générer un bloc chaud (header, theme, search, agenda,
commandPalette, presenters).

**En cas de contradiction entre ce fichier et le code : le code a raison.**
Vérifie via les scripts, puis propose une mise à jour de cette skill (§ Maintenance).

## Répartition des rôles

Trois surfaces « config » coexistent — ne pas les confondre :

| Surface | Rôle | Quand |
|---|---|---|
| **Cette skill** | génération/édition interactive d'UNE config (conversation, patchs, validation) | créer un site, modifier pages/sections/design, réparer un audit |
| **`npm run audit:config`** | vérité mécanique ponctuelle (9 catégories, advisory ; `--strict` en gate) | avant/après toute édition ; alimente le Mode réparation |
| **Agent `siteforge-config-auditor`** | audits de fond multi-configs, croisement config ⇄ code, rapports dans `commentaire/` | revue périodique du parc — PAS l'édition au fil de l'eau |

Les trois partagent `archetypes.json` (dossier de cette skill) comme
référentiel des configs de référence.

## Workflow

1. **Interview** (si nouveau site) : nom, langues, pages voulues, ton/couleurs,
   features (recherche ? actus ? formulaires ? cagnotte ?), **assets disponibles**
   (logo ? photos ?).
2. **Conception design** : propose **2-3 directions argumentées** (archétype le
   plus proche, header/footer, composition de pages, direction de thème) —
   **l'utilisateur tranche avant de générer**. Appuie-toi sur `archetypes.json`
   (dossier de cette skill) pour choisir l'archétype, sur les tables ci-dessous
   et sur `config:schema sections` pour composer les pages.
   **Compose depuis les recettes, pas depuis le catalogue** :
   `npm run config:example` liste 11 gabarits de page mesurés sur le parc
   (4 modèles de home + recherche, annuaire-grille, agenda, blog, éditoriale,
   observatoire, légale), chacun avec son « quand » et son « rythme » ;
   `-- --recipe <id>` imprime la page réelle correspondante. Repères du parc :
   la page MÉDIANE fait **2 sections** (une page n'a pas à être longue), le
   motif le plus fréquent est `searchHeader > searchProStatic` (×32), et une
   page éditoriale tient par l'ALTERNANCE des registres (frise → texte →
   cartes → FAQ → CTA), pas par l'empilement de `content`.
3. **Slug d'entité — prérequis DUR, en partie MANUEL** : le slug de
   `sites.json` charge AUSSI l'entité Cocolight au boot ; sans entité, le site
   ne démarre pas. Procédure :
   a. `npm run entity:slug -- search <nom>` (sans auth) → candidats existants ;
   b. si aucune entité : **l'utilisateur la crée lui-même** dans l'app ou
      Communecter (backend `VITE_BASE_URL_BACKEND`) — `entity:slug` n'a
      volontairement PAS de `create` (la création exige une auth) ; tu ne peux
      pas faire cette étape à sa place, demande-la explicitement ;
   c. `npm run entity:slug -- check <slug>` (exit 0) AVANT d'écrire `sites.json`.
4. **Setup — une commande** :
   `npm run config:init -- <slug> --from <archétype> --pages /,/x,/y --title "…"`
   (`--dry-run` d'abord). Elle écrit `config.prod.<slug>.json` (thème et chrome
   hérités de l'archétype, identité/CTA/contact de l'archétype RETIRÉS), l'entrée
   `sites.json` `{slug, config, css}` et `public/images/<slug>/`. Refuse un slug
   déjà pris ou un fichier existant. Le squelette sort **audit RAS**, avec des
   pages VIDES : les composer ensuite via les recettes (étape 2).
   CSS : par défaut celui de l'archétype — plusieurs sites peuvent partager un
   `src/index-<theme>.css`, les couleurs vivant dans `config.theme` (§ Thème).
5. **Génération PAR MORCEAU** (jamais le config entier d'un coup) :
   `meta`+`theme` → `header`/`footer` → page par page. Avant chaque morceau :
   `config:schema` pour la forme ; après : `config:validate` → corriger → re-valider.
6. **Gates qualité**, dans cet ordre — les deux derniers sont les seuls qui
   regardent le RÉEL, le reste ne juge que le fichier :
   `npm run audit:config` → `npm run test:preflight` →
   **`npm run config:render`** (chaque page rend-elle ses sections ? ~13 s,
   démarre le vrai serveur SSR) → **`npm run config:probe`** (chaque
   `baseParams` ramène-t-il des résultats ? ~1 s, backend requis).
   Puis dérouler la **Checklist de maturité** ci-dessous.
7. **Préversion live** : `VITE_SLUG=<slug> npm run dev` — le watcher pousse chaque
   écriture du config au navigateur sans reload. ⚠️ Utiliser le slug de
   `sites.json` (ex. `rezoLaMer`), PAS le nom du fichier config : un slug inconnu
   retombe silencieusement sur le site par défaut.
8. **Édition incrémentale** (cas le plus fréquent) : localiser le morceau
   (page/section), `config:schema` si besoin, patch minimal, valider, HMR.

## Checklist de maturité (avant de livrer)

Signature d'une config aboutie, extraite du parc réel (les configs de référence
la cochent toutes). Les points 1-2 sont mécaniques, le reste est un choix de
site à confirmer avec l'utilisateur — ne PAS l'imposer à une petite vitrine :

1. **Audit RAS** : `npm run audit:config -- --file <config> --json` sans constat
   (ou assumés) — couvre i18n (`trad`/`locale-extra`), assets, liens et ancres,
   `theme` complet (`colors.light` ET `dark`), `baseParams` sur chaque
   searchPro/searchProStatic/agenda (avec `sourceKey` réel), et les échecs
   SILENCIEUX : `ref-morte` (`modal`/`editModal` sans `costumForms` →
   bouton qui rend `null`), `icone-inconnue` (nom hors catalogue lucide →
   icône invisible), `ancre-morte`.
2. **Préflight vert** : `npm run test:preflight` (schéma strict + invariants +
   gates archétypes).
2bis. **Ça rend et il y a des données** : `config:render` sans page en échec
   (une config valide peut servir une page blanche en HTTP 200) et
   `config:probe` sans périmètre VIDE (une faute de frappe dans un `sourceKey`
   livre une page de recherche déserte). ⚠ `config:probe` sur une config
   ABSENTE de `sites.json` hérite du `VITE_SLUG` du `.env` : le verdict porte
   alors sur un autre site — passer `--slug` (l'outil l'avertit).
3. **Modules à la hauteur du besoin** : `commandPalette` (+ `entitySearch`,
   `iconRules`, `itemActionBySubType` si entités hétérogènes), `auth`,
   `profiles` par type d'entité, `admin`, `costumForms`, `blog` — selon le site.
4. **Presenters câblés** : `list.card.type` + `list.preview.type` choisis pour
   la donnée (pas le fallback `default` par accident) ; blocs
   `list.testimonial`/`list.resource` renseignés pour les presenters typés.
   Liste **hétérogène** (plusieurs familles dans la même grille) ⇒ `list.itemRules`
   + `baseParams.defaultFields` couvrant tous les champs testés par les `when`.
   Disposition : `list.layout: "timeline"` (frise verticale à bulles-dates, carte
   dédiée événement) remplace la grille — à coupler à `defaultSortBy {"startDate": -1}` ;
   défaut CÔTÉ CODE = grille.
5. **Sections raisonnées** : 8-18 types dont des « premium » (`data-observatory`,
   `agenda`, `hero-*`, `features-glass`) — pas 5 sections génériques.
6. **Visibilité conditionnelle** (`condition`/`visibleIf`/`role`) là où le
   contenu est privé ou réservé.

## Mode réparation : partir d'un audit

Pour corriger/améliorer un config existant :

1. `npm run audit:config -- --file <x.json> --json` — chaque constat porte
   `{category, path, message, severity, fixability}`.
   Chaque constat porte de quoi AGIR sans rouvrir le fichier : `value` (la
   valeur fautive), `sibling` (pour un `trad` : les traductions déjà présentes —
   traduis depuis `fr` directement), `groupKey` (les 68 `locale-extra` d'une
   config = **1 décision**, pas 68 corrections).
2. **Classer par `fixability`** et présenter un PLAN priorisé — l'utilisateur
   valide avant toute écriture. Les corrections décidées s'appliquent EN LOT via
   `npm run config:fix -- <config> --set <patch.json>` (le patch est adressé par
   les chemins d'audit eux-mêmes ; revalidation Zod avant écriture, `--dry-run`
   pour voir le diff) :
   - `auto` (mécanique) → un lot d'un coup. ⚠ `locale-extra` n'en est PAS :
     ses deux issues (déclarer la locale dans `meta.languages` vs purger les
     valeurs) sont un ARBITRAGE — sur commune-transparente, purger détruirait
     68 vraies traductions. `config:fix --add-locale`/`--strip-locale` applique
     la décision une fois prise ;
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
   (**GITIGNORÉ** — état purement local, jamais partagé) — `{ "<config>.json":
   [{ "category", "path" }] }`. Un constat assumé n'échoue pas `--strict` en
   local. Pour un constat assumé PARTAGÉ sur une config **archétype** → le
   déclarer dans `knownFindings` d'`archetypes.json` (versionné, vérifié par le
   gate préflight). N'y mettre que ce que l'utilisateur assume explicitement.
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

## Archétypes & exemples canoniques

- `archetypes.json` (dossier de cette skill) désigne les configs de
  référence : **6 stables** — portail complet (`parent62`), portail réseau
  multi-sources (`navigatorDesTierslieux`), cartographie/observatoire
  (`saintpaulSport1`), vitrine éditoriale (`eXtremeDefiAdeme` — référence de
  composition, ses pages de données sont posées sur un costum quasi vide),
  annuaire adossé à
  un observatoire (`institutBleu`), annuaire compact complémentaire d'un site
  existant (`cyberReunion`) — et des
  **chantiers actifs marqués `wip`** (`equipementsSportifs974`,
  `sportSanteBienetre` : riches mais audit non garanti — s'en inspirer avec
  discernement). Le gate préflight `tests/preflight/archetypes.test.ts`
  garantit la fraîcheur des stables : présentes dans `sites.json`, audit sans
  constat autre que `knownFindings` (constats assumés, versionnés dans le
  manifest — à ne pas confondre avec `.audit-baseline.json`, gitignoré) ; les
  `wip` ne sont soumis qu'aux checks structurels tant qu'ils ne sont pas
  gradués (retirer `wip`).
- `examples/<feature>.json` = **snapshots versionnés** de blocs réels extraits
  des archétypes (theme, command-palette, agenda, list-resource,
  list-testimonial, admin, profiles, header-mega-menu…). Le même gate échoue
  si un snapshot dérive de sa config source → resynchroniser en conscience :
  `npm run config:example -- <feature> --write`.
- **Toujours partir d'un exemple canonique** (`npm run config:example -- <feature>`)
  plutôt que d'inventer la forme d'un bloc complexe.

## Tables de design (semi-stables — vérifiées par le test `skill-integrity`)

### Headers (`header.type`)

| type | identité | quand l'utiliser | champs spécifiques |
|---|---|---|---|
| `standard` | barre horizontale sticky, fond plein, dropdowns | défaut polyvalent sans hero plein écran (0/14 en direct — mais c'est lui que rend `default`) | `height`, `announcement` |
| `mega-menu` | méga-menu au survol en colonnes | portail à navigation riche/profonde (multi-réseaux) — ex. tiers-lieux | `nav[].megaMenu` |
| `transparent-scroll` | transparent sur le hero → opaque au scroll | hero visuel plein écran — le standard de fait du parc (10/14 configs) | `transparent`, `urgenceButton`, `ctaButton` |
| `minimal` | barre compacte, typo uppercase espacée | petite vitrine épurée — ex. julie-pot-vin | `logoTitle`, `logoIcon` |
| `underline-nav` | nav soulignée animée, fond marqué | identité marquée, communes/collectivités — ex. nos-commune | `piggyBank`, `urgenceButton`, `ctaButton` |
| `transparent-dark` | barre sombre fixe (teinte : token `--header-bar`) | site à dominante sombre — ex. commune-transparente | `logoTitle`, `entityLogoOverride` |
| `stacked` | 2 bandeaux sur image de fond : wordmark plein écran (~50vh) puis nav, collapse en barre compacte au scroll | identité "marque-territoire" forte, home sans section hero (le header EST le hero) — ex. parent62 | `backgroundImage`, `textColor`, `logoTitleAccent`, `logoSubtitle` |
| `default` | **alias, pas un design** : rend `HeaderStandard` | héritage — n'en produis JAMAIS pour un site neuf, écris `standard` | ceux de `standard` |

### Footers (`footer.type`)

| type | identité | quand l'utiliser | champs spécifiques |
|---|---|---|---|
| `rich` | newsletter + colonnes + socials | marketing complet avec newsletter (0/14 en direct, mais rendu sur 3/14 via `default`) | `newsletter`, `columns[]`, `socials[]` |
| `minimal-centered` | logo centré + nav + légal | discrétion maximale — ex. tiers-lieux | `columns[0].links`, `legalLinks` |
| `sidebar-columns` | sidebar (logo+desc+socials) + colonnes | identité + nav riche (5/14 configs) — ex. rezo-la-mer | `style: "plain"\|"card"` |
| `contact-partners` | bloc contact + logos partenaires | portail institutionnel avec partenaires (5/14) — ex. parent62 | `contactSection`, `partners.logos[]` |
| `default` | **alias, pas un design** : rend `FooterRich` | héritage (3/14 : commune-transparente, julie-pot-vin, nos-commune) — n'en produis JAMAIS pour un site neuf | ceux de `rich` |

### Presenters — cartes (`list.card.type`)

Dispatch : `src/modules/search/components/SearchCard.tsx` (clé = `card.variant || card.type`).

| type | rend | quand / options |
|---|---|---|
| `default` | carte sobre générique | fallback du schéma ; listes hétérogènes simples |
| `overlay` | image + contenu superposé | ⚠ défaut du PROP côté code (le schéma, lui, dit `default`) |
| `image-cover` | photo plein cadre, badges en coin | annuaires visuels ; `imageFit`, `overlayStats:"service-pricing"` + `servicePricing` |
| `event` | carte événement (icônes par tag) | listes d'événements hors module agenda |
| `event-featured` | événement vedette | mise en avant d'un événement |
| `funding` | barre de progression de financement | projets cagnotte ; `showFunding` |
| `profile` | carte profil personne/organisation | annuaires de membres/structures — le plus utilisé du parc (×24) |
| `resource-booking` | réservation de ressource | ressources réservables |
| `poi-amenities` | POI + équipements/accessibilité | cartographies d'équipements — ex. saint-paul-sport |
| `contact-card` | nom/email/téléphone | listes de contacts |
| `image-panel` | panneau image | vitrines visuelles |
| `card-answer` | réponse de formulaire | listings de réponses CoForm |
| `news` | carte actualité (item `News`) | fils d'actus en recherche |
| `testimonial` | témoignage (leaf `CardTestimonialBubble`) | paroles/citations ; bloc `list.testimonial` (`design: "bubble"`) |
| `resource` | ressource image-first (leaf `CardResourceCard`) | médiathèques/ressources ; bloc `list.resource` (`design: "card"`) |

### Presenters — previews (`list.preview.type`)

Dispatch : `src/modules/search/components/Preview.tsx` ; conteneur = `card.detailsMode` (`drawer` défaut \| `dialog`).

| type | rend | quand / options |
|---|---|---|
| `default` | détail générique | fallback |
| `poi-amenities` | détail POI + équipements | le plus utilisé du parc (×10) |
| `coform-answer` | détail réponse CoForm | `preview.fields` (rôle → suffixe de champ) |
| `event` | détail événement | réutilisé par le module agenda |
| `facets` | détail data-driven à facettes cliquables | `preview.facets[]` — zéro code |
| `news` | détail actualité | `preview.showDetailLink` |
| `testimonial` | détail témoignage (leaf `PreviewTestimonialBubble`) | bloc `list.testimonial` |
| `resource` | détail ressource (leaf `PreviewResourceCard`) | bloc `list.resource` |
| `structure` | fiche détail organisation (coordonnées, carte, docs, bouton Éditer) | annuaires de structures |

⚠ **Une option de `card`/`preview` n'a d'effet que sur CERTAINS types** — posée
ailleurs, elle est ignorée en silence. `config:schema section:searchPro` imprime
la matrice complète, dérivée du code ; repères : `shareButton` → `overlay`
seul ; `imageFit`/`overlayStats`/`servicePricing` → `image-cover` seul ;
`showFunding` → `funding` seul ; `tagLimit` → `overlay`+`default` ;
`showAddress`/`showDescription` → 4 types ; les autres cartes n'ont aucune
option propre (leur rendu ne dépend que de la donnée).

Variantes transverses : `preview.width` (`sm`…`5xl`\|`full`, défaut code `5xl`, dialog
seulement) ; `card.variant` surcharge `card.type` pour le dispatch (sous-ensemble
sans `overlay`/`news`/`testimonial`/`resource`) ; `card.detailedMode`
(`default`\|`service-pricing`) pour la vue detailed ; `defaultViewMode`
(`list`\|`map`\|`graph`, + `regions`\|`thematics`\|`split` en static) ;
`map.layout` (`full`\|`split`) + `map.splitRatio`. Exemples vivants :
`config:example -- list-resource` / `list-testimonial`.

### Rendu PAR ITEM (`list.itemRules`)

**Quand.** Une liste **hétérogène** : recherche globale sans filtre de type, où
articles, paroles, ressources, événements et structures cohabitent. Le presenter
ne peut pas venir du filtre coché — il se décide sur la donnée de chaque item.
Une seule famille par section ⇒ ne PAS utiliser `itemRules`, poser `list.card`.

**Forme.** `list.itemRules: [{ id?, when?, card?, preview?, testimonial?,
resource?, itemAction? }]`. `when` est un `PredicateJson` (même grammaire que
`visibleIf` : `{field, op, value}` + `and`/`or`/`not` ; ops `eq` `ne` `in` `nin`
`gt` `gte` `lt` `lte` `truthy` `falsy` `empty` `notEmpty` `matches` `contains`),
évalué contre `{...serverData, collection, sourceKey, sourceKeys}`, dot-paths
résolus. **1ʳᵉ règle qui matche gagne** ; règle **sans `when`** = catch-all, à
placer **en dernier**. Aucune règle ne matche → `list.card` sert de filet.

**Fusion** : `card` et `preview` sont **fusionnés** sur ceux de la liste (poser
`tagColors`/`width` une fois au niveau `list` suffit) ; `testimonial`,
`resource` et `itemAction` **remplacent** (un contrat de mapping est atomique).

**`itemAction`** : `kind: "preview"` (défaut, ouvre le détail) \| `"profil"`
(`/profil/:slug`) \| `"link"` (+ `to` avec `:slug`, `toById` avec `:id` en repli,
`newTab`). Toute action inexploitable retombe sur le détail. En **mode split**,
le clic focalise le marqueur et `itemAction` est ignorée.

⚠ **Deux pièges, tous deux silencieux** :
1. `serverData.type` a **deux sémantiques** — sous-type POI
   (`article`/`affiche`/`recoveryCenter`) mais sous-type d'ORGANISATION
   (`NGO`/`Group`…) sur `collection: "organizations"`. **Ancrer sur
   `collection` avant `type`**, toujours.
2. Un champ testé **absent de `baseParams.defaultFields`** vaut `undefined` : la
   règle ne matche jamais. Projeter au minimum `collection`, `type`, `source`,
   `slug` + les champs lus par les presenters.

Le préflight `tests/preflight/list-item-rules.test.ts` gate ces deux points, plus
l'ordre des règles et la présence des contrats. Exemple vivant :
`config:example -- list-item-rules`.

### Modules (recette d'activation)

| module | surface | clés JSON | prérequis backend |
|---|---|---|---|
| `search` | sections `searchPro`/`searchProStatic`/`filters`/`searchHeader`/`cardCountCT`/`thematics` | `baseParams` (`sourceKey`, `defaultFields`…), `list` (card/detailsMode/preview, `itemRules`/`itemAction` si liste hétérogène), `map` (`itemAction`/`marker`), `filters[].select`/`optionStyle`/`order` (widgets par groupe) | données indexées (sourceKey) ; carte : fond MapTiler via env `VITE_MAPTILER_API_KEY` (sinon repli OSM/Carto) + `integrations.map.styleLight/Dark` |
| `agenda` | section `agenda` (vues liste/calendrier/carte/split) | `baseParams`, `filters` (text/type/tags), `defaultMode`/`tabs`/`detailsMode`, `enableMap`/`map` | événements indexés (`searchEventsCostum`) |
| `news` | section `news` | `props.entitySlug`, `maxItems` | fil d'actus de l'entité |
| `blog` | routes `/blog/:slug` (+ `/blog/id/:id`) + sections `articleFeed`/`articleReader` | `config.blog` (`feedCostumSlug`, variants card/reader), `costumForms.<article>`, `commandPalette.articleSearch` | POI `type:"article"` scopés costum (`source.key`) |
| `coform` | routes `/coform/:formId` (+ `/answer/:answerId`, `/place`) | réf. de formulaire | CoForm défini côté backend |
| `toolsCatalog` | section `toolsCatalog` (catalogue d'outils d'usage : recherche/filtres/pagination CÔTÉ SERVEUR + modale détail des lieux, bloc commun, bouton de réponse, édition d'enrichissement réservée aux admins du costum) | `formId`/`step`/`finderPath` (+ options : `showOpenSourceToggle`, `showUsageFilter`, `defaultView`, `showCommunInfo`+`communFormId`, `showAnswerButton`, `enableEnrichmentEditing`…) | réponses coform (commonTable) + collection `navigatorcriteria` (enrichissement) |
| `aac` | sections `aac-directory` (annuaire des communs, `variant` full/preview) / `aac-highlight` (bande CTA + compteur), routes `/aac` + `/aac/commun/:answerId` (montées seulement si `config.aac` existe) | `config.aac.formId` (form parent `type:aap,aapType:aac` — jamais dans les props de section), `config.aac.directory.fields`, `config.aac.detail` | CoForm/AAP défini côté backend (form + aapConfig) |
| `cagnotte` | sections `actions`/`finance`/`*-summary` | `idProjet` | projet + Stripe/HelloAsso |
| `profil` | `/profil/:slug`, section `member` | `config.profiles` (tabs, editModal) | types d'entités |
| `auth` | `loginForm`/`registerForm`/`recoverPasswordForm`, `<AuthMenu>` (dont entrée « Kanban » plateforme via `auth.menu.kanban`, admins du costum) | `config.auth`, `header.utilities.auth` | comptes/SSO Communecter |
| `notification` | cloche header, section `notifications` | `header.utilities.notifications` | notifications backend |
| `commandPalette` | palette ⌘K | `config.commandPalette`, `header.utilities.search` | — |
| `ampli` | routes ampli | `config.ampli` | campagne ampli |
| `interop` | pods Discourse/Mediawiki | clés interop | instances externes |
| `observatoire` | section `data-observatory` (dashboard déclaratif : dimensions, KPI, charts, table, filtres) | `props.baseParams` (périmètre) + `dimensions`/`filters`/`kpis`/`charts`/`table` | données indexées (sourceKey + type) |
| `formEngine` | modales costum **add/edit pilotées par données** (moteur de formulaire générique) | `config.costumForms.<id>` (document `CostumFormSchema`) + déclencheur `floatingActionButton.modal:"add-<id>"` / `profiles.<type>.editModal:"edit-<id>"` | entité costum porteuse (`costumSlug`) ; clés read/write/scope déjà enregistrées (sinon `fns.ts`) — cf. § Recettes avancées |
| `admin` | page `/admin` config-driven (onglets Membres/Contenu/Import-Export/Validation) | `config.admin` (`tabs[].sections[]`, `access.min`) | endpoints admin (`getMembersAdmin`, import/export, `validategroup`…) ; accès siteAdmin/superAdmin — cf. commentaire/plan-module-admin-generique.md |

**Refuse d'activer un module dont le prérequis backend n'est pas confirmé**
(ex. pas de `searchPro` sans `sourceKey` réel).

## Design system (voir le rendu réel avant de choisir)

- **`.design-sync/previews/` — la ressource la plus utile, et elle est dans git** :
  153 stories portant des compositions de props RÉELLES (valeurs plausibles,
  commentaire d'usage : « Usage réel : home de Rézo la mer »). Le JSON Schema
  donne la FORME, la story donne la COMPOSITION — **43 des 77 sections** en ont
  une (les 28 sans sont data-driven : search\*, agenda, cagnotte, blog — une
  composition statique n'y montrerait rien), ainsi que **les 6 headers et les 4
  footers**. Copie la story, ne réinvente pas le remplissage.
- **Vérité versionnée : `.design-sync/`** — `config.json` (`componentSrcMap` :
  ~153 composants exportés → chemin source dans `src/`), `conventions.md`
  (règles : enveloppe `DsProvider`, **tokens CSS d'abord — jamais de couleur en
  dur**, composants de modules props-driven qui ne fetchent rien),
  `NOTES.md` (pièges connus, exclusions volontaires).
- **Artefact local : `ds-bundle/` (GITIGNORÉ, régénérable via design-sync)** —
  quand il est présent : `components/<groupe>/<Name>/<Name>.prompt.md` (usage
  recommandé + exemples JSX réalistes), `<Name>.d.ts`,
  `_screenshots/<groupe>__<Name>.png` (un par composant + planches-contact),
  `README.md`. ⚠ `tokens/` et `guidelines/` y sont VIDES — les ~375 variables
  CSS sont déclarées dans `_ds_bundle.css`.
- **Usage pour cette skill** : avant de trancher un `header.type`,
  `footer.type` ou un presenter, regarder le screenshot
  (`_screenshots/header__HeaderMegaMenu.png`…) et le `prompt.md` correspondant
  si le bundle est présent ; sinon lire le composant source via
  `componentSrcMap`. Y sont notamment : les 6 headers, les 4 footers, et les
  leaves search `CardResourceCard` / `CardTestimonialBubble` /
  `PreviewResourceCard` / `PreviewTestimonialBubble`.

## Recettes avancées (chargées à la demande)

Ne lis ces fichiers QUE quand la tâche les concerne :

- **Formulaires costum** (`config.costumForms`, moteur formEngine) :
  [references/formulaires-costum.md](references/formulaires-costum.md) —
  recette 0-code, générateur `config:costum` (`--live`, `--all` multi-forms),
  quand il faut du code (`fns.ts`), garde des clés.
- **Thème** (`config.theme`, palettes, tokens) :
  [references/theme.md](references/theme.md) — méthode de dérivation, pièges de
  sémantique (`accent` ≠ hover), mapping CSS obligatoire, 4 directions du parc.
- **Administration** (`config.admin`, back-office `/admin`) :
  [references/admin.md](references/admin.md) — squelette `admin:scaffold`,
  personnalisation (colonnes, actions, accès), validation.

## Règles maison

- `header.type` / `footer.type` / `card.type` / `preview.type` / types de
  section = **noms de DESIGN, jamais de site** (doc/03, doc/07).
- `LocalizedString` : `fr` obligatoire ; couvrir toutes les langues de
  `meta.languages` (audit:config le vérifie).
- Chemins internes : doivent exister dans `pages[].path` ou les routes de
  modules — **aucun chemin inventé**. ⚠ Une route à paramètre exige une valeur
  concrète : `/profil/:slug`, `/coform/:formId`, `/blog/:slug`, `/ampli/:slug`
  ne sont PAS navigables nus (`/profil` seul est un 404) ; nues et valides :
  `/login`, `/register`, `/recover-password`, `/admin`. L'audit dérive ces
  préfixes de `src/modules/*/routes.tsx` (`scripts/lib/module-routes.ts`).
- **Aucune URL d'image inventée** : asset fourni (copié dans
  `public/images/<slug>/`, référencé en absolu `/images/<slug>/…`), asset
  existant, ou rien. Sans logo : `logoIcon` (nom Lucide ou SVG inline).
- Valeurs de filtres/variants : pas de virgule dans une valeur de filtre
  (format URL `?param=v1,v2` partagé avec les sidebars).
- La config n'est **JAMAIS parsée par Zod au runtime** : les `.default()` du
  schéma ne s'appliquent pas — écrire chaque clé EXPLICITEMENT dans le JSON.

## Thème

**Recette complète (méthode, sémantique des tokens, 4 directions réelles) :
[references/theme.md](references/theme.md)** — à lire dès qu'on conçoit ou
modifie une palette. L'essentiel :

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
  (enums header/footer/presenters, modules, scripts, fichiers references/) :
  s'il échoue, **mets cette skill à jour, pas le test**.
- Le test préflight `archetypes` garantit manifest + snapshots (cf. § Archétypes) :
  constat d'audit nouveau → le corriger ou l'assumer dans `knownFindings` ;
  snapshot dérivé → `config:example -- <feature> --write`.
- Le test préflight `prop-descriptions` garantit le registre de sémantique
  (`scripts/lib/prop-descriptions.ts`) : une entrée dont le chemin ne résout
  plus dans le schéma est MORTE → corriger le chemin ou la supprimer ; toute
  évolution d'un bloc chaud mérite ses descriptions.
- Sur demande « mets-toi à jour » (ou si tu détectes une dérive) : analyse les
  commits récents touchant `src/types/site-schema.ts`, `src/modules/*/`,
  `src/components/admin/section-meta.ts`, `sites.json`, mets à jour les tables
  semi-stables de ce fichier **et les recettes `references/*.md`**, propose le diff.
