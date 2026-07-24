import { LoadingState } from "site-forge";

// États de chargement du module profil. Le spinner est figé par le gel des
// animations (arc statique) — les variantes skeleton restent parlantes en
// capture. `message` explicite pour éviter la clé i18n par défaut.

export const Spinner = () => (
  <LoadingState variant="spinner" size="lg" message="Chargement du profil…" />
);

export const Squelette = () => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>
    <LoadingState variant="skeleton" rows={4} />
  </div>
);

export const ListeUtilisateurs = () => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>
    <LoadingState variant="list" rows={3} />
  </div>
);
