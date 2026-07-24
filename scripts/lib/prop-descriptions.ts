/**
 * Registre de SÉMANTIQUE des props du schéma de site — fusionné au dump par
 * scripts/config-schema.ts (`applyDescriptions`) : chaque entrée pose
 * `description` sur le nœud correspondant du JSON Schema servi à l'assistant.
 *
 * Décision 2026-07-24 (commentaire/refonte-assistant-config.md, axe A3) :
 * registre SÉPARÉ plutôt que `.describe()` inline — un seul mécanisme, schémas
 * intacts, synchro garantie par tests/preflight/prop-descriptions.test.ts
 * (une entrée dont le chemin ne résout plus dans le schéma casse le préflight).
 *
 * Syntaxe des chemins : `cle` (propriété), `cle[]` (items d'un tableau),
 * `*` (valeurs d'un record). Pour les sections (`section:<type>`), la racine
 * est le MEMBRE de l'union → préfixer `props.`. Éviter les chemins qui
 * traversent un schéma récursif (z.lazy → $ref, non suivi par le résolveur).
 *
 * Style : français, une phrase, ≤ 220 caractères, sémantique/pièges/défauts
 * CÔTÉ CODE (la config n'est jamais parsée par Zod au runtime → les
 * `.default()` du schéma ne s'appliquent pas).
 */

const prefix = (p: string, descs: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(descs).map(([k, v]) => [`${p}.${k}`, v]));

/**
 * Fragment `list` (ListConfSchema, src/modules/search/schema.ts) — partagé par
 * searchPro et searchProStatic ; monté sous `props.list.` dans chaque section.
 */
const LIST: Record<string, string> = {
  columns: "Colonnes de la grille par breakpoint (sm/md/lg/xl, 1-6).",
  "card.type": "Presenter de carte (voir table SKILL) ; ⚠ défaut CÔTÉ CODE : overlay — le schéma dit default mais n'est jamais appliqué.",
  "card.variant": "Surcharge card.type pour le SEUL dispatch visuel (sous-ensemble sans overlay/news/testimonial/resource).",
  "card.detailsMode": "Conteneur du détail au clic : drawer (panneau latéral, défaut code) ou dialog (modale centrée).",
  "card.detailedMode": "Variante de la vue « détaillée » (toggle) : default ou service-pricing (tableaux capacité/prix).",
  "card.imageFit": "Cartes image-cover : cover (photo plein cadre rognée, défaut) ou contain (logo entier sur fond flouté — logos hétérogènes).",
  "card.showFunding": "Affiche la barre de financement cagnotte sur la carte ET déclenche la query useFundingEnvelope.",
  "card.overlayStats": "Coin haut-droit des cartes image-cover : service-pricing remplace les badges génériques par les pastilles de capacité.",
  "card.servicePricing": "Chemins CoForm des données service-pricing (id de formulaire + champs) — surcharge PAR CATÉGORIE la table par défaut du code.",
  "card.tagLimit": "Nombre max de tags affichés sur la carte.",
  "card.showDescription": "Affiche l'extrait de description sur la carte.",
  "card.showAddress": "Affiche la localité sur la carte.",
  "card.shareButton": "Affiche le bouton de partage sur la carte.",
  "preview.type": "Presenter du contenu de détail (voir table SKILL) — axe indépendant de la carte, dispatché par Preview.tsx.",
  "preview.width": "Largeur max du détail en mode dialog (échelle max-w-*) ; défaut code 5xl ; SANS EFFET en drawer. 2xl pour une lecture resserrée.",
  "preview.fields": "coform-answer : mapping rôle→suffixe de champ CoForm — découple les IDs de champs du code.",
  "preview.facets": "Preview générique type facets : champs serverData affichés, cliquables s'ils sont indexés par un dropdownFilter.",
  "preview.facets[].field": "Chemin serverData de la facette (dot-path supporté, ex. address.postalCode).",
  "preview.showDetailLink": "Lien « Voir en page » (permalien profil/détail) dans l'en-tête de la modale ; défaut code : affiché.",
  "testimonial.design": "Paire Card+Preview du témoignage (repli code : bubble).",
  "testimonial.quoteField": "Champ serverData de la citation — le héros du témoignage (repli code : description).",
  "testimonial.audioField": "Champ du média audio [{type:audio, url}] → lecteur AudioPlayer (repli code : medias).",
  "testimonial.badge": "Catégorie : teinte de la bulle + pastille ; colors = map valeur→couleur (var() ou hex), repli palette déterministe.",
  "testimonial.accent": "Accent secondaire (ex. territoire) : point coloré ; colors = map valeur→couleur.",
  "testimonial.facets": "Repères/taxonomies data-driven du témoignage (réutilise le mécanisme facettes générique).",
  "resource.design": "Paire Card+Preview de la ressource (repli code : card).",
  "resource.badge": "Catégorie de la ressource : pastille + icône de type ; colors/icons = maps valeur→(couleur|icône lucide) ; repli field=category.",
  "resource.mediasField": "Champ des médias [{type,url,name}] → galerie images, documents, audio, vidéo (repli code : medias).",
  "resource.cityField": "Champ de la ville affichée (repli code : address.addressLocality).",
  "resource.urlsField": "Champ des liens externes string[] (repli code : urls).",
  previewParam: "Nom du paramètre URL de synchro du détail (défaut code : preview) — à différencier quand plusieurs sections cohabitent sur la page.",
};

