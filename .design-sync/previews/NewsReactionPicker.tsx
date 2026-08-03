import { NewsReactionPicker } from "site-forge";

// Palette flottante des 8 réactions du fil d actus (couleurs sémantiques par
// émotion, cf. voteTypes). Apparaît au survol du bouton « Réagir » d une actu.

export const Palette = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
    <NewsReactionPicker onSelect={() => {}} />
  </div>
);

export const AuDessusDuneActu = () => (
  <div style={{ maxWidth: 480, margin: "0 auto", padding: "8px 0" }}>
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
      }}
    >
      <p style={{ fontSize: 14, color: "var(--foreground)", margin: 0 }}>
        Les inscriptions à l atelier portage du 14 juin sont ouvertes — il reste 6 places !
      </p>
      <div style={{ marginTop: 16, display: "flex" }}>
        <NewsReactionPicker onSelect={() => {}} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          borderTop: "1px solid var(--border)",
          marginTop: 12,
          paddingTop: 10,
          fontSize: 13,
          color: "var(--muted-foreground)",
        }}
      >
        <span>Réagir</span>
        <span>Commenter</span>
        <span>Partager</span>
      </div>
    </div>
  </div>
);
