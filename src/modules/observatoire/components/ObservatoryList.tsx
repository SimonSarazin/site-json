import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import { Download, List as ListIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/hooks/useT";
import type {
  DimensionDef,
  DimensionsConfig,
  ObservatoryItem,
  ObservatoryListDef,
  RowActionDef,
} from "../schema";
import { dimensionList, dimensionValue, type LabelMaps } from "../dimensions";
import { PLACEHOLDER, buildEntitiesCsv } from "../dashboard";
import { downloadCsv } from "../utils";

/** Une ligne prête à rendre — le calcul des libellés vit hors du JSX. */
interface ListRow {
  /** Index dans `data` (et donc dans `entities`, aligné index à index). */
  index: number;
  key: string;
  title: string;
  subtitle: string;
}

/** Slug d'un item (rowAction "profil") — même règle que `buildRow`. */
function slugOf(item: ObservatoryItem | undefined): string | undefined {
  const slug = (item as { slug?: unknown } | undefined)?.slug;
  return typeof slug === "string" && slug !== "" ? slug : undefined;
}

/** Valeur affichable d'une dimension, quel que soit son `kind`. */
function readDimension(
  item: ObservatoryItem,
  dimensions: DimensionsConfig,
  id: string,
  labels?: LabelMaps,
): string {
  const def = dimensions[id];
  if (!def) return "";
  if (def.kind === "list") return dimensionList(item, def).join(", ");
  return dimensionValue(item, def, labels?.[id]) ?? "";
}

interface ObservatoryListProps {
  data: ObservatoryItem[];
  /** Entités SDK alignées avec `data` (ouverture de la fiche). */
  entities?: readonly SearchEntity[];
  dimensions: DimensionsConfig;
  list: ObservatoryListDef;
  /** Ouverture de la fiche — `props.rowAction` ou, en repli, `table.rowAction`. */
  rowAction?: RowActionDef;
  /** Export CSV du résultat filtré (opt-in config : `props.export`). Le bouton
   *  n'apparaît qu'avec `fields` : sans colonnes de table à reprendre, c'est la
   *  seule déclaration qui dit quoi exporter. */
  exportCsv?: { filename?: string; fields?: DimensionDef[] } | null;
  labels?: LabelMaps;
  /** Libellé sélectionné (clic sur une ligne) — filtre porté par le parent. */
  selection: string;
  onSelect: (label: string) => void;
}

/**
 * Liste des items en panneau étroit — le pendant « une ligne, un item » de
 * `ObservatoryTable`, pour le mode `layout: "split"`.
 *
 * Deux gestes par ligne, volontairement distincts : le LIBELLÉ filtre le
 * tableau de bord (mot à mot, cf. `applySelection`), le bouton FICHE ouvre le
 * détail — même conteneur et même contrat `preview` que la table, réservations
 * et tableau de bord d'installation compris.
 */
export function ObservatoryList({
  data,
  entities,
  dimensions,
  list,
  rowAction,
  exportCsv,
  labels,
  selection,
  onSelect,
}: ObservatoryListProps) {
  const t = useT("modules/observatoire");
  const navigate = useNavigate();
  const [detailEntity, setDetailEntity] = useState<SearchEntity | null>(null);
  const pageSize = list.pageSize ?? 50;
  const [shown, setShown] = useState(pageSize);
  // Le jeu filtré a changé (filtre, recherche ou sélection) : on repart d'une
  // tranche. Sans ce recalage, dérouler 500 lignes puis filtrer/défiltrer les
  // rendrait toutes d'un coup — exactement ce que `pageSize` évite. Ajustement
  // d'état PENDANT le rendu (patron React), pas un effet : pas de double rendu.
  const [countAtRender, setCountAtRender] = useState(data.length);
  if (countAtRender !== data.length) {
    setCountAtRender(data.length);
    setShown(pageSize);
  }

  if (import.meta.env.DEV && !dimensions[list.titleDimension]) {
    console.warn(
      `[observatoire] list.titleDimension "${list.titleDimension}" sans dimension déclarée — les lignes n'auront pas de libellé`,
    );
  }

  // Tri alphabétique : une liste latérale se parcourt à l'œil, l'ordre de la
  // requête n'y veut rien dire (la table, elle, a des en-têtes pour trier).
  const rows = useMemo<ListRow[]>(() => {
    const out = data.map((item, index) => {
      const title = readDimension(item, dimensions, list.titleDimension, labels);
      const subtitle = (list.subtitleDimensions ?? [])
        .map((id) => readDimension(item, dimensions, id, labels))
        .filter(Boolean)
        .join(" · ");
      return {
        index,
        // Les homonymes sont fréquents (équipements d'une même installation) :
        // la clé porte l'index, jamais le seul libellé.
        key: `${index}-${title}`,
        title: title || PLACEHOLDER,
        subtitle,
      };
    });
    return out.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  }, [data, dimensions, list.titleDimension, list.subtitleDimensions, labels]);

  const visible = rows.slice(0, shown);
  const openSheet = (row: ListRow) => {
    if (!rowAction) return;
    if (rowAction.kind === "profil") {
      const slug = slugOf(data[row.index]);
      if (slug) navigate(`/profil/${slug}`);
      return;
    }
    const entity = entities?.[row.index];
    if (entity) setDetailEntity(entity);
  };
  const canOpenSheet = (row: ListRow): boolean =>
    rowAction?.kind === "profil"
      ? !!slugOf(data[row.index])
      : rowAction?.kind === "preview"
        ? !!entities?.[row.index]
        : false;

  const handleExport = () => {
    const fields = exportCsv?.fields;
    if (!fields?.length) return;
    const headers = fields.map((f) => (f.label ? t(f.label) : f.labelKey ? t(f.labelKey) : ""));
    const csv = buildEntitiesCsv(
      rows.map((r) => data[r.index]),
      fields,
      headers,
      { yes: t("filters.yes"), no: t("filters.no") },
    );
    downloadCsv(csv, exportCsv?.filename ?? "export");
  };

  return (
    <Card className="gap-0 rounded-2xl border-border/50 py-0">
      <CardContent className="px-0">
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <ListIcon className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="truncate text-sm font-semibold">
              {list.label ? t(list.label) : t("list.title")}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t("table.itemCount", undefined, { count: data.length })}
            </span>
            {exportCsv?.fields?.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <Download className="h-3 w-3" /> {t("table.exportCsv")}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Sélection active : sans ce rappel, un filtre posé d'un clic reste
            invisible — l'utilisateur ne verrait qu'une liste écourtée. */}
        {selection && (
          <div className="px-5 pb-3">
            <Badge
              variant="secondary"
              className="max-w-full gap-1 rounded-full py-1 pl-3 pr-1 text-xs font-normal"
            >
              <span className="truncate">{selection}</span>
              <button
                type="button"
                onClick={() => onSelect("")}
                aria-label={t("list.clearSelection")}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}

        <ul className="border-t border-border">
          {visible.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-2 border-b border-border/40 px-5 py-2.5"
            >
              <button
                type="button"
                onClick={() => onSelect(row.title)}
                aria-pressed={selection === row.title}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                {row.subtitle && (
                  <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                )}
              </button>
              {canOpenSheet(row) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openSheet(row)}
                  className="h-7 shrink-0 px-2 text-xs"
                >
                  {t("list.sheet")}
                </Button>
              )}
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-muted-foreground">
              {t("table.empty")}
            </li>
          )}
        </ul>

        {shown < rows.length && (
          <div className="p-3 text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShown((n) => n + pageSize)}
              className="h-7 px-3 text-xs"
            >
              {t("list.showMore", undefined, { count: rows.length - shown })}
            </Button>
          </div>
        )}
      </CardContent>

      {/* Fiche : même conteneur et même contrat `preview` que la table. */}
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
