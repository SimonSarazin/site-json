import { useState, useCallback } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import type { CsvButtonConfig } from "../schema";

export interface CsvExportParams {
  searchText?: string;
  searchTags?: string[];
  searchType?: string[];
  filters?: Record<string, unknown>;
  locality?: Record<string, { id: string; type: string }>;
  notSourceKey?: boolean;
  costumSlug?: string;
  costumId?: string;
  costumType?: string;
}

export interface UseCsvExportOptions {
  csvButton?: CsvButtonConfig;
  baseParams?: CsvExportParams;
}

const DEFAULT_FIELDS = [
  "name",
  "siren",
  "email",
  "typologie",
  "domains",
  "specialities",
  "offer",
  "contact",
  "partners",
  "link",
  "date",
  "address",
];

const DEFAULT_LABELS = [
  "Nom",
  "SIREN",
  "Email",
  "Type d'acteur",
  "Domaines/sous-domaines",
  "Spécialités",
  "offre(matériels/logiciels/services)",
  "Contact",
  "Partenariats/affiliations",
  "Source(URL)",
  "Date de vérification",
  "Adresse",
];

export function useCsvExport({ csvButton, baseParams = {} }: UseCsvExportOptions) {
  const { apiClient } = useCocolight();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const exportCsv = useCallback(
    async (params: CsvExportParams = {}) => {
      if (!apiClient) {
        setError(new Error("API client non initialisé"));
        return;
      }

      if (!csvButton?.show) {
        return;
      }

      setIsExporting(true);
      setError(null);

      try {
        const mergedParams = { ...baseParams, ...params };

        const fields = csvButton.fields || DEFAULT_FIELDS;
        const labels = csvButton.labels || DEFAULT_LABELS;

        const searchType = mergedParams.searchType || ["organizations"];

        const requestData = {
          name: mergedParams.searchText || "",
          searchType,
          countType: searchType,
          indexMin: 0,
          indexStep: 10000,
          initType: "",
          count: true,
          fediverse: false,
          costumSlug: mergedParams.costumSlug || "",
          costumEditMode: false,
          fields,
          labels,
          multicolumn: "true",
          ...(mergedParams.searchTags && mergedParams.searchTags.length > 0 && {
            searchTags: mergedParams.searchTags,
            options: { tags: { verb: "$all" } },
          }),
          ...(mergedParams.filters && Object.keys(mergedParams.filters).length > 0 && {
            filters: mergedParams.filters,
          }),
          ...(mergedParams.locality && Object.keys(mergedParams.locality).length > 0 && {
            locality: mergedParams.locality,
          }),
          ...(mergedParams.notSourceKey ? { notSourceKey: true } : {}),
        };

        const response = await apiClient.callEndpoint("COSTUM_CUSTOMIZE_CSV", requestData);

        const csvContent = response.data;

        if (typeof csvContent === "string") {
          const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `export_${new Date().toISOString().split("T")[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          throw new Error("Format de réponse CSV invalide");
        }
      } catch (err) {
        console.error("Erreur export CSV:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsExporting(false);
      }
    },
    [apiClient, csvButton, baseParams]
  );

  return {
    exportCsv,
    isExporting,
    error,
  };
}
