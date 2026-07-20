import { Toggle } from "site-forge";
import { Bell, BellOff, Bookmark, Eye } from "lucide-react";

// defaultPressed pour montrer l'état on (data-[state=on]:bg-accent) sans
// interaction — capture statique.

export const Etats = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Toggle aria-label="Suivre ce lieu">
      <Bookmark />
      Suivre
    </Toggle>
    <Toggle defaultPressed aria-label="Notifications activées">
      <Bell />
      Notifications
    </Toggle>
    <Toggle disabled aria-label="Indisponible">
      <BellOff />
      Indisponible
    </Toggle>
  </div>
);

export const Contour = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Toggle variant="outline" aria-label="Afficher les archives">
      <Eye />
      Archives
    </Toggle>
    <Toggle variant="outline" defaultPressed aria-label="Événements passés inclus">
      Événements passés
    </Toggle>
  </div>
);

export const Tailles = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    <Toggle size="sm" variant="outline" defaultPressed>
      Petit
    </Toggle>
    <Toggle size="default" variant="outline" defaultPressed>
      Normal
    </Toggle>
    <Toggle size="lg" variant="outline" defaultPressed>
      Grand
    </Toggle>
  </div>
);
