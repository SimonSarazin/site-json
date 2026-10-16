/**
 * Contenu de démonstration de l'interface « editorial » (maturation, coopérations, avis,
 * soutiens, impact), figé et identique sur tous les communs ; affiché sous `DemoNotice`.
 * En français seulement, dates sans année. Une rubrique implémentée lit le view-model
 * et sort de ce fichier.
 */

export interface DemoQuestion {
  question: string;
  answer: string;
  askedBy: string;
}

export interface DemoFeedback {
  author: string;
  kind: string;
  date: string;
  rating: number | null;
  body: string;
}

export interface DemoSupport {
  name: string;
  kind: string;
  amount: number | null;
  message: string;
}

export interface DemoImpact {
  label: string;
  value: string;
}

export interface DemoCooperation {
  kind: string;
  stage: string;
  name: string;
  place: string;
  theme: string;
  tagline: string;
  reasons: string[];
  needs: string[];
}

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    question: "Comment le projet se finance-t-il après la fin de la subvention d'amorçage ?",
    answer:
      "Une part des adhésions et une convention pluriannuelle avec la commune sont en cours de négociation pour couvrir 60 % du fonctionnement.",
    askedBy: "IA",
  },
  {
    question: "Comment la gouvernance protège-t-elle les plus petites structures ?",
    answer: "Une voix par structure quelle que soit sa taille, et un prix plancher garanti voté en assemblée.",
    askedBy: "IA",
  },
  {
    question: "Qui garantit la fiabilité des relevés citoyens ?",
    answer: "",
    askedBy: "Office de l'eau",
  },
];

export const DEMO_SUGGESTIONS: Array<{ question: string; why: string }> = [
  {
    question: "Quelle part du budget dépend de recettes propres ?",
    why: "Un financeur regarde d'abord la capacité du projet à tenir sans lui.",
  },
];

export const DEMO_FEEDBACK: DemoFeedback[] = [
  {
    author: "Nathalie",
    kind: "Avis",
    date: "24 août",
    rating: 5,
    body: "Un outil de qualité et un fonctionnement juste pour les contributeurs, on sent la différence.",
  },
  {
    author: "Service jeunesse",
    kind: "Idée",
    date: "29 août",
    rating: null,
    body: "Pensez à ouvrir un créneau le samedi matin, beaucoup de gens travaillent en semaine.",
  },
  {
    author: "Foyer testeur",
    kind: "Critique",
    date: "21 août",
    rating: 4,
    body: "Le dispositif tient bien, mais la notice mérite des schémas plus clairs.",
  },
];

export const DEMO_SUPPORTS: DemoSupport[] = [
  { name: "Jean-Marc", kind: "Bénévolat", amount: null, message: "Disponible le mercredi pour les permanences." },
  { name: "Famille Payet", kind: "Don", amount: 300, message: "Bravo pour la démarche." },
  { name: "Collectif libre 974", kind: "Soutien", amount: null, message: "Nous relayons vos outils auprès de nos adhérents." },
];

export const DEMO_IMPACT: DemoImpact[] = [
  { label: "Structures membres", value: "14" },
  { label: "Personnes accompagnées", value: "48 par semaine" },
  { label: "Bénévoles actifs", value: "19" },
];

export const DEMO_COOPERATIONS: DemoCooperation[] = [
  {
    kind: "Candidature commune",
    stage: "En développement",
    name: "Rezo Lantiy",
    place: "Saint-Paul",
    theme: "Agriculture et alimentation",
    tagline: "Réseau de fermes agroécologiques dans les Hauts de l'Ouest",
    reasons: [
      "Les deux cherchent des financements : une réponse commune à un appel à projets pèse plus lourd.",
      "Objectifs qui se recoupent autour de : formation, mutualisation.",
    ],
    needs: ["Financement", "Cofinanceurs", "Outils collectifs"],
  },
  {
    kind: "Mutualisation locale",
    stage: "En fonctionnement",
    name: "Lo Fab",
    place: "Saint-Benoît",
    theme: "Économie et emploi",
    tagline: "Un atelier de réparation partagé, ouvert à tous",
    reasons: [
      "Même territoire : un local, du matériel ou une permanence peuvent être partagés.",
      "Besoins identiques (bénévoles, visibilité et communauté) : les efforts peuvent être mis en commun.",
    ],
    needs: ["Bénévoles", "Visibilité et communauté"],
  },
];
