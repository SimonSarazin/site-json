import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useT } from "@/hooks/useT";
import { formatRelative } from "../utils/formatRelative";
import type { MultiEvalDataset, MultiEvalStep } from "../types";

/**
 * Section de rendu d'un radar multi-eval — isolée dans ce fichier pour
 * permettre un import dynamique (`useClientModule`) côté wrapper Dialog.
 * Recharts pèse lourd et n'est utile qu'à l'ouverture du modal.
 */

/** Couleurs cyclées pour les datasets (alignement avec ChartSection.tsx). */
const COLORS = [
  "hsl(221, 83%, 53%)",  // blue
  "hsl(142, 76%, 36%)",  // green
  "hsl(346, 87%, 43%)",  // pink/red
  "hsl(38, 92%, 50%)",   // orange
  "hsl(262, 83%, 58%)",  // purple
  "hsl(199, 89%, 48%)",  // cyan
  "hsl(0, 84%, 60%)",    // red
  "hsl(83, 78%, 44%)",   // lime
];

interface RadarSectionProps {
  step: MultiEvalStep;
}

/**
 * Découpe un label en lignes pour qu'aucune ne dépasse `maxChars` caractères,
 * en respectant les limites de mots quand c'est possible. Les mots plus longs
 * que `maxChars` sont gardés intacts (pas de coupure brutale au milieu d'un
 * mot). Retourne au max `maxLines` lignes — la dernière reçoit le reste avec
 * une ellipse si dépassement.
 */
function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current) lines.push(current);
  // Si on a tronqué, on append le reste des mots à la dernière ligne avec une
  // ellipse — évite de perdre silencieusement de l'info.
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length) {
    const remainder = words.slice(consumed).join(" ");
    lines[lines.length - 1] = lines[lines.length - 1] + " " + remainder;
    if (lines[lines.length - 1].length > maxChars + 4) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, maxChars + 1) + "…";
    }
  }
  return lines;
}

/**
 * Tick custom pour PolarAngleAxis : rend le label en plusieurs `<tspan>` quand
 * il est trop long. recharts ne wrap pas nativement, et les labels coupés
 * (genre "estion conflit", "Principe d'in…") sont illisibles. Les coordonnées
 * `x`/`y` et `textAnchor` viennent du composant parent recharts en fonction de
 * la position angulaire du tick.
 */
type SvgTextAnchor = "start" | "middle" | "end" | "inherit";
interface PolarTickProps {
  x?: number;
  y?: number;
  textAnchor?: SvgTextAnchor | string;
  payload?: { value?: string };
  /** Seuil de wrap, calculé en amont selon la largeur du container. */
  maxChars?: number;
}