/** Sous-bloc baseParams (recherche backend searchCostum) — clés communes. */
const BASE_PARAMS: Record<string, string> = {
  defaultTypes: "Types d'entités cherchés (organizations/projects/events/citoyens/poi/answers/news…).",
  defaultFilters: "Filtres backend envoyés TELS QUELS à searchCostum (pass-through — une clé inconnue part au backend).",
  defaultSortBy: "Tri serveur : map champ→1|-1.",
  searchBy: "Champs matchés par la recherche texte : \"ALL\", CSV, ou array de paths (dot-paths supportés).",
  indexStepList: "Taille de page de la liste (pagination/scroll infini).",
  locality: "Périmètre géographique (zones actives par id/type/level).",
};

export const PROP_DESCRIPTIONS: Record<string, Record<string, string>> = {
  header: {
    type: "Variante de DESIGN du header (jamais un nom de site) ; le parc utilise surtout transparent-scroll — voir table SKILL « quand l'utiliser ».",
    logo: "Image de logo par défaut (chemin /images/<slug>/… — jamais d'URL inventée).",
    logoDark: "Variante du logo en mode sombre (swap CSS dark:, sans flash SSR) ; repli sur logo.",
    logoOverlay: "Variante du logo quand le header transparent est posé sur le héro (état non opaque) — typiquement version claire/monochrome.",
    logoIcon: "Icône de marque : nom Lucide kebab-case OU SVG inline — l'alternative sans asset logo.",
    logoIconTone: "Ton du logoIcon (rendu currentColor) : foreground suit l'ink du thème (marque monochrome) ; défaut selon le header.",
    logoSize: "Taille du logo : sm (défaut historique), md ≈40px, lg ≈48px desktop ; sur standard, lg suppose height md|lg.",
    logoSubtitle: "Sous-titre sous le titre du logo (marque sur 2 lignes : titre + baseline/localité).",
    entityLogoOverride: "Opt-in : remplace logo/titre par ceux de l'entité costum au runtime (plateforme transparentCommune).",
    nav: "Arbre de navigation (NavItem récursif) — chaque item exige path | href | children | megaMenu (refinement non exportable).",
    navVisibleOnlyForListedPages: "La nav ne s'affiche que sur les pages qu'elle référence (sites à sous-espaces).",
    mobileNavDisplay: "Sous-nav du menu mobile : sections (groupes déployés, défaut) ou accordion (groupes pliables).",
    transparent: "Autorise l'overlay du header sur le héro — combiné à transparentMode/opaqueOnPaths/overlayOnPaths.",
    transparentMode: "Où l'overlay s'applique : always (toutes pages, historique) ou auto (seulement si la page débute par un héro — sinon opaque + spacer).",
    opaqueOnPaths: "Force la barre OPAQUE sur ces préfixes de chemin. Précédence : opaqueOnPaths > overlayOnPaths > transparentMode.",
    overlayOnPaths: "Force l'OVERLAY sur ces préfixes de chemin (précédence intermédiaire).",
    height: "Hauteur de barre sm|md|lg (défaut code md).",
    "utilities.themeSwitch": "Bouton clair/sombre (défaut code : actif).",
    "utilities.langSwitch": "Sélecteur de langue — rendu null si une seule locale.",
    "utilities.search": "Bouton palette ⌘K — GATE du module commandPalette (sans lui, pas de palette).",
    "utilities.auth": "Widget compte <AuthMenu> (login/avatar) — module auth.",
    "utilities.notifications": "Cloche de notifications — active le module notification (chunk lazy).",
    "utilities.piggyBank": "Cagnotte du header — module cagnotte (bloc header.piggyBank pour le contenu).",
    ctaButton: "Bouton d'appel à l'action de la barre (label + path).",
    urgenceButton: "Bouton d'urgence mis en avant (headers transparent-scroll/underline-nav).",
    announcement: "Bandeau d'annonce au-dessus de la barre (header standard) : texte, lien, variant info|success|warning|error, dismissible.",
  },

  footer: {
    type: "Variante de DESIGN du footer (jamais un nom de site) — voir table SKILL « quand l'utiliser ».",
    style: "Sous-style de sidebar-columns : plain (fond plein) ou card (aspect carte).",
    columns: "Colonnes de liens (titre + links) — optionnel : minimal-centered ne les utilise pas.",
    socials: "Réseaux sociaux (platform→icône lucide via SocialLinks, url) — rendus selon le design.",
    newsletter: "Bloc d'inscription newsletter (footer rich).",
    legalLinks: "Liens légaux du bas de page (mentions, confidentialité…).",
    bottomLinks: "Liens secondaires de la barre du bas.",
    description: "Texte de présentation court (designs à sidebar).",
    contactSection: "Bloc contact du design contact-partners : items {icon, label, lines|value, href}.",
    partners: "Logos partenaires (contact-partners) — images EXTERNES rendues en <img> brut (pas /img : domaine non allowlisté → 403).",
    logoIcon: "Icône de marque du footer : nom Lucide ou SVG inline.",
  },

  theme: {
    defaultMode: "Mode initial du site : light, dark ou system.",
    "colors.light": "Palette du mode clair (~40 tokens shadcn : primary, background, muted, chart1-5, sidebar*…) — injectée au runtime par SiteTheme (SSR compris).",
    "colors.dark": "Palette du mode sombre — TOUJOURS fournir light ET dark (parité vérifiée par le préflight config-integrity).",
    "typography.fontFamily.sans": "Police principale (--font-sans) — Google Fonts préchargées par le SSR.",
    "typography.fontFamily.serif": "Police serif (--font-serif) pour les titres selon le CSS du site.",
    "typography.letterSpacing": "Interlettrage global (--tracking-normal).",
    "spacing.base": "Unité d'espacement Tailwind (--spacing) — changer avec prudence, impacte tout le layout.",
    "borderRadius.base": "Rayon de base (--radius) décliné par le thème shadcn.",
    "shadows.light": "Ombres du mode clair (8 niveaux --shadow-*).",
    "shadows.dark": "Ombres du mode sombre.",
    customCSS: "CSS libre injecté tel quel après les tokens (runtime SiteTheme) — réserver aux utilities introuvables en tokens.",
  },

  commandPalette: {
    enabled: "Bloc absent → palette désactivée ; présent sans enabled → activée (défaut code true).",
    keybinding: "Raccourci d'ouverture ; mod = Cmd (macOS) / Ctrl ailleurs (défaut code mod+k).",
    sources: "Liste blanche de namespaces de sources de commandes ; absent = toutes.",
    maxResultsPerGroup: "Nombre max de résultats par groupe (défaut code 10).",
    triggerVariant: "Bouton de header : full (icône+libellé+raccourci), compact (sans libellé), icon (icône seule).",
    "entitySearch.searchType": "Collections cherchées (défaut code : organizations/projects/events/poi/citoyens).",
    "entitySearch.excludeTypes": "Sous-types serverData.type EXCLUS (post-filtre client) — ex. article, géré par la source blog.",
    "entitySearch.limit": "Nombre max de résultats d'entités (= indexStep, défaut code 8).",
    "entitySearch.params": "Champs additionnels fusionnés dans le payload searchCostum (avancé : filters, sourceKey, scope…).",
    "entitySearch.iconRules": "Icône par RÈGLE générique : prédicat {field,op,value}+and/or/not évalué contre {...serverData, collection} → icône lucide ; 1re règle qui matche gagne, sinon getEntityIcon.",
    "entitySearch.itemAction": "Action au clic (défaut : navigation /profil/:slug) ; kind preview → détail SwitchDetailsMode.",
    "entitySearch.itemAction.list": "Bloc list du module search passé au détail — INDISPENSABLE pour les previews config-driven resource/testimonial (sinon défauts génériques).",
    "entitySearch.itemActionByType": "Surcharge de l'action par TYPE d'entité (clé = getEntityType, ex. poi, events).",
    "entitySearch.itemActionBySubType": "Surcharge par SOUS-TYPE POI (clé = serverData.type) — PLUS PRIORITAIRE que ByType ; seul moyen de router recoveryCenter→resource et affiche→testimonial.",
    "articleSearch.costumSlug": "Slug du costum dont on cherche les articles (scope source.key) — REQUIS pour activer la source blog.",
    "articleSearch.detailBasePath": "Base de l'URL du reader (défaut code /blog) — détail à <base>/:slug (+ <base>/id/:id).",
  },

  "section:searchPro": {
    "props.placeholder": "Placeholder de la barre de recherche (REQUIS sur cette section).",
    "props.useFilter": "Active la sidebar/les filtres de la page.",
    "props.defaultViewMode": "Vue initiale : list, map ou graph.",
    "props.searchVariant": "Endpoint SDK : default (globalautocomplete), navigator-tl (gettl enrichi), admin (réservé admins hôte) — le backend doit le supporter.",
    "props.customHeader": "En-tête teaser avec lien « voir tous » (title/linkText/linkHref) — pattern home → page complète.",
    "props.filters": "Filtres tags/type inline (record nom→TagsFilter).",
    "props.baseParams": "Périmètre backend — ⚠ SANS sourceKey ici (contrairement à searchProStatic) : searchPro cherche dans le réseau global.",
    ...prefix("props.baseParams", BASE_PARAMS),
    "props.disableInfiniteScroll": "Coupe le scroll infini (pagination manuelle).",
    ...prefix("props.list", LIST),
  },

  "section:searchProStatic": {
    "props.showSearch": "Affiche la barre de recherche texte (défaut code : masquée — souvent portée par un searchHeader au-dessus).",
    "props.useFilter": "Active la consommation des filtres de la page (PageFiltersContext).",
    "props.defaultViewMode": "Vue initiale : list, map, graph, regions (carte cliquable), thematics (grille CoForm) ou split (liste+carte).",
    "props.searchVariant": "Endpoint SDK : default / navigator-tl / admin (cf. searchPro) — le backend doit le supporter.",
    "props.enableRegions": "Active la vue regions (carte de zones cliquables).",
    "props.regionsTarget": "Cible du clic région : path + filterId → redirection avec ?<filterId>=<slug> (le groupe entityList de la cible pré-coche).",
    "props.thematicSource": "Source coformFilterByPath de la vue thematics (thematicPath/finderPath) — requis avec defaultViewMode thematics.",
    "props.thematicsTarget": "Cible du clic thématique : path + filterId → ?<filterId>=<name> pré-active le filtre sur la page cible.",
    "props.enableGraph": "Active la vue graph (bulles par tags/catégories).",
    "props.graphDetailsMode": "Détail depuis le graph : drawer, dialog ou link (navigation).",
    "props.addButton": "Bouton « ajouter » : modal (add-<costumForm>) ou formConfig ; toggles par type d'entité.",
    "props.zoneSelector": "Sélecteur de zone géographique (countryCode/level) au-dessus de la liste.",
    "props.tagSelector": "Sélecteur de tags horizontal (options = map valeur→libellé).",
    "props.csvButton": "Export CSV des résultats (columns = header + path serverData) — réservé aux listes administratives.",
    "props.customHeader": "En-tête teaser avec lien « voir tous » (pattern home → page complète).",
    "props.baseParams": "Périmètre backend searchCostum — TOUJOURS le renseigner avec un sourceKey réel (audit module-prereq sinon).",
    "props.baseParams.sourceKey": "Sources costum interrogées (multi-sources possible, ex. [franceTierslieux, tierslieuxbelgique]) — LE périmètre réseau.",
    "props.baseParams.notSourceKey": "true → cherche dans tout le réseau (ignore la source) ; nombre accepté (compat historique).",
    ...prefix("props.baseParams", BASE_PARAMS),
    "props.map": "Config carte : layout full|split, splitRatio, cluster, marker (surcharge integrations.map du site), itemAction popup.",
    "props.bg": "Fond de la section (token sémantique ou gradient).",
    ...prefix("props.list", LIST),
  },

  "section:searchHeader": {
    "props.headline": "Titre du bandeau (h1 si le searchHeader EST le héro de la page).",
    "props.headlineClassName": "Override de la couleur du titre — pour un fond fixe sombre où --foreground devient illisible (ex. text-white dark:text-foreground).",
    "props.subheadClassName": "Override de la couleur du sous-titre (chaîne vide pour ne pas forcer text-foreground).",
    "props.filtersClassName": "Override du conteneur flex de la rangée filtres (ex. centrer au lieu d'étaler).",
    "props.types": "Boutons de filtre par type d'entité (id + label) — alimente le PageFiltersContext.",
    "props.dropdownFilters": "Dropdowns de filtres (field serverData + options) — producteur du PageFiltersContext qui pilote les listes de la page.",
    "props.buttons": "Boutons d'action (ActionButtonSchema partagé — modal costumForm, lien…).",
    "props.showSearch": "Affiche la recherche texte du bandeau.",
    "props.compact": "Padding réduit (py-4) quand une section title porte déjà le titre au-dessus — évite ~64px de vide.",
    "props.showActiveFiltersTags": "Chips de filtres actifs sous la barre : true/absent partout, desktop|mobile ciblé, false masqué.",
  },

  "section:filters": {
    "props.filterGroups": "Groupes de filtres de la sidebar : type scopeList (zones), filters (options statiques, défaut) ou entityList (options peuplées par recherche backend).",
    "props.filterGroups[].baseParams": "entityList : recherche backend qui peuple les options (même forme que baseParams des sections).",
    "props.filterGroups[].filterType": "entityList : sourceKey → la sélection s'injecte dans baseParams.sourceKey des listes (matching source.key backend).",
    "props.filterGroups[].filterBy": "Champ de l'entité utilisé comme valeur de filtre (défaut code : slug).",
    "props.filterGroups[].select": "Widget compact select (multiple/searchable) au lieu de l'accordéon.",
    "props.filterGroups[].optionStyle": "Style des lignes en accordéon : checkbox (défaut) ou check (coche à droite, look SelectItem).",
    "props.filterGroups[].order": "Position d'affichage (tri croissant) — intercale ce groupe parmi les groupes par-réponses.",
    "props.filtersByAnswers": "Filtres par réponses CoForm (record id→{path/forms/finderPath}) — sélection → filters._id.$in.",
    "props.filtersByPath": "Filtres par thématique CoForm via coformFilterByPath (thematicPath/finderPath ; notSourceKey → tout le réseau).",
    "props.defaultOpenGroups": "Ids des groupes ouverts par défaut.",
  },

  "section:cardCountCT": {
    "props.cards": "Cartes-compteurs (countKey du count globalautocomplete + label/icon/color/href) ; absent → auto-détection des types.",
    "props.baseParams": "Périmètre du count (sans sourceKey — entité costum courante).",
    "props.bg": "Fond : token sémantique OU classe Tailwind brute (ex. bg-cyan-500).",
  },

  "section:thematics": {
    "props.title": "Titre de la grille des filières (lues depuis serverData.filiere de l'entité costum — aucune requête).",
    "props.emptyMessage": "Message affiché quand l'entité n'a pas de filières.",
  },

  "section:agenda": {
    "props.customHeader": "En-tête teaser avec lien « voir tous » — même convention que searchProStatic.customHeader (home → /evenements).",
    "props.limit": "Limite d'events par bucket (teaser home) ; absent = tous + « charger plus » pour Passés.",
    "props.showViewToggle": "Toggle Liste/Calendrier (false = teaser figé sur defaultMode). Défaut code : true.",
    "props.showTabs": "Onglets temporels (false = teaser : un seul bucket = defaultTab). Défaut code : true.",
    "props.defaultMode": "Vue par défaut : list (onglets temporels) ou calendar (grille mois maison).",
    "props.enableMap": "Active la vue Carte (réutilise SearchMap du module search).",
    "props.mapView": "Rendu de la vue carte : map (plein écran) ou split (liste+carte synchronisées, desktop).",
    "props.map": "Config carte (marqueurs/popup/zoom) — MÊME schéma que searchProStatic.map.",
    "props.tabs": "Onglets affichés parmi ongoing/upcoming/past (défaut code : upcoming, ongoing, past).",
    "props.defaultTab": "Onglet initial (défaut code : upcoming).",
    "props.upcomingWindowMonths": "Fenêtre (mois) du fetch calendrier now→futur (défaut code 12).",
    "props.baseParams": "Scope searchEventsCostum — passthrough : sourceKey multi-sources (vide → costum courant) ; defaultTypes/SortBy tolérés mais IGNORÉS (searchType forcé events).",
    "props.filters": "Filtres activés : type + text (backend), tags (client).",
    "props.detailsMode": "Conteneur du détail au clic : drawer (défaut code) ou dialog.",
  },
};

