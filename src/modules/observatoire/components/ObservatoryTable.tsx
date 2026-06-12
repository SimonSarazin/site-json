import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import { ChevronDown, ChevronUp, Download, Table as TableIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/hooks/useT";
import type {
  DimensionsConfig,
  ObservatoryItem,
  TableColumnDef,
  TableDef,
} from "../schema";
import { TOKEN_TINT_CLASSES, dimensionLabel } from "../dimensions";
import {
  PLACEHOLDER,
  buildCsv,
  buildRow,
  compare,
  type Row,
  type SortDir,
} from "../dashboard";

/** En-tête de colonne triable — composant STATIQUE (règle react-hooks/
 *  static-components). L'état de tri arrive par props. */
function Th({
  k,
  label,
  sort,
  onToggle,
}: {
  k: string;
  label: string;
  sort: { key: string; dir: SortDir };
  onToggle: (k: string) => void;
}) {
  return (
    <TableHead className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
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
    </TableHead>
  );
}

interface ObservatoryTableProps {
  data: ObservatoryItem[];
  dimensions: DimensionsConfig;
  /** Colonnes + tri initial + rowLink (déclarés en config). */
  table: TableDef;
  /** Export CSV du résultat filtré (opt-in config : `props.export`). */
  exportCsv?: { filename?: string } | null;
  /** Entités SDK alignées avec `data` (rowAction "preview"). */
  entities?: readonly SearchEntity[];
}

export function ObservatoryTable({ data, dimensions, table, exportCsv, entities }: ObservatoryTableProps) {
  const t = useT("modules/observatoire");
  const navigate = useNavigate();
  // rowAction "preview" : entité ouverte dans le détail du module search
  // (drawer/dialog + Preview — le comportement de la liste equipements).
  const [detailEntity, setDetailEntity] = useState<SearchEntity | null>(null);
  const rowAction = table.rowAction;
  const handleRowClick = (r: Row) => {
    if (!rowAction) return;
    if (rowAction.kind === "profil") {
      if (r.slug) navigate(`/profil/${r.slug}`);
      return;
    }
    const entity = entities?.[r.index];
    if (entity) setDetailEntity(entity);
  };
  const rowClickable = (r: Row): boolean =>
    rowAction?.kind === "profil" ? !!r.slug : rowAction?.kind === "preview" ? !!entities?.[r.index] : false;
  // Colonnes sans dimension connue : ignorées (warn DEV).
  const columns = useMemo(() => {
    const out = table.columns.filter((c) => {
      const ok = !!dimensions[c.dimension];
      if (!ok && import.meta.env.DEV) {
        console.warn(`[observatoire] colonne "${c.dimension}" sans dimension déclarée — ignorée`);
      }
      return ok;
    });
    return out;
  }, [table.columns, dimensions]);

  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: table.defaultSort ?? columns[0]?.dimension ?? "",
    dir: "asc",
  });
  const [page, setPage] = useState(0);
  const perPage = 10;

  const rows = useMemo(
    () => data.map((e, i) => buildRow(e, i, columns, dimensions)),
    [data, columns, dimensions],
  );
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.dimension === sort.key);
    if (!col) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compare(a, b, col) * factor);
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, pages - 1);
  const slice = sorted.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const toggle = (k: string) =>
    setSort((s) =>
      s.key === k
        ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: k, dir: "asc" },
    );

  // Export CSV : le résultat FILTRÉ/TRIÉ complet (pas la page affichée),
  // BOM UTF-8 pour Excel, booléens via les libellés i18n.
  const downloadCsv = () => {
    const headers = columns.map((c) => labelFor(c));
    const csv = buildCsv(sorted, columns, headers, {
      yes: t("filters.yes"),
      no: t("filters.no"),
    });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportCsv?.filename ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const labelFor = (col: TableColumnDef): string =>
    col.label ? t(col.label) : col.labelKey ? t(col.labelKey) : dimensionLabel(t, dimensions, col.dimension);

  const renderCell = (row: Row, col: TableColumnDef) => {
    const value = row.cells[col.dimension];
    switch (col.kind) {
      case "title":
        return (
          <TableCell key={col.dimension} className="px-4 py-3">
            <div className="font-medium text-foreground">{String(value ?? PLACEHOLDER)}</div>
            {row.subtitles[col.dimension] && (
              <div className="text-xs text-muted-foreground">
                {row.subtitles[col.dimension]}
              </div>
            )}
          </TableCell>
        );
      case "badge": {
        const token = value !== undefined ? col.colors?.[String(value)] : undefined;
        return (
          <TableCell key={col.dimension} className="px-4 py-3">
            <Badge
              className={`rounded-full font-medium border-transparent ${
                TOKEN_TINT_CLASSES[token ?? "muted"]
              }`}
            >
              {String(value ?? PLACEHOLDER)}
            </Badge>
          </TableCell>
        );
      }
      case "boolBadge":
        return (
          <TableCell key={col.dimension} className="px-4 py-3">
            <Badge
              className={`rounded-full border-transparent ${
                value ? TOKEN_TINT_CLASSES["chart-2"] : TOKEN_TINT_CLASSES.muted
              }`}
            >
              {value ? t("filters.yes") : t("filters.no")}
            </Badge>
          </TableCell>
        );
      case "number":
        return (
          <TableCell key={col.dimension} className="px-4 py-3 tabular-nums text-muted-foreground">
            {typeof value === "number"
              ? `${value}${col.unit ? ` ${col.unit}` : ""}`
              : PLACEHOLDER}
          </TableCell>
        );
      default:
        return (
          <TableCell key={col.dimension} className="px-4 py-3 text-muted-foreground">
            {String(value ?? PLACEHOLDER)}
          </TableCell>
        );
    }
  };

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-0 overflow-hidden">
      <CardContent className="px-0">
      <div className="flex items-center justify-between p-5 pb-4">
        <div className="flex items-center gap-2">
          <TableIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("table.title")}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("table.itemCount", undefined, { count: data.length })}
          </span>
          {exportCsv && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <Download className="h-3 w-3" /> {t("table.exportCsv")}
            </Button>
          )}
        </div>
      </div>
      <Table className="text-sm">
          <TableHeader className="bg-muted/40 border-y border-border">
            <TableRow>
              {columns.map((col) => (
                <Th
                  key={col.dimension}
                  k={col.dimension}
                  label={labelFor(col)}
                  sort={sort}
                  onToggle={toggle}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.map((r, i) => (
              <TableRow
                key={r.id}
                className={`border-border/40 ${i % 2 ? "bg-muted/10" : ""} ${
                  rowClickable(r) ? "cursor-pointer" : ""
                }`}
                onClick={rowClickable(r) ? () => handleRowClick(r) : undefined}
              >
                {columns.map((col) => renderCell(r, col))}
              </TableRow>
            ))}
            {slice.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  {t("table.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {t("table.page", undefined, { current: currentPage + 1, total: pages })}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="h-7 px-3 text-xs"
            >
              {t("table.prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={currentPage >= pages - 1}
              className="h-7 px-3 text-xs"
            >
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}
      </CardContent>
      {/* Détail (rowAction preview) — réutilise le conteneur + preview du
          module search ; monté seulement quand une entité est ouverte. */}
      {rowAction?.kind === "preview" && detailEntity && (
        <SwitchDetailsMode
          openDetails={!!detailEntity}
          setOpenDetails={(open) => {
            if (!open) setDetailEntity(null);
          }}
          item={detailEntity}
          card={{ detailsMode: rowAction.detailsMode ?? "drawer" }}
          preview={rowAction.preview}
        />
      )}
    </Card>
  );
}
