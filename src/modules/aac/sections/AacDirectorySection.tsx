// Side-effect : enregistre le namespace i18n "modules/aac" dès le chargement du
// chunk de la section (le point d'entrée section n'importe pas index.ts).
import "../i18n";

import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { useDebounce } from "@/hooks/useDebounce";
import { useAacDirectoryContext } from "../hooks/useAacDirectoryContext";
import { useAacCommuns } from "../hooks/useAacCommuns";
import { useAacFacets } from "../hooks/useAacFacets";
import { EMPTY_AAC_FILTERS, type AacDirectoryFiltersState } from "../lib/filtersKey";
import { resolveDirectoryFilters } from "../lib/directoryFilters";
import { resolveAacDepositStepKey } from "../lib/depositStep";
import { AacDirectoryFilters } from "../components/directory/AacDirectoryFilters";
import { AacDirectoryResults } from "../components/directory/AacDirectoryResults";
import { AacDepositButton } from "../components/directory/AacDepositButton";
import type { AacDirectorySectionProps, AacDisplayMode } from "../schema";

interface Props {
  id?: string;
  props: AacDirectorySectionProps;
}

/** Le texte saisi n'entre dans la query key qu'après cette pause. */
const SEARCH_DEBOUNCE_MS = 350;

/** Sentinelle inerte : l'aperçu ne défile pas, mais la prop reste requise. */
const NOOP_REF = () => {};

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

  const {
    title,
    description,
    className,
    display: initialDisplay = "grid",
    columns = 3,
    pageSize = 12,
    filters: filtersConfig,
    emptyText,
    showDepositButton = true,
    depositButtonLabel,
    variant = "full",
    moreLink,
  } = props;

  const isPreview = variant === "preview";

  // Fusion avec les défauts, clé par clé : la config n'est pas parsée par Zod à
  // l'exécution, donc un bloc partiel `{"search": false}` arrive tel quel — un
  // défaut de destructuration ne jouerait que si le bloc était ABSENT et
  // éteindrait les quatre autres filtres par omission.
  const enabledFilters = resolveDirectoryFilters(filtersConfig);

  const [filters, setFilters] = useState<AacDirectoryFiltersState>(EMPTY_AAC_FILTERS);
  const debouncedQuery = useDebounce(filters.q, SEARCH_DEBOUNCE_MS);

  // La config ne fixe que le point de DÉPART : le mode reste un choix de
  // lecture, pas un réglage de site. Volontairement pas persisté (ni URL, ni
  // stockage local) — un état lu au montage divergerait du HTML SSR.
  const [display, setDisplay] = useState<AacDisplayMode>(initialDisplay);

  const {
    formId,
    config,
    form,
    fields: cardFields,
    resolved,
    contextId,
    formParams,
    visibility,
    baseUrl,
    isFormLoading,
  } = useAacDirectoryContext();

  // L'étape de DÉPÔT — celle qui porte le titre, sinon la première déclarée.
  // Les suivantes (évaluation, financement, suivi) sont réservées à des rôles.
  const depositStepKey = resolveAacDepositStepKey(resolved?.fields, config);

  // Facettes calculées sur le jeu NON filtré : cocher une option ne doit pas
  // faire disparaître les autres (cf. `useAacFacets`). Un aperçu n'a pas de
  // facettes : les calculer coûterait un balayage de 300 communs pour rien.
  const { usageTree, tagOptions, isLoading: isFacetsLoading } = useAacFacets({
    formId,
    form,
    fields: cardFields,
    formParams,
    contextId,
    baseUrl,
    visibility,
    enabled: !isPreview,
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
      baseUrl,
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
      {/* Le CTA borde la ligne de TITRE — la place qu'il occupe dans le legacy.
          Le titre passe donc dans son propre bloc, et l'en-tête est rendu dès
          que l'un des trois est là (le bouton peut être seul). */}
      {(title || description || showDepositButton) && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            {title && (
              <h2 className="text-3xl font-bold tracking-tight">{localize(title)}</h2>
            )}
            {description && (
              <p className="text-muted-foreground">{localize(description)}</p>
            )}
          </div>

          {showDepositButton && (
            <AacDepositButton
              formId={formId}
              stepKey={depositStepKey}
              label={depositButtonLabel ? localize(depositButtonLabel) : undefined}
            />
          )}
        </header>
      )}

      {/* Un APERÇU n'est qu'une grille suivie de son lien : ni colonne de
          filtres, ni compteur, ni bascule d'affichage, ni sentinelle de
          défilement — sur une page d'accueil, ces commandes promettent une
          exploration que la page ne tient pas. */}
      {isPreview ? (
        <div className="space-y-8">
          <AacDirectoryResults
            communs={communs}
            display={display}
            columns={columns}
            isLoading={isLoading}
            isFetchingNextPage={false}
            hasNextPage={false}
            error={error}
            lastItemRef={NOOP_REF}
            emptyText={emptyText ? localize(emptyText) : undefined}
          />

          {moreLink && (
            <div className="flex justify-center">
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to={moreLink.href}>
                  {moreLink.label ? localize(moreLink.label) : String(t("directory.more"))}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Les filtres sont une COLONNE, pas une barre : c'est ce qui permet aux
           facettes de s'ouvrir en accordéon sans repousser la grille. Elle passe
           au-dessus en pile sous `lg`. */
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
            {/* Compteur à gauche, bascule d'affichage à droite — la disposition
                du legacy, où le sélecteur de vue borde la ligne de décompte. */}
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
                // Radix autorise la désélection sur un groupe `single` : sans
                // cette garde, un second clic sur le mode actif rendrait `""` et
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
      )}
    </section>
  );
}
