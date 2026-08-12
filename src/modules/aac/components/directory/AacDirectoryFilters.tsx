import { SlidersHorizontal, Search } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import {
  hasActiveFilters,
  AAC_SORT_KEYS,
  type AacDirectoryFiltersState,
  type AacSortKey,
} from "../../lib/filtersKey";
import type { AacUsageOption } from "../../lib/aacUsage";
import type { AacCardFieldRef } from "../../lib/resolveAacCardFields";

/** Une option cochable : identifiant, libellé, et décompte facultatif. */
export interface AacFacetOption {
  id: string;
  label: string;
  count?: number;
}

interface AacDirectoryFiltersProps {
  filters: AacDirectoryFiltersState;
  onChange: (next: AacDirectoryFiltersState) => void;
  /** Arbre « Filtrer par besoins », dérivé des communs chargés. */
  usageTree: AacUsageOption[];
  /** Tags avec leur décompte. */
  tagOptions: AacFacetOption[];
  /** Question « Utilisable » résolue — porte le libellé ET les options. */
  maturityField: AacCardFieldRef | null;
  enabled: { search: boolean; tags: boolean; maturity: boolean; usage: boolean; sort: boolean };
  /** Le formulaire n'est pas encore arrivé : facettes annoncées mais inertes. */
  isLoading?: boolean;
}

/**
 * Panneau latéral de filtres — portage du bloc legacy `searchObj`.
 *
 * Quatre partis pris, dans l'ordre où ils comptent :
 *
 *  - **« Filtrer par besoins » ne coûte AUCUNE requête.** Le legacy le remplit
 *    par `Aap::getUsageAnswers`, exécutée côté serveur au rendu du widget ; nous
 *    dérivons le même arbre des communs déjà chargés (cf. `lib/aacUsage.ts`) ;
 *  - **une facette en cours de chargement est ANNONCÉE, pas masquée.** Le
 *    formulaire, d'où viennent libellés et options, arrive après la première
 *    peinture ; masquer puis révéler ferait sauter la colonne ;
 *  - une facette RÉSOLUE mais sans option est, elle, réellement masquée : il n'y
 *    a rien à proposer, et une liste vide se lit comme une panne ;
 *  - **les en-têtes de facette sont des noms COURTS, pris à l'i18n** — jamais le
 *    libellé du formulaire. Une question de formulaire est une phrase entière
 *    (« Le commun est-il suffisamment mature pour être utilisable dès
 *    maintenant ? ») : illisible en en-tête d'accordéon, et elle fait sauter la
 *    hauteur de la colonne. Le libellé complet reste accessible en infobulle.
 *    Les OPTIONS, elles, viennent bien du formulaire — c'est l'AAC qui nomme ses
 *    propres valeurs.
 *
 * Non porté, faute de session : « Déjà lu », qui repose sur le bloc `checkSeen`
 * de l'enveloppe — vide pour un visiteur anonyme.
 */
