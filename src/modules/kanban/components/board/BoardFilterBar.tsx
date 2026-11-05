import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FilterPopover, type FilterChoice } from "@/modules/kanban/components/ui/FilterPopover";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { boardFilterOptions, filterCards, NO_MILESTONE_FILTER } from "@/modules/kanban/lib/boardFilter";
import { hasMilestones } from "@/modules/kanban/lib/boardSource";
import { memberDisplayName } from "@/modules/kanban/lib/memberName";
import type { BoardSnapshot } from "@/modules/kanban/types";
import type { BoardSearch } from "./boardSearch";
import { clearFacet, criteriaSignature, facetValues, filterResultAnnouncement, hasActiveCriteria, toggleFacetValue, UNASSIGNED_FILTER, type FilterFacet } from "./filterBar";
import { safeLabelColor } from "./kanbanDnd";
import { nextAnnouncement } from "./liveRegion";
import { PriorityDot } from "./PriorityDot";

/** Au-delà, le popover des assignés gagne un champ de recherche interne. */
const SEARCHABLE_FROM = 8;

/**
 * Délai avant d'annoncer le résultat d'un filtrage : une pause dans la frappe. Annoncer à
 * chaque touche couperait la parole au lecteur d'écran en boucle.
 */
const RESULT_ANNOUNCE_DELAY_MS = 600;

export interface BoardFilterBarProps {
  snapshot: BoardSnapshot;
  search: BoardSearch;
  className?: string;
}

/**
 * Barre de filtres du tableau (DESIGN §6.2 de co-kanban) : recherche, puis Assignés, Priorité,
 * Étiquettes, Échéance, Statut — et Jalon sur le tableau d'un projet.
 *
 * Aucune requête n'est refaite : tout écrit dans l'état de la vue (`useBoardSearch`), que le
 * tableau donne au moteur pur (`lib/boardFilter.ts`). Les compteurs des choix portent sur TOUT
 * le tableau (`boardFilterOptions`) : calculés sur le résultat filtré, ils tomberaient à zéro dès
 * qu'on coche ailleurs et l'on ne pourrait plus élargir.
 *
 * Écart avec co-kanban : pas de raccourci ⌘F / Ctrl+F. Sur une page de site, il confisquerait
 * la recherche du navigateur dans tout le reste de la page.
 */
