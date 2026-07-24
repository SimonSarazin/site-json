import {
  ChartContainer,
  ChartLegendContent,
  type ChartConfig,
} from "site-forge";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, XAxis } from "recharts";

// Les sous-exports recharts (BarChart, Bar, …) ne sont PAS dans la barrel
// site-forge : on les bundle depuis node_modules (react est shimé vers
// window.React → même instance, composition OK). ChartLegendContent vient du
// bundle et consomme le ChartContext posé par CE ChartContainer (même copie).
//
// Capture déterministe : animations recharts pilotées en JS via les timestamps
// requestAnimationFrame (react-smooth) → échappent au gel CSS du DsProvider.
// Même patch que previews/ChartSection.tsx : on avance l'horloge rAF de la
// page (+5 s/frame) → t > 1 dès la 2e frame, tracé final. Scopé à cette page.
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

// Couleurs via config → ChartStyle génère --color-<clé> à partir des tokens
// --chart-* du thème (jamais de couleur en dur).
const config = {
  ateliers: { label: "Ateliers", color: "var(--chart-1)" },
  permanences: { label: "Permanences", color: "var(--chart-2)" },
} satisfies ChartConfig;

export const Barres = () => (
  <ChartContainer config={config} initialDimension={{ width: 620, height: 350 }}>
    <BarChart data={frequentation}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="mois" tickLine={false} axisLine={false} tickMargin={8} />
      <Bar dataKey="ateliers" fill="var(--color-ateliers)" radius={4} />
      <Bar dataKey="permanences" fill="var(--color-permanences)" radius={4} />
      <Legend content={<ChartLegendContent />} />
    </BarChart>
  </ChartContainer>
);

export const Courbes = () => (
  <ChartContainer config={config} initialDimension={{ width: 620, height: 350 }}>
    <LineChart data={frequentation} margin={{ left: 12, right: 12 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="mois" tickLine={false} axisLine={false} tickMargin={8} />
      <Line
        type="monotone"
        dataKey="ateliers"
        stroke="var(--color-ateliers)"
        strokeWidth={2}
        dot={false}
      />
      <Line
        type="monotone"
        dataKey="permanences"
        stroke="var(--color-permanences)"
        strokeWidth={2}
        dot={false}
      />
      <Legend content={<ChartLegendContent />} />
    </LineChart>
  </ChartContainer>
);
