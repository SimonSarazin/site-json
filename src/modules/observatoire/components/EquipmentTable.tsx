import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Table as TableIcon } from "lucide-react";
import type { Equipment } from "../schema";
import { useT } from "@/hooks/useT";
import {
  getCommune,
  getEpci,
  getEquipId,
  getInstName,
  getNature,
  getPropType,
  getSurface,
  getType,
  isPmrAccessible,
} from "../utils";

interface Row {
  id: string;
  name: string;
  numero: string;
  type: string;
  commune: string;
  epci: string;
  nature: string;
  surface: number | undefined;
  pmr: boolean;
  prop: string;
}

type SortKey = keyof Omit<Row, "id" | "pmr" | "surface"> | "surface" | "pmr";
type SortDir = "asc" | "desc";

const PLACEHOLDER = "—";

function buildRow(e: Equipment, idx: number): Row {
  return {
    id: getEquipId(e, idx),
    name: getInstName(e),
    numero: e.equip_numero ?? "",
    type: getType(e) ?? PLACEHOLDER,
    commune: getCommune(e) ?? PLACEHOLDER,
    epci: getEpci(e) ?? PLACEHOLDER,
    nature: getNature(e) ?? PLACEHOLDER,
    surface: getSurface(e),
    pmr: isPmrAccessible(e),
    prop: getPropType(e) ?? PLACEHOLDER,
  };
}

function compare(a: Row, b: Row, key: SortKey): number {
  if (key === "surface") {
    const av = a.surface ?? -Infinity;
    const bv = b.surface ?? -Infinity;
    return av === bv ? 0 : av < bv ? -1 : 1;
  }
  if (key === "pmr") {
    return a.pmr === b.pmr ? 0 : a.pmr ? -1 : 1;
  }
  const av = (a[key] ?? "") as string;
  const bv = (b[key] ?? "") as string;
  return av.localeCompare(bv, "fr");
}

/** En-tête de colonne triable — composant STATIQUE (règle react-hooks/
 *  static-components : défini dans le render, il serait recréé/remonté à
 *  chaque rendu du tableau). L'état de tri arrive par props. */
function Th({
  k,
  label,
  sort,
  onToggle,
}: {
  k: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  onToggle: (k: SortKey) => void;
}) {
  return (
    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
      <button
        type="button"
        onClick={() => onToggle(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {sort.key === k &&
          (sort.dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </button>
    </th>
  );
}

interface EquipmentTableProps {
  data: Equipment[];
}

export function EquipmentTable({ data }: EquipmentTableProps) {
  const t = useT("modules/observatoire");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "commune",
    dir: "asc",
  });
  const [page, setPage] = useState(0);
  const perPage = 10;

  const rows = useMemo(() => data.map(buildRow), [data]);
  const sorted = useMemo(() => {
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compare(a, b, sort.key) * factor);
  }, [rows, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, pages - 1);
  const slice = sorted.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const toggle = (k: SortKey) =>
    setSort((s) =>
      s.key === k
        ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: k, dir: "asc" },
    );

  return (
    <div className="rounded-2xl bg-card shadow-sm border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-4">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("table.title")}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("table.equipmentCount", undefined, { count: data.length })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-y border-border">
            <tr>
              <Th k="name" label={t("table.installation")} sort={sort} onToggle={toggle} />
              <Th k="type" label={t("table.type")} sort={sort} onToggle={toggle} />
              <Th k="commune" label={t("table.commune")} sort={sort} onToggle={toggle} />
              <Th k="epci" label={t("table.epci")} sort={sort} onToggle={toggle} />
              <Th k="nature" label={t("table.nature")} sort={sort} onToggle={toggle} />
              <Th k="surface" label={t("table.surface")} sort={sort} onToggle={toggle} />
              <Th k="pmr" label={t("table.pmr")} sort={sort} onToggle={toggle} />
              <Th k="prop" label={t("table.owner")} sort={sort} onToggle={toggle} />
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${
                  i % 2 ? "bg-muted/10" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{r.name}</div>
                  {r.numero && (
                    <div className="text-xs text-muted-foreground">
                      {r.numero}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.type}</td>
                <td className="px-4 py-3 text-foreground">{r.commune}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.epci}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.nature === "Intérieur"
                        ? "bg-chart-1/15 text-chart-1"
                        : "bg-chart-2/15 text-chart-2"
                    }`}
                  >
                    {r.nature}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {r.surface !== undefined ? `${r.surface} m²` : PLACEHOLDER}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                      r.pmr
                        ? "bg-chart-2/15 text-chart-2"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.pmr ? t("table.pmrYes") : t("table.pmrNo")}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {r.prop}
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {t("table.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {t("table.page", undefined, { current: currentPage + 1, total: pages })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40"
            >
              {t("table.prev")}
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={currentPage >= pages - 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40"
            >
              {t("table.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
