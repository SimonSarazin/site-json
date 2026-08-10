/**
 * Contrat de données du module AAC (Appel à Communs) — source de vérité LOCALE.
 *
 * Le SDK type `answers` en `Record<string, unknown>` : le contrat AAP/oceco
 * (aapStepN, depense[], financer[], campagne…) n'est typé nulle part côté SDK.
 *
 * ⚠️ GATE (cf. plan SOCLE §6) : plusieurs formes ci-dessous sont RÉSERVÉES
 * (déclarées, non construites) et devront être confirmées sur données réelles
 * (form FTL 6438366673d20a0de1533c77) — notamment la clé de référence CAMPAGNE
 * portée par l'answer et les sous-champs `financer` (paymentStatus/campaign/porteur).
 *
 * On RÉUTILISE les types financiers de cagnotte (ne pas redéfinir).
 */
import type {
  FundingMilestone,
  FundingAction,
  FundingPaymentStatus,
} from "@/modules/cagnotte/types";

export type { FundingMilestone, FundingAction, FundingPaymentStatus };

// ── Le commun & son budget ───────────────────────────────────────────────────

/** État d'un commun. NB : `status` legacy = TABLEAU append-only (verbes empilés). */
export type CommunState = "cree" | "pending" | "valide";

/** Nature de l'ENTITÉ financeuse (≠ nature du financement, cf. `fundingType`). */
export type FinancerEntityType = "citoyen" | "organisation";

/**
 * Nature du FINANCEMENT. `prepaid` = seule valeur observée aujourd'hui.
 * Le « porteur » (doublonnage) est un `fundingType`, PAS un type d'entité :
 * un doublonnage = une 2ᵉ entrée `financer` SÉPARÉE (jamais fusionnée).
 */
export type FundingType = "prepaid" | "porteur" | (string & {});

/** Une entrée de financement (`depense.financer[]`). Forme réelle + champs RÉSERVÉS. */
export interface Financer {
  amount: number;
  date?: string;
  user?: string;
  id?: string;
  name?: string;
  /** Nature de l'entité (citoyen|organisation). */
  type?: FinancerEntityType;
  /** Nature du financement (prepaid | porteur…). Axe DISTINCT de `type`. */
  fundingType?: FundingType;
  // ── RÉSERVÉ (GATE) — absents des données actuelles ──
  paymentStatus?: FundingPaymentStatus;
  /** Réf de la campagne portée par le financement (à confirmer au GATE). */
  campaign?: string;
  /** Clé stable d'un financement (finkey) — à introduire côté écriture. */
  finkey?: string;
}

/** Une dépense/objectif finançable (`answers.<depenseStepKey>.depense[]`). */
export interface Depense {
  poste?: string;
  price?: number;
  targetAmount?: number;
  /** Id du milestone oceco lié (correspondance 1:1 dépense↔milestone). */
  milestone?: string;
  financer?: Financer[];
  // ── RÉSERVÉ (GATE) — logs stockés DANS la dépense (source observatoire) ──
  paiements?: unknown[];
  historique?: AacLog[];
  [key: string]: unknown;
}

/** Un commun = une réponse Coform (document `answers`). */
export interface Commun {
  id: string;
  form: string;
  /** `answers.aapStepN.<key>` — non typé (dépend du form). */
  answers?: Record<string, Record<string, unknown>>;
  /** ⚠️ legacy : TABLEAU append-only de verbes d'état. */
  status?: string[];
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Entités NET-NEW réservées (déclarées, NON construites au socle) ───────────

export type CampagneType = "simple" | "doublonnage";
export type PaymentProvider = "stripe" | "helloasso";

export interface CampagneDates {
  debut?: string;
  fin?: string;
  /** Gate : pas de financement avant cette date. */
  debutCofinancement?: string;
  /** Gate : pas de paiement avant cette date. */
  ouverturePaiement?: string;
}

/** Campagne de cofinancement — isole communs/financements/paniers/stats. */
export interface Campagne {
  id: string;
  name?: string;
  type?: CampagneType;
  dates?: CampagneDates;
  /** Budget disponible pour le doublonnage (porteur). */
  montantDisponibleDoublonnage?: number;
  /** Organisation porteuse. */
  porteur?: string;
  provider?: PaymentProvider;
  activee?: boolean;
}

/** Ligne de panier de cofinancement. */
export interface PanierLigne {
  commun: string;
  depenseIndex?: number;
  campagne?: string;
  organisation?: string;
  financeur?: string;
  montant: number;
}

/** Panier scopé par (user, organisation représentée, campagne). */
export interface Panier {
  user?: string;
  organisation?: string;
  campagne?: string;
  lignes: PanierLigne[];
}

/** Log métier (audit + observatoire) — stocké dans `depense.historique`. */
export interface AacLog {
  champ?: string;
  avant?: unknown;
  apres?: unknown;
  quand?: string | number;
}

// ── Config résolue (sortie du résolveur AacConfig) ────────────────────────────

/** Provenance des critères d'évaluation retenus par le résolveur. */
export type AacCriteriaSource = "formParent" | "config" | "none";

export interface AacCriterion {
  label: string;
  /** Coefficient de pondération (legacy parfois string → coercé number). */
  coeff: number;
  note?: number;
  /** fieldKey d'aapStep1 pour le champ selection 2D (si mappé). */
  fieldKey?: string;
}

export interface AacStep {
  /** Clé de l'étape (ex : "aapStep1"). */
  key: string;
  /** Libellé de l'étape. */
  name?: string;
  /** Rôles autorisés à éditer (params.<step>.canEdit, CSV → array). */
  canEdit: string[];
  /** Rôles autorisés à lire. */
  canRead: string[];
  haveEditingRules?: boolean;
  haveReadingRules?: boolean;
  /** Étape masquée en mode standalone. */
  masquageStandalone?: boolean;
}

/** Rôles fonctionnels résolus par dispatch (4 vs 5 steps) + scan de type. */
export interface AacStepRoles {
  depenseStepKey: string | null;
  evalStepKey: string | null;
  financementStepKey: string | null;
  suiviStepKey: string | null;
}

/** Portes d'accès / options (best-effort ; certaines clés GATE-pending). */
export interface AacGates {
  active: boolean;
  onlyMemberAccess: boolean;
  oneAnswerPerPers: boolean;
  canReadOtherAnswers: boolean;
  showAnswers: boolean;
  /** Standalone : répondre hors interface (avec/sans compte). */
  standalone: boolean;
  /**
   * ⚠️ GATE — Gate MAÎTRE du financement (corénumération) : OFF ⇒ pas de
   * financeur / objet finançable / paiement. Clé réelle à confirmer au GATE.
   */
  coRemuneration: boolean;
  /** ⚠️ GATE — Publier au répertoire (annuaire) : gate listing/visibilité. */
  annuaire: boolean;
}

/**
 * Sortie normalisée du résolveur — objet unique typé.
 * ⚠️ À ne pas confondre avec `AacConfig` (schema.ts) = le bloc DÉCLARÉ dans
 * `config.aac` du site (qui ne porte que le `formId`).
 */
export interface AacResolvedConfig {
  formId: string;
  /** Id du doc aapConfig (`form.config`). */
  configId: string | null;
  aapType: string | null;
  steps: AacStep[];
  roles: AacStepRoles;
  criteria: AacCriterion[];
  /** Source des critères retenus (surcharge locale vs config). */
  criteriaSource: AacCriteriaSource;
  gates: AacGates;
  /** Campagnes déclarées sur l'aapConfig (isolent communs/financements/paniers). */
  campaigns: Campagne[];
  typeCoFinancer: string | null;
}
