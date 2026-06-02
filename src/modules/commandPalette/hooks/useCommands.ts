import { useMemo } from "react";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useDebounce } from "@/hooks/useDebounce";
import { useCocolight } from "@/hooks/useCocolight";
import { useLocalization } from "@/hooks/useLocalization";
import { useSite } from "@/hooks/useSite";
import { getCommandSources } from "../registry/registry";
import type { Command, CommandReadContext, CommandSource } from "../registry/types";
import { filterCommands, groupCommands, type RenderedGroup } from "../lib/commandFilter";

const DEBOUNCE_MS = 200;
const MIN_ASYNC_QUERY = 2;

/** Sélectionne les sources actives, en respectant la liste blanche de config. */
function selectSources(allowed: readonly string[] | undefined): CommandSource[] {
  const sources = getCommandSources();
  if (!allowed || allowed.length === 0) return sources;
  const set = new Set(allowed);
  return sources.filter((s) => set.has(s.namespace));
}

/**
 * Agrège toutes les sources de commandes : sync (immédiat, filtré localement)
 * + async (React Query, débouncé, uniquement à l'ouverture & `query.length>=2`).
 */
export function useCommands(
  rawQuery: string,
  open: boolean
): { groups: RenderedGroup[]; loading: boolean } {
  const debouncedQuery = useDebounce(rawQuery, DEBOUNCE_MS);
  const { me, entity } = useCocolight();
  const { currentLocale } = useLocalization();
  const { config } = useSite();
  const { pathname } = useLocation();
  const { theme } = useTheme();

  const allowed = config.commandPalette?.sources;
  const maxPerGroup = config.commandPalette?.maxResultsPerGroup ?? 10;

  const readCtx: CommandReadContext = useMemo(
    () => ({ query: debouncedQuery, me, locale: currentLocale, pathname, config, theme, entity }),
    [debouncedQuery, me, currentLocale, pathname, config, theme, entity]
  );

  // 1. Sources synchrones — pures, recalculées quand le contexte change.
  const syncCommands = useMemo<Command[]>(() => {
    if (!open) return [];
    return selectSources(allowed)
      .filter((s) => !s.async)
      .flatMap((s) => {
        try {
          return (s.getCommands(readCtx) as Command[]) ?? [];
        } catch (err) {
          console.error(`[commandPalette] source "${s.namespace}" failed`, err);
          return [];
        }
      });
  }, [open, readCtx, allowed]);

  // 2. Sources asynchrones — React Query, clé par query/locale/entité.
  const asyncSources = useMemo(() => selectSources(allowed).filter((s) => s.async), [allowed]);
  const asyncEnabled =
    open && asyncSources.length > 0 && debouncedQuery.trim().length >= MIN_ASYNC_QUERY;

  const { data: asyncCommands = [], isFetching } = useQuery({
    queryKey: ["commandPalette", "async", debouncedQuery, currentLocale, entity?.id ?? null, !!me],
    enabled: asyncEnabled,
    staleTime: 30_000,
    queryFn: async () => {
      const lists = await Promise.all(
        asyncSources.map(async (s) => {
          try {
            return await s.getCommands(readCtx);
          } catch (err) {
            console.error(`[commandPalette] async source "${s.namespace}" failed`, err);
            return [] as Command[];
          }
        })
      );
      return lists.flat();
    },
  });

  // 3. Filtrage (sync only — l'async est déjà filtré backend) + groupement.
  const groups = useMemo(() => {
    const filtered = filterCommands(syncCommands, debouncedQuery, currentLocale);
    return groupCommands([...filtered, ...asyncCommands], maxPerGroup);
  }, [syncCommands, asyncCommands, debouncedQuery, currentLocale, maxPerGroup]);

  return { groups, loading: asyncEnabled && isFetching };
}