function WrappedPolarTick({ x = 0, y = 0, textAnchor, payload, maxChars = 14 }: PolarTickProps) {
  const value = String(payload?.value ?? "");
  const lines = wrapLabel(value, maxChars, 2);
  const anchor: SvgTextAnchor =
    textAnchor === "start" || textAnchor === "middle" || textAnchor === "end" || textAnchor === "inherit"
      ? textAnchor
      : "middle";
  // Si on a 2 lignes et que le tick est en haut/bas, on shifte légèrement vers
  // le haut pour que le label reste centré visuellement par rapport au tick.
  const dyStart = lines.length > 1 ? "-0.3em" : "0.32em";
  return (
    <text x={x} y={y} textAnchor={anchor} fill="currentColor" fontSize={11}>
      {lines.map((line, idx) => (
        <tspan key={idx} x={x} dy={idx === 0 ? dyStart : "1.1em"}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Calcule un `maxChars` raisonnable pour le wrap en fonction de la largeur
 * disponible. Le radar lui-même ne prend qu'une partie de la largeur (cf.
 * `outerRadius="65%"`), donc on a en gros `(width × 35%) / 2` de chaque côté
 * pour les labels avant qu'ils soient coupés. À ~6.5px par caractère en
 * fontSize 11 ça donne :
 * - sidebar étroite (≤ 320px) : ~10 chars
 * - dialog standard (~700px)  : ~22 chars
 * - dialog large (~900px)     : ~28 chars
 *
 * On clamp entre 10 et 30 pour que les labels très courts ne soient pas
 * forcés sur 2 lignes inutilement et que les très longs ne deviennent pas
 * illisibles d'un coup.
 */
function computeMaxChars(containerWidth: number): number {
  if (containerWidth <= 0) return 14; // fallback raisonnable au 1er render
  const sideSpacePx = (containerWidth * 0.35) / 2;
  const charsPerLine = Math.floor(sideSpacePx / 6.5);
  return Math.max(10, Math.min(30, charsPerLine));
}

/**
 * Transforme une step en data recharts : un objet par axe avec une clé par
 * user (= 1 dataset). Les valeurs sont les indices 1..N de l'option choisie.
 *
 * Ex: 2 axes (A, B) × 2 users (Alice, Bob) →
 * [
 *   { axis: "A", Alice: 2, Bob: 3 },
 *   { axis: "B", Alice: 1, Bob: 2 },
 * ]
 */
function buildRadarData(step: MultiEvalStep): Record<string, string | number>[] {
  return step.axes.map((axis) => {
    const row: Record<string, string | number> = { axis: axis.label };
    for (const dataset of step.datasets) {
      const userKey = dataset.userName || dataset.userId;
      const v = dataset.values?.[axis.key];
      if (typeof v === "number") {
        row[userKey] = v;
      }
    }
    return row;
  });
}

export function RadarSection({ step }: RadarSectionProps) {
  const t = useT("modules/coform");
  const data = useMemo(() => buildRadarData(step), [step]);
  const maxRadius = useMemo(
    () => step.axes.reduce((max, ax) => Math.max(max, ax.options.length), 1),
    [step.axes]
  );

  // Mesure de la largeur du container du chart pour adapter le wrap des
  // labels : sidebar étroite → wrap agressif, modale large → labels sur une
  // seule ligne quand ils tiennent.
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const tickMaxChars = useMemo(() => computeMaxChars(containerWidth), [containerWidth]);

  // Set des userKeys cachés (toggle via clic sur la légende interactive
  // recharts OU sur la liste des contributeurs en dessous).
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const toggleVisibility = useCallback((userKey: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(userKey)) next.delete(userKey);
      else next.add(userKey);
      return next;
    });
  }, []);

  if (step.datasets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4 text-center">
        {t("coform.multiEval.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Radar chart */}
      <div ref={chartContainerRef} className="w-full" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="65%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" tick={<WrappedPolarTick maxChars={tickMaxChars} />} />
            <PolarRadiusAxis angle={90} domain={[0, maxRadius]} tick={false} />
            <Tooltip />
            <Legend
              wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
              onClick={(payload: { value?: string }) => {
                if (payload?.value) toggleVisibility(payload.value);
              }}
            />
            {step.datasets.map((ds, idx) => {
              const userKey = ds.userName || ds.userId;
              const isHidden = hidden.has(userKey);
              return (
                <Radar
                  key={ds.userId}
                  name={userKey}
                  dataKey={userKey}
                  stroke={COLORS[idx % COLORS.length]}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.18}
                  hide={isHidden}
                />
              );
            })}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Légende détaillée : liste des contributeurs avec date. Cliquable
          pour toggle la visibilité du dataset (synchronisé avec la légende
          du radar). */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
          {t("coform.multiEval.usersLegend")}
        </h4>
        <ul className="space-y-1">
          {step.datasets.map((ds: MultiEvalDataset, idx) => {
            const userKey = ds.userName || ds.userId;
            const isHidden = hidden.has(userKey);
            return (
              <li key={ds.userId}>
                <button
                  type="button"
                  onClick={() => toggleVisibility(userKey)}
                  className={`flex items-center gap-2 text-sm w-full text-left rounded px-1 py-0.5 hover:bg-muted/50 transition-colors ${isHidden ? "opacity-40" : ""}`}
                  title={isHidden ? t("coform.multiEval.show") : t("coform.multiEval.hide")}
                >
                  <span
                    className={`inline-block w-3 h-3 rounded-sm shrink-0 ${isHidden ? "ring-1 ring-muted-foreground/40" : ""}`}
                    style={{ backgroundColor: isHidden ? "transparent" : COLORS[idx % COLORS.length], borderColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className={`font-medium ${isHidden ? "line-through" : ""}`}>
                    {ds.userName || t("coform.activity.unknownUser")}
                  </span>
                  {ds.evaluatedAt && (
                    <span className="text-xs text-muted-foreground">
                      · {formatRelative(ds.evaluatedAt, t)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
