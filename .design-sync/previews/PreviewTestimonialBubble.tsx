import { PreviewTestimonialBubble } from "site-forge";

// Détail « bulle » (contenu de la modale detailsMode:"dialog") : en-tête (pastille catégorie + titre +
// attribution accent·date), LECTEUR AUDIO mis en avant, citation en pulled-quote teinté catégorie, puis
// « repères » GÉNÉRIQUES (aucun champ en dur) issus de `list.testimonial.facets` — pills ClickableFacet
// (texte simple hors app, car aucun dropdownFilter n'indexe le champ ici). L'en-tête réserve `pr-12`
// (place de la croix de fermeture du conteneur). Données via `item.serverData`. Date FIXE.

const AUDIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

const list = {
  testimonial: {
    design: "bubble",
    quoteField: "description",
    titleField: "name",
    dateField: "created",
    audioField: "medias",
    badge: {
      field: "category",
      colors: { "Compliqué": "var(--chart-3)", "Difficile": "var(--chart-2)", "À changer": "var(--chart-4)" },
    },
    accent: {
      field: "territoires",
      colors: { "Arrageois": "#6d5da8", "Boulonnais": "#c34a42", "Calaisis": "#ed8a4c" },
    },
    facets: [
      { field: "territoires", label: { fr: "Territoires", en: "Territories" } },
      { field: "publics", label: { fr: "Publics", en: "Audiences" } },
      { field: "ages", label: { fr: "Âges", en: "Ages" } },
      { field: "themes", label: { fr: "Thèmes", en: "Themes" } },
    ],
  },
};

const panel: React.CSSProperties = {
  maxWidth: 620,
  margin: "0 auto",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius, 12px)",
  background: "var(--card)",
  overflow: "hidden",
};

export const Temoignage = () => (
  <div style={panel}>
    <PreviewTestimonialBubble
      list={list}
      item={{
        serverData: {
          name: "Une maman de l'Arrageois",
          description:
            "Au début, je croyais que je n'y arriverais jamais seule.\n\nCe qui m'a aidée, ce n'est pas un conseil miracle : c'est d'avoir trouvé un endroit où poser mes questions sans être jugée. On se rend compte qu'on n'est pas la seule à galérer le soir au coucher — et rien que d'en parler, ça allège tout.",
          created: 1749686400000, // 12 juin 2025
          category: "Compliqué",
          territoires: "Arrageois",
          publics: "Parents solos",
          ages: "0-3 ans",
          themes: "Sommeil",
          medias: [{ type: "audio", url: AUDIO }],
        },
      }}
    />
  </div>
);

export const SansVoix = () => (
  <div style={panel}>
    <PreviewTestimonialBubble
      list={list}
      item={{
        serverData: {
          name: "Un papa du Boulonnais",
          description:
            "La séparation, on n'en parle jamais côté pères. Trouver un groupe où poser mes questions sans être jugé m'a aidé à retrouver ma place, et surtout à rester un repère stable pour mes enfants.",
          created: 1743465600000, // 1 avril 2025
          category: "Difficile",
          territoires: "Boulonnais",
          publics: "Pères",
          themes: "Séparation",
        },
      }}
    />
  </div>
);