/**
 * Contraintes NON exportables en JSON Schema (refinements .refine/.check,
 * dépendances entre clés, gates runtime) — imprimées en commentaire par
 * `config:schema <selector>` (axe A4).
 */
export const BLOCK_NOTES: Record<string, string[]> = {
  page: ["Unicité des `path` entre toutes les pages (refinement non exportable)."],
  header: [
    "Chaque NavItem exige au moins un de path | href | children | megaMenu (refinement).",
    "utilities.* sont des GATES de modules : search→commandPalette, auth→AuthMenu, notifications→module notification, piggyBank→cagnotte.",
  ],
  theme: [
    "La config n'est jamais parsée par Zod au runtime : fournir chaque clé explicitement (les .default() ne s'appliquent pas).",
    "Parité des tokens colors.light ⇄ colors.dark vérifiée par tests/preflight/config-integrity.test.ts.",
  ],
  commandPalette: [
    "Gate d'affichage : header.utilities.search doit être true.",
    "Précédence d'action au clic : itemActionBySubType → itemActionByType → itemAction → navigation /profil/:slug.",
  ],
  "section:searchPro": [
    "Synchronise ses filtres dans l'URL → UNE seule instance par page (multi-instances = searchProStatic).",
    "baseParams n'a PAS de sourceKey ici : recherche réseau global (périmètre costum = searchProStatic).",
  ],
  "section:searchProStatic": [
    "Conçue pour plusieurs instances par page (pas de sync URL des filtres).",
    "audit:config exige un baseParams (catégorie module-prereq) — toujours renseigner sourceKey.",
  ],
  "section:agenda": [
    "baseParams est passthrough : les clés inconnues sont TOLÉRÉES mais ignorées (searchEventsCostum force searchType=events et trie par occurrence).",
  ],
};
