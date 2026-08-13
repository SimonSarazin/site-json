// Side-effect : enregistre le namespace i18n "modules/aac" dès le chargement du
// chunk de la section (le point d'entrée section n'importe pas index.ts).
import "../i18n";

import { useMemo, useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSite } from "@/hooks/useSite";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { useDebounce } from "@/hooks/useDebounce";
import { getBaseUrl } from "@/lib/constant/common";
import { useAacConfig } from "../hooks/useAacConfig";
import {
  useAacFormMeta,
  useAacContextId,
  useAacFormParams,
  useAacFormEntity,
} from "../hooks/useAacFormMeta";
import { useAacCommuns } from "../hooks/useAacCommuns";
import { useAacFacets } from "../hooks/useAacFacets";
import { useAacPermissions } from "../hooks/useAacPermissions";
import type { AacVisibility } from "../lib/aacQueryParams";
import {
  resolveAacCardFields,
  EMPTY_AAC_CARD_FIELDS,
} from "../lib/resolveAacCardFields";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "../lib/filtersKey";
import { AacDirectoryFilters } from "../components/directory/AacDirectoryFilters";
import { AacDirectoryResults } from "../components/directory/AacDirectoryResults";
import type { AacDirectorySectionProps, AacDisplayMode } from "../schema";

interface Props {
  id?: string;
  props: AacDirectorySectionProps;
}

/** Le texte saisi n'entre dans la query key qu'après cette pause. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Annuaire des communs d'un AAC.
 *
 * Le `formId` vient de `config.aac.formId` (UN SEUL AAC par site) — jamais des
 * props de section, pour garder une source de vérité unique.
 *
 * Les OPTIONS des filtres viennent du vrai formulaire (`useAacFormMeta`) ; les
 * communs, de l'endpoint `directoryproposal` (cf. `communsTransport`).
 *
 * Deux dispositions, un seul jeu de données : la grille de cartes pour découvrir,
 * la liste pour comparer. La bascule est ici — donc à côté du compteur, où elle
 * commente ce qu'elle affecte — et non dans les composants de résultats, qui
 * n'ont pas à connaître l'existence de l'autre mode.
 */
