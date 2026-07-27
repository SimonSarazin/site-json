/**
 * Types canoniques du module cagnotte.
 *
 * Source unique de vérité pour les structures dérivées de `useFundingEnvelope` et
 * consommées par tous les composants/hooks/parts du module. Avant cette
 * centralisation, des variantes proches (`Milestone`, `FundingMilestone`,
 * `ProjectMilestone`, `ProjectOcecoMilestone`) cohabitaient dans 4-5 fichiers,
 * créant des incompatibilités d'imports à chaque refactor.
 *
 * Les types `Funding*` sont les versions **enrichies** (incluent `description`,
 * `transactions`, `paymentMethods`, etc.). Si un composant n'a besoin que d'un
 * sous-ensemble, il peut typer ses props avec `Pick<FundingMilestone, "id" | "title">`
 * plutôt que de redéclarer une interface locale.
 */

import type { Action, ActionStatus } from "@communecter/cocolight-api-client";

/**
 * Sous-ensemble explicite des statuts SDK (`ActionStatus` = 8 valeurs) que le form
 * de cagnotte expose à l'utilisateur. Les autres statuts (`closed`, `disabled`,
 * `tracking`, `discuter`, `next`, `totest`) sont produits côté SDK par les méthodes
 * dédiées (`action.cancel()`, `action.archive()`, `action.updateStatus(...)`) et
 * ne transitent pas par les composants form.
 *
 * Utiliser `Extract<ActionStatus, ...>` plutôt qu'une union locale `"todo" | "done"` :
 *  - Source de vérité = SDK ; si une de ces 2 valeurs disparaissait du SDK, TS le détecte.
 *  - Lien explicite documenté avec le type SDK.
 */
export type FundingActionStatus = Extract<ActionStatus, "todo" | "done">;
export type FundingPaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type FundingMilestoneStatus = "open" | "done" | "close";

export type FundingContributor = {
  id: string;
  name: string;
  avatar?: string;
};

export type FundingTransaction = {
  id: string;
  financerName: string;
  financerId?: string;
  financerType?: string;
  financerAvatar?: string;
  amount: number;
  date: number;
  paymentStatus: FundingPaymentStatus;
  transactionId: string;
  fundingType?: string;
  fundingIndex?: number;
};

export type FundingAction = {
  id: string;
  name: string;
  credits: number;
  status: FundingActionStatus;
  sourceIndex?: number;
  date_start?: number;
  date_end?: number;
  tags: string[];
  contributors: FundingContributor[];
  /**
   * Instance SDK `Action` linkée par `BaseEntity.fundingEnvelope` (SDK 1.0.130+).
   * Permet aux call-sites d'appeler des méthodes typées (`delete()`, `get()`,
   * `isAdmin()`, …) ou d'accéder à `serverData` complet sans relire l'enveloppe.
   * Optionnel pour rétro-compat : peut être absent si l'entité n'a pas été linkée.
   */
  entity?: Action;
};

export type FundingMilestone = {
  id: string;
  title: string;
  description: string;
  status: FundingMilestoneStatus;
  date_start?: number;
  date_end?: number;
  targetAmount: number;
  transactions: FundingTransaction[];
  actions: FundingAction[];
  projectMilestoneIndex?: number;
  answerDepenseIndex?: number;
};

export type FundingPaymentMethods = {
  stripePublicKey?: string;
  helloassoPublicKey?: string;
  helloAssoPublicKey?: string;
  helloassoClientId?: string;
  helloAssoClientId?: string;
  [key: string]: string | undefined;
};

export type FundingProject = {
  id: string;
  slug?: string;
  answerId?: string;
  name: string;
  description: string;
  tags: string[];
  totalCouts: number;
  totalFinancement: number;
  userFinancement: number;
  milestones: FundingMilestone[];
  paymentMethods?: FundingPaymentMethods;
};

export type FundingEnvelopeNormalizedData = {
  projects: FundingProject[];
  selectedProject: FundingProject | null;
  paymentMethods: FundingPaymentMethods | null;
  milestones: FundingMilestone[];
  contributors: FundingContributor[];
  funders: Array<{ id: string; name: string; amount: number; avatar?: string }>;
  finance: {
    totalCost: number;
    totalFunding: number;
    userFunding: number;
    remaining: number;
    totalSpent: number;
  };
  rawEnvelope: unknown;
};

/**
 * Contexte d'édition d'une action — bag passé du parent à `ActionEditDialog`.
 * `actionEntityId` est l'ID MongoDB résolu côté envelope (utilisé par la mutation).
 */
export type EditActionContext = {
  milestoneId: string;
  action: FundingAction;
  actionEntityId: string;
};

export type PendingDeleteActionContext = {
  milestoneId: string;
  action: FundingAction;
};

export type CagnotteType = "standard" | "aac" ;
export const DEFAULT_CAGNOTTE_TYPE: CagnotteType = "standard";
export type CagnotteTypeConfig = {
  selectorType: "proposition" | "project",
  financerTags: string[],
  defaultPredefinedAmounts: number[],
  context: string,
  showInfoText: boolean,
  allowPersonToFinance: boolean,
  allowContributionWithoutPaiement: boolean,
};

export const CAGNOTTE_TYPE_CONFIGS: Record<CagnotteType, CagnotteTypeConfig> = {
  standard: {
    selectorType: "project",
    financerTags: [],
    defaultPredefinedAmounts: [10, 20, 30, 50],
    context: '',
    showInfoText: true,
    allowPersonToFinance: true,
    allowContributionWithoutPaiement: true,
  },
  aac: {
    selectorType: "proposition",
    financerTags: ["financeur"],
    defaultPredefinedAmounts: [10, 20, 30, 50],
    context: '',
    showInfoText: false,
    allowPersonToFinance: true,
    allowContributionWithoutPaiement: true,
  }
};

// Représente un projet ou une proposition
export interface CagnotteResource {
  fromType: "project" | "proposition";
  id: string;
  name: string;
  image?: string;
  answerId?: string;
  projectId?: string;
  resourceTotalAmount: number;
  resourceFinancedAmount: number;
  items: CagnotteFundableItem[];
}

// Représente un Milestone ou une dépense
export interface CagnotteFundableItem {
  fromType: "milestone" | "depense";
  itemId: string;
  milestoneId: string;
  depenseIndex: number;
  name: string;
  description?: string;
  price: number;
  status: string;
  actions: FundingAction[];
  funding: FundingTransaction[];
  currentFunding: number;
  unpaidFunding: number;
  userPledge: number;
}

export interface DepenseFunding {
  itemId?: string;
  depenseIndex: number;
  amount: number;
  name?: string;
  price?: number;
}

export interface Pledge {
  id: string,
  financerId: string;
  resourceId?: string,
  resourceName: string,
  depenseIndex: number,
  depenseName: string,
  fundingIndex?: number,
  financerName?: string,
  fundingAmount: number,
  userPledge: number,
  userfundingPledge:  FundingTransaction[];
}

export interface Objective {
  target: number;
  label: string;
  description: string;
  icon: React.ElementType;
}
