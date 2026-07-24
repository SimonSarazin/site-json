import { MapSection } from "site-forge";

// Type "map" : le composant actuel est un PLACEHOLDER statique (aucun Leaflet,
// aucun réseau) — aperçu fidèle à ce qui est réellement rendu. Usage réel :
// config.prod.json (showcase-map, centre Paris).

export const AvecMarqueurs = () => (
  <MapSection
    props={{
      provider: "leaflet",
      center: [50.291, 2.777],
      zoom: 11,
      markers: [
        { position: [50.291, 2.777], label: { fr: "Centre social d'Arras" }, popup: { fr: "Café des parents le samedi matin, accueil libre." } },
        { position: [50.428, 2.831], label: { fr: "Maison de la petite enfance — Lens" }, popup: { fr: "Ateliers massage bébé et permanences PMI." } },
        { position: [50.725, 1.613], label: { fr: "Médiathèque de Boulogne-sur-Mer" }, popup: { fr: "Conférences parentalité, entrée libre." } },
      ],
    }}
  />
);

export const SansMarqueur = () => (
  <MapSection
    props={{
      provider: "leaflet",
      center: [48.8566, 2.3522],
      zoom: 13,
    }}
  />
);
