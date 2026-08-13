export const SECTION_FAMILIES = [
  "hero",
  "contenu",
  "layout",
  "cta",
  "media",
  "presentation",
  "data",
  "utilitaires",
  "formulaire",
  "auth",
  "search",
  "news",
  "notification",
  "profil",
  "ampli",
  "coform",
  "cagnotte",
  "observatoire",
  "agenda",
  "blog",
  "aac",
] as const;

export type SectionFamily = (typeof SECTION_FAMILIES)[number];

export interface SectionMeta {
  label: string;
  desc: string;
  image: string;
  family: SectionFamily;
}

// Parité avec la discriminatedUnion `Section` (src/types/site-schema.ts) garantie
// par tests/preflight/section-meta.test.ts : toute section ajoutée sans entrée ici
// casse le préflight.
const SECTION_META: Record<string, SectionMeta> = {
  // hero
  hero: { label: "Hero", desc: "Bannière principale avec titre, sous-titre et CTA", image: "https://placehold.co/300x180/1a1a2e/eee?text=Hero", family: "hero" },
  heroWithIcon: { label: "Hero avec icône", desc: "Hero avec icône Lucide en médaillon au-dessus du titre, fond image ou vidéo, CTA et liste d'items à icônes optionnelle", image: "https://placehold.co/300x180/1a1a2e/eee?text=Hero+Icon", family: "hero" },
  "hero-search": { label: "Hero recherche", desc: "Hero avec barre de recherche et autocomplete intégrés (pilote la liste de la page)", image: "https://placehold.co/300x180/1a1a2e/eee?text=Hero+Search", family: "hero" },
  "hero-parallax": { label: "Hero parallaxe", desc: "Hero plein écran à fond parallaxe, glow et badges", image: "https://placehold.co/300x180/0984e3/eee?text=Hero+Parallax", family: "hero" },
  "hero-quick-access": { label: "Hero accès rapide", desc: "Hero scindé avec pile de cartes d'accès rapide (portail)", image: "https://placehold.co/300x180/00b894/eee?text=Quick+Access", family: "hero" },
  "hero-tinted-overlay": { label: "Hero voile teinté", desc: "Hero plein écran à voile teinté et double slogan", image: "https://placehold.co/300x180/00cec9/eee?text=Tinted+Overlay", family: "hero" },
  "hero-carousel": { label: "Hero carrousel", desc: "Hero plein écran à diapositives, socle scroll-snap, puces et auto-avance optionnelle", image: "https://placehold.co/300x180/00cec9/eee?text=Hero+Carousel", family: "hero" },
  "hero-entity-banner": { label: "Hero bannière entité", desc: "Bannière/logo/titre sourcés depuis l'entité Cocolight", image: "https://placehold.co/300x180/6c5ce7/eee?text=Entity+Banner", family: "hero" },

  // contenu
  markdown: { label: "Markdown", desc: "Contenu Markdown rendu en HTML", image: "https://placehold.co/300x180/636e72/eee?text=Markdown", family: "contenu" },
  content: { label: "Content", desc: "Bloc de contenu texte riche", image: "https://placehold.co/300x180/636e72/eee?text=Content", family: "contenu" },
  title: { label: "Title", desc: "Titre de section simple", image: "https://placehold.co/300x180/dfe6e9/333?text=Title", family: "contenu" },
  html: { label: "HTML", desc: "Code HTML libre et personnalisé", image: "https://placehold.co/300x180/2d3436/eee?text=HTML", family: "contenu" },
  banner: { label: "Banner", desc: "Bandeau d'annonce ou promotion", image: "https://placehold.co/300x180/fdcb6e/333?text=Banner", family: "contenu" },

  // layout
  cards: { label: "Cards", desc: "Grille de cartes avec image, titre et description", image: "https://placehold.co/300x180/2d3436/eee?text=Cards", family: "layout" },
  gridLayout: { label: "Grid Layout", desc: "Mise en page en grille flexible", image: "https://placehold.co/300x180/dfe6e9/333?text=Grid+Layout", family: "layout" },
  "features-glass": { label: "Features glass", desc: "Grille de cartes-icônes glassmorphism (fade-in décalé)", image: "https://placehold.co/300x180/00b894/eee?text=Features+Glass", family: "layout" },
  "action-tiles": { label: "Tuiles d'action", desc: "Grille de grandes tuiles-boutons de navigation", image: "https://placehold.co/300x180/6c5ce7/eee?text=Action+Tiles", family: "layout" },
  "expandable-actions": { label: "Actions dépliables", desc: "Cartes d'action en accordéon exclusif ouvrant des modales", image: "https://placehold.co/300x180/6c5ce7/eee?text=Expandable", family: "layout" },
  "categories-grid": { label: "Grille de catégories", desc: "Grille de cartes de catégories thématiques (icône, titre, sous-titre, lien, tous optionnels), 2 à 6 colonnes, variantes primary/accent/frosted", image: "https://placehold.co/300x180/00b894/eee?text=Categories", family: "layout" },

  // cta
  cta: { label: "CTA", desc: "Appel à l'action avec titre et bouton", image: "https://placehold.co/300x180/6c5ce7/eee?text=CTA", family: "cta" },
  "cta-card-grid": { label: "Grille de cartes CTA", desc: "Grille de cartes portant chacune son bouton d'action (+ stats)", image: "https://placehold.co/300x180/e17055/eee?text=CTA+Grid", family: "cta" },
  "cta-newsletter": { label: "CTA newsletter", desc: "Appel à l'action avec capture newsletter intégrée", image: "https://placehold.co/300x180/a29bfe/eee?text=CTA+News", family: "cta" },
  newsletter: { label: "Newsletter", desc: "Formulaire d'inscription email", image: "https://placehold.co/300x180/e84393/eee?text=Newsletter", family: "cta" },

  // media
  gallery: { label: "Gallery", desc: "Galerie d'images en grille ou masonry", image: "https://placehold.co/300x180/636e72/eee?text=Gallery", family: "media" },
  video: { label: "Video", desc: "Lecteur vidéo intégré (YouTube, Vimeo)", image: "https://placehold.co/300x180/0984e3/eee?text=Video", family: "media" },
  logoCloud: { label: "Logo Cloud", desc: "Logos partenaires ou clients", image: "https://placehold.co/300x180/b2bec3/333?text=Logo+Cloud", family: "media" },

  // presentation
  testimonials: { label: "Testimonials", desc: "Témoignages clients avec photo et citation", image: "https://placehold.co/300x180/fdcb6e/333?text=Testimonials", family: "presentation" },
  pricing: { label: "Pricing", desc: "Tableau de tarifs avec plans", image: "https://placehold.co/300x180/a29bfe/eee?text=Pricing", family: "presentation" },
  faq: { label: "FAQ", desc: "Questions fréquentes en accordéon", image: "https://placehold.co/300x180/00b894/eee?text=FAQ", family: "presentation" },
  team: { label: "Team", desc: "Présentation de l'équipe avec photos", image: "https://placehold.co/300x180/e17055/eee?text=Team", family: "presentation" },
  stats: { label: "Stats", desc: "Chiffres clés et statistiques", image: "https://placehold.co/300x180/00cec9/eee?text=Stats", family: "presentation" },
  accordion: { label: "Accordion", desc: "Blocs dépliables avec contenu", image: "https://placehold.co/300x180/fab1a0/333?text=Accordion", family: "presentation" },
  tabs: { label: "Tabs", desc: "Contenu organisé en onglets", image: "https://placehold.co/300x180/81ecec/333?text=Tabs", family: "presentation" },
  steps: { label: "Steps", desc: "Étapes numérotées d'un processus", image: "https://placehold.co/300x180/55efc4/333?text=Steps", family: "presentation" },
  timeline: { label: "Timeline", desc: "Frise chronologique d'événements", image: "https://placehold.co/300x180/74b9ff/333?text=Timeline", family: "presentation" },
  comparison: { label: "Comparison", desc: "Tableau comparatif de fonctionnalités", image: "https://placehold.co/300x180/a29bfe/eee?text=Comparison", family: "presentation" },
  featureComparison: { label: "Feature Comparison", desc: "Comparaison détaillée de fonctionnalités", image: "https://placehold.co/300x180/74b9ff/333?text=Feature+Comp", family: "presentation" },
  productShowcase: { label: "Product Showcase", desc: "Vitrine de produits", image: "https://placehold.co/300x180/00b894/eee?text=Products", family: "presentation" },
  eventList: { label: "Event List", desc: "Liste d'événements", image: "https://placehold.co/300x180/fdcb6e/333?text=Events", family: "presentation" },

  // data
  chart: { label: "Chart", desc: "Graphiques et visualisations", image: "https://placehold.co/300x180/6c5ce7/eee?text=Chart", family: "data" },
  table: { label: "Table", desc: "Tableau de données structurées", image: "https://placehold.co/300x180/dfe6e9/333?text=Table", family: "data" },
  map: { label: "Map", desc: "PLACEHOLDER non fonctionnel : encadré gris + liste texte des marqueurs (aucun rendu Leaflet). Pour une vraie carte : searchPro/searchProStatic (defaultViewMode \"map\") ou agenda (enableMap)", image: "https://placehold.co/300x180/00b894/eee?text=Map", family: "data" },
  "map-bubbles": { label: "Carte à bulles", desc: "Illustration de carte avec bulles-marqueurs cliquables positionnées en %, image ronde + libellé en pastille, titre en badge incliné", image: "https://placehold.co/300x180/e17055/eee?text=Map+Bubbles", family: "presentation" },

  // utilitaires
  breadcrumb: { label: "Breadcrumb", desc: "Fil d'Ariane de navigation", image: "https://placehold.co/300x180/b2bec3/333?text=Breadcrumb", family: "utilitaires" },
  cookieConsent: { label: "Cookie Consent", desc: "Bannière de consentement cookies", image: "https://placehold.co/300x180/2d3436/eee?text=Cookie", family: "utilitaires" },
  socialFeed: { label: "Social Feed", desc: "Flux de réseaux sociaux", image: "https://placehold.co/300x180/e84393/eee?text=Social+Feed", family: "utilitaires" },

  // formulaire
  contactForm: { label: "Contact Form", desc: "Formulaire de contact complet", image: "https://placehold.co/300x180/0984e3/eee?text=Contact+Form", family: "formulaire" },

  // auth
  loginForm: { label: "Login Form", desc: "Formulaire de connexion", image: "https://placehold.co/300x180/0984e3/eee?text=Login", family: "auth" },
  registerForm: { label: "Register Form", desc: "Formulaire d'inscription", image: "https://placehold.co/300x180/00cec9/eee?text=Register", family: "auth" },
  recoverPasswordForm: { label: "Recover Password", desc: "Formulaire de récupération de mot de passe", image: "https://placehold.co/300x180/a29bfe/eee?text=Recover+PWD", family: "auth" },

  // search
  searchPro: { label: "Search Pro", desc: "Recherche avancée avec filtres", image: "https://placehold.co/300x180/0984e3/eee?text=Search+Pro", family: "search" },
  searchProStatic: { label: "Search Static", desc: "Recherche statique avec résultats pré-chargés", image: "https://placehold.co/300x180/74b9ff/333?text=Search+Static", family: "search" },
  filters: { label: "Filters", desc: "Barre de filtres pour le contenu", image: "https://placehold.co/300x180/55efc4/333?text=Filters", family: "search" },
  searchHeader: { label: "Header recherche", desc: "Bandeau horizontal titre + recherche texte, dropdowns de filtres et boutons d'action, producteur du PageFiltersContext (module search) pilotant les listes de la page", image: "https://placehold.co/300x180/74b9ff/333?text=Search+Header", family: "search" },
  cardCountCT: { label: "Compteurs par type", desc: "Grille de compteurs par type d'entité (count de globalautocomplete, sans liste de résultats) ; requiert l'entité costum initialisée, cards[] optionnel avec auto-détection sinon", image: "https://placehold.co/300x180/0984e3/eee?text=Card+Count", family: "search" },
  thematics: { label: "Thématiques", desc: "Grille des filières/thématiques (icône + nom) lues depuis serverData.filiere de l'entité Cocolight, sans requête supplémentaire (module search)", image: "https://placehold.co/300x180/6c5ce7/eee?text=Thematics", family: "search" },
  "featured-carousel": { label: "Carrousel à la une", desc: "Carrousel plein écran d'entités (POI…) filtrées par tag, une par diapositive : badge, titre, description, CTA et image", image: "https://placehold.co/300x180/74b9ff/333?text=Featured", family: "search" },

  // news
  news: { label: "News", desc: "Fil d'actualités", image: "https://placehold.co/300x180/e17055/eee?text=News", family: "news" },

  // notification
  notifications: { label: "Notifications", desc: "Liste plein-format des notifications de l'utilisateur connecté (tout marquer lu, tout effacer) ; auth requise, message de connexion sinon", image: "https://placehold.co/300x180/e17055/eee?text=Notifications", family: "notification" },

  // profil
  member: { label: "Member", desc: "Section membre / profil", image: "https://placehold.co/300x180/6c5ce7/eee?text=Member", family: "profil" },

  // ampli
  meeteem: { label: "Meeteem", desc: "Annuaire participatif des réponses d'un coform : cartes filtrables par tags et auteur, vues Annuaire/Carte/Split (carte en placeholder ; requiert id du coform et mapping path)", image: "https://placehold.co/300x180/a29bfe/eee?text=Meeteem", family: "ampli" },

  // coform
  coform: { label: "CoForm", desc: "Formulaire dynamique chargé depuis le backend Cocolight via son formId, mono ou multi-étapes (variant wizard/default ou auto), avec redirection post-soumission", image: "https://placehold.co/300x180/00cec9/eee?text=CoForm", family: "coform" },

  // toolsCatalog
  toolsCatalog: { label: "Catalogue d'outils", desc: "Catalogue générique d'outils d'usage synthétisé depuis les réponses coform (formId/step/finderPath), avec recherche, filtres (catégorie/usage/open-source) et pagination CÔTÉ SERVEUR (défilement infini), plus une modale détaillant les lieux utilisateurs et leur satisfaction, le commun porteur, un bouton de réponse au questionnaire et l'édition de l'enrichissement pour les admins du costum", image: "https://placehold.co/300x180/6c5ce7/eee?text=Outils", family: "search" },

  // cagnotte
  actions: { label: "Actions cagnotte", desc: "Liste détaillée des actions par milestone d'un projet cagnotte, avec CRUD complet actions et milestones (candidature, complétion, clôture) — typiquement en tab profil project", image: "https://placehold.co/300x180/fdcb6e/333?text=Actions", family: "cagnotte" },
  finance: { label: "Finance", desc: "Liste des milestones de financement du projet : progression, transactions, contribution, gestion (module cagnotte ; utilisateur connecté ; projet ciblé via id de section ou profil visité)", image: "https://placehold.co/300x180/00b894/eee?text=Finance", family: "cagnotte" },
  "actions-summary": { label: "Synthèse actions", desc: "Carte sidebar synthétisant les actions d'un projet cagnotte : progression, compteurs, contributeurs, ajout de jalon (projet via idProjet ou page profil ; données si connecté)", image: "https://placehold.co/300x180/fab1a0/333?text=Actions+Summary", family: "cagnotte" },
  "finance-summary": { label: "Synthèse finance", desc: "Carte sidebar de synthèse du financement d'un projet : progression, KPIs, financeurs, boutons Soutenir et ajout de jalon selon permissions (cible idProjet ou page profil projet)", image: "https://placehold.co/300x180/55efc4/333?text=Finance+Summary", family: "cagnotte" },
  "cagnotte-layout": { label: "Layout cagnotte", desc: "Conteneur 2 colonnes (détail 2/3, sidebar synthèse 1/3) montant un CagnotteProvider partagé autour des sections cagnotte imbriquées via leftSections/rightSections", image: "https://placehold.co/300x180/2d3436/eee?text=Cagnotte", family: "cagnotte" },

  // observatoire
  "data-observatory": { label: "Observatoire de données", desc: "Dashboard déclaratif : dimensions, KPI, graphiques, filtres et table pilotés par la config", image: "https://placehold.co/300x180/0984e3/eee?text=Observatory", family: "observatoire" },

  // agenda
  agenda: { label: "Agenda", desc: "Events d'un costum : liste (onglets temporels), calendrier (mois/semaine/jour), carte et split", image: "https://placehold.co/300x180/0984e3/eee?text=Agenda", family: "agenda" },

  // blog
  blogList: { label: "Blog List", desc: "Liste d'articles de blog", image: "https://placehold.co/300x180/e17055/eee?text=Blog+List", family: "blog" },
  blogPost: { label: "Blog Post", desc: "Article de blog complet", image: "https://placehold.co/300x180/fab1a0/333?text=Blog+Post", family: "blog" },
  articleFeed: { label: "Fil d'articles", desc: "Fil paginé (scroll infini) des articles d'un costum (module blog, costumSlug requis), variantes de carte et grille/liste, lecture via /blog/:slug ou /blog/id/:id", image: "https://placehold.co/300x180/e84393/eee?text=Article+Feed", family: "blog" },
  articleReader: { label: "Lecteur d'article", desc: "Affiche un article (POI) précis par slug ou id sur n'importe quelle page — île client du module blog, sans SEO propre", image: "https://placehold.co/300x180/636e72/eee?text=Article+Reader", family: "blog" },
  articleTeaser: { label: "Aperçu d'articles", desc: "Aperçu figé des N derniers articles d'un costum (module blog, costumSlug requis) : titre en badge incliné, grille de cartes à bouton, CTA « voir tout » — sans pagination, pensé pour être posé entre deux sections", image: "https://placehold.co/300x180/00b894/eee?text=Article+Teaser", family: "blog" },
  // aac
  aac: { label: "Appel à Communs", desc: "Appel à Communs (AAC) — socle : aperçu de la configuration résolue d'un formulaire aap/aac", image: "https://placehold.co/300x180/00b894/eee?text=AAC", family: "aac" },
  "aac-directory": { label: "Annuaire des communs", desc: "Listing paginé des communs d'un Appel à Communs : cartes avec cofinancement collecté, filtres par nom, thème et maturité", image: "https://placehold.co/300x180/00cec9/eee?text=Annuaire+communs", family: "aac" },
};

export default SECTION_META;
