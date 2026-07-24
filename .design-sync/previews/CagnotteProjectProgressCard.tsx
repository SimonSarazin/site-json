import { CagnotteProjectProgressCard } from "site-forge";

// Carte de progression de la cagnotte projet — libellés via modules/cagnotte
// (embarqué au bundle). Cagnotte « Rénovation du café des parents »,
// objectif global 5 000 € (paliers 1 500 / 3 000 / 5 000 €).

const Cadre = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
);

export const MiParcours = () => (
  <Cadre>
    <CagnotteProjectProgressCard totalAmount={3250} targetAmount={5000} />
  </Cadre>
);

export const Lancement = () => (
  <Cadre>
    <CagnotteProjectProgressCard totalAmount={180} targetAmount={5000} />
  </Cadre>
);

export const ObjectifAtteint = () => (
  <Cadre>
    <CagnotteProjectProgressCard totalAmount={5000} targetAmount={5000} />
  </Cadre>
);
