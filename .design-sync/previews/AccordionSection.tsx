import { AccordionSection } from "site-forge";

// Usage réel : charte des valeurs du réseau parentalité (config parent62, page /charte).
export const CharteValeurs = () => (
  <AccordionSection
    props={{
      allowMultiple: true,
      items: [
        {
          title: { fr: "La participation" },
          defaultOpen: true,
          content: { fr: "La participation des parents aux actions qui les concernent, eux ou leurs enfants, est un objectif central du réseau." },
        },
        {
          title: { fr: "Le soutien à l'initiative" },
          defaultOpen: false,
          content: { fr: "Institutions et professionnels, élus locaux et responsables associatifs ont pour responsabilité d'aider et de soutenir les initiatives des parents et des acteurs locaux." },
        },
        {
          title: { fr: "La co-éducation" },
          defaultOpen: true,
          content: { fr: "Les parents sont les premiers éducateurs de leurs enfants. À leurs côtés, plusieurs acteurs forment une chaîne éducative cohérente." },
        },
      ],
    }}
  />
);

// Mode single (une seule entrée ouverte à la fois) — historique des signataires.
export const OuvertureUnique = () => (
  <AccordionSection
    props={{
      allowMultiple: false,
      items: [
        {
          title: { fr: "Ils ont rejoint la charte : 2009 – 2012" },
          defaultOpen: true,
          content: { fr: "6 nouveaux adhérents (décembre 2009) · Communauté de communes de Desvres-Samer (2010) · Ville de Berck-sur-Mer (2010) · Culture et Liberté, le 9 de Cœur, l'APSA (2012)." },
        },
        {
          title: { fr: "2013 – 2016" },
          defaultOpen: false,
          content: { fr: "Ville d'Arques (2013) · CLAEPP à Calais (2013) · Ville de Lens (2013) · LEA, ADPEP 62, K-d'Abra (2014) · Centre Social Kaléido à Noyelles-sous-Lens (2016)." },
        },
        {
          title: { fr: "2017 – 2020" },
          defaultOpen: false,
          content: { fr: "AADCMO et ville de Lillers · Centre Socioculturel Intercommunal d'Hucqueliers · Ville de Marquise." },
        },
      ],
    }}
  />
);
