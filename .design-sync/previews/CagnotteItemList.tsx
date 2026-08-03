import { CagnotteItemList } from "site-forge";

// Sélection des objectifs à financer dans CagnotteDialog (ex-CagnotteMilestoneList).
// `status` est toujours affiché tel quel dans un Badge → libellés FR fournis par le mock.
// Cagnotte « Rénovation du café des parents » — paliers 1 500 / 3 000 / 5 000 €.

// Configuration cagnotte « standard » (cf. CAGNOTTE_TYPE_CONFIGS du module) :
// selectorType "project" pilote le contexte i18n des libellés.
const cagnotteConfig = {
  selectorType: "project" as const,
  financerTags: [],
  defaultPredefinedAmounts: [10, 20, 30, 50],
  context: "",
  showInfoText: true,
  allowPersonToFinance: true,
  allowContributionWithoutPaiement: true,
};

const item = (
  n: number,
  name: string,
  description: string,
  price: number,
  currentFunding: number,
  status: string,
) => ({
  fromType: "milestone" as const,
  itemId: `palier-${n}`,
  milestoneId: `palier-${n}`,
  depenseIndex: 0,
  name,
  description,
  price,
  status,
  actions: [],
  funding: [],
  currentFunding,
  unpaidFunding: 0,
  userPledge: 0,
});

const paliers = [
  item(
    1,
    "Palier 1 — remise en état de la salle",
    "Électricité, sol et gros nettoyage de la salle d'accueil.",
    1500,
    1500,
    "financé",
  ),
  item(
    2,
    "Palier 2 — mobilier et peinture",
    "Repeindre la salle et installer le mobilier d'accueil.",
    3000,
    1750,
    "ouvert",
  ),
  item(
    3,
    "Palier 3 — équipement de la cuisine partagée",
    "Four, frigo et plan de travail pour les ateliers cuisine.",
    5000,
    240,
    "ouvert",
  ),
];

export const AvecSelection = () => (
  <CagnotteItemList
    items={paliers}
    activeItemIds={new Set(["palier-2"])}
    onItemClick={() => {}}
    cagnotteConfig={cagnotteConfig}
    context=""
  />
);

export const SansSelection = () => (
  <CagnotteItemList
    items={paliers}
    activeItemIds={new Set()}
    onItemClick={() => {}}
    cagnotteConfig={cagnotteConfig}
    context=""
  />
);
