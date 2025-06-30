export const filters = {
  text: {
    placeholder: "Nom du tiers-lieu recherché"
  },
  typePlace: {
    view: "dropdownList",
    type: "tags",
    name: "Famille de tiers-lieux",
    event: "tags",
    list: [
      "Ateliers artisanaux partagés",
      "Bureaux partagés / Coworking",
      "Cuisine partagée / Foodlab",
      "Fablab / Makerspace / Hackerspace (Espaces du Faire)",
      "LivingLab / Laboratoire d'innovation sociale",
      "Tiers-lieu nourricier",
      "Tiers-lieu culturel / Lieux intermédiaires et indépendants",
    ]
  },
  manageModel: {
    view: "dropdownList",
    type: "tags",
    name: "Mode de gestion",
    event: "tags",
    list: [
      "Association",
      "Collectif citoyen",
      "Universités / Écoles d’ingénieurs ou de commerce / EPST",
      "Établissements scolaires (Lycée, Collège, Ecole)",
      "Collectivités (Département, Intercommunalité, Région, etc)",
      "SARL-SA-SAS",
      "SCIC",
      "SCOP",
    ]
  },
  role: {
    view: "dropdownList",
    type: "tags",
    name: "Rôle",
    event: "tags",
    keyValue: false,
    list: {
      "TiersLieux" : "Tiers Lieux",
      "Bureau" : "Bureau",
      "Partenaire" : "Partenaire",
      "Accompagnateur" : "Accompagnateur"
    }
  },
};
