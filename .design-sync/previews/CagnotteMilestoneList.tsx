import { CagnotteMilestoneList } from "site-forge";

// Sélection des paliers à financer dans CagnotteDialog. `status` est affiché
// tel quel dans un Badge → libellés FR fournis par le mock.
// Cagnotte « Rénovation du café des parents » — paliers 1 500 / 3 000 / 5 000 €.

const paliers = [
  {
    milestoneId: "palier-1",
    name: "Palier 1 — remise en état de la salle",
    description: "Électricité, sol et gros nettoyage de la salle d'accueil.",
    price: 1500,
    currentFunding: 1500,
    status: "financé",
  },
  {
    milestoneId: "palier-2",
    name: "Palier 2 — mobilier et peinture",
    description: "Repeindre la salle et installer le mobilier d'accueil.",
    price: 3000,
    currentFunding: 1750,
    status: "ouvert",
  },
  {
    milestoneId: "palier-3",
    name: "Palier 3 — équipement de la cuisine partagée",
    description: "Four, frigo et plan de travail pour les ateliers cuisine.",
    price: 5000,
    currentFunding: 240,
    status: "ouvert",
  },
];

export const AvecSelection = () => (
  <CagnotteMilestoneList
    milestones={paliers}
    activeMilestoneIds={new Set(["palier-2"])}
    onMilestoneClick={() => {}}
  />
);

export const SansSelection = () => (
  <CagnotteMilestoneList
    milestones={paliers}
    activeMilestoneIds={new Set()}
    onMilestoneClick={() => {}}
  />
);