export default function AacDirectorySection({ id, props }: Props) {
  const t = useT("modules/aac");
  const { t: localize } = useLocalization();
  const { config: siteConfig } = useSite();
  const { entity } = useCocolight();

  const formId = siteConfig.aac?.formId ?? null;
  const {
    title,
    description,
    className,
    display: initialDisplay = "grid",
    columns = 3,
    pageSize = 12,
    filters: enabledFilters = {
      search: true,
      tags: true,
      maturity: true,
      usage: true,
      sort: true,
    },
    emptyText,
  } = props;

  const [filters, setFilters] = useState<AacDirectoryFiltersState>(EMPTY_AAC_FILTERS);
  const debouncedQuery = useDebounce(filters.q, SEARCH_DEBOUNCE_MS);

  // La config ne fixe que le point de DÉPART : le mode reste un choix de
  // lecture, pas un réglage de site. Volontairement pas persisté (ni URL, ni
  // stockage local) — un état lu au montage divergerait du HTML SSR.
  const [display, setDisplay] = useState<AacDisplayMode>(initialDisplay);

  const { config } = useAacConfig(formId);
  const { meta, isLoading: isFormLoading } = useAacFormMeta(formId);
  const contextId = useAacContextId(formId);
  const formParams = useAacFormParams(formId);
  // L'instance `Form` RATTACHÉE à l'entité costum : son parent porte le slug qui
  // devient le pathParam `{source}` de l'endpoint.
  const form = useAacFormEntity(formId);

  // Quelles questions portent titre / description / tags / maturité / dépense.
  // L'override de config prime, sinon heuristique — jamais d'id en dur ici.
  const resolved = useMemo(
    () =>
      meta && config
        ? resolveAacCardFields(meta, config.roles, siteConfig.aac?.directory?.fields)
        : null,
    [meta, config, siteConfig.aac?.directory?.fields]
  );

  const cardFields = resolved?.fields ?? EMPTY_AAC_CARD_FIELDS;

  // Qui regarde. Un visiteur NON ADMINISTRATEUR ne voit que les communs
  // sélectionnés, plus les siens — parité avec le filtre `applyFor: "forUser"`
  // du bloc legacy. Entre dans la query key : la liste dépend du visiteur.
  const perms = useAacPermissions(entity);
  const visibility = useMemo<AacVisibility>(
    () => ({
      isAdmin: perms.isAdmin,
      currentUserId: perms.currentUserId,
      contextId,
    }),
    [perms.isAdmin, perms.currentUserId, contextId]
  );

  // Facettes calculées sur le jeu NON filtré : cocher une option ne doit pas
  // faire disparaître les autres (cf. `useAacFacets`).
  const { usageTree, tagOptions, isLoading: isFacetsLoading } = useAacFacets({
    formId,
    form,
    fields: cardFields,
    formParams,
    contextId,
    baseUrl: getBaseUrl(),
    visibility,
  });

  const { communs, totalCount, isLoading, isFetchingNextPage, hasNextPage, lastItemRef, error } =
    useAacCommuns({
      formId,
      form,
      // Le listing n'ATTEND PAS le formulaire : sans lui, `parseAacAnswer`
      // retombe sur les champs pré-calculés du backend, qui suffisent à rendre
      // une carte. La résolution des questions affine ensuite (et débloque les
      // filtres, dont les options viennent du form).
      fields: cardFields,
      // Seule la recherche est debouncée ; cocher une facette doit réagir tout de suite.
      filters: { ...filters, q: debouncedQuery },
      pageSize,
      contextId,
      baseUrl: getBaseUrl(),
      visibility,
    });

  if (!formId) {
    return (
      <section id={id} className={cn("py-12", className)}>
        <p className="text-center text-muted-foreground">{String(t("section.noForm"))}</p>
      </section>
    );
  }

  return (
    <section id={id} className={cn("space-y-8 py-12", className)}>
      {(title || description) && (
        <header className="space-y-2">
          {title && (
            <h2 className="text-3xl font-bold tracking-tight">{localize(title)}</h2>
          )}
          {description && (
            <p className="text-muted-foreground">{localize(description)}</p>
          )}
        </header>
      )}

      {/* Les filtres sont une COLONNE, pas une barre : c'est ce qui permet aux
          facettes de s'ouvrir en accordéon sans repousser la grille. Elle passe
          au-dessus en pile sous `lg`. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
        <AacDirectoryFilters
          filters={filters}
          onChange={setFilters}
          usageTree={usageTree}
          tagOptions={tagOptions}
          maturityField={resolved?.fields.maturity ?? null}
          enabled={enabledFilters}
          isLoading={isFormLoading || isFacetsLoading}
        />

        <div className="space-y-4">
          {/* Compteur à gauche, bascule d'affichage à droite — la disposition du
              legacy, où le sélecteur de vue borde la ligne de décompte. */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {totalCount}{" "}
              {String(t(totalCount > 1 ? "directory.count_other" : "directory.count_one"))}
            </p>

            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={display}
              // Radix autorise la désélection sur un groupe `single` : sans cette
              // garde, un second clic sur le mode actif rendrait `""` et
              // l'annuaire n'aurait plus d'affichage du tout.
              onValueChange={(value) => {
                if (value) setDisplay(value as AacDisplayMode);
              }}
              aria-label={String(t("directory.display.label"))}
            >
              <ToggleGroupItem value="grid" aria-label={String(t("directory.display.grid"))}>
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label={String(t("directory.display.list"))}>
                <List className="h-4 w-4" aria-hidden="true" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <AacDirectoryResults
            communs={communs}
            display={display}
            columns={columns}
            isLoading={isLoading}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            error={error}
            lastItemRef={lastItemRef}
            emptyText={emptyText ? localize(emptyText) : undefined}
          />
        </div>
      </div>
    </section>
  );
}
