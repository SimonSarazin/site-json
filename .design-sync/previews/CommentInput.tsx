import { CommentInput } from "site-forge";

// Champ de commentaire du fil d actus : avatar + pilule muted (textarea,
// envoi, émojis). Le bouton d envoi ne s active que si le texte est non vide.

const portrait = (fond: string, buste: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="${fond}"/>` +
      `<circle cx="32" cy="24" r="11" fill="${buste}"/>` +
      `<path d="M10 58c2-13 11-19 22-19s20 6 22 19z" fill="${buste}"/>` +
    `</svg>`
  );

export const Defaut = () => (
  <div style={{ maxWidth: 640, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
    <CommentInput
      userPhoto={portrait("#dbeafe", "#3b6ea5")}
      userName="Claire Mercier"
      placeholder="Écrire un commentaire…"
      onSubmit={() => {}}
    />
  </div>
);

export const AvecTexte = () => (
  <div style={{ maxWidth: 640, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
    <CommentInput
      userPhoto={portrait("#fef3c7", "#b45f3c")}
      userName="Karim Bellal"
      placeholder="Écrire un commentaire…"
      initialValue="Merci pour ce bel atelier, les enfants ont adoré !"
      onSubmit={() => {}}
    />
  </div>
);

export const PetitSansPhoto = () => (
  <div style={{ maxWidth: 480, margin: "0 auto", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
    <CommentInput
      userName="Sophie Danel"
      placeholder="Répondre à Claire…"
      size="small"
      onSubmit={() => {}}
    />
  </div>
);