export function BoardFilterBar({ snapshot, search, className }: BoardFilterBarProps) {
  const { t } = useTranslation("modules/kanban");
  const { text, setText, filters, setFilters, resetFilters, activeFilterCount, criteria } = search;
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement | null>(null);

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Échap vide la recherche sans quitter le champ ; vide, il laisse la touche remonter
    // (fermer une couche au-dessus).
    if (event.key !== "Escape" || text === "") return;
    event.preventDefault();
    event.stopPropagation();
    setText("");
  }

  /*
   * Recalculé sur l'instantané seulement : les compteurs ne dépendent pas des filtres. L'horloge
   * est lue ici, dans le navigateur — la barre n'existe qu'une fois `board/get` revenu, jamais
   * au rendu serveur.
   */
  const options = useMemo(() => boardFilterOptions(snapshot), [snapshot]);

  /*
   * Le RÉSULTAT d'un filtrage s'annonce (WCAG 4.1.3) : « N cartes correspondent, sur M », après
   * une pause. Seul un changement de SÉLECTION l'émet (empreinte du critère) : ni le premier
   * rendu, ni une écriture reçue par la synchronisation. L'instantané et le critère sont lus par
   * ref au moment d'annoncer.
   */
  const signature = criteriaSignature(criteria);
  const liveRef = useRef({ snapshot, criteria });
  useEffect(() => {
    liveRef.current = { snapshot, criteria };
  });
  const announcedRef = useRef(signature);
  const [resultMessage, setResultMessage] = useState("");
  useEffect(() => {
    if (signature === announcedRef.current) return;
    const timer = window.setTimeout(() => {
      announcedRef.current = signature;
      const { snapshot: current, criteria: selection } = liveRef.current;
      const { key, values } = filterResultAnnouncement(filterCards(current, selection).length, current.cards.length, hasActiveCriteria(selection));
      setResultMessage((previous) => nextAnnouncement(previous, t(key, values)));
    }, RESULT_ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [signature, t]);

  const unknownMember = t("members.unknown");
  /*
   * Les choix fabriquent des nœuds (portraits, points) pour six popovers : mémoïsés sur les
   * options, ils ne se refont pas à chaque frappe dans la recherche, qui rerend la barre.
   */
  const facets = useMemo(() => {
    const assignees: FilterChoice[] = [
      { value: UNASSIGNED_FILTER, label: t("filters.unassigned"), count: options.unassignedCount },
      ...options.assignees.map((option) => {
        const name = memberDisplayName(option.member?.profile, unknownMember);
        return { value: option.userId, label: name, count: option.count, leading: <MemberAvatar name={name} src={option.member?.profile?.profilThumbImageUrl} size="sm" /> };
      }),
    ];

    const priorities: FilterChoice[] = options.priorities.map((option) => ({
      value: option.value,
      label: option.value === "none" ? t("priority.none") : t(`priority.long.${option.value}`),
      count: option.count,
      leading: option.value === "none" ? <span className="block size-2 rounded-full border border-dashed border-muted-foreground" /> : <PriorityDot priority={option.value} />,
    }));

    const labels: FilterChoice[] = options.labels.map((option) => ({
      value: option.label.id,
      label: option.label.name,
      count: option.count,
      // La couleur vient de la base : seule une hexadécimale stricte passe.
      leading: <span className="block size-2.5 rounded-full" style={{ backgroundColor: safeLabelColor(option.label.color) ?? "var(--muted-foreground)" }} />,
    }));

    const dueWindows: FilterChoice[] = options.dueWindows.map((option) => ({ value: option.value, label: t(`filters.due.${option.value}`), count: option.count }));

    const statuses: FilterChoice[] = options.statuses.map((option) => ({ value: option.value, label: t(`card.status.${option.value}`), count: option.count }));

    const milestones: FilterChoice[] = options.milestones.map((option) => ({
      value: option.value,
      label:
        option.value === NO_MILESTONE_FILTER || option.milestone === null
          ? t("filters.noMilestone")
          : option.milestone.status === "close"
            ? t("card.milestoneClosed", { name: option.milestone.name })
            : option.milestone.name,
      count: option.count,
    }));

    return { assignees, priorities, labels, dueWindows, statuses, milestones };
  }, [options, t, unknownMember]);

  // Le filtre Jalon n'a de sens que là où il y a des jalons : le tableau d'un PROJET, pas celui
  // d'une organisation (D22).
  const withMilestones = hasMilestones({ source: snapshot.capabilities.source, parentType: snapshot.board.parentType });

  const bar: { facet: FilterFacet; label: string; choices: FilterChoice[]; empty: string; searchable?: boolean }[] = [
    { facet: "assignees", label: t("filterBar.assignees"), choices: facets.assignees, empty: t("filterBar.emptyAssignees"), searchable: facets.assignees.length > SEARCHABLE_FROM },
    { facet: "priorities", label: t("filterBar.priority"), choices: facets.priorities, empty: t("filterBar.emptyPriority") },
    { facet: "labelIds", label: t("filterBar.labels"), choices: facets.labels, empty: t("labels.emptyBoard") },
    { facet: "dueWindows", label: t("filterBar.due"), choices: facets.dueWindows, empty: t("filterBar.emptyDue") },
    { facet: "statuses", label: t("filterBar.status"), choices: facets.statuses, empty: t("filterBar.emptyStatus") },
    ...(withMilestones ? [{ facet: "milestoneIds" as const, label: t("filterBar.milestone"), choices: facets.milestones, empty: t("milestones.empty") }] : []),
  ];

  return (
    <div role="search" aria-label={t("filterBar.label")} className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative w-full sm:w-64">
        <label htmlFor={searchId} className="sr-only">
          {t("search.label")}
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          id={searchId}
          type="search"
          value={text}
          autoComplete="off"
          placeholder={t("search.placeholder")}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onSearchKeyDown}
          // La croix native est masquée : celle du champ a un nom accessible et rend le focus.
          className="pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {text !== "" ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("search.clear")}
            className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
            onClick={() => {
              setText("");
              searchRef.current?.focus();
            }}
          >
            <X aria-hidden />
          </Button>
        ) : null}
      </div>

      {bar.map((entry) => (
        <FilterPopover
          key={entry.facet}
          label={entry.label}
          choices={entry.choices}
          selected={facetValues(filters, entry.facet)}
          onToggle={(value) => setFilters(toggleFacetValue(filters, entry.facet, value))}
          onClear={() => setFilters(clearFacet(filters, entry.facet))}
          emptyText={entry.empty}
          searchable={entry.searchable}
        />
      ))}

      {activeFilterCount > 0 ? (
        // La recherche libre n'est PAS effacée ici : elle a son propre champ visible, la vider
        // depuis ce bouton serait un effet invisible.
        <Button variant="ghost" size="sm" className="pointer-coarse:min-h-11" onClick={resetFilters}>
          <RotateCcw aria-hidden />
          {t("filterBar.reset", { count: activeFilterCount })}
        </Button>
      ) : null}

      {/* Région MONTÉE dès le premier rendu, vide : une région qui apparaît avec son texte n'est
          pas annoncée. */}
      <p role="status" aria-live="polite" className="sr-only">
        {resultMessage}
      </p>
    </div>
  );
}
