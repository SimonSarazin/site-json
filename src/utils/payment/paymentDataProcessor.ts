/**
 * Utilitaire pour traiter et préparer les données de paiement cagnotte
 * Convertit les données de PaymentConfigPage au format de stockage Answer
 */

export interface PaymentFinancingData {
  milestone: string; // milestoneId
  amount: number; // montant alloué à ce milestone
  currentFunding?: number; // financement actuel avant contribution
  targetAmount?: number; // montant cible du milestone
  finalAmount?: number; // financement après contribution (currentFunding + amount)
}

export interface ContributionRecord {
  amount: number; // montant du financement
  user: string; // ID utilisateur (userId ou organizationId)
  type: "citoyens" | "organizations"; // type du contributeur
  date: string; // ISO date string
  paymentMethod: "stripe" | "helloasso"; // méthode de paiement
  transactionId: string; // ID transaction de la plateforme
}

/**
 * Prépare les enregistrements de contribution au format Answer
 * Ces enregistrements seront ajoutés à la liste des financeurs (financer[])
 * pour chaque dépense correspondante
 */
export const buildContributionRecords = (
  financing: PaymentFinancingData[],
  contributorType: "citoyens" | "organizations",
  contributorId: string,
  paymentMethod: "stripe" | "helloasso",
  transactionId: string
): Map<string, ContributionRecord> => {
  const records = new Map<string, ContributionRecord>();

  financing.forEach((fin) => {
    if (fin.amount > 0) {
      const record: ContributionRecord = {
        amount: fin.amount,
        user: contributorId,
        type: contributorType === "person" ? "citoyens" : "organizations",
        date: new Date().toISOString(),
        paymentMethod,
        transactionId,
      };

      records.set(fin.milestone, record);
    }
  });

  return records;
};

/**
 * Prépare les données de dépense (depense) pour chaque milestone financé
 * Format compatible avec Answer.answers.aapStep1.depense[]
 */
export const buildDepenseUpdate = (
  milestoneId: string,
  milestoneName: string,
  targetAmount: number,
  currentFunding: number,
  contributionAmount: number,
  contributionRecord: ContributionRecord
) => ({
  milestone: milestoneId,
  name: milestoneName,
  price: targetAmount,
  currentFunding, // Will be updated by the backend
  financer: [
    // Will be appended by the backend
    {
      amount: contributionAmount,
      user: contributionRecord.user,
      type: contributionRecord.type,
      date: contributionRecord.date,
      paymentMethod: contributionRecord.paymentMethod,
      transactionId: contributionRecord.transactionId,
    },
  ],
});

/**
 * Construit un objet complet pour la sauvegarde dans Answer
 * Inclut tous les milestones financés avec leurs nouveaux enregistrements
 */
export const buildAnswerUpdatePayload = (
  financing: PaymentFinancingData[],
  contributorType: "citoyens" | "organizations",
  contributorId: string,
  paymentMethod: "stripe" | "helloasso",
  transactionId: string,
  projectId: string,
  activeMilestoneIds: Set<string>
) => {
  const contributionRecords = buildContributionRecords(
    financing,
    contributorType,
    contributorId,
    paymentMethod,
    transactionId
  );

  // Construire les dépenses mises à jour
  const updatedDepenses = financing
    .filter((fin) => fin.amount > 0)
    .map((fin) => {
      const record = contributionRecords.get(fin.milestone)!;
      return buildDepenseUpdate(
        fin.milestone,
        fin.name || `Milestone ${fin.milestone}`,
        fin.targetAmount || fin.amount,
        fin.currentFunding || 0,
        fin.amount,
        record
      );
    });

  return {
    projectId,
    paymentMethod,
    transactionId,
    contributorType,
    contributorId,
    totalAmount: financing.reduce((sum, f) => sum + f.amount, 0),
    activeMilestoneIds: Array.from(activeMilestoneIds),
    depensesToUpdate: updatedDepenses,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Valide que les données de financement sont correctes
 */
export const validateFinancingData = (
  financing: PaymentFinancingData[],
  totalAmount: number
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const totalAllocated = financing.reduce((sum, f) => sum + f.amount, 0);

  if (totalAllocated !== totalAmount) {
    errors.push(
      `Somme des allocations (${totalAllocated}€) ne correspond pas au montant total (${totalAmount}€)`
    );
  }

  financing.forEach((fin, index) => {
    if (fin.amount < 0) {
      errors.push(`Milestone ${index}: montant négatif (${fin.amount}€)`);
    }
    if (!fin.milestone) {
      errors.push(`Milestone ${index}: ID manquant`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Récupère l'ID du contributeur selon son type
 */
export const getContributorId = (
  contributorType: "citoyens" | "organizations",
  userId: string | null,
  organizationId: string | null
): string | null => {
  if (contributorType === "person") {
    return userId;
  }
  if (contributorType === "organization") {
    return organizationId;
  }
  return null;
};

/**
 * Prépare et log le payload pour debug
 */
export const debugPayment = (payload: ReturnType<typeof buildAnswerUpdatePayload>) => {
  console.log("💾 Payload de paiement préparé:", {
    projectId: payload.projectId,
    paymentMethod: payload.paymentMethod,
    contributorType: payload.contributorType,
    contributorId: payload.contributorId,
    totalAmount: payload.totalAmount,
    depenses: payload.depensesToUpdate.map((d) => ({
      milestone: d.milestone,
      name: d.name,
      contribution: d.financer[0].amount,
      newTotal: d.currentFunding + d.financer[0].amount,
      target: d.price,
    })),
    timestamp: payload.timestamp,
  });
};

