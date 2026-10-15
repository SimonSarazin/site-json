[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Parent62 — Réseau Parentalité du Pas-de-Calais

> **Document de travail du projet de configuration.** Il intègre le cahier des charges, le
> modèle de données réel, l'architecture, l'état d'avancement, les impacts et les dépendances.
> Objectif : ne plus rejoindre le PDF du CDC ni re-explorer la base à chaque session, et offrir
> une base partagée entre les intervenants (Peterson / Thomas). **À tenir à jour à chaque lot
> livré**, selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Articles/Blog](../doc/32-module-articles-blog.md) ·
> [Module Search](../doc/07-module-search.md) · [Module formEngine](../doc/28-module-formengine.md) ·
> [Système de visibilité](../doc/19-visibility-system.md) · [Module Agenda](../doc/29-module-agenda.md) ·
> [Composants média](../doc/33-media-components.md) · [Module Admin](../doc/30-module-admin.md).
> Mémoire : `[[project-parent62]]`
> (`.claude/memory/project-parent62.md`) — slug corrigé le 25/07 (`parents62` avec **s** est abandonné, cf. §1).

Dernière mise à jour : **2026-10-13** — annuaire des acteurs du soutien à la parentalité
(`/annuaire-acteurs-parentalite`, 38 organisations importées), fiche profil et formulaire d'édition dédié
`parent62-acteur` sur les vrais champs du formulaire, correctif admin (colonnes « Année »/INFORESO et
« Type »/Ressources invisibles) — détail en §9septquadragies. Précédemment : **2026-10-08** — relecture de la MR `parents62` : 12 constats corrigés (régressions,
dette pré-existante étendue, bonnes pratiques) sur la gestion des rôles, l'export PDF, la grille équipe,
la pagination numérotée (troncature `1 … 30 31 32 33 34`, bug « Previous »/« Next » resté en anglais, et
l'annonce d'accessibilité qui disait « sur 2 » au lieu du total réel « sur 537 » — les trois trouvés en
relisant mes propres vérifications), les liens `NavLink`/`classifyHref`, le téléchargement de Blob
factorisé — détail en §9tresquadragies.2. Précédemment : **2026-10-06** — SDK monté en `1.0.196` (rôles de membre modifiables,
export PDF de l'agenda) : dialogue « Gérer les rôles » sur tout membre déjà lié, rôles posables à
l'invitation « users », export PDF réel vérifié en direct (150 Ko, `%PDF-` confirmé) — un bug backend
connu (`Costumize::connectElement`) reste non corrigé sur le seul chemin d'invitation CRÉANT un lien,
sans effet sur « Gérer les rôles » — détail en §9quinquadragies. Précédemment : **2026-10-01** — refonte
accueil « Vous êtes »/Territoires/À la une en un seul panneau : assets carte remplacés, icônes de titre,
plafond de hauteur opt-in de l'illustration (sans recadrage ni retouche des % de bulles), 2 bugs
d'espacement trouvés et corrigés (ombre rognée par le carrousel, centrage vertical cassé par un
`mt-auto`) — détail et gates réels en §9duoquadragies. Précédemment : **2026-09-23** — passe de revue du lot membres (§9septvicies.7 : 9 correctifs, 5 nettoyages transverses, césure coform rétablie — plus aucun test rouge) ; coordination territoriale lue en une requête serveur (§9septvicies.6) ; bandeaux de filtres en deux lignes, filtre par ville réservé aux actualités et tiré de l'adresse (§9novotricies). Précédemment : **2026-09-22** — annuaire des partenaires et filtre « Villes » des actualités, page « La communauté » retirée (§9octotricies). Précédemment : **2026-09-17** — INFORESO et « Elles et ils ont marqué le réseau » en pages dédiées avec leurs formulaires d'admin, types d'actualité « À la une » / « Zoom sur le réseau » en choix multiple, taxonomie facultative hors réunions (§9octovicies). Précédemment : **2026-09-15** — les cinq lots du 09/09 (§9vicies à §9quatervicies, validés en §9quinvicies), puis la refonte de l'accueil, les actions admin sur les actualités, les pages du réseau reprises à la source et le Mois de la Parentalité (§9sexvicies).

**(f) Passe de revue du lot membres, et le dépôt sans test rouge** — `/code-review` rejoué sur la
branche : 9 constats, tous corrigés (`territoires` en tableau lu par la carte, `NavLink` sur le lien de
territoire, buckets `pending`/`admins` gatés sans onglets, `exigerConvention` au même contrat que le
préflight, gate élargi aux configs `dev`/`site-config`/`SITE_CONFIG_PATH` + **labels parent62
exacts**, recette de la skill, garde « non vide » unique dans le hook). Cinq nettoyages transverses de
la première revue (`ActionTiles` SVG, `MapBubbles` `hidden`+`flex`, commentaire `sectionBadge`,
codec ISO dupliqué, `as never` d'`ArticlePage`). Et la **césure des textes riches de formulaire**
(`wrap-anywhere`, perdue à l'extraction de `ProseContent`) est rétablie côté coform : `test:unit`
**4 776/4 776**, le seul rouge du dépôt est résolu. Détail : §9septvicies.7.

**(e) Coordination territoriale lue en UNE requête serveur** — la section `member` ne filtre plus
le territoire côté client sur une liste paginée (une lecture de fiche par membre, et une sentinelle
de pagination jamais montée quand la page courante ne contenait aucun rattaché : le 21ᵉ
coordonnateur n'aurait jamais été trouvé). `filters` (égalité Mongo, fusionné **sous** le filtre de
lien) et `fields` (projection **additive**) partent au serveur, portés par le SDK **1.0.194** —
`getMembers`/`getContributors`/`getAttendees` fusionnent les filtres appelant au lieu de les écraser,
les 6 schémas AJV de requête acceptent des clés de filtre étrangères et déclarent `fields`. La carte
« équipe » lit tout sur la liste (plus d'`entityBySlug` par carte) et `card.rattachement` devient
**obligatoire** (gate préflight `member-team-card`, `exigerConvention` à l'exécution) : le module
`profil` ne code plus la convention parent62 en repli. Supprimés : `useMembresDuTerritoire`,
`memeTerritoire`, la sentinelle. SDK `1.0.194` publié le 22/09, dépendance bumpée (§9septvicies.6).

**(d) Haut des 9 pages territoire refondu + saisie admin des réunions** — chaque page
`/territoire/*` ouvre désormais, juste après son bandeau, sur les **3 prochaines réunions du comité
local** (`agenda` filtré `type:"meeting"` + `territoires`), suivies de la grille `cards` à 2 colonnes
(coordonnateur·rice + carte « **Comptes rendus des réunions** » vers le Drive du territoire) puis de
**3 ressources du territoire** avec un bouton « Voir toutes les ressources » vers `/ressources`
pré-filtré. Retirés : la carte « Le comité local » et les 5 blocs de liens externes (leurs 11 URL
sont archivées en §9novodecies.2). Les 9 pages partagent maintenant le MÊME gabarit à 9 sections ;
161 → **174 sections**. La saisie des réunions passe par un 5ᵉ formulaire costum
**`parent62-reunion`** (`type:"meeting"`, sans `toBeValidated`) et un 9ᵉ onglet `/admin`
« **Réunions du comité** ». Deux apports **génériques** au moteur accompagnent le lot : le helper
`buildViewAllHref` (lien « voir tous » d'un `customHeader`) et le gate préflight `deeplink-filters`,
plus le contrat `limit` / `indexStepList` d'un teaser d'agenda, désormais écrit dans le schéma, le
registre `config:schema` et `doc/29`. Détail : §9novodecies.

**(c) Types de ressources** — l'énumération `category` des fiches ressource passe de **6 à
8 valeurs** : « Jeu » devient *Les jeux du réseau*, et deux types s'ajoutent, *Inforéso* et *Elles
et ils ont marqué le réseau*. Couleur et icône déclarées aux **3 endroits** qui rendent une carte
ressource (`/ressources`, `/recherche`, palette ⌘K), les deux nouvelles couleurs prenant des jetons
de STATUT (`--info`, `--success`), la rampe `chart-*` étant déjà saturée à 5. Détail : §9octodecies.

**(b) Double entrée parents / pro rétablie sur l'accueil** — la section `action-tiles`
`home-double-entree` (« Vous êtes… » : *Parent* → `/parents`, *Professionnel·le ou bénévole* →
`/pro`) est réinsérée en 2ᵉ position, après le carrousel « à la une ». Elle avait disparu à la
refonte du 06/08 (§9quater) en laissant les deux pages **orphelines de tout lien** — régression 1.4,
désormais levée. Restaurée **telle quelle** depuis `c620ff5c^`, sans retouche de style : sa
composition de props est déjà celle de l'idiome `action-tiles` du site
(`headline` + `columns` + `actions[icon,title,subtitle,href,color]`). Accueil : 3 → **4 sections**
(SSR 3/4 rendues, la 4ᵉ étant le `featured-carousel` data-driven, déjà non rendu en SSR avant ce
lot). Recette `home-a-la-une` de la skill `config-assistant` resynchronisée : elle annonçait « trois
blocs, zéro texte statique », ce qui n'est plus exact (gate `page-recipes`). Gates :
`config:validate` **46 pages/161 sections**, `audit:config` RAS, `config:render` 46/46,
`test:preflight` **531 passés**.

**(a) Champ « Type d'actualité » dans le formulaire d'ajout d'article** — `category` sur
`costumForms.parent62-article`, 3 valeurs : *Article simple* / *Appel à projets* /
*Offre d'emploi* — plus 2 onglets `/admin` filtrés [`appels-projets`, `offres-emploi`,
`source.defaultTags`]. Un `mutation.stamps` [`{field:"tags", op:"append", on:"both",
value:{$mapLabels:{from:"category", …}}}`] dérive du type le mot-clé public « Appels à projets » /
« Offres d'emploi », reposé à **chaque enregistrement, création ET édition**, en union dédupliquée
avec les mots-clés saisis et les tags déjà en base ; *Article simple* n'est pas dans la table de
correspondance et ne pose donc aucun tag. `category` est un **vrai champ du schéma d'écriture POI**
— déjà écrit par `parent62-affiche` et `parent62-recovery-center` — donc il persiste et revient à
l'édition. **Un ajout au moteur** accompagne le lot : `createDefaults` sur une section admin
`resource` sème le sous-type dans la modale d'ajout, si bien que le **+** d'un onglet ouvre le
formulaire déjà positionné — sans quoi il aurait fallu un formulaire costum cloné par sous-type.
Les pages publiques `/appels-a-projets` et `/offres-emploi` sont **inchangées**. Snapshots resync :
`stamps.test.ts`, `__effective__/parent62.json` (projection étendue à `createDefaults`),
`examples/admin.json`. Gates : `typecheck`/`lint` propres (0 erreur, warnings inchangés),
`config:validate` **46 pages/161 sections**, `audit:config` RAS, `test:preflight` **531 passés**
[1 échec pré-existant sans rapport : dossier vide `public/images/transiter`], `test:unit` ciblé
**1 149/1 149**. Détail : §9sexdecies.

Les deux lots sont **non commités**.

Précédemment : **2026-08-26** (menu de nav « Thèmes » de parent62 basculé sur une capacité
**générique du moteur** — champ `dynamicList` sur `EnhancedNavItem`, câblé une seule fois dans
`SiteHeader.tsx`, zéro composant de header modifié : le dropdown se génère depuis
`costum.lists.themes` [18 valeurs réelles] — plus aucun `children` figé en config, le repli statique
a été retiré une fois la résolution dynamique confirmée fiable en conditions réelles [conséquence
assumée : menu vide si `costum.lists.themes` devenait indisponible, cf. §9decies.2]. Chaque clic
ouvre une page **dédiée `/theme?theme=<valeur>`** [46ᵉ page, calquée sur `/blog`, hero propre
« Nos thèmes », son filtre `theme` marqué `hidden` puisque la page est déjà scopée]. Les 8 pages
`/theme/<slug>` restent en ligne mais ne sont plus reliées depuis la nav (remplacement complet,
décision produit actée avec l'utilisateur). Revue de code passée (`/code-review high`) : 2 bugs
réels trouvés et corrigés (virgule littérale cassant le round-trip URL ; retour arrière navigateur
ne vidant pas un filtre appliqué — décision d'hydratation extraite en fonction pure testée,
`resolveFilterHydration`) ; 3 points identifiés et documentés sans code (impact site entier sur les
facettes hors nav, highlighting actif mobile, Ctrl+K). Détail complet : §9decies. Document de spec
séparé (racine du monorepo) : `Document de spécification — Menu dynamique costum.lists dans le
header.md`. Gates : typecheck/lint propres, `config:validate` **46 pages/160 sections**,
`audit:config` RAS, `test:unit` **2909/2909** ✅ (+17 tests). `test:e2e` non rejoué (pas de
`.env.test` dans cet environnement) — à faire avant fusion `main`. Non commité à ce stade.
Précédemment (même jour) : **2026-08-25** (section admin générique « Listes » — édition de
`costum.lists` en layout maître-détail dans `/admin` : ajouter/renommer/réordonner/supprimer une
valeur, créer une liste ; activée en **pilote** sur parent62, onglet « Listes », restreinte via
`props.lists` aux 2 listes **grandies par saisie libre** (`themes`, `categoriesParole` — cf.
§9septies), chacune avec un **libellé lisible** (`{key,label}`) plutôt que sa clé technique —
`territoires`/`publics` restent hors de cet écran — cf. §9octies ; commit `9c3f243f` sur
`parents62`, **pushé** ; typecheck/lint propres, `config:validate` 45 pages/158 sections (inchangé).
Puis (25/08 aussi, correctif indépendant) rattrapage de 2 gates preflight qui avaient dérivé depuis
le dédoublonnage du territoire « Familles en sol mineur » (§9quinquies, 13/08) — cf. §9novies ;
suite complète **2882/2882** ✅, plus aucun échec.
Précédemment (même jour) : **2026-08-25** (thèmes/catégorie de "parole de parent" en saisie libre,
promotion admin-only vers la liste partagée `costum.lists`, filtres et formulaire réactifs sans
reload — cf. §9septies ; commit `bcd90e6d` sur `parents62`, **pushé** ; typecheck/lint propres,
`config:validate` 45 pages/158 sections, 990 tests unitaires ciblés ✅).
Précédemment : **2026-08-19** (diagnostic + correctifs événements récurrents de l'agenda,
testés avec des données de test locales — 3 bugs backend corrigés ; réponse au §2.6/§12 (le filtre de
modération `toBeValidated` fonctionne) — cf. §9sexies ; `test:unit` ciblé **899/899** ✅, suite
complète 2 499/2 508, 3 échecs pré-existants sans rapport).
Précédemment : **2026-08-13** ajustement hauteur header stacked/section "à la une",
fix affichage champ thème/catégorie dynamique, dédoublonnage territoire « Familles en sol
mineur » — cf. §9quinquies ; `test:unit` **2 342/2 348** ✅, `e2e parent62` **8/8** ✅.
**2026-08-06** refonte accueil/header/footer + 11 nouvelles pages —
committé sur `parents62`, cf. §9quater ; puis corrections de review de la MR !32 sur
`fix/parents62-review` : gates du skill resynchronisées, e2e réaligné header stacked, fixes
composants, images WebP — `test:unit` 2 229/2 229 ✅.

---

## 1. Contexte du projet

Le Réseau Parentalité 62 (REAAP 62) dispose d'un WordPress reconnu, `www.parent62.org` : bon
référencement, production régulière d'articles, mais recherche faible, outils non reliés (WordPress,
GoGoCarto, MyLudo…) et peu de capacité de contribution pour les partenaires. Le projet consiste à
publier une plateforme complémentaire — **`reseau.parent62.org`** — bâtie sur SiteForge (site-json)
et le réseau social Communecter, en **conservant le WordPress** pour les contenus éditoriaux.

| | |
|---|---|
| **Site SiteForge** | slug `parent62` → [`config.prod.parent62.json`](../config.prod.parent62.json), CSS `index-parent62` ([`sites.json`](../sites.json)) |
| **Costum / scope de données** | `parent62` — `source.key` de toutes les entités du réseau |
| **Orga porteuse** | « Parent 62 », `_id 6a450f0ac34c7070327d2a64`, slug `parent62`, type `NGO` |
| **Backend** | Communecter (`~/dev/communecter-php74`), base de travail locale = dump de prod `prod200726` |
| **SDK** | `@communecter/cocolight-api-client` — **dépôt en lecture seule**, version **1.0.172 publiée sur npm** (`^1.0.172`, commit `09e145a0` du 03/08, résolue depuis `registry.npmjs.org` — fini le tarball `npm pack` local) |
| **Branche site-json** | `main` — MR #25 mergée le 25/07 (`f599357a`) ; lot `feat/search-item-rules` **intégré à `main`** (les 3 commits sont dans son historique first-parent) ; dernier merge `fix/institut-bleu-ui` le 03/08 (`94251b7b`, 17 commits) |
| **Chef de projet** | Thomas Craipeau (Aboire) — seul habilité à modifier le SDK et le costum backend |

### Historique des chantiers

- **Thomas (sur `main`)** : module blog (`src/modules/blog/**`), back-office `/admin`, widgets
  `gallery`/`file`/`markdown`, import WordPress (`tools/wp-migration/`), **import des 6 434 articles**
  (19/07). Puis (22-24/07) l'**approche générique config-driven** : contrats de design
  `testimonial`/`resource`, page `/temoignages` (paroles) + `/ressources` + `/agenda`, formulaires
  costum `parent62-affiche` (parole), `parent62-article`, `parent62-recovery-center`, `parent62-event`,
  **pile audio mutualisée** (`src/components/media/*`), news (`/actualites`), et les ajouts SDK 1.0.168.
- **Peterson (sur `parents62`, MR #25)** : couche filtres `searchTargets`/`dateRange` (« type d'info »
  sans tag fantôme) + coloration `colorBy`/`tagColors`, recherche `/recherche`, pages audience
  `/parents`/`/pro`, `/communaute`, pages réseau et **9 pages territoire** avec les 887 communes,
  référentiel `src/data/territoires62.ts`, sitemap/robots, **fix header transparent**, **suite e2e**.
- **20/07** : constat que le slug `parents62` (avec **s**) ne correspond à aucune donnée → tout
  ramené sur `parent62`, une seule config, taxonomie par **champs**.
- **23/07** : purge des restes `parents62` ; réalignement `pdev` = `master` (SDK **1.0.168**).
- **24/07 — réconciliation MR ↔ main** (ce document) : Thomas n'ayant pas mergé le MR et ayant
  développé parent62 en parallèle sur `main`, le merge `main` → `parents62` a produit une **union
  redondante**. Décision **« main canonique »** : on retire les doublons du MR, on garde les apports
  uniques. Détail au §9 (Impacts).
- **25/07 — MR #25 mergée dans `main`** (`f599357a`), suivie de correctifs de revue :
  `55288375` (3 bugs latents du filtrage search : `dateRange`, `field defaultChecked`, radio select),
  `b3cf8f4f` (labels de date i18n, chips `tagLimit`, ligatures communes NFKC), `f3a58609` (4 noms
  d'icônes hors catalogue lucide, qui rendaient `null` en silence), `994cba75` (4 `editModals`
  orphelins — les boutons « Modifier » remarchent), `ced1417f` (5 références de modales mortes),
  `b4584949` (couleurs de statut branchées).
- **25/07 — rendu par item de la recherche globale** (`feat/search-item-rules`, depuis **intégré à
  `main`**) : la page `/recherche` rendait une carte générique pour toutes les collections et son
  filtre « Paroles » ne renvoyait rien. Détail au §9bis.
- **27-30/07 — hygiène CSS du thème (Thomas, `main`)** : `79dc4637` (palette dupliquée retirée
  d'`index-parent62.css` — déjà injectée au runtime par `config.theme`) et `53f28ca1` (`.access-card`
  promue en **plancher partagé** dans `styles/shared.css`, le traitement parent62 devient le défaut
  du parc). Seuls commits du projet depuis le 25/07. Détail au §9ter.
- **03/08 — merge `fix/institut-bleu-ui` dans `main`** (`94251b7b`, 17 commits) : SDK **1.0.172**
  publié (`09e145a0`) et nouvelle variable **`VITE_SITE_PUBLIC_URL`** (`be7a320c`) — cf. §8.5 et
  §11. typecheck + préflight (22 fichiers / 412 tests) verts après merge, mesurés le 03/08.
- **06/08 — refonte accueil/header/footer + 11 nouvelles pages** (committé sur `parents62` —
  18 fichiers modifiés, 8 fichiers de code neufs) : accueil réduit à 3 sections data-driven
  (`featured-carousel` + `map-bubbles` + `articleTeaser`, 3 types de section neufs), header
  `type:"stacked"` (neuf), footer `type:"minimal-centered"` + image de fond (neuf), nav
  restructurée (dropdown « Publics » ajouté, entrée top-level « Rechercher » retirée), 11 pages
  ajoutées (35→46, 153→176 sections).
- **06/08 — review de la MR !32 → branche `fix/parents62-review`** (7 commits par-dessus
  `parents62`, dont préflight : l'agent local gitignoré `siteforge-config-auditor.md` n'est
  plus exigé par skill-integrity ; et **refactor `HeaderStacked` → bandeau dans le flux +
  barre sticky** : l'ancien bloc fixed à hauteur animée + spacer clippait logo/sous-titre
  sur petits écrans (Nexus 5), laissait transparaître la page dans la barre compactée
  (alpha de l'image) et faisait sauter le contenu de ~370px — recette navigateur
  desktop + mobile des deux mécaniques, rendu au repos et barre compacte conservés) :
  gates du skill config-assistant resynchronisées (table
  Headers + `stacked`,
  comptes 71→74, exemples `footer-contact-partners`/`header-transparent-scroll` re-pointés vers
  eXtremeDefiAdeme, recette `home-a-la-une` remplace `home-portail-services`) ; e2e réaligné
  (header stacked, dropdown « Publics ») ; fixes composants (`font-serif` égaré dans `rel`,
  `relative` manquant sur les pastilles MapBubbles, scrim sans fond supprimé, conflits de classes
  tranchés, variant `xs:` → `min-[475px]:`, boutons icône du header en prop `className`, autoplay
  pausable + `prefers-reduced-motion`, `aria-label` du footer retiré) ; images converties en WebP
  (**5,7 Mo → ~1,0 Mo**, `carte-territoire.png` jamais référencée supprimée) —
  `test:unit` **2 229/2 229** ✅.
- **06/08 — unification des couleurs du thème sur l'identité de la home** (stratégie A du
  rapport `commentaire/parent62-unite-couleurs-home.md`, local) : le thème passe
  d'indigo/or à **marine/turquoise/teal** (~12 tokens clair+sombre — `primary`→marine
  #2c3e50, `accent`→turquoise #4ecdc4, `secondary`→menthe, `chart1`→teal) ; les 35
  bandeaux `searchHeader` (`--gradient-section` dérivé de primary/accent), CTA, badges
  et liens suivent d'un coup. Tokens de marque `--p62-marine`/`--p62-turquoise` déclarés
  dans `index-parent62.css` et consommés par la config home (`background`/`accentColor`/
  `header.textColor` en `var()` — une seule source de vérité) ; hex territoires dupliqués
  de `/recherche` + `/temoignages` → `var(--territoire-*)` ; 7 snapshots du skill
  resynchronisés (`config:example --write`). Home visuellement inchangée (vérifié).
- **06/08 — mode sombre « de marque »** : 9 tokens de fond sombre re-basés famille marine
  (teinte 250, fini l'indigo-nuit hérité), chrome header/footer voilé par
  `dark:bg-background/90` (teinté par le thème, générique, ~10 % de texture aquarelle),
  wordmark `dark:text-accent` (les lettres creuses marine-sur-marine), carte des
  territoires tamisée en sombre (dégradé `.dark` assombri + `dark:brightness-75` sur
  l'illustration — le « projecteur » devient lueur douce). Clair strictement inchangé.
- **06/08 — lisibilité bandeaux territoires** : 5 des 9 bandeaux HTML (`Artois`,
  `Audomarois`, `Calaisis`, `Entre Mer et Terres`, `Ternois Bruaysis`) passent en encre
  marine (`var(--p62-marine)`) — le blanc y était à 1,8–2,5:1 (mesure WCAG), le marine
  monte à 4,4–6,2:1. Les 4 fonds foncés gardent le blanc. ⚠ tranche le « parti pris du
  site historique » documenté dans le CSS — à confirmer avec Sylvany/Peterson.
- **06/08 — unification de l'idiome titre des pages de liste** : les 15 pages `/theme/*`
  + `/public/*` passent de « section `title` + `searchHeader compact` » (patron
  historique, propagé par copie dans la MR) à l'idiome de `/blog` : `headline`/`subhead`
  DANS le `searchHeader` (le bandeau EST le hero) — 176→161 sections, recette
  `page-thematique` mise à jour (2 sections, couvre thèmes + publics). Les pages
  territoire gardent leur bandeau coloré (idiome à part, assumé).
- **25/08 — thèmes/catégorie de "parole de parent" en saisie libre, réservé admin** : les champs
  "Thèmes" (4 formulaires) et "Catégorie" (`parent62-affiche`) passent en `valueSelect` creatable ;
  une valeur inédite acceptée par un **admin** grandit aussi `costum.lists.themes`/
  `categoriesParole` (config-driven, `false` par défaut), un visiteur non-admin ne choisit que
  parmi l'existant ; filtres et formulaire se mettent à jour sans reload via la réactivité native
  du SDK (pas de store maison). Détail §9septies. Commit `bcd90e6d` sur `parents62`, **pushé**.

---

## 2. Objectifs de la configuration

Ce que la config `parent62` doit produire, concrètement :

1. **Un site vitrine + réseau** calqué sur la navigation/graphisme du WP, sur le domaine
   `reseau.parent62.org`, en complément (non remplacement) du WordPress éditorial.
2. **Un moteur de recherche multi-type** (`/recherche`) filtrable par **type d'information**,
   **public**, **thème**, **territoire coloré**, **dates**, avec **vue carte** en bascule.
3. **Les contenus du réseau comme entités filtrables** : articles (POI `article`), **paroles de
   parents** (POI `affiche`), **ressources** (POI `recoveryCenter`), **événements** (agenda).
4. **La contribution des partenaires** via formulaires costum (config-driven, dynForm), avec
   **modération a priori** (native `preferences.toBeValidated`, SDK ≥ 1.0.168).
5. **La navigation territoriale** : 9 pages `/territoire/*` (contact coordo + 887 communes + fil
   d'articles), et un code couleur par territoire réutilisé carte + chips.
6. **Le référencement** préservé (SEO par page, JSON-LD, sitemap, robots, RSS).

La taxonomie est portée par des **champs** de premier niveau (`territoires`/`publics`/`themes`),
partagés par tous les types de contenu ; `tags` reste réservé aux mots-clés WordPress libres.

---

## 3. Architecture générale

```
 WordPress (parent62.org)          Communecter / cocolight-api-client (SDK 1.0.172)
   contenus éditoriaux                 poi (article/affiche/recoveryCenter) · events · costum
        │  import (6 434 articles)          ▲
        ▼                                   │ searchCostum / ADD_POI / ADD_NEWS
   ┌─────────────────────────── SiteForge (site-json) ───────────────────────────┐
   │  config.prod.parent62.json  →  SiteRenderer  →  pages / sections             │
   │    header.nav · pages[] · costumForms{} · theme                              │
   │  searchProStatic / articleFeed / agenda  →  buildSearchPayload  →  backend   │
   │  costumForms (dynForm) → registerCostumForm → EntityFormModal → ADD_POI      │
   └──────────────────────────────────────────────────────────────────────────────┘
        reseau.parent62.org (SSR : server/prod-server.js, VITE_SLUG=parent62)
```

**Comment les données arrivent à l'écran** — deux voies de filtrage, **toutes deux config-driven**,
valables pour `articleFeed`, `searchProStatic` et `agenda` :

| Voie | Écriture en config | Résultat backend |
|---|---|---|
| **Filtre figé** (page thématique / territoriale) | `props.filters` (articleFeed) ou `baseParams.defaultFilters` (searchProStatic) | `{ champ: { $in: [...] } }` |
| **Filtre interactif** (dropdown, sidebar) | filtre portant un `field` (`dropdownFilters[].field`, groupe `filters`, `searchTargets`) | converti par `searchByFieldsToQuery`, fusionné dans `defaultFilters` |

Un filtre **sans** `field` retombe sur les tags (`$all`) — ancienne convention, à ne plus utiliser.

**Cible « type d'information »** : les groupes `searchTargets` (filtre radio « type d'info ») portent
une cible par défaut appliquée à l'hydratation d'URL (`applyDefaultSearchTargets`) — sans injecter de
tag fantôme (apport MR, [`computeFiltersFromUrl.ts`](../src/modules/search/lib/computeFiltersFromUrl.ts)).

**Troisième voie : quel presenter pour quel item** (25/07). Les deux voies ci-dessus disent *quoi
chercher* ; elles ne disent pas *comment rendre*. Sur `/recherche`, aucune cible cochée ⇒ la liste est
**hétérogène** (articles, paroles, ressources, événements, structures mélangés) et le presenter ne
peut donc pas venir du filtre : il se décide **sur la donnée de chaque item**, via
`list.itemRules` — des règles à prédicat (`PredicateJson`, la grammaire de `visibleIf`) évaluées
contre `{...serverData, collection, sourceKey, sourceKeys}`. La première règle qui matche impose sa
carte, sa preview, son contrat de presenter et son action au clic. Voir
[doc/07 §Rendu PAR ITEM](../doc/07-module-search.md#rendu-par-item-des-listes-hétérogènes-listitemrules).

> ⚠️ **Deux pièges, tous deux silencieux.** (1) `serverData.type` a deux sémantiques — sous-type POI
> (`article`/`affiche`/`recoveryCenter`) mais sous-type d'ORGANISATION (`NGO`/`Group`…) sur
> `collection:"organizations"` : ancrer toute règle sur `collection` **avant** `type`. (2) Un champ
> testé absent de `baseParams.defaultFields` vaut `undefined` ⇒ la règle ne matche **jamais**, sans
> erreur. Les deux sont gatés par `tests/preflight/list-item-rules.test.ts`.

**Code couleur par territoire** : `map.marker.colorBy` et `list.card.tagColors` acceptent un `path` —
`{ path:"territoires", mapping:{ "Arrageois":"var(--territoire-arrageois)" } }`. `resolveColorBy` /
`decorateTags` lisent n'importe quel chemin ([`lib/colorBy.ts`](../src/modules/search/lib/colorBy.ts),
schémas `ColorByConfSchema`/`TagColorsConfSchema` dans [`schema.ts`](../src/modules/search/schema.ts)).

> ⚠️ **`applyValidationGate`** ([`buildSearchPayload.ts`](../src/modules/search/lib/buildSearchPayload.ts)) :
> dès qu'un `baseParams` porte un `costumSlug`, les entités en attente de validation
> (`preferences.toBeValidated.<slug>`) sont **masquées**. Opt-out : `showUnvalidated:true`.

---

## 4. Cahier des charges (intégré)

### 4.1 Constat et objectifs

**Limites** : recherche peu efficace · gestion des contenus chronophage · outils non reliés
(WordPress, GoGoCarto…) · faible capacité de contribution directe des acteurs.
**Objectifs** : conserver les qualités actuelles · améliorer l'UX · ajouter des modules intégrés ·
moteur de recherche performant · centraliser les ressources · faciliter la contribution ·
**maintenir le référencement**.

### 4.2 Exigences par domaine (proposition retenue au CDC)

| Domaine | Exigence CDC | Proposition retenue |
|---|---|---|
| **Pages statiques** | Réseau, équipe & contact, **présentation de chaque territoire (contact + communes)**, champs d'action, charte | Recréées côté SiteForge (contenus extraits du WP) |
| **Parcours** | Entrée **pro** et entrée **parents** | Pages `/parents` et `/pro` (accessibles depuis l'accueil) |
| **Moteur de recherche** | types d'info · public (âge) · dates · territoire coloré · carte filtrable · thème | `/recherche` (searchProStatic), sur le modèle `tierslieux.00.re/lieux` |
| **Paroles de parents** | audio + écrit, 3 types (Compliqué / Difficile / Ce qui est à changer), transcription, **ajout admin** | POI `affiche`, page `/temoignages`, form `parent62-affiche` + pile audio (approche Thomas) |
| **Articles** | forte activité, filtrage + liens ressources | WordPress pour la rédaction, **une entrée réseau par article** (moteur de recherche) |
| **Événements** | agenda par territoire · impression · récurrence · **ajout partenaires modéré** | `/agenda` + form `parent62-event` ; récurrence côté réseau social |
| **Ressources** | vidéos/photos, PDF, jeux ; filtres fins par territoire/ville | `/ressources` + form `parent62-recovery-center` (POI `recoveryCenter`) |
| **Annuaire partenaires** | référencement + cartographie | `/annuaire` + form `parent62-partenaire` modéré (P2, livré le 22/09, §9octotricies) |
| **Publication RS / Mailing** | — | **Non engagé** (conseil : n8n) |

### 4.3 Déroulé et budget

| Partie | Budget | Contenu | Durée |
|---|---|---|---|
| **Partie 1** | 3 000 € | lancement `reseau.parent62.org` · module Paroles (admin) · moteur V2 territorial | 3 sem. bêta |
| **Partie 2** | 4 500 € | module événementiel · module actualités (interop WP) · recherche events+actus, accueils | 2 sem. bêta |
| **Partie 3** | 2 000 € | module ressources · recherche ressources | — |
| Autres | 2 500 € | hébergement + maintenance 1 an · retours/bugs · coordination | — |

---

## 5. Modèle de données réel

> Constaté sur le dump de production restauré en local (base `prod200726`), **en lecture seule**,
> le 20/07/2026. Chiffres du dump.

### 5.1 Périmètre

| Collection | Docs `source.key = "parent62"` | Types |
|---|---|---|
| `poi` | **6 434** | `article` uniquement |
| `news` | 6 434 | `activityStream` (traces d'import) |
| autres | 0 | — |

**Aucun** POI `affiche` (paroles), aucune structure, aucun événement, aucune ressource au 20/07.
La clé `parents62` (avec un **s**) n'existe sur **aucun** document — slug de dev abandonné.

### 5.2 Les 4 champs transverses (convention du 20/07)

La taxonomie vit dans des **champs de premier niveau**, mêmes noms sur tous les types :

| Champ | Type | Source des valeurs |
|---|---|---|
| `territoires` | `string[]` | `costum.lists.territoires` (10 valeurs) |
| `publics` | `string[]` | `costum.lists.publics` (7 valeurs) |
| `themes` | `string[]` | `costum.lists.themes` (18 valeurs) |
| `tags` | `string[]` | libre (mots-clés WordPress) |

**Territoires** (nb d'articles) : Boulonnais 1 075 · Entre Mer et Terres 990 · Arrageois 761 ·
Audomarois 680 · Calaisis 653 · Familles en sol mineur Lens Liévin 563 · Ternois Bruaysis 538 ·
Artois 502 · Familles en sol mineur Hénin Carvin 306 · **Familles en sol mineur** (générique) 43
← *10e valeur, arbitrage réseau en attente*.
**Publics** : Parents 2 680 · Parents-enfants 1 467 · En famille 1 303 · Enfance 1 091 ·
Professionnels 524 · Futurs parents 343 · Bénévoles 73.
**Thèmes** (18) : Les activités supports à la relation 1 974 · La petite enfance 1 333 …
Le deuil 6.

> ⚠️ **Encodage.** Les libellés utilisent l'apostrophe typographique **U+2019** (`L’école`) et un
> tiret demi-cadratin (`Les écrans – Le numérique`). Un filtre écrit avec une apostrophe droite
> renvoie **0 résultat sans erreur**. Copier-coller depuis `costum.lists`, ne jamais retaper.

Parmi ces 3 listes, seule `themes` est éditable (ajouter/renommer/réordonner/supprimer une valeur)
depuis `/admin` → onglet « Listes », sans passer par la base — cf. §9octies. `territoires`/`publics`
sont volontairement **hors de cet écran** (`props.lists` restreint la section à `themes` et
`categoriesParole` — cette dernière porte le champ `category` de `parent62-affiche`, hors des « 4
champs transverses » ci-dessus, cf. §9septies) : seules les 2 listes que les admins font **grandir
par saisie libre** y sont exposées, pas les taxonomies plus stables. `themes` reste statique pour
l'instant ; sa conversion éventuelle en recette dynamique (§13, dernière ligne) la basculerait
automatiquement en lecture seule dans cet écran (détection `isDynamicList`), sans action requise
côté admin.

### 5.3 Le costum backend

Embarqué dans le document de l'orga (`organizations.costum`). Au 20/07, `typeObj` ne contenait que
`article`. L'approche retenue (Thomas, main) déclare désormais les formulaires costum
`parent62-affiche`/`-article`/`-recovery-center`/`-event` côté **config** (dynForm), adossés aux
`typeObj` backend — dont le déploiement effectif en base reste à confirmer (cf. §11).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| **Config & CSS** | [`config.prod.parent62.json`](../config.prod.parent62.json), `src/index-parent62.css`, [`sites.json`](../sites.json) |
| **Recherche (apports MR conservés)** | `src/modules/search/schema.ts` (`FilterGroup.field`, `searchTargets`, `dateRange`, `ColorByConfSchema`, `TagColorsConfSchema`), `lib/colorBy.ts`, `lib/computeFiltersFromUrl.ts`, `lib/computeUrlFromFilters.ts`, `lib/filterToggles.ts`, `hooks/useFilterToggles.ts`, `components/card/CardDefault.tsx` |
| **Parole / ressource / event (main canonique)** | `components/card/CardTestimonial.tsx`, `CardResource.tsx`, `preview/PreviewTestimonial.tsx`, `PreviewResource.tsx`, `lib/testimonial.ts`, `hooks/useResource*.ts`, `modules/agenda/*`, `components/media/*` (AudioPlayer/Recorder…) |
| **Rendu par item / action au clic (25/07)** | `src/lib/entityMatch.ts` (+ `.test`), `src/modules/search/lib/resolveListItemConf.ts` (+ `.test`), `lib/itemAction.ts` (+ `.test`), `tests/preflight/list-item-rules.test.ts` ; modifs `schema.ts` (`CardConfSchema` extrait, `ListItemRuleSchema`, `ListItemActionSchema`), `components/SearchListView.tsx`, `SearchCard.tsx`, `Preview.tsx`, `SearchMap*.tsx` ; outillage `scripts/lib/prop-descriptions.ts`, `scripts/audit-config.ts`, `scripts/lib/config-blocks.ts` |
| **Territoires** | `src/data/territoires62.ts` (+ `.test`), `scripts/import-communes-territoires62.ts` |
| **Lien « voir tous » d'un `customHeader` (03/09)** | `src/modules/search/lib/viewAllHref.ts` (+ `.test`, neufs), `src/modules/search/SearchProStatic.tsx` (délégation du `useMemo`) |
| **Deep-link de filtre — id d'option vs libellé (03/09)** | `tests/preflight/deeplink-filters.test.ts` (neuf) ; les 9 `linkHref` de `config.prod.parent62.json` |
| **Teaser d'agenda — `limit` vs `indexStepList` (03/09)** | `src/modules/agenda/schema.ts` (contrat + 2 commentaires périmés), `scripts/lib/prop-descriptions.ts`, `doc/29-module-agenda.md`. **Aucune config d'un autre projet n'est touchée** |
| **Header** | `src/components/layout/header/HeaderTransparentScroll.tsx` (fix lisibilité) |
| **Refonte accueil/header/footer (06/08)** | `src/components/layout/header/HeaderStacked.tsx` (neuf), `src/components/layout/footer/FooterMinimalCentered.tsx`, `src/components/sections/MapBubbles.tsx` (neuf), `src/modules/search/sections/FeaturedCarouselSection.tsx`+`FeaturedCarouselSlide.tsx` (neufs), `src/modules/search/lib/featuredCarouselFilters.ts` (+`.test`, neufs), `src/modules/blog/sections/ArticleTeaser.tsx` (neuf), `src/modules/blog/lib/articleLink.ts` (+`.test`, neuf, extrait d'`ArticleFeed.tsx`) ; schémas `src/types/site-schema.ts` (`MapBubblesSchema`, `Header.backgroundImage/textColor/logoTitleAccent`, `Footer.backgroundImage`), `src/modules/search/schema.ts` (`FeaturedCarouselSectionSchema`), `src/modules/blog/schema.ts` (`ArticleTeaserSectionSchema`) ; câblage `src/components/layout/SiteHeader.tsx`, `src/components/sections/SectionRenderer.tsx`, `src/components/admin/section-meta.ts` ; `src/index-parent62.css` (breakpoint `xs`, `@layer base`, police) |
| **Ajustement hauteur header/à la une (13/08)** | `src/components/layout/header/HeaderStacked.tsx` (`min-h` désormais `xl:`-only, échelle logo/titre/sous-titre), `src/modules/search/sections/FeaturedCarouselSection.tsx`+`FeaturedCarouselSlide.tsx` (padding réduit, `object-contain`, ratio `16/10`) (§9quinquies) |
| **Champ dynamique thème/catégorie** | `src/components/ui/select-objet.tsx` (widget `SelectObject`, générique, utilisé entre autres par les listes dynamiques costum — feature `9e789e38`) |
| **Dédoublonnage territoire « Familles en sol mineur » (13/08)** | `config.prod.parent62.json` (nav, filtres `enum`, `TagColorsConfSchema`, logo), `src/index-parent62.css` (variable `--territoire-familles-en-sol-mineur`) (§9quinquies) |
| **Thèmes/catégorie en saisie libre, promotion admin (25/08)** | `config.prod.parent62.json` (`widgetProps.saveNewValue`/`list`, `optionsKey` sur 23 filtres, `afterSubmit` par formulaire) ; nouveaux `src/modules/profil/forms/costum/parent62/fns.ts` (+ `.test.ts`), `src/hooks/useCostumLists.tsx` (+ `.test.tsx`), `src/modules/profil/forms/fields/valueSelectAccess.ts` (+ `.test.ts`) ; modifs `src/modules/profil/forms/fields/ValueSelectField.tsx`, `src/modules/profil/forms/registerWidgets.tsx`, `src/modules/profil/forms/registerSpecFns.ts`, `src/modules/search/hooks/useDynamicFilterOptions.ts`, `src/modules/search/schema.ts` (`optionsKey`), `src/modules/search/lib/dropdownFilters.ts` (`mergeDeduped`, + `.test.ts`), `src/lib/costumLists.ts` (§9septies) |
| **Section admin « Listes » — moteur générique, pilote parent62 (25/08)** | `config.prod.parent62.json` (nouvel onglet `admin.tabs` `{id:"listes", sections:[{type:"lists", props:{lists:[{key:"themes",label:{…}},{key:"categoriesParole",label:{…}}]}}]}`) ; nouveaux `src/modules/admin/sections/AdminListsSection.tsx`, `src/modules/admin/hooks/useCostumListsMutations.ts` (+ `.test.tsx`), `src/modules/admin/lib/costumListsEditing.ts` (+ `.test.ts`, dont `toListRef`/`findListLabel`) ; modifs `src/modules/admin/AdminSectionRenderer.tsx` (`registerAdminSection("lists", …)`), `src/modules/admin/i18n/{fr,en}.json` (groupe `AdminLists`) — doc moteur : [doc/30-module-admin.md](../doc/30-module-admin.md) §`lists` (§9octies) |
| **Rattrapage gates `config-assistant` — drift territoire (25/08)** | `.claude/skills/config-assistant/page-recipes.json` (recette `page-annuaire-grille` : `path`/`sequence`/`rythme` recalés), `.claude/skills/config-assistant/examples/{admin,command-palette,list-item-rules,list-testimonial}.json` (resynchronisés) (§9novies) |
| **Type d'actualité — appels à projets / offres d'emploi (02/09)** | **Config** `config.prod.parent62.json` : champ `category` (`select`, 3 valeurs) + `mutation.stamps` `$mapLabels` sur `tags` dans `costumForms.parent62-article`, 2 onglets `admin.tabs` (`appels-projets`, `offres-emploi` — `source.defaultTags`, `createDefaults`). **Moteur** (générique, tout site) : `src/modules/profil/forms/createDefaults.ts` (+ `.test.ts`, neufs), `src/modules/profil/forms/EntityFormModal.tsx`, `src/modules/profil/components/add/ModalRegistry.tsx`, `src/modules/admin/schema.ts`, `src/modules/admin/sections/AdminResourceTable.tsx`, `scripts/lib/prop-descriptions.ts` ; snapshots `tests/preflight/{stamps.test.ts,effective-config.test.ts,__effective__/parent62.json}`, `.claude/skills/config-assistant/examples/admin.json` — doc moteur : [doc/28](../doc/28-module-formengine.md) §`mutation.stamps` et [doc/30](../doc/30-module-admin.md) §`createDefaults` (§9sexdecies) |
| **Double entrée parents / pro rétablie sur l'accueil (02/09)** | `config.prod.parent62.json` (section `action-tiles` `home-double-entree` réinsérée sur `pages[/].sections[1]`) ; `.claude/skills/config-assistant/page-recipes.json` (recette `home-a-la-une` resynchronisée : séquence + `titre`/`quand`/`rythme`) — gate `tests/preflight/page-recipes.test.ts` (§9septendecies) |
| **Types de ressources — 2 ajouts + renommage (03/09)** | `config.prod.parent62.json` : `costumForms.parent62-recovery-center.fields.category.enum` (6 → 8 valeurs) et les 3 blocs `list.resource.badge` (`/ressources`, `/recherche` via `itemRules[2]`, `commandPalette.entitySearch.itemActionBySubType.recoveryCenter`) ; snapshots `.claude/skills/config-assistant/examples/{command-palette,list-item-rules,list-resource}.json` resynchronisés (§9octodecies) |
| **Annuaire des partenaires + filtre « Villes » (22/09)** | `config.prod.parent62.json` : page `/annuaire`, `costumForms.parent62-partenaire`, `profiles.organizations.editModals`, onglet `admin.tabs` « partenaires », entrée de menu, page `/communaute` et son entrée de menu retirées, case « Rejoindre le réseau » de `/pro` vers `/annuaire`, villes au survol de « Entre Mer et Terres », `costumSlug` sur la liste de `/recherche`, champ `villes` de `parent62-article` et filtre de `/blog` ; `tests/preflight/filter-form-values.test.ts` (neuf) ; `e2e/parent62.spec.ts` ; skill `config-assistant` : `page-recipes.json` (recette `page-communaute-onglets` → eXtremeDefiAdeme), exemples `admin.json` et `list-item-rules.json` ; instantané `tests/preflight/__effective__/parent62.json` ; base locale : `costum.typeObj.organizations` et `typeObj.article.villes` (§9octotricies) |
| **Tests** | `e2e/parent62.spec.ts`, `src/modules/search/lib/colorBy.test.ts`, `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` |
| **Déploiement** | `server/prod-server.js`, `server/lib/sitemap.js`, `.env` (`VITE_SLUG`, `VITE_BASE_URL_BACKEND`, `SITE_CONFIG_PATH`, `VITE_SITE_PUBLIC_URL`) — dérivable via `npm run deploy:env` (`scripts/lib/sites.ts`) |

---

## 7. Choix techniques et leur pourquoi

| Décision | Pourquoi |
|---|---|
| **`main` canonique pour parole/ressource/event/audio** | Thomas (chef de projet) a développé l'approche **générique et config-driven** sur `main` (contrats `testimonial`/`resource`, pile audio mutualisée) ; elle suit la philosophie moteur (« noms de design, jamais de site ») et sera maintenue |
| **Slug unique `parent62`** | clé des 6 434 articles et de l'orga ; `parents62` ne référence aucune donnée |
| **Taxonomie en champs, pas en tags** | 5 261 articles portent déjà `territoires[]` ; le moteur filtre par champ sans code |
| **Toujours des tableaux** pour les 3 taxonomies | la base contient des multi-valeurs ; un select mono écraserait un tableau à l'édition |
| **`searchTargets`/`dateRange` conservés (apport MR)** | absents de `main` ; portent la cible « type d'info » par défaut sans tag fantôme + le filtre par plage de dates |
| **`colorBy`/`tagColors` conservés (apport MR)** | consommés par les chips `/recherche` (`CardDefault`) et la carte (`markerVisual`) — pas un doublon des badges `testimonial` |
| **Pages territoire à paths littéraux** | `SiteRenderer` résout par égalité stricte — pas de route paramétrée |
| **Référentiel territoires versionné front** | source unique libellés/couleurs (`var(--territoire-*)`)/887 communes ; jamais d'hex en dur |
| **Une règle de rendu porte SA tranche complète** (carte + preview + contrat + action) | carte et détail sortent de la MÊME résolution → l'incohérence entre ce qu'on voit dans la grille et ce qu'on voit au clic devient impossible par construction |
| **Faire varier la valeur de `list`, plutôt qu'ajouter une prop** | tout l'aval (`SearchCard`, `Preview`, `SwitchDetailsMode`, presenters typés) reste inchangé ; sans règles, `list` est renvoyé **par identité référentielle** → non-régression prouvable (`toBe(list)`) pour les ~13 autres sections search du site |
| **Une actualité ouvre le reader blog, pas un drawer** | un POI `type:"article"` a déjà sa page canonique `/blog/:slug` (SSR + SEO) ; la rouvrir en drawer dupliquerait l'UX et perdrait le référencement |
| **`/public/*` scope par le champ `publics` existant, pas un nouveau champ** (06/08) | les valeurs de `publics` (§5.2 — 7 à l'origine, **9 depuis le 09/09**, cf. §9tervicies) sont déjà portées par les articles ; une page par valeur (`filters:{publics:{$in:[...]}}` sur `articleFeed`) est purement config-driven, zéro donnée/costum neuf |
| **`/appels-a-projets` et `/offres-emploi` filtrent par `tags`, pas par un champ dédié** (06/08) | même convention que les pages `/theme/*` existantes (mots-clés WordPress libres, cf. §2) ; pas de nouvelle taxonomie pour deux catégories de contenu ponctuelles |
| **`background`/`accentColor` en couleur FIXE (hex), jamais `text-foreground`** (`featured-carousel`, `articleTeaser`, 06/08) | ces blocs posent un fond marine fixe pour rester de la même famille visuelle sur toute la home ; `text-foreground` s'inverserait en mode clair et deviendrait illisible sur un fond sombre qui, lui, ne s'inverse pas |
| **Wordmark header en 2 segments (`logoTitle`+`logoTitleAccent`)** (`stacked`, 06/08) | rendre « parent » (contour) + « 62 » (plein) séparément, en couleurs fixes indépendantes du mode, sans dupliquer tout le champ `logoTitle` ni coder le découpage en dur dans le composant |
| **Liste statique + écriture front, plutôt que recette dynamique backend** (thèmes/catégorie, 25/08) | la conversion en recette dynamique (le mécanisme "propre", déjà éprouvé sur institut-bleu) est hors de portée depuis `site-json` seul |
| **`saveNewValue` config-driven, `false` par défaut** (25/08) | opt-in explicite par champ, introspection du descripteur du formulaire plutôt qu'une liste de champs codée en dur en TS — un futur champ `valueSelect` n'écrit dans aucune liste partagée sauf déclaration explicite en config |
| **`saveNewValue` restreint aussi `creatable` aux admins** (25/08) | un visiteur non-admin sur un champ qui promeut vers la liste partagée ne doit pas pouvoir taper une valeur inédite — sinon la saisie serait acceptée sur sa fiche mais jamais partagée, incohérence silencieuse |
| **Réactivité via les signaux natifs du SDK (`useReactiveProperty`), pas un store maison** (25/08) | réutilise un mécanisme déjà éprouvé (~14 usages dans le repo) plutôt que d'en inventer un parallèle ; `carrier.refresh()` suffit, `_setData` préservant les signaux réactifs sur le même proxy — aucun nouveau `setEntity`/contexte |
| **Le type d'annonce est porté par `category`, pas par `type` ni par un champ ad hoc** (02/09) | le champ POI `type` est **hors d'atteinte** : le module blog le pose en dur et le déclare non surchargeable ([`useArticleFeed.ts`](../src/modules/blog/hooks/useArticleFeed.ts), [`configSchema.ts`](../src/modules/blog/configSchema.ts), [`server/feed.ts`](../src/modules/blog/server/feed.ts)) — une annonce sortie de `type:"article"` quitterait `/blog`, `/actualites`, les `/theme/*`, le RSS, le reader et la cible « Actualités » de `/recherche`. Un champ inventé, lui, est refusé par le `DraftProxy` du SDK (absent du contrat lib **et** des `properties` du digest costum) et retiré du payload `element/save`. `category` est le vecteur désigné par le moteur ([`blog/schema.ts`](../src/modules/blog/schema.ts) : « filtre serveur additionnel, ex. `{category:"actus"}` ») et déjà écrit par 2 autres forms du site : il persiste, revient à l'édition, et un seul formulaire suffit |
| **Pré-remplissage par l'onglet via une capacité MOTEUR (`createDefaults`), pas un formulaire cloné par sous-type** (02/09) | `fields.<nom>.default` ne porte qu'UNE valeur pour tout le formulaire, et l'onglet n'avait aucun canal vers la modale de création (`AdminResourceTable` ne passait que `modalName`/`parent`). Plutôt que de re-dupliquer ~490 lignes de config par sous-type, ~20 lignes de moteur ouvrent un semis déclaratif réutilisable par tout site. Semis en **ajout seulement** (en édition l'entité fait foi) et **filtré sur les champs réellement déclarés** par le formulaire, pour qu'une faute de frappe en config soit inerte au lieu d'injecter une valeur fantôme |
| **Tag d'annonce posé par `mutation.stamps` `op:"append"` / `on:"both"`** (01/09) | seul `op` qui **compose** au lieu d'écraser : union dédupliquée entre le libellé, les mots-clés saisis et les tags déjà en base (`targetServerData`). `on:"both"` le repose à chaque enregistrement — une annonce ne peut pas sortir de sa page publique par une édition. (`op:"set"` est d'ailleurs interdit sur un champ visible en édition, gate `stamps.test.ts`) |

---

## 8. Étapes de mise en place

1. **Config** : `config.prod.parent62.json` + `src/index-parent62.css` référencés dans `sites.json`
   (slug `parent62`).
2. **Données** : import WordPress → 6 434 POI `article` (`source.key=parent62`) ; taxonomie mappée
   sur `territoires`/`publics`/`themes` via `costum.import.mapping`.
3. **Formulaires costum** : déclarés en config (`costumForms{}`), compilés par `registerCostumForm`
   (voie unique runtime = test), fns génériques via `registerSpecFns`.
4. **Validation** (gates, dans `site-json/`) :
   `npm run config:validate` · `npm run audit:config` · `npm run typecheck` · `npm run lint` ·
   `npm run test:unit` · `npm run build`. E2E ciblé : `npx playwright test e2e/parent62.spec.ts`
   (jamais la suite e2e complète — specs d'autres devs).
5. **Déploiement (1.10, à la main de Peterson)** :
   - DNS `reseau.parent62.org` → serveur de prod.
   - Build : `VITE_SLUG=parent62` + `VITE_BASE_URL_BACKEND=<backend prod>` **sans guillemets**
     dans le `.env` (une valeur quotée fait échouer le préflight `environment` et se retrouve dans
     le bundle).
   - Serveur (`server/prod-server.js`) : `SITE_CONFIG_PATH=./config.prod.parent62.json`
     (**obligatoire**) et `VITE_SITE_PUBLIC_URL=https://reseau.parent62.org` (nouvelle variable,
     merge du 03/08, `be7a320c`) — **l'URL publique du site-json lui-même** : canonical,
     `og:url`/`og:image`, `sitemap.xml`, flux RSS. Lue par `getSitePublicUrl()`
     ([`src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et
     [`server/lib/sitemap.js`](../server/lib/sitemap.js) ; repli `getServerUrl()` si absente
     (comportement historique) ; l'ancien nom `SITE_PUBLIC_URL` n'est plus accepté qu'en repli
     legacy par `sitemap.js`. **Ne PAS confondre avec `VITE_SERVER_URL`** (= serveur communecter :
     images `/upload`, embed co2, cagnotte), qui garde sa valeur parc.
   - ⚠️ `npm run deploy:env` dérive `VITE_SITE_PUBLIC_URL` de `sites.json` (`aliases[0]`
     prioritaire, sinon `domain`) — or l'entrée `parent62` n'a **pas d'`aliases`** et déclare
     `domain: parent62.00.re` : la dérivation donnerait `https://parent62.00.re`. Pour
     `reseau.parent62.org`, déclarer l'alias dans `sites.json` ou poser la variable à la main (§13).

---

## 9. Impacts des modifications — réconciliation MR ↔ main (24/07)

Le merge `main` → `parents62` (`347f853`) était propre côté git mais **redondant** : la config
unionnait les deux approches. Décision **« main canonique »**. Réalisé :

### 9.1 Réparation d'un conflit de merge (build cassé)

`src/modules/search/schema.ts` référençait `ColorByConfSchema`/`TagColorsConfSchema` **sans leurs
définitions** (perdues à la résolution du conflit) → `config:validate`/`build` en `ReferenceError`.
Définitions **restaurées** (apport MR `b0e8062`) juste avant `ListConfSchema`.

### 9.2 Doublons du MR retirés (au profit de la version de Thomas)

| Retiré (MR) | Conservé (main, canonique) |
|---|---|
| Page `/paroles` (+ sections `type:"parole"`) | Page `/temoignages` |
| Form `parent62-parole` + champ `paroleAudioUrl` + transforms `parent62:audioUrlRead/omit/mediasWrite` | Form `parent62-affiche` |
| `PreviewParole.tsx` (+ `case "parole"` de `Preview.tsx`) | `PreviewTestimonial.tsx` |
| Pile audio `ui/audio-player.tsx` + `lib/audioPlayerUtils.ts` (+ test) | `components/media/AudioPlayer`/`AudioRecorder` |
| `costum/parent62/fns.ts` (+ import dans `registerSpecFns.ts`, entrée fixture `configCostum.ts`) | — (config-only) |
| Entrée nav top-level « Paroles » → `/paroles` ; 2 CTA `/paroles` **repointés** → `/temoignages` | Entrée « Paroles de parents » → `/temoignages` (menu « Contenus ») |
| **Page `/agenda` en double** (path dupliqué, `config:validate` exige des paths uniques) | Page `/agenda` de Thomas (module agenda + `parent62-event`) |

### 9.3 Apports du MR conservés (absents de `main`)

Couche `searchTargets`/`dateRange`, coloration `colorBy`/`tagColors`, **fix header transparent**,
**suite e2e**, **territoires62** (data + import + 9 pages `/territoire/*`), pages `/recherche`,
`/parents`, `/pro`, `/communaute`.

### 9.4 Régressions à revalider (visuel, hérité du merge)

Sous-titre `TitleSection` (`<h3>` gras → `<p>` muted), carte Leaflet → MapLibre
(`streets-v2` → `streets-v4`), onglet Galerie de profil réellement rendu, droits d'édition élargis
aux admins costum.

### 9.5 Nav consolidée + audit fonctionnel (24/07)

- **Nav** : doublon `/blog` résolu — « Actualités » (MR) remplacée par le dropdown « Thèmes »
  canonique de Thomas. Nav = 5 entrées (cf. §12).
- **Audit fonctionnel sur la stack** (dev server :5173 + backend `communecter74-dev` up) : les
  35 pages rendent en **200 sans erreur SSR** ; **e2e 7/7 vert** (accueil nav 5 entrées,
  `/recherche` ×2, `/temoignages`, `/territoire/arrageois`, `/blog`, mode sombre). Les statuts
  P2/P3 ont été revus à cette occasion (§10) — plusieurs sont plus avancés que la config seule
  ne le laissait penser (récurrence, recherche ressources, modération events câblées).

### 9.6 Validation (gates)

`config:validate` ✅ (35 pages, 153 sections) · `audit:config` ✅ (0 constat parent62) ·
`typecheck` ✅ (0) · `build` ✅ (48 s) · **e2e 7/7 ✅**. `test:unit` : 1834 ✅, 2 échecs
**pré-existants hors périmètre** (`bundle-size` 2,43 MB — bloat du merge ; `environment` `.env`
quoté). `lint` : 4 erreurs **pré-existantes** identiques à `main` (`blog/ArticlePage`,
`ArticleFeed`, `ArticleReaderSection`, `.design-sync/`) — code de Thomas, hors périmètre.

---

## 9bis. Impacts — rendu par item de la recherche globale (25/07)

> Lot `feat/search-item-rules` : `caa0a364` (moteur), `fd3d9a4c` (config parent62),
> `7017dc77` (doc + skill). **Intégré à `main`** depuis — les 3 commits figurent dans
> l'historique first-parent de `main` (constaté le 03/08).

### 9bis.1 Le constat

Les pages **dédiées** par type fonctionnaient (`/blog`, `/temoignages`, `/ressources`, `/agenda`,
`/communaute`). La seule défaillante était `/recherche`, pour trois raisons cumulées, toutes dans sa
config :

| Symptôme | Cause | Preuve |
|---|---|---|
| Filtre « Paroles » : **liste vide** | la cible portait `defaultFilters: {type:"affiche", **status:"validated"**}`, or `status` n'existe pas sur ces documents — la modération a priori avait été retirée (`17aea3e`) et le filtre était resté orphelin | `{type:"affiche"}` seul renvoie les paroles ; `+ status` en renvoie **0**, sans erreur |
| Actualités : carte générique, clic vers un drawer | `list.card.type:"default"` valait pour les 4 collections ; aucun `preview`, aucun bloc de presenter | comparaison ligne à ligne avec `/blog`, `/temoignages`, `/ressources` |
| Ordre arbitraire | ni `defaultSortBy` ni `defaultFields`, là où les trois pages dédiées déclarent les deux | idem |

### 9bis.2 Ce qui a changé

**Moteur** (`src/`) — le choix du presenter devient config-driven et **par item** : `list.itemRules`
(règles à prédicat) + `list.itemAction` (`preview` / `profil` / `link`). Le trio *(vue matchable +
première règle + garde)* est extrait en `src/lib/entityMatch.ts`, désormais partagé avec les
`iconRules` de la palette (qui n'avaient aucun test et en héritent). La cascade de décision au clic
est une fonction pure partagée par la liste et la popup de carte, qui l'appliquaient en double.

**Config parent62** — `status` retiré de la cible « Paroles » ; cible « **Ressources** » ajoutée
(elle manquait alors que `/ressources` existe) ; `defaultSortBy {created:-1}` + `defaultFields`
(25 champs) ; **5 règles** : `poi-article` (presenter `resource` + clic vers `/blog/:slug`),
`poi-parole` (testimonial en dialog), `poi-ressource`, `events`, `structures`.

**Deux bugs préexistants corrigés au passage** :
- `list` n'était pas transmis au détail ouvert **depuis la carte géographique** → les previews
  config-driven (`resource`/`testimonial`) y retombaient sur les défauts génériques ;
- l'identité d'item **divergeait** entre l'écriture de `?preview=` (`getEntryId`) et sa relecture
  (`serverData.id ?? id`), or `serverData.id` n'est pas toujours peuplé → un deep-link pouvait ne
  pas rouvrir son item. Unifié sur `getEntryId`.

**Outillage** — `baseParams.defaultFields` enfin décrit dans le registre de props (c'est la clé dont
dépend tout le matching, elle n'y était pas) ; ratchet de couverture remonté 45→60 et 57→72 ;
`audit:config` contrôle désormais `itemAction.to`/`toById` ; nouveau préflight
`tests/preflight/list-item-rules.test.ts` — **seul endroit où `ListItemRuleSchema` est réellement
exécuté**, la config n'étant jamais parsée par Zod au runtime.

### 9bis.3 Régressions à revalider

- **`defaultFields` introduit là où il n'y en avait pas** : la projection devient restrictive sur
  `/recherche`. Recette visuelle faite sur les 6 familles (liste hétérogène + chaque cible) — à
  refaire si un champ est ajouté à un presenter.
- **Chemin carte non vérifiable** : aucune famille de ce jeu de données n'est géolocalisée (la vue
  carte affiche « Aucun résultat » pour les actualités comme pour les structures). L'action au clic
  depuis la popup est donc couverte **par tests unitaires uniquement** — à revalider dès que des
  données porteront des coordonnées.

### 9bis.4 Validation (gates) — mesurés le 25/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 35 pages, 153 sections |
| `audit:config` | ✅ parent62 **RAS** (0 constat) |
| `typecheck` | ✅ |
| `test:unit` | ✅ **1977** sur 155 fichiers — dont `bundle-size` et `environment`, les **2 échecs pré-existants du 24/07, désormais verts** |
| `build` | ✅ client 33,7 s + SSR 15,5 s |
| `e2e` | ✅ **7/7** (57,1 s) sur la stack réelle — `npx playwright test e2e/parent62.spec.ts` |
| `lint` | 29 erreurs / 47 warnings, **0 sur les fichiers du lot** — pré-existantes et identiques à `main` (`blog/*`, `agenda`, `.design-sync/`, `ds-bundle/`, `admin/zod-auto-form`, `entityIcons`, `profil/forms`) |

---

## 9ter. Impacts — hygiène CSS du thème (27-30/07) et état au 03/08

Deux correctifs de Thomas sur `main` — les **seuls commits touchant les fichiers du projet depuis
le 25/07** (`git log 4e6e0f3c..HEAD -- config.prod.parent62.json src/index-parent62.css …`). La
config `config.prod.parent62.json` est **inchangée** : 35 pages / 153 sections, 4 `costumForms`
(revérifié le 03/08).

### 9ter.1 `79dc4637` (27/07) — palette dupliquée retirée du CSS

`src/index-parent62.css` redéclarait en `:root`/`.dark` les 46 + 32 tokens que `config.theme`
injecte déjà au runtime via `SiteTheme` (−115/+14 lignes) — même palette écrite deux fois, risque
de divergence silencieuse. Vérifié avant coupe : les 46 variables retirées ont toutes un équivalent
parmi les 54 injectées (diff d'ensembles contre le `<style id="site-theme">` réellement servi).
Piège relevé : `--radius` vient de `theme.borderRadius.base`, pas d'un `theme.radius`. Les ombres
teintées indigo supprimées étaient **mortes** (les ombres neutres de la config l'emportaient) —
les promouvoir dans `theme.shadows` reste une décision de design, consignée en commentaire.
Rendu comparé avant/après sur `/temoignages`, clair et sombre : **identique**.

### 9ter.2 `53f28ca1` (30/07) — `.access-card` devient un plancher partagé

`HeroQuickAccess` émet `access-card access-card-{public|pro}`, mais la classe n'était définie que
dans 2 feuilles de thème (parent62, sport-santé) sur 5 configs utilisatrices → cartes « nues »
ailleurs, panne silencieuse qu'aucun test ne voit. Le traitement **parent62** (verre translucide,
lift doux) est déplacé tel quel dans `src/styles/shared.css` (`@layer components`), entièrement
piloté par les tokens injectés au runtime (`--card`/`--border`) ; le bloc local
d'`index-parent62.css` est retiré, devenu identique. **parent62 vérifié inchangé** en navigateur
(le commit corrige saint-paul-sport, pas parent62).

### 9ter.3 Régressions à revalider

Aucune spécifique parent62 : les deux commits annoncent un rendu comparé identique. À garder à
l'œil lors de la prochaine recette visuelle : cartes d'accès rapide de l'accueil (verre
translucide) et palette indigo en clair **et** sombre (les tokens ne viennent plus que de
`config.theme`).

### 9ter.4 Validation (gates)

| Gate | 30/07 (commit `53f28ca1`) | 03/08 (post-merge `fix/institut-bleu-ui`, mesuré ce jour) |
|---|---|---|
| `lint` | ✅ 0 erreur | ✅ **0 erreur** / 18 warnings |
| `typecheck` (`tsc -b`) | ✅ | ✅ |
| `test:preflight` | ✅ 331 tests | ✅ **412 tests / 22 fichiers** (4,4 s) |
| `test:unit` | ✅ 2090 tests | non relancé le 03/08 |
| `config:render` parent62 | ✅ 153/153 sections | — (config inchangée) |

---

## 9quater. Impacts — refonte accueil/header/footer + pages Publics (06/08)

> **Chantier committé sur `parents62`** le 06/08 (18 fichiers modifiés + 8 fichiers de code
> neufs + assets). Validation automatisée (gates) faite, cf. §9quater.3. **Validation fonctionnelle/visuelle
> (recette) et auteur du design original (Peterson/Thomas ?) restent à confirmer avant fusion
> dans `main`.**

### 9quater.1 Ce qui a changé

**Accueil (`/`)** — passe de 7 sections (`hero-quick-access`, 2×`action-tiles`,
`cta-card-grid`, `html`, `articleFeed`, `cta`, `layout:"default"`) à **3 sections data-driven**
(`layout:"fullwidth"`) :
1. `featured-carousel` (id `home-featured-poi`) — carrousel plein écran des POI tagués
   `"A la une"` (`sourceKey:["parent62"]`), CTA vers `/blog/:slug` ou `/blog/id/:id`, fond
   `#2c3e50`/accent `#4ecdc4`, autoplay 6 s.
2. `map-bubbles` (id `carte-territoires`) — carte illustrée (`carte-territoire-teal.webp`) +
   9 bulles-marqueurs cliquables (positions `x`/`y`/`size` en %, calibrées à la main sur la
   maquette — **ne pas les retoucher sans re-regarder le rendu**) vers les 9 pages
   `/territoire/*`, dégradé de fond `--p62-map-bg-from/to`.
3. `articleTeaser` (id `zoom-reseau`) — aperçu figé des 6 derniers articles du costum
   (sans pagination), CTA « voir tout » vers `/blog`.

**Trois types de section neufs**, tous génériques (moteur, pas parent62-only) :

| Type | Schéma | Composant | Doc |
|---|---|---|---|
| `featured-carousel` | `src/modules/search/schema.ts` (`FeaturedCarouselSectionSchema`) | `src/modules/search/sections/FeaturedCarouselSection.tsx` + `FeaturedCarouselSlide.tsx`, filtre `lib/featuredCarouselFilters.ts` (+ `.test.ts`, 10 tests ✅) | — (à ajouter à doc/07) |
| `map-bubbles` | `src/types/site-schema.ts` (`MapBubblesSchema`) | `src/components/sections/MapBubbles.tsx` | — |
| `articleTeaser` | `src/modules/blog/schema.ts` (`ArticleTeaserSectionSchema`) | `src/modules/blog/sections/ArticleTeaser.tsx` | `doc/32-module-articles-blog.md` (mis à jour) |

`articleFeed` et `articleTeaser` partagent désormais `src/modules/blog/lib/articleLink.ts`
(`normalizeArticleResult`/`articleHref`, extrait de `ArticleFeed.tsx` — 10 tests ✅ dans
`articleLink.test.ts`) : même résolution `/blog/:slug` ou `/blog/id/:id`, une seule source.

**`featured-carousel` et `articleTeaser` partagent le même mécanisme `background`/`accentColor`**
(couleurs FIXES config-driven, indépendantes du mode clair/sombre — cf. commentaires des deux
schémas) : volontaire, pour que les deux blocs restent visuellement de la même famille sur la home.

**Header** — `type:"transparent-scroll"` → **`type:"stacked"`** (neuf, `HeaderStacked.tsx`,
290 lignes, générique) : 2 sections empilées sur image de fond (`backgroundImage`, réutilise
`bg-footer.webp`) — logo + wordmark **bicolore 2 segments** (`logoTitle` "parent" en
`textColor`/contour blanc + `logoTitleAccent` "62" en blanc fixe) plein écran (`50vh`), qui
collapse en barre compacte au scroll (logo remonte à gauche de la nav, même mécanique que
`HeaderTransparentScroll`/`useScrollAware`). Nouveaux champs `Header.backgroundImage`,
`Header.textColor`, `Header.logoTitleAccent` dans `site-schema.ts` — génériques, ignorés par
les autres variantes.

**Footer** — `type:"contact-partners"` → **`type:"minimal-centered"`**, désormais avec image de
fond (`Footer.backgroundImage`/`backgroundImageAlt`, neufs, génériques). `FooterMinimalCentered.tsx`
bascule en mode « texte blanc sur fond image » quand `backgroundImage` est posé (nav/liens légaux/
copyright), sinon rendu inchangé. Tailles de police de la nav/bas de page relevées d'un cran
(`sm:text-sm`→`sm:text-base`, `sm:text-xs`→`sm:text-sm`) pour matcher le header.

**Nav** — restructurée en **5 dropdowns** (tous avec enfants désormais) : « Le Réseau
parentalité » (absorbe `/mois-parentalite`, `/contact`, `/communaute` comme enfants — ils
n'étaient pas dans ce dropdown avant), « Territoires » (10, inchangé), « Thèmes » (8, inchangé),
**« Publics » (neuf, 7 entrées)**, « Contenus » (4, inchangé). **L'entrée top-level
« Rechercher » → `/recherche` est retirée** ; la page `/recherche` existe toujours
(`config:validate` la compte) mais n'est plus liée depuis la nav — la recherche reste accessible
via `header.utilities.search` (⌘K, `CommandTriggerButton`, inchangé).

**11 pages ajoutées** (35→46 pages, 153→176 sections, `config:validate` ✅ le 06/08) :
- **7 pages `/public/<slug>`** (**9 depuis le 09/09** : `petite-enfance` et `adolescence` ajoutées, cf. §9tervicies) (`benevoles`, `en-famille`, `enfance`, `futurs-parents`,
  `parents`, `parents-enfants`, `professionnels`) — une par valeur du champ `publics` déjà
  présent en base (cf. §5.2, mêmes 7 valeurs). Chacune : `title` + `searchHeader` (filtres
  thème/territoire) + `articleFeed` scopé `filters:{publics:{$in:["<Valeur>"]}}`. Purement
  config-driven, **aucune donnée ni costum neuf**.
- **2 pages de contenu tagué** : `/appels-a-projets` et `/offres-emploi` — même patron que les
  pages `/theme/*` existantes : `articleFeed` filtré par **tag WordPress libre**
  (`filters:{tags:"Appels à projets"}` / `"Offres d'emploi"`), pas un nouveau champ de taxonomie.
  Zéro impact backend.
- **2 pages légales/placeholder** : `/archives`, `/politique-cookies` — contenu statique
  « en construction ».

### 9quater.3 Validation (gates) — suite complète rejouée le 06/08, avant commit

| Gate | Résultat |
|---|---|
| `config:validate` parent62 | ✅ **46 pages, 176 sections** |
| `audit:config` parent62 | ✅ RAS |
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ **0 erreur** / 18 warnings — **0 sur les fichiers du lot** (tous les warnings sont dans `EntityFormModal.tsx`, pré-existant hors périmètre) |
| `test:unit` (suite complète, inclut `test:preflight`) | ✅ **2 227/2 229** — 2 échecs restants, **pré-existants et hors périmètre** (`bundle-size` : bundle principal **2,56 Mo** > 2 Mo ; `.claude/agents/siteforge-config-auditor.md` manquant — confirmés identiques sur `HEAD`) |
| `test:integration` (SSR) | ❌ **2 échecs / 56 tests** dans `config-driven-ssr.test.ts` (title + footer copyright) — **pré-existants et sans rapport avec ce chantier** : le test lit ses valeurs attendues dans `config.prod.json` (générique, repli par défaut de `SITE_CONFIG_PATH`, non défini dans cet environnement) alors que le serveur SSR réel sert `config.prod.parent62.json` (`VITE_SLUG=parent62` dans `.env`) — mismatch d'environnement de test, **confirmé identique sur `HEAD`** (2/56 déjà rouges avant ce chantier) |
| `e2e` ciblé (`npx playwright test e2e/parent62.spec.ts`) | ❌ **2 échecs / 8** (6 ✅) — `page.locator("nav.fixed")` se résout ; les 2 mêmes tests restent rouges pour des raisons **distinctes** (pas des bugs de composant) — « Professionnels » désormais dans le header (contredit la décision du 23/07) et assertion `bg-background/90` écrite pour l'ancien header `transparent-scroll`, pas pour la mécanique d'opacité de `stacked`. Le test « accueil : bandeau à la une » (nouveau du 06/08) passe |

---

## 9quinquies. Impacts — ajustement hauteur header/à la une, catégorie dynamique, dédoublonnage territoire (13/08)

> Périmètre de ce lot : `HeaderStacked.tsx`, `FeaturedCarouselSection.tsx`/
> `FeaturedCarouselSlide.tsx`, `select-objet.tsx`, `config.prod.parent62.json` (logo + territoires)
> et `index-parent62.css` (territoires). **Un autre chantier coexiste dans le même répertoire de
> travail mais reste volontairement EXCLU de ce lot** (traité séparément) : un fix « événement
> récurrent » (`useItem.tsx`/`eventDates.ts`). Les exemples du skill `config-assistant` et
> `ArticleFeed.tsx` (fix scroll infini du fil d'articles) ne sont pas non plus repris ici.

### 9quinquies.1 Ce qui a changé

**Header stacked — hauteur adaptative par breakpoint** (`HeaderStacked.tsx`) : le plancher
`min-h-[50vh]` posé le 06/08 (§9quater) s'appliquait à TOUS les écrans, y compris mobile — sur
petit écran, ça repoussait la section « à la une » hors du premier écran (demande explicite : la
voir sans scroller). Retravaillé en plusieurs passes :
- Mobile/tablette (`<xl`, <1280px) : plus de `min-h` — le bandeau suit son contenu (logo/titre/
  sous-titre) + son padding, jamais de plancher artificiel.
- Desktop (`xl:`, ≥1280px) : `min-h-[50vh]` conservé — partage moitié bandeau / moitié « à la
  une » au premier écran. **`xl:` choisi, PAS `lg:`(1024px)** — bug trouvé en testant les
  breakpoints intermédiaires : à `lg:`, le bandeau prenait déjà sa forme desktop (grand logo/
  titre) alors que la barre de nav en dessous restait en mode hamburger (elle ne bascule en nav
  complète qu'à `xl:`/1280px) — décalage visuel entre 1024 et 1279px, corrigé en alignant les
  deux sur le même breakpoint.
- Logo/titre/sous-titre : échelle réduite par défaut, échelle `xl:` (desktop) réajustée pour
  rester proportionnelle au bandeau restauré à 50vh.
- Vérifié à 7 largeurs de viewport (375/430/768/1024/1280/1440/1920) via Playwright contre le
  vrai site parent62 (dev server + vraies données) — captures d'écran à l'appui, aucun
  chevauchement/débordement après le fix `xl:`.

**Section « à la une » (`FeaturedCarouselSection.tsx`, `FeaturedCarouselSlide.tsx`)** — réduite
pour tenir, avec le header, dans le premier écran sans scroll :
- Padding vertical : `py-16 md:py-24` → `py-6 md:py-10` (section + skeleton de chargement,
  gardés synchronisés).
- Badge/titre/description/CTA de la diapositive réduits d'un cran (`text-2xl`→`text-xl`, etc.).
- Image : `object-cover` → **`object-contain`** (l'image entière reste visible, jamais rognée —
  le fond de la section comble l'espace résiduel) + ratio `aspect-[4/3]` → **`aspect-[16/10]`**
  (boîte moins haute à largeur égale).
- Vérifié (Playwright, vraies données) : header + « à la une » tiennent ensemble sans scroll à
  375/768/1440/1920px ; à 1280×800 (viewport de laptop inhabituellement bas), déborde encore de
  **12px** — non retravaillé plus avant (retour utilisateur : suffisant).

**Champ thème/catégorie dynamique — fix d'affichage (`select-objet.tsx`)** : ce widget
`SelectObject` est utilisé (entre autres) pour les listes dynamiques de thème/catégorie posées
par la feature « valeurs distinctes des listes dynamiques » (commit `9e789e38`, mergée avant ce
lot). Bug corrigé ici : une valeur **créée** (creatable), pas encore présente dans `options` au
moment du rendu, s'affichait comme le placeholder vide — alors qu'elle était bien enregistrée
dans le formulaire. Repli sur la valeur brute (ou son `.name` si objet) quand `options.find`
échoue ; le mode multiple avait déjà ce repli, le mode mono ne l'avait pas.

**Dédoublonnage territoire « Familles en sol mineur »** (`config.prod.parent62.json`,
`index-parent62.css`) : le territoire générique « Familles en sol mineur » faisait doublon avec
ses deux déclinaisons déjà existantes « Familles en sol mineur Hénin Carvin » et « … Lens
Liévin » — retiré de la nav, des filtres `enum` (`territoire`, plusieurs occurrences), du mapping
couleur `TagColorsConfSchema` et de la variable CSS `--territoire-familles-en-sol-mineur`
associée. Le sous-titre de la page coordinations territoriales, qui comptait « dix territoires »,
est corrigé à « neuf territoires ». Compte pages/sections **inchangé** (45/158) — le
dédoublonnage ne touche que des entrées `enum`, pas des pages. Logo header basculé sur le nouvel
asset `Logo-Aquarelle.png` dans la foulée.

### 9quinquies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur / 20 warnings — 0 sur les fichiers du lot (tous pré-existants dans `EntityFormModal.tsx`, hors périmètre) |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 45 pages, 158 sections (inchangé — le dédoublonnage territoire ne touche que des entrées `enum`) |
| `test:unit` (suite complète) | ✅ **2 342/2 348** (6 skipped, 0 échec) |
| `e2e` ciblé (`npx playwright test e2e/parent62.spec.ts`) | ✅ **8/8** — y compris les 2 spécs dédiées : « mode sombre : header stacked » et « bandeau à la une (carrousel POI tagués) ne casse pas le rendu » |

---

## 9sexies. Impacts — événements récurrents de l'agenda (14-19/08)

> Périmètre : diagnostic + correctifs autour des événements récurrents du module `agenda` (page
> `/agenda`), déclenché par l'ajout d'**événements de test** sur parent62 — voir note importante
> ci-dessous — qui a enfin permis d'observer ce qui restait « non observable (0 event) » depuis le
> 24/07 (§10, checklist 2.3/2.5).

**⚠️ Donnée de test locale, pas de la production.** Les événements utilisés pour ce diagnostic
(`teste`, `teste recurrent`, `test event`, `teste non reccurent`, `mos de la parentalié`,
`event reccur`, `aganda rec`, `recurren `, `teste `) ont été créés spécifiquement pour déboguer
cette fonctionnalité, sur le backend de **dev local** (`communecter-dev`). Ce ne sont **pas** des
données de production réelles du réseau parentalité — le volume réel d'événements en production
reste **à confirmer**, comme les autres lignes « 0 donnée » de ce document (§12).

> **Mise à jour 2026-09-04 — répartition LISTE / CALENDRIER refaite, prérequis backend.** L'analyse
> contradictoire de la MR 49 a établi que le flux LISTE unique retourné côté client (`reverse()`,
> fenêtre 12 mois, page 12 → 60) contournait un trou SERVEUR : le mode LISTE de `/co2/search/agenda`
> était trié DESC en dur, non borné (page 1 = les events les plus lointains) et sans fin d'occurrence
> — « À venir » n'était juste que si le nombre d'événements futurs restait sous `indexStepList`.
> Correctif écrit **legacy-first** (`AgendaAction.php`, paramètres optionnels `from`/`to`/`order`,
> `endDateSortFormat`, `recurrency` booléen, `count` = servi, minuit → lendemain), porté en miroir
> dans le backend Node (byte-parité prouvée) et déclaré au contrat lib. Le module agenda utilise
> désormais deux flux bornés serveur (prochains ASC depuis maintenant / passés DESC), la grille reste
> en CALENDRIER — cf. `doc/29-module-agenda.md`. **Prérequis de déploiement** : legacy ≥ `14c2caa1`
> + `0db3d136` + le patch du 2026-09-04 (ou Node équivalent), sinon les paramètres sont ignorés et les
> récurrents disparaissent de la liste.

### 9sexies.1 Bugs backend trouvés (`AgendaAction.php`, hors monorepo — pas d'accès direct, documentés en handoff)

1. **Matching récurrent par jour de semaine (mode CALENDRIER)** : `searchEventsCostum` (avec
   `startDateUTC`/`endDateUTC`) ne comparait que le jour de semaine de `startDateUTC` **lui-même** à
   `openingHours`, sans balayer toute la plage demandée — un événement récurrent n'apparaissait que
   les jours où « aujourd'hui » tombait pile sur son jour configuré. Documenté dans `Document de
   spécification — Agenda événements récurrents invisibles (AgendaAction.php).md` (racine du
   monorepo, 14/08). **Corrigé** (vérifié : 418 occurrences hebdomadaires correctement dépliées sur
   une fenêtre de 12 mois après le fix).
2. **Mode LISTE excluant les récurrents** : `searchEventsCostum` sans dates (flux paginé) ne
   renvoyait que les événements ponctuels. Évolution proposée puis **implémentée** : le mode LISTE
   inclut désormais les récurrents, une ligne chacun (leur prochaine occurrence,
   `startDateSort`/`startDateSortFormat`). Documenté dans `Document de spécification — Pagination
   des événements récurrents dans l'agenda (AgendaAction.php).md` (racine du monorepo, 19/08).
3. **« Prochaine occurrence » sautant le créneau du jour en cours** : la première version de
   l'évolution ci-dessus calculait toujours le prochain **futur** début, jamais « aujourd'hui, déjà
   commencé » — un récurrent activement dans son créneau ne remontait jamais daté du jour même, donc
   ne pouvait jamais atterrir dans l'onglet « En cours ». **Corrigé le 19/08** — revérifié : un
   récurrent interrogé pendant son créneau actif remonte daté du jour même, et apparaît bien dans
   « En cours » sur la vraie page.

**Répond à la question ouverte du §2.6/§12** (« `searchEventsCostum` masque-t-il les events *pending*
côté public ? ») : **oui, confirmé le 19/08.** `costumSlug` (toujours injecté par le SDK en usage
réel) déclenche le filtre de modération — les événements avec
`preferences.toBeValidated.parent62:true` sont exclus. Vérifié sur les 10 événements de test :
corrélation exacte (les 3 qui restent sont les 3 sans `toBeValidated`). Pas un bug.

### 9sexies.2 Ce qui a changé côté `site-json` (testé, fonctionnel, non commité à ce stade)

- Nouveau helper partagé `resolveEventStartDate()` (`src/helpers/formatDate.ts`) — repli `startDate`
  → `startDateSort` → `startDateSortFormat` (un événement récurrent n'a pas de `startDate`). Réutilisé
  dans le module `agenda` (`eventDates.ts`), `search` (`useItem.tsx`, cartes), `admin`
  (`resourceHelpers.ts`, colonne « Début »), `profil` (`ProfileEventDates.tsx`, corrige un affichage
  « Invalid Date »).
- Nouveau `formatRecurrenceLabel()` (`src/modules/search/lib/openingHoursDays.ts`) — affiche « Chaque
  vendredi » à la place d'une date isolée (trompeuse : elle change chaque semaine) pour un
  événement récurrent, sur la carte de recherche (`CardEvent`), la page profil d'un événement et la
  table admin.
- Refonte de `Agenda.tsx` : un seul fetch `useAgendaList` (mode LISTE) sert désormais les 3 onglets
  (En cours / À venir / Passés) au lieu d'un fetch CALENDRIER séparé et large (12 mois) pour « À
  venir » — élimine le sur-fetch (auparavant jusqu'à ~150 lignes reçues pour quelques événements
  distincts) et ajoute une vraie pagination « charger plus » partagée entre les 3 onglets. La grille
  Calendrier (`gridFetch`) est inchangée.
- Un helper de dédoublonnage client (`dedupeByEvent`) a été ajouté puis **retiré** : une fois le mode
  LISTE corrigé, le backend dédoublonne déjà (une ligne par événement récurrent) — le rendait
  redondant.
- Documentation technique moteur mise à jour : `../doc/29-module-agenda.md` (architecture, pièges,
  écarts backend connus, référence aux deux documents de spec).

### 9sexies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur (2 warnings pré-existants, sans rapport, sur `Agenda.tsx` ligne 93) |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 46 pages, 160 sections (inchangé — ce lot ne touche aucun config) |
| `test:unit` ciblé (`agenda`+`search`+`admin`+`profil`+`helpers`) | ✅ **899/899** |
| `test:unit` (suite complète) | 2 499/2 508 — **3 échecs pré-existants et sans rapport** (config parent62 modifiée en parallèle sur un autre chantier : ajout page `/annuaire`, dédoublonnage territoire « Familles en sol mineur ») |

---

## 9septies. Impacts — thèmes/catégorie en saisie libre, promotion admin vers la liste partagée (25/08)

> Périmètre : les champs "Thèmes" (`parent62-affiche`/`-article`/`-recovery-center`/`-event`) et
> "Catégorie" (`parent62-affiche` seul) passent d'un choix fermé à un choix **+ saisie libre**, avec
> promotion admin-only de la valeur inédite vers la liste partagée du costum. Commit `bcd90e6d` sur
> `parents62`, **pushé**.

### 9septies.1 Ce qui a changé

Le mécanisme "propre" pour qu'un thème/catégorie inédit apparaisse aussi dans les **filtres** et les
**suggestions** du formulaire pour les utilisateurs suivants existe déjà dans le parc
(`config.prod.institut-bleu.json` : `territoires`/`auteurs`/`financeurs`, recettes **dynamiques**
`{collection, distinct, where}` résolues par `costum/co/listvalues`) — mais `costum.lists.themes` de
parent62 est déclarée **statique** côté backend, pas dynamique. Approche retenue : garder la liste
statique et la faire **grandir depuis le front**, à l'écriture.

**Écriture (`growCostumLists`, nouveau fichier
`src/modules/profil/forms/costum/parent62/fns.ts`)** — après une soumission réussie
(`afterSubmit`), pour chaque champ `valueSelect` du formulaire dont `widgetProps.saveNewValue: true`
(config, **`false` par défaut** — opt-in explicite, aucune liste de champs codée en dur : la fonction
introspecte le descripteur du formulaire) : les valeurs vraiment nouvelles (dédoublonnage
casse/accents, `normalizeFilterValue`) sont poussées dans `costum.lists.<listKey>`
(`carrier.updateField(path, valeur, {arrayForm:true})`, un `$push` Mongo par valeur — pas de `$addToSet`
exposé par le SDK). **Réservé admin** (`carrier.isAdmin()`) : plusieurs de ces formulaires sont aussi
accessibles en public sans authentification (`requiresAdmin:false`) — sans la garde, n'importe quel
visiteur pourrait injecter une valeur dans la taxonomie partagée avant modération. La saisie libre du
champ lui-même reste ouverte à tous ; seule la **promotion** vers la liste partagée est gardée — et
`saveNewValue` restreint en plus la saisie libre elle-même aux admins pour ces champs précis (un
visiteur non-admin y voit un choix fermé, comme un `select`).

**`listKey` distinct du nom de champ** : `category` sur `parent62-affiche` (Compliqué/Difficile/À
changer) porte le même nom de champ qu'un filtre `resource-category` totalement différent (Vidéo/…,
sur un autre formulaire) — écrire dans `costum.lists.category` aurait mélangé les deux taxonomies.
`widgetProps.list: "categoriesParole"` fixe la liste cible.

**Lecture — filtres et formulaire** : nouvelle clé de schéma `optionsKey` (pendant **statique** de
`optionsFrom`, qui reste réservé aux recettes dynamiques) sur les 23 blocs de filtre `themes`/
`category` ; `ValueSelectField` (formulaire) fusionne l'`enum` déclaré en config avec
`costum.lists.<list>` (`mergeDeduped`, dédoublonnage casse/accents partagé avec l'écriture — nouveau
helper dans `src/modules/search/lib/dropdownFilters.ts`, testé).

**Mise à jour sans reload** : `carrier` (`useCocolight().entity`) est un `useState` rempli une fois
au boot, jamais rafraîchi après un `updateField`. `carrier.refresh()` (méthode SDK) après l'écriture,
combiné à un nouveau hook `useCostumListsReactive` (`src/hooks/useCostumLists.tsx`) qui s'abonne —
via `useReactiveProperty`, déjà utilisé ~14 fois ailleurs dans le repo — aux signaux réactifs
**natifs du SDK** : `_setData` réassigne `costum`/`lists` sur le **même** proxy réactif, donc les
filtres et le formulaire se remettent à jour tout seuls, sans store applicatif dédié.

> ⚠️ **Piège à connaître** : `useCostumListsReactive` doit renvoyer une référence STABLE pour le cas
> "aucune liste costum" (constante partagée `Object.freeze({})`, jamais un littéral `{}`) — sinon la
> section `filters` générique entre en boucle de rendu infinie sur tout site sans `costum.lists`/
> `lists` statique déclarée (donc la plupart des sites, pas que parent62). Gaté par 4 tests dans
> `useCostumLists.test.tsx`.

### 9septies.2 Limite assumée

**Pas de cohérence multi-utilisateur instantanée** : `carrier.refresh()` ne rafraîchit que
l'instance du **navigateur/session courante** — un autre utilisateur (ou un autre onglet) ne verra
la valeur ajoutée qu'à son prochain chargement naturel de page, pas en temps réel.

### 9septies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur sur les fichiers du lot |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 45 pages, 158 sections (inchangé) |
| `test:unit` ciblé (`search`+`profil/forms`+`lib`+`hooks`) | ✅ **990/990** |

---

## 9octies. Impacts — section admin générique « Listes » (édition de `costum.lists`), pilote parent62 (25/08)

> Périmètre : nouvelle section admin **générique du moteur** (pas spécifique à parent62),
> `{type:"lists"}`, activée en pilote sur parent62 pour tester en conditions réelles contre
> `communecter-dev` (environnement de test, confirmé). Modifications locales sur `parents62`, **non
> commitées** à ce stade.

### 9octies.1 Ce qui a changé

Nouvel onglet « Listes » dans `/admin` (`config.admin.tabs`), layout **maître-détail** : un menu à
gauche énumère les listes déclarées, cliquer une entrée l'ouvre à droite avec les contrôles CRUD.
Évite le long scroll d'un empilement vertical dès qu'un site déclare plusieurs listes.

Sur parent62, `props.lists` **restreint** la section à 2 listes, chacune avec un **libellé lisible**
plutôt que sa clé technique (`{key, label}`, cf. [doc/30-module-admin.md](../doc/30-module-admin.md)
§`lists`) :

```jsonc
"lists": [
  { "key": "themes", "label": { "fr": "Thèmes", "en": "Topics" } },
  { "key": "categoriesParole", "label": { "fr": "Catégories des paroles", "en": "Parole categories" } }
]
```

Ce sont les seules listes que les admins font **grandir par saisie libre**
(`widgetProps.saveNewValue: true`, §9septies) ; `territoires`/`publics` (taxonomies plus stables,
non ouvertes à la saisie libre) restent hors de cet écran. `categoriesParole` porte le champ
`category` de `parent62-affiche`, pas l'un des « 4 champs transverses » de §5.2 — décision cohérente
avec le fait que ce sont précisément les 2 listes susceptibles d'accumuler des doublons/coquilles au
fil des soumissions, celles qu'un admin a besoin de nettoyer. Sans `label`, l'écran afficherait la
clé technique brute (`categoriesParole`) — pas lisible pour un admin non développeur.

- **Listes statiques** (`themes` et `categoriesParole` sont toutes deux des tableaux) : ajouter,
  renommer, réordonner, supprimer une valeur ; créer une nouvelle liste.
- **Listes dynamiques** (recette `{collection,where,distinct}`) et **maps** valeur→libellé :
  lecture seule (badge explicite) — hors scope, cf. [doc/30-module-admin.md](../doc/30-module-admin.md)
  §`lists` pour le détail des raisons.
- **Écriture** : réutilise le même mécanisme `$push` (`{arrayForm:true}`) que `growCostumLists`
  (§9septies), déjà éprouvé en prod sur parent62 pour ses formulaires costum — pour ajouter une
  valeur **et** créer une liste (fusionnées, cf. 9octies.2). Renommer/réordonner/supprimer une
  valeur utilisent un `$set` de tableau complet, sans `arrayForm` — jamais exercé dans ce dépôt sur
  `costum.lists` avant cette section (cf. 9octies.3, risque à valider).

### 9octies.2 Point technique découvert en testant (communecter-dev)

`element/updatepathvalue` **ne persiste pas une valeur vide** : un `$set` d'un tableau **vide**
(`[]`) sur une clé inédite de `costum.lists` est traité comme un no-op silencieux côté backend (rien
n'est écrit, sans erreur). Conséquence sur la conception :

- **Créer une liste exige désormais une première valeur** — l'opération « créer » a été fusionnée
  avec « ajouter » (même appel `$push`, qui auto-vivifie le tableau manquant côté Mongo) : une liste
  ne naît jamais vide.
- **Supprimer la dernière valeur d'une liste est bloqué côté UI** (rejet explicite, toast dédié) :
  le `$set` résultant serait aussi `[]`, avec le même risque de no-op silencieux — mieux vaut
  refuser l'action que laisser croire à une suppression réussie que le serveur n'aurait pas gardée.

### 9octies.3 Risque non encore validé en prod réelle

Seul le mécanisme d'**ajout** (`$push`) est éprouvé (identique à `growCostumLists`, §9septies).
**Renommer/réordonner/supprimer une valeur** (le `$set` de tableau complet) n'ont été testés que
contre `communecter-dev` à ce stade — pas contre une vraie liste de parent62 en production. À
valider avant de considérer ces trois opérations fiables sur les listes réelles du site (cf. §13).

### 9octies.4 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur sur les fichiers du lot |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 45 pages, 158 sections (inchangé) |
| `test:unit` ciblé (`costumListsEditing`+`useCostumListsMutations`) | ✅ **39/39** |
| `test:unit` suite complète | ✅ **2880/2888** — 2 échecs pré-existants sans rapport (drift `command-palette`/territoires de parent62, antérieur à ce lot) |
| `tests/preflight/archetypes.test.ts` (« snapshot égale le bloc source ») | ❌ **rouge** au moment de ce lot — `.claude/skills/config-assistant/examples/admin.json` n'avait pas suivi le nouvel onglet « Listes ». **Corrigé ensuite, cf. §9novies** |

---

## 9novies. Impacts — rattrapage des gates `config-assistant` (drift territoire « Familles en sol mineur », 25/08)

> Périmètre : correctif **indépendant** de la section admin « Listes » (§9octies) — remet à niveau 2
> gates preflight qui avaient dérivé depuis le dédoublonnage du territoire « Familles en sol
> mineur » (§9quinquies, 13/08), repérés en vérifiant l'état complet des tests après §9octies.

### 9novies.1 Ce qui a changé

- **`tests/preflight/page-recipes.test.ts`** : la recette `page-annuaire-grille`
  (`.claude/skills/config-assistant/page-recipes.json`) pointait `/territoire/familles-en-sol-mineur`,
  une page supprimée depuis le dédoublonnage en 2 territoires (`-henin-carvin`/`-lens-lievin`,
  §9quinquies). Recalée sur `/territoire/familles-en-sol-mineur-henin-carvin` — mais la vraie
  découverte est plus large : la séquence de sections annoncée (`title, searchHeader, gridLayout`)
  ne correspondait plus à **aucune** des 9 pages territoire actuelles, qui partagent toutes
  désormais `html, cards, searchHeader, articleFeed, accordion, searchProStatic, (html,) cta`
  (dérive probablement issue de la refonte du 06/08, §9quater, jamais recalée depuis). `sequence`
  et `rythme` réécrits pour décrire le vrai gabarit (bandeau hero, carte coordonnateur·rice,
  actualité filtrée par territoire, accordéon des communes, sélection d'actions, CTA — variante
  enrichie à 8 sections avec un bloc « Ressources du territoire », cf. `/territoire/arrageois`).
- **`tests/preflight/archetypes.test.ts`** : 4 exemples canoniques du skill `config-assistant`
  (`admin`, `command-palette`, `list-item-rules`, `list-testimonial`) portaient encore l'entrée
  générique `"Familles en sol mineur"` dans leur snapshot (`TagColorsConf`/`dropdownFilters.options`),
  absente de la vraie config depuis le même dédoublonnage. Resynchronisés via
  `npm run config:example -- <feature> --write` (`agenda`/`list-resource`/`theme` aussi vérifiés,
  sans dérive).

### 9novies.2 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 45 pages, 158 sections (inchangé) |
| `tests/preflight/` (33 fichiers) | ✅ **532/532** (6 skip) — `page-recipes` ET `archetypes` repassent au vert |
| `test:unit` suite complète | ✅ **2882/2882** (6 skip) — plus aucun échec, y compris les 2 pré-existants |

---

## 9decies. Impacts — menu de nav « Thèmes » dynamique + page dédiée `/theme` (25-26/08)

> Périmètre : capacité **générique** ajoutée au moteur SiteForge (pas propre à parent62), appliquée
> à l'entrée « Thèmes » du header de parent62 — seul site du parc à l'utiliser à ce jour. Fait suite
> au constat (`useDynamicFilterOptions`/`optionsKey` déjà câblés sur 22 blocs de filtres via
> `costum.lists.themes`, §9septies) que le menu de nav, lui, restait une copie figée à 8 entrées,
> découplée de la vraie liste (18 valeurs). Document de spec dédié (racine du monorepo) :
> `Document de spécification — Menu dynamique costum.lists dans le header.md` (historique complet
> du chantier, y compris les itérations intermédiaires — ce paragraphe ne documente que l'état
> final retenu).

### 9decies.1 Ce qui a changé côté moteur (générique, tout site)

- **`site-json/src/types/site-schema.ts`** : nouveau champ optionnel `dynamicList: {list,
  filterId, costumSlug?, limit?}` sur `EnhancedNavItem` — génère les `children` d'un item de nav
  depuis `costum.lists.<list>` au lieu de les écrire à la main.
- **`site-json/src/components/layout/header/lib/dynamicNav.ts`** (nouveau, pur, testé —
  15 cas) : résout les valeurs (statique ou recette dynamique, même logique que
  `optionsKey`/`optionsFrom` côté filtres) et construit un `children` par valeur, `path` = page
  propriétaire du filtre + query param (ex. `/theme?theme=La+petite+enfance`), double-encodé pour
  rester correct même si une valeur contient une virgule littérale.
- **`site-json/src/components/layout/header/useResolveDynamicNav.ts`** (nouveau) : résout
  `filterId` → page propriétaire via `getDropdownFilterOwner`, lit `costum.lists[list]` (statique
  ou recette), avec repli sur les `children` statiques déclarés en config si la résolution
  échoue/est vide/le `filterId` est introuvable.
- **`site-json/src/components/layout/SiteHeader.tsx`** : **un seul point d'injection** — la nav est
  résolue une fois, avant le `switch` qui choisit la variante de header. **Aucun** des 8 composants
  de header n'a été modifié : un item résolu redevient un `EnhancedNavItemType` ordinaire (un vrai
  `<NavLink>`, pas un bouton), indiscernable d'un item déclaré à la main.
- **`site-json/src/modules/search/schema.ts` + `SearchHeaderSection.tsx`** : nouveau champ optionnel
  `hidden` sur un `dropdownFilters` — le filtre continue de s'hydrater depuis l'URL et de filtrer le
  contenu, mais ne rend plus aucun contrôle visible (barre desktop, Sheet mobile, tag actif,
  compteur/`Réinitialiser`). Sert un item de nav dont la page cible EST déjà scopée par ce filtre
  (cf. `/theme` ci-dessous) : afficher un sélecteur redondant avec le contexte de la page n'a pas de
  sens, contrairement à un filtre d'affinage (`public`/`territoire`).
- **`SearchHeaderSection.tsx`, hydratation URL→filtre** : ré-appliquée à chaque fois que la VALEUR
  vue dans l'URL change pour un filtre donné (pas seulement au montage), et vide la sélection si le
  paramètre disparaît de l'URL (retour arrière navigateur inclus) — nécessaire dès qu'un menu externe
  peut faire cibler la MÊME page par plusieurs valeurs successives sans remontage de composant (React
  Router ne remonte pas sur un changement de query seul). Logique extraite en fonction pure testée,
  `resolveFilterHydration` (`src/modules/search/lib/hydrateDropdownFilter.ts`, 9 cas).

### 9decies.2 Ce qui a changé côté config parent62 (`config.prod.parent62.json`)

`header.nav`, entrée « Thèmes » — plus de `path` propre (l'item est un pur déclencheur de dropdown,
pas une page), plus de `children` statiques (les 8 entrées à la main vers `/theme/<slug>`), juste
`dynamicList` pointant sur le filtre `theme` :

```diff
-        "path": "/theme/la-petite-enfance",
-        "children": [ /* … 8 entrées « /theme/<slug> » écrites à la main … */ ]
+        "dynamicList": {
+          "list": "themes",
+          "filterId": "theme"
+        }
```

Le repli `children` a été retiré après coup (26/08), une fois la résolution dynamique confirmée
fiable en conditions réelles (§9decies.3) : le garder aurait perpétué exactement la dérive que ce
lot visait à supprimer (une copie figée à 8 valeurs, à côté des 18 réelles). **Conséquence
assumée** : si `costum.lists.themes` devenait indisponible (site sans données costum, panne), le
menu « Thèmes » n'aurait plus aucune entrée à afficher — repli désormais absent. Le risque est jugé
faible : `costum.lists` voyage avec les données de base du site (chargées pour toute la page, pas
une requête à part), une indisponibilité casserait donc bien d'autres éléments de la page en même
temps, pas seulement ce menu.

**Nouvelle page `/theme`** (46ᵉ page, insérée juste avant `/blog` dans `config.pages`) : chaque clic
du menu ouvre `/theme?theme=<valeur>`. Calquée sur `/blog` — mêmes filtres `theme`/`public`/
`territoire`, même `articleFeed` (`featured: false`, comme les anciennes pages `/theme/<slug>`) —
mais avec son propre titre/SEO/hero (« Nos thèmes ») et son filtre `theme` marqué `hidden: true` (la
page est déjà scopée par la valeur cliquée, un sélecteur « Thèmes » dessus serait redondant).
`dynamicList.filterId` reste `"theme"` : `getDropdownFilterOwner` résout par « premier match dans
l'ordre de `config.pages` » (aucun `preferPathname` exposé depuis le header) — `/theme` gagne parce
qu'elle est désormais la première page à déclarer `id: "theme"` dans le tableau (22 blocs au total
dans la config partagent cet id pour leur propre filtrage local, cf. §9septies).

**Décision produit tranchée avec l'utilisateur** (remplacement complet, pas l'option hybride
envisagée) : les 8 pages `/theme/<slug>` — chacune avec un `seo.title`/`seo.description`/`ogImage`
dédié — restent en ligne et indexables, mais ne sont plus reliées depuis la nav ni depuis le menu.
Perte du maillage interne vers ces pages, pas de leur contenu.

### 9decies.3 Vérifié en conditions réelles (SSR + Playwright + interception réseau, backend réel)

- Le dropdown « Thèmes » résout **18 valeurs réelles** de `costum.lists.themes` (pas les 8 valeurs
  statiques) → liens `/theme?theme=<valeur>` corrects, zéro lien `/theme/<slug>` résiduel.
- Clic (navigateur réel) : navigation → titre « Nos thèmes » affiché → filtre appliqué → ni
  « Thèmes » ni « Contenus » ne s'allument comme actifs (page distincte des deux, correct).
- 2ᵉ clic vers un AUTRE thème pendant que `/theme` reste montée : nouvelle requête serveur confirmée
  repartir avec la nouvelle valeur.
- Retour arrière du navigateur vers `/theme` sans paramètre : requête serveur suivante sans plus
  aucun filtre `themes` (sélection bien vidée).
- Filtre masqué (`hidden`) : 0 bouton « Thèmes »/valeur sélectionnée visible sur `/theme`, `Publics`
  toujours visible normalement. ⚠️ **Annulé le 09/09** (cf. §9duovicies.1) : le réseau a demandé
  l'inverse — le filtre « Thèmes » est de nouveau visible sur `/theme`. La capacité `hidden` reste
  dans le moteur, simplement plus employée par ce site.
- `costum.lists.themes` est aujourd'hui **statique** côté backend parent62 (cf. §9septies /
  document de spec `costum.lists.themes statique bloque les filtres dynamiques`) : seule cette
  branche a été exercée en conditions réelles. La branche RECETTE DYNAMIQUE (`costum/co/listvalues`)
  reste couverte uniquement par les tests unitaires — à valider en conditions réelles si `themes`
  devient un jour une recette dynamique côté backend (§13).
- `test:e2e` **non rejoué** (pas de `.env.test` dans cet environnement) — `e2e/parent62.spec.ts:124`
  (deep-link `/recherche?territoire=Arrageois`) vaut d'être rejoué avant fusion dans `main`.

### 9decies.4 Points restés ouverts (documentés, non traités dans ce lot)

1. **`/theme` est désormais la page par défaut pour tout clic sur une facette « themes » sans page
   locale correspondante, site entier** — pas seulement le menu de header : `ClickableFacet` sur les
   previews de résultats de recherche (`/recherche`, `/agenda`, …) résout par le même mécanisme
   « premier match ». Avant ce lot ça retombait sur `/blog`, maintenant sur `/theme`. Fonctionnellement
   équivalent (mêmes filtres) ; seule différence visible, `featured:false` sur `/theme` vs `true` sur
   `/blog`. Jamais explicitement demandé — à confirmer si `/blog` doit rester la cible par défaut
   pour ces clics-là spécifiquement.
2. **Highlighting « actif » de la nav mobile ne peut jamais s'allumer pour un enfant `dynamicList`**
   (son `path` contient une query string, la vérification d'état actif ne compare que le pathname) —
   purement cosmétique, une correction propre toucherait une logique partagée par les 8 headers.
3. **Ctrl+K ne recherche pas les 10 valeurs de `costum.lists.themes` sans page dédiée** — mais
   listait déjà chaque page de `config.pages` indépendamment de la nav avant ce lot (les 8 titres
   `/theme/<slug>` y sont donc toujours, pas une régression) ; limitation préexistante de
   l'architecture de ce composant, pas un défaut introduit ici.

### 9decies.5 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur, 0 nouveau warning |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 160 sections** |
| `audit:config` | ✅ RAS (`liens: 0`) |
| `test:unit` suite complète | ✅ **2909/2909** (6 skip) — +17 tests vs. avant ce lot |
| `test:e2e` | ⏭️ non rejoué (pas de `.env.test` ici) — à faire avant fusion `main` |
| Vérification SSR + Playwright + interception réseau (backend réel) | ✅ cf. §9decies.3 |

Non commité à ce stade (comme §9septies/§9octies avant lui) — à recetter visuellement (dont
`test:e2e` avec backend réel) puis committer sur `parents62` si validé.

---

## 9undecies. Impacts — mécanique unique de résolution des listes `costum.lists` (socle + N listes), pilote : formulaire d'ajout d'article (02/09)

> Périmètre : capacité **générique** du moteur SiteForge (pas propre à parent62), appliquée d'abord au
> champ « Thèmes » du formulaire **d'ajout d'article** (`costumForms.parent62-article`). Fait suite au
> constat — posé au chantier « thèmes en saisie libre » (§9septies), rouvert en spec — que le moteur
> avait **quatre** façons différentes de répondre à la même question (« quelles valeurs proposer ? »)
> selon qu'on soit dans un filtre de page (`optionsFrom`/`optionsKey`), un champ de formulaire
> (`enum` + `widgetProps.list`) ou un menu de header (`dynamicList`, §9decies). L'arbitrage a écarté la
> voie backend (ajouter `collections`/`defaults` à la recette PHP côté legacy) au profit d'une
> résolution entièrement site-json : le défaut se déclare là où vit le champ, et il y garde ses
> libellés i18n.

### 9undecies.1 Ce qui a changé côté moteur (générique, tout site)

- **`site-json/src/lib/listSources.ts`** (nouveau, pur, testé — 11 cas) : `resolveListSources(sources)`
  fusionne N sources de valeurs dans l'ORDRE de priorité (la première où une valeur apparaît fixe sa
  graphie, donc son libellé i18n), dédoublonnage casse/accents via `normalizeFilterValue` — la même
  notion d'égalité que `mergeDeduped` et que `selectNewValues`/`growCostumLists`. Réunit aussi les
  **`variants`** (graphies regroupées) entre sources : sans cette union, deux recettes (une par
  collection) produisent deux groupements indépendants et un filtre raterait **silencieusement** les
  fiches de l'autre collection.
- **`site-json/src/hooks/useListSources.ts`** (nouveau, testé — 8 cas) : résout `string | string[]` de
  listes `costum.lists`, **forme détectée automatiquement** par `isDynamicList` (statique → lue en
  mémoire, aucune requête ; recette → `costum/co/listvalues`), fusionnées avec le socle déclaré. Rend
  `{values, variants, ready}`. Reprend le patron `useQueries` déjà écrit dans `useDynamicFilterOptions`
  et `useResolveDynamicNav` — 3ᵉ répétition, donc factorisation justifiée.
- **`site-json/src/modules/profil/forms/fields/ValueSelectField.tsx`** : passe de la SUBSTITUTION à la
  FUSION. L'ancienne garde `enabled: statiques.length === 0` empêchait tout appel serveur dès qu'un
  `enum` était déclaré — les 4 formulaires parent62 (18 thèmes en `enum`) ne voyaient donc **jamais**
  les valeurs réellement saisies, quelle que soit la forme de la liste en base — le blocage identifié
  de longue date côté formulaire (cf. §9septies).
- **`site-json/src/modules/profil/forms/registerWidgets.tsx`** : `widgetProps.list` accepte désormais
  une **chaîne ou un tableau** de noms de listes.
- **`site-json/src/modules/profil/forms/costum/parent62/fns.ts`** : `resolveGrowTarget` (nouveau, pur,
  testé — 7 cas). Lire plusieurs listes, mais n'en ÉCRIRE qu'une : la promotion admin
  (`growCostumLists`) vise la première liste déclarée qui n'est **pas** une recette. Une clé-recette
  n'a rien à recevoir (ses valeurs *sont* la donnée) et un `$push` (`arrayForm:true`) y écrirait dans
  un objet de déclaration — au mieux une erreur, au pire une recette corrompue. Toutes recettes → la
  promotion est sautée, sans erreur.

### 9undecies.2 Ce qui a changé côté config parent62 (`config.prod.parent62.json`)

Une seule ligne, sur le formulaire visé par ce lot :

```jsonc
"costumForms.parent62-article.fields.themes.widgetProps": {
  "list": ["themes", "themesPoi", "themesEvents"],   // était : "themes"
  "saveNewValue": true                                // inchangé — cible d'écriture : "themes" (socle statique)
}
```

**Inerte tant que les deux recettes n'existent pas en base** : une liste non déclarée dans
`costum.lists` est ignorée par `useListSources` — aucune requête, aucune erreur, aucun changement
visible. Le jour où elles sont déclarées, le champ propose en plus les thèmes réellement employés sur
`poi` **et** sur `events`, fusionnés avec les 18 valeurs de l'`enum` et avec le socle statique
`costum.lists.themes` que l'admin édite. Les 24 filtres `optionsKey` et le menu header `dynamicList`
n'ont **pas** été touchés par ce lot.

### 9undecies.3 Ce qui reste à faire (hors de ce lot)

1. ~~Déclarer `themesPoi` / `themesEvents` en base~~ — **sans objet : elles existaient déjà**
   (vérifié le 02/09, cf. §9terdecies.1).
2. ~~Brancher les deux autres consommateurs~~ — **fait le 02/09** (§9terdecies) : filtres de page et
   menu header résolus par le même code, libellés i18n récupérés.
3. ~~Décider du sort de `saveNewValue`~~ — **tranché le 02/09 : supprimé** (cf. §9duodecies).

### 9undecies.4 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` (suite complète) | ✅ 0 erreur, 21 warnings — tous **préexistants** (fichiers touchés : 0 warning) |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 160 sections** |
| `audit:config` | ✅ `config.prod.parent62.json — RAS` |
| `test:unit` suite complète | 🟡 **2934/2941** (6 skip) — **+26 tests** ajoutés par ce lot ; l'unique échec est `tests/preflight/site-assets.test.ts`, **préexistant et sans rapport** : un dossier VIDE et non suivi par git, `public/images/transiter`, qu'aucun slug de `sites.json` ne déclare (un `rmdir` suffit, décision hors périmètre de ce lot) |
| `test:e2e` (`e2e/parent62.spec.ts`) | ✅ **8/8** — pages en lecture seule ; le formulaire d'ajout d'article est derrière l'auth admin, non couvert par l'e2e |

Non commité à ce stade (comme §9septies/§9octies/§9decies avant lui).

---

## 9duodecies. Impacts — retrait de la promotion automatique `saveNewValue` / `growCostumLists` (02/09)

> Décision : **une recette `distinct` rend l'écriture dans `costum.lists` inutile** — la valeur saisie
> librement vit sur la fiche, et c'est le `distinct` qui la fait remonter aux suivants. Recopier la
> même valeur dans la taxonomie partagée faisait donc double emploi, avec en prime une écriture
> partagée déclenchée par un formulaire public. Suite directe de §9undecies.

### 9duodecies.1 Ce qui a été supprimé

| Supprimé | Ce que ça faisait |
|---|---|
| `src/modules/profil/forms/costum/parent62/fns.ts` **(fichier entier)** + son test | `growCostumLists` (`afterSubmit`), `selectNewValues`, `resolveGrowTarget` — la promotion admin d'une valeur libre vers `costum.lists.<liste>` |
| `src/modules/profil/forms/fields/valueSelectAccess.ts` **(fichier entier)** + son test | `resolveCreatable` — n'existait que pour la restriction admin induite par `saveNewValue` |
| `widgetProps.saveNewValue` (prop `ValueSelectField` + passage dans `registerWidgets.tsx`) | l'opt-in par champ |
| `import "./costum/parent62/fns"` dans `registerSpecFns.ts` | l'enregistrement des 4 clés `afterSubmit` |
| `config.prod.parent62.json` : **4** `"afterSubmit": "parent62-*-grow"` + **5** `"saveNewValue": true` | le câblage côté config (les deux moitiés devaient partir ensemble : `assertCostumKeysRegistered` lève si une clé `afterSubmit` citée n'est plus enregistrée) |

Commentaires réalignés dans 6 fichiers qui citaient `growCostumLists`/`selectNewValues` comme
référence vivante (`useCostumLists`, `useDynamicFilterOptions`, `dropdownFilters`,
`costumListsEditing`, `useCostumListsMutations`, `listSources`) — au passage, `dropdownFilters.ts:52`
citait `noteGrownListValue`, **déjà supprimé** du dépôt depuis un lot antérieur.

### 9duodecies.2 Deux conséquences à connaître (aucune n'est bloquante, aucune n'est invisible)

1. **La saisie libre s'ouvre à tous les visiteurs** sur les 4 formulaires concernés. `saveNewValue`
   avait un second effet, non évident : il **restreignait `creatable` aux admins** (un visiteur ne
   pouvait que choisir dans l'existant), précisément parce que le champ écrivait dans une taxonomie
   partagée. Cette écriture n'existant plus, la restriction n'a plus d'objet — un thème inédit tapé
   par un visiteur reste sur SA fiche. Il ne sera proposé aux autres qu'une fois la fiche **visible et
   modérée**, gate appliquée par le serveur lui-même (`ListValuesAction`, GARDE 3
   `preferences.toBeValidated`). Si l'on veut malgré tout fermer un champ, le levier est
   `widgetProps.creatable: false`, par champ.
2. **Tant que `themesPoi`/`themesEvents` ne sont pas déclarées en base, une valeur inédite n'est
   proposée nulle part** (les filtres lisent la liste STATIQUE `themes` via `optionsKey`, qui ne
   grandit plus toute seule). C'est un intervalle, pas un état cible : il se referme à la déclaration
   des recettes (§9undecies.3). Entre-temps, la section admin « Listes » ajoute une valeur à la main.

### 9duodecies.3 Le cas `categoriesParole` — pas de remplaçant `distinct` évident

Pour `themes`, la recette est directe. Pour `categoriesParole` (champ `category` de
`parent62-affiche`, valeurs *Compliqué / Difficile / À changer*), **elle ne l'est pas** : le champ
`category` de la collection `poi` porte, sur ce même costum, **au moins deux taxonomies différentes**
— celle des paroles, et celle des ressources (*Vidéo / Photo / Compte-rendu / Jeu / Document / Lien*,
`parent62-recovery-center`). Un `distinct` sur `category` scopé au costum rendrait donc **l'union des
deux**, ce qui n'a de sens pour aucun des deux formulaires.

Options, à trancher le jour où le besoin se pose (aucune n'est urgente — la liste statique existe
toujours et reste éditable) :
- garder `categoriesParole` **statique**, alimentée à la main par la section admin « Listes » — état
  actuel, et sans doute suffisant pour une taxonomie de 3 valeurs ;
- déclarer une recette avec un `where` discriminant, **si** les paroles portent un marqueur propre
  (tag, type, `parent`…) — à vérifier en base avant de promettre quoi que ce soit.

### 9duodecies.4 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` (suite complète) | ✅ 0 erreur, 21 warnings — tous préexistants |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 160 sections** |
| `audit:config` | ✅ `config.prod.parent62.json — RAS` |
| `test:unit` suite complète | 🟡 **2914/2921** (6 skip) — **−20 tests**, exactement ceux des mécanismes supprimés (9 `selectNewValues` + 7 `resolveGrowTarget` + 4 `resolveCreatable`) ; l'unique échec reste `tests/preflight/site-assets.test.ts`, **préexistant et sans rapport** (dossier vide non suivi `public/images/transiter`) |
| `test:e2e` (`e2e/parent62.spec.ts`) | ✅ **8/8** |

Les 4 fichiers supprimés sont sauvegardés hors dépôt le temps de la recette
(`scratchpad/suppr-saveNewValue/`), et restent de toute façon récupérables par `git`.
Non commité à ce stade.

---

## 9terdecies. Impacts — généralisation de la mécanique unique à TOUS les `themes` + `categoriesParole` (02/09)

> Suite de §9undecies (résolveur commun, câblé alors sur le seul formulaire d'ajout d'article) et de
> §9duodecies (retrait de `saveNewValue`). Ce lot branche les **deux consommateurs restants** — filtres
> de page et menu du header — et bascule les **30 déclarations** de `themes`/`categoriesParole` de
> parent62 sur la forme fusionnée.

### 9terdecies.1 État RÉEL du backend — mesuré, pas supposé

Vérifié le 02/09 par appel direct à `POST /costum/co/listvalues` (`slug=parent62`) sur
`http://communecter-dev` :

| Liste | Réponse serveur | Ce que ça dit |
|---|---|---|
| `themes` | `result:false — "liste non declaree"` | **absente** de `costum.lists`. Les 24 filtres ne montraient donc QUE les 18 options figées de la config, jamais la base. |
| `themesPoi` | `result:true`, **24 valeurs** | recette `distinct` **déjà déclarée et fonctionnelle** |
| `themesEvents` | `result:true`, **1 valeur** (`La communication`) | idem |
| `categoriesParole` | `result:true`, **0 valeur** | **c'est déjà une RECETTE** (une statique aurait été refusée avec « liste statique »), qui ne remonte rien pour l'instant |
| `categoriesParolePoi` | `result:false — "liste non declaree"` | n'existe pas — nom abandonné (cf. ci-dessous) |

Deux hypothèses de §9undecies sont donc **corrigées par la mesure** :
1. Les recettes `themesPoi`/`themesEvents` **n'étaient pas « à déclarer »** : elles existent déjà. La
   config de ce lot est donc **immédiatement fonctionnelle**, pas en attente d'un travail backend.
2. `categoriesParole` **est déjà un `distinct`** — l'inquiétude de §9duodecies.3 (« pas de remplaçant
   `distinct` évident, `poi.category` mélange deux taxonomies ») est sans objet côté déclaration : la
   recette existe et est scopée par le backend. Le nom `categoriesParolePoi` que ce lot avait d'abord
   introduit a été **retiré** : `list: ["categoriesParole"]` suffit.

### 9terdecies.2 Ce qui a changé côté moteur (générique, tout site)

- **`src/modules/search/hooks/useDynamicFilterOptions.ts`** — réécrit sur `resolveListSources` :
  `optionsFrom.list` accepte **une chaîne ou un tableau** ; `optionsKey` devient un **alias déprécié**
  (la forme statique/recette est détectée à la lecture, plus de clé à choisir) ; nouveau
  `optionsFrom.withDeclared` qui fait des `options` déclarées un **socle fusionné**. Les requêtes sont
  aplaties par couple (filtre, liste) — `useQueries` exige un nombre constant —, la recherche serveur
  sur liste tronquée (`q`) est mémorisée **par couple** et non plus par filtre.
- **Les libellés i18n survivent enfin.** Une option déclarée est RÉUTILISÉE telle quelle pour la valeur
  qu'elle porte (libellé, couleur, `level`) ; seules les valeurs venues de la base et absentes du socle
  s'affichent en `capitaliser(valeur)`. Jusqu'ici la branche `optionsKey` reconstruisait toutes les
  options à partir des valeurs brutes et **jetait les 18 libellés traduits**.
- **`src/components/layout/header/useResolveDynamicNav.ts` + `src/types/site-schema.ts`** :
  `dynamicList.list` accepte lui aussi un tableau, résolu et fusionné par le même code.
- **`src/modules/search/schema.ts`** : `OptionsFromSchema` accepte `list: string | string[]` et
  `withDeclared`, et est désormais partagé par `filterGroups` et `dropdownFilters` (forward-ref
  `z.lazy`, convention déjà en place dans ce fichier).

### 9terdecies.3 Un bug trouvé et corrigé en route — `optionsReady`

Première version : un filtre était marqué « prêt » dès qu'il avait **des valeurs à afficher**. Avec un
socle (`withDeclared`), il en a **dès le premier rendu**, alors que ses recettes sont encore en vol.
Conséquence observée en e2e sur `/recherche` : l'hydratation URL partait trop tôt, puis l'arrivée des
valeurs rejouait l'effet de lecture qui — l'URL étant vide et l'hydratation déjà faite — **effaçait la
cible de recherche par défaut** (« Actualités » n'était plus sélectionnée).

Corrigé : `optionsReady` signifie **« toutes les sources ont répondu »**, jamais « on a de quoi
afficher ». C'est le sens que la garde de deep-link a toujours supposé. Test de non-régression dédié
(`useDynamicFilterOptions.test.tsx` — « socle NON VIDE + recette en vol : PAS prêt »).

### 9terdecies.4 Ce qui a changé côté config parent62 (30 déclarations)

| Où | Avant | Après |
|---|---|---|
| 24 filtres `themes` | `"optionsKey": "themes"` | `"optionsFrom": {"list": ["themes","themesPoi","themesEvents"], "withDeclared": true}` |
| 1 filtre `category` (`/temoignages`) | `"optionsKey": "categoriesParole"` | `"optionsFrom": {"list": ["categoriesParole"], "withDeclared": true}` |
| 4 formulaires, champ `themes` | `"list": "themes"` | `"list": ["themes","themesPoi","themesEvents"]` |
| 1 formulaire, champ `category` | `"list": "categoriesParole"` | `"list": ["categoriesParole"]` |
| menu header « Thèmes » | `"list": "themes"` | `"list": ["themes","themesPoi","themesEvents"]` |

`themes` est **conservé** dans les listes bien qu'il ne soit pas déclaré en base : c'est la clé que la
section admin « Listes » propose déjà (whitelist `admin.tabs`), et le jour où un admin y ajoute une
valeur, elle est créée en statique et rejoint automatiquement la fusion comme socle éditable.

### 9terdecies.5 Trois conséquences à connaître

1. **Les valeurs de test remontent maintenant dans l'UI.** `themesPoi` contient `ffff` et `koly`,
   saisies librement pendant les essais : elles apparaissent désormais dans les filtres et les
   formulaires, pour tout le monde. C'est le comportement attendu d'un `distinct` — mais ça veut dire
   qu'un ménage en base (ou la modération des fiches porteuses) devient visible côté produit.
2. ~~`categoriesParole` n'est plus éditable dans la section admin « Listes »~~ — **dépassé le 02/09 :
   la section elle-même a été retirée** (§9quaterdecies). `costum.lists` est en lecture seule depuis
   site-json.
3. **`themes` étant absent de `costum.lists`**, le socle des filtres vient aujourd'hui **uniquement des
   `options` de la config** (18 valeurs, libellés i18n). C'est justement ce que `withDeclared` rend
   possible : sans lui, les filtres n'auraient plus affiché QUE les 25 valeurs de la base, en perdant
   les libellés.

### 9terdecies.6 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` (suite complète) | ✅ 0 erreur, 21 warnings — tous préexistants |
| `npx tsx scripts/validate-config.ts` (parent62 **et** institut-bleu) | ✅ 46/160 et 13/26 |
| `audit:config` | ✅ `config.prod.parent62.json — RAS` |
| `test:unit` suite complète | 🟡 **2925/2932** (6 skip) — **+11 tests** (`useDynamicFilterOptions.test.tsx`, nouveau) ; l'unique échec reste `tests/preflight/site-assets.test.ts`, **préexistant et sans rapport** (dossier vide non suivi `public/images/transiter`) |
| `test:e2e` (`e2e/parent62.spec.ts`) | ✅ **8/8** — dont le test `/recherche` qui avait détecté la régression `optionsReady` |
| Vérification backend réelle | ✅ cf. §9terdecies.1 (5 listes interrogées en direct) |

Non commité à ce stade.

---

## 9quaterdecies. Impacts — retrait de la section admin « Listes » : `costum.lists` devient LECTURE SEULE (02/09)

> Décision : depuis que les valeurs remontent d'elles-mêmes des recettes `distinct` (§9terdecies) et
> que le socle se déclare en config (`optionsFrom.withDeclared` / `enum` du champ), l'édition manuelle
> de `costum.lists` n'a plus d'objet. Elle était de toute façon devenue largement inopérante sur
> parent62 : ses deux clés whitelistées étaient `themes` (**absente** de `costum.lists`) et
> `categoriesParole` (**recette**, donc en lecture seule dans cette section).

### 9quaterdecies.1 Ce qui a été supprimé

| Supprimé | Rôle |
|---|---|
| `src/modules/admin/sections/AdminListsSection.tsx` | l'écran maître-détail d'édition |
| `src/modules/admin/hooks/useCostumListsMutations.ts` + test | les 5 opérations d'écriture (`$push` / `$set` de tableau complet) |
| `src/modules/admin/lib/costumListsEditing.ts` + test | la logique pure (validation, dédoublonnage, permutation) |
| `registerAdminSection("lists", …)` + import (`AdminSectionRenderer.tsx`) | l'enregistrement du type de section |
| bloc i18n `AdminLists` (fr + en, 23 clés chacun) | les libellés de l'écran |
| onglet admin « Listes » de `config.prod.parent62.json` | le seul usage du parc (vérifié : aucune autre config ne déclare `{type:"lists"}`) |

`SortableList` (`src/components/admin/SortableList.tsx`) est **conservé** : `AdminPanel` s'en sert aussi.

### 9quaterdecies.2 La conséquence, en une phrase

**`costum.lists` est désormais en lecture seule depuis site-json** — plus aucune écriture, ni
automatique (`saveNewValue`, retiré en §9duodecies) ni manuelle. Ajouter une valeur qu'aucune fiche ne
porte encore se fait donc :
- en **config** (socle du champ ou du filtre : `enum` / `options` + `withDeclared`) — déploiement ;
- ou dans le **costum côté backend** (déclaration `costum.lists`) — hors site-json.

Pour parent62 c'est sans perte : les thèmes viennent des recettes `themesPoi`/`themesEvents`, et le
socle de 18 valeurs avec ses libellés i18n vit déjà dans la config.

### 9quaterdecies.3 Un gate à resynchroniser (piège connu de ce dépôt)

Retirer l'onglet a fait échouer `tests/preflight/archetypes.test.ts` : l'exemple canonique
`admin` de l'assistant config est un **snapshot** du bloc `admin` de `config.prod.parent62.json`.
Resynchronisé par `npm run config:example -- admin --write` (le message d'erreur du gate donne la
commande). À refaire à chaque modification du bloc `admin` de cette config.

### 9quaterdecies.4 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` (suite complète) | ✅ 0 erreur, 21 warnings — tous préexistants |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 160 sections** |
| `audit:config` | ✅ `config.prod.parent62.json — RAS` |
| `test:unit` suite complète | 🟡 **2886/2893** (6 skip) — **−39 tests**, ceux des modules supprimés ; l'unique échec reste `tests/preflight/site-assets.test.ts`, **préexistant et sans rapport** (dossier vide non suivi `public/images/transiter`) |
| `test:e2e` (`e2e/parent62.spec.ts`) | ✅ **8/8** |

Les 5 fichiers supprimés sont sauvegardés hors dépôt le temps de la recette
(`scratchpad/suppr-adminLists/`), et restent récupérables par `git`. Non commité à ce stade.

---

## 9quindecies. Consolidation du chantier « listes » — code mort, commentaires, doc moteur (03/09)

> Passe de relecture de l'ensemble §9undecies → §9quaterdecies : ce que les suppressions successives
> ont rendu inutile, et la doc **moteur** (`doc/`) mise au niveau — jusqu'ici seule la doc projet avait
> suivi.

### 9quindecies.1 Code devenu mort, retiré

- **`mergeDeduped`** (`src/modules/search/lib/dropdownFilters.ts`) et ses 4 tests : plus aucun appelant
  depuis que `resolveListSources` (`@/lib/listSources`) fait la même fusion — même règle d'égalité
  (`normalizeFilterValue`), même « première graphie rencontrée gagne » — **et** unit en plus les
  `variants`. Ses deux consommateurs (`ValueSelectField`, branche `optionsKey` des filtres) sont
  passés au nouveau résolveur.
- Rappel des suppressions précédentes du même chantier, pour mémoire : `growCostumLists` +
  `selectNewValues` + `resolveGrowTarget` + `resolveCreatable` (§9duodecies), `AdminListsSection` +
  `useCostumListsMutations` + `costumListsEditing` (§9quaterdecies).

### 9quindecies.2 Commentaires réalignés

Une dizaine de docstrings citaient encore, comme référence VIVANTE, du code désormais supprimé
(`growCostumLists`, `selectNewValues`, la section admin « Listes », `mergeDeduped`) ou décrivaient un
comportement changé (substitution au lieu de fusion). Toutes corrigées — un commentaire qui contredit
le code est un bug, au même titre qu'une ligne fausse. Deux ajustements de fond :

- **`ValueSelectField`** : deux paragraphes racontaient la même suppression sous deux angles. Réduits à
  un seul, qui dit ce qui compte aujourd'hui (le champ n'écrit rien, `costum.lists` est en lecture
  seule, une valeur inédite s'ajoute en config) plutôt que l'historique — que `git` conserve déjà.
- **`useListSources`** : l'avertissement DEV « liste absente de `costum.lists` » tournait à **chaque
  rendu de chaque champ**. Déplacé dans un `useEffect` clé sur les noms de listes : même service, sans
  le bruit.

### 9quindecies.3 Documentation moteur (`doc/`) mise à jour

| Fichier | Ce qui a changé |
|---|---|
| `doc/07-module-search.md` | La section « Options DYNAMIQUES d'un filtre » devient « Options d'un filtre depuis `costum.lists` » : détection automatique de la forme, `list` en tableau, union des `variants`, `withDeclared`, `optionsKey` alias déprécié, et le sens exact d'`optionsReady` (avec le piège du socle non vide). |
| `doc/05-schemas-sections.md` | La ligne `dropdownFilters` du tableau donne la forme réelle d'`optionsFrom` (`{list: string \| string[], costumSlug?, withDeclared?}`). |
| `doc/30-module-admin.md` | Section `lists` remplacée par un encart « RETIRÉE » + conséquence lecture seule ; comptage des sections génériques corrigé (3 → 2) ; entrée de backlog obsolète remplacée. |

Non touchés à dessein : `doc/28-module-formengine.md` et `doc/cartographie-forms-formalisme.md`
mentionnent l'`optionsKey` **du moteur de formulaire** (`listsOptions[optionsKey ?? name]`, cf.
`GenericForm`) — un mécanisme homonyme mais DISTINCT de celui des filtres, et inchangé par ce chantier.

### 9quindecies.4 Architecture — l'orchestration des requêtes factorisée (`useListEntries`)

Premier jet : seule la fusion PURE (`resolveListSources`) était partagée. L'**orchestration** — pour
chaque nom de liste, décider statique (lecture mémoire) ou recette (requête), puis calculer l'état
« réglé » — se retrouvait écrite **trois fois** : `useListSources`, `useDynamicFilterOptions`,
`useResolveDynamicNav`. C'est la 3ᵉ répétition, seuil à partir duquel le dépôt impose un helper
générique.

Extrait dans **`src/hooks/useListSources.ts`** :

- **`useListEntries(entrees)`** — le socle : N couples `(clé, liste)` résolus en UNE passe `useQueries`
  et regroupés par clé. C'est la forme qu'il FAUT dès qu'on résout plusieurs entités à la fois (un
  filtre par groupe, un item par menu) : un hook ne s'appelle pas dans une boucle, et `useQueries`
  exige un nombre et un ordre de requêtes constants d'un rendu à l'autre. Rend aussi les listes que le
  serveur a **coupées**, ce qui permet aux filtres de garder leur recherche serveur (`q`) sans que
  cette logique remonte dans le socle.
- **`useListSources(lists)`** — le cas simple (une entité), devenu une enveloppe de quelques lignes.

Les deux consommateurs multi-entités passent dessus : `useDynamicFilterOptions` ne garde que ce qui
lui est propre (plafond, mémoire des troncatures, socle `withDeclared`, reconstruction des options en
préservant les libellés) et `useResolveDynamicNav` que la construction des liens de menu. Effet de
bord : `resolveDynamicNavValues` (et ses 6 tests) devient du code mort — la distinction
statique/recette qu'elle portait ne vit plus qu'à un seul endroit, où elle est testée.

**Direction des dépendances** vérifiée au passage : `src/lib/listSources.ts` (pur) ← `src/hooks/`
(orchestration) ← modules et composants. `listSources` importe `normalizeFilterValue` du module
`search` — direction `lib → modules` inhabituelle, mais **conforme à l'usage établi** ici
(`lib/buildRoutes.tsx`, `lib/queryKeys.ts`, `lib/entityMatch.ts` et `lib/visibility/` font de même) ;
déplacer ce primitif de normalisation serait un refactor sans rapport avec ce chantier.

### 9quindecies.5 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` (suite complète) | ✅ 0 erreur, 21 warnings — tous préexistants |
| `validate-config` (parent62 **et** institut-bleu) | ✅ 46/160 et 13/26 |
| `audit:config` | ✅ `config.prod.parent62.json — RAS` |
| `test:unit` suite complète | 🟡 **2876/2883** (6 skip) — **−10** (tests de `mergeDeduped` et de `resolveDynamicNavValues`, tous deux devenus morts) ; l'unique échec reste `tests/preflight/site-assets.test.ts`, **préexistant et sans rapport** (dossier vide non suivi `public/images/transiter`, qu'un `rmdir` réglerait — décision hors périmètre) |
| `test:e2e` (`e2e/parent62.spec.ts`) | ✅ **8/8** |

**Bilan du chantier (§9undecies → §9quindecies), 4 fichiers créés / 11 supprimés :** une seule
mécanique de résolution des listes de valeurs (socle déclaré + N listes `costum.lists`, forme détectée
automatiquement, fusion et union des `variants`), partagée par les filtres de page, les champs de
formulaire et le menu du header ; `costum.lists` passé en lecture seule ; 30 déclarations parent62
basculées. Non commité à ce stade.

---

## 9sexdecies. Impacts — champ « Type d'actualité » dans le formulaire d'article (02/09)

> Périmètre : **config parent62 uniquement** (`config.prod.parent62.json`), zéro code moteur, zéro
> impact backend. Complète le lot du 06/08 (§9quater) : les pages publiques `/appels-a-projets` et
> `/offres-emploi` filtrent des `articleFeed` par **tag WordPress libre** (`Appels à projets` /
> `Offres d'emploi`) ; le formulaire d'ajout d'article permet désormais de choisir ce type, et le
> mot-clé est posé automatiquement. Les pages publiques sont **inchangées**.

### 9sexdecies.1 Ce qui a changé (`config.prod.parent62.json`)

- **`costumForms.parent62-article`** — deux ajouts, le reste du formulaire est intact :
  - un champ **`category`** (`widget: "select"`, libellé « Type d'actualité », **non requis**), placé
    juste après le titre dans la section « Contenu », à **3 valeurs** :

    | valeur | libellé | effet à l'enregistrement |
    |---|---|---|
    | `actualite` | Article simple | aucun mot-clé posé |
    | `appel-projet` | Appel à projets | mot-clé `Appels à projets` |
    | `offre-emploi` | Offre d'emploi | mot-clé `Offres d'emploi` |

  - un **`mutation.stamps`** (moteur `src/modules/profil/forms/stamps.ts`, cf.
    [doc/28 §mutation.stamps](../doc/28-module-formengine.md)) :

    ```jsonc
    { "field": "tags", "op": "append", "on": "both",
      "value": { "$mapLabels": { "from": "category",
        "map": { "appel-projet": "Appels à projets", "offre-emploi": "Offres d'emploi" } } } }
    ```

    `on:"both"` + `op:"append"` = le mot-clé est reposé à **chaque enregistrement, création ET
    édition**, en union dédupliquée avec les mots-clés saisis et avec les tags déjà présents sur
    l'entité (`targetServerData`). `actualite` est **volontairement absent de la table de
    correspondance** : `$mapLabels` ignore les valeurs non mappées, le stamp est alors inerte et un
    article simple ne reçoit aucun tag automatique.
- **2 nouveaux onglets `admin.tabs`** (`appels-projets`, `offres-emploi`) insérés après
  « Actualités », calqués sur celui-ci : table `resource` `poi` filtrée par
  `source.defaultTags: ["<label>"]` (canal `searchTags`,
  [buildSearchPayload.ts](../src/modules/search/lib/buildSearchPayload.ts)) + `defaultFilters.type:"article"` ;
  `rowActions: [edit, delete, validate]`, `bulkActions: [validate, export, delete]` ;
  `create: "add-parent62-article"`, `edit: "inherit"` — un seul formulaire sert les 3 types.
  Chaque onglet porte en plus **`createDefaults: { "category": "<sous-type>" }`** : le **+** de
  l'onglet ouvre le formulaire déjà positionné sur son type, sans re-demander à l'admin ce que
  l'onglet dit déjà (capacité moteur ajoutée par ce lot, cf. §9sexdecies.2).
- Une annonce reste un POI `type:"article"` : elle apparaît **aussi** dans la table « Actualités »
  générique, et sa page de lecture publique reste le reader `/blog/:slug`.
- **Pages publiques, `blog`, RSS, `/recherche` : inchangés.** Le filtrage reste sur `tags`, donc les
  articles déjà tagués à l'import WordPress restent visibles sans backfill.

### 9sexdecies.2 Ce qui a changé côté moteur (générique, tout site)

Une seule capacité, opt-in, ajoutée pour éviter la duplication d'un formulaire costum par sous-type :

- **`src/modules/profil/forms/createDefaults.ts`** (neuf, pur, testé — 8 cas) :
  `applyCreateDefaults(defaults, seed, knownFields)` fusionne le semis **par-dessus** les défauts
  dérivés, en **ne retenant que les champs réellement déclarés** par le formulaire (une clé mal
  orthographiée en config est donc inerte, pas une valeur fantôme dans l'état du form), en écartant
  `undefined`, et en renvoyant l'objet **par identité** quand rien ne s'applique — la non-régression
  des formulaires sans `createDefaults` est prouvable par `toBe`.
- **`src/modules/admin/schema.ts`** : `createDefaults?: Record<string, unknown>` sur une section
  `resource`. **`scripts/lib/prop-descriptions.ts`** : sa sémantique, pour que
  `config:schema admin` la documente.
- **Propagation** : `AdminResourceTable.tsx` → `ModalRegistry.tsx` (`ModalProps`, `DynamicModal`,
  thunk costum + 4 entrées statiques) → `EntityFormModal.tsx`, qui applique le semis **en mode
  `add` uniquement** — en édition le seed vient de l'entité, et l'écraser par une valeur d'onglet
  réécrirait une fiche existante à l'insu de l'admin.
  Les 4 entrées statiques ne sont pas du zèle : `resolveCreateModal` retombe sur la modale
  `standard` dès qu'aucun form costum ne correspond au type, sur `create:"standard"` explicite, et
  en repli quand plusieurs candidats ne sont départagés par aucune `identity` — un site sans form
  costum bénéficie donc du semis comme les autres.
- **`tests/preflight/effective-config.test.ts`** : la projection de la garde d'impact inclut
  désormais `createDefaults` — la clé change ce qui est ÉCRIT sur une fiche neuve, elle mérite la
  même surveillance que la modale elle-même.

Doc moteur : [doc/30-module-admin.md](../doc/30-module-admin.md) §`resource`.

### 9sexdecies.3 Tests / snapshots mis à jour

| Fichier | Raison |
|---|---|
| `tests/preflight/stamps.test.ts` | sentinelle d'inventaire du parc — ajout `"parent62/parent62-article:1"` + commentaire |
| `tests/preflight/__effective__/parent62.json` | garde d'impact — projection des 2 sources admin, du stamp et des `createDefaults` |
| `.claude/skills/config-assistant/examples/admin.json` | snapshot de l'exemple admin (source = parent62), resync `config:example -- admin --write` |

### 9sexdecies.4 Régressions à revalider

- **Filtre `defaultTags` d'une table admin en mode admin** (endpoint `globalautocompleteadmin`,
  activé par `validate` ∈ `rowActions`) : `searchTags` est bien transmis au SDK (`useSearchQuery` →
  `buildSearchPayload`), mais son honneur côté endpoint admin n'est pas prouvé en preview ici — **à
  vérifier** sur `/admin/appels-projets` avec le backend réel. Repli : retirer `validate` de ces
  2 onglets (repasse en recherche publique, où `searchTags` est éprouvé par les `articleFeed` de
  `/appels-a-projets`).
- **`category` sur les 6 434 articles existants est vide** (le champ n'était porté que par
  `parent62-affiche` et `parent62-recovery-center`, cf. §5.2) : à l'édition d'un article importé, le
  select s'ouvre sur son placeholder. Sans conséquence — le champ n'est pas requis, et un tag déjà
  présent est préservé par `op:"append"` (fusion `targetServerData`).
- **Le champ n'est pas exposé aux 2 autres formulaires** (`parent62-affiche`, `parent62-recovery-center`)
  qui ont chacun leur propre `category` avec une sémantique différente (catégories de paroles /
  types de ressource) — aucune interférence, les 3 énumérations restent disjointes.

### 9sexdecies.5 Validation (gates)

Mesurés le 03/09, APRÈS le merge du chantier « listes » (§9undecies→§9quindecies) :

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` (suite complète) | ✅ 0 erreur, 22 warnings — **comptage identique avec et sans ce lot** (vérifié sur `HEAD`), donc aucun introduit |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 161 sections** |
| `audit:config --file config.prod.parent62.json --json` | ✅ RAS (0 constat) |
| `test:unit` (suite complète) | ✅ **2 945 passés** / 2 952 — 1 échec **pré-existant sans rapport** (`site-assets` : dossier vide `public/images/transiter`, reproduit sans ce lot), 6 skip |

Non commité à ce stade.

---

## 9septendecies. Impacts — double entrée parents / pro rétablie sur l'accueil (02/09)

> Périmètre : **config parent62 uniquement**, zéro code. Lève la régression **1.4**, ouverte depuis
> la refonte de l'accueil du 06/08 (§9quater).

### 9septendecies.1 Le constat

`/parents` et `/pro` existaient toujours comme pages, mais **plus aucun lien n'y menait** : chaque
chemin n'apparaissait qu'**une seule fois** dans la config — sa propre déclaration de page. La
section qui les exposait (`action-tiles` `home-double-entree`, « Vous êtes… ») avait disparu de
l'accueil à la refonte du 06/08, sans remplacement. Le dropdown « Publics » (7 pages `/public/*`, **9 depuis le 09/09**)
ajouté au même moment couvre un axe **différent** (public visé : parents, enfance, professionnels…),
pas l'orientation parent / professionnel — il ne les remplaçait donc pas. Question ouverte du §13
depuis le 06/08, **tranchée** : les deux coexistent.

### 9septendecies.2 Ce qui a changé

- **`config.prod.parent62.json`, page `/`** : section `action-tiles` `home-double-entree` réinsérée
  en **2ᵉ position**, entre le carrousel « à la une » et la carte à bulles — sa place d'origine dans
  le rythme de la page (accroche → orientation → territoires → actus). Accueil : 3 → **4 sections**.
- **`.claude/skills/config-assistant/page-recipes.json`** : recette `home-a-la-une` resynchronisée
  (`sequence`, `titre`, `quand`, `rythme`). Elle décrivait « trois blocs, zéro texte statique », ce
  qui n'est plus exact — l'accueil porte désormais un bloc rédigé. Gate `page-recipes.test.ts`, qui
  compare la séquence annoncée à la page réelle de l'archétype.

### 9septendecies.3 Validation (gates)

| Gate | Résultat |
|---|---|
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 161 sections** |
| `audit:config --file config.prod.parent62.json --json` | ✅ RAS (0 constat) |
| `config:render config.prod.parent62.json` | ✅ 46/46 pages · accueil **3/4** sections SSR — la 4ᵉ est le `featured-carousel`, data-driven, déjà non rendu en SSR avant ce lot (mesuré : 2/3 avant, 3/4 après) |
| `test:preflight` (dont `page-recipes`) | ✅ — 1 échec pré-existant sans rapport (`site-assets`) |
| `test:e2e` | ⏭️ non rejoué (pas de `.env.test` dans cet environnement) |

Non commité à ce stade.

---

## 9octodecies. Impacts — deux nouveaux types de ressources + renommage « Jeu » (03/09)

> ⚠️ **Annulé pour partie le 09/09** (cf. §9unvicies) : les deux types ajoutés ici sont supprimés et
> « Les jeux du réseau » redevient « Jeu ». Section conservée pour l'historique de la décision et
> pour son §9octodecies.3, dont le point d'attention s'est réalisé.
>
> Périmètre : **config parent62 uniquement**, zéro code. Étend la taxonomie du champ `category` des
> fiches ressource (`parent62-recovery-center`), consommée par la page `/ressources`, la cible
> « Ressources » de `/recherche` et la palette ⌘K.

### 9octodecies.1 Ce qui a changé (`config.prod.parent62.json`)

- **`costumForms.parent62-recovery-center.fields.category`** — l'énumération passe de **6 à
  8 valeurs** :

  | valeur | statut |
  |---|---|
  | Vidéo · Photo · Compte-rendu · Document · Lien | inchangées |
  | **Les jeux du réseau** | renommée (ex-« Jeu ») |
  | **Inforéso** | nouvelle |
  | **Elles et ils ont marqué le réseau** | nouvelle |

- **Badge (couleur + icône) déclaré aux 3 endroits qui rendent une carte ressource** — les trois
  blocs `list.resource.badge` doivent rester alignés, sinon un même type change d'aspect selon
  l'écran :

  | emplacement | chemin |
  |---|---|
  | page `/ressources` | `pages[/ressources].sections[1].props.list.resource.badge` |
  | page `/recherche` | `…rightSection.props.list.itemRules[2].resource.badge` |
  | palette ⌘K | `commandPalette.entitySearch.itemActionBySubType.recoveryCenter.list.resource.badge` |

- **Couleurs** : les 5 jetons `chart-*` étant déjà pris par les 5 premiers types, les deux nouveaux
  prennent des jetons de STATUT — `Inforéso` → `var(--info)`, `Elles et ils ont marqué le réseau` →
  `var(--success)`. Ils suivent le thème (clair/sombre) comme les `chart-*`.
- **Icônes** : `badge.icons` (nouveau bloc) ne déclare que les **3** types que le moteur ne peut pas
  deviner — `newspaper`, `award`, `gamepad-2`. Les 5 autres restent servis par le repli de
  `resolveTypeIcon` (map interne `RESOURCE_TYPE_ICON`, puis `file`), donc aucun type n'est sans
  icône.

### 9octodecies.2 Les noms d'icônes ne sont couverts par aucun gate

Le contrôle `icone-inconnue` d'`audit:config` teste les **clés** dont le nom finit par `icon`
(`/icon$/i`, `audit-config.ts:302`). Dans `badge.icons`, les clés sont les **noms de types**
(`Inforéso`…) et les icônes sont les **valeurs** : le bloc passe donc à travers l'audit. Un nom
d'icône fautif y serait rendu `null` depuis un `useEffect`, sans erreur ni trace SSR.

Les 3 noms ont donc été vérifiés **à la main** contre le catalogue lucide (le même que l'audit,
1901 noms, via `lucideIconNames`) : `newspaper`, `award`, `gamepad-2` — les trois existent.
À refaire à chaque ajout de type, tant que la règle d'audit n'inspecte pas aussi les valeurs.

### 9octodecies.3 Point d'attention

Le renommage « Jeu » → « Les jeux du réseau » porte sur la **valeur stockée**, pas seulement sur le
libellé : les fiches déjà enregistrées avec `category: "Jeu"` gardent l'ancienne valeur et ne
tombent plus dans aucune option de l'énumération. À reprendre en base si de telles fiches existent
(non vérifié ici — pas d'accès aux données de production depuis cet environnement).

### 9octodecies.4 Validation (gates)

| Gate | Résultat |
|---|---|
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 161 sections** |
| `audit:config --file config.prod.parent62.json --json` | ✅ RAS (0 constat) |
| `test:preflight` | ✅ **535 passés** — 1 échec pré-existant sans rapport (`site-assets`) |

Snapshots de la skill `config-assistant` resynchronisés (`command-palette`, `list-item-rules`,
`list-resource`), leurs blocs `badge` étant copiés de cette config.

---

## 9novodecies. Impacts — refonte du haut des 9 pages territoire + saisie admin des réunions (03/09)

> Périmètre : **`config.prod.parent62.json`**, plus deux apports **génériques** au moteur
> (§9novodecies.4). Les 9 pages `/territoire/*` partagent désormais le MÊME gabarit à **9 sections**
> (elles en avaient 7 ou 8) ; total config : 161 → **174 sections**. S'y ajoutent un 5ᵉ formulaire
> costum et un 9ᵉ onglet `/admin`.

### 9novodecies.1 Le gabarit des pages territoire

`html` (bandeau) · **`agenda`** · `cards` · **`searchProStatic`** · `searchHeader` · `articleFeed` ·
`accordion` (communes) · `searchProStatic` (actions) · `cta`.

| Volet | Configuration | Position |
|---|---|---|
| **Dates du comité local** | `agenda` en teaser : `limit:3` (les 3 prochaines réunions), `showTabs:false`, `showViewToggle:false`, `defaultTab:"upcoming"`, colonnes `lg:3` alignées sur la liste voisine. `baseParams` : `filters {type:"meeting", territoires:{$in:[…]}}`, `costumSlug:"parent62"` (porte de modération), `indexStepList:30` | `sections[1]`, juste après le bandeau |
| **Comptes rendus des réunions** | 2ᵉ carte de la section `cards` (2 colonnes) : `href` = dossier Drive du territoire, `target:"_blank"`, icône `folder-open` | `sections[2]` |
| **Ressources du territoire** | `searchProStatic` : `indexStepList:3` (3 fiches), `defaultFilters {type:"recoveryCenter", territoires:{$in:[…]}}`, presenter `resource` repris de `/ressources`, bouton d'en-tête « Voir toutes les ressources » → `/ressources?territoire=<id>` | `sections[3]` |

Deux points de forme qui conditionnent le rendu :

- **`indexStepList` d'un teaser d'agenda n'est pas son `limit`.** Le flux LISTE est trié
  `startDate` DESC, les trois buckets mêlés, et `limit` ne plafonne que l'affichage : la page
  demandée doit donc être large (30 ici) pour que le bucket « À venir » soit complet. Contrat
  détaillé dans [`doc/29-module-agenda.md`](../doc/29-module-agenda.md).
- **Le deep-link du bouton porte l'`id` d'option, pas le libellé** (`?territoire=arrageois`,
  `…=familles-en-sol-mineur-henin-carvin`) : c'est ce que compare l'hydratation d'un
  `dropdownFilters`. Les `cta` voisins vers `/recherche` gardent le libellé — cette page filtre par
  une sidebar `filters`, dont la convention accepte `name || id`.

### 9novodecies.2 Ce qui a été retiré des pages

- **La carte « Le comité local »** : son texte renvoyait à l'agenda et au Drive, désormais portés
  par deux volets propres, juste à côté. La grille `cards` garde 2 colonnes :
  coordonnateur·rice + comptes rendus.
- **Les 5 blocs `html` de liens externes** (arrageois, audomarois, boulonnais, calaisis,
  entre-mer-et-terres). Leurs 11 URL sont **archivées ci-dessous** pour ressaisie éventuelle en
  fiches ressource (`parent62-recovery-center`, category *Lien*) — c'est la seule trace qui en reste :

  | Territoire | Liens |
  |---|---|
  | Arrageois | `https://rp62-arrageois.gogocarto.fr` · `www.parent62.org/plaquette-ressource-parentalite-et-eloignement-du-reseau-parentalite-de-larrageois/` · `…/guide-ressource-parents-dados-a-destination-des-partenaires-realisation-et-participation-des-parents-du-territoire-de-larrageois/` |
  | Audomarois | `https://acteur-parentalite-audomarois.gogocarto.fr/` |
  | Boulonnais | `www.parent62.org/jeux-et-outils-du-reseau-2/` · `…/les-lieux-daccueil-enfants-parents-du-boulonnais/` · `http://soutenirlesaidants.fr` |
  | Calaisis | `www.parent62.org/jeux-et-outils-du-reseau/` · `…/autour-des-parents-une-nouvelle-application-pour-les-familles-du-calaisis/` |
  | Entre Mer et Terres | `https://reseau-parentalite-entre-mer-e.gogocarto.fr/map` · `…/decouvrez-biblioboost-site-de-consultation-et-demprunt-des-jeux-et-outils-disponibles-sur-le-montreuillois/` |

- Les **props sans effet** des nouveaux volets : `useFilter`, `showActiveFiltersTypes` et
  `showActiveFiltersTags` (non lues par `SearchProStatic` — seul `SearchPro` les lit), et celles qui
  répétaient le défaut du composant (`showMap`, et côté agenda `defaultMode`,
  `upcomingWindowMonths`, `detailsMode`, `enableMap`, `filters.tags`). Conservés parce qu'ils
  changent le comportement : `enableMap:false` sur `searchProStatic` (son défaut est `true`),
  `disableInfiniteScroll:true`, et `defaultTab:"upcoming"` — le bucket rendu par le teaser, écrit
  plutôt qu'emprunté au composant.

### 9novodecies.3 Saisie des réunions : 5ᵉ formulaire costum + 9ᵉ onglet `/admin`

Le volet ne montre que des events `type:"meeting"`, et le formulaire public `parent62-event` force
`type:"others"` (`mutation.inject.extraFields`). D'où deux ajouts :

- **`costumForms.parent62-reunion`** — clone de `parent62-event` (mêmes champs, mêmes sections,
  `territoires` requis), qui n'en diffère que par `id`, `chrome` et sa `mutation` :
  `inject.extraFields = {type:"meeting"}` et **pas de `preferences.toBeValidated`**. Ce second point
  est délibéré : le formulaire n'est ouvert que depuis `/admin`, et la porte `costumSlug:"parent62"`
  du volet masquerait une réunion en attente — l'admin l'enregistrerait sans rien voir apparaître.
- **Onglet `/admin` « Réunions du comité »** (après « Agenda ») — section `resource`
  `entityType:"events"`, `source.defaultFilters {type:"meeting"}`, colonnes
  Titre · Territoire · Début · Commune, `create:"add-parent62-reunion"`, `edit:"inherit"`.
  L'onglet « Agenda » reste filtré sur `type:"others"` : les deux listes sont disjointes.

Aucun code : `add-<id>` est résolu dynamiquement (`costumModalThunk`, `ModalRegistry.tsx`) et tout
`config.costumForms.<id>` est enregistré au boot client (`registerCostumForms.ts`). `createDefaults`
n'était pas une option : il est filtré sur les champs DÉCLARÉS du formulaire (`applyCreateDefaults`),
et `type` n'en est pas un.

### 9novodecies.4 Apports moteur (génériques, tout site)

| Apport | Fichiers |
|---|---|
| **`buildViewAllHref`** — le lien « voir tous » d'un `customHeader` fusionne proprement la query de config (scope de la page cible, ex. `?territoire=…`) avec les filtres actifs de la page de départ, au lieu de les concaténer. En cas de clé commune, la config gagne. **6 tests** | `src/modules/search/lib/viewAllHref.ts` (+ `.test`, neufs) ; `SearchProStatic.tsx` délègue son `useMemo` |
| **Gate `deeplink-filters`** — tout `customHeader.linkHref` visant une page qui déclare des `dropdownFilters` doit nommer un filtre existant et une valeur qui est un **id d'option** (l'hydratation ignore en silence un id inconnu). **3 tests**, sans exemption : le parc entier passe | `tests/preflight/deeplink-filters.test.ts` (neuf) |
| **Contrat `limit` / `indexStepList` / `upcomingWindowMonths`** écrit là où un configurateur le lit ; deux commentaires devenus faux (un « fetch calendrier now→fenêtre » remplacé depuis par le flux liste unique) remis à jour | `src/modules/agenda/schema.ts`, `scripts/lib/prop-descriptions.ts`, `doc/29-module-agenda.md` |

### 9novodecies.5 Ce qu'il faut en base pour que les volets se remplissent

Les trois volets sont config-driven : ils n'affichent que ce que le costum `parent62` porte.

| Volet | Condition |
|---|---|
| Ressources du territoire | des POI `type:"recoveryCenter"` portant le `territoires` de la page |
| Dates du comité local | des events `type:"meeting"` portant ce même `territoires`, créés depuis l'onglet `/admin` « Réunions du comité » (§9novodecies.3) |

Corollaire : `/agenda` filtrant `type:"others"`, les réunions n'y apparaîtront pas (§13). Le
périmètre de chaque section se vérifie à la demande avec `npm run config:probe`, à lire sur le
backend visé.

### 9novodecies.6 Validation (gates)

| Gate | Résultat |
|---|---|
| `typecheck` | ✅ 0 erreur |
| `lint` | ✅ 0 erreur, 22 warnings — aucun sur les fichiers touchés |
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ **46 pages, 174 sections** |
| `audit:config --file config.prod.parent62.json` | ✅ RAS (0 constat) |
| `test:preflight` | ✅ **540 passés** (+3 : le gate `deeplink-filters`) — 1 échec pré-existant sans rapport (`site-assets`, dossier `public/images/transiter`) |
| `config:render config.prod.parent62.json` | ✅ 46/46 pages · **173/174 sections** avec contenu SSR (la 174ᵉ = `featured-carousel` de l'accueil, déjà non rendu en SSR avant ce lot) · pages territoire **9/9** |
| `test:unit` — `search` · `agenda` · `profil`+`admin` | ✅ 441/441 · 42/42 · 566/566 |
| Périmètre | ✅ **parent62 seul** — aucune autre `config.prod.*.json` n'est modifiée |
| `test:e2e` | non rejoué (pas de `.env.test` ici) ; `e2e/parent62.spec.ts:161` n'assied rien sur le nombre de sections |

Resynchronisés avec la config : recettes `page-annuaire-grille` / `page-territoire` de la skill
`config-assistant`, exemple `admin`, snapshot `tests/preflight/__effective__/parent62.json`.

Lot **non commité**.

---

## 9vicies. Impacts — lot « Paroles de parents » : catégories libérées, adresse, image, carte (09/09)

> Périmètre : **`config.prod.parent62.json`** (page `/temoignages`, formulaire `parent62-affiche`,
> CTA d'accueil, 3 contrats `testimonial`) + **4 fichiers du moteur** — l'illustration manquait au
> contrat `testimonial`, qui n'avait pas d'`imageField` là où `resource` en a un depuis l'origine.
> Demande du réseau en 4 points : retirer les 3 catégories par défaut, ajouter une adresse et une
> image à la saisie d'une parole, poser la carto sur `/temoignages`.
> Nombre de pages/sections **inchangé** (46 / 174) : rien n'est ajouté à la page, la carte est une
> vue de la section existante.

### 9vicies.1 Les 3 catégories par défaut retirées

« Compliqué / Difficile / À changer » étaient déclarées **deux fois comme socle** et **trois fois
comme couleurs**. Depuis le 25/08 (§9septies) la catégorie est en saisie libre et la liste
`categoriesParole` est une **recette `distinct`** (§9terdecies) : le socle n'était plus un défaut
utile, il réinjectait trois valeurs que la donnée ne portait pas nécessairement.

| Emplacement | Avant | Après |
|---|---|---|
| Form `parent62-affiche`, `fields.category` | `enum` de 3 valeurs (socle du `valueSelect`) | plus d'`enum` — seule la recette alimente, la **saisie libre reste ouverte** (`creatable` par défaut) |
| `/temoignages`, filtre `category` | `options` (3) + `optionsFrom.withDeclared:true` | `optionsFrom.list:["categoriesParole"]` seul (`withDeclared` retiré : sans socle il n'a plus d'objet) |
| 3 contrats `testimonial` (`/temoignages`, itemRule `poi-parole` de `/recherche`, preset `affiche` de la palette) | `badge.colors` mappant ces 3 valeurs | `badge: {field:"category"}` nu — `valueColor` retombe sur la **palette déterministe** du thème, donc toute catégorie reçoit une couleur stable |
| Accueil, CTA « Écouter des paroles de parents » | sous-titre « Compliqué, difficile… et à changer » | « Ce que les parents du 62 racontent de leur quotidien » |

Plus aucune occurrence de ces trois libellés dans la config. **Conséquence à surveiller** :
`category` reste `required` — si la recette ne remonte encore rien, le sélecteur s'ouvre vide et la
catégorie doit être **tapée**. C'est le comportement demandé, pas un défaut.

### 9vicies.2 Un bug du moteur révélé par ce retrait

Retirer les `options` du filtre a fait **tomber la section `searchHeader` entière** :
`Cannot read properties of undefined (reading 'filter')`. `TitleWithFiltersDropdownSchema.options`
porte un `.default([])`, mais **la config JSON n'est jamais parsée par Zod au runtime** — le défaut
n'agit pas, et les **7 lectures** de `filter.options` de
[`SearchHeaderSection.tsx`](../src/modules/search/sections/SearchHeaderSection.tsx) supposaient le
tableau présent. Un filtre 100 % dynamique (`optionsFrom` seul) était donc **structurellement
impossible**, sur tous les sites.

Corrigé **à la source**, dans
[`useDynamicFilterOptions.ts`](../src/modules/search/hooks/useDynamicFilterOptions.ts) : c'est ce
hook qui normalise la liste consommée par le rendu, et ses deux chemins de retour anticipé
(`!res`, `!values.length`) laissaient passer `options: undefined`. Le défaut se pose là, une fois —
`FiltersSection` en bénéficie aussi. 2 tests de régression ajoutés, **vérifiés en échec sans le
correctif**.

### 9vicies.3 Adresse et image dans le formulaire de parole

`address`/`geo` sont des champs **cœur** du POI : hors contrat costum (`typeObj`), donc **aucune
demande backend** — c'est ce qui distingue ce lot de §9septies. Idiome repris tel quel de
`parent62-event` et `parent62-article` :

| Apport | Déclaration |
|---|---|
| **Adresse** | nouvelle section `lieu` (icône `map-pin`) ; champ `address` en widget `location`, 5 membres plats cachés (`addressCountry`/`addressLocality`/`postalCode`/`streetAddress`/`localityId`) en `group:"address"`, `geo` + `geoPosition` en `writeOnly`, et `serializeGroups.address` (`address:read`/`address:write`) |
| **Image** | champ `profil_avatar` (widget `image`) ajouté à la section « La parole », + bloc `image: {field:"profil_avatar", existingUrlFrom:"image:profilUrl"}` |

Vérifié sur le descripteur compilé : le pipeline recompose bien
`address → {"@type":"PostalAddress", …}`, `geo → {"@type":"GeoCoordinates", …}` et
`geoPosition → {type:"Point", coordinates:[lng,lat]}` — soit exactement ce que lit
`searchMapSelection` pour poser un marqueur. La chaîne saisie → stockage → carte est bouclée.

Le champ image porte un `info` **RGPD** (« ne pas diffuser de photo identifiant une famille sans
son accord ») : la parole est un contenu sensible, et le formulaire portait déjà un consentement.

### 9vicies.4 `imageField` au contrat `testimonial` (apport moteur)

Le contrat n'avait aucune notion d'image. Ajouté par symétrie exacte avec `resource` :

- [`schema.ts`](../src/modules/search/schema.ts) — `imageField` optionnel ;
- [`useTestimonialData.ts`](../src/modules/search/hooks/useTestimonialData.ts) — `image`, avec la
  **cascade à trois niveaux** de `useResourceData` : `profilMediumImageUrl` → `profilImageUrl` →
  1re image de `medias` (une image déposée en galerie n'alimente pas `profil*ImageUrl`) ;
- [`CardTestimonialBubble.tsx`](../src/modules/search/components/card/testimonial/CardTestimonialBubble.tsx) —
  bannière `aspect-[16/9]` en tête ; le corps passe dans un wrapper `p-5` (le `p-5` quittant la `Card`)
  pour que la bannière soit pleine largeur ;
- [`PreviewTestimonialBubble.tsx`](../src/modules/search/components/preview/testimonial/PreviewTestimonialBubble.tsx) —
  bannière `aspect-[21/9] max-h-[30vh]` (même plafond que `PreviewResourceCard`, sans quoi la hauteur
  dérive de la largeur du dialogue et écrase la zone de contenu).

**Décision de design** : la pastille de catégorie reste **sous** l'image, pas en surimpression. Un
overlay de texte sur une photo arbitraire ne peut pas garantir son contraste — et sur la carte
`bubble`, la catégorie porte aussi la teinte de la bulle, donc elle doit rester sur la surface.
Sans image, card et preview gardent leur composition d'origine (aucune réserve d'espace vide).

`defaultFields` de `paroles-list` complété : `slug`, `profilImageUrl`, `profilMediumImageUrl`
(l'image) + `address`, `geo`, `geoPosition` (la carte). `/recherche` et la palette les projetaient
déjà.

### 9vicies.5 La carte de `/temoignages`, en vue split

`enableMap:true` + `map.layout:"split"` sur `paroles-list` (elle était à `false`), `showMap:false`
conservé — la page **démarre en liste**, le bouton bascule vers liste + carte côte à côte
(ratio `40-60` par défaut : liste 1 colonne à gauche, carte à droite, sélection synchronisée). Sur
mobile, le split ne s'applique pas (`!isMobile`) : c'est la carte plein écran. Bloc `map` calqué sur
`/recherche` (cluster, `marker.colorBy` par territoire, `itemAction:"preview"` → la modale de parole).

Aucun centre/zoom n'est imposé, comme sur `/recherche` : la carte cadre sur les données.

### 9vicies.6 Vérifications

| Gate | Résultat |
|---|---|
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 46 pages · **174 sections** (inchangé) |
| `audit:config` | ✅ `config.prod.parent62.json — RAS` |
| `typecheck` · `lint` | ✅ · ✅ 0 erreur (22 warnings préexistants, aucun sur les fichiers touchés) |
| `test:unit` — préflight | ✅ 562/562 (6 skipped) |
| `test:unit` — `src/` + `server/` (lancé en 4 lots, la suite complète saturant la mémoire du poste) | ✅ 473 (`search`) + 789 (`profil`/`formEngine`/`components`/`lib`) + 1176 (reste de `src/`) + 81 (`server/`) — **0 échec** |
| Rendu réel (dev-server, 4 paroles en base) | ✅ liste clair **et** sombre, split desktop (1 marqueur, la seule parole géolocalisée), modale avec bannière, mobile 360px et tablette 768px **sans débordement horizontal** |
| `test:e2e` | non rejoué — **pas de `.env.test` sur ce poste** (auth réelle indisponible) ; `e2e/parent62.spec.ts:148` n'assied rien sur les catégories ni le nombre de cartes |

Tests **ajoutés** : `useTestimonialData.test.tsx` (9 cas — le hook n'en avait aucun, alors qu'il est
le seul point où la config décide des champs affichés) et 2 cas de régression dans
`useDynamicFilterOptions.test.tsx`.

Resynchronisés : `__effective__/parent62.json` (6 lignes — les seuls `defaultFields`, aucun autre
site impacté) et 3 exemples de la skill `config-assistant` (`command-palette`, `list-item-rules`,
`list-testimonial`, via `config:example -- <feature> --write`).

Lot **non commité**.

---

## 9unvicies. Impacts — filtres à gauche sur `/temoignages`, retour à 6 types de ressources, 2 entrées de menu (09/09)

> Périmètre : **`config.prod.parent62.json` uniquement, zéro code.** Trois demandes du réseau, reçues
> après le lot §9vicies. Pages/sections **inchangées** (46 / 174) : `/temoignages` échange ses deux
> sections de rang 1 contre un `gridLayout` qui en contient deux.

### 9unvicies.1 `/temoignages` passe au gabarit « filtres à gauche »

La page portait ses 5 filtres en **dropdowns horizontaux** dans le `searchHeader`. Elle adopte le
gabarit déjà en place sur **`/recherche`** (lui-même celui de `/lieux` sur tiers-lieux) :

| | Avant | Après |
|---|---|---|
| Sections | `searchHeader` (5 dropdowns) · `searchProStatic` | `searchHeader` (titre seul) · `gridLayout` `paroles-grid` |
| Filtres | dropdowns en barre | panneau `filters` `paroles-filtres` à gauche (`leftColumns:1` / `rightColumns:3`, `className:"lg:sticky lg:top-20"`), groupes ouverts par défaut : `category`, `territoire` |
| Résultats | pleine largeur | `rightSection` = le `searchProStatic` `paroles-list` **inchangé** |

**La conversion `dropdownFilters` → `filterGroups` n'est pas un copier-coller** : la valeur stockée
change de clé, `value` → **`name`** (c'est `name` que le `filterGroup` envoie en
`{<field>: {$in: […]}}`). `territoire`, `public` et `themes` sont **repris de `/recherche`** plutôt
que convertis — mêmes options, mêmes pastilles de couleur de territoire, une seule source pour les
deux pages. `category` et `ages` sont convertis depuis les dropdowns (ils n'existent pas sur
`/recherche` — cf. checklist 1.5 pour `ages`).

**Un seul champ de recherche, celui du panneau.** Le `searchHeader` passe à `showSearch:false`
(comme `/recherche`) : son champ et celui de `FiltersSection` écrivent tous deux dans le **même**
`searchQuery` du contexte `PageFilters` — les garder tous les deux affichait deux entrées pour un
seul état. Contrepartie assumée : le placeholder devient le générique « Rechercher par nom… » du
moteur, alors que `searchBy` de la section porte `["name","description"]`. `FiltersSection` n'expose
aucune option pour masquer son propre champ ; corriger ce placeholder demanderait une prop de
moteur, hors périmètre de la demande.

`showActiveFiltersTags:true` déplacé sur `paroles-list` (les tags de filtres actifs se lisaient sur
le `searchHeader`, qui ne les porte plus).

**La carte tient dans la colonne réduite** — vérifié : le split (`40-60`) dans les 3/4 de largeur
restants donne une liste d'environ 340 px, soit la largeur d'une carte à 1 colonne. Pas d'ajustement
de `splitRatio` nécessaire. Sur mobile, le panneau se replie en bouton « Filtres » (comportement
natif de la section).

### 9unvicies.2 Retour à 6 types de ressources — §9octodecies annulé pour partie

Le réseau revient sur les deux types ajoutés le 03/09 et sur le renommage :

| Type | 03/09 (§9octodecies) | 09/09 |
|---|---|---|
| **Inforéso** | ajouté | **supprimé** |
| **Elles et ils ont marqué le réseau** | ajouté | **supprimé** |
| **Les jeux du réseau** | renommé (ex-« Jeu ») | **rétabli en « Jeu »** |

Touche l'énumération de `costumForms.parent62-recovery-center.fields.category`, l'option du filtre
« Type » de `/ressources` (id `les-jeux-du-reseau` → `jeu`) et **13 blocs `list.resource.badge`** —
et non 3 : §9octodecies en recensait 3, mais §9novodecies a depuis doté les **9 pages territoire**
d'une section ressources, chacune avec sa copie du badge. Toute évolution de cette taxonomie doit
désormais compter 13 emplacements.

`badge.icons` **disparaît entièrement** : il n'existait que pour les 3 types que le moteur ne sait
pas deviner, et « Jeu » est servi par le repli interne `RESOURCE_TYPE_ICON` (`jeu` → `gamepad-2`).
Du même coup, le trou d'audit de §9octodecies.2 (les noms d'icônes de `badge.icons` échappent au
contrôle `icone-inconnue`) ne concerne plus cette config.

**Le point d'attention de §9octodecies.3 se retourne, et il est désormais OBSERVÉ** : le renommage
portait sur la valeur **stockée**. Une fiche saisie entre le 03/09 et aujourd'hui garde
`category:"Inforéso"` ou `"Les jeux du réseau"` en base — vérifié sur le dev : la fiche « teste
ressources » affiche toujours son badge « Inforéso », rendu avec la couleur de repli de la palette
et l'icône générique `file`, et elle est **injoignable par le filtre**. À reprendre en base ; hors
périmètre ici (aucune écriture de données depuis cet environnement).

### 9unvicies.3 « Appels à projets » et « Offres d'emploi » entrent dans le menu « Contenus »

Les deux pages existaient (`/appels-a-projets`, `/offres-emploi`) mais n'étaient liées que depuis le
**footer**. Ajoutées au menu « Contenus » du header (icônes `megaphone` et `briefcase`), qui passe de
4 à 6 entrées et se rend sur 2 colonnes. Les liens du footer sont conservés. Contrairement à
`badge.icons`, un `icon` de nav **est** couvert par le contrôle `icone-inconnue` d'`audit:config`
(la clé finit par `icon`) — l'audit RAS vaut donc vérification des deux noms.

### 9unvicies.4 Vérifications

| Gate | Résultat |
|---|---|
| `npx tsx scripts/validate-config.ts config.prod.parent62.json` | ✅ 46 pages · **174 sections** (inchangé) |
| `audit:config` · `typecheck` | ✅ RAS · ✅ |
| `test:unit` — préflight | ✅ 562/562 (6 skipped) |
| Rendu réel (dev-server) | ✅ `/temoignages` filtres à gauche (catégories = les 5 valeurs réellement en base, aucune valeur par défaut), split desktop, mobile 360 px et tablette 768 px sans débordement · `/ressources` filtre « Type » à 6 valeurs dont « Jeu » · menu « Contenus » à 6 entrées |
| `test:e2e` | non rejoué — pas de `.env.test` sur ce poste |

Resynchronisés : 4 exemples de la skill `config-assistant` (`command-palette`, `list-item-rules`,
`list-resource`, `admin`). Le **sélecteur** de `list-testimonial` a dû être corrigé
(`pages[path=/temoignages].sections[id=paroles-list]` →
`…sections[id=paroles-grid].props.rightSection`) : la section est désormais imbriquée dans le
`gridLayout`, et le gate d'archétypes échouait sur un sélecteur introuvable — le signal a bien
fonctionné.

Lot **non commité**.

---

## 9duovicies. Impacts — page `/theme` : filtre visible, sous-titre, titre = le thème actif (09/09)

> Trois demandes. **Les deux premières étaient déjà appliquées dans l'arbre de travail à l'ouverture
> du lot** (retrait de `"hidden": true` sur le filtre `theme`, et `subhead` passé de « Explorez les
> ressources du réseau par thème, public ou territoire. » à « Les actions autour de ce thème ») —
> modifications non commitées, faites hors de la session qui écrit ce paragraphe. Elles sont
> constatées ici, pas revendiquées. Seule la troisième a demandé du travail.

### 9duovicies.1 Le filtre « Thèmes » redevient visible — ce que ça annule

`/theme` posait `hidden: true` sur son filtre `theme`, capacité ajoutée par §9decies précisément
pour cette page : « afficher un sélecteur redondant avec le contexte de la page n'a pas de sens ».
Le réseau demande l'inverse — pouvoir changer de thème sans repasser par le menu. Le dropdown
affiche alors la valeur active en guise de libellé (« La petite enfance » au lieu de « Thèmes »).

Deux effets de bord du retrait, tous deux voulus mais à connaître, car `hidden` les pilotait :
le thème compte désormais dans le **compteur de filtres actifs** et dans les **chips** de filtres
actifs, et « **Réinitialiser** » l'efface — alors qu'il définit l'identité de la page. Un
« Réinitialiser » ramène donc `/theme` sans thème, où le titre retombe sur « Nos thèmes ».
La capacité `hidden` reste dans le moteur, simplement plus employée par ce site.

### 9duovicies.2 Le titre affiche le thème actif — nouvelle capacité moteur

Le `headline` d'un `searchHeader` est un `LocalizedString` statique : aucun mécanisme n'existait pour
qu'un titre reflète l'état des filtres. Ajouté, **générique** :

| Fichier | Apport |
|---|---|
| [`schema.ts`](../src/modules/search/schema.ts) | `headlineFromFilter: z.string().optional()` — l'`id` d'un `dropdownFilters` |
| [`lib/headlineFromFilter.ts`](../src/modules/search/lib/headlineFromFilter.ts) **(nouveau)** | `optionsDuTitre(filtres, id, selection)` — pure, générique sur le type de filtre, **8 cas de test** |
| [`SearchHeaderSection.tsx`](../src/modules/search/sections/SearchHeaderSection.tsx) | calcule `headlineTexte` et le rend à la place de `t(props.headline)` |

Config : `"headlineFromFilter": "theme"` sur `theme-search`. Le `headline` « Nos thèmes » est
**conservé** — il devient le repli.

Trois décisions inscrites dans le helper, chacune couverte par un test :

- **ordre des OPTIONS, pas de la sélection** — sinon le titre d'une page changerait selon l'ordre des
  clics ou l'ordre des valeurs dans l'URL ;
- **id périmé ignoré** — un lien partagé après qu'une liste dynamique a bougé retombe sur le titre
  déclaré plutôt que d'afficher un id brut au `h1` ;
- **le filtre est cherché dans la liste COMPLÈTE, pas les visibles** — un filtre `hidden` doit pouvoir
  titrer sa page ; c'était même le cas d'usage d'origine, et ça garde la capacité utilisable si
  `hidden` revenait un jour sur cette page.

Vérifié dans le navigateur, les trois branches : `?theme=La petite enfance` → « La petite enfance » ·
`/theme` nu → « Nos thèmes » · deux thèmes → « La petite enfance · Les écrans – Le numérique ».

### 9duovicies.3 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` · `typecheck` · `lint` | ✅ 46 pages / 174 sections · RAS · ✅ · ✅ 0 erreur |
| `test:unit` — préflight · `search` | ✅ 562/562 · ✅ 481/481 (+8 : `headlineFromFilter`) |
| Portée | ✅ `headlineFromFilter` n'est employé par **aucune** autre `config.prod.*.json` |
| `test:e2e` | non rejoué — pas de `.env.test` sur ce poste |

`prop-descriptions` et [`doc/05-schemas-sections.md`](../doc/05-schemas-sections.md) complétés.

Lot **non commité**.

---

## 9tervicies. Impacts — deux publics de plus, et les pages Publics suivent leur filtre (09/09)

> Périmètre : **`config.prod.parent62.json` uniquement, zéro code** — la capacité nécessaire
> (`headlineFromFilter`) venait d'être ajoutée au moteur par §9duovicies, elle est ici simplement
> réemployée. **46 → 48 pages, 174 → 178 sections.**

### 9tervicies.1 « Petite enfance » et « Adolescence » : 31 emplacements, pas 2

Ajouter une valeur de taxonomie `publics` sur ce site ne se fait pas à un seul endroit. Inventaire
réel, à connaître pour toute évolution future de cette liste :

| Emplacement | Nombre | Forme de l'option |
|---|---|---|
| `dropdownFilters` (searchHeader) | **23** | `{id, value, label}` |
| `filterGroups` (panneaux `filters` de `/recherche` et `/temoignages`) | **2** | `{id, label, name}` — la valeur stockée est sous **`name`**, pas `value` |
| `enum` du champ `publics` des formulaires | **5** | `{value, label}` |
| `header.nav` → « Publics » | 1 | 7 → 9 `children` |

**Les 5 formulaires sont le point le plus facile à oublier** : sans eux, la valeur est filtrable mais
jamais saisissable — aucune fiche ne pourrait la porter, et les deux nouvelles pages resteraient
vides pour toujours.

Ordre alphabétique conservé partout : `Adolescence` en tête, `Petite enfance` entre
`Parents-enfants` et `Professionnels`. Icône de nav `toy-brick` pour Petite enfance (et non `baby`,
déjà pris par « Enfance ») et `backpack` pour Adolescence — les deux validées par le contrôle
`icone-unknown` d'`audit:config`, qui inspecte bien les clés `icon` de la nav.

### 9tervicies.2 Les 9 pages Publics adoptent le patron de `/theme`

Deux pages créées (`/public/petite-enfance`, `/public/adolescence`) sur le gabarit exact des sept
existantes — `searchHeader` + `articleFeed` scopé par `filters.publics.$in`.

Sur les **9**, le `searchHeader` reçoit le dropdown **« Publics »** (en tête : c'est l'axe de la page,
`Thèmes`/`Territoires` restent des affinages) et **`headlineFromFilter: "public"`**. Le `headline`
propre à chaque page est conservé : il devient le repli.

**Pourquoi ça reste cohérent dans les quatre cas** — c'est ce qui a décidé du choix :

| Sélection | Titre | Fil |
|---|---|---|
| rien (état initial) | `headline` de la page, ex. « Enfance » | `filters` dur de la page |
| un autre public | ce public | ce public (le contexte écrase le `filters` dur, cf. `mergeMongoFilters` : spread, `extra` gagne) |
| plusieurs | « A · B » | A et B |
| on décoche tout | retour au `headline` | retour au `filters` dur |

Le `filters` dur de l'`articleFeed` est **conservé** et non remplacé : il scope le fil tant que le
contexte de filtres n'a rien à dire (avant hydratation, ou après un décochage), ce qui évite un flash
de contenu tous-publics au chargement.

**Pas de `defaultChecked`**, et c'est délibéré : la prop est déclarée au schéma
(`schema.ts:65`) mais **`SearchHeaderSection` ne la lit jamais** — seul `FiltersSection` l'applique
(le seul `defaultChecked` du site, sur le groupe `typeInfo` de `/recherche`, est bien dans un
`filterGroups`). Elle est donc inerte sur un `dropdownFilters`, et l'implémenter toucherait
l'hydratation URL des 25 filtres du site et de tout le parc. Elle aurait de plus l'effet documenté en
§9duovicies.1 : compteur à 1 et « Réinitialiser » affichés en permanence sur les 9 pages.

> **Suite (§9quatervicies)** : le pré-cochage a finalement été demandé, et obtenu **sans** toucher à
> `defaultChecked` — par le query param dans les liens du menu. La parité `defaultChecked`
> searchHeader ⇄ filters reste une incohérence réelle du moteur, mais plus aucun besoin ne la porte.

### 9tervicies.3 Le sous-titre devenait un mensonge — rendu invariant

Effet induit repéré au rendu : le titre suivant le filtre, un `subhead` nommant le public de la page
(« Ressources et actions dédiées à **l'enfance**. ») contredisait le titre dès qu'on sélectionnait un
autre public. Les 9 pages passent donc à un sous-titre **invariant**, aligné mot pour mot sur celui
de `/theme` : « **Les actions autour de ce public** » (première rédaction « Ressources et actions
dédiées à ce public. », reformulée dans la foulée par le réseau, cf. §9quatervicies).

### 9tervicies.4 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ **48 pages · 178 sections** |
| `audit:config` · `typecheck` | ✅ RAS (dont les 2 nouveaux liens de nav, morts jusqu'à la création des pages) · ✅ |
| `test:unit` — préflight | ✅ 562/562 (6 skipped) |
| Intégrité | ✅ diff des pages **`46 → 48`, aucune page supprimée** — les 2 attendues, vérifié par comparaison des chemins avec `HEAD` |
| Rendu réel | ✅ `/public/adolescence` et `/public/petite-enfance` rendent (fil **vide** : aucune fiche ne porte encore ces valeurs) · sur `/public/enfance`, choisir « Parents » fait passer le titre de « Enfance » à « Parents » et le fil suit · mobile 360 px sans débordement |
| Portée | ✅ aucune autre `config.prod.*.json` modifiée |
| `test:e2e` | non rejoué — pas de `.env.test` sur ce poste |

**Les deux nouvelles pages resteront vides** tant qu'aucune fiche ne portera « Petite enfance » ou
« Adolescence » : les valeurs viennent d'être ouvertes à la saisie, elles n'existent pas en base. Le
rattachement des contenus existants à ces deux publics est un travail de données, hors périmètre ici.

Lot **non commité**.

---

## 9quatervicies. Impacts — le menu Publics porte son filtre dans l'URL (09/09)

> **Zéro code, 10 lignes de config** — et la réponse à « comment pré-activer le filtre public » n'était
> pas celle qu'on croyait.

### 9quatervicies.1 Le pré-cochage n'avait pas besoin de `defaultChecked`

§9tervicies.2 avait écarté le pré-cochage du dropdown faute de `defaultChecked` fonctionnel sur un
`searchHeader`, en le présentant comme un manque du moteur. **C'était passer à côté du mécanisme
déjà en place** : l'hydratation URL → filtre (`resolveFilterHydration`, §9decies), qui fait
exactement ce travail depuis le menu Thèmes.

Il suffit que le lien porte le filtre. Les 9 `children` du menu « Publics » passent donc de
`/public/<slug>` à **`/public/<slug>?public=<slug>`** — le nom du param est l'`id` du filtre
(`dropdownFilterToParam`), et les `id` d'options coïncident déjà avec les slugs de page.

Ce que ça donne, vérifié par un clic réel dans le menu :

| | Résultat |
|---|---|
| Clic « Adolescence » | URL `/public/adolescence?public=adolescence` · titre « Adolescence » · **bouton du filtre « Adolescence »** · chip actif |
| **2ᵉ clic** vers « Parents », page déjà montée | URL, titre et filtre suivent — le cas que §9decies avait dû corriger pour `/theme` fonctionne ici sans rien ajouter |
| Arrivée SANS query (lien direct, sitemap, SEO) | filtre non coché, mais titre (`headline`) et fil (`filters` dur) restent justes : dégradation propre |

Aucun `path` de page n'est touché (l'ancrage du remplacement est l'indentation des `children`, 12
espaces, contre 6 pour une page) et `audit:config` accepte les liens à query : **RAS**.

**La leçon** : avant d'ajouter une capacité au moteur, vérifier qu'un mécanisme générique existant ne
la couvre pas déjà par la config. Ici la bonne réponse était un query param, pas une prop.

### 9quatervicies.2 Sous-titre aligné sur `/theme`

Les 9 pages Publics : « Les actions autour de ce public » (en : « Initiatives related to this
audience »), strictement parallèle au « Les actions autour de ce thème » de `/theme`.

### 9quatervicies.3 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` · `typecheck` | ✅ 48 pages / 178 sections · ✅ RAS · ✅ |
| `test:unit` — préflight | ✅ 562/562 (6 skipped) |
| Parcours réel (clic depuis le menu, 1ᵉʳ et 2ᵉ) | ✅ cf. tableau ci-dessus |
| Portée | ✅ `config.prod.parent62.json` seule |

Lot **non commité**.

---

## 9quinvicies. Validation d'ensemble des cinq lots du 09/09 (avant commit)

Les tableaux de gates ci-dessus relèvent ce qui a été vérifié **à chaque étape**, avec des découpages
de suite de tests différents. Voici la mesure **unique et finale**, dépôt entier, après le dernier lot.

| Gate | Résultat |
|---|---|
| `typecheck` (`tsc -b --noEmit`) | ✅ 0 erreur |
| `lint` | ✅ **0 erreur**, 22 warnings — tous préexistants (`react-hooks/preserve-manual-memoization`), aucun sur un fichier de ces lots |
| `test:unit` — préflight | ✅ **562** (6 skipped) |
| `test:unit` — `search`+`profil`+`formEngine` | ✅ **1 003** |
| `test:unit` — reste de `src/` | ✅ **1 443** |
| `test:unit` — `server/` | ✅ **81** |
| **Total unitaires** | ✅ **3 089 · 0 échec** |
| `build:client` + `build:server` | ✅ les deux passent (lancés séparément : `npm run build` d'un seul tenant sature les 7 Go du poste) |
| `config:validate` | ✅ **48 pages · 178 sections** |
| `config:render` (SSR réel, backend réel) | ✅ **48/48 pages · 0 échec · 177/178 sections avec contenu SSR** — la 178ᵉ est le `featured-carousel` de l'accueil, **déjà** non rendu en SSR avant ces lots (cf. §9novodecies) |
| `audit:config` | ✅ RAS (`trad:0 liens:0 inerte:0 assets:0 strip:0 prereq:0 theme:complet`) |
| `map:functions` | ✅ aucun signalement sur les fichiers de ces lots. Les deux seuls pointés dans `useTestimonialData.ts` (`readString`, `firstToken`) **préexistent** — vérifié contre `HEAD`. L'unique chevauchement de couches (`imageUtils.ts`) est préexistant et sans rapport |
| Portée inter-sites | ✅ **une seule** `config.prod.*.json` modifiée (parent62) ; les 3 apports moteur sont génériques et inemployés ailleurs |
| Intégrité des pages | ✅ `46 → 48`, **aucune page supprimée** — comparaison des chemins avec `HEAD` |
| `test:e2e` | ⏭️ **non joué** — pas de `.env.test` sur ce poste, l'auth réelle est indisponible. **À rejouer avant fusion dans `main`** |
| `preflight/bundle-size` | ❌ **en échec — défaut PRÉEXISTANT, pas une régression de ces lots** (cf. encadré ci-dessous) |

### ⚠️ `bundle-size` : un gate en échec que ces lots n'ont pas causé

Ce test est `skipIf(!hasBuild())` : il ne s'exécute **que si `dist/client/assets/` existe**. Il était
donc silencieusement ignoré dans tous les relevés « préflight 562/567 » de ce document, y compris
ceux des lots antérieurs. Lancer `npm run build` dans ce lot l'a réveillé — et il échoue :

```
bundle principal index-*.js = 3.04MB dépasse 2MB
```

**Mesuré des deux côtés** (build du même `vite.config.ts`, une fois sur un worktree détaché sur
`HEAD`, une fois sur l'arbre de travail) :

| | bundle principal |
|---|---|
| `HEAD` (31c3e57c, avant les lots) | **3,01 Mo** |
| après les cinq lots | **3,04 Mo** |

Le seuil de 2 Mo était donc **déjà** dépassé de 50 %. Ces lots y ajoutent ~30 Ko (≈ 1 %), ce qui
correspond au volume de code réellement introduit. **Non corrigé ici** : ramener le bundle sous
2 Mo est un chantier de performance (code-splitting) sans rapport avec le périmètre demandé, et le
faire au passage contreviendrait à la règle « ne pas refactorer ce que la tâche n'exige pas ».

**Conséquence pratique** : tant que `dist/` est présent localement, `npm run test:preflight` sort en
échec sur ce seul test. `rm -rf dist` le remet au vert (il redevient ignoré). À traiter comme un
point de dette à part entière — soit par un travail de bundle, soit en actant le seuil réel.


> `doc/cartographie-fonctions/` a été **régénéré pour vérification puis restauré** : sa mise à jour
> (~39 000 lignes) est un artefact périmé sans rapport avec ces lots, elle n'a pas à noyer leur diff.

---

## 9sexvicies. Impacts — accueil resserré, actions admin sur les actualités, pages du réseau reprises à la source, Mois de la Parentalité (09-15/09)

> **Réconcilié avec `main` le 11/09** (sur `002e71ad`, la branche `parents62` étant
> alors à jour avec `main`). **Un seul conflit** : ce document — les deux lots ajoutaient une section
> d'impacts au même endroit. `config.prod.parent62.json` a fusionné sans heurt, les deux lots touchant
> des pages disjointes : `/reseau`, `/charte`, `/mois-parentalite` et l'accueil d'un côté,
> `/public/*`, `/temoignages` et `/theme` de l'autre. Ma section, d'abord numérotée §9quinvicies, est
> devenue **§9sexvicies** — `main` occupait déjà ce numéro avec la validation d'ensemble des cinq lots
> du 09/09. **Commité le 15/09** sur `parents62` : `5e1adc40`, 28 fichiers.

### 9sexvicies.1 Accueil — le contenu passe devant la marque

| Demande | Réalisation |
|---|---|
| Bandeau au quart de l'écran | `header.height` était **inerte** sur le variant `stacked` (lu par `HeaderStandard` seul) : il pilote désormais le plancher (`PLANCHER_BANDEAU`) **et** la taille de la marque (`MARQUE_BANDEAU`) — le plancher seul ne réduit rien, la hauteur valant `max(plancher, contenu)`. `sm` = 25 % ; mesuré 270px sur 1080 |
| « À la une » et « Territoires » côte à côte | nouveau `gridLayout` `home-une-territoires`, territoires à GAUCHE |
| Pas de vide blanc sous la colonne courte | `gridLayout.align: "stretch"` (prop **générique** ajoutée, défaut `start` = historique) : le bloc marine occupe l'espace au lieu de le laisser blanc |
| Tenir dans le premier écran, quel que soit le zoom | `gridLayout.from: "md"` (prop **générique**, défaut `lg`) : à 150 % de zoom le viewport CSS tombe à 960px et le bloc s'empilait — deux blocs empilés ne tiennent pas dans 600px. Résultat : **tient jusqu'à 150 %** ; 175 % reste hors de portée (180px de header incompressible sur 514px) |
| « À la une » en ligne, photo en haut | `FeaturedCarouselSlide` empilée, image remontée par `order` (l'ordre du DOM garde titre avant illustration, pour un lecteur d'écran) |
| Pastilles alignées | badge « Territoires » déplacé en haut à GAUCHE, accroche laissée à droite ; badge du carrousel sorti du centrage vertical (`flex-1` sur le carrousel seul) — écart mesuré **0px** |

**`MapBubbles` : tous les paliers passent en container queries.** Les breakpoints de viewport mentaient
dès qu'une carte étroite cohabitait avec un grand écran — le cas dans une colonne de `gridLayout`, et
plus encore à fort zoom. Un commentaire du fichier affirmait que les paliers bas « ne servent qu'au
vrai mobile, où les deux mesures coïncident » : c'était faux, il est corrigé.

⚠️ **Deux pastilles de territoire ont été déplacées** (`Boulonnais` x 6→11, `Entre Mer et Terres`
14→18) à la demande du réseau. Le commentaire du composant demande de **ne pas** retoucher ces
positions, calibrées à la main sur l'illustration : les deux ronds sont désormais très légèrement
décalés de leur zone géographique.

### 9sexvicies.2 Modifier / Supprimer une actualité depuis sa fiche

Boutons réservés à qui en a le droit, sur `/blog/:slug`. **Tout est réutilisé, rien n'est réécrit** :
`useProfilPermissions().canEditProfile` (admin du costum **ou** auteur — choix acté en séance),
`DynamicEditModal` (résout `edit-parent62-article`, déjà employée par `/admin`), `useDeleteEntity`
(porte le toast et l'invalidation du fil blog) et le `ConfirmDialog` partagé.

Seul manque comblé : `useArticle` chargeait l'instance SDK mais `toArticle` n'en gardait que
`serverData` — or `delete()` vit sur l'instance. Elle est désormais exposée à côté (ajout additif).
Après suppression, on **quitte la fiche** vers `/blog`.

Le composant vit dans le module blog : les **4 sites** déclarant une page `/blog`
(`maison-sport-sante-la-tampon`, `saint-paul-sport`, `sport-sante-bien-etre`, parent62) en héritent,
la permission gardant chacun. Chez les 3 autres, `resolveEditModalName` ne trouvera pas de route
d'article et **retombera sur la modale générique `edit-profile`** — fonctionnel, mais c'est à leur
config d'ajouter une entrée `editModals` si elles veulent le bon formulaire. **7 tests** couvrent la
garde, l'absence d'entité, l'entité sans `delete()`, la confirmation obligatoire et la navigation —
le cas admin n'étant **pas exerçable sans `.env.test`**, ils en sont la seule vérification.

### 9sexvicies.3 « Nos champs d'actions » — contenu officiel repris

La page paraphrasait parent62.org en prose. Le HTML brut de la page a été extrait (le résumé
automatique condensait) et restitué **mot pour mot** : les 5 valeurs du REAAP, la charte et les
5 objectifs du CLAS, les âges du LAEP, et **3 liens documentaires absents** (brochure CLAS,
vidéo mon-enfant.fr, Journée départementale d'Olhain). Deux écarts assumés : « créée » → « créé »
(accord fautif à la source) et les phrases du REAAP **réordonnées** sans en changer aucune, pour que
l'annonce de la liste précède les pastilles.

L'actu d'Olhain est tirée **dynamiquement** par son slug (`articleFeed`, `pageSize: 1`, `featured`) :
titre et visuel suivent la fiche. La couverture du guide CNAF est cliquable vers son PDF.

### 9sexvicies.4 Ce que ces pages ont révélé dans `ContentSection` — et la leçon

Quatre props **génériques**, toutes à défaut = comportement historique :

| Prop | Pourquoi |
|---|---|
| `description` en **markdown** (sanitizé) | rendue en `<p>` plat, elle écrasait gras et tirets du texte source. Vérifié sans risque : **aucune** description du parc ne contient de caractère markdown |
| `imageHref` | l'image n'était pas cliquable ; `NavLink` tranche interne/externe |
| `imageFit` | `cover` rogne — inadapté à une couverture de document ; `contain` la montre entière |
| `width` | `prose` (défaut) cale la colonne de lecture à GAUCHE et laisse la forme illustrée pleine largeur ; `wide` donne la même largeur aux deux et les centre |

> **La leçon du lot.** J'ai d'abord « corrigé » un désalignement en centrant les blocs dans le
> composant — ce qui a changé le rendu de **relief et tiers-lieux**, qui n'avaient rien demandé.
> Mesure faite sur la page d'accueil de tiers-lieux : bloc illustré `104 → 1336`, bloc de texte
> `104 → 688` — **les bords gauches coïncidaient déjà**. Le composant était cohérent ; c'est le
> centrage ajouté qui l'a cassé. Annulé. Deuxième tentative : des `className` à sélecteurs DOM
> (`[&>div>div]:max-w-6xl`) posés en config — sans toucher au composant, mais en **couplant la config
> au balisage interne**, qui casserait en silence au premier refactor. Remplacés par les props
> ci-dessus. **Une différence de rendu entre deux sites n'est pas forcément un défaut à corriger dans
> le composant partagé ; et une classe de config ne doit jamais dépendre du DOM d'un composant.**

### 9sexvicies.5 `/reseau` — « Du REAAP au Réseau Parentalité » repris à la source

Même principe que `/champs-actions` : le HTML de
[la page officielle](https://www.parent62.org/du-reaap-au-reseau-parentalite/) est extrait, puis
restitué. Ce que la version paraphrasée n'avait pas :

| Rétabli | Détail |
|---|---|
| L'équipe **nommée** | Sophie Halle (CAF 62), Clarisse Feutry et Antoine Legrand (Fédération des Centres Sociaux) — la page ne donnait que les chiffres 1/2/9 |
| Le lien avec l'**ADS Caf** | les 9 coordonnatrices sont employées par un centre social et travaillent avec l'Antenne de Développement Social de leur territoire |
| La définition **intégrale** du CNSP | la FAQ n'en gardait qu'un tiers |
| Les 3 familles de membres, en entier | l'**EPDEF** et le détail des services (Relais petite enfance, jeunesse, culture, famille, CCAS, PRE) manquaient |
| L'**objectif** du réseau | phrase officielle absente de la page |
| **2 PDF officiels** | [circulaire REAAP du 9 mars 1999](https://www.parent62.org/wp-content/uploads/2009/08/circulaire-reaap-9-mars-1999.pdf) (lien dans le texte fondateur) et la **plaquette de communication** (la couverture est cliquable) |
| 2 visuels | `plaquette-reseau-parentalite-62.jpg` et `inforeso-couverture.jpg`, récupérés depuis le site officiel dans `public/images/parent62/` |

**Deux écarts assumés au texte source**, du même ordre que le « créée → créé » de
`/champs-actions` : « a été **est** l'un des premiers » → « a été l'un des premiers », et
« employée chacune » → « employées chacune » (accords fautifs à la source).

**La frise chronologique a été retirée** (demande du réseau) : ses quatre jalons étaient des résumés
rédigés par nous, et celui de 2004 — la signature de la charte — ne figure pas sur cette page. Les
deux `content` qu'elle séparait se suivent désormais, ce qui reste sous le seuil que fixe la recette
`page-editoriale` : *trois* `content` d'affilée fatiguent, deux passent.

> **Un aller-retour éditorial à garder en mémoire.** Une version intermédiaire avait poussé la
> fidélité jusqu'à ne garder QUE le texte de la source : chapô, intertitres et libellés de cartes
> supprimés, 8 valeurs en texte intégral, bloc d'ouverture en `html` faute de titre dans la source.
> Le réseau a préféré revenir à la mise en page habillée, frise exceptée. **L'arbitrage retenu est
> donc : contenu fidèle à la source, habillage éditorial assumé** (chapô, intertitres, libellés de
> cartes, valeurs résumées renvoyant vers `/charte`). Ce qui reste vrai de la version abandonnée :
> `content` exige `title` ET `description`, et `markdown` n'accepte qu'une **string**
> (`md: z.string()`) — donc pas de couple fr/en, et la parité i18n est un gate bloquant. Pour un
> corps de texte sans titre, `html` est la seule porte de sortie.

**Les liens de contenu rédigé ne se lisaient pas comme des liens.** `src/index-parent62.css` codait
`.prose a { color: var(--primary) }` — or le `--primary` du site est un marine désaturé
(oklch .35 .04 250) tout proche du texte courant : souligné, le lien passait pour du gras. Il prend
désormais `--secondary-foreground`, le teal de la charte, qui tranche par la **teinte** et reste
conforme WCAG AA en corps de texte — **8,1:1** sur le fond clair, **12,3:1** en sombre. `--chart-1` et
`--info`, les deux autres candidats colorés, ont été **écartés après calcul** : ~3,4:1, sous le seuil
de 4,5:1. Soulignement porté à 2px et état de survol ajouté, pour ne pas faire reposer l'information
sur la seule couleur (WCAG 1.4.1). Un jeton du thème, pas une valeur en dur : le hook d'override reste
en place. Une surcharge par `theme.customCSS` avait été tentée d'abord — elle posait bien la variable,
mais cette règle la court-circuitait ; retirée, pour ne pas laisser deux mécanismes faire le même
travail. Portée : `index-parent62.css` ne sert qu'à ce site, et c'est aujourd'hui le **seul** lien de
prose du parc parent62 (vérifié à zéro sur `/mentions-legales`, `/charte`, `/champs-actions`).

Les **8 valeurs** gardent leurs libellés courts en `features-glass` et renvoient vers `/charte`, qui
porte la charte : les redonner en entier ici dupliquerait une section complète entre deux pages.
⚠️ **À noter** : sur `/charte` ces textes sont **tronqués** à leur première phrase, parfois coupée en
plein raisonnement, alors que la source les donne en entier — correction non faite, hors périmètre.

~~⚠️ **INFORESO renvoie vers `/ressources` en général**~~ — **caduc le 17/09** : la page dédiée `/inforeso`
existe, le bloc y pointe désormais (§9octovicies.1). _(Constat d'origine : le type de ressource « Inforéso »
avait été retiré du filtre le 02/09, §9octodecies, sans page dédiée vers laquelle pointer.)_

La définition de la parentalité a ensuite pris le moule de « L'objectif du Réseau Parentalité 62 »
— un `title` centré plutôt qu'un accordéon à une entrée, les deux énoncés de la page se répondant et
partageant la même colonne de **768 px**. L'entrée de FAQ « Qu'est-ce qu'un REAAP ? » et le `cta`
« Envie de rejoindre la dynamique ? », tous deux rédigés par nous, ont été retirés : la page se
termine sur le bloc INFORESO, qui porte déjà son lien.

Séquence finale :
`title → content → content → title → categories-grid → features-glass → title → content`
(recette `page-editoriale` resynchronisée). Vérifié au rendu (1440px, 390px et mode sombre) : markdown
correctement rendu (`<ul>`, `<strong>`, lien PDF inline), les 2 visuels chargent (`object-contain`,
aucun recadrage), **aucun débordement horizontal**. Les 3 chiffres 1/2/9 ont été retirés du bloc
équipe : ils redisaient mot pour mot les 3 puces situées juste au-dessus.

### 9sexvicies.6 `/charte` — les 8 vidéos, les signataires réels, et plus un seul accordéon

Revue par rapport à [la page officielle](https://www.parent62.org/le-reseau-parentalite/la-charte/).

| Manque | Rétabli |
|---|---|
| **Les 8 vidéos** | chaque valeur ouvre la sienne — le film « La charte départementale en images », réalisé par le comité local de l'Audomarois. 8 identifiants Dailymotion distincts, tous vérifiés à 200 |
| Les 8 valeurs **tronquées** | texte **intégral** de la charte, là où la page n'en gardait que la première phrase |
| Les signataires **condensés, sans lien** | les **16 entrées** officielles, dont 8 renvoient à l'article de blog correspondant et une au dossier photos Drive. Les 8 slugs ont été résolus un par un avant câblage, contrôle négatif compris |
| **Les 3 photos de cérémonie** | reprises avec leurs légendes. Celle de Noyelles-sous-Lens pesait **5,5 Mo en 4608×3456** : ramenée à 900 px / **115 Ko**, au gabarit des deux autres |
| Les **3 pièces du dossier** d'adhésion | texte officiel intégral, là où elles tenaient en une ligne chacune |

Le chiffre « 74 acteurs départementaux » pointe vers la **liste officielle des signataires** (PDF
d'octobre 2021). L'ordre de la page suit désormais la source : signataires et photos **avant** les
valeurs et les modalités d'adhésion.

**Les deux accordéons ont laissé place à des cartes** (demande du réseau) : les valeurs en
`cta-card-grid` — icône, nom, texte intégral, bouton « Voir la vidéo » — et les signataires en `cards`
(grille de 3). **1 846 px** contre ~3 500 en vue liste, essayée d'abord.

> **Deux ajouts au moteur, tous deux à défaut = comportement historique.**
> `cta-card-grid` imposait `md:grid-cols-2 lg:grid-cols-4` en dur : des paragraphes de charte sur
> quatre colonnes de ~220 px étaient illisibles. La section accepte désormais **`columns`**
> (`ResponsiveColumns`, comme `action-tiles`), via le helper partagé `buildGridColsClass` — mapping
> statique, une classe construite ne serait pas générée par le JIT. Second ajustement : le bouton se
> cale en **bas de carte** (`flex h-full flex-col` + `mt-auto`, et `gap-4` au lieu de `space-y-4` pour
> que la marge auto ne soit pas écrasée). **Vérifié sur les 3 autres sites** qui utilisent la section :
> aucun ne déclare `columns`, tous gardent leurs 4 colonnes, et `rezo-la-mer` a été contrôlé à l'écran.

> **`target="_blank"` est impossible depuis du HTML posé en config — structurellement.**
> `server/utils/normalizeSiteConfig.js` passe DOMPurify sur tous les champs de `HTML_FIELDS` **au
> chargement de la config**, `content` compris ; ce profil retire `target` en conservant `class` et
> `rel`. Le passage aux **cartes règle le problème** : `CardsSection` classe le lien (contrat 4 voies
> de `linkKind`) et ouvre un externe en nouvel onglet avec `rel="noopener noreferrer"` — vérifié sur
> le lien Drive ; les liens `/blog` y passent par `NavLink`, donc en navigation SPA. ⚠️ En revanche
> `cta-card-grid` rend un `Link` react-router sans cible : **les vidéos s'ouvrent dans le même
> onglet.**

> **« Plus de couleur » — et ce que la palette permet vraiment.** Le rythme des fonds passe par des
> **jetons du thème** : signataires `bg-secondary/30`, valeurs `bg: "secondary"`, bloc d'adresse en
> `color-mix` d'`--accent`. Pour les icônes, la première tentative teintait le **glyphe** ; mesure
> faite, sur le fond `secondary` de la section `accent`, `chart-2` et `chart-3` tombent à
> **1,6 / 2,3 / 2,2 : 1** — illisibles. La couleur est donc passée dans la **pastille**, le glyphe
> restant sur `primary` : quatre teintes distinctes ET le contraste. Deux fonctions pures partagées
> (`iconColorClass`, extraite de `FeaturesGlass` sans changer son comportement, et `iconHaloClass`),
> **8 tests**, dont un qui vérifie que l'état de survol `group-hover:` fait partie de la classe — il
> était en dur avant l'extraction et aurait disparu sans cela.
> ⚠️ Le schéma admet plus de teintes que la table n'en traite (`turquoise`, `cyan-bright`,
> `turquoise-light` retombent sur `primary`) : c'était déjà le cas, **2 cartes du parc** déclarent
> `turquoise` et rendent en primary depuis toujours. Le repli est conservé, et couvert par un test.

Le bloc d'adresse (« Votre dossier doit être adressé à la : ») a été retiré puis **remis** à la
demande du réseau, avec le titre et le texte de la source, la mention du **Livre d'Or du REAAP** et un
bouton `mailto:`. ⚠️ `CTASection` rend ses boutons en `<button>` avec un `onClick` : le clic ouvre
bien le client mail, mais ce n'est **pas un `<a href>`**. Comportement partagé par tout le parc.

⚠️ « la ville de Bully-les-Mines **le 15 mai 2019** » est cliquable sur parent62.org, mais aucun slug
d'article ne m'a été donné — l'entrée est là, sans lien, plutôt qu'avec un slug inventé.
⚠️ Le lien « dispositif REAAP » de la source (`nord-pas-de-calais.sante.gouv.fr`) **ne répond plus** —
vérifié. Le texte de l'étape le mentionne sans le lier.

Le paragraphe « Élaborée par des acteurs locaux… » n'a **aucun titre** dans la source, et « Le texte
fondateur » est déjà la catégorie de la section d'intro : il passe en `html`, pour la même raison que
`reseau-histoire`. La section d'intro est **centrée** (`content.align: "center"`, 3ᵉ prop ajoutée à
`content`) : sans visuel, `ContentSection` borne sa colonne à `max-w-3xl` **sans** `mx-auto`, elle se
collait donc à gauche sur une page par ailleurs centrée. Défaut `left` = comportement historique,
**aucune autre config du parc ne déclare `align`**, et `tiers-lieux` a été recontrôlé à l'écran.

### 9sexvicies.7 Le Mois de la Parentalité — un index de cartes, une page filtrée par l'URL

La page ne listait **aucun article**. Elle devient un **index**, et une seconde page porte le filtrage :

- **`/mois-parentalite`** — bandeau + 7 cartes, une par édition (2026 → 2020), en `cta-card-grid` :
  pastille teintée, titre, et un bouton « Voir les actualités ». La frise et le CTA qui suivaient ont
  été retirés **en dehors de ce lot** (config éditée le 15/09 à 11:43) ;
- **`/filter-mois-parentalite?tags=<tag>`** — bandeau dont le **titre EST l'édition active**
  (`headlineFromFilter`, ex. `#MoisdelaParentalité2025`), filtre **Édition**, filtre **Territoires**
  repris tel quel de `/blog`, recherche plein texte, puis le fil d'articles.

> **Le mécanisme existait déjà — zéro ligne de code.** Un groupe de filtres **sans `field`** range ses
> valeurs dans `selectedFilters` ; `useArticleFeed` les reverse dans `searchTags` et le backend les
> applique en `$all`. `computeFiltersFromUrl` mappe un query param sur le groupe de même `id`, en
> comparant la valeur d'URL à l'**`id` de chaque option** — d'où le point à ne pas manquer : **l'`id`
> d'option EST le tag en base**, la forme lisible vivant dans `label`. Et `headlineFromFilter` (livré
> avec `/theme`, §9duovicies) remplace le titre par le libellé de l'option active.
>
> Deux essais ont précédé : **6 pages** `/mois-parentalite/<année>` de structure identique, puis une
> page unique portant à la fois l'index et le filtre. La forme retenue sépare les deux rôles.

> **Les tags ont été RELEVÉS en base, pas déduits du nom affiché.** Filtrer sur « Le Mois de la
> Parentalité 2025 », le libellé de la page de référence, ne remonte **rien** : la valeur réelle est
> `MoisdelaParentalité2025`, sans espaces. 3 000 articles ont été balayés via `globalautocomplete` —
> l'endpoint que le fil interroge, requête recopiée depuis le réseau — pour énumérer les 186 tags du
> corpus, puis chaque candidat compté un par un.

| Édition | Tag réel en base | Articles |
|---|---|---|
| 2026 | `Moisdelaparentalité2026` (graphie **présumée**) | **0** |
| 2025 | `MoisdelaParentalité2025` | 73 |
| 2024 | `Moisdelaparentalite2024` | 50 |
| 2023 | `MoisdelaParentalité2023` | 89 |
| 2022 | `SemainedelaParentalité2022` | 80 |
| 2021 | `SemainedelaParentalité2021` | 135 |
| 2020 | `SemainedelaParentalité2020` | 77 |

⚠️ **La casse et les accents ne sont pas homogènes** : 2024 s'écrit `Moisdelaparentalite2024`, sans
accent ni majuscule interne. Une graphie normalisée aurait renvoyé une liste vide. Ces tags viennent
de l'import WordPress : toute correction se fait **en base**, et la config devra suivre.

⚠️ **2026 est exposée alors qu'elle n'a aucun article**, à la demande du réseau, avec la graphie
reprise de la demande — **rien ne la confirme**. Le jour où des articles seront tagués, la graphie
devra coïncider au caractère près. Vérifié : la page affiche « Aucun article pour le moment. », et non
les résultats non filtrés. Un `SemainedelaParentalité2018` existe aussi, avec **1 seul article** —
hors liste, non exposé.

Vérifié au navigateur : les 7 cartes pointent vers le bon tag encodé ; sur 2025 le fil renvoie
**12/12** articles portant le tag. À noter : la page filtrée émet **deux** requêtes au chargement —
une non filtrée au montage, puis la bonne une fois les params d'URL appliqués.

### 9sexvicies.8 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ **48 pages · 179 sections** — 5 configs du parc revalidées (`parent62`, `tiers-lieux`, `relief`, `rezo-la-mer`, `rezo-sante-reunion`) |
| `config:render` | ✅ 48/48 pages · **179/179 sections** avec contenu SSR |
| `audit:config` · `typecheck` · `lint` | ✅ RAS (0 trou de traduction, 0 lien mort, 0 asset manquant) · ✅ · ✅ 0 erreur |
| `test:unit` (périmètre du lot) | ✅ **1 557 tests, 0 échec** — 635 préflights + 403 composants/lib/hooks + 519 search/blog. Le seul échec du dépôt, `coform > ProseContent — césure`, **préexiste sur `main`** et n'est pas touché ici (cf. encadré) |
| Portée inter-sites | ✅ toutes les props ajoutées ont un défaut = comportement historique ; `rezo-la-mer` et `tiers-lieux` contrôlés à l'écran |
| `test:e2e` | ⏭️ non joué — pas de `.env.test` sur ce poste |
| `bundle-size` | ⏭️ **skippé faute de build** (`skipIf(!hasBuild())`), donc silencieux à chaque exécution. Joué à la main : **3,04 Mo** contre **3,01 Mo** sur `HEAD`, pour une limite de 2 Mo : **l'échec préexiste** |

⚠️ **La suite doit être lancée PAR LOTS.** `npm run test:unit` d'un seul bloc se fait tuer par l'OOM
killer sur ce poste (exit 137), tout comme `config:render` enchaîné derrière d'autres gates. Les
totaux ci-dessus sont la somme de cinq exécutions ciblées.

> **Un test rouge sur `main`, laissé tel quel.** `coform/FormFields.test.tsx > ProseContent — césure`
> échoue sur `main`, **indépendamment de ce lot** — rejoué sur un worktree propre à `002e71ad`, il
> tombe à l'identique, et aucun fichier `coform` n'est touché ici. Origine tracée pour qui voudra la
> reprendre : `eec107fe` (Schumann Juda, « coupe les mots insécables du texte riche ») posait
> `cn("wrap-anywhere", className)` sur `ProseContent`, alors dans `coform/FormFields.tsx` ;
> `2689e517` a extrait le composant vers `components/shared/` et **perdu la classe** au passage, tout
> en ajoutant au même endroit un test affirmant qu'aucun élément ne porte de `class` — les deux
> assertions sont désormais contradictoires, l'une exigeant la classe sur l'enveloppe, l'autre
> l'interdisant. **Résolu le 23/09** (§9septvicies.7) : la césure est remise **côté coform**
> (`PROSE_CESURE` sur les 5 appels de `ProseContent` dans `FormFields.tsx`), `ProseContent` reste
> nu, et le test vise désormais les composants coform.

> **Piège d'outillage — la config.** `config.prod.parent62.json` n'a **pas** un formatage machine
> reproductible : ni `json.dump` ni un imprimeur façon Prettier ne le régénèrent à l'identique, et le
> dépôt n'a pas Prettier. Une réécriture complète a produit **40 711 lignes de diff** pour une seule
> page modifiée. Remède : réutiliser le **texte brut** page par page puis section par section, et ne
> resérialiser que ce qui change.

> **Piège d'outillage — ce document.** Une substitution Python bornée par `index()` sur un libellé de
> ligne présent **plusieurs fois** (`| \`test:unit\` (suite complète) |`) a visé la mauvaise table et
> supprimé ~1 800 lignes, soit toutes les sections §9sexies à §9quinvicies. Reconstruit depuis
> `git show HEAD:` et la copie de travail sauvegardée, les deux sources intactes. **Leçon : sur un document de
> 2 800 lignes, ancrer une substitution sur une chaîne dont l'unicité a été VÉRIFIÉE** (`count() == 1`),
> jamais sur le premier `index()` venu.


**Page `/contact` supprimée** (demande du réseau) : `/equipe` portait déjà la même section `team`,
plus les 9 coordinations. Les 4 liens ont été repris — menu (doublon retiré), footer et bouton de
`/charte` vers `/equipe`, et le bouton de `/equipe` vers `mailto:contact@parent62.org`, seule donnée
que la page portait en propre.

Lot **non commité**.

---

## 9septvicies. Impacts — `/equipe` et les coordinations de territoire branchées sur les VRAIS membres (16/09)

**Ce que ça change.** `/equipe` et le bloc « coordonnateur·rice » des 9 pages de territoire ne
recopiaient plus la réalité : noms, photos et coordonnées étaient **écrits en dur dans la config**, à
remettre à jour à la main à chaque mouvement d'équipe. Les deux lisent désormais les **membres de
l'entité `parent62`**, filtrés par **rôle de lien** et, sur un territoire, par **territoire**.

### 9septvicies.1 Le rôle de lien devient une donnée d'affichage

Un rôle, ici, n'est ni un droit ni un statut de plateforme : c'est le **texte libre porté par le
LIEN** entre la personne et l'entité (`links.<famille>[id].roles`). Il dit la fonction dans CE
réseau. Trois rôles sont en service :

| Rôle | Où il s'affiche |
|---|---|
| `Coordonnateur(trice) départemental du réseau à la Fédération des Centres Sociaux Nord Pas-de-Calais` | `/equipe` — « L'animation départementale » |
| `Coordonnateur(trice)` | `/equipe` — « L'équipe de Coordonnateurs (trices) » · et chaque `/territoire/*` |
| `Conseillère thématique Parentalité CAF` | `/equipe` — « Le contact à la CAF » |

- `src/modules/profil/lib/memberRoles.ts` (+ 6 tests) — `rolesDuMembre()` lit le rôle depuis **deux
  sources** : le contexte de lien porté par le membre lui-même, sinon les `links` de l'entité
  parente. Couvre les trois familles (`members` / `contributors` / `attendees`).
- `MemberSectionSchema.props.roles: string[]` — la section se restreint aux membres portant l'un de
  ces rôles. Absent → tous les membres, comportement historique inchangé.
- Les rôles apparaissent aussi **dans le listing de gestion** (`UserListItem` a gagné un `extra`) et
  **au moment de l'invitation** (`InviteMemberDialog`, une ligne `TagsInput` par invité).

> ⚠️ **L'invitation SIMPLE (sans e-mail) ne peut pas porter de rôle.** Le contrat SDK `CONNECT`
> n'expose pas `roles`, et `link/removerole` n'existe pas. Seul le chemin par e-mail transmet les
> rôles aujourd'hui ; lever la limite demande une évolution du SDK, hors de ce dépôt.

### 9septvicies.2 Une carte « équipe », et pourquoi elle fait un GET par personne

`src/modules/profil/components/members/CardTeamMember.tsx` (`card.type: "team"`).

La projection de `getMembers` **ne ramène ni `territoires` ni l'adresse**, et son contrat n'accepte
pas de `fields` : rien ne permet de lui demander un champ de plus. La carte va donc chercher la
**fiche entière** de la personne par `entityBySlug` ; React Query dédoublonne et garde 5 minutes,
donc N cartes = N requêtes une seule fois.

- Image **entière** (`object-contain`) en **3/2**, plafonnée à 192 px : les portraits du réseau
  portent le logo parent62 **à gauche du visage**, un avatar rond le coupait.
- `shrink-0` sur le bandeau image — sans lui la carte, conteneur flex en colonne, **écrasait**
  l'image quand la grille imposait sa hauteur (mesuré : 121 px au lieu de 192).
  `overflow-hidden` est tout aussi obligatoire : un bloc `aspect-ratio` en `overflow: visible` garde
  une **hauteur minimale basée sur son contenu**, si bien que les cartes AVEC photo devenaient plus
  hautes que les cartes sans.
- Que des **jetons de thème** (`muted`, `primary`, `secondary`, `border`, `card`) : le mode sombre
  bascule seul, sans variante `dark:` à maintenir. Vérifié à l'écran dans les deux modes.
- Grille **plafonnée par le nombre de cartes** (`GRILLE_CARTES`) et `mx-auto` : 1 carte (contact CAF)
  ou 2 (animation départementale) se centrent au lieu de se tasser à gauche d'une grille à 4 colonnes.

### 9septvicies.3 La coordination de chaque territoire

Les trois blocs de tête de la page — l'agenda du comité, la coordination, les comptes rendus — ne
s'empilent plus : ils tiennent dans **une seule section**, une rangée à 3 colonnes.

```json
{ "type": "gridLayout", "id": "audomarois-comite-rangee",
  "props": { "columns": 3, "align": "stretch", "gap": 6,
             "sections": [ { "type": "agenda", … },
                           { "type": "member", "id": "audomarois-coordination",
                             "props": { "title": { "fr": "La coordination du territoire", … },
                                        "roles": ["Coordonnateur(trice)"], "territoire": "Audomarois",
                                        "footerText": { "fr": "audomarois@parent62.org\n07 88 15 57 38 …", … },
                                        "hideWhenEmpty": true, "showCard": false, "showTabs": false,
                                        "showInvite": false, "card": { "type": "team" } } },
                           { "type": "cards", … } ] } }
```

- `src/modules/profil/lib/teamDirectory.ts` (+ 6 tests) — `cheminTerritoire()` relie un libellé de
  profil à sa page (`Audomarois` → `/territoire/audomarois`, vérifié sur les 9 vraies pages) et
  `memeTerritoire()` apparie deux écritures d'un même territoire **par slug** : casse, accents et
  ponctuation ne désignent pas autre chose. Deux valeurs vides ne s'apparient JAMAIS — sinon un
  profil sans territoire tomberait dans les 9 pages.
- `src/modules/profil/hooks/useMembresDuTerritoire.tsx` — le filtre territoire est **forcément côté
  client** : `getMembers` reconstruit ses propres `filters` et **écrase ceux de l'appelant**, et sa
  projection ne porte de toute façon pas `territoires`. Le hook réutilise **à l'identique** la clé et
  la fonction de requête de `useEntityBySlugQuery`, donc il partage le cache des cartes : aucune
  requête en double.
- **« Le contact du comité local, c'est la coordination du territoire »** — les deux blocs n'en font
  plus qu'un. La carte de contact disparaît ; son texte (courriel du territoire, téléphones, lieu)
  descend en `footerText` **sous** la carte du coordonnateur, dans la même colonne. Le nom, la photo
  et le rôle ne sont plus écrits qu'une fois, et viennent du membre.
- `hideWhenEmpty` — sur une page publique, « Aucun membre » ressemble à une panne. Sans
  coordonnateur rattaché, **la liste s'efface** ; le titre et le pied de contact restent, sans quoi
  l'information de contact des 7 territoires sans membre serait perdue. La section entière ne
  disparaît que s'il n'y a PAS de `footerText`.
- Le bouton « Les actualités du territoire » se masque quand il pointe sur la page courante — sur
  une page de territoire, il renverrait sur elle-même.

**Le gabarit territoire passe de 9 à 8 sections de premier niveau** (3 fusionnées en 1) —
`page-recipes.json` (recettes `page-annuaire-grille` et `page-territoire`) mis à jour en conséquence.

### 9septvicies.3bis `gridLayout` apprend la RANGÉE — apport moteur

`gridLayout` ne savait faire qu'un couple asymétrique gauche/droite, réglé en quarts : trois
colonnes égales ne se découpent pas en quarts. Deux props **additives** :

| Prop | Effet |
|---|---|
| `sections: Section[]` | N sections de MÊME largeur sur une ligne. Prime sur `leftSection`/`rightSection` |
| `columns: 2 \| 3 \| 4` | Colonnes de la rangée (défaut : le nombre de `sections`, plafonné à 4) |

Absent `sections`, le composant emprunte **exactement** l'ancien chemin de rendu — les 19 usages de
`gridLayout` des 7 autres configs du parc sont inchangés (toutes revalidées).

⚠️ Un container se déclare **en deux endroits** : `SECTION_EXTRACTORS` de
`src/lib/sectionContainers.ts` (prefetch SSR + gardes) ET sa copie dans
`src/modules/search/prefetch/prefetchFilters.ts`. Les deux portent désormais `p.sections` ; sans ça
une section imbriquée serait ratée **silencieusement** — ni préchargée, ni vue par les préflights.

### 9septvicies.3ter La carte prend la couleur de SON territoire

La carte reprend la maquette fournie : photo posée sur une plaque claire en retrait, territoire en
petites capitales, nom, rôle, adresse, bouton pleine largeur — et **le fond aux couleurs du
territoire**.

Les 9 teintes `--territoire-*` sont des couleurs de MARQUE, faites pour des pastilles et des
bandeaux, pas pour porter du texte : **5 sur 9 échouent au contraste AA quelle que soit l'encre**
(blanc sur Boulonnais 4,80, sur FSM Lens-Liévin 4,06 ; marine sur Calaisis 4,36, Entre Mer et
Terres 4,44, Ternois-Bruaysis 4,44 — le seuil est 4,5). `src/index-parent62.css` expose donc un
second jeu, `--territoire-<slug>-carte` / `--territoire-<slug>-encre` : **la même teinte ramenée au
contraste**, assombrie vers le noir ou éclaircie vers le blanc, jamais décalée en teinte.

| Territoire | Fond | Encre | Contraste |
|---|---|---|---|
| Arrageois | `#66579e` | blanc | 6,14:1 |
| Artois | `#b7cb6b` *(inchangé)* | marine | 7,87:1 |
| Audomarois | `#e5af32` *(inchangé)* | marine | 7,03:1 |
| Boulonnais | `#a63f38` | blanc | 6,20:1 |
| Calaisis | `#ef955c` | marine | 6,10:1 |
| Entre Mer et Terres | `#4ebac3` | marine | 6,11:1 |
| FSM Hénin-Carvin | `#904a70` | blanc | 6,18:1 |
| FSM Lens-Liévin | `#745c52` | blanc | 6,19:1 |
| Ternois-Bruaysis | `#d79aaf` | marine | 6,11:1 |

Le plancher à 6,1:1 n'est pas gratuit : il laisse le texte secondaire (rôle, adresse) à 85 %
d'opacité **au-dessus de 4,6:1**. Le bouton est INVERSÉ — l'encre devient le fond, le fond devient
le texte — donc il réutilise le même couple validé, sans troisième couleur à vérifier.

`couleursTerritoire()` (`teamDirectory.ts`, + 2 tests) dérive les deux variables du slug de page.
Repli sur `--card` / `--card-foreground` quand le profil n'a pas de territoire : une carte NEUTRE et
lisible, pas une carte transparente. Ces couples sont **identiques en clair et en sombre**, et c'est
voulu — un fond de marque qui basculerait avec le thème ne serait plus la couleur du territoire.
Tout le reste de la carte se peint en `currentColor`, donc aucune variante `dark:` à maintenir.

### 9septvicies.3quater La carte porte les coordonnées, celles de la personne ET celles du comité

Deuxième passe de design, sur retour de maquette :

- **Plaque de la photo** — même fond que la carte, détachée par un filet de 2 px et un rayon de
  13 px, au lieu de la plaque claire de la première passe. Le filet est le jeton `--border`, pas un
  blanc fixe : il suit clair/sombre, là où le blanc restait blanc sur fond nuit.
- **Contacts de la PERSONNE** — courriel (cliquable, `mailto:`), téléphone et adresse, lus sur sa
  fiche. `contactProfil.ts` (+ 10 tests) normalise le champ `telephone`, qui **n'a pas une forme
  unique en base** : chaîne pour la plupart des fiches, objet `{ mobile: [], fixe: [] }` pour
  certaines organisations, `mobile` plat à la racine sur les fiches anciennes. Rendre la valeur
  brute ferait planter React — un objet ne peut pas être un enfant.
- **Deux textes, deux rôles** — la section `member` porte désormais `cardText` ET `footerText`, et
  ils ne disent pas la même chose :

  | Prop | Contenu | Quand |
  |---|---|---|
  | `cardText` | le **lieu de permanence** seul | dans chaque carte, sous les contacts de la personne |
  | `footerText` | courriel + téléphones + lieu | sous le titre, **uniquement si aucune carte n'est rendue** |

  La carte donne déjà le courriel et le téléphone **de la personne**, lus sur sa fiche : y répéter
  ceux du comité était redondant. Il n'y reste à dire que ce que la fiche ignore — l'adresse de la
  permanence. Quand personne n'est rattaché au territoire, `footerText` reprend la main avec le
  contact complet : c'est alors le seul moyen de joindre le comité.

  ⚠️ **Ternois-Bruaysis n'a pas de `cardText`** : sa fiche source ne publie que le courriel et un
  téléphone, aucun lieu. Ce n'est pas un oubli de config — la donnée n'existe pas.

- **Dédoublonnage** — `lignesContactEquipe()` retire du bloc d'équipe les lignes que la fiche
  affiche déjà. Le cas s'était produit avant la séparation ci-dessus : la fiche de Ludivine Dupire
  Fait porte `audomarois@parent62.org`, que le bloc comité redonnait mot pour mot — la même adresse
  deux fois dans une carte de 320 px. Le garde reste en place pour toute config qui remettrait un
  contact déjà porté par la fiche. La comparaison ignore casse, espaces et ponctuation
  (« 07 88 15 57 38 » = « 0788155738 ») mais reste stricte sur le reste : deux libellés d'adresse
  proches mais distincts portent chacun leur information, et on ne devine pas laquelle garder.
- **Bordure des cartes NEUTRES** — `couleursTerritoire()` rend une 3ᵉ valeur, `bordure`, sur la même
  chaîne de repli que le fond : `var(--territoire-<slug>-carte, var(--border))`. Sur un territoire
  connu elle vaut la couleur de la carte, donc elle ne se voit pas ; sinon elle retombe sur le jeton
  de thème `--border`. C'est ce qui détache les cartes sans territoire — l'animation départementale
  et le contact CAF — du fond de la page, **dans les deux modes** ; sans elle, une carte neutre se
  dissout dans le fond sombre.
- **Espacement** — la section `member` accepte `className` ; `equipe-caf` porte `pb-16`, le bloc CAF
  touchait le pied de page.

> ⚠️ **Trois lectures INLINE du même champ `telephone`** existaient déjà (`CardContact`,
> `PreviewStructure`, `coformAnswer`), chacune avec son propre repli et sa propre notion de
> « téléphone principal ». `contactProfil.ts` est la première version **exportée et testée** ; les
> trois autres ne sont **pas** reprises — hors périmètre de la carte d'équipe. À fusionner dans un
> lot dédié, sans quoi la 4ᵉ copie naîtra toute seule.

### 9septvicies.3quinquies Deux dispositions pour une même carte

La carte vitrine de `/equipe` — grand portrait 4/3 au-dessus du texte — ne convenait pas à la
colonne du milieu d'une page de territoire : elle y faisait une colonne **deux fois plus haute** que
ses voisines, et la rangée de trois perdait tout équilibre. `card.layout` tranche :

| Valeur | Rendu | Où |
|---|---|---|
| `stack` *(défaut, historique)* | portrait 4/3 pleine largeur, texte dessous | `/equipe` |
| `row` | vignette **ronde** de 80 px à gauche de l'identité (territoire, nom, rôles), contacts dessous | les 9 pages `/territoire/*` |

Le cadrage suit la forme, et c'est un arbitrage, pas un détail : `stack` garde `object-contain`
parce que les portraits du réseau portent le logo parent62 **à gauche du visage**, qu'un `cover`
rognerait. En `row` c'est l'inverse — `contain` mettrait le portrait en boîte aux lettres à
l'intérieur du cercle, donc `cover`, au prix du logo. **La vignette ronde coupe le logo** : c'est le
prix de la forme demandée, pas un défaut de cadrage.

Mesuré après coup, les trois colonnes d'une page de territoire font désormais **la même hauteur**
(464 px à 1440, 570 à 1024), contre une colonne du milieu deux fois plus haute avant.

Reste un décalage que la grille ne corrige pas : les trois sections n'ont pas le même retrait haut
(l'`agenda` place son titre à 32 px, le `cards` du Drive porte un `py-16`, le `member` ne portait
rien et collait au bord). La section `member` des 9 territoires prend donc `className: "pt-8"` —
les deux titres de colonne s'alignent alors **au pixel** (32 px), et les deux cartes à 20 px près.
C'est de l'ajustement de config, pas de moteur : chaque type de section garde son rythme vertical.

### 9septvicies.3sexies Passe de revue — ce que le lot devait encore à `bonnes-pratiques-code.md`

Relecture du lot contre le guide de revue. Six points corrigés, tous **sans changement de
comportement** (portes rejouées après chaque).

| Règle | Ce qui n'allait pas | Correction |
|---|---|---|
| §1 Lazy-loading | `CardTeamMember` était en import statique alors que `card.type` ne rend **qu'une** variante à la fois : tout le parc embarquait la carte d'un seul site | `lazy()` de **`vite-preload`** (pas `React.lazy` : on garde le tracking SSR et l'injection de `<link modulepreload>`), constante de module, `Suspense` avec un repli à la hauteur de la carte |
| §11 Déduplication | `SECTION_EXTRACTORS` existait **en double** — `sectionContainers.ts` et `prefetchFilters.ts` — avec la consigne écrite de reporter tout ajout des deux côtés | `enfantsDeSection()` exporté, le prefetch l'importe. Un container ajouté est vu des deux parcours, par construction |
| §11 Déduplication | `GridLayoutSection` s'était fabriqué sa propre table de classes de colonnes | réutilise `buildGridColsClass`, déjà partagé par `stats`, `action-tiles` et `cta` |
| §11 + §13 | La `queryFn` de lecture de fiche était **recopiée** dans `useMembresDuTerritoire` : deux clés identiques par coïncidence, pas par contrat | `optionsFicheParSlug()` extraite ; le hook de fiche ET la lecture en lot la consomment. Recopier ces lignes créerait une 2ᵉ entrée de cache, donc une requête de plus par membre |
| §12 Logique hors composants | `CardTeamMember` calculait la fusion liste/fiche, la chaîne de replis d'avatar, les initiales et la ligne d'adresse dans son corps | `vueMembre()`, `initiales()`, `ligneAdresse()` — trois helpers purs, **17 tests** ; le composant ne porte plus que du JSX et des appels de hooks |
| §15 Génériques | Le module `profil`, générique, codait en dur `/territoire/` et `--territoire-*` : du métier parent62 dans le moteur | `ConventionRattachement`, preset surchargeable depuis la config (`card.rattachement`). Un site qui regroupe par région ou par filière branche ses gabarits sans toucher au code |

**Non fusionné, à dessein** (§11 dit de documenter le non-merge) :
- L'assemblage `[streetAddress, postalCode, addressLocality]` est recopié dans une dizaine de
  composants du parc, avec des séparateurs différents — espace ici, virgule là — et parfois un champ
  de plus. Changer le séparateur d'une carte modifierait le rendu de sites qui n'ont rien demandé.
  `ligneAdresse(valeur, separateur)` prend le séparateur en paramètre : la migration se fera sans
  nouvelle divergence, dans un lot qui l'assume.
- Même raisonnement pour l'initiale d'avatar (`AmpliUserCard`, `UserListItem`,
  `ProfileHeaderComplete` en affichent **une**, la carte d'équipe **deux**) : `initiales(nom, max)`
  reproduit les deux sorties, personne n'est migré d'office.
- Les trois lectures inline du champ `telephone` restent en place : chacune a son propre repli et sa
  propre notion de « téléphone principal ».

**Tests ajoutés par la passe** : `sectionContainers` (11 — le registre n'en avait AUCUN alors qu'il
commande le prefetch SSR et les gardes), `initiales` (5), `ficheMembre` (6), `ligneAdresse` (5),
convention de rattachement surchargeable (3).

### 9septvicies.4 Données encore manquantes côté réseau

À ce jour l'entité `parent62` porte **10 membres liés**, dont **5** avec un rôle de coordination.
Conséquence directe à l'écran, mesurée page par page :

| Territoire | Coordination affichée |
|---|---|
| Audomarois | ✅ Ludivine Dupire Fait |
| Artois | ✅ Margaux Daron |
| Arrageois, Boulonnais, Calaisis, Entre Mer et Terres, FSM Hénin-Carvin, FSM Lens-Liévin, Ternois-Bruaysis | ⬜ section masquée — aucun membre avec ce `territoires` |

Bénédicte Porcaro porte bien le rôle `Coordonnateur(trice)` mais **aucun territoire** : elle apparaît
sur `/equipe`, sur aucune page de territoire. **Ce n'est pas un défaut de code** : il manque
l'invitation des 6 autres coordinations et le champ `territoires` sur les fiches existantes.

### 9septvicies.5 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ **48 pages · 170 sections** de premier niveau · les 6 autres configs à `gridLayout` revalidées |
| `config:render` | ✅ 48/48 pages · **170/170 sections** avec du contenu SSR |
| `test:preflight` | ✅ **634 tests** — recettes de page resynchronisées. 1 échec, `site-assets`, **étranger au lot** (cf. encadré) |
| `test:unit` | ✅ **4 411 tests**, 2 échecs étrangers au lot : `ProseContent — césure` (**préexistant sur `main`**, cf. §9sexvicies.8) et `site-assets` |
| `test:integration` | ✅ **728 tests**, 2 échecs étrangers : les specs génériques comparent `config.prod.json` alors que `.env` fait booter le serveur sur **parent62** (cf. encadré) |
| `test:e2e` | ✅ **23 passés** dont les **9 de `parent62.spec.ts`** (`/territoire/arrageois`, mode sombre, deep-link territoire). 7 échecs étrangers, même cause : `e2e/helpers/config.ts` retombe sur `config.prod.json`, et `auth-flow` réclame un `.env.test` absent de ce poste |
| `typecheck` · `lint` | ✅ · ✅ **0 erreur** (25 avertissements `react-hooks` préexistants) |
| `audit:config` | ✅ parent62 — RAS : 0 trou de traduction, 0 lien mort, 0 asset manquant, 0 réglage inerte |
| Contraste | ✅ les 9 couples fond/encre relevés **dans le navigateur** : ≥ 6,10:1 en clair ET en sombre |
| Écran | ✅ `/equipe` et `/territoire/*` dans les deux modes ; rangée 1 → 2 → 3 colonnes à 375 / 768 / 1024 px, aucun débordement horizontal |
| Portée inter-sites | ✅ toutes les props ajoutées (`roles`, `territoire`, `hideWhenEmpty`, `footerText`, `showTabs`, `showTitle`, `showInvite`, `card.type: "team"`, `gridLayout.sections`/`columns`) sont optionnelles ; sans `sections`, `gridLayout` emprunte le chemin de rendu d'avant, inchangé |

> **Les specs génériques tournent contre la MAUVAISE config sur ce poste.** Le serveur de test
> hérite de `process.env`, donc du `VITE_SLUG=parent62` du `.env` ; mais `e2e/helpers/config.ts` et
> les tests d'intégration retombent, eux, sur `./config.prod.json` — la config SiteForge par défaut.
> Ils comparent donc le `<title>`, les libellés de nav et le copyright du pied de page **d'un site à
> ceux d'un autre**. Aucun de ces champs n'est touché par le lot (vérifié : 0 ligne de `meta` ou de
> copyright dans le diff), et les 9 specs `parent62.spec.ts` passent. Réparation propre pour qui
> voudra : exporter `SITE_CONFIG_PATH=./config.prod.parent62.json` avant de lancer ces deux tiers.

> **Un préflight rouge qui n'appartient pas à ce lot.** `site-assets > tout dossier de
> public/images/ est déclaré par au moins un slug` signale `public/images/EcosystemeSanteReunion`.
> Ce dossier est **vide**, donc invisible de Git, et il est apparu sur le disque le 16/09 à 08:30 —
> hors de ce lot, qui ne touche ni `sites.json` ni `public/`. Non supprimé : effacer un dossier
> qu'on n'a pas créé n'est pas une réparation. À trancher par qui l'a posé — le déclarer, le
> supprimer, ou l'inscrire dans `KNOWN_UNCLAIMED`.

Lot **non commité**.

---

### 9septvicies.6 La coordination d'un territoire, en une requête serveur (22/09)

**Ce qui n'allait pas.** « Le coordonnateur d'Arrageois » est une *recherche*, et le lot précédent
l'avait écrite comme un *filtre sur une page de résultats* : `useMembresDuTerritoire` lisait la fiche
complète de chaque membre chargé (N requêtes `entityBySlug` pour tester une chaîne), puis filtrait
la page courante de `getMembers`. Deux défauts, dont un invisible en prod par chance d'effectif :
la sentinelle de pagination n'était montée que si la page contenait déjà une carte — donc jamais
dans le seul cas où elle servait — et avec `hideWhenEmpty` la section s'effaçait avant même
d'essayer. Une fiche en échec (500 passager, membre sans slug) sortait silencieusement du filtre.
Et tout cela vivait dans `EntityMembers`, composant global (onglet profil, admin, 14 sections du
parc), pour un champ (`territoires`) qui n'existe que chez parent62.

**Pourquoi le serveur ne savait pas le faire.** `getMembers` (SDK) *écrasait* `data.filters` par son
filtre de lien — alors que `getMemberOf`, quarante lignes plus bas, fusionnait déjà les filtres
appelant — et le schéma AJV de requête de `GET_MEMBERS_*` refusait toute clé étrangère
(`additionalProperties: false`) **avant même d'émettre la requête**. Le backend, lui, est le même
endpoint que `searchCostum` (`/co2/search/globalautocomplete`) et honore les filtres arbitraires ;
le legacy PHP (`SearchNew::globalAutoComplete`) ajoute `fields` à la liste par défaut
(`array_merge`), `checkFields` ne retirant que `preferences`. Lu dans le PHP, puis mesuré sur le
legacy : même document, `links`/`name`/`slug` conservés avec `fields`, `email` n'arrivant *que*
projeté.

**Ce qui change.**

| Où | Quoi |
|---|---|
| SDK `1.0.194` (non publié) | `getMembers`, `getContributors`, `getAttendees` : `finalData.filters = { ...callerFilters, ...filtreDeLien }` (le lien reste prioritaire). `endpoints-copie.json` : `filters.additionalProperties: true` et `fields: string[]` sur les 6 endpoints `GET_MEMBERS_*`/`GET_CONTRIBUTORS_*`/`GET_ATTENDEES_*` ; gardes `allOf`/`patternProperties` du lien intactes. **Chemin admin** (`isMe` → `searchAdmin`) : `fields` est **retiré** avant l'appel — le PHP en fait là une projection EXACTE (`$fields = $_POST["fields"] ?: []`, sans liste par défaut), les documents revenaient sans `collection` et le SDK les ignorait ; sans `fields`, ce chemin renvoie les documents complets. 10 tests d'intégration (filtre appliqué · lien prioritaire · `fields` additif · documents complets sur le chemin admin) |
| `member` (schéma, section, `EntityMembers`) | `territoire: string` → **`filters: object`** + **`fields: string[]`**, génériques, transmis tels quels par `useInfiniteEntityQuery` → `useEntityMembers`. Le vocabulaire parent62 ne vit plus que dans la config |
| `CardTeamMember` | lit la liste projetée ; plus d'`useEntityBySlugQuery` par carte. `rattachement` **requis** |
| `teamDirectory` | `CONVENTION_RATTACHEMENT_DEFAUT` supprimée, `exigerConvention` ajoutée, `memeTerritoire` supprimée, plage de diacritiques en `\u0300-\u036f` (des combinants bruts, qu'un éditeur normalise en NFC) |
| `ficheMembre` | `vueMembre(liste)` — une source |
| Supprimé | `hooks/useMembresDuTerritoire.tsx`, `refSentinelle` et la sentinelle, la plomberie `enCours` |
| Gate | `tests/preflight/member-team-card.test.ts` : `card.rattachement` complet sur toute carte « équipe », plus aucun `territoire` |
| Config | 12 sections : `"filters": { "territoires": "<libellé>" }`, `"fields": ["territoires","telephone","phone","mobile","email"]`, `card.rattachement: { "/territoire/{slug}", "--territoire" }` |

**Deux corrections de revue embarquées.** La grille plafonnée (`GRILLE_CARTES`) ne s'applique plus
qu'à la carte « équipe » — les deux sections `card.type: "profile"` du parc (cyber-reunion,
sport-sante-bien-etre) retrouvent leur grille pleine largeur. Et `footerText` s'affiche dès
qu'**aucune carte n'est rendue**, `hideWhenEmpty` ou non (avant : `!masquerListe`, qui le
supprimait précisément quand la liste était vide sans `hideWhenEmpty`).

**Un changement de sémantique à connaître.** Le filtre serveur est une égalité Mongo : la valeur
de `filters.territoires` doit être **exactement** celle stockée sur les profils, là où
`memeTerritoire` tolérait casse, accents et tirets. Vérifié : les 9 valeurs de la config sont
lettre pour lettre les `label` de `src/data/territoires62.ts` (« valeur EXACTE stockée en base »).

**Vérifications.**

| Gate | Résultat |
|---|---|
| SDK : `typecheck` · `lint` · intégration | ✅ · ✅ 0 erreur · **36 passés**, 9 nouveaux, 4 échecs « Admin Actions » **préexistants** (identiques sans le patch, vérifié par `stash`) |
| SDK : `build` · `pack` | ✅ `communecter-cocolight-api-client-1.0.194.tgz`, installé dans site-json en `--no-save` |
| `typecheck` · `lint` | ✅ · ✅ 0 erreur (25 avertissements `react-hooks` préexistants) |
| `test:preflight` | ✅ **730 tests**, dont le gate `member-team-card` (25 cas : convention, typage, labels parent62) |
| `test:unit` | ✅ **4 763 passés**, 1 échec préexistant (`ProseContent — césure`, hérité du merge de `main`) |
| `config:validate` | ✅ 51 pages · 183 sections |
| `config:render` | ✅ 51/51 pages · **183/183 sections** avec du contenu SSR, `/equipe` 7/7, `/territoire/arrageois` 9/9 |
| `test:e2e` `parent62.spec.ts` | ✅ **24 passés**, dont 3 nouveaux sur la coordination (voir ci-dessous) |
| Sonde SDK depuis site-json (legacy `:5080`) | ✅ filtre appelant appliqué (0 résultat sur champ inexistant), `fields` additif (`telephone` arrive, `name`/`slug`/`links` conservés), lien prioritaire |
| Navigateur (dev server `parent62`, semis ci-dessous) | ✅ `/territoire/audomarois` : carte Mirana (libellé, rôle, courriel, adresse, `cardText`, couleurs `--territoire-audomarois-*`, pas de bouton — on est sur sa page), **sans** `footerText` · `/territoire/familles-en-sol-mineur-henin-carvin` : Legrand, téléphone projeté (égalité exacte sur le libellé le plus piégeux) · `/territoire/arrageois` : `footerText` seul, ni carte ni « Aucun membre » · `/equipe` : les 3, Judicael en carte neutre sans bouton. Réseau : **zéro** `slug/getinfo` ni `element/about` par carte (avant : un de chaque par membre) |

**Le résultat métier, vérifié sur un semis local.** Ni la base locale `:5080` ni
`www.communecter.org` ne portent les données de §9septvicies.4 (sur les deux, `parent62` n'a que
l'équipe de dev : 7 et 8 membres, aucun rôle `Coordonnateur(trice)`, aucun `territoires`). Trois
membres locaux ont donc été **semés** dans le Mongo du legacy (conteneur
`pixelhumain-docker-php7-mongo42-1`, base `communecter`) — conservés comme fixtures :

| Membre (`citoyens._id`) | `links.memberOf.<org>.roles` (+ miroir `organizations.links.members`) | `territoires` | Cas couvert |
|---|---|---|---|
| Mirana Sylvany (`5efb039b69086495368b46d7`) | `["Coordonnateur(trice)"]` | `"Audomarois"` | filtre exact + carte complète |
| Legrand Antoine (`6a4671343dcd8c54f34ddb8e`) | idem | `"Familles en sol mineur Hénin Carvin"` | égalité exacte, accents et espaces |
| Judicael Rakotomalala (`6448f244ecf6e50e4b539677`) | idem | *(aucun)* | sur `/equipe`, sur aucune page territoire |

Rejouable : `docker exec pixelhumain-docker-php7-mongo42-1 mongo communecter --eval '…updateOne({_id: ObjectId(<id>)}, {$set: {"links.memberOf.6a450f0ac34c7070327d2a64.roles": ["Coordonnateur(trice)"], territoires: "<libellé>"}})…'`
(et `$set` de `links.members.<id>.roles` sur l'orga `6a450f0ac34c7070327d2a64`). Les 3 tests e2e
« coordination » de `parent62.spec.ts` s'appuient dessus et **s'ignorent explicitement** (`test.skip`
avec le renvoi ici) si le semis manque — jamais verts à vide. Le cas Arrageois (repli) ne dépend
d'aucun semis.

> **Ce que le navigateur a révélé, que les sondes ne montraient pas.** Connecté en admin de
> `parent62`, le SDK passe par `globalautocompleteadmin`, où le legacy fait de `fields` une
> projection EXACTE : la première version rendait le repli au lieu de la carte, les documents
> revenant sans `collection` et étant ignorés. D'où le 4ᵉ volet SDK (retrait de `fields` sur ce
> chemin) et son test. Playwright, lui, n'est pas connecté : ses 3 tests exercent le chemin public.

> **Dépendance.** Le SDK `1.0.194` (commit `55e7680`, branche `feat/members-filters-fields-1.0.194`
> du dépôt `cocolight-api-endpoint`) est **publié** sur npm le 2026-09-22 14:19 Z, et la dépendance de
> site-json est bumpée (`^1.0.194`, lock résolu sur le registre avec les 4 volets) : le lot est
> installable par `npm ci`. Reste, côté backend : recopier `endpoints-copie.json` dans
> `cocolight-backend/src/contract/` (miroir tenu à chaque release).

> **Égalité exacte, gardée.** Le préflight `member-team-card` vérifie désormais que chaque
> `filters.territoires` de parent62 est, lettre pour lettre, un `label` de `territoires62.ts`. La
> dérive côté PROFIL (une saisie « Hénin-Carvin » avec tiret) n'est pas couvrable par un gate de
> config : c'est une règle de saisie du réseau, à tenir dans le référentiel.

### 9septvicies.7 Passe de revue (23/09) — 9 correctifs, 5 nettoyages, césure coform

`/code-review` rejoué sur `parents62` vs `main` après §9septvicies.6 ; 9 constats, tous repris :

| Constat | Correctif |
|---|---|
| Égalité Mongo exacte sans garde | gate préflight : chaque `filters.territoires` de parent62 est un `label` de `territoires62.ts` (9 cas + sentinelle) |
| `territoires` en TABLEAU : apparié par le filtre, rejeté par la carte | `vueMembre` lit le premier libellé exploitable d'un tableau — cohérent avec ce que Mongo retient |
| Lien de territoire en `<Link to>` depuis la config | `NavLink` (contrat `classifyHref`, règle CLAUDE.md) |
| `pending`/`admins` fetchés même sans onglets (3 appels par section vitrine, dont l'adhésion entière) | `entity: null` quand `!showTabs` (et `!canManage` pour pending) — hook inerte, motif de l'admin |
| Gate limité à `config.prod*` et à tout objet `type: member` | périmètre = résolution serveur à 3 niveaux ; section = `type: member` **avec** `props` objet |
| `exigerConvention` n'exigeait pas `{slug}` | même contrat que le préflight (`{slug}`, préfixe `--…`) + 2 tests |
| Encadré « SDK non publié » faux | réécrit (publié le 22/09 14:19 Z, dépendance bumpée par Thomas) |
| Recette `page-territoire` citait encore `territoire` | `filters` + `fields` + `card.rattachement` obligatoire |
| Garde « non vide » de `filters`/`fields` en trois endroits | une seule, dans `useInfiniteEntityQuery` ; `MemberQueryParams` = alias du type du hook |

**Cinq nettoyages transverses**, restés ouverts de la première revue (hors lot membres) : `ActionTiles`
— le SVG inline suit `sizeClass` (helpers de taille intrinsèque supprimés) ; `MapBubbles` — rendu
conditionnel au lieu de `hidden`+`flex` dans la même classe ; `sectionBadge` — commentaire aligné sur
ses 4 vrais appelants ; `sharedCodecs` — `normaliseDateIso` unique pour les deux codecs de date ;
`ArticlePage` — `useArticle().entity` typé `EntityTypes | null`, plus de `as never`.

**Césure des textes riches de formulaire** (cf. §9sexvicies.8) : `PROSE_CESURE = "wrap-anywhere"`
posé sur les 5 appels de `ProseContent` dans `coform/FormFields.tsx`, avec la mesure d'origine (352 px
dans une colonne de 308, modale qui défile latéralement) ; `ProseContent` reste nu (« le className de
l'appelant reste le seul habillage ») ; le test vise les composants coform. **Plus aucun test rouge.**

**`ArticleBody` — profil strict assumé (analyse, pas de changement).** La revue signalait la perte de
`class`/`style`/`id` sur les articles. Prémisse fausse pour moitié : sur `main`, `renderMarkdown`
était en `html: false` — le HTML d'un article s'affichait **en texte** (`<table>` littéral). Le lot
rend enfin les tables, et applique le profil `sanitizeProse` (faux écran de connexion impossible depuis
un article d'auteur non admin). Mesuré sur 2 000 des 6 434 articles (base locale) : **12** portent du
HTML (des tables), 5 un `style=` (couleurs violet/magenta, hauteurs de ligne), 4 un `class=` (résidus
Gmail/Thunderbird/WordPress), **0** `id=` ni ancre interne. Reste à trancher (§13) : assumer, ou
rétablir le profil permissif via `source`.

| Gate | Résultat |
|---|---|
| `typecheck` · `lint` | ✅ · ✅ 0 erreur |
| `test:unit` | ✅ **4 776 / 4 776** — 0 échec (était 1) |
| `test:preflight` | ✅ **730** |
| `test:e2e` `parent62.spec.ts` | ✅ **24 / 24** |
| `config:validate` · `config:render` | ✅ 51 pages · 183 sections · 183/183 avec contenu SSR |

Arbre `parents62` : 26 fichiers + `tests/preflight/member-team-card.test.ts`, **non commités**.

## 9octovicies. Impacts — INFORESO et « Elles et ils ont marqué le réseau » en pages dédiées, types d'actualité multiples, taxonomie facultative (16-17/09)

**Ce que ça change.** Deux contenus que le réseau avait retirés des catégories de ressources le 09/09
(§9unvicies.2) reviennent en **pages dédiées, chacune avec son formulaire d'admin** : la lettre
**INFORESO** (`/inforeso`) et **« Elles et ils ont marqué le réseau »**
(`/elles-et-ils-ont-marque-le-reseau`). Le formulaire d'actualité gagne deux types, **« À la une »** et
**« Zoom sur le réseau »**, et le type devient un **choix multiple**. Territoires, publics et thèmes
deviennent **facultatifs** partout, sauf dans « Réunion du comité ».

Config : **48 → 51 pages**, **170 → 176 sections**, **5 → 7 formulaires costum**, **9 → 11 onglets
`/admin`**, **3 → 5 modales d'édition** de POI. Les fiches se saisissent **à la main dans l'admin**.

### 9octovicies.1 INFORESO — `/inforeso`

| Élément | Réalisation |
|---|---|
| Fiche | POI `type:"doc"` — la clé NATIVE du type « Documentation » du backend (`Poi::$types`), pas son libellé |
| Formulaire `parent62-inforeso` | titre (requis), **année** en saisie libre bornée 1900–2100 (requise), **PDF hébergé** sur la plateforme (rattaché dans `medias`, type `pdf`) **ou lien** (`urls`) — règle `validate:documentOuLien` : au moins l'un des deux. Section sans titre |
| Onglet `/admin` « INFORESO » | colonnes titre / année / ajouté le, tri serveur par année |
| Page | titre et sous-titre, puis la liste **groupée par année** (`list.layout: "grouped"`, plus récente en tête) en lignes compactes (`resource.design: "document"`) qui ouvrent directement le PDF, sinon le lien, dans un nouvel onglet |
| Ordre dans une année | numéro le plus récemment saisi en tête (`groupBy.itemsSortBy: created desc`) — cf. encadré |
| Menu | entrée de premier niveau « INFORESO », à côté de « Contenus ». Cette 6ᵉ entrée faisait déborder la page de **3 px à 1280 px** (le groupe recherche/thème/langue/« Se connecter » sortait de l'écran, sur toutes les pages) : l'écart entre entrées du header `stacked` passe de 48 à **32 px entre 1280 et 1535 px** (`HeaderStacked.tsx` — parent62 est le seul site sur ce header ; **ramené à 24 px le 17/09** avec la loupe de recherche, §9novovicies). Mesuré en fr et en en de 1280 à 1920 px : plus de débordement |
| `/reseau` | le bloc INFORESO (image et bouton, désormais « Voir tous les numéros INFORESO ») pointe `/inforeso` au lieu de `/ressources` |

> **Le backend ne trie que sur la PREMIÈRE clé de `sortBy`.** `SearchNew.php` lit `array_keys($post["sortBy"])[0]` :
> `defaultSortBy: {annee:-1, created:-1}` y vaut `{annee:-1}`, sans erreur, et une année ressortait dans
> l'ordre d'insertion. Le paramètre `sort` multi-clés du même fichier est refusé par la validation du SDK
> (`GLOBAL_AUTOCOMPLETE_COSTUM … unexpected property, sort`). D'où le tri CLIENT dans les blocs, qui ne trie
> que les résultats chargés (`indexStepList: 60`). Le `created` inutile a été retiré de la page ET de
> l'onglet admin, qui ne le lisait pas davantage.

### 9octovicies.2 « Elles et ils ont marqué le réseau »

| Élément | Réalisation |
|---|---|
| Fiche | POI `type:"intervenant"` — clé costum, sur le modèle d'`affiche` (hors `Poi::$types`, le backend l'accepte) |
| Formulaire `parent62-intervenant` | nom (requis — une ou plusieurs personnes), **fonction** courte (`shortDescription`, requise), photo (`profil_avatar`), **présentation** markdown (requise) |
| Onglet `/admin` | colonnes nom / fonction / ajouté le, dernier ajouté en tête |
| Page | liste d'**annuaire** (`resource.design: "portrait"`) : photo ronde, nom, fonction en petites capitales, puis la présentation complète et ses liens ; entrées séparées par un filet ; **non cliquable** (tout est affiché). Dernier ajouté en tête |
| Menu | « Contenus » → « Elles et ils ont marqué le réseau » |

Itérations du 17/09, à la demande : grille + modale → carte affichant la présentation → annuaire sur
maquette, élargi ensuite pour montrer plus de personnes par écran (hauteur moyenne d'une entrée
401 → 273 px à 1280 px de large).

### 9octovicies.3 Types d'actualité « À la une » et « Zoom sur le réseau », en choix multiple

- `parent62-article.category` passe de `select` à **`multiselect`** et gagne `a-la-une` (« À la une ») et
  `zoom` (« Zoom sur le réseau »). **Stocké en texte** `a-la-une, zoom` (`write: "joinCsv"`) : le contrat
  `ADD_POI` type `category` en **chaîne**, un tableau ferait échouer la création. Une ancienne valeur unique
  (`appel-projet`) se relit comme un choix coché. Les `createDefaults` des onglets « Appels à projets » et
  « Offres d'emploi » passent en tableau.
- Chaque type coché pose son **mot-clé** : `Appels à projets`, `Offres d'emploi`, **`A la une`** (exactement le
  tag que filtre le carrousel `home-featured-poi` de l'accueil) et **`Zoom`**.
- **Le mot-clé suit désormais le type.** Le `mutation.stamps` `op:"append"` de §9sexdecies refusionnait les
  tags SERVEUR à chaque enregistrement : retirer un type ne retirait pas son tag (impossible de sortir une
  actualité du bandeau « À la une »). Il est **remplacé** par les codecs du champ `tags`
  (`p62article:tagsRead`/`tagsWrite`, table dans
  [`forms/costum/parent62-article/fns.ts`](../src/modules/profil/forms/costum/parent62-article/fns.ts), logique
  générique dans [`forms/costum/derivedTags.ts`](../src/modules/profil/forms/costum/derivedTags.ts)) : à
  l'édition, « Mots-clés » masque les tags des types enregistrés ; au save, on renvoie les tags saisis plus
  ceux des types cochés. Un tag posé À LA MAIN sur un autre type (ex. « A la une » sur un article simple)
  reste visible et modifiable.
- **Accueil — « Zoom sur le réseau »** (`articleTeaser` `zoom-reseau`) filtre désormais `tags: "Zoom"` au lieu
  des 6 dernières actualités. Les actualités existantes portaient déjà ce tag (certaines avec « A la une » en
  même temps) : la section est remplie. Son bouton « En voir plus » (`viewAllHref`) mène à **`/zoomcat`**
  (auparavant `/blog`, qui ne filtre pas par mot-clé).
- **Page `/zoomcat` — « Zoom sur le réseau »** : un titre puis la liste des actualités portant le mot-clé
  `Zoom` (`articleFeed` filtré `tags: "Zoom"`, 12 par page, **sans aucun filtre** visible). Sur le patron de
  `/appels-a-projets`, sans son bandeau de recherche. Vérifié : 12 résultats, tous tagués `Zoom`. **Atteinte depuis le bouton
  « En voir plus » de la section d'accueil** (vérifié au clic) ; absente du menu.

### 9octovicies.4 Territoires, publics et thèmes facultatifs

| Formulaire | Avant | Après |
|---|---|---|
| `parent62-article` | territoires, publics, thèmes requis | facultatifs |
| `parent62-recovery-center` | territoires, publics, thèmes requis | facultatifs |
| `parent62-event` | territoires requis | facultatif |
| `parent62-affiche` | déjà facultatifs | inchangé |
| **`parent62-reunion`** | territoires requis | **inchangé** — une réunion appartient toujours au comité d'un territoire |

### 9octovicies.5 Apports génériques au moteur

Tous **optionnels** : une config qui ne les déclare pas garde son rendu.

| Apport | Où | Garde |
|---|---|---|
| `list.layout: "grouped"` + `list.groupBy` (`field`, `order`, `itemsSortBy`, `emptyLabel`) | `lib/groupResults.ts`, `SearchListView`, `GroupHeading` | `groupResults.test.ts`, `SearchListView.test.tsx` (ids `useId` : une valeur avec espaces cassait `aria-labelledby`) |
| `resource.design: "document"` — ligne qui ouvre le fichier puis le lien, format réel affiché (`PDF`, `DOCX`…) | `CardResourceDocument`, `lib/resourceLink.ts` | `CardResourceDocument.test.tsx`, `resourceLink.test.ts` |
| `resource.design: "portrait"` + `resource.subtitleField` | `CardResourcePortrait` (photo intégrée : l'extraction `PortraitPhoto` n'avait plus qu'un consommateur une fois la preview portrait retirée) | `CardResourcePortrait.test.tsx` (HTML injecté neutralisé, non cliquable) |
| Mots-clés dérivés d'un type (codecs de champ) | `forms/costum/derivedTags.ts` | `derivedTags.test.ts`, `article.configDriven.test.ts` — vérifié en échec sans les codecs (5/9) |
| Règle « au moins un de ces champs » | `profil/forms/validators.ts` (`auMoinsUnRenseigne`) | `validators.test.ts` |
| Préflight : champs lus par l'affichage ⊂ `baseParams.defaultFields` | `tests/preflight/list-projected-fields.test.ts` | vérifié en échec sur 2 fautes injectées |

Au passage, `CardResource` et `PreviewResource` chargent leurs designs par le `lazy` de `vite-preload`, comme
`SearchCard` (ils étaient les deux seules coques du module sur `React.lazy`). Documentés dans
[doc/07](../doc/07-module-search.md) (table `list`, vue groupée, designs), [doc/15](../doc/15-tests.md)
(préflight), [doc/28](../doc/28-module-formengine.md) (inventaire et codecs), le registre
`prop-descriptions` et le skill `config-assistant`.

### 9octovicies.5bis Corps d'article : le HTML brut s'affichait en texte

**Constat (17/09)** : sur `/blog/moisDeLaParentalite2026`, le bloc « Une proposition départementale pour 2026 »
s'affichait en texte brut (`<table border="1" width="907"…`). Le corps des articles (`description`) mêle
titres markdown et HTML repris de WordPress, et les deux readers le rendaient par `renderMarkdown`, dont
markdown-it est en `html: false` : tout HTML y est **échappé**.

**Correction** : un composant `ArticleBody` (`src/modules/blog/components/ArticleBody.tsx`), partagé par
`ArticleReader` et `ArticleReaderPoster` qui dupliquaient ce bloc, rend le corps par `ProseContent` en
**markdown forcé** (markdown-it `html: true`) puis le profil d'assainissement **strict** `sanitizeProse` — un
article peut être écrit par un auteur non administrateur. `forceMarkdown` est indispensable : sans lui,
`ProseContent` détecte une balise et traite TOUT le texte en HTML, titres `#` compris.
`renderMarkdown` n'est PAS modifié : il sert 11 appelants avec le profil permissif, et y activer le HTML
ouvrirait de faux écrans de connexion dans des textes de visiteurs.

Pour que l'aperçu de saisie reste fidèle à la publication, l'aperçu de l'**éditeur markdown**
(`MarkdownEditor`) et la présentation de la carte **`portrait`** passent par le même rendu.

| Vérification | Résultat |
|---|---|
| Test `ArticleBody.test.tsx` | ✅ 4/4 (tableau au milieu du markdown, titres `#`, HTML dangereux neutralisé, corps vide) — **rouge avec l'ancien rendu** |
| Page réelle, clair / sombre / 360 px | ✅ tableau rendu (titre, texte, lien « Kit Mois de la Parentalité 2026 »), plus de HTML en texte, largeur de colonne respectée, aucun débordement |
| Rendu serveur | ✅ le HTML servi contient le vrai `<table>` |
| Annuaire après passage à `ProseContent` | ✅ mêmes contrastes (8,16 / 5,64 en clair, 12,28 / 7,01 en sombre), aucun débordement |

**Périmètre** : d'autres affichages passent encore par `renderMarkdown` et échappent le HTML brut —
présentation de profil (`ProfileAbout`), modales de ressource, d'événement et génériques. Aucun contenu
concerné n'y a été constaté.

### 9octovicies.5ter Cartes d'événement : dates de début et de fin

Une carte d'événement (`CardEvent`, cible « Événements » de `/recherche`) n'affichait que sa date de début :
« Mois de la parentalité » se lisait « 1 oct. 2026 ». Un événement de plusieurs jours affiche désormais ses
deux bornes, en taisant à gauche ce que la droite répète :

| Événement | Affichage |
|---|---|
| un seul jour | « 1 » · « oct. 2026 » |
| même mois | « 1 – 31 » · « oct. 2026 » |
| deux mois | « 28 sept. – 3 » · « oct. 2026 » |
| deux années | « 30 déc. 2026 – 2 » · « janv. 2027 » |

Un créneau de nuit de moins de 24 h (`21:00` → `01:00`) reste un seul jour. Logique pure dans
`src/modules/search/lib/eventDateSpan.ts` (`porteeDate`, `libellesDate`), testée en locale française.
Vérifié sur `/recherche` : « Mois de la parentalité » affiche **1 – 31 oct. 2026**.

### 9octovicies.5quater Accueil : bloc « Vous êtes… »

Le bloc ouvre désormais l'accueil, avant la rangée « Territoires » / « À la une ».

| Case | Texte | Couleur |
|---|---|---|
| Parent | « Trouvez du soutien, des activités et des témoignages de parents. » | **aplat `#1eae98`**, texte et icône **noirs** — contraste **7,56:1** (AAA), clair comme sombre |
| Professionnel·le ou bénévole | « Référencez vos actions, rejoignez le réseau et suivez l'agenda de votre territoire » | teinte turquoise inchangée |

La case Parent était grise : sa teinte à 20 % du `primary` clair (marine peu saturé). Les couleurs sont
deux jetons de marque de `index-parent62.css`, `--p62-vert` et `--p62-vert-encre`, fixes en clair et en
sombre. La section `action-tiles` accepte pour cela, par case, `background` (fond plein) et `textColor`,
optionnels : les 9 autres usages du parc gardent leur rendu (doc/05).

### 9octovicies.5quinquies Page « Vous êtes parent » (`/parents`)

- **Texte principal** : le bandeau sous le titre porte désormais « Être parent, ça se partage. Le réseau
  rassemble les acteurs du soutien à la parentalité du département : trouvez une action près de chez vous,
  écoutez ce que d'autres parents traversent, ou venez simplement échanger. » Le bloc HTML qui répétait ce
  texte sous le bandeau est supprimé, ainsi que l'ancien sous-titre « Des lieux, des rencontres… ».
- **Cases « Par où commencer ? »** : quatre cases, sur 4 colonnes dès 1024 px (2 sur tablette, 1 sur mobile), toutes en aplat
  `#1eae98`, texte et icône noirs (7,56:1, AAA), avec les jetons de la case Parent de l'accueil. Grille élargie
  (1 280 px max), cases de même hauteur, contenu calé en haut pour aligner icônes et titres ; titre 18 px,
  sous-titre 16 px, icône 32 px.

| Case | Sous-texte | Lien |
|---|---|---|
| Retrouvez des témoignages de parents du Pas-de-Calais | Des audios et des écrits pour découvrir leurs réalités. | `/temoignages` |
| Trouver une action près de chez moi | Mise en place par les partenaires du territoire | `/recherche` (actions, public parents) |
| Voir l'agenda | La semaine ou le weekend, découvrez les actions proches de chez vous | `/agenda` |
| **Ressources** (nouvelle) | Retrouvez ici des outils, des sites ressources et des contacts de partenaires | `/ressources` |

Taille et largeur viennent de deux options de la section `action-tiles`, `size: "lg"` et `width: "wide"` ;
sans elles, les autres usages du parc et l'accueil parent62 gardent leur rendu (doc/05). La hauteur égale des
cases d'une rangée vaut pour tout le parc : vérifié sur l'accueil et `/pro` de parent62 et sur l'accueil de
rezo-sante-reunion, où seules des cases trop courtes s'allongent. Le lien Ressources est
relatif : il suit le domaine où tourne le site.

### 9octovicies.5sexies Page « Vous accompagnez des familles » (`/pro`)

- **Texte principal** : le bandeau sous le titre porte désormais « Le réseau facilite l'interconnaissance entre
  acteurs, la mise en réseau et la visibilité des actions menées auprès des familles. » Le bloc HTML placé sous
  le bandeau (« … Référencez vos actions et événements, et appuyez-vous sur les paroles de parents pour nourrir
  vos pratiques. ») est supprimé, ainsi que l'ancien sous-titre « Professionnel·les et bénévoles de la
  parentalité… ».
- **Cases « Par où commencer ? »** : même mise en forme que sur `/parents` (`size: "lg"`, `width: "wide"`,
  4 colonnes dès 1024 px, 2 sur tablette, 1 sur mobile), dans la couleur de la case « Professionnel·le ou
  bénévole » de l'accueil (`color: "accent"`). Contraste mesuré : titre 13,04:1 et sous-titre 5,04:1 en clair,
  10,14:1 et 4,9:1 en sombre (AA).

| Case | Sous-texte | Lien |
|---|---|---|
| Référencer une action | Faites connaître vos initiatives | `/recherche` (actions) |
| Rejoindre le réseau | Structures et professionnel·les | `/communaute` |
| **Zoom sur les ressources départementales et nationales** (ex « Explorer les événements pro ») | Colloques, appels à projets, offres d'emploi… | `/recherche` (événements, public pro), inchangé |
| Écouter les parents | Paroles recueillies par le réseau et ses partenaires. | `/temoignages` |

### 9octovicies.5septies Vérifications des cases (accueil, `/parents`, `/pro`)

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ **51 pages · 174 sections** (les deux blocs HTML d'introduction de `/parents` et `/pro` en moins) |
| `audit:config` | ✅ parent62 — RAS |
| `config:render` | ✅ parent62 ; et les 6 autres sites qui emploient `action-tiles` : rezo-sante-reunion, rezo-la-mer, institut-bleu, cyber-reunion et eXtremeDefiAdeme rendent chaque page. nos-commune rend son accueil (qui porte les cases) ; sa page `/manifeste`, un seul bloc HTML et une config que le lot ne touche pas, répond 404 |
| `test:unit` (préflight compris) | ✅ suite complète verte hors les 3 échecs **étrangers au lot** : `site-assets`, `ProseContent — césure` et `bundle-size` (chiffres finaux en §9quinquiestricies) |
| `test:integration` | ✅ `config-driven-ssr` avec `SITE_CONFIG_PATH=./config.prod.parent62.json` : **98/98**. Suite complète non relancée : sur 7 Go, elle dépasse la mémoire disponible quand le serveur de dev tourne |
| `test:e2e` ciblé (`parent62.spec.ts`) | ✅ **2 nouveaux tests** sur `/parents` et `/pro` à 1 280 px (4 cases sur une rangée, même hauteur, icônes alignées) : rouges sans la hauteur égale (« même hauteur ») et sans le calage en haut (« icônes alignées »), verts avec |
| `typecheck` · `lint` | ✅ · ✅ **0 message** sur les fichiers du lot |
| Gardes vérifiées en échec | ✅ préflight `prop-descriptions` : le bloc `section:action-tiles` ajouté au registre sans plancher de couverture fait rougir « aucun bloc hors ratchet » |
| Écran | ✅ 360, 700, 1 024, 1 280 et 1 536 px, clair et sombre, sans débordement. Contrastes : case Parent de l'accueil et cases de `/parents` **7,56:1** ; cases de `/pro` titre **13,04:1** et sous-titre **5,04:1** en clair, **10,14:1** et **4,9:1** en sombre. Leurs icônes turquoise tiennent **1,54:1** en clair (décoratives : le titre porte le sens) |
| Portée inter-sites | ✅ `size`, `width`, `background`, `textColor` : optionnels, employés par parent62 seul ; sans eux, classes identiques à l'historique (test unitaire). **La hauteur égale par rangée vaut pour les 7 sites** : sur l'accueil de rezo-sante-reunion, deux cases sur cinq dépassaient de 16 px, les cinq sont désormais alignées |

### 9octovicies.6 Prérequis de mise en production

| # | Prérequis | Pourquoi | Qui |
|---|---|---|---|
| 1 | Déclarer **`costum.typeObj.doc`** et **`costum.typeObj.intervenant`** dans la base de PROD, chacun avec `dynFormCostum.onload.actions.presetValue.type` ET un `beforeBuild.properties` non vide (déjà posés en base locale) | sans `presetValue`, le SDK n'autorise pas ces types (liste fermée d'`ADD_POI`) : « /type must be equal to one of the allowed values » ; sans `properties`, il ignore la déclaration | Thomas / backend |
| 2 | ✅ **Posé dans `sites.json` le 17/09** : `"env": { "VITE_COSTUM_FORCE_LIVE": "true" }` sur l'entrée `parent62` (comme `sportSanteBienetre`, `associationEkilibre`, `institutBleu`). **Reste à le pousser** vers Coolify : `npm run deploy:env -- parent62` (à blanc) puis `--write`, et redéployer (`deploy:rollout`). Alternative à terme : une version du SDK dont l'artefact connaît `doc`/`intervenant`/`annee`, qui permettrait de retirer le drapeau | le SDK 1.0.193 embarque un contrat parent62 FIGÉ (sans `doc`, `intervenant` ni `annee`) et ignore le `typeObj` écrit ensuite en base : sans le drapeau, la création d'un numéro échoue (`annee` refusé) et celle d'un intervenant aussi (`type` refusé). Contrepartie : le contexte costum attend la réponse du backend au démarrage | Peterson (déploiement) / Thomas (SDK) |
| 3 | Confirmer la **limite de téléversement** de la prod | en local `upload_max_filesize = 2M` : un PDF plus lourd est refusé — il faut le compresser avant de le joindre | Thomas |
| 4 | Saisir les numéros INFORESO et les intervenants dans l'admin | les pages sont vides tant qu'aucune fiche n'existe | réseau |

### 9octovicies.7 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ **51 pages · 176 sections** |
| `audit:config` | ✅ parent62 — RAS |
| `config:costum-drift` (mode live) | ✅ **0 champ fantôme** sur les 7 formulaires parent62 |
| `config:render` | ✅ parent62 **51/51 pages · 176/176 sections** avec du contenu SSR ; institut-bleu (autre consommateur de la carte `resource`) **13/13 · 26/26** |
| `test:unit` (préflight compris) | ✅ **4 532 tests** — 3 échecs **étrangers au lot** : `site-assets` (dossier vide `public/images/EcosystemeSanteReunion`, cf. §9septvicies.5), `ProseContent — césure` (préexistant sur `main`) et `bundle-size` (cf. ligne dédiée) |
| `test:integration` | ✅ **753 tests** — 4 échecs étrangers : `site-assets`, `bundle-size` et les 2 specs génériques de `config-driven-ssr` qui comparent `config.prod.json` ; **relancée avec `SITE_CONFIG_PATH=./config.prod.parent62.json`, `config-driven-ssr` passe 98/98** |
| `test:e2e` ciblé (`parent62.spec.ts`) | ✅ **12/12**, dont 4 nouveaux : `/zoomcat` (titre, aucun filtre, liste), `/inforeso` (blocs d'année, liens en nouvel onglet), annuaire sans bouton, et **aucun débordement horizontal à 1280 px** — rouge sans la correction du header (1 283 px), vert avec. Le test d'accueil décrit la nav à **6 entrées** (5 avant INFORESO) |
| `test:e2e` complet | ✅ **26 passés**, 8 ignorés, 6 échecs étrangers : 4 specs génériques contre `config.prod.json` et `auth-flow` sans `.env.test`. Relancés sur la config parent62, `i18n` et le pied de page passent ; restent 2 échecs de `config-nav`, qui cherche la nav dans `<header>` alors que le header `stacked` la rend dans un `<nav class="sticky">` séparé — structure non touchée par le lot |
| `typecheck` · `lint` | ✅ · ✅ **0 erreur** — 25 avertissements préexistants sur 17 fichiers, **aucun dans un fichier du lot** |
| `build` | ✅ client + serveur, 0 erreur ; chaque design a son chunk (`CardResourcePortrait` 1,75 ko, `CardResourceDocument` 1,93 ko — < 1 ko gzip), téléchargé par les seules pages qui l'utilisent |
| Préflight `bundle-size` | ⚠️ **rouge, mais préexistant** — ce test ne s'active que si un `dist/` existe (ignoré lors du passage `test:unit`). Bundle principal : **3,39 Mo au commit `9f1a38c9`** (limite 2 Mo), **+756 octets** avec le lot. Mesuré en construisant ce commit dans un worktree AVEC le même `.env` (sans lui, l'écart apparaît faussement à ~38 ko) |
| Gardes vérifiées en échec | ✅ préflight `list-projected-fields` (2 fautes injectées) · codecs de tags (5/9 tests rouges sans eux) · ids de blocs (test rouge avec l'ancien id construit sur la valeur) |
| Écran | ✅ `/inforeso` (ordre dans l'année), annuaire en clair, sombre et 360 px, sans débordement. Contraste de l'annuaire : fonction **8,16:1** (clair) / **12,28:1** (sombre), texte **5,64:1** / **7,01:1** |
| Portée inter-sites | ✅ `grouped`, `groupBy`, `document`, `portrait`, `subtitleField` : optionnels, utilisés par parent62 seul. Le `lazy` de `vite-preload` concerne aussi les cartes `resource` de **institut-bleu, rezo-sante-reunion, maison-sport-sante-la-tampon, sport-sante-bien-etre** |

Lot commité le 17/09/2026.

---

## 9novovicies. Loupe de recherche dans le menu

Une **7ᵉ entrée de menu, en icône seule** (une loupe), suit « INFORESO » et mène à `/recherche` — comme sur
l'ancien site, où la loupe du header ouvrait la page d'archives. Son libellé « Recherche » / « Search » reste
le nom lu par les lecteurs d'écran et l'infobulle au survol ; le menu mobile l'affiche avec son libellé.
Le bouton `Ctrl+K` du groupe d'actions, qui ouvre la palette de commandes, est conservé : les deux coexistent.

Côté moteur, une entrée de nav accepte `iconOnly: true` (avec `icon`). Seule la barre desktop du header
`stacked` l'honore ; les autres variantes et le menu mobile affichent le libellé (doc/04).

**Place dans la barre.** Cette entrée ajoute 56 px au menu et ne laissait plus que **5 px** avant débordement
à 1 280 px en français ; avec une barre de défilement classique (17 px, Windows), le contenu dépassait de
**20 px** et « Se connecter » touchait le bord. L'écart entre entrées passe donc de 32 à **24 px entre 1 280 et
1 535 px** (48 px au-delà, inchangé) : il reste **45 px** de marge à 1 280 px en français, **28 px** avec la
barre de défilement, et **54 px** en anglais.

### 9novovicies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ 51 pages · 174 sections |
| `test:e2e` ciblé (`parent62.spec.ts`) | ✅ **15/15**. Le test d'accueil décrit la nav à **7 entrées** et vérifie que la loupe n'affiche aucun texte, porte le nom accessible « Recherche » et pointe `/recherche` ; **nouveau test** « barre de défilement classique » : rouge avec l'écart de 32 px (1 243 px de contenu pour 1 223 px de barre), vert à 24 px |
| `test:e2e` complet | ✅ **30 passés**, 8 ignorés, 7 échecs étrangers : les specs génériques comparées à `config.prod.json` (un autre site) et `auth-flow` sans `.env.test`. Sur la config parent62, `config-nav` en garde 2, qui cherchent la nav dans `<header>` alors que le header `stacked` la rend dans un `<nav class="sticky">` séparé. Le test générique « chaque libellé de menu apparaît dans le header » sait désormais qu'une entrée `iconOnly` expose son libellé en nom accessible |
| `config:render` | ✅ parent62 : chaque page sert au moins une section avec du contenu |
| `typecheck` · `lint` | ✅ · ✅ 0 message sur les fichiers du lot |
| Écran | ✅ 1 280, 1 366, 1 440, 1 535, 1 536 et 1 920 px, en français et en anglais, bandeau haut et barre compacte, clair et sombre : aucun débordement, loupe à ≥ 16 px du groupe d'actions. Menu mobile : entrée « Recherche » avec icône et libellé |

---

## 9tricies. Agenda par territoire et sous-menu agrandi

### 9tricies.1 L'agenda du territoire sur les 9 pages

Chaque page de territoire porte une section **« L'agenda du territoire »**, posée entre la rangée du comité
local et les ressources. Elle liste **tous les événements rattachés au territoire** (`type: "others"`,
`territoires` du territoire), en onglets **À venir / Passés**, et son en-tête renvoie vers
`/agenda?territoire=<id d'option>` — l'identifiant, jamais le libellé : un libellé retouché cesserait d'être
reconnu et la page cible s'ouvrirait non filtrée (garde préflight `deeplink-filters`). Les dates du comité
local, filtrées `type: "meeting"`, restent dans leur bloc au-dessus : les deux ne font pas doublon.

Le gabarit de territoire passe donc de 8 à **9 sections de premier niveau**, identiques sur les 9 pages.
`searchHeader` alimentant le `PageFilters` de la page entière, un thème ou un public coché filtre aussi
cet agenda.

### 9tricies.2 Sous-menu du header

Dans les colonnes du sous-menu (header `stacked`), le titre d'entrée passe de **16 à 18 px** et sa
description de **12 à 14 px**.

### 9tricies.3 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` | ✅ 51 pages · **183 sections** (9 de plus) · parent62 RAS |
| `config:render` | ✅ chaque page sert au moins une section avec du contenu |
| Filtre par territoire | ✅ prouvé : en pointant la section d'Arrageois sur un territoire inexistant, elle affiche « Aucun événement » ; rétablie, elle réaffiche l'événement. Le lien d'en-tête arrive sur `/agenda` avec le filtre « Arrageois » sélectionné (compteur « Filtres 1 ») |
| Gardes préflight | ✅ 3 gardes ont rougi sur ce lot et ont été traitées : `deeplink-filters` (les 9 liens portaient le libellé du territoire, remplacés par l'id d'option), `page-recipes` (séquence des 2 recettes de territoire resynchronisée) et l'instantané `effective-config` de parent62 (9 sections ajoutées, aucun autre écart) |
| `test:unit` (préflight) | ✅ 659 tests, hors les 2 échecs connus (`bundle-size`, `site-assets`) |
| `test:e2e` ciblé | ✅ **16/16**, dont un nouveau test : la page d'Arrageois porte 2 agendas, celui du territoire affiche son titre et pointe `/agenda?territoire=arrageois` |
| Écran | ✅ pages territoire à 1 280 px sans débordement ; sous-menu mesuré à 18 px / 14 px |

**Donnée locale** : la base de développement ne contient qu'un événement, « Mois de la parentalité »,
rattaché aux 9 territoires — il apparaît donc sur les 9 pages.

---

## 9untricies. Panneau du sous-menu et couleurs de territoire

### 9untricies.1 Le panneau du sous-menu tient dans l'écran

Les panneaux de sous-menu du header `stacked` se centrent désormais sous le MENU entier, et non sous leur
seule entrée : la rangée porte le `relative`, les entrées ne le portent plus. Centré sur sa propre entrée, le
panneau du premier menu (« Le Réseau parentalité ») sortait de l'écran par la gauche — **180 px coupés à
1 280 px**, 100 px à 1 440 px — et sa première colonne était illisible. Le soulignement d'une entrée reste
ancré sur son lien, qui porte déjà `relative`.

### 9untricies.2 Chaque territoire colore ses sections

Une page peut porter une couleur d'accent (`page.accent`, couleur CSS) : le moteur la pose sur son `<main>`
en `--page-accent`, avec son aplat léger `--page-accent-soft` (16 % sur le fond du thème). Les sections qui
acceptent `bg: "page-accent"` prennent cet aplat **et un filet supérieur à la couleur pleine**. Header et pied
de page ne sont pas touchés, et sans accent la valeur reste transparente : une page ne prend jamais une
couleur au hasard.

Les 9 pages de territoire portent la couleur de marque de leur territoire (`var(--territoire-<slug>)`, la
même que leur bandeau de titre). Trois bandeaux teintés rythment la page, séparés par des sections au fond
neutre : **l'agenda du territoire**, **le bandeau de filtres des actualités** et **l'accordéon des communes**.
« Les actions sur le territoire » reste neutre, pour ne pas coller deux bandeaux teintés l'un à l'autre. Le
bandeau de filtres portait jusque-là le dégradé du thème, le même sur les 9 territoires.

Au passage, `bg` était **déclaré au schéma de la section `agenda` mais ignoré au rendu** (fond toujours
`bg-background`) : il est désormais honoré. Aucun site du parc ne le posait, leur rendu est inchangé.
`accordion` et `searchHeader` acceptent maintenant `bg` eux aussi, et `agenda`, `searchProStatic`,
`accordion` et `searchHeader` partagent une seule table de fonds (`sectionBg.ts`, testée). Sans `bg`, chacun
garde son fond d'origine — dégradé du thème pour le bandeau de filtres : les 9 autres `searchHeader` de
parent62 et ceux des autres sites sont inchangés.

### 9untricies.3 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` · `config:render` | ✅ 51 pages · 183 sections · parent62 RAS · chaque page rend |
| Écran | ✅ panneaux de sous-menu entiers à 1 280 et 1 440 px, pour les 3 menus mesurés (0 px coupé). Pages territoire en clair et en sombre : contraste d'un titre sur bandeau teinté **11,7:1 à 13,5:1** selon la teinte ; champ de recherche et listes déroulantes du bandeau de filtres à **14,4:1** en clair |
| Portée inter-sites | ✅ `page.accent` et `bg: "page-accent"` ne sont employés que par parent62, et seulement sur ses 9 pages de territoire ; le seul autre `bg` du parc sur ces sections est un `default` de rezo-sante-reunion, rendu à l'identique |
| `test:unit` (préflight compris) | ✅ préflight et sections vertes, hors les 2 échecs connus (`bundle-size`, `site-assets`) |
| `test:e2e` ciblé | ✅ **17/17**, dont un nouveau test : la page du Boulonnais porte `--page-accent: #c34a42` et ses trois bandeaux teintés (agenda, filtres d'actualités, communes) se distinguent du fond — **rouge sans l'accent** posé sur le `<main>` |
| `typecheck` · `lint` | ✅ · ✅ 0 message sur les fichiers du lot |

---

## 9duotricies. Villes au survol des bulles de la carte

Sur l'accueil, survoler une bulle de territoire affiche les **villes principales** du territoire, comme sur
l'ancien site : « Calaisis » → *Calais – Audruicq – Guînes*. Les listes sont reprises telles quelles de
`parent62.org`. L'infobulle apparaît aussi au **focus clavier** et sert de description accessible du lien
(`aria-describedby`) ; au toucher elle ne s'affiche pas, l'appui suivant le lien.

**Entre Mer et Terres n'a pas d'infobulle** : l'ancien site n'y déclarait aucune ville. La liste est à fournir
par le réseau.

Côté moteur, une bulle accepte `items[].cities` (texte localisé). L'infobulle s'ouvre **juste sous la pastille
du nom** (6 px), et non sous le bas du rond, où elle tombait 40 px plus bas, détachée de la bulle survolée. Son
ancrage horizontal suit la position de la bulle sur la carte : centrée au milieu, calée à gauche ou à droite
près des bords — centrée sur une bulle de bord, elle sortait de la carte.

### 9duotricies.1 Vérifications

| Gate | Résultat |
|---|---|
| Écran | ✅ 1 440, 1 280, 768 et 360 px : les 8 infobulles apparaissent au survol, **aucune ne sort de la carte ni de la page** |
| `test:e2e` ciblé | ✅ **18/18**, dont un nouveau test : l'infobulle de Calaisis porte les 3 villes, reste à `opacity: 0` au repos, passe à 1 au survol, et décrit le lien |
| `validate-config` · `typecheck` · `lint` | ✅ 51 pages · 183 sections · 0 erreur |
| Gardes préflight | ✅ 659 tests, hors les 2 échecs connus |

---

## 9tertricies. Accueil : trois bandes, un seul repère de titre

L'accueil se lit désormais en **trois bandes pleine largeur**, au même rythme vertical (64 px) :

| Bande | Fond | Contenu |
|---|---|---|
| « Vous êtes… » | clair | les deux cases d'entrée, inchangées |
| « Territoires » / « À la une » | **turquoise clair** (aplat de `page.accent`, la turquoise de marque) | la carte et le carrousel, cartes arrondies et ombrées |
| « Zoom sur le réseau » | marine | les 6 articles taggés Zoom |

Les **quatre titres portent la même pastille inclinée** : « Vous êtes… » l'adopte à son tour (option
`headlineStyle: "badge"` de la section `action-tiles`, en marine). La section `gridLayout` accepte un `bg`,
ce qui lui permet de poser une bande colorée sans bloc supplémentaire.

**Contraste corrigé, et il était mauvais.** Les pastilles et les boutons turquoise portaient un texte blanc :
**1,93:1**, très en dessous du seuil AA. Ils prennent l'encre marine du site, soit **5,68:1**. Les deux
sections concernées (`articleTeaser`, `featured-carousel`) codaient le blanc en dur ; elles acceptent
maintenant `accentTextColor`, dont le défaut reste le blanc — les autres sites ne bougent pas. Les deux
sections et les tuiles partagent désormais la même fabrique de style d'accent (`accentStyle.ts`, testée).

### 9tertricies.1 Vérifications

| Gate | Résultat |
|---|---|
| Écran | ✅ 1 440, 768 et 360 px, clair et sombre, sans débordement. Pastilles : « Vous êtes… » **10,98:1**, « Territoires » **18,09:1**, « Zoom sur le réseau » **5,68:1** (1,93 avant). Boutons d'accent « En savoir + » : **5,68:1** |
| `validate-config` · `typecheck` · `lint` | ✅ 51 pages · 183 sections · 0 erreur |
| `test:unit` (préflight compris) | ✅ préflight et sections vertes, hors les 2 échecs connus |
| `test:e2e` ciblé | ✅ 18/18 |
| Portée inter-sites | ✅ `headlineStyle`, `bg` de `gridLayout` et `accentTextColor` sont optionnels et employés par parent62 seul ; sans eux, titre centré, bande transparente et encre blanche — le rendu historique |

**Donnée locale** : les vignettes d'articles de l'accueil ne s'affichent pas en développement (le proxy
d'images répond 502 sur les fichiers de `communecter-dev`). Rien à voir avec la mise en page.

---

## 9quattuortricies. Dépôt d'un événement : dispense de validation et période récurrente

### 9quattuortricies.1 Un admin du site publie sans validation

Jusqu'ici, TOUT événement déposé par le formulaire « Proposer un événement » partait en attente de
validation, y compris celui d'un administrateur du site. Le drapeau (`preferences.toBeValidated`) est
désormais posé **sauf pour les admins du site** : `mutation.inject.extraFieldsUnlessCostumAdmin`. La
qualité d'admin est lue sur le porteur du costum (`isCostumHostAdmin`), la même définition que le
`siteAdmin` de l'admin et que l'`isCostumAdmin` du backend. Porteur pas encore chargé → la fiche part en
attente : une dispense ne s'accorde jamais par défaut.

⚠ **C'est un filtre d'affichage, pas une barrière de sécurité.** Ce drapeau est posé par le navigateur —
il l'était déjà avant ce lot. Une requête forgée peut s'en passer, admin ou pas. Une vraie garantie
demanderait que le backend impose lui-même la modération selon l'auteur.

### 9quattuortricies.2 Un événement récurrent peut porter sa période

Le champ de dates masquait début et fin dès qu'on cochait « récurrent », et le codec d'écriture les
supprimait volontairement. Sur le formulaire événement de parent62, les deux dates restent maintenant
affichées en récurrent, sous les libellés **« Début de la période »** et **« Fin de la période »** : elles
bornent la période sur laquelle les occurrences se déroulent, ce que le backend lit déjà
(`searchEventsCostum` déroule les occurrences dans `[startDate, endDate]`).

Deux garde-fous pour ne rien changer ailleurs : l'affichage est **opt-in** (`widgetProps.datesWhenRecurrent`)
et l'écriture passe par un codec dédié (`eventDatePeriod:write`, qui conserve la date, là où
`eventDate:write` l'omet en récurrent, pour éviter qu'une date rémanente d'une bascule parte au serveur).
La « Réunion du comité » de parent62 et les 3 autres sites qui emploient ce champ (institut-bleu,
saint-paul-sport, sport-sante-bien-etre) gardent donc leur formulaire actuel.

### 9quattuortricies.3 Vérifications

| Gate | Résultat |
|---|---|
| Contrat SDK `ADD_EVENT` | ✅ dates ET récurrence sont compatibles : le contrat n'exige les dates qu'en ponctuel (`if recurrency=false → then required startDate/endDate`), les horaires en récurrent (`else required openingHours`) ; `startDate`/`endDate` restent des propriétés déclarées, donc acceptées |
| `test:unit` | ✅ suite complète verte hors les 3 échecs connus. Nouveaux : dispense de modération (3 cas : visiteur, admin, porteur non chargé), codec de période (3 cas), rendu du champ de dates (3 cas), câblage de la config (3 cas) |
| `validate-config` · `typecheck` · `lint` | ✅ · ✅ · ✅ |
| **Non vérifié** | l'enregistrement RÉEL d'un événement récurrent daté, qui prouverait que le backend legacy l'accepte : il demande un compte de test (`.env.test`), absent de ce poste. C'est le test d'intégration `costum-forms` qui le couvrirait |

---

## 9quinquiestricies. Vérifications du lot (21/09/2026)

Portes passées sur l'ENSEMBLE du lot — loupe du menu, panneau de sous-menu, couleurs de territoire,
bandeau de filtres, accueil en bandes, infobulles de la carte, formulaire événement.

| Gate | Résultat |
|---|---|
| `typecheck` · `lint` | ✅ · ✅ **0 message** sur les 41 fichiers du lot |
| `validate-config` · `audit:config` | ✅ **51 pages · 183 sections** · parent62 RAS |
| `test:unit` (préflight compris) | ✅ **4 573 tests**, 3 échecs **étrangers au lot** et antérieurs : `bundle-size`, `site-assets`, `ProseContent — césure` |
| `test:integration` (`config-driven-ssr`, `SITE_CONFIG_PATH=./config.prod.parent62.json`) | ✅ **99/99** |
| `test:e2e` ciblé (`parent62.spec.ts`) | ✅ **18/18** |
| `test:e2e` complet | ✅ **33 passés**, 8 ignorés, **7 échecs étrangers** : specs génériques comparées à `config.prod.json` (un autre site) et `auth-flow` sans `.env.test` |
| `config:render` | ✅ **6 sites** : parent62, institut-bleu, rezo-la-mer, rezo-sante-reunion, saint-paul-sport, sport-sante-bien-etre — chaque page sert au moins une section avec du contenu |
| Gardes vérifiées EN ÉCHEC | ✅ hauteur égale des cases · calage en haut (icônes alignées) · débordement du header sous barre de défilement · accent de page absent · plancher du registre `prop-descriptions` |
| Briques partagées | ✅ `sectionBg` (5 sections), `accentStyle` (4 appels), `SECTION_BADGE_CLASS` (2) et `isCostumHostAdmin` (4) remplacent des recopies ; toutes les nouveautés sont optionnelles, employées par parent62 seul |

---

## 9sextricies. Accueil : mise en forme des trois blocs du haut

Les trois blocs du haut (« Vous êtes… », « Territoires », « À la une ») suivent la maquette du réseau, dans
les couleurs de parent62.

| Bloc | Avant | Maintenant |
|---|---|---|
| Titres | étiquettes inclinées, posées dans le bloc | **étiquettes inclinées pour les quatre blocs**, « Zoom sur le réseau » compris ; celles de « Territoires » et « À la une » débordent du haut de leur carte (la variante en pilule arrondie existe : `headlineStyle: "pill"`) |
| Cases « Vous êtes… » | icône puis textes centrés | **icône en pastille, titre à côté, sous-titre dessous**, aligné à gauche, coins arrondis et ombre légère |
| Territoires | dégradé de marque sur tout le bloc, accroche à droite | **carte blanche, encre sombre** ; le dégradé de marque n'habille plus que le panneau de l'illustration, accroche sous le titre |
| À la une | carte marine, texte blanc, flèches de navigation, bouton pleine largeur | **copie de « Territoires »** : carte claire, étiquette débordante, et l'actualité posée sur le **même panneau dégradé vert** (marge de 16 px des deux côtés, comme l'illustration). Le bouton « En savoir + » et les points de position vivent **dans** ce panneau, 32 px au-dessus de son bord bas — points au centre, bouton à droite, **marine à texte blanc** (la turquoise se fondait dans le vert) ; sous 640 px, le bouton passe à la ligne, sinon il mordrait sur les points |

Le texte de la case « Parent » reste **noir sur le vert de marque** (7,56:1) : la maquette le met en blanc,
qui n'y tient que 2,78:1.

Les **deux panneaux verts sont au même niveau** — même haut, même bas — à 1 024, 1 280 comme à 1 440 px.
Chaque panneau s'étire jusqu'au bas de sa carte ; celui de l'actu descend en plus de la hauteur de
l'accroche que « Territoires » porte au-dessus de son illustration. Dans la carte des territoires,
l'illustration se centre dans son panneau, ses bulles restant positionnées en % de l'ILLUSTRATION (sinon
elles dérivent dès que le panneau est plus haut qu'elle).

Les **trois bandes de l'accueil partagent la même largeur** (1 280 px) : la grille garde la sienne, « Vous
êtes… » passe en `width: "wide"` et « Zoom sur le réseau » en `maxWidth: "7xl"` — ils faisaient 1 024 et
896 px.

**Couleur des étiquettes** : « Vous êtes… » et « À la une » en marine, « Territoires » et « Zoom sur le
réseau » en turquoise. Étiquette et bouton se teignent séparément (`badgeColor` vs `accentColor`) ; sur « À la
une », les deux sont marine.

Côté moteur, options facultatives employées par parent62 seul : `tileLayout: "inline"` sur `action-tiles`,
`design: "card"` sur `map-bubbles` et `featured-carousel`, `maxWidth` sur `gridLayout` et `articleTeaser`,
et `headlineStyle` (`badge`/`pill`) sur les quatre sections à pastille.
Le bouton du carrousel vit désormais dans un composant partagé (`FeaturedCarouselCta`) : en habillage
carte, c'est la SECTION qui le pose, à côté des points — sans quoi il défilerait avec le contenu.

### 9sextricies.1 Vérifications

| Gate | Résultat |
|---|---|
| Écran | ✅ 1 440, 768 et 390 px, clair et sombre, sans débordement. Étiquettes : « Vous êtes… » **10,98:1**, « Territoires » **5,68:1**, « À la une » **10,98:1**, « Zoom » **5,68:1** ; cases **7,56:1** et **13,04:1** ; carte « À la une » : texte sur le panneau vert **7,57:1** (bord foncé) à **9,95:1** (bord clair), en sombre, le dégradé fonce et son encre passe au blanc : **6,12:1** à **4,82:1** (l'encre noire y tombait à 3,43:1) ; bouton marine, texte **10,98:1**, forme contre le panneau **3,96:1** à **5,2:1** en clair, **1,79:1** à **2,28:1** en sombre ; points centrés au pixel (écart 0) à 1 440 comme à 390 px |
| `validate-config` · `audit:config` · `typecheck` · `lint` | ✅ 51 pages · 183 sections · RAS · 0 message sur les 17 fichiers du lot |
| `test:unit` (préflight compris) | ✅ **4 582 tests**, 3 échecs **étrangers au lot** : `bundle-size`, `site-assets`, `ProseContent — césure` |
| `test:integration` (`config-driven-ssr`, config parent62) | ✅ **99/99** |
| `test:e2e` complet | ✅ **35 passés**, 8 ignorés, 6 échecs étrangers (specs génériques contre `config.prod.json`, `auth-flow` sans `.env.test`) |
| `config:render` | ✅ parent62, institut-bleu, rezo-la-mer, saint-paul-sport |
| Alignement | ✅ bouton « En savoir + » dans le panneau, à 32 px de son bord bas, à 1 440 comme à 1 280 px ; les 3 bandes à **1 280 px**, calées au même bord |
| `test:e2e` ciblé | ✅ **19/19**, dont une garde sur l'accueil : les trois bandes partagent largeur et bord (**rouge sans la largeur posée sur « Zoom sur le réseau »**, 896 px contre 1 280), les deux panneaux verts ont même haut et même bas, et le bouton de l'actu est dans son panneau (**rouge sans le décalage haut** du panneau de l'actu) |

---

## 9septtricies. Upload d'image : image entière, recadrage facultatif

Tout visuel déposé dans un formulaire costum passait obligatoirement par un recadrage **au carré**. Sur
cinq formulaires parent62 — actualité, affiche, lieu ressource, événement, réunion — l'image déposée est
désormais **gardée entière**, sans modale. Un bouton **« Recadrer »** sous l'aperçu permet ensuite de la
cadrer au ratio 1:1 ; chaque recadrage repart de l'image d'origine, et « Utiliser l'image entière » y
revient sans la redéposer. L'aperçu montre l'image entière.

La photo d'**intervenant** garde le recadrage obligatoire : c'est un portrait, affiché dans un cadre fixe.

À l'envoi, une image de plus de 1 Mo est **allégée** : ramenée à 1 920 px de côté au plus, en qualité 0,85
— le réglage des images d'actualité. Une image plus légère part telle quelle.

| Image déposée | Envoyée |
|---|---|
| Photo JPEG 4 032×3 024, 6,7 Mo | 1 920×1 440, **0,46 Mo** |
| Affiche PNG A4 2 480×3 508, 6,5 Mo | 1 357×1 920, **1,27 Mo** |
| Photo WebP 3 024×4 032, 6,2 Mo | 1 440×1 920, **0,44 Mo** |
| JPEG 1 200×900, 0,47 Mo | inchangée |
| Photo enregistrée en PNG, 18,6 Mo | 1 357×1 920, **5,1 Mo** — le PNG est sans perte, seule la taille baisse |

Une image **déjà enregistrée** ne se recadre pas depuis le formulaire : servie par un autre domaine, elle
rend le canvas inexportable. Pour la recadrer, la redéposer.

C'est une option de config, `widgetProps.allowOriginal: true` sur le champ `profil_avatar` (doc/28),
**désactivée par défaut** : les autres sites gardent le recadrage obligatoire.

### 9septtricies.1 Vérifications

| Gate | Résultat |
|---|---|
| `test:unit` | ✅ **9 nouveaux tests**, chacun **rouge sous la régression qu'il garde** : image déposée entière sans modale ; « Recadrer » repart de l'original et « image entière » y revient ; champ remonté (original perdu) : « Recadrer » part de l'image en place, sans « image entière » ; recadrage obligatoire sans l'option ; allègement d'une image lourde, image légère et GIF épargnés, original gardé si la compression n'allège pas ou échoue |
| Compression en navigateur réel (canvas) | ✅ mesures du tableau ci-dessus, 0,3 à 1,4 s par image (le WebP est le plus lent) |
| `typecheck` · `lint` · `validate-config` · `audit:config` | ✅ RAS |
| `test:unit` (préflight compris) · `test:integration` (config parent62) | ✅ **4 591 tests**, 3 échecs **étrangers au lot** (`bundle-size`, `site-assets`, `ProseContent — césure`) · **99/99** |

---

## 9octotricies. Annuaire des partenaires et filtre « Villes » des actualités

### 9octotricies.1 Actualités : filtre par ville

La page `/blog` gagne un filtre **« Villes »** : les **33 villes** que la carte de l'accueil affiche au
survol des 9 territoires, avec recherche au clavier. « Entre Mer et Terres » affiche désormais les siennes
au survol, comme les autres territoires : Montreuil, Étaples, Berck, Hesdin, Fruges, Hucqueliers. Le
filtre porte sur un champ `villes` que le formulaire d'actualité saisit désormais (onglet
« Territoire, public & thèmes », facultatif), avec **la même liste et la même orthographe** : le filtre ne
propose que des valeurs que le formulaire sait enregistrer.

Les 6 438 actualités existantes n'ont pas de ville : le filtre ne ramène que les actualités saisies ou
retouchées depuis.

La recherche occupe désormais sa propre ligne et les quatre filtres (thèmes, publics, territoires,
villes) tiennent sur une rangée, à 1 280 comme à 1 440 px — le quatrième passait seul à la ligne.

`villes` est déclaré dans `costum.typeObj.article` de la base locale, sans liste rattachée : une liste
absente viderait les valeurs autorisées.

### 9octotricies.2 Annuaire des partenaires

| Élément | Contenu |
|---|---|
| Page `/annuaire` | bandeau et bouton **« Ajouter un partenaire »** ; filtres à gauche (territoire, type de structure, public, thèmes, recherche par nom) ; organisations rattachées à parent62 en cartes profil, fiche détaillée en fenêtre (territoires, publics, thèmes, e-mail, téléphone, site), vue carte colorée par territoire — composition d'institut-bleu et de `/temoignages` |
| Formulaire `parent62-partenaire` | organisation : nom, type de structure, logo (image entière), présentations courte et longue, territoires, publics, thèmes, e-mail, téléphone, site, adresse. Compte requis ; le déposant devient administrateur de la fiche |
| Modération | une fiche proposée reste en attente, hors de l'annuaire ; celle d'un administrateur du site est publiée directement — même mécanisme que l'agenda, donc filtre d'affichage et non garantie serveur (§9quattuortricies) |
| Admin | onglet « Partenaires » : liste, validation, modification, suppression, création |
| Menu | « Annuaire des partenaires » dans « Le Réseau parentalité » ; le panneau tient à 1 280 × 720, barre en haut comme collée |
| Édition | une organisation rattachée à parent62 s'édite par ce formulaire ; les autres gardent l'éditeur standard |

Types de structure → type d'organisation Communecter : Association → `NGO` ; Collectivité / service
public → `GovernmentOrganization` ; Établissement (crèche, école, centre social…) → `Group` ; Entreprise →
`LocalBusiness`. Hors parent62, Communecter affiche ces types sous ses propres libellés (« Groupe » pour un
établissement).

**La page « La communauté » (`/communaute`) est retirée**, avec son entrée du menu « Le Réseau
parentalité ». La case « Rejoindre le réseau » de `/pro` (« Structures et professionnel·les »), qui y
menait, mène désormais à l'annuaire. La recette de page `page-communaute-onglets` de la skill
`config-assistant` prend pour modèle la page identique d'eXtremeDefiAdeme.

Deux effets voulus hors de l'annuaire :
- `/recherche` masque aussi les fiches en attente (`costumSlug` posé sur sa liste) : une fiche proposée y
  serait sinon apparue avant validation. Le masquage est posé côté client parce que le backend ne le fait
  pas de façon déterministe (`src/modules/search/lib/validationGate.ts`).
- « Créer une organisation » depuis un profil ouvre le formulaire partenaire (règle du moteur : un site qui
  déclare un seul formulaire pour un type l'emploie partout) — une organisation créée sur le site passe
  donc par la même modération.

`territoires`, `publics` et `themes` des organisations sont déclarés dans `costum.typeObj.organizations`
de la base locale.

Aucune organisation n'est rattachée à parent62 à la livraison : l'annuaire se remplit par le formulaire.

### 9octotricies.3 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` · `typecheck` · `lint` | ✅ 51 pages · 183 sections · RAS (aucun lien mort après le retrait de `/communaute`) |
| `test:unit` (préflight compris) | ✅ **4 691 tests**, 3 échecs **étrangers au lot** : `bundle-size`, `site-assets`, `ProseContent — césure` |
| Garde `filter-form-values` (nouvelle) | ✅ sur toutes les configs ; **rouge** sur une ville mal orthographiée dans le filtre |
| `test:integration` (`config-driven-ssr`, config parent62) | ✅ **98/98** |
| `test:e2e` parent62 | ✅ **21/21**, dont 2 nouveaux, chacun **rouge sans sa correction** : `/annuaire` (filtre de type et masquage des fiches en attente), `/blog` (filtre « Villes ») |
| Écran | ✅ `/annuaire` à 1 440 px en clair et en sombre, à 390 px sans débordement ; `/blog` à 1 280 et 1 440 px ; bouton anonyme → fenêtre de connexion |
| Backend | ✅ le filtre `type` est appliqué (institut-bleu : 74 `LocalBusiness`, 0 `NGO`) ; `villes` part dans les filtres sans écraser `type: article` |
| Non vérifié | l'enregistrement réel d'une fiche partenaire et d'une actualité avec villes (pas de compte de test sur ce poste) |

---

## 9novotricies. Bandeaux de filtres : recherche en haut, ville des actualités tirée de l'adresse

Les **33 bandeaux de filtres** du site (actualités, ressources, agenda, appels à projets, offres d'emploi,
Mois de la Parentalité, `/theme` et ses 8 déclinaisons, les 9 pages `/public/*` et les 9 pages de
territoire) suivent la disposition de `/blog` : la recherche sur sa propre ligne, les filtres en une
rangée centrée dessous (`filtersClassName: "flex flex-col gap-3"`).

Le filtre par ville n'existe plus que sur `/blog`. `/ressources` perd son filtre « Commune »
(`address.addressLocality`, 11 villes) et garde type, territoires, publics et thèmes — l'exigence
« recherche par territoire / ville » des ressources (3.2) n'est donc plus couverte que pour le territoire.

Sur `/blog`, le filtre « Villes » porte désormais sur la **ville de l'adresse** (`address.addressLocality`)
et le formulaire d'actualité gagne un onglet **« Lieu »** avec un champ adresse facultatif (autocomplétion
des communes, même codec que le formulaire des paroles). Le champ `villes` du formulaire est retiré. Les
33 villes du filtre portent exactement le nom officiel que le champ adresse enregistre (vérifié une à une
contre la base des communes), le filtre retrouve donc toute actualité localisée dans l'une d'elles.

Accueil, carte **« À la une »** : la diapositive respire désormais autant sous le bord haut de son panneau
vert (32 px, contre 16) que la ligne points + bouton au-dessus de son bord bas. Les deux panneaux verts
(Territoires, À la une) restent au même niveau, haut et bas.

### 9novotricies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` | ✅ 51 pages · 183 sections · RAS |
| Préflight | ✅ hors les 2 échecs étrangers au lot (`bundle-size`, `site-assets`) |
| `test:integration` (`config-driven-ssr`, config parent62) | ✅ **98/98** |
| `test:e2e` parent62 | ✅ **21/21** |
| Accueil « À la une » | ✅ à 1 440 px : 32 px entre le bord haut du panneau et la diapositive, 32 px entre le bouton et le bord bas ; panneaux alignés |
| Écran | ✅ à 1 280 px, une seule rangée de filtres sous la recherche sur `/ressources`, `/agenda`, `/territoire/calaisis`, `/theme/la-sante`, `/public/parents`, `/appels-a-projets` |
| Backend | ✅ le filtre sur `address.addressLocality` est appliqué (paroles : 5 sans filtre, 1 avec « Saint-Denis », 0 avec « Arras ») |
| Non vérifié | l'enregistrement réel d'une actualité avec adresse (pas de compte de test sur ce poste) |

---

## 9quadragies. Fils d'actualités : deux lignes visibles sans défiler, réseau sans titres de carte

Demande : diminuer la place que prennent les articles pour qu'au moins deux rangées se lisent sans
défiler, sur l'ensemble des pages à fil d'actus — et retirer les intitulés des trois cartes « Les
membres du réseau » (`/reseau`), qui répétaient le contenu déjà lisible dans leur texte.

**Fils d'actualités** — nouvelle option moteur `articleFeed.density: "compact"` (opt-in, sans effet par
défaut ailleurs sur le parc), posée sur les **33 sections `articleFeed`** du site (`/blog`, `/theme` et ses
8 déclinaisons, les 9 pages `/public/*`, les 9 pages de territoire, Mois de la Parentalité, appels à
projets, offres d'emploi, Zoom sur le réseau, comptes rendus de réunion) :

- Grille à **2 colonnes dès le mobile** (au lieu d'1, comme le reste du parc) et **4 au maximum** à
  partir de `lg:` (plafond retenu après essai à 5 colonnes, jugées trop étroites).
- Carte `poster` (celle que porte parent62, `config.blog.defaultCardVariant`) : image ramenée du 3/4
  portrait historique à un cadre 3/2, nettement plus court. La carte `default` du moteur (16/9, non
  utilisée ici) suit le même principe à 5/2, pour rester cohérente si un autre site l'adopte un jour.
- `py-6`/`gap-6` du `Card` de base **retirés** en compact — c'était du vide autour du seul enfant de la
  carte (48 px perdus pour rien), pas un espacement entre plusieurs blocs.
- **Titre, date, temps de lecture, extrait et tags restent tous affichés**, ramenés à une ligne chacun :
  après plusieurs essais (masquer puis remettre ces informations), l'arbitrage retenu resserre la carte
  par la hauteur de l'image et par le vide de `Card`, jamais par la disparition d'une information.
- La carte « à la une » (la première du fil, en tête de page) garde son gabarit plein quel que soit
  `density` — seules les cartes du fil en dessous se resserrent.

**Réseau** — page `/reseau`, section `categories-grid` `reseau-membres` : les trois titres (« Parents et
groupes de parents », « Centres Sociaux et EVS », « Institutions et collectivités ») sont retirés ; les
cartes gardent leur icône et leur texte descriptif, `title` étant déjà optionnel dans le schéma.

### 9quadragies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` | ✅ 51 pages · 183 sections · RAS |
| `typecheck` · `lint` | ✅ 0 erreur |
| `test:unit` (préflight compris) | ✅ **5 028 tests**, 2 échecs **étrangers au lot** (`bundle-size`, `site-assets`) ; test de schéma ajouté sur `density` (accepté/rejeté) |
| `test:integration` (`config-driven-ssr`, config parent62) | ✅ **98/98** |
| `test:e2e` parent62 | ✅ **23/23**, dont une garde ajoutée (2 colonnes mobile, 4 en grand écran, `py-6` retiré, titre/tags toujours présents), **vérifiée rouge** sans `density` sur la section |
| Écran | ✅ 1 440, 768 et 390 px, clair et sombre, sans débordement horizontal ; 2 rangées entières visibles sur `/blog` dès le haut de la grille |
| Relecture | config resynchronisée avec `main` après une restauration de secours qui avait accidentellement fait régresser 3 points sans lien avec ce lot (texte du Mois de la Parentalité, texte des cartes « comptes rendus » sur les 9 pages de territoire, 2 liens de pied de page) — les trois retrouvent le texte/lien de `main`, seuls les changements de ce lot restent dans le diff |

---

## 9unquadragies. Couleurs fixes de l'équipe, filtre Villes sur l'agenda, loupe dans les actions du header

`/equipe` — les deux sections sans territoire (« L'animation départementale », « Le contact à la CAF »)
portent désormais une couleur de marque FIXE au lieu du neutre du thème (`couleursTerritoire` sans valeur
à résoudre) : vert `--p62-vert` (déjà utilisé par les cases « Vous êtes… », 7,56:1) pour l'animation
départementale, nouveau jaune-vert `--p62-caf` (`#d7d872`, 13,95:1) pour le contact CAF. Nouvelle option
moteur `card.fixedColors: { fond, encre, bordure? }` (`MemberCardConfSchema`) : prime sur `rattachement`
pour TOUTES les cartes de la section, quel que soit le territoire porté par chaque membre — la carte
« L'équipe de Coordonnateurs (trices) », qui garde ses couleurs de territoire, n'y touche pas.

`/agenda` — filtre « Villes » ajouté au `searchHeader`, même liste des 33 villes et même champ
(`address.addressLocality`) que `/blog` : le formulaire « Proposer un événement » collecte déjà une
adresse complète, aucune donnée à ajouter côté base. Le filtre rejoint le `PageFilters` partagé que
l'agenda lit déjà pour territoire/public/thème — aucun changement moteur, ajout de config pur.

En-tête — deux ajustements du header `stacked` (le seul à en avoir besoin, `main` n'en portait aucune
trace malgré une tentative antérieure abandonnée, cf. [[project-parent62-accueil-bande-unique]]) :

- **Menu centré** : la grille de la barre passe de `auto_1fr_auto` à `1fr_auto_1fr` — les deux colonnes
  de FLANC (logo, actions) sont désormais de MÊME largeur quel que soit leur contenu, donc le menu
  (colonne du milieu) se centre sur la barre entière, exactement sous le logo/titre du bandeau au-dessus.
  Avec `auto_1fr_auto`, le menu ne se centrait que dans l'espace restant après le logo, décalé vers la
  gauche dès que le groupe d'actions (plus large que le logo) l'emportait — systématique, mesuré à
  111px d'écart avant correction.
- **Loupe à la place de « Ctrl+K »** : nouvelle option moteur générique `nav[].placement: "actions"`
  (`EnhancedNavItemType`, header `stacked` uniquement) — sort une entrée du menu centré pour la poser
  dans le groupe d'actions de droite, en icône seule. Posée sur l'entrée « Recherche » existante, elle
  y remplace le déclencheur de palette de commandes (`CommandTriggerButton`, retiré de ce header). Le
  menu mobile garde la liste complète (pas de groupe d'actions séparé dans le tiroir).

### 9unquadragies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` · `audit:config` | ✅ 51 pages · 183 sections · RAS |
| `typecheck` · `lint` | ✅ 0 erreur |
| `test:unit` | ✅ **5 028 tests**, 2 échecs étrangers au lot |
| `test:integration` (`config-driven-ssr`, config parent62) | ✅ **98/98** |
| `test:e2e` parent62 | ✅ **25/25**, dont 3 nouvelles gardes (couleurs fixes équipe, filtre Villes agenda, menu centré + absence de « Ctrl+K »), chacune **vérifiée rouge** sans sa correction. 2 échecs **étrangers au lot** sur `/territoire/arrageois` et `/equipe` : le backend local a gagné un coordonnateur pour l'Arrageois depuis l'écriture de ces tests (donnée, pas code) |
| Écran | ✅ 1 280 px avec barre de défilement de 17px : aucun débordement (budget déjà tendu, cf. [[reference-header-stacked-budget-1280]]) ; 1 440 px : écart menu/logo 0px |
| Contraste | ✅ noir sur `--p62-vert` 7,56:1, noir sur `--p62-caf` 13,95:1 (AAA les deux) |


## 9duoquadragies. Accueil : « Vous êtes », Territoires et À la une en un seul panneau

**Demande** : un seul bloc pour « Vous êtes », Territoires et À la une, sur fond blanc ; Territoires plus
grand (3/4, À la une 1/4) et animé ; titre et image de l'actu cliquables ; boutons Parent/Pro assombris
avec un effet au survol ; aucune nouvelle section ; thème et couleurs conservés ; header inchangé.

**Config** (`pages[/]`) : la section `action-tiles` `home-double-entree` passe dans `gridLayout.topSection`
(plus que 2 sections de premier niveau : `gridLayout`, `articleTeaser`). La grille garde l'aplat
`page-accent` et porte un panneau blanc arrondi (`innerWrapperClass`) ; `leftColumns: 3`,
`rightColumns: 1`, `gap: 4`, `from: lg`. Tuiles : `density: "compact"`, `hoverEffect: "lift"`, Parent en
`--p62-vert-fonce` (jeton, `#0f6f5f`), Pro en `--p62-marine`, texte blanc, `headlineStyle: "text"` +
`tileLayout: "pillRow"` pour « Vous êtes » (titre en police manuscrite `--font-serif`/Patrick Hand, sans
pastille — un consommateur qui veut la police du menu l'ajoute lui-même, cf. `sectionBadge.ts`). Carte
Territoires : `headlineIcon: "map-pin"`/`headlineIconColor` (turquoise), `animate`. Carrousel « à la
une » : `linkTitleAndImage`, `badgeIcon: "megaphone"`/`badgeIconColor`, `ctaStyle: "link"` +
`ctaPosition: "inline"` (« Lire la suite » turquoise souligné, au lieu du bouton plein historique).

**Assets carte** (remplacés en cours de lot) : `carte-pdc.png` (silhouette blanche du territoire,
996×945) et `fond-degrade-territoire.png` (dégradé déjà cuit) posées via `backgroundImage` /
`illustrationBackgroundImage`, à la place de l'ancien webp + dégradé CSS (`carte-territoire-teal.webp`,
désormais mort, **supprimé**). La carte, quasi carrée, devenait bien trop haute une fois élargie à toute
la colonne — plafonnée en HAUTEUR (pas largeur) via le nouveau couple opt-in
`illustrationMaxHeight: "80vh"` + `illustrationAspectRatio: "996/945"` (ratio exact du fichier, sans
quoi l'image serait étirée) : la largeur suit, aucun pixel n'est rogné, les bulles (positionnées en %
de cette boîte) restent alignées sur leur territoire.

**Animation** : les bulles respirent en boucle via un nouveau `blink-scale` (scale seul) — remplace
`pulse-glow` (scale + opacité), qui délavait leur couleur de marque à chaque cycle.

**Deux bugs trouvés et corrigés pendant la vérification** (ni l'un ni l'autre demandés explicitement,
découverts en mesurant l'espace vide sous la carte « à la une ») :
1. L'ombre de la carte à la une (`shadow-lg`) était rognée sur 3 côtés par le viewport du carrousel
   shadcn (`CarouselContent`, `overflow-hidden`) — corrigé par un wrapper `p-2` qui réserve la marge où
   l'ombre se dessine.
2. Le pied du carrousel (points + bouton) portait un `mt-auto`, qui absorbe tout l'espace libre AVANT
   que le `justify-center` du conteneur ne puisse agir — la carte restait donc collée en haut, et tout
   le vide s'accumulait entre elle et les points au lieu de se répartir. Remplacé par une marge fixe
   (`mt-4`) : carte et pied forment désormais un seul bloc, centré verticalement dans la colonne.

**Moteur** (options opt-in, défaut sans effet — documentées dans `doc/05-schemas-sections.md` et
`scripts/lib/prop-descriptions.ts`) : `gridLayout.topSection`/`innerWrapperClass` (aucune boîte ajoutée
sans eux), `action-tiles.hoverEffect`/`density`/`tileLayout: "pillRow"`, `map-bubbles.animate`/
`headlineIcon`/`headlineIconColor`/`illustrationBackgroundImage`/`illustrationMaxHeight`/
`illustrationAspectRatio`, `featured-carousel.linkTitleAndImage`/`badgeIcon`/`badgeIconColor`/
`ctaStyle`/`ctaPosition`. `headlineStyle: "text"` (sans fond ni rotation) ajouté aux trois sections
(`action-tiles`, `map-bubbles`, `featured-carousel`). Le pied du carrousel en habillage `card` passe sur
une ligne selon la largeur du carrousel (container query) et non plus de l'écran : sans cela le bouton
débordait de la colonne 1/4 — seul parent62 emploie cet habillage. Vérifié qu'aucun autre site du parc
(7 configs posent `action-tiles`, aucune `map-bubbles`/`featured-carousel` hors parent62) ne déclare ces
props : tous restent sur le rendu historique. Recette `home-a-la-une` de la skill `config-assistant`
resynchronisée.

**Limite** : le bandeau du header `stacked` restant inchangé (choix explicite), la bande (« Vous
êtes » + Territoires/À la une) ne tient pas encore entièrement au-dessus de la ligne de flottaison une
fois la barre repliée (sticky, 56 px) à 1 440×900 — le plafond de hauteur de la carte a réduit le
dépassement mesuré d'environ 279 px à environ 97 px, sans l'éliminer. Aller plus loin demanderait soit
de recadrer l'image (perte de pixels réels de la silhouette du territoire), soit de resserrer les % x/y
des 9 bulles — ce que le code interdit explicitement en commentaire (« positions calibrées à la main,
ne pas les retoucher pour compenser », décision déjà actée en §9quater (cf. aussi [[project-parent62-accueil-bande-unique]]).
Ni l'un ni l'autre n'a été fait : la marge résiduelle reste en l'état.

### 9duoquadragies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ 51 pages · 182 sections |
| `audit:config` (parent62) | ✅ RAS (0 traduction manquante, 0 lien mort, 0 clé morte) |
| `typecheck` · `lint` | ✅ 0 erreur (warnings React Compiler préexistants, étrangers au lot) |
| `test:unit` | ✅ **5 476/5 477** — seul échec `bundle-size` (`dist/` non reconstruit depuis la veille), étranger au lot |
| `test:integration` (`config-driven-ssr`) | 🟡 **861/863** — 2 échecs dus à `.env` local (`VITE_SLUG=parent62` actif) : le serveur de test rend parent62 au lieu du config de démo attendu par ces 2 assertions (titre/footer) — artefact d'environnement local, étranger au lot et à `.env` lui-même (gitignoré, propriété de l'utilisateur, non modifié) |
| `test:e2e` parent62 | ✅ **25 passés**, dont la garde « Vous êtes + Territoires/À la une forment UNE bande ». 2 échecs **étrangers au lot** (`/territoire/arrageois`, `/equipe`, données du backend local) — identiques sans les modifications |
| Écran | ✅ 1 024 / 1 280 / 1 366 / 1 920 px, 768 px et 375 px, clair et sombre : plus de chevauchement étiquette/tuiles, lien de l'actu dans sa carte, 9 bulles de territoire visibles sans rognage |
| Contraste | ✅ blanc sur `--p62-vert-fonce` 6,07:1 (AA), blanc sur `--p62-marine` 10,98:1 |

---

## 9tresquadragies. Fils d'actualités : pagination numérotée (12/page) au lieu du scroll infini

Les 33 fils `articleFeed` du site (`/blog`, thèmes, territoires, appels à projets, offres d'emploi,
zoomcat…) affichaient un bouton « Charger plus »/scroll infini. Passage à une pagination numérotée
classique, posée **une seule fois** au niveau site (`config.blog.defaultPagination: "pages"`), et non
répétée sur chaque section — nouvelle option moteur `config.blog.defaultPagination` /
`articleFeed.pagination` (`"infinite"` | `"pages"`, `ArticleFeedSectionSchema`/`BlogConfigSchema`),
défaut ABSENT → `"infinite"` (comportement historique, opt-in, aucun autre site n'est affecté). Le
widget mono-article `champs-laep-actu` (`pageSize:1`, aperçu d'une actu précise) garde explicitement
`"infinite"` — paginer un item unique n'a pas de sens.

Le backend ne pagine QUE par curseur (`page.next()` du SDK) : un `indexMin` manuel est ignoré (déjà
sondé/documenté dans `buildSearchPayload`, chemin carte). `usePagedFeedNav` (`modules/blog/hooks/
useArticleFeed.ts`) en tient compte : les pages déjà visitées sont en cache React Query (retour
instantané), la seule page « neuve » atteignable est la suivante immédiate (un clic dessus déclenche
exactement un `fetchNextPage()`, jamais de saut ni de chaîne de fetch). La « une » (`featured`) reste
résolue sur la page 1 quelle que soit la page affichée, dédupliquée de chaque page par id. La
pagination revient à la page 1 dès que le périmètre filtré de la page change (`searchHeader`/
`heroSearch` partagé, ex. filtre Villes de `/blog`). UI : composant shadcn `Pagination`
(`components/ui/pagination.tsx`), jusque-là jamais consommé dans le parc.

### 9tresquadragies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ 51 pages · 182 sections |
| `typecheck` · `lint` (module blog) | ✅ 0 erreur |
| `test:unit` (module blog) | ✅ 60/60 (10 fichiers), dont 5 tests du hook `usePagedFeedNav` |
| `test:e2e` parent62 | ✅ 26 passés, 1 ignoré ; 2 échecs **étrangers au lot** déjà connus (`/territoire/arrageois`, `/equipe`, données du backend local) |
| Mobile 375 px (`/blog`, barre présente) | ✅ aucun débordement horizontal (document 367 px pour un viewport de 375 px) |
| Autres pages `articleFeed` | non re-testées une à une (33 sections) : même composant et même hook, seule la config (`defaultPagination`, au niveau site) change |

### 9tresquadragies.2 Troncature des boutons de page (06/10) et bug « Previous »/« Next » anglais trouvé en relisant

Au-delà d'une trentaine de pages visitées (navigation séquentielle page après page — le curseur
backend interdit tout saut, cf. ci-dessus), la rangée de boutons `1 2 3 … N` passait à la ligne.
Nouveau helper pur testé `buildPageRange` (`modules/blog/lib/paginationRange.ts`) qui tronque en
`1 … 30 31 32 33 34` dès que l'affichage complet déborderait (seuil : 7 boutons visibles, au-delà
duquel masquer 1 seule page par une ellipse ne ferait pas gagner de place). Branché dans
`ArticleFeed.tsx` via `PaginationEllipsis`, déjà présent dans `components/ui/pagination.tsx` mais
jamais consommé. Vérifié en direct (Playwright, 34 pages atteintes) : une seule ligne en desktop ;
sur mobile 390 px, léger retour à la ligne du seul bouton « Suivant » au-delà d'une vingtaine de
pages — net progrès par rapport à l'avant (plusieurs lignes de boutons).

**Bug trouvé en relisant les captures de cette vérification** : les boutons affichaient « Previous »/
« Next » en ANGLAIS malgré les `t("feed.previous")`/`t("feed.next")` posés dans `ArticleFeed.tsx`.
Cause : `PaginationPrevious`/`PaginationNext` (`components/ui/pagination.tsx`) spreadaient
`{...props}` (qui contient `children`) PUIS redéfinissaient leurs propres enfants JSX
(`<ChevronLeftIcon /><span>Previous</span>`) — en JSX, les enfants explicites entre les balises
gagnent TOUJOURS sur un `children` venu d'un spread, quel que soit l'ordre des attributs. Le texte
traduit était donc silencieusement écrasé par le texte anglais câblé en dur. Corrigé en
destructurant `children` à part et en l'utilisant en repli (`children ?? "Previous"`) — comportement
inchangé pour tout appelant qui n'en passe pas. `PaginationEllipsis` porte le même texte anglais
câblé en dur (« More pages », `sr-only`) mais son conteneur est `aria-hidden` : inatteignable par un
lecteur d'écran, donc pas un bug vivant, non touché.

**2ᵉ bug trouvé en relisant, cette fois sur l'annonce d'accessibilité elle-même** (08/10) : le statut
`role="status"` posé à côté de la pagination disait « Page X sur `nav.pageCount` », qui n'est QUE le
nombre de pages navigables MAINTENANT (visitées + la suivante immédiate) — pas le nombre réel de
pages du fil, qui continue de grandir à chaque clic sur « Suivant ». Un lecteur d'écran aurait donc
entendu « Page 1 sur 2 » sur un fil de 6 434 articles (537 pages réelles). `useArticleFeed` expose
déjà `totalCount`/`hasCount` (compte RÉEL renvoyé par le backend, `count.total`, pas toujours présent
selon la recherche) — désormais utilisé pour l'annonce (`Math.ceil(totalCount / pageSize)`) quand
disponible, repli sur `nav.pageCount` sinon. `nav.pageCount` lui-même n'est PAS touché : il reste la
seule source de vérité pour les boutons et leurs bornes (`goToPage`). Vérifié en direct sur `/blog` :
« Page 1 sur 537 ».

| Gate | Résultat |
|---|---|
| `typecheck` · `lint` | ✅ 0 erreur |
| `test:unit` (`paginationRange.test.ts`) | ✅ 6/6, nouveau helper pur testé |
| Vérifié en direct (34 pages) | ✅ `Previous 1 … 30 31 32 33 34 Next` → `Précédent 1 … 30 31 32 33 34 Suivant`, une ligne en desktop |
| Mobile 390 px | 🟡 léger retour à la ligne du bouton « Suivant » seul au-delà d'une vingtaine de pages — net progrès, non retouché davantage |
| Sombre | ✅ vérifié, contrastes corrects |
| Annonce `role="status"` | ✅ vérifiée en direct sur `/blog` (6 434 articles) : « Page 1 sur 537 » (total réel), plus « Page 1 sur 2 » (pages navigables) |
| Dernière page dans la troncature | ✅ vérifiée en direct sur `/appels-a-projets` (8 pages) : absente tant que non atteinte, puis `1 2 3 4 5 … 8 Suivant` une fois chargée (même en revenant sur la page 1) — propriété émergente de `nav.pageCount`, testée (`paginationRange.test.ts`) |

## 9quattuorquadragies. Paroles de parents : image entière et carte par défaut ; profils en pleine largeur

**Demande** : l'image d'une parole ne doit plus être rognée en bandeau ; la carte doit s'afficher à l'ouverture de `/temoignages` ; les pages profil doivent occuper toute la largeur.

**Image entière (opt-in)** — `list.testimonial.imageFit` (`"cover"` défaut, `"contain"`). En `contain`, la carte et l'aperçu affichent l'image entière, centrée, sur un fond flou tiré de la même image (même idiome que les affiches du blog). En `cover`, le rendu historique (bannière 16/9 ou 21/9 rognée) est inchangé. Activé sur les deux listes de cartes de `/temoignages` (pages 12 et 45 de la config) ; la palette de commandes n'est pas concernée. Commits : `747759a0` (carte, configuration) puis `13f7d52d` (aperçu, version opt-in ; une version sans option écrite sur disque hors de nos éditions a été remplacée).

**Carte par défaut** (`747759a0`) — `defaultViewMode: "map"` sur la section `paroles-list` : la vue split (liste + carte) s'ouvre sans clic ; le bouton « Voir en liste » reste disponible.

**Profils en pleine largeur** — `profiles.<type>.layout: "full-width"` sur les six types (`default`, `citoyens`, `organizations`, `projects`, `events`, `poi`), au lieu de `"default"` (plafond `max-w-7xl`, soit 1280 px contre 1432 px sur le reste du site). Configuration seule, aucune ligne de code.

**Vérifications (mesurées)**
| Gate | Résultat |
|---|---|
| Carte témoignage (`CardTestimonialBubble.test.tsx`) | ✅ 2/2 : `cover` par défaut, `contain` sans ratio forcé |
| Aperçu témoignage (`PreviewTestimonialBubble.test.tsx`) | ✅ 2/2 |
| Typecheck · lint (fichiers touchés) | ✅ 0 erreur |
| Profil : largeur du `main` | ✅ 1432 px à 1440 px de viewport (1280 px avant) ; débordement horizontal à 390 px : aucun (document 382 px) |
| `/temoignages` : carte ouverte à l'arrivée | ✅ vérifié à la capture (viewport 1440 px) ; mobile 390 px : carte présente, aucun débordement |


## 9quinquadragies. SDK 1.0.196 : rôles de membre modifiables, export PDF de l'agenda via le SDK

**Contexte** : le SDK publié le jour même (`@communecter/cocolight-api-client@1.0.196`) livre exactement
ce que décrivaient `Document de spécification — Rôles de membre sur les liens` et `Document de
spécification — Endpoint SDK PDF imprimable agenda` : `User.setRoles(roles)` (endpoint `LINK_SET_ROLES`,
remplacement intégral), `sendRequestToJoinParent({ admin, roles })`, et `endpointApi.agendaGetPdf(data)`
(réponse binaire `arraybuffer`, gérée nativement par `ApiClient.callEndpoint`). Mise à jour :
`cocolight-api-client` (dépôt local, fast-forward sur `origin/master`) puis `site-json` (`package.json`/lock,
`^1.0.196`), les deux reconstruits/revalidés (`npm run build` du SDK, `npm run typecheck` de site-json).

**Gérer les rôles d'un membre déjà lié** — nouveau dialogue `ManageRolesDialog` (`TagsInput`, pré-rempli
via `rolesDuMembre`, déjà en place), mutation `useSetMemberRoles` (`{user, roles}`, hors factory
`createUserMutation` qui ne porte qu'un `User`). Action « Gérer les rôles » ajoutée à
`useAdminActions`/`buildManageRolesAction` sur tout membre DÉJÀ lié (admin/membre/contributeur/
participant) — **opt-in via un callback** (`onManageRoles`, fourni par `MemberListRenderer` seul) :
`InviteMemberDialog`, qui réutilise le même hook, n'affiche pas cette action, conformément à la demande
initiale.

**Poser des rôles à l'invitation « users »** (recherche, pas par e-mail — l'onglet « emails » les avait
déjà) : un champ `TagsInput` au-dessus des résultats, appliqué par le nouveau hook
`useInviteMemberWithRoles` (`{user, roles, admin}`) — seuls les boutons d'invitation (`invite-member`/
`invite-admin`/…) y passent, les actions sur un membre déjà lié (promote/demote/remove/gérer les rôles)
gardent leur `onClick` d'origine.

**Suggestions de rôles existants** — les trois champs de rôles (« Gérer les rôles », invitation
« users », invitation « emails ») proposent désormais en autocomplétion locale (`TagsInput.suggestions`)
les rôles déjà posés sur un membre de l'entité, via le nouveau helper pur `rolesExistantsDeLEntite`
(testé, `memberRoles.test.ts`) — dérivé de `entity.serverData.links`, déjà chargé : aucun appel réseau
supplémentaire, le backend n'exposant toujours pas d'endpoint de suggestions au SDK. La saisie libre
reste possible.

**⚠️ Limite connue, non corrigée (hors périmètre SDK/site-json)** : `Costumize::connectElement`
(backend PHP, `Document de spécification — Rôles attribués au mauvais membre`) écrit encore le rôle sur
le lien de l'ADMIN qui invite, pas sur celui de l'invité, pour toute invitation **CRÉANT** un lien neuf
(chemin `CONNECT`) sur un costum routé par `Costumize` — le cas de parent62. Ce bug est **indépendant**
du lot ci-dessus : **« Gérer les rôles »** passe par `removerole`/`Link::removeRole`, jamais par
`Costumize::connectElement` — non affecté. Seul « poser un rôle à l'invitation » (onglets « users » et
« emails ») en hérite. Non re-testé en conditions réelles (pas de session admin dans cette session) :
à vérifier au premier usage réel.

**Export PDF de l'agenda** — nouvelle prop opt-in `agenda.showPdfExport` (défaut `false`), hook
`useAgendaPdfExport` (`endpointApi.agendaGetPdf`, scope le costum PORTEUR entier via
`getSiteCostumContext({contextId, contextType})` — jamais les filtres de la vue). Téléchargement par
`Blob` + `<a download>` transitoire (aucun pattern de blob-download réutilisable trouvé — `downloadCsv.ts`
est CSV-only, non généralisé pour un seul 2ᵉ usage). **Non activé sur `/agenda`** : la prop reste à son
défaut `false`, conformément à la convention moteur (nouveauté = option, jamais un nouveau défaut pour
un site en marche) — vérifié en direct dans cette session avec l'option forcée à `true`, qui a ensuite
été retirée du config.

### 9quinquadragies.1 Vérifications

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ 51 pages · 182 sections |
| `typecheck` · `lint` (fichiers touchés) | ✅ 0 erreur |
| `test:unit` | ✅ suite complète (5528/5531, 2 échecs non liés à ce lot — snapshot archétype `agenda` resynchronisé, budget `bundle-size` pré-existant) ; `rolesExistantsDeLEntite` testé (9 cas, `memberRoles.test.ts`) — les mutations elles-mêmes restent sans test (React Query + mock SDK absents de ce module), le PDF n'a pas de test automatisé non plus |
| Export PDF | ✅ **vérifié en direct, vrai navigateur (Playwright/Chromium), contre le backend réel** : clic → requête `AGENDA_GET_PDF` → fichier `agenda-parent62.pdf` de 150 519 octets, magic header `%PDF-` confirmé. Le blocage CORS documenté dans la spec est bien levé |
| Mobile 390 px / sombre (`/agenda`) | ✅ bouton PDF en icône seule, aucun débordement horizontal, lisible en sombre |
| Gestion des rôles | 🟡 **non vérifiée en conditions réelles** — aucune session admin disponible dans cette session ; typecheck/lint seuls |

## 9sexquadragies. Footer : « Appels à projets »/« Offres d'emploi » retirés

Sur demande, les deux liens retirés de `footer.columns[0].links` (`config.prod.parent62.json`). Le
lien « Archives » a disparu de la même colonne pendant ce lot (édition concurrente côté config, hors
de ce que ce lot a produit) — confirmé volontaire, laissé tel quel. La page `/archives` elle-même
n'est pas supprimée, seulement son lien de footer.

| Gate | Résultat |
|---|---|
| `validate-config` | ✅ 51 pages · 182 sections |

## 9septquadragies. Annuaire des acteurs du soutien à la parentalité, formulaire d'édition dédié, correctif admin INFORESO/Ressources

**Annuaire des acteurs** — nouvelle page `/annuaire-acteurs-parentalite` (entrée de menu dans « Le Réseau
parentalité »), distincte de `/annuaire` (partenaires référencés via formulaire public) : affiche les 38
organisations importées (`source.key:"youthCare"`, `reference.costum` contient `parent62`), vue **carte par
défaut**, carte `image-cover`/`imageFit:"contain"` (même design que MSS/tiers-lieux), preview `facets`
générique (`preview.type:"facets"`, zéro code) sur les VRAIS noms de champs observés en base — `categoryThematic`,
`typeAction`, `publicCible`, `email`, `telephone`, `url` — et non les champs `territoires`/`publics`/`themes` du
formulaire partenaire, qui n'existent sur AUCUNE de ces 38 fiches.

**Page profil** — le bloc « À propos » d'une organisation (`profile-parent62-about`, remplace `profile-about-ssbe`
qui affichait les champs SSBE vides sur parent62) montre désormais TOUS les attributs du formulaire non couverts
par `profile-info`/`profile-opening-hours` : catégorie thématique, type d'action, **public cible**, réseaux sociaux
(liens cliquables), accès/stationnement, mise à disposition de ressources, interlocuteur privilégié, remarques, et
les documents attachés (même source que `profile-documents`/`getGalleryFiles`, rendus en carte à côté de
l'interlocuteur plutôt qu'en section séparée). Bandeaux dégradés `var(--primary)`/`var(--accent)` du thème
parent62 (pas `--card-header-gradient`, token bespoke absent de ce site). `profile-opening-hours` déplacé en
colonne de droite, à côté des coordonnées.

**Formulaire d'édition** — nouveau costumForm `parent62-acteur` (édition complète des 38 fiches depuis la page
profil), construit à 100 % sur des codecs déjà partagés (zéro code) : `address:read/write`, `telephone:read/write`
(groupe `_telSlot`/`_telRest`, déjà prouvé sur SSBE/cyber-reunion), `social:read/write` (widget `fieldArray`),
widget natif `openingHours`, widget `file` pour les documents (`contentKey:"file"`, même bucket que la section
profil générique). Routé via `profiles.organizations.editModals` : route `edit-parent62-acteur` AJOUTÉE AVANT
`edit-parent62-partenaire`, condition `sourceKeys contient "youthCare"` — seules les 38 fiches importées basculent
sur ce formulaire, `parent62-partenaire` reste inchangé pour les soumissions via `/annuaire`.

**Correctif admin — colonnes custom invisibles (INFORESO, Ressources)** — bug trouvé en vérifiant le signalement
« la colonne Année ne s'affiche pas » sur `/admin` → onglet INFORESO : une section admin `type:"resource"` SANS
`status` ni action `validate` passe en « mode public » (`AdminResourceTable.tsx`), qui projette UNIQUEMENT
`["source","reference"]` + `source.defaultFields` — tout champ costum hors de ce socle (ex. `annee`) est strippé
par le backend, en silence ; seuls les champs du socle légacy (`name`, `created`…) survivent, ce qui masquait le
bug (les autres colonnes affichaient bien leurs valeurs). **Même bug trouvé sur l'onglet « Ressources »**
(colonne « Type » / champ `category`). Correctif : `source.defaultFields:["annee"]` / `["category"]` sur les deux
sections — mécanisme déjà prévu par le code, juste non utilisé. **Piège réutilisable** pour toute future section
admin `resource` sans validation qui affiche un champ costum hors du socle légacy.

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` | ✅ |
| `config:validate` | ✅ 52 pages · 183 sections |
| `audit:config` | ✅ RAS |
| `config:render` | ✅ 52/52 pages, 183/183 sections avec contenu SSR |
| `test:unit` (suite complète) | ✅ 5 825/5 828 passés, 1 skip — 2 échecs **pré-existants et sans rapport** (`bundle-size`, dette connue) |
| `tests/preflight/costum-forms.test.ts` | ✅ 73/73 — toutes les clés de codec du nouveau form résolues |
| `tests/preflight/archetypes.test.ts` | ✅ (resynchronisé : `examples/admin.json` avait dérivé du correctif `defaultFields`) |

### 9septquadragies.2 Documents attachés, hors `about.files`

Une image/un dépliant d'une fiche peut être rattaché via `contentKey` plutôt que dans `about.files` (ex.
`"presentation"`, cf. §9septquadragies.5) : visible sur la page profil (`ProfileParent62About`, lecture
directe de `serverData.images`), et depuis le 14/10 également éditable dans le formulaire via le champ
`galeriePresentation` (§9septquadragies.6).

### 9septquadragies.3 `typeObj` de l'acteur — sous-type costum dédié

Un sous-type costum **séparé** `costum.typeObj.acteur` (`sameAs:"organizations"`) porte les 8 champs
spécifiques (`categoryThematic`/`typeAction`/`publicCible`/`accessibility`/`provisionResources`/`contact`/
`note`/`socialNetwork`) — pas fusionné dans le typeObj `organizations` existant des Partenaires. En
édition, le SDK choisit le sous-type via `serverData.type` (seul levier, `BaseEntity.ts`) : `type` est
donc le **discriminant pur** de ce sous-type (`"acteur"`) sur les fiches acteurs, et ne porte plus la
nature juridique de structure (NGO/Collectivité/Établissement/Entreprise) comme sur `parent62-partenaire`
— le sélecteur « Type de structure » est donc absent du formulaire `parent62-acteur` et de son affichage.


### 9septquadragies.5 Images « presentation »

`contentKey:"presentation"` (collection `documents`, séparée de `organizations` — assemblée à la lecture
par le backend, jointe par `{type:"organizations", id:<_id>}`) : affichées sur la fiche profil publique
(`toPresentationDocs`/`ProfileParent62About.tsx`, lit `serverData.images` directement, code
site-spécifique sans dépendance moteur) et éditables depuis le formulaire via `galeriePresentation`
(§9septquadragies.6). Pour tout nouvel ajout (image ou document), le champ « Documents » du formulaire
accepte déjà les images (`widgetProps.accept` élargi, config seule).

### 9septquadragies.6 Galerie « Images de présentation » + différenciation `/annuaire` vs `/annuaire-acteurs-parentalite`

**Galerie en édition** (zéro moteur) : champ `galeriePresentation` (`widget:"gallery"`,
`contentKey:"presentation"`, `renderOnly:true`) sur `parent62-acteur` — même mécanisme que
`parent62-article` (`contentKey:"slider"`) et d'autres sites (tiers-lieux, institut-bleu, saint-paul-sport,
federationDesCae).

**Différenciation des deux annuaires** — `/annuaire` (Partenaires) et `/annuaire-acteurs-parentalite`
(Acteurs) sont distingués par un tag, **jamais** par `type` ou `source.key` (tous deux non fiables sur les
fiches importées et/ou dépendants d'une donnée de lot de test) :
- `/annuaire` : `baseParams.defaultTags:["Partenaires"]`. Tag posé par `mutation.stamps` sur
  `parent62-partenaire` (`{field:"tags", value:"Partenaires", op:"append", on:"both"}` — moteur déjà
  partagé, cf. tiers-lieux `mainTag`/`compagnon`), réaffirmé à CHAQUE sauvegarde (create ET edit).
  `defaultTags` est un scope de base invisible (même mécanisme que le bandeau « À la une » de l'accueil),
  pas un filtre interactif retirable.
- `/annuaire-acteurs-parentalite` : `defaultFilters:{"tags":{"$nin":["Partenaires"]}}` — Acteur = défaut
  (absence du tag).
- Seul « DEMAIN » existe comme Partenaire en base locale (fiche visiblement de test) — pas retaguée
  automatiquement, à trancher avec l'équipe lors d'une vraie soumission.

`/recherche` (cible « Structures & partenaires ») reste volontairement sans filtre dédié (confirmé avec
l'équipe).

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` | ✅ |
| `stamps.test.ts` (moteur partagé, non modifié) | ✅ 20/20 |
| `config:validate` / `audit:config` | ✅ 52 pages · 183 sections / RAS |

### 9septquadragies.7 Deux correctifs trouvés en relecture avant merge

- **`email` optionnel rejeté à la création** (`ApiValidationError … /email must be a valid email address`,
  reproduit sur « Ajouter un partenaire ») : le schéma AJV `ADD_ORGANIZATION` (`common3`, côté SDK) exige
  `format:"email"` SANS passe-droit pour `""`, contrairement à `url`/`tags` qui en ont un. `email` sur
  `parent62-partenaire`/`parent62-acteur` est optionnel et sans codec `write` : laissé vide, le pipeline
  générique émettait `email:""`, rejeté par l'AJV. Isolé en rejouant le schéma réel du SDK
  (`cocolight-api-client/src/endpoints.module.ts`) avec Ajv en local, hors navigateur. **Correctif**,
  config seule, déjà en usage (`rezo-sante-acteur`/`rezo-sante-lieu`) : `"write": "omitEmpty"` sur les deux
  champs `email` — omet la clé plutôt que d'envoyer `""`.
- **« Ajouter une organisation » depuis un profil citoyen ouvrait le formulaire Communecter générique**,
  pas `parent62-partenaire` : deux `costumForms` d'`entityType:"organizations"` existent désormais
  (`parent62-partenaire` et `parent62-acteur`, §9septquadragies.3), et le résolveur
  (`siteCostumAddModal`/`costumCreateKey`, `addModals.ts`) rend `null` dès qu'il y a plusieurs candidats
  pour une collection — « on ne choisit pas à la place du site » — donc `profiles.citoyens.addConfig.
  organization:true` retombait sur `add-organization`. Un parent référençant sa structure depuis son
  profil la créait donc sans `categoryThematic`/tag `Partenaires`/scope `parent62` — invisible dans les
  deux annuaires. **Correctif**, config seule, patron déjà utilisé par `institut-bleu` (2 formulaires
  `poi` pour la même raison) : `organization:false` + une entrée `addConfig.custom` ciblant explicitement
  `modalKey:"add-parent62-partenaire"` (label, icône `handshake`, `condition:{auth:"required",
  userContext:"own"}`). Fixture de garde `tests/preflight/__effective__/parent62.json` régénérée
  (`vitest -u`) : `addMenus.citoyens.builtins.organization` disparaît, `customs:["add-parent62-
  partenaire"]` apparaît.

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` | ✅ |
| `config:validate` / `audit:config` | ✅ 52 pages · 183 sections / RAS |
| `tests/preflight/` (hors `bundle-size.test.ts`, échec préexistant sans rapport) | ✅ 822/823 |
| `stamps.test.ts` (sentinelle d'inventaire, mise à jour : `parent62/parent62-partenaire:1`) | ✅ |

### 9septquadragies.8 Routage d'édition par tag, indépendant de `source.key`

Le réimport à venir des organisations acteurs posera `source.key:"parent62"` (fin de l'usage de
`"youthCare"`, clé de lot de test). `profiles.organizations.editModals` route donc sur le tag, pas sur une
clé de source :
- `edit-parent62-acteur` : `NOT(tags contains "Partenaires") AND (scope parent62)`.
- `edit-parent62-partenaire` : `scope parent62` (catch-all — implicitement les fiches taguées, puisque
  l'acteur prend tout le reste en premier).

Vue matchable (`entityMatchData`, `src/lib/entityMatch.ts`) expose déjà `tags` normalisé — aucun
changement moteur nécessaire.

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` | ✅ |
| `config:validate` / `audit:config` | ✅ 52 pages · 183 sections / RAS |
| `tests/preflight/` (hors `bundle-size.test.ts`) | ✅ 822/823 |

### 9septquadragies.9 Correctifs trouvés en relecture (annuaires, fiche profil, réseaux sociaux, header)

- **Périmètre des deux annuaires** : confirmé côté backend (`SearchNew::getQueries`,
  `communecter-dev`) que `$post["filters"]` est injecté dans `$query` AVANT `searchSourceKey`, qui
  l'englobe ensuite dans un `$and` avec le `$or` dérivé du scope — le tag `"Partenaires"` (§9septquadragies.6)
  filtre donc réellement les résultats côté serveur, pas seulement à l'affichage.
- **Bloc « À propos » ne lisait que les champs du formulaire Acteur** : un Partenaire référencé via
  `/annuaire` (champs `territoires`/`publics`/`themes`) ouvrait une fiche à cartes vides, sa saisie
  n'apparaissant nulle part. Corrigé : le composant lit désormais le même tag `"Partenaires"` que le
  routage d'édition et l'annuaire pour choisir le jeu de champs à afficher.
- **Réseaux sociaux** : ne lisait que la forme imbriquée (`serverData.socialNetwork.*`), alors que les
  organisations importées/« normales » les stockent à PLAT (`serverData.facebook`) — même distinction déjà
  gérée par `ProfileTiersLieuxInfo.tsx`. Corrigé (lecture plate en priorité, repli sur l'imbriquée,
  extrait en module testé `profileParent62Social.ts`) ; le rendu passe désormais par `SocialLinks`
  (`footer/SocialLinks.tsx`, déjà partagé) via `NavLink`/`classifyHref`, au lieu d'un `<a href>` qui
  préfixait `https://` même sur un identifiant sans URL (`@parent62` → `https://@parent62`).
- **i18n** : la fiche était en français en dur (même choix que `ProfileSsbeAbout`) alors que la preview
  de l'annuaire est bilingue. Ajout du namespace `ProfileParent62About` (`fr.json`/`en.json`) et bascule
  sur `useT`.
- **HeaderStacked (moteur, hors parent62)** : le conteneur du logo (`sm:h-auto sm:w-auto sm:aspect-square`,
  hors flux) retombe à 0×0 dès `sm:` si ni `logoTitle` ni `logoSubtitle` n'est déclaré — rien d'autre dans
  la rangée grid pour la dimensionner. Parent62 (seul site sur ce header) déclare les deux, donc non
  visible ici ; plancher `sm:min-h-11 sm:min-w-11` ajouté par prudence pour tout futur site qui adopterait
  ce header sans les deux textes.

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` | ✅ |
| `profileParent62Social.test.ts` (nouveau) | ✅ 6/6 |
| `tests/preflight/` (hors `bundle-size.test.ts`) | ✅ 822/823, parité i18n fr/en incluse |

### 9septquadragies.10 `/annuaire` : détail en tiroir (droite), cohérent avec `/annuaire-acteurs-parentalite`

`list.card.detailsMode` passe de `"dialog"` (modale centrée) à `"drawer"` (tiroir, sens par défaut
`"right"` de `CustomDrawer.tsx`) sur `/annuaire` — aligné sur `/annuaire-acteurs-parentalite`, qui
l'utilisait déjà.

**Vérification complète avant commit** (checklist standards du lead, portes chiffrées) :

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` (`eslint -f json` sur les fichiers du lot) | ✅ 0 erreur |
| `config:validate` / `audit:config` | ✅ 52 pages · 183 sections / RAS |
| `test:unit` complet, RAM chiffrée (`NODE_OPTIONS=--max-old-space-size=4096 --maxWorkers=2`, machine à 7,5 Go) | ✅ 6070/6072 (1 skip) — seul `bundle-size.test.ts` en échec, préexistant/sans rapport |
| `test:integration` (`SITE_CONFIG_PATH=./config.prod.parent62.json`, même garde RAM) | ✅ 1041/1043 — 1 timeout `/annuaire` (20s) sous charge mémoire, **rejoué isolément : 6/6 vert** (confirmé transitoire, pas une régression) ; + `bundle-size.test.ts` |
| `config:render config.prod.parent62.json` | ✅ 52/52 pages, 183/183 sections, 0 échec |
| `test:e2e` | non rejouable sur ce poste (`.env.test` absent, pas d'identifiants backend réels) — limite d'environnement déjà connue, pas une régression de ce lot |

### 9septquadragies.11 Nettoyage de relecture (non bloquant)

- `ProfileParent62About.tsx` recopiait localement `toStringArray` au lieu d'utiliser le helper
  partagé `src/helpers/toStringArray.ts` — celui-ci lit aussi les deux formes OBJET que le legacy
  renvoie pour un champ multi-valeurs (tableau PHP à index non contigus, dictionnaire de présence),
  la copie locale rendait `[]` dessus (« Non renseigné » affiché alors que les filtres voient les
  valeurs). Supprimée, import du helper partagé.
- Commentaire de `ProfileParent62AboutSectionSchema` (`schema.ts`) périmé : citait encore
  `costumForms.parent62-partenaire` seul et « type de structure, thèmes, territoires, publics »
  (sélecteur de type retiré depuis, champs réels différents côté acteur). Réécrit pour refléter les
  deux `costumForms` distingués par tag.
- `doc/08-module-profil.md` : table des sections de profil ne listait pas `profile-parent62-about`
  et le compteur était resté à 21 au lieu de 22. Ajoutés.
- `TYPE_LABELS` (doublon de l'enum du formulaire) signalé en relecture : déjà absent du code, retiré
  dans un lot antérieur de cette session (sélecteur « Type de structure » supprimé avec le reste de
  la carte, §9septquadragies.3) — rien à faire.

| Gate | Résultat |
|---|---|
| `typecheck` / `lint` | ✅ |
| Tests ciblés (`ProfileParent62About`/`profileParent62Social`/`profileParent62Documents`, `toStringArray`) | ✅ 31/31 |
| `tests/preflight/` (hors `bundle-size.test.ts`) | ✅ 822/823 |

## 10. Checklist d'avancement

### Partie 1 (3 000 €)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1.1 | Site `reseau.parent62.org`, nav + graphisme proches du WP | 🟡 | config réconciliée (24/07) ; doublon nav `/blog` **résolu** (§9.5) ; **06/08 (committé sur `parents62`)** : accueil, header (`stacked`) et footer (`minimal-centered`) entièrement refondus, nav passée à 5 dropdowns dont un nouveau « Publics » (§9quater) ; double entrée `/parents`/`/pro` **rétablie le 02/09** (1.4, §9septendecies), la recette visuelle et le déploiement → 1.10. **09-10/09** : haut de page resserré — bandeau au quart de l'écran, « Territoires » et « à la une » côte à côte dans un `gridLayout` qui tient dans le premier écran jusqu'à **150 % de zoom** ; page `/contact` retirée au profit de `/equipe`, qui portait déjà la même section (§9sexvicies.1, §9sexvicies.6) |
| 1.2 | Pages statiques réseau / charte / équipe / champs d'action | ✅ | `/reseau` `/charte` `/champs-actions` `/equipe` ; arbitrage éditorial réseau ouvert (§13). **10/09** : **deux pages reprises mot pour mot** à la source officielle — `/champs-actions` (5 valeurs du REAAP, charte et 5 objectifs du CLAS, âges du LAEP, 3 liens documentaires, actu d'Olhain tirée par son slug, §9sexvicies.3) et `/reseau` (l'équipe nommée, la définition intégrale du CNSP, les 3 familles de membres, la circulaire de 1999 et la plaquette du réseau en PDF ; frise chronologique retirée, §9sexvicies.5). **Reste à faire** : les 8 valeurs de `/charte` sont **tronquées** à leur première phrase alors que la source les donne en entier |
| 1.3 | Page par territoire : contact + **liste des communes** | ✅ | cards coordo + accordéon 887 communes + fil filtré + CTA ; navigation depuis l'accueil désormais via `map-bubbles` (carte à bulles, §9quater) au lieu des cartes d'accès rapide ; **03/09** : haut de page refondu — **3 prochaines réunions du comité local** juste après le bandeau, carte « Comptes rendus des réunions » (Drive) et **3 ressources du territoire** avec bouton « Voir toutes les ressources » ; carte « Le comité local » et blocs de liens externes retirés ; saisie des réunions par l'onglet `/admin` dédié (§9novodecies). Les deux blocs de données sont **câblés** ; leur remplissage dépend de la saisie côté costum (§9novodecies.5) ; **22-23/09** : coordination lue en UNE requête serveur (`filters`+`fields`, SDK 1.0.194), plus d'appel par carte, `card.rattachement` obligatoire, gate labels exacts (§9septvicies.6-7) |
| 1.4 | Double entrée parents / pro | ✅ *(était 🟡, régression du 06/08)* | **Rétablie le 02/09** : la section `action-tiles` `home-double-entree` (« Vous êtes… » → `/parents` / `/pro`) est réinsérée sur l'accueil, en 2ᵉ position — juste après le carrousel « à la une », sa place d'origine dans le rythme de la page. Les deux pages existaient toujours mais **n'étaient liées de nulle part** depuis la refonte du 06/08 (vérifié : une seule occurrence de chaque chemin dans la config, sa propre déclaration de page). Elles coexistent avec le dropdown « Publics » (7 pages `/public/*`), qui ne les remplace donc pas — question §13 tranchée |
| 1.5 | Moteur de recherche : types d'info, public, âges, dates, territoire coloré, carte, thèmes | 🟡 | `/recherche` : types d'info (**searchTargets 6** depuis le 25/07 — « Ressources » ajoutée —, défaut « Actualités »), public, thèmes, territoire coloré, **carte** (`enableMap:true`), `dateRange` **borne début seule**. **25/07** : chaque famille a désormais sa carte et son action au clic (`list.itemRules`, §9bis) ; tri `created:-1` et projection explicite ajoutés. **Âges : livré sur `/temoignages` + form affiche, mais PAS encore dans le groupe de filtres `/recherche`** (à ajouter — `ages` est projeté, il ne manque que le groupe). Borne de fin des dates = demande backend `$lt/$lte` (§11) |
| 1.6 | Paroles de parents (catégories libres, audio+écrit+image, adresse/carte, transcription, ajout admin) | 🟡 | brique complète (Thomas) : `/temoignages`, form `parent62-affiche` (catégorie, audio→`medias`, ages, consentement RGPD), pile audio `media/*`, card/preview `testimonial`. **Ajout admin-only ✅** (modération a priori retirée volontairement, commit `17aea3e`). **25/07** : la cible « Paroles » de `/recherche` renvoyait **0 résultat** (filtre `status:"validated"` sur un champ inexistant) — corrigé, et les paroles y rendent en bulles avec leur dialog (§9bis). **Données observées le 25/07** : `/temoignages` affiche « Toutes les paroles (**3**) » — la mention « 0 POI `affiche` » du 24/07 est caduque. **25/08** : catégorie **et** thèmes passés en saisie libre, valeur inédite promue vers la liste partagée par un admin (§9septies). **09/09** : les 3 catégories par défaut (« Compliqué / Difficile / À changer ») **retirées** du socle du form, du filtre et des `badge.colors` — seule la recette `categoriesParole` alimente, saisie libre ouverte ; **adresse** (widget `location` + `geo`/`geoPosition`) et **image** (`profil_avatar`, en bannière de card ET de modale via le nouveau `testimonial.imageField`) ajoutées à la saisie ; **carte en vue split** sur `/temoignages` (§9vicies). **Manque** : **transcription/sous-titres NON implémentée** (`description` sert d'écrit) ; les paroles déjà saisies n'ont **pas d'adresse**, donc aucun marqueur tant qu'elles ne sont pas rééditées. |
| 1.7 | Navigation territoriale (recherche V2) | ✅ | 9 bulles → `/territoire/<slug>` + filtre territoire coloré dans `/recherche` |
| 1.8 | Référencement (SEO, JSON-LD, sitemap, robots, RSS) | ✅ | sitemap/robots (MR) + JSON-LD `BlogPosting` et `/blog/feed.xml` (Thomas) |
| 1.9 | Tests E2E (Playwright) | ✅ *(était 🟡 6/8 le 06/08)* | **13/08 : 8/8 verts** — les 2 désaccords contenu/test relevés le 06/08 (« Professionnels » dans le header, mécanique d'opacité `stacked` vs `transparent-scroll`) sont résolus, cf. §9quinquies. `npx playwright test e2e/parent62.spec.ts` (jamais la suite complète) |
| 1.10 | Déploiement | ❌ | à la main de Peterson — cf. §8.5 |

### Partie 2 (4 500 €) — statuts revus par l'audit fonctionnel du 24/07

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 2.1 | Module actualités + interop WordPress | ✅ / 🟡 interop | 6 434 articles, `/blog`, `/actualites`, 9 `/theme/*`, admin, RSS, ⌘K. **Interop WP = import batch one-shot** (`tools/wp-migration/`), pas de sync live/webhook ; « ajout de post » = form `parent62-article` admin (le module `interop/` = Discourse/Mediawiki, pas WP). **06/08** : 2 pages de contenu tagué ajoutées sur le même patron, `/appels-a-projets` et `/offres-emploi` (`articleFeed` filtré par tag WordPress libre, zéro impact backend, §9quater). **02/09** : champ **« Type d'actualité »** (`category` : Article simple / Appel à projets / Offre d'emploi) dans le formulaire d'ajout d'article, avec un `mutation.stamps` `$mapLabels` qui pose le mot-clé public à la création ET à l'édition, + 2 onglets `/admin` filtrés par `defaultTags` (§9sexdecies). **09/09** : boutons **Modifier / Supprimer** sur la fiche `/blog/:slug`, gardés par `canEditProfile` (admin du costum ou auteur) et réutilisant la modale `edit-parent62-article` déjà en place — hérité par les **4 sites** déclarant une page `/blog`, à charge pour eux de router leur propre `editModals` (§9sexvicies.2). **17/09** : types **« À la une »** et **« Zoom sur le réseau »**, type en **choix multiple** ; le mot-clé suit désormais le type (codecs à la place du stamp) ; section d'accueil « Zoom sur le réseau » filtrée sur `Zoom` ; territoires/publics/thèmes facultatifs (§9octovicies.3-4). **22/09** : filtre **« Villes »** sur `/blog` (33 villes du survol des territoires, **23/09** : sur la ville de l'adresse) et champ adresse du formulaire (§9octotricies.1, §9novotricies). **30/09** : les 33 fils passent en **pagination numérotée** (12/page) au lieu du scroll infini, réglée une seule fois via `config.blog.defaultPagination` (§9tresquadragies) |
| 2.2 | Actualités filtrables dans le moteur de recherche | ✅ *(était ✅ config, 🟡 UX)* | cible `searchTargets` « Actualités » (`type:article`) dans `/recherche` + filtres territoire/public/thème/dates. **25/07 — UX unifiée** : une actualité de `/recherche` rend une carte dédiée et son clic ouvre le **reader canonique** `/blog/:slug` (repli `/blog/id/:id`), plus un drawer générique |
| 2.3 | Module événementiel (agenda) + affichage territoire | 🟡 *(diagnostiqué le 14-19/08)* | module agenda complet (calendrier + liste, filtre territoire) ; testé avec des **événements de test locaux** (dev, pas de la production — cf. §9sexies), a révélé 3 bugs backend, **tous corrigés** (§9sexies.1) ; **0 donnée `events` en production, toujours à confirmer** ; pas de carte agenda (`enableMap:false`) |
| 2.4 | Impression de l'agenda | ✅ *(code prêt, non activé)* | export PDF via le SDK (`endpointApi.agendaGetPdf`, SDK ≥ 1.0.196), bouton opt-in `agenda.showPdfExport` (défaut `false`, vérifié en direct avec l'option forcée à `true` puis retirée — §9quinquadragies) — à activer sur `/agenda` quand souhaité |
| 2.5 | Événements récurrents | ✅ *(était « config+code, non observable » le 24/07)* | `parent62-event` : `recurrency` + `openingHours` + `eventDates` + codecs/validators + calendrier « récurrents dépliés ». **Testé le 14-19/08 avec des événements de test locaux (dev, pas la production)** — a révélé 3 bugs backend dans `AgendaAction.php`, **tous corrigés** : matching par jour de semaine, mode LISTE excluant les récurrents, occurrence du jour en cours jamais renvoyée / onglet « En cours ». Front `site-json` entièrement corrigé et testé (899/899) — cf. §9sexies et les 2 documents de spécification à la racine du monorepo |
| 2.6 | Ajout partenaires + **modération a priori** | ✅ *(était ❌, confirmé le 19/08)* | bouton public `requiresAdmin:false`, form injecte `preferences.toBeValidated:true`, onglet admin Agenda `validate` + « Proposé le ». `searchEventsCostum` masque bien les events *pending* côté public — confirmé (cf. §9sexies, §12) |
| 2.7 | Annuaire partenaires (référencement + cartographie) | ✅ *(était 🟡)* | cible `searchTargets` « Structures & partenaires » (`organizations`) + carte + templates profils ; **25/07** : règle de rendu dédiée (`image-cover`, `imageFit:"contain"` pour des logos hétérogènes) ; **22/09** : page **`/annuaire`** (filtres territoire / type / public / thèmes, vue carte), formulaire `parent62-partenaire` modéré (dispense pour les admins du site), onglet admin « Partenaires » ; page « La communauté » retirée (§9octotricies.2). **0 organisation rattachée** à la livraison. **13/10** : page **`/annuaire-acteurs-parentalite`** distincte, 38 organisations importées (`source.key:"youthCare"`), preview et fiche profil sur les vrais champs du formulaire, formulaire d'édition dédié `parent62-acteur` (§9septquadragies) |

### Partie 3 (2 000 €) — statuts revus par l'audit du 24/07

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 3.1 | Module ressources (POI `recoveryCenter`) | 🟡 | `/ressources` + form `parent62-recovery-center` (catégories Vidéo/Photo/Compte-rendu/Doc/Lien, **02/09 : + Inforéso et Elles et ils ont marqué le réseau ; « Jeu » remplacé par « Les jeux du réseau »** — formulaire, filtre « Type » et pastilles de carte ; galerie/docs). **À vérifier en base** : les POI déjà enregistrés en `category: "Jeu"` ne sont pas migrés et sortent du filtre « Type ». **Données observées le 25/07** : `/ressources` affiche « Toutes les ressources (**4**) » — la mention « 0 donnée » du 24/07 est caduque. Création **admin-only** (pas de bouton public → le « formulaire simple partenaire » du CDC n'est pas exposé). **17/09** : **INFORESO** (`/inforeso`, POI `doc`, par année) et **« Elles et ils ont marqué le réseau »** (annuaire, POI `intervenant`) passent en **pages dédiées** avec formulaire et onglet `/admin` ; saisie des fiches à faire, prérequis prod en §9octovicies.6. **13/10** : colonnes admin « Année » (INFORESO) et « Type » (Ressources) ne s'affichaient pas — `source.defaultFields` manquant sur les deux sections (§9septquadragies) |
| 3.2 | Recherche dans les ressources (territoire/**ville**) | 🟡 *(était ✅ config)* | `/ressources` filtre `category` + `territoires` + public/thème + `searchBy:[name,description]` ; **23/09** : filtre « Commune » retiré, le filtre par ville étant réservé aux actualités (§9novotricies). **25/07** : les ressources sont aussi atteignables depuis `/recherche` (cible « Ressources » + règle de rendu dédiée) |
| 3.3 | Votes « utile » / contributeurs | ❌ | pas de vote sur les ressources (`ADD_VOTE`/`links` à câbler + UI card) ; les votes n'existent que sur le fil news social |

Hors périmètre engagé : publication RS, mailing, migration GoGoCarto, fiches de jeux.

---

## 11. Dépendances site-json ↔ cocolight-api-client

Le SDK est en **lecture seule** : toute évolution passe par une spec `.md` transmise à Aboire
(`spec-cocolight-api-parents62.md`). Version courante au 23/09 : **1.0.194 installée** (`^1.0.194` dans
`package.json`, publiée le 22/09 — §9septvicies.6). Historique : **1.0.172, publiée sur npm** (`^1.0.172`,
commit `09e145a0` du 03/08, résolue depuis `registry.npmjs.org` dans le lockfile — fini le tarball
`npm pack` local). La 1.0.172 règle notamment la **pose du scope costum côté back-office**
(`setCostumScope`, présent dans le dist installé, consommé par
[`src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts) —
le `/admin` du blog parent62 en dépend). Le **1.0.168** (mergé le 24/07) avait apporté :

| Apport SDK 1.0.168 | Effet parent62 |
|---|---|
| `ADD_POI.preferences` (`ee42227`) | modération a priori native (`preferences.toBeValidated.parent62`) |
| `ADD_POI.medias` (`f6e330b`) | audio des paroles matérialisé en `medias:[{type:"audio",url}]` |
| digest costum **variant-aware** (`6fab52d`) | un POI costum multi-type (article + affiche) expose chaque sous-type |
| `news` dans `globalautocomplete` (`ceaff2a`) | débloque la page Actualités |

| Apport SDK 1.0.194 (commit `55e7680`) | Effet parent62 |
|---|---|
| `getMembers`/`getContributors`/`getAttendees` : `data.filters` FUSIONNÉ sous le filtre de lien (avant : écrasé) | « le coordonnateur DE ce territoire » en une requête serveur exacte |
| 6 schémas AJV `GET_MEMBERS_*`/`GET_CONTRIBUTORS_*`/`GET_ATTENDEES_*` : `filters.additionalProperties: true`, `fields: string[]` | la validation client ne refuse plus un filtre de profil ; projection additive des champs que la carte lit |
| chemin admin (`isMe`) : `fields` retiré (projection EXACTE de `searchAdmin` → documents sans `collection`, ignorés) | un admin connecté voit la même carte qu'un visiteur |

**Restant côté Thomas / backend** : recopier `endpoints-copie.json` (1.0.194) dans
`cocolight-backend/src/contract/` ; confirmer le **`typeObj.affiche` déployé en base** (le dump
local du 20/07 ne contient que `article`) ; whitelist audio `Document.php` (demande 5) ; opérateurs
`$gte`/`$lt`/`$lte` dans `SearchNew::getQueries` (demande 6, borne de fin des dates) ; liste `ages`
attendue par le test parole ; périmètre `prepData`/`validategroup`.

---

## 12. Points d'attention / limitations

- **Nav** : 5 entrées — Le Réseau · **Thèmes** · Territoires · Contenus · Rechercher. Le doublon
  `/blog` (« Actualités »+thèmes du MR vs « Contenus » de Thomas) a été **résolu le 24/07** :
  « Actualités » remplacée par le dropdown « Thèmes » canonique de Thomas (décision Peterson : quand
  deux entrées ouvrent la même page, on garde celle de Thomas ; les thèmes restent navigables).
- **[25/08] 8 pages `/theme/<slug>` orphelines de la nav** (§9decies) : depuis la bascule du
  dropdown « Thèmes » en `dynamicList`, ces pages (chacune avec un SEO dédié) ne sont plus liées
  depuis le menu — remplacées par des liens `/blog?theme=<valeur>` générés depuis
  `costum.lists.themes`. Choix assumé (remplacement complet, pas de fusion) ; elles restent en
  ligne et indexables, joignables par URL directe/sitemap.
- **Vue cartographique** : `/recherche` (`enableMap:true`, bascule plein écran) et, depuis le 09/09,
  `/temoignages` (`enableMap:true` + `map.layout:"split"` — liste étroite et carte côte à côte, dans
  les 3/4 de largeur laissés par le panneau de filtres, cf. §9vicies et §9unvicies.1) ; `/agenda` et `/ressources` ont toujours `enableMap:false`. **Une parole sans adresse
  n'a pas de marqueur** : la vue carte de `/temoignages` ne montre que les paroles géolocalisées,
  et reste donc quasi vide tant que le champ « Lieu de recueil » n'a pas été renseigné sur l'existant.
- **Modération a priori des events** (2.6) : le form pose `preferences.toBeValidated:true` ; l'agenda
  public (`searchEventsCostum`) n'applique aucun gate côté client, mais le masquage des events *en
  attente* est **confirmé fonctionnel côté backend** (19/08, cf. §9sexies) — déclenché par
  `costumSlug`, toujours injecté par le SDK en usage réel.
- **Collections quasi vides** : les briques P2/P3 reposaient sur des collections **vides** au dump du
  20/07. **Relevé du 25/07 dans l'application** : 3 paroles, 4 ressources — les articles, eux, sont
  massivement présents. Les events et organisations restent à confirmer (la vue carte de `/recherche`
  ne renvoie rien, mais elle ne mesure que le **sous-ensemble géolocalisé**, pas le total).
- **Aucune donnée géolocalisée** : la vue carte de `/recherche` affiche « Aucun résultat » pour
  toutes les familles testées le 25/07 → le `map.marker.colorBy` par territoire et l'action au clic
  depuis la popup ne sont **pas observables** en l'état.
- **Une règle `itemRules` qui teste un champ hors `defaultFields` ne matche jamais**, en silence
  (même famille de piège que l'encodage U+2019). Un `console.warn` DEV le signale, et le préflight
  `list-item-rules` le gate ; l'ordre des règles (catch-all en dernier) est gaté aussi.
- **Trois `itemAction` homonymes** de formes différentes coexistent (`list.itemAction`,
  `map.itemAction`, `commandPalette.entitySearch.itemAction`) — source de confusion en config, cf.
  l'encadré de [doc/07](../doc/07-module-search.md#rendu-par-item-des-listes-hétérogènes-listitemrules).
- **Transcription des paroles** (1.6) : non implémentée — pas de champ dédié (`description` = écrit).
- **URL parole** : on garde `/temoignages` (main canonique). Si le réseau préfère l'URL `/paroles`,
  c'est un re-`path` de la page de Thomas — à confirmer avec lui.
- ~~**Lint** : 29 erreurs pré-existantes au 25/07~~ : dette résorbée entre-temps — **0 erreur /
  18 warnings** au 03/08 (`npm run lint` sur `main` ; déjà 0 erreur au commit `53f28ca1` du 30/07).
- ~~**`.env` quoté**~~ : le préflight `environment` **passe au 25/07** (comme `bundle-size`) — les
  deux échecs signalés le 24/07 sont résolus.
- **Encodage des libellés** (U+2019, tiret demi-cadratin) — cf. §5.2.
- **Articles sans taxonomie** : 1 173 sans territoire (18 %), 2 181 sans thème/public → invisibles
  sur les pages filtrées. **Images d'articles** encore pointées sur `www.parent62.org/wp-content/…`.
- **Coquilles de communes** dans les PDF officiels, conservées telles quelles — correction à
  demander au réseau.
- **Chantier accueil/header/footer du 06/08** (§9quater), committé sur `parents62` mais **pas
  encore recetté visuellement ni fusionné dans `main`**. (Le point `/parents`/`/pro` **orphelines**
  qui figurait ici est **levé le 02/09** : la double entrée est rétablie sur l'accueil, §9septendecies.)
- **Thèmes/catégorie promus par un admin ne sont visibles qu'après le prochain chargement de page
  des AUTRES utilisateurs/onglets** (25/08, §9septies.2) — `carrier.refresh()` ne rafraîchit que la
  session courante, pas de push temps réel entre sessions.
- **`element/updatepathvalue` ne persiste pas une valeur vide** (25/08, §9octies.2) — un `$set`
  d'un tableau `[]` (création d'une liste vide, ou suppression de sa dernière valeur) est un no-op
  silencieux côté backend. À garder en tête pour **toute** future fonctionnalité admin qui écrirait
  via ce même endpoint, pas seulement la section « Listes ».
- **Section admin « Listes » — renommer/réordonner/supprimer une valeur non validés en prod
  réelle** (25/08, §9octies.3) : seul l'ajout (`$push`) est éprouvé ; les trois autres opérations
  reposent sur un `$set` de tableau complet jamais exercé sur `costum.lists` avant ce lot.
- ~~**`tests/preflight/archetypes.test.ts` rouge** (25/08, §9octies.4)~~ : **corrigé le 25/08**
  (§9novies) — resynchronisé, avec 3 autres exemples qui avaient aussi dérivé du dédoublonnage
  territoire « Familles en sol mineur » (§9quinquies).
- **Section admin `resource` sans `status` ni action `validate` → projection réduite à
  `["source","reference"]`** (13/10, §9septquadragies) : toute colonne ciblant un champ costum hors du
  socle légacy (`name`/`created`/`address`…) reste invisible sans `source.defaultFields` explicite —
  mécanisme prévu par `AdminResourceTable.tsx` mais facile à oublier à la création d'une section. À
  vérifier systématiquement pour toute nouvelle section admin de ce type.

---

## 13. Évolutions à prévoir & questions en attente

Priorisées par l'audit fonctionnel du 24/07, révisées le 25/07, complétées le 03/08 (déploiement).
Le **doublon nav `/blog` est résolu** (§9.5) ; l'**UX `/blog` ↔ `/recherche` est unifiée** (§9bis) ;
les **paroles ne sont plus muettes** dans le moteur (§9bis.1).

| Évolution / question | Pour qui |
|---|---|
| **[23/09] `ArticleBody` — profil strict ou permissif ?** — le corps d'article est en `sanitizeProse` (pas de `style`/`class`/`id`) ; impact mesuré : 5 `style=` et 4 `class=` résiduels sur 2 000 articles, 0 ancre (§9septvicies.7). Assumer (recommandé), ou rétablir via `source` | Thomas / Peterson |
| **[23/09] Quatre constats de revue à arbitrer** — `validators.ts` : contrôle `start ≤ end` en récurrent ; `GridLayoutSection` mode rangée : `wrapperClass` propre ou retrait de `rightWrapperClass`/`leftColumns`/`rightColumns` du contrat ; `ActionTiles` : `accentTextColor` (schéma + `prop-descriptions` + doc) ; `sectionBadge` : rétablir la taille historique du badge `sticker` du carousel | Peterson |
| **[23/09] Rejouer « Audomarois → Ludivine » sur le backend qui porte le réseau** — ni `:5080` ni `www.communecter.org` n'ont les 10 membres / 5 coordinations de §9septvicies.4 ; vérifié localement sur un semis (§9septvicies.6) | Thomas |
| **[23/09] Miroir `endpoints-copie.json` 1.0.194 → `cocolight-backend/src/contract/`** | Thomas |
| **[23/09] Dérive de saisie du champ `territoires`** — le filtre est une égalité exacte ; le gate couvre la config, pas les profils (« Hénin-Carvin » avec tiret n'apparaîtrait plus). Règle de saisie à tenir dans le référentiel | réseau |
| **[03/09] Portée des facettes d'une page** — `PageFilters` est page-scopé : les facettes du `searchHeader` s'appliquent à TOUTES les sections de données de la page, y compris celles placées au-dessus de lui. Sur une page territoire, filtrer par thème restreint donc aussi les volets du haut. Faut-il une prop moteur d'isolation (`ignorePageFilters`, générique), renseigner `themes`/`publics` sur les réunions à la saisie, ou garder ce comportement uniforme ? | Peterson / Thomas |
| **[03/09] Qui saisit les réunions de comité local ?** — le « comment » est réglé (onglet `/admin` « Réunions du comité » + formulaire `parent62-reunion`, §9novodecies.3) ; reste le « qui » : les 9 coordinations ont-elles un accès `siteAdmin` à `/admin`, et qui les forme ? Sans saisie, le volet reste vide | réseau / Peterson |
| **[03/09] Réunions publiées sans modération** — `parent62-reunion` n'injecte pas `preferences.toBeValidated` (sinon la porte `costumSlug` du volet masquerait la réunion à l'admin qui vient de la créer). Acceptable puisque le formulaire n'est atteignable que depuis `/admin` ; à revoir si un bouton public devait un jour l'ouvrir | Peterson |
| **[03/09] `/agenda` doit-il montrer les réunions de comité ?** — il filtre `type:"others"` : les `meeting` n'y remonteront pas. Élargir à `{"type":{"$in":["others","meeting"]}}` (1 ligne de config) ou garder l'agenda public strictement « événements » ? | réseau / Peterson |
| **[03/09] Ressources par territoire** — le volet n'affiche que des fiches `recoveryCenter` portant le `territoires` de la page : saisie/import à planifier territoire par territoire. Les 11 liens WordPress/GoGoCarto retirés des pages (archivés en §9novodecies.2) sont les premiers candidats à une ressaisie en fiches ressource, category *Lien* | réseau |
| **Alias `reseau.parent62.org` dans `sites.json`** (champ `aliases`) pour que `deploy:env` dérive `VITE_SITE_PUBLIC_URL` correctement — aujourd'hui l'entrée `parent62` n'a que `domain: parent62.00.re` (§8.5) | Peterson / Thomas |
| **Âges dans `/recherche`** (1.5) — la liste `ages` existe (form + `/temoignages`), l'ajouter au groupe de filtres `/recherche` | Peterson |
| **Votes « utile » + contributeurs** des ressources (3.3) — câbler `ADD_VOTE`/`links` + UI card | Peterson / Thomas |
| **Transcription / sous-titres des paroles** (1.6) — champ dédié à ajouter au form + affichage | Peterson / réseau |
| **Masquage public des events *pending*** (2.6) — `searchEventsCostum` applique-t-il un gate `toBeValidated` ? sinon à faire côté backend | Thomas |
| **`typeObj` de production** (2.7) — déclarer sur le costum parent62 de production `typeObj.organizations` (`territoires`, `publics`, `themes`) comme en base locale (§9octotricies) | Thomas / backend |
| **`typeObj.acteur` de production** — créé et appliqué en LOCAL uniquement (cf. §9septquadragies.3) ; reste à reporter sur la base de PRODUCTION (même opération) avant toute édition réelle en prod | Thomas / backend |
| **Republication SDK (`costum-extensions.json`)** — aucune entrée `organizations` pour `parent62` dans l'artefact vendu (généré 03/09, périmé) ; le scanner backend qui le produit (`tools/parity/scripts/costum-fields.mjs`) est hors d'atteinte depuis ce poste. Nécessaire pour que l'édition des champs costum de `parent62-acteur` soit fiable en PRODUCTION (sans dépendre de `VITE_COSTUM_FORCE_LIVE`, local uniquement) | backend / Thomas |
| **Données P2/P3** — relevé du 25/07 : 3 paroles, 4 ressources ; events et organisations à confirmer. Volumétrie réelle à créer/importer | réseau / Thomas |
| **Géolocalisation** — aucune donnée ne porte de coordonnées : la vue carte de `/recherche` est vide et le `colorBy` par territoire est invérifiable | réseau / Thomas |
| Borne de fin des dates (`$lt`/`$lte`) dans `SearchNew::getQueries` | Thomas / backend |
| **URL parole** `/temoignages` vs `/paroles` | Thomas / réseau |
| Harmoniser `/theme/*` avec `/recherche` (2.2 — le volet `/blog` est fait) | Peterson |
| **[25/08] Devenir des 8 pages `/theme/<slug>`** — restent en ligne mais orphelines de la nav depuis la bascule `dynamicList` (§9decies) : les rediriger vers `/blog?theme=...`, les relier autrement (footer, pages territoire…), ou les laisser telles quelles (SEO dédié conservé) ? | réseau / Peterson |
| **[02/09] Tuiles `action-tiles` gris délavé en mode CLAIR, sur tout le site** (`/`, `/parents`, `/pro`) — `primary` clair est un bleu quasi neutre (`oklch(0.35 0.04 250)`, chroma 0.04) dont le `bg-primary/20` du composant ne tire qu'un gris ; le mode sombre, lui, est bon. Relever la chroma de `primary` en clair (impacte tout le site) ou passer ces tuiles sur un token plus saturé ? | Peterson / client |
| **[25/08] Valider en conditions réelles la branche RECETTE DYNAMIQUE de `useResolveDynamicNav`** (seule la branche statique a été exercée sur parent62, §9decies.3) — pertinent le jour où `costum.lists.themes` (ou une autre liste) devient une recette dynamique côté backend | Thomas / backend |
| **Carte `CardEvent`** — hauteur figée `h-72`, aucun fond, ignore `card`/`list` : dans une liste hétérogène elle laisse un trou et laisse voir le fond de page. Correctif à recetter sur `/agenda` | Thomas |
| Valeurs `category` ressources · 10e territoire « Familles en sol mineur » (43) · contenu des 4 pages statiques · couleurs `oklch` · coquilles de communes | réseau |
| **[06/08] « Professionnels » désormais dans le header** (dropdown « Publics ») — contredit la décision du 23/07 (« Parents / Professionnels hors menu ») ; si le nouveau nav est acté, l'assertion e2e correspondante est à réviser | Peterson / Thomas |
| **[06/08] Assertion e2e d'opacité du header** (« mode sombre… », `bg-background/90`) écrite pour `transparent-scroll` — à réécrire pour la mécanique réelle de `stacked` (scrim interne, opacité jamais posée sur le `<nav>`) | Peterson |
| **[06/08] `build`** jamais relancé depuis la refonte — à faire avant tout commit (`test:unit` — 2 227/2 229, seuls les 2 pré-existants restent —, `test:integration` et `e2e` ciblé ont été rejoués le 06/08, cf. §9quater.3) |
| ~~**[25/08] Déclarer `themesPoi` / `themesEvents`**~~ — **CLOS le 02/09 : elles existaient déjà en base** (§9terdecies.1). Reste, si voulu : créer une liste STATIQUE `themes` via la section admin pour disposer d'un socle éditable sans redéploiement. _(libellé d'origine ci-dessous, conservé pour l'historique)_ | Thomas / backend |
| **[25/08, révisé 02/09] Déclarer `themesPoi` / `themesEvents` dans `costum.lists`** — deux recettes `distinct` mono-collection (`poi`, `events`) de forme **déjà supportée**, à AJOUTER à côté de `costum.lists.themes` qui reste statique et éditable par l'admin. Remplace la demande initiale de *convertir* `themes` en recette, qui butait sur le multi-collections : le front sait désormais fusionner N listes (§9sexdecies), donc plus rien à changer côté backend. Ajout additif, retour arrière = supprimer les deux clés. Idem `categoriesParole` si le besoin se confirme (une seule collection, `poi`) | Thomas / backend |
| **[25/08] `build`** jamais relancé depuis ce lot — commit `bcd90e6d` pushé, à recetter avant fusion dans `main` | Peterson |
| ~~**[25/08] Section admin « Listes » — valider renommer/réordonner/supprimer**~~ — **SANS OBJET depuis le 02/09 : la section a été retirée** (§9quaterdecies), `costum.lists` est en lecture seule depuis site-json | — |
| ~~**[25/08] Section admin « Listes » — `build`**~~ — **SANS OBJET** : la section a été retirée le 02/09 (§9quaterdecies). Le commit `9c3f243f` reste dans l'historique de `parents62` | — |
