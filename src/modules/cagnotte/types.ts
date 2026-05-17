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

export type FundingActionStatus = "todo" | "done";
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
