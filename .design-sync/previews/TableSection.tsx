import { TableSection } from "site-forge";

// Annuaire des structures du réseau — table triable (chevrons dans l'en-tête).
export const AnnuaireStructures = () => (
  <TableSection
    props={{
      sortable: true,
      pagination: false,
      perPage: 10,
      headers: [{ fr: "Structure" }, { fr: "Ville" }, { fr: "Territoire" }, { fr: "Contact" }],
      rows: [
        [{ fr: "Centre Social Kaléido" }, { fr: "Noyelles-sous-Lens" }, { fr: "Lens-Liévin" }, { fr: "03 21 70 12 34" }],
        [{ fr: "Maison des Parents" }, { fr: "Arras" }, { fr: "Arrageois" }, { fr: "03 21 51 87 20" }],
        [{ fr: "Association Le 9 de Cœur" }, { fr: "Boulogne-sur-Mer" }, { fr: "Boulonnais" }, { fr: "03 21 31 45 08" }],
        [{ fr: "CLAEPP" }, { fr: "Calais" }, { fr: "Calaisis" }, { fr: "03 21 96 77 41" }],
        [{ fr: "Centre Socioculturel Intercommunal" }, { fr: "Hucqueliers" }, { fr: "Montreuillois" }, { fr: "03 21 90 51 12" }],
      ],
    }}
  />
);

// Table paginée : 9 lignes, 4 par page → 3 pages et boutons Précédent/Suivant.
export const TableauPagine = () => (
  <TableSection
    props={{
      sortable: false,
      pagination: true,
      perPage: 4,
      headers: [{ fr: "Commune" }, { fr: "Habitants" }, { fr: "Label" }, { fr: "Depuis" }],
      rows: [
        [{ fr: "Berck-sur-Mer" }, { fr: "13 800" }, { fr: "Ville amie des enfants" }, { fr: "2010" }],
        [{ fr: "Lens" }, { fr: "31 500" }, { fr: "Charte parentalité" }, { fr: "2013" }],
        [{ fr: "Arques" }, { fr: "9 900" }, { fr: "Charte parentalité" }, { fr: "2013" }],
        [{ fr: "Lillers" }, { fr: "10 200" }, { fr: "Charte parentalité" }, { fr: "2016" }],
        [{ fr: "Marquise" }, { fr: "5 000" }, { fr: "Charte parentalité" }, { fr: "2016" }],
        [{ fr: "Sains-en-Gohelle" }, { fr: "6 200" }, { fr: "Charte parentalité" }, { fr: "2015" }],
        [{ fr: "Maisnil-lès-Ruitz" }, { fr: "1 600" }, { fr: "Charte parentalité" }, { fr: "2015" }],
        [{ fr: "Desvres" }, { fr: "5 100" }, { fr: "Charte parentalité" }, { fr: "2010" }],
        [{ fr: "Calais" }, { fr: "72 000" }, { fr: "Charte parentalité" }, { fr: "2013" }],
      ],
    }}
  />
);
