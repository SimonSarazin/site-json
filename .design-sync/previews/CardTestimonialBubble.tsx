import { CardTestimonialBubble } from "site-forge";

// Card « bulle de parole » (design testimonial) : la CITATION est le héros, posée dans une bulle
// teintée de la catégorie (badge), avec pastille catégorie, point d'accent (territoire), sous-titre
// (thème), date, et une puce « Écouter » quand une voix existe. Tout est lu sur `item.serverData`
// via le contrat `list.testimonial` (ici la config réelle du site parent62). Dates FIXES.

// WAV silencieux (0 s) : le contrat `medias:[{type:"audio"}]` déclenche juste la puce « Écouter » sur la card.
const AUDIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

const list = {
  testimonial: {
    design: "bubble",
    quoteField: "description",
    titleField: "name",
    dateField: "created",
    audioField: "medias",
    subtitleField: "themes",
    badge: {
      field: "category",
      colors: { "Compliqué": "var(--chart-3)", "Difficile": "var(--chart-2)", "À changer": "var(--chart-4)" },
    },
    accent: {
      field: "territoires",
      colors: { "Arrageois": "#6d5da8", "Boulonnais": "#c34a42", "Calaisis": "#ed8a4c", "Audomarois": "#e5af32" },
    },
    facets: [
      { field: "territoires", label: { fr: "Territoires", en: "Territories" } },
      { field: "publics", label: { fr: "Publics", en: "Audiences" } },
    ],
  },
};

const item = (serverData: Record<string, unknown>) => ({ serverData });

export const Temoignage = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardTestimonialBubble
      list={list}
      item={item({
        name: "Une maman de l'Arrageois",
        description:
          "Au début, je croyais que je n'y arriverais jamais seule. Le café des parents m'a montré que je n'étais pas la seule à galérer le soir au coucher — et rien que d'en parler, ça change déjà tout.",
        created: 1749686400000, // 12 juin 2025
        category: "Compliqué",
        territoires: "Arrageois",
        themes: "Sommeil",
        publics: "Parents solos",
        medias: [{ type: "audio", url: AUDIO }],
      })}
    />
  </div>
);

export const SansAudio = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardTestimonialBubble
      list={list}
      item={item({
        name: "Un papa du Boulonnais",
        description:
          "La séparation, on n'en parle jamais côté pères. Trouver un groupe où poser mes questions sans être jugé, ça m'a vraiment aidé à retrouver ma place auprès de mes enfants.",
        created: 1743465600000, // 1 avril 2025
        category: "Difficile",
        territoires: "Boulonnais",
        themes: "Séparation",
        publics: "Pères",
      })}
    />
  </div>
);

export const AChanger = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardTestimonialBubble
      list={list}
      item={item({
        name: "Une assistante maternelle du Calaisis",
        description:
          "Les familles arrivent parfois épuisées, et on n'a pas toujours les mots. Il faudrait plus de relais entre nous, les pros de la petite enfance, pour ne pas rester seules face aux situations lourdes.",
        created: 1746057600000, // 1 mai 2025
        category: "À changer",
        territoires: "Calaisis",
        themes: "Petite enfance",
        publics: "Professionnels",
        medias: [{ type: "audio", url: AUDIO }],
      })}
    />
  </div>
);
