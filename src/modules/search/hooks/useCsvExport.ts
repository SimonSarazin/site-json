import { useState, useCallback } from "react";
import Papa from "papaparse";
import type { CsvButtonConfig } from "../schema";
import type { GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";

const DEFAULT_COLUMNS = [
  { header: "Nom", path: "name" },
];

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], obj);
}

function extractValue(item: Record<string, unknown>, path: string): string {
  const serverData = (item.serverData || item) as Record<string, unknown>;

  const raw = resolvePath(serverData, path) ?? resolvePath(item, path);

  switch (path) {
    case "address": {
      const addr = (serverData.address ?? item.address) as Record<string, unknown> | undefined;
      if (!addr || typeof addr !== "object") return String(addr ?? "");
      const parts = [
        addr.streetAddress,
        addr.postalCode,
        addr.addressLocality,
        addr.level1Name || addr.addressCountry,
      ].filter(Boolean);
      return parts.join(", ");
    }

    default: {
      if (raw == null) return "";
      if (Array.isArray(raw)) return raw.join(", ");
      if (typeof raw === "object") return Object.keys(raw).join(", ");
      return String(raw);
    }
  }
}

export interface UseCsvExportOptions {
  csvButton?: CsvButtonConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity?: any;
  searchParams?: {
    searchText: string;
    searchTags: Record<string, string[]>;
    searchType: Record<string, string[]> | null;
    baseParams?: {
      fediverse?: boolean;
      defaultTypes?: string[];
      defaultTags?: string[];
      defaultFilters?: Record<string, unknown>;
      defaultFields?: string[];
      defaultSortBy?: Record<string, 1 | -1>;
      notSourceKey?: boolean;
      locality?: Record<string, unknown>;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helper?: any;
}

function generateCsv(results: Record<string, unknown>[], csvButton: CsvButtonConfig) {
  const columns = csvButton?.columns ?? DEFAULT_COLUMNS;
  const separator = csvButton?.separator ?? ";";

  const rows = results.map((item) =>
    columns.reduce<Record<string, string>>((row, col) => {
      row[col.header] = extractValue(item, col.path);
      return row;
    }, {})
  );

  const csv = Papa.unparse(rows, {
    delimiter: separator,
    header: true,
  });

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const filename = csvButton?.filename ?? `export_${new Date().toISOString().split("T")[0]}`;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function useCsvExport({ csvButton, entity, searchParams, helper }: UseCsvExportOptions) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportCsv = useCallback(
    async () => {
      if (!csvButton?.show) return;
      if (!entity || !searchParams) return;

      setIsExporting(true);
      setError(null);

      try {
        const { searchText, searchTags, searchType, baseParams = {} } = searchParams;

        const type = Array.isArray(searchType)
          ? searchType
          : searchType
            ? Object.values(searchType).flat()
            : [];
        const tags = Object.values(searchTags).flat() as string[];

        const {
          fediverse = false,
          defaultTypes,
          defaultTags,
          defaultFilters,
          defaultFields,
          defaultSortBy,
          notSourceKey,
          locality,
        } = baseParams;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const param: Partial<GlobalAutocompleteCostumData> & Record<string, any> = ({
          name: searchText,
          fediverse,
          indexMin: 0,
          indexStep: 0, // 0 = get ALL results
          ...(tags.length > 0 && {
            searchTags: tags,
            options: { tags: { verb: "$all" } },
          }),
          ...(defaultFilters && Object.keys(defaultFilters).length > 0 && {
            filters: defaultFilters,
          }),
          ...(defaultFields && defaultFields.length > 0 && {
            fields: defaultFields,
          }),
          ...(defaultSortBy && Object.keys(defaultSortBy).length > 0 && {
            sortBy: defaultSortBy,
          }),
          ...(locality && Object.keys(locality).length > 0 && { locality }),
          ...(notSourceKey ? { notSourceKey: true } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any;

        if (type && type.length > 0) param.searchType = type as GlobalAutocompleteCostumData["searchType"];
        if (!type && defaultTypes) param.searchType = defaultTypes as GlobalAutocompleteCostumData["searchType"];
        if (defaultTags && defaultTags.length > 0) {
          param.searchTags = defaultTags;
        }

        if (!param.searchType) {
          generateCsv([], csvButton);
          return;
        }

        const result = await entity.searchCostum(param);
        let allResults = result?.results ?? [];

        if (helper && allResults.length > 0) {
          allResults = allResults.map((item: Record<string, unknown>) => {
            try {
              return helper.fromEntityJSON ? helper.fromEntityJSON(item) : item;
            } catch {
              return item;
            }
          });
        }

        generateCsv(allResults, csvButton);
      } catch (err) {
        console.error("Erreur export CSV:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsExporting(false);
      }
    },
    [csvButton, entity, searchParams, helper]
  );

  return {
    exportCsv,
    isExporting,
    error,
  };
}