export function AacDirectoryFilters({
  filters,
  onChange,
  usageTree,
  tagOptions,
  maturityField,
  enabled,
  isLoading = false,
}: AacDirectoryFiltersProps) {
  const t = useT("modules/aac");

  const patch = (next: Partial<AacDirectoryFiltersState>) =>
    onChange({ ...filters, ...next });

  const toggleIn = (list: readonly string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  /** Sous-catégories des seules catégories retenues — « Tous » = toutes. */
  const visibleSubs = usageTree
    .filter((c) => filters.usage.length === 0 || filters.usage.includes(c.id))
    .flatMap((c) => c.children);

  const maturityOptions: AacFacetOption[] = (maturityField?.options ?? []).map((o) => ({
    id: o.value,
    label: o.label,
  }));

  return (
    <aside className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {String(t("directory.filters.title"))}
        </h3>
        <button
          type="button"
          onClick={() => patch({ q: "", tags: [], maturity: [], usage: [], usageSub: [], sort: "" })}
          disabled={!hasActiveFilters(filters)}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {String(t("directory.filters.reset"))}
        </button>
      </div>

      {enabled.search && (
        <div className="relative border-t px-5 py-4">
          <Search
            className="pointer-events-none absolute top-1/2 left-8 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={filters.q}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder={String(t("directory.search.placeholder"))}
            aria-label={String(t("directory.search.label"))}
            className="pl-9"
          />
        </div>
      )}

      <Accordion type="multiple" className="border-t">
        {enabled.usage && (
          <Section
            value="usage"
            label={String(t("directory.filters.usage"))}
            selectedCount={filters.usage.length + filters.usageSub.length}
            isLoading={isLoading && usageTree.length === 0}
            isEmpty={usageTree.length === 0}
            loadingLabel={String(t("directory.loading"))}
          >
            <PillGroup
              legend={String(t("directory.filters.usageCategory"))}
              allLabel={String(t("directory.filters.all"))}
              options={usageTree.map((c) => ({ id: c.id, label: c.label, count: c.count }))}
              selected={filters.usage}
              onToggle={(id) =>
                patch({
                  usage: toggleIn(filters.usage, id),
                  // Une sous-catégorie dont la catégorie n'est plus retenue
                  // n'est plus atteignable : la garder filtrerait sur du
                  // masqué, ce qui se lit comme un bug.
                  usageSub: filters.usageSub.filter((subId) =>
                    usageTree
                      .filter((c) => toggleIn(filters.usage, id).includes(c.id))
                      .some((c) => c.children.some((s) => s.id === subId))
                  ),
                })
              }
              onClear={() => patch({ usage: [], usageSub: [] })}
            />

            {visibleSubs.length > 0 && (
              <PillGroup
                legend={String(t("directory.filters.usageSubCategory"))}
                allLabel={String(t("directory.filters.all"))}
                options={visibleSubs.map((s) => ({
                  id: s.id,
                  label: s.label,
                  count: s.count,
                }))}
                selected={filters.usageSub}
                onToggle={(id) => patch({ usageSub: toggleIn(filters.usageSub, id) })}
                onClear={() => patch({ usageSub: [] })}
              />
            )}
          </Section>
        )}

        {enabled.tags && (
          <Section
            value="tags"
            label={String(t("directory.filters.tags"))}
            selectedCount={filters.tags.length}
            isLoading={isLoading && tagOptions.length === 0}
            isEmpty={tagOptions.length === 0}
            loadingLabel={String(t("directory.loading"))}
          >
            <CheckboxList
              name="tags"
              options={tagOptions}
              selected={filters.tags}
              onToggle={(id) => patch({ tags: toggleIn(filters.tags, id) })}
            />
          </Section>
        )}

        {enabled.maturity && (
          <Section
            value="maturity"
            label={String(t("directory.filters.maturity"))}
            // Le libellé du formulaire est la QUESTION entière (« Le commun
            // est-il suffisamment mature pour être utilisable dès maintenant ? »),
            // illisible en en-tête d'accordéon. On garde le nom court de l'i18n,
            // comme les autres facettes, et la question complète reste
            // accessible en infobulle.
            title={maturityField?.label}
            selectedCount={filters.maturity.length}
            isLoading={isLoading && maturityOptions.length === 0}
            isEmpty={maturityOptions.length === 0}
            loadingLabel={String(t("directory.loading"))}
          >
            <CheckboxList
              name="maturity"
              options={maturityOptions}
              selected={filters.maturity}
              onToggle={(id) => patch({ maturity: toggleIn(filters.maturity, id) })}
            />
          </Section>
        )}

        {enabled.sort && (
          <Section
            value="sort"
            label={String(t("directory.filters.sort"))}
            selectedCount={filters.sort ? 1 : 0}
            isLoading={false}
            isEmpty={false}
            loadingLabel={String(t("directory.loading"))}
          >
            <ul className="space-y-2 pb-1">
              {AAC_SORT_KEYS.map((key) => {
                const id = `aac-sort-${key}`;
                return (
                  <li key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={filters.sort === key}
                      // Un seul tri à la fois : re-cocher le tri actif le retire
                      // et rend l'ordre du serveur.
                      onCheckedChange={() =>
                        patch({ sort: (filters.sort === key ? "" : key) as AacSortKey })
                      }
                    />
                    <label
                      htmlFor={id}
                      className="cursor-pointer text-sm leading-tight text-muted-foreground"
                    >
                      {String(t(`directory.sort.${key}`))}
                    </label>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
      </Accordion>
    </aside>
  );
}

/** Une ligne d'accordéon, avec ses états « en chargement » et « vide ». */
function Section({
  value,
  label,
  title,
  selectedCount,
  isLoading,
  isEmpty,
  loadingLabel,
  children,
}: {
  value: string;
  label: string;
  /** Texte long facultatif — le libellé complet de la question, en infobulle. */
  title?: string;
  selectedCount: number;
  isLoading: boolean;
  isEmpty: boolean;
  loadingLabel: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-between border-b px-5 py-4 text-sm font-semibold text-muted-foreground"
        title={title}
      >
        {label}
        <Spinner label={loadingLabel} />
      </div>
    );
  }

  if (isEmpty) return null;

  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="px-5 text-sm font-semibold hover:no-underline" title={title}>
        <span className="flex items-center gap-2">
          {label}
          {selectedCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {selectedCount}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-5">{children}</AccordionContent>
    </AccordionItem>
  );
}

/** Groupe de pastilles cliquables — le rendu legacy du filtre par besoins. */
function PillGroup({
  legend,
  allLabel,
  options,
  selected,
  onToggle,
  onClear,
}: {
  legend: string;
  allLabel: string;
  options: AacFacetOption[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <fieldset className="pb-3">
      <legend className="mb-2 w-full text-center text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        <Pill label={allLabel} active={selected.length === 0} onClick={onClear} />
        {options.map((option) => (
          <Pill
            key={option.id}
            label={option.label}
            count={option.count}
            active={selected.includes(option.id)}
            onClick={() => onToggle(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Pill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="ml-1.5 text-xs opacity-60">{count}</span>
      )}
    </button>
  );
}

/** Liste de cases à cocher, avec la pastille de décompte du legacy. */
function CheckboxList({
  name,
  options,
  selected,
  onToggle,
}: {
  name: string;
  options: AacFacetOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto pb-1">
      {options.map((option) => {
        const id = `aac-facet-${name}-${option.id}`;
        return (
          <li key={option.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={selected.includes(option.id)}
              onCheckedChange={() => onToggle(option.id)}
            />
            <label
              htmlFor={id}
              className="flex flex-1 cursor-pointer items-center gap-2 text-sm leading-tight text-muted-foreground"
            >
              {option.label}
              {typeof option.count === "number" && (
                <span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {option.count}
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export default AacDirectoryFilters;
