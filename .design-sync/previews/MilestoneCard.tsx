import { MilestoneCard } from "site-forge";

// Carte jalon "ouverte" de la cagnotte (ActionsSection). Présentationnel pur :
// `t` est UNE PROP (mock français ci-dessous), les permissions et l'état
// expanded sont pilotés par le parent. Les boutons de gestion du jalon
// (MilestoneManageActions) lisent leur propre useT("modules/cagnotte") —
// namespace absent du bundle d'aperçu → on les masque via canEdit/canClose/
// canDelete=false pour ne jamais exposer de clés brutes.

const dict: Record<string, string> = {
  "ActionsSection.milestoneCard.actions": "Actions",
  "ActionsSection.milestoneCard.amount": "Montant",
  "ActionsSection.milestoneCard.totalCredits": "Total crédits",
  "ActionsSection.milestoneCard.addAction": "Action",
  "ActionsSection.milestoneCard.activeActions": "Actions en cours ({{count}})",
  "ActionsSection.milestoneCard.doneActions": "Terminées ({{count}})",
  "ActionsSection.milestoneCard.endLabel": "Fin :",
  "ActionsSection.actionsButtons.candidate": "Candidater",
  "ActionsSection.actionsButtons.complete": "Terminer",
  "ActionsSection.actionsButtons.edit": "Modifier",
  "ActionsSection.actionsButtons.delete": "Supprimer",
  "ActionsSection.statusBadges.milestoneOpen": "ouvert",
  "ActionsSection.statusBadges.milestoneDone": "terminé",
  "ActionsSection.statusBadges.milestoneClose": "clôturé",
  "ActionsSection.statusBadges.actionTodo": "En cours",
  "ActionsSection.statusBadges.actionDone": "Terminée",
  "ActionsSection.contributorsLabel": "Contributeurs :",
  "ActionsSection.emptyActionsInline": "Aucune action définie",
};

const t = (key: string, _fallback?: string, params?: Record<string, unknown>) => {
  let out = dict[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.split(`{{${k}}}`).join(String(v));
  }
  return out;
};

const permissions = {
  canCreateAction: () => true,
  canEditMilestone: () => false,
  canCloseMilestone: () => false,
  canDeleteMilestone: () => false,
  canCandidateAction: ({ status }: { status: string }) => status === "todo",
  canMarkActionDone: ({ status }: { status: string }) => status === "todo",
  canEditAction: ({ status }: { status: string }) => status === "todo",
  canDeleteAction: () => false,
};

const jour = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const inert = {
  t: t as never,
  permissions,
  fmtDate,
  loadingIds: {
    candidateActionId: "",
    doneActionId: "",
    deletingActionId: "",
    deletingMilestoneId: "",
    closingMilestoneId: "",
  },
  setExpandedActiveMilestoneIds: () => {},
  setExpandedDoneMilestoneIds: () => {},
  milestoneCardRef: () => {},
  actionCardRefs: { current: {} as Record<string, HTMLDivElement | null> },
  onCreateAction: () => {},
  onEditMilestone: () => {},
  onCloseMilestone: () => {},
  onDeleteMilestone: () => {},
  onCandidateAction: () => {},
  onMarkActionDone: () => {},
  onEditAction: () => {},
  onDeleteAction: () => {},
};

// Cagnotte « Rénovation du café des parents » — palier 2/3 (1 500 / 3 000 / 5 000 €).
const palier2 = {
  id: "palier-2",
  title: "Palier 2 — mobilier et peinture",
  description: "Repeindre la salle principale et installer le nouveau mobilier d'accueil.",
  status: "open" as const,
  date_start: jour(2026, 9, 1),
  date_end: jour(2026, 11, 30),
  targetAmount: 3000,
  transactions: [],
  actions: [
    {
      id: "act-peinture",
      name: "Poncer et repeindre la salle principale",
      credits: 450,
      status: "todo" as const,
      date_start: jour(2026, 9, 12),
      date_end: jour(2026, 9, 26),
      tags: ["peinture", "bricolage"],
      contributors: [
        { id: "u1", name: "Claire Dubois" },
        { id: "u2", name: "Karim Benali" },
      ],
    },
    {
      id: "act-lecture",
      name: "Aménager le coin lecture des enfants",
      credits: 250,
      status: "todo" as const,
      date_end: jour(2026, 10, 17),
      tags: ["aménagement", "enfance"],
      contributors: [
        { id: "u3", name: "Sophie Leroy" },
        { id: "u4", name: "Marc Petit" },
        { id: "u5", name: "Awa Diallo" },
        { id: "u6", name: "Julie Pot-Vin" },
      ],
    },
    {
      id: "act-choix",
      name: "Choisir les peintures et le mobilier",
      credits: 120,
      status: "done" as const,
      date_end: jour(2026, 8, 21),
      tags: [],
      contributors: [{ id: "u1", name: "Claire Dubois" }],
    },
    {
      id: "act-benevoles",
      name: "Lancer l'appel à bénévoles",
      credits: 80,
      status: "done" as const,
      date_end: jour(2026, 8, 28),
      tags: [],
      contributors: [{ id: "u2", name: "Karim Benali" }],
    },
  ],
};

const palier3 = {
  id: "palier-3",
  title: "Palier 3 — équipement de la cuisine partagée",
  description: "",
  status: "open" as const,
  date_start: jour(2026, 12, 1),
  targetAmount: 5000,
  transactions: [],
  actions: [],
};

export const JalonOuvert = () => (
  <div style={{ maxWidth: 560, margin: "0 auto" }}>
    <MilestoneCard
      milestone={palier2 as never}
      {...inert}
      expandedActiveMilestoneIds={["palier-2"]}
      expandedDoneMilestoneIds={[]}
    />
  </div>
);

export const ActionsTerminees = () => (
  <div style={{ maxWidth: 560, margin: "0 auto" }}>
    <MilestoneCard
      milestone={palier2 as never}
      {...inert}
      expandedActiveMilestoneIds={[]}
      expandedDoneMilestoneIds={["palier-2"]}
    />
  </div>
);

export const SansAction = () => (
  <div style={{ maxWidth: 560, margin: "0 auto" }}>
    <MilestoneCard
      milestone={palier3 as never}
      {...inert}
      expandedActiveMilestoneIds={[]}
      expandedDoneMilestoneIds={[]}
    />
  </div>
);
