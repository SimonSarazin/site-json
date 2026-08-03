import { CagnotteSuccessScreen } from "site-forge";

// Écran post-paiement de la cagnotte : célébration d'objectif atteint
// (objectiveReached) ou simple remerciement (null).

export const PalierAtteint = () => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>
    <CagnotteSuccessScreen
      objectiveReached={{
        target: 3000,
        label: "Palier 2 — mobilier et peinture",
        description:
          "Grâce à vous, le café des parents sera repeint et remeublé avant l'hiver.",
      }}
    />
  </div>
);

export const Remerciement = () => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>
    <CagnotteSuccessScreen objectiveReached={null} />
  </div>
);
