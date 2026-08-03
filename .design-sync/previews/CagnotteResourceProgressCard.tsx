import { CagnotteResourceProgressCard } from "site-forge";

// Carte de progression de la cagnotte d'une ressource — projet ou proposition
// (ex-CagnotteProjectProgressCard). Libellés via modules/cagnotte (embarqué au
// bundle) : `selectorType` pilote le contexte i18n ("Cagnotte du projet" vs
// "Cagnotte de la proposition").
// Cagnotte « Rénovation du café des parents », objectif global 5 000 €.

const configProjet = {
  selectorType: "project" as const,
  financerTags: [],
  defaultPredefinedAmounts: [10, 20, 30, 50],
  context: "",
  showInfoText: true,
  allowPersonToFinance: true,
  allowContributionWithoutPaiement: true,
};

const configProposition = {
  ...configProjet,
  selectorType: "proposition" as const,
  financerTags: ["financeur"],
  showInfoText: false,
};

const Cadre = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
);

export const MiParcours = () => (
  <Cadre>
    <CagnotteResourceProgressCard
      totalAmount={3250}
      targetAmount={5000}
      cagnotteConfig={configProjet}
      context=""
    />
  </Cadre>
);

export const Lancement = () => (
  <Cadre>
    <CagnotteResourceProgressCard
      totalAmount={180}
      targetAmount={5000}
      cagnotteConfig={configProjet}
      context=""
    />
  </Cadre>
);

export const ObjectifAtteint = () => (
  <Cadre>
    <CagnotteResourceProgressCard
      totalAmount={5000}
      targetAmount={5000}
      cagnotteConfig={configProjet}
      context=""
    />
  </Cadre>
);

export const SurProposition = () => (
  <Cadre>
    <CagnotteResourceProgressCard
      totalAmount={1200}
      targetAmount={4000}
      cagnotteConfig={configProposition}
      context=""
    />
  </Cadre>
);
