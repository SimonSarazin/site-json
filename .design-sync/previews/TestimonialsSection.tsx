import { TestimonialsSection } from "site-forge";

// Avatars : data-URI SVG (cercle coloré + initiales) — jamais d'URL http.
const avatar = (initials: string, bg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${bg}"/><text x="48" y="52" font-family="Verdana,sans-serif" font-size="34" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`
  );

// Grille de témoignages de parents et de professionnels.
export const Grille = () => (
  <TestimonialsSection
    props={{
      style: "grid",
      autoplay: false,
      items: [
        {
          quote: { fr: "Le café des parents m'a permis de sortir de l'isolement après la naissance de ma fille. On y parle sans jugement." },
          author: { fr: "Sophie M." },
          role: { fr: "Maman de deux enfants, Lens" },
          avatar: avatar("SM", "#4054b2"),
        },
        {
          quote: { fr: "Grâce au réseau, notre petite association touche aujourd'hui des familles de tout le Ternois." },
          author: { fr: "Marc Lefebvre" },
          role: { fr: "Président d'association, Saint-Pol-sur-Ternoise" },
          avatar: avatar("ML", "#3f7d4e"),
        },
        {
          quote: { fr: "Les formations croisées entre professionnels et parents ont changé notre façon d'accueillir les familles." },
          author: { fr: "Nadia Cherkaoui" },
          role: { fr: "Référente famille, centre social de Calais" },
          avatar: avatar("NC", "#5d4a9c"),
        },
      ],
    }}
  />
);

// Carrousel (autoplay désactivé pour une capture déterministe) : une carte + navigation.
export const Carrousel = () => (
  <TestimonialsSection
    props={{
      style: "carousel",
      autoplay: false,
      items: [
        {
          quote: { fr: "En dix ans de réseau, je n'ai jamais vu un parent repartir d'une rencontre sans un contact ou une idée." },
          author: { fr: "Isabelle Duquesne" },
          role: { fr: "Coordinatrice territoriale, Audomarois" },
          avatar: avatar("ID", "#2f7f8e"),
        },
        {
          quote: { fr: "L'atelier « parents d'ados » m'a donné des clés concrètes pour renouer le dialogue avec mon fils." },
          author: { fr: "Farid B." },
          role: { fr: "Papa d'un adolescent, Béthune" },
          avatar: avatar("FB", "#b2743d"),
        },
        {
          quote: { fr: "Le réseau, c'est la garantie de ne jamais être seul face à une situation familiale complexe." },
          author: { fr: "Claire Pottier" },
          role: { fr: "Travailleuse sociale, CAF du Pas-de-Calais" },
          avatar: avatar("CP", "#a8443a"),
        },
      ],
    }}
  />
);
