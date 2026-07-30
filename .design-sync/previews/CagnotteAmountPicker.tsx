import { CagnotteAmountPicker } from "site-forge";

// Sélecteur de montant de contribution (montants prédéfinis + montant libre).
// Composant contrôlé : la sélection vient des props — captures figées.

const Cadre = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
    {children}
  </div>
);

const commun = {
  predefinedAmounts: [10, 25, 50, 100],
  isProcessing: false,
  onPredefinedAmountClick: () => {},
  onCustomAmountChange: () => {},
};

export const MontantPredefini = () => (
  <Cadre>
    <CagnotteAmountPicker
      {...commun}
      selectedAmountType="predefined"
      selectedPredefinedAmount={50}
      customAmount=""
      maxContributionAmount={1250}
      remainingToFinanceAmount={1250}
    />
  </Cadre>
);

export const MontantLibre = () => (
  <Cadre>
    <CagnotteAmountPicker
      {...commun}
      selectedAmountType="custom"
      selectedPredefinedAmount={null}
      customAmount="75"
      maxContributionAmount={3000}
      remainingToFinanceAmount={0}
    />
  </Cadre>
);

export const PlafondProche = () => (
  <Cadre>
    <CagnotteAmountPicker
      {...commun}
      selectedAmountType="predefined"
      selectedPredefinedAmount={25}
      customAmount=""
      maxContributionAmount={40}
      remainingToFinanceAmount={40}
    />
  </Cadre>
);
