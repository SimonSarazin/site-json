import { ChartSection } from "site-forge";

// Graphiques recharts pilotés par la config (type "chart") — données
// statiques plausibles : fréquentation des actions du réseau parentalité.
//
// Capture déterministe : les animations d'entrée recharts (react-smooth) sont
// pilotées en JS via les timestamps requestAnimationFrame → elles échappent au
// gel CSS du DsProvider et la capture les fige à mi-tracé (courbe/aire
// coupées à ~55 %, camembert aplati). Patcher recharts est impossible ici :
// "site-forge" = bundle pré-construit (window.SiteForge) avec SA copie de
// recharts, inaccessible depuis les previews. On avance donc l'horloge rAF de
// la page (offset cumulatif +5 s/frame) : react-smooth calcule
// t = (now - beginTime) / duration → t > 1 dès la 2e frame, rendu final.
// Scopé à la page de preview de CE composant uniquement.
if (typeof window !== "undefined") {
  const nativeRaf = window.requestAnimationFrame.bind(window);
  let offset = 0;
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    nativeRaf((ts) => {
      offset += 5_000;
      cb(ts + offset);
    });
}

const frequentation = [
  { mois: "Jan", ateliers: 86, permanences: 42 },
  { mois: "Fév", ateliers: 94, permanences: 51 },
  { mois: "Mar", ateliers: 128, permanences: 63 },
  { mois: "Avr", ateliers: 102, permanences: 58 },
  { mois: "Mai", ateliers: 141, permanences: 72 },
  { mois: "Juin", ateliers: 118, permanences: 66 },
];

export const Barres = () => (
  <ChartSection
    props={{
      kind: "bar",
      data: frequentation,
      xKey: "mois",
      yKeys: ["ateliers", "permanences"],
      legend: true,
    }}
  />
);

export const Courbe = () => (
  <ChartSection
    props={{
      kind: "line",
      data: frequentation,
      xKey: "mois",
      yKeys: ["ateliers", "permanences"],
      legend: true,
    }}
  />
);

export const Camembert = () => (
  <ChartSection
    props={{
      kind: "pie",
      data: [
        { type: "Cafés des parents", participants: 320 },
        { type: "Ateliers parent-enfant", participants: 260 },
        { type: "Conférences", participants: 180 },
        { type: "Sorties familles", participants: 140 },
      ],
      xKey: "type",
      yKeys: ["participants"],
      legend: true,
    }}
  />
);

export const AiresEmpilees = () => (
  <ChartSection
    props={{
      kind: "area",
      data: frequentation,
      xKey: "mois",
      yKeys: ["ateliers", "permanences"],
      stacked: true,
      legend: true,
    }}
  />
);
