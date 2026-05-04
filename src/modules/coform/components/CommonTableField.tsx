import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import "../i18n/i18n";
import { useCommonTableCatalog } from "../hooks/useCommonTableCatalog";
import { getOriginalFieldKey } from "../utils/formParser";
import type {
  FormFieldMapping,
  CommonTableValue,
  CommonTableSolution,
  HappinessValue,
} from "../types";

interface CommonTableFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: CommonTableValue;
  onChange?: (value: CommonTableValue) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
}

type HappinessKey = Exclude<HappinessValue, "">;
const HAPPINESS_ORDER: HappinessKey[] = ["love", "happySmile", "neutral", "sad", "cry"];
const HAPPINESS_EMOJI: Record<Exclude<HappinessValue, "">, string> = {
  love: "😍",
  happySmile: "😀",
  neutral: "😐",
  sad: "😢",
  cry: "😭",
};

function generateCriteriaId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeDefaultSolution(name: string, usageKey: string, usageLabel: string): CommonTableSolution {
  return {
    criteriaId: generateCriteriaId(),
    criteria: name,
    usage: usageLabel,
    usageKey,
    note: 0,
    happiness: "",
    yesOrNo: false,
    comment: "",
  };
}

// ─── HappinessSelector ─────────────────────────────────────────────────────────
// Dropdown popover : trigger compact (1 cellule = emoji actuel ou placeholder),
// ouvre une grille des 5 emojis. PopoverContent utilise Portal côté Radix,
// donc pas de clipping par l'`overflow-x-auto` de la table.

interface HappinessSelectorProps {
  value: HappinessValue;
  onChange: (next: HappinessValue) => void;
  disabled?: boolean;
  labels: Record<Exclude<HappinessValue, "">, string>;
}

const HappinessSelector = memo(function HappinessSelector({
  value,
  onChange,
  disabled,
  labels,
}: HappinessSelectorProps) {
  const [open, setOpen] = useState(false);
  const currentLabel = value !== "" ? labels[value] : "";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label={currentLabel || "Sélectionner un niveau de satisfaction"}
        title={currentLabel}
        className={cn(
          "inline-flex items-center justify-center gap-1 h-8 min-w-16 rounded-md border px-2 transition-colors",
          "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
          value !== ""
            ? "border-primary/40 bg-primary/5"
            : "border-dashed border-input",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {/* Affiche un emoji "neutre" atténué tant qu'aucune valeur n'est posée
            — donne un repère visuel que c'est un sélecteur d'humeur. */}
        <span
          className={cn(
            "text-lg leading-none",
            value === "" && "opacity-40 grayscale"
          )}
        >
          {HAPPINESS_EMOJI[value !== "" ? value : "neutral"]}
        </span>
        <svg className="h-3 w-3 opacity-60" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-1.5"
        align="start"
        role="radiogroup"
      >
        <div className="flex gap-1">
          {value !== "" && (
            <button
              type="button"
              aria-label="Effacer la sélection"
              title="Effacer"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {HAPPINESS_ORDER.map((h) => {
            const selected = value === h;
            return (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={labels[h]}
                title={labels[h]}
                onClick={() => {
                  onChange(h);
                  setOpen(false);
                }}
                className={cn(
                  "h-9 w-9 rounded-md text-xl leading-none transition-all cursor-pointer",
                  "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selected ? "bg-primary/10 ring-2 ring-primary" : "opacity-80 hover:opacity-100"
                )}
              >
                {HAPPINESS_EMOJI[h]}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
});

// ─── UrgencyGauge ──────────────────────────────────────────────────────────────

interface UrgencyGaugeProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  levelLabels: string[]; // 6 entrées (0..5)
}

const UrgencyGauge = memo(function UrgencyGauge({
  value,
  onChange,
  disabled,
  levelLabels,
}: UrgencyGaugeProps) {
  const idx = Math.max(0, Math.min(5, Math.round(value)));
  const label = levelLabels[idx] ?? "";
  // Couleur progressive : vert → orange → rouge (basée sur la valeur)
  const trackTint =
    value <= 1.5
      ? "[&_[data-slot=slider-range]]:bg-success"
      : value <= 3.5
        ? "[&_[data-slot=slider-range]]:bg-warning"
        : "[&_[data-slot=slider-range]]:bg-destructive";

  return (
    <div className="flex flex-col gap-1 min-w-32">
      <Slider
        min={0}
        max={5}
        step={0.5}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        aria-valuetext={label}
        className={cn("w-full", trackTint)}
      />
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
});

// ─── YesNoToggle ───────────────────────────────────────────────────────────────

interface YesNoToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  yesLabel: string;
  noLabel: string;
}

const YesNoToggle = memo(function YesNoToggle({
  value,
  onChange,
  disabled,
  yesLabel,
  noLabel,
}: YesNoToggleProps) {
  return (
    <div role="radiogroup" className="flex gap-1">
      {([
        [true, yesLabel],
        [false, noLabel],
      ] as const).map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            "px-3 py-1 text-xs rounded-md border transition-colors",
            value === v
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input hover:bg-muted",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
});

// ─── CommentButton ─────────────────────────────────────────────────────────────
// Le module de commentaires n'est pas encore intégré au pipeline coform : on
// affiche pour l'instant un bouton qui ouvre un dialog "feature à venir",
// suivant le pattern du projet (Dialog Radix + DialogTitle/Description).

interface CommentButtonProps {
  i18n: {
    openLabel: string;
    placeholderTitle: string;
    placeholderDescription: string;
    placeholderClose: string;
  };
}

const CommentButton = memo(function CommentButton({ i18n }: CommentButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={i18n.openLabel}
        title={i18n.openLabel}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input",
          "text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        <span>{i18n.openLabel}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{i18n.placeholderTitle}</DialogTitle>
            <DialogDescription>{i18n.placeholderDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="default" onClick={() => setOpen(false)}>
              {i18n.placeholderClose}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

// ─── SolutionsTagList ─────────────────────────────────────────────────────────

interface SolutionsTagListProps {
  solutions: CommonTableSolution[];
  activeSolutionId: string | null;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
  deleteLabel: string;
}

const SolutionsTagList = memo(function SolutionsTagList({
  solutions,
  activeSolutionId,
  onActivate,
  onDelete,
  readOnly,
  deleteLabel,
}: SolutionsTagListProps) {
  if (solutions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {solutions.map((s) => {
        const active = s.criteriaId === activeSolutionId;
        return (
          <span
            key={s.criteriaId}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs",
              "border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/30"
                : "bg-muted text-foreground border-input hover:bg-muted/70 cursor-pointer"
            )}
          >
            <button
              type="button"
              onClick={() => onActivate(s.criteriaId)}
              className="cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
            >
              {s.criteria || "—"}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onDelete(s.criteriaId)}
                aria-label={`${deleteLabel} : ${s.criteria}`}
                className="cursor-pointer hover:bg-destructive/20 rounded-full p-0.5 -mr-1"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
});

// ─── AddSolutionInput ─────────────────────────────────────────────────────────

interface SolutionSuggestion {
  /** Nom de la solution affichée + ajoutée si sélectionnée */
  name: string;
  /** Nombre de répondants l'utilisant (pour tri + indicateur visuel) */
  count: number;
}

interface AddSolutionInputProps {
  onAdd: (name: string) => void;
  placeholder: string;
  buttonLabel: string;
  disabled?: boolean;
  /** Suggestions issues du catalogue collaboratif (pré-filtrées par usageKey). */
  suggestions: SolutionSuggestion[];
}

const AddSolutionInput = memo(function AddSolutionInput({
  onAdd,
  placeholder,
  buttonLabel,
  disabled,
  suggestions,
}: AddSolutionInputProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Filtre les suggestions par préfixe (case-insensitive). Vide → toutes les
  // suggestions disponibles. On limite à 8 pour ne pas allonger la dropdown.
  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const list = q
      ? suggestions.filter((s) => s.name.toLowerCase().includes(q))
      : suggestions;
    return list.slice(0, 8);
  }, [draft, suggestions]);

  const submit = useCallback(
    (forced?: string) => {
      const value = (forced ?? draft).trim();
      if (!value) return;
      onAdd(value);
      setDraft("");
      setOpen(false);
      setActiveIndex(-1);
    },
    [draft, onAdd]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Si une suggestion est highlightée → on l'ajoute. Sinon, ajout libre.
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        submit(filtered[activeIndex].name);
      } else {
        submit();
      }
      return;
    }
    if (e.key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % filtered.length);
      return;
    }
    if (e.key === "ArrowUp" && filtered.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  // Le dropdown est rendu via Popover (Portal Radix) pour échapper au
  // `overflow-x-auto` de la table : il flotte au-dessus du DOM, ne pousse
  // aucun contenu et n'élargit pas la cellule.
  const showDropdown = open && filtered.length > 0;

  return (
    <Popover open={showDropdown} onOpenChange={(o) => !o && setOpen(false)}>
      <div className="flex gap-1">
        <PopoverAnchor asChild>
          <div className="relative flex-1">
            <Input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                setOpen(true);
                setActiveIndex(-1);
              }}
              onClick={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="h-8 text-sm w-full"
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
            />
          </div>
        </PopoverAnchor>
        <button
          type="button"
          onClick={() => submit()}
          disabled={disabled || draft.trim() === ""}
          aria-label={buttonLabel}
          title={buttonLabel}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-md shrink-0",
            "bg-primary text-primary-foreground transition-opacity cursor-pointer",
            "hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-(--radix-popover-trigger-width) max-h-56 overflow-auto"
        // Garde le focus sur l'input — sans ça Radix volerait le focus à l'ouverture.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ul role="listbox" className="py-1">
          {filtered.map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              role="option"
              aria-selected={activeIndex === i}
              // mousedown intercepté avant le blur de l'input.
              onMouseDown={(e) => {
                e.preventDefault();
                submit(s.name);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex items-center justify-between gap-2 px-2 py-1.5 cursor-pointer text-sm",
                activeIndex === i ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
            >
              <span className="truncate">{s.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{s.count}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
});

// ─── CommonTableRow ───────────────────────────────────────────────────────────

interface CommonTableRowProps {
  usage: { usageKey: string; label: string };
  solutions: CommonTableSolution[];
  activeSolutionId: string | null;
  showColumns: {
    criteria: boolean;
    happiness: boolean;
    note: boolean;
    yesNo: boolean;
    comment: boolean;
  };
  i18n: {
    addPlaceholder: string;
    addButton: string;
    deleteSolution: string;
    selectFirst: string;
    happinessLabels: Record<Exclude<HappinessValue, "">, string>;
    noteLevels: string[];
    yesLabel: string;
    noLabel: string;
    commentOpenLabel: string;
    commentPlaceholderTitle: string;
    commentPlaceholderDescription: string;
    commentPlaceholderClose: string;
  };
  onAddSolution: (usageKey: string, usageLabel: string, name: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onSolutionChange: (id: string, patch: Partial<CommonTableSolution>) => void;
  /** Suggestions de solutions pour CET usage (issues du catalogue collaboratif). */
  suggestions: SolutionSuggestion[];
  readOnly?: boolean;
}

const CommonTableRow = memo(function CommonTableRow({
  usage,
  solutions,
  activeSolutionId,
  showColumns,
  i18n,
  onAddSolution,
  onActivate,
  onDelete,
  onSolutionChange,
  suggestions,
  readOnly,
}: CommonTableRowProps) {
  const active = solutions.find((s) => s.criteriaId === activeSolutionId) ?? null;
  const handleAdd = useCallback(
    (name: string) => onAddSolution(usage.usageKey, usage.label, name),
    [onAddSolution, usage.usageKey, usage.label]
  );

  return (
    <tr className="border-b border-border align-top">
      {/* Usage label */}
      <td className="p-2 align-top bg-muted/30 font-medium text-sm wrap-break-word border-r border-border/60">
        {usage.label}
      </td>

      {/* Solutions (input + tags) */}
      {showColumns.criteria && (
        <td className="p-2 align-top space-y-2 wrap-break-word border-r border-border/60">
          {!readOnly && (
            <AddSolutionInput
              onAdd={handleAdd}
              placeholder={i18n.addPlaceholder}
              buttonLabel={i18n.addButton}
              suggestions={suggestions}
            />
          )}
          <SolutionsTagList
            solutions={solutions}
            activeSolutionId={activeSolutionId}
            onActivate={onActivate}
            onDelete={onDelete}
            readOnly={readOnly}
            deleteLabel={i18n.deleteSolution}
          />
        </td>
      )}

      {/* Happiness */}
      {showColumns.happiness && (
        <td className="p-2 align-middle border-r border-border/60">
          {active ? (
            <HappinessSelector
              value={active.happiness}
              onChange={(h) => onSolutionChange(active.criteriaId, { happiness: h })}
              disabled={readOnly}
              labels={i18n.happinessLabels}
            />
          ) : (
            <span className="text-xs text-muted-foreground italic">{i18n.selectFirst}</span>
          )}
        </td>
      )}

      {/* Note (urgence) */}
      {showColumns.note && (
        <td className="p-2 align-middle border-r border-border/60">
          {active && (
            <UrgencyGauge
              value={active.note}
              onChange={(n) => onSolutionChange(active.criteriaId, { note: n })}
              disabled={readOnly}
              levelLabels={i18n.noteLevels}
            />
          )}
        </td>
      )}

      {/* Yes/No */}
      {showColumns.yesNo && (
        <td className="p-2 align-middle border-r border-border/60">
          {active && (
            <YesNoToggle
              value={active.yesOrNo}
              onChange={(b) => onSolutionChange(active.criteriaId, { yesOrNo: b })}
              disabled={readOnly}
              yesLabel={i18n.yesLabel}
              noLabel={i18n.noLabel}
            />
          )}
        </td>
      )}

      {/* Comment — bouton placeholder en attendant l'intégration du module commentaires */}
      {showColumns.comment && (
        <td className="p-2 align-middle">
          {active && !readOnly && (
            <CommentButton
              i18n={{
                openLabel: i18n.commentOpenLabel,
                placeholderTitle: i18n.commentPlaceholderTitle,
                placeholderDescription: i18n.commentPlaceholderDescription,
                placeholderClose: i18n.commentPlaceholderClose,
              }}
            />
          )}
        </td>
      )}
    </tr>
  );
});

// ─── CommonTableField (root) ──────────────────────────────────────────────────

const EMPTY_VALUE: CommonTableValue = { scores: {}, myCatalog: {} };

export function CommonTableField({
  field,
  errors,
  value = EMPTY_VALUE,
  onChange,
  readOnly,
  hideLabel,
}: CommonTableFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const config = field.commonTableConfig;
  const hasError = !!errors[field.name];

  // Catalogue collaboratif (lecture seule) issu du fetch batch au niveau form.
  const collabCatalog = useCommonTableCatalog(getOriginalFieldKey(field));

  const usages = useMemo(() => config?.usages ?? [], [config?.usages]);
  const showColumns = useMemo(
    () =>
      config?.showColumns ?? {
        criteria: true,
        happiness: true,
        note: true,
        yesNo: false,
        comment: true,
      },
    [config?.showColumns]
  );
  const labels = config?.labels ?? {};

  // Augmente la liste d'usages : config admin + tous les `usageKey` qui apparaissent
  // dans le catalogue collaboratif et qu'on n'a pas dans la config (cas typique :
  // les usages sont définis dynamiquement par les répondants, pas en admin).
  const augmentedUsages = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof usages = [];
    for (const u of usages) {
      if (!seen.has(u.usageKey)) {
        seen.add(u.usageKey);
        out.push(u);
      }
    }
    for (const entry of Object.values(collabCatalog)) {
      if (entry.usageKey && !seen.has(entry.usageKey)) {
        seen.add(entry.usageKey);
        out.push({ usageKey: entry.usageKey, label: entry.usage || entry.usageKey });
      }
    }
    // Inclure aussi les usages présents dans MES scores ou MON catalog (mode édition)
    for (const sol of Object.values(value.scores)) {
      if (sol.usageKey && !seen.has(sol.usageKey)) {
        seen.add(sol.usageKey);
        out.push({ usageKey: sol.usageKey, label: sol.usage || sol.usageKey });
      }
    }
    for (const entry of Object.values(value.myCatalog)) {
      if (entry.usageKey && !seen.has(entry.usageKey)) {
        seen.add(entry.usageKey);
        out.push({ usageKey: entry.usageKey, label: entry.usage || entry.usageKey });
      }
    }
    return out;
  }, [usages, collabCatalog, value.scores, value.myCatalog]);

  // Filtre client-side (n'altère JAMAIS `value` — uniquement l'affichage).
  const [filter, setFilter] = useState("");
  const visibleUsages = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return augmentedUsages;
    return augmentedUsages.filter((u) => u.label.toLowerCase().includes(f));
  }, [augmentedUsages, filter]);

  // Solution active par usage, indépendante de `value`.
  const [activeByUsage, setActiveByUsage] = useState<Record<string, string>>({});

  // Suggestions par usage : extraites du catalogue collaboratif, filtrées par
  // usageKey + nom non-vide, triées par fréquence (count décroissant). Stable
  // tant que le catalog ne change pas — donc mémoïsé sur `collabCatalog`.
  const suggestionsByUsage = useMemo(() => {
    const out: Record<string, SolutionSuggestion[]> = {};
    for (const entry of Object.values(collabCatalog)) {
      if (!entry.name || !entry.usageKey) continue;
      (out[entry.usageKey] ??= []).push({ name: entry.name, count: entry.count });
    }
    for (const list of Object.values(out)) {
      list.sort((a, b) => b.count - a.count);
    }
    return out;
  }, [collabCatalog]);

  // Index des solutions par usageKey, basé sur `value.scores`. Cache de référence
  // pour que React.memo sur <CommonTableRow> ne re-rende QUE la ligne modifiée.
  const prevSolutionsRef = useRef<Record<string, CommonTableSolution[]>>({});
  const solutionsByUsage = useMemo(() => {
    const fresh: Record<string, CommonTableSolution[]> = {};
    for (const sol of Object.values(value.scores)) {
      (fresh[sol.usageKey] ??= []).push(sol);
    }
    const prev = prevSolutionsRef.current;
    const result: Record<string, CommonTableSolution[]> = {};
    for (const usageKey of Object.keys(fresh)) {
      const cur = fresh[usageKey];
      const old = prev[usageKey];
      result[usageKey] =
        old && old.length === cur.length && old.every((s, i) => s === cur[i])
          ? old
          : cur;
    }
    prevSolutionsRef.current = result;
    return result;
  }, [value.scores]);

  // Ref de valeur toujours à jour : évite les races sur additions multiples.
  const valueRef = useRef(value);
  valueRef.current = value;

  /**
   * Stratégie 4-step pour ajouter une solution (calque du legacy commonTableV2.php).
   * Évite la duplication de criteriaId pour le même couple (usage, solution) entre
   * répondants : on réutilise tant qu'on peut, on crée seulement en dernier recours.
   */
  const handleAddSolution = useCallback(
    (usageKey: string, usageLabel: string, name: string) => {
      const cur = valueRef.current;
      const trimmed = name.trim();
      const trimmedLower = trimmed.toLowerCase();

      // STEP 1 — déjà dans MES scores avec ce nom ? → activer, ne rien créer.
      const myExisting = Object.values(cur.scores).find(
        (s) => s.usageKey === usageKey && s.criteria.toLowerCase() === trimmedLower
      );
      if (myExisting) {
        setActiveByUsage((prev) => ({ ...prev, [usageKey]: myExisting.criteriaId }));
        return;
      }

      // STEP 2 — match par nom dans le catalogue collaboratif : réutiliser le
      // criteriaId existant pour ne pas dupliquer (et bénéficier du `count` agrégé).
      const reuseEntry = Object.entries(collabCatalog).find(
        ([, entry]) =>
          entry.usageKey === usageKey &&
          typeof entry.name === "string" &&
          entry.name.toLowerCase() === trimmedLower
      );
      if (reuseEntry) {
        const [criteriaId] = reuseEntry;
        const sol = makeDefaultSolution(trimmed, usageKey, usageLabel);
        sol.criteriaId = criteriaId;
        onChange?.({
          ...cur,
          scores: { ...cur.scores, [criteriaId]: sol },
        });
        setActiveByUsage((prev) => ({ ...prev, [usageKey]: criteriaId }));
        return;
      }

      // STEP 4 — créer une nouvelle entrée DANS scores ET DANS myCatalog.
      const sol = makeDefaultSolution(trimmed, usageKey, usageLabel);
      onChange?.({
        scores: { ...cur.scores, [sol.criteriaId]: sol },
        myCatalog: {
          ...cur.myCatalog,
          [sol.criteriaId]: { label: "", usage: usageLabel, usageKey, coeff: 1 },
        },
      });
      setActiveByUsage((prev) => ({ ...prev, [usageKey]: sol.criteriaId }));
    },
    [onChange, collabCatalog]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const cur = valueRef.current;
      const target = cur.scores[id];
      if (!target) return;
      const nextScores = { ...cur.scores };
      delete nextScores[id];
      const nextMyCatalog = { ...cur.myCatalog };
      // Si l'utilisateur avait créé cette criteria, on retire aussi du myCatalog.
      // Si c'était une criteria héritée (collaborative), elle n'y est pas — no-op.
      delete nextMyCatalog[id];
      onChange?.({ scores: nextScores, myCatalog: nextMyCatalog });
      setActiveByUsage((prev) => {
        if (prev[target.usageKey] !== id) return prev;
        const remaining = Object.values(nextScores).filter((s) => s.usageKey === target.usageKey);
        const nextActive = remaining[0]?.criteriaId;
        const out = { ...prev };
        if (nextActive) out[target.usageKey] = nextActive;
        else delete out[target.usageKey];
        return out;
      });
    },
    [onChange]
  );

  const handleSolutionChange = useCallback(
    (id: string, patch: Partial<CommonTableSolution>) => {
      const cur = valueRef.current;
      const target = cur.scores[id];
      if (!target) return;
      onChange?.({
        ...cur,
        scores: { ...cur.scores, [id]: { ...target, ...patch } },
      });
    },
    [onChange]
  );

  const handleActivate = useCallback((id: string) => {
    const solutions = Object.values(valueRef.current.scores);
    const sol = solutions.find((s) => s.criteriaId === id);
    if (!sol) return;
    setActiveByUsage((prev) => ({ ...prev, [sol.usageKey]: id }));
  }, []);

  // i18n bundle stable, mémoïsé pour éviter de churner les memos enfants.
  const rowI18n = useMemo(
    () => ({
      addPlaceholder: t("coform.commonTable.addSolution.placeholder"),
      addButton: t("coform.commonTable.addSolution.button"),
      deleteSolution: t("coform.commonTable.deleteSolution"),
      selectFirst: t("coform.commonTable.selectSolutionFirst"),
      happinessLabels: {
        love: t("coform.commonTable.happiness.love"),
        happySmile: t("coform.commonTable.happiness.happySmile"),
        neutral: t("coform.commonTable.happiness.neutral"),
        sad: t("coform.commonTable.happiness.sad"),
        cry: t("coform.commonTable.happiness.cry"),
      },
      noteLevels: [
        t("coform.commonTable.note.level.0"),
        t("coform.commonTable.note.level.1"),
        t("coform.commonTable.note.level.2"),
        t("coform.commonTable.note.level.3"),
        t("coform.commonTable.note.level.4"),
        t("coform.commonTable.note.level.5"),
      ],
      yesLabel: t("coform.commonTable.yesNo.yes"),
      noLabel: t("coform.commonTable.yesNo.no"),
      commentOpenLabel: t("coform.commonTable.comment.openLabel"),
      commentPlaceholderTitle: t("coform.commonTable.comment.placeholder.title"),
      commentPlaceholderDescription: t("coform.commonTable.comment.placeholder.description"),
      commentPlaceholderClose: t("coform.commonTable.comment.placeholder.close"),
    }),
    [t]
  );

  const labelId = `${field.name}-label`;
  const descId = field.info ? `${field.name}-desc` : undefined;
  const errorId = hasError ? `${field.name}-error` : undefined;
  const isEmpty = augmentedUsages.length === 0;

  return (
    <div
      data-field-name={field.name}
      role="group"
      aria-labelledby={!hideLabel && field.label ? labelId : undefined}
      aria-invalid={hasError || undefined}
      aria-describedby={descId}
      aria-errormessage={errorId}
      aria-required={field.isRequired || undefined}
      className={cn("space-y-3", field.width || "col-span-12")}
    >
      {!hideLabel && field.label && (
        <Label
          id={labelId}
          className={cn("block text-sm font-medium", hasError && "text-destructive")}
        >
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {field.info && <p id={descId} className="text-xs text-muted-foreground">{field.info}</p>}

      {isEmpty && (
        <p className="text-sm text-muted-foreground italic">
          {t("coform.commonTable.emptyUsages")}
        </p>
      )}

      {!isEmpty && (
        <div className="relative max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("coform.commonTable.filter.placeholder")}
            className="pl-8 h-9"
          />
        </div>
      )}

      {/* Tableau */}
      {!isEmpty && (
      <div className="overflow-x-auto border rounded-md">
        <table className="border-collapse text-sm table-fixed w-full min-w-240">
          {/* Largeurs explicites par colonne. Les colonnes textuelles (Besoin,
              Solutions, Commentaire) ont une largeur cible large pour ne pas
              cramper l'input ; si le viewport est étroit, le wrapper
              `overflow-x-auto` au-dessus active un scrollbar horizontal. */}
          <colgroup>
            <col className="w-40" />
            {showColumns.criteria && <col className="w-72" />}
            {showColumns.happiness && <col className="w-28" />}
            {showColumns.note && <col className="w-44" />}
            {showColumns.yesNo && <col className="w-28" />}
            {showColumns.comment && <col className="w-44" />}
          </colgroup>
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="text-left p-2 font-medium text-sm border-r border-border/60">
                {labels.usage ?? t("coform.commonTable.headers.usage", "Besoins")}
              </th>
              {showColumns.criteria && (
                <th className="text-left p-2 font-medium text-sm border-r border-border/60">
                  {labels.criteria ?? t("coform.commonTable.headers.criteria", "Solutions")}
                </th>
              )}
              {showColumns.happiness && (
                <th className="text-left p-2 font-medium text-sm border-r border-border/60">
                  {labels.happiness ?? t("coform.commonTable.headers.happiness", "Satisfaction")}
                </th>
              )}
              {showColumns.note && (
                <th className="text-left p-2 font-medium text-sm border-r border-border/60">
                  {labels.note ?? t("coform.commonTable.headers.note", "Urgence")}
                </th>
              )}
              {showColumns.yesNo && (
                <th className="text-left p-2 font-medium text-sm border-r border-border/60">
                  {labels.yesNo ?? t("coform.commonTable.headers.yesNo", "Réponse")}
                </th>
              )}
              {showColumns.comment && (
                <th className="text-left p-2 font-medium text-sm">
                  {labels.comment ?? t("coform.commonTable.headers.comment", "Commentaire")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleUsages.map((u) => {
              const solutions = solutionsByUsage[u.usageKey] ?? [];
              // Valider que l'id mémorisé existe encore — un draft restauré peut pointer
              // vers une solution supprimée entre-temps. Si invalide, fallback sur la 1ʳᵉ.
              const stored = activeByUsage[u.usageKey];
              const active =
                stored && solutions.some((s) => s.criteriaId === stored)
                  ? stored
                  : solutions[0]?.criteriaId ?? null;
              // Filtre les suggestions pour ne pas proposer ce que l'utilisateur a déjà saisi.
              const myNames = new Set(solutions.map((s) => s.criteria.toLowerCase()));
              const rowSuggestions = (suggestionsByUsage[u.usageKey] ?? []).filter(
                (s) => !myNames.has(s.name.toLowerCase())
              );
              return (
                <CommonTableRow
                  key={u.usageKey}
                  usage={u}
                  solutions={solutions}
                  activeSolutionId={active}
                  showColumns={showColumns}
                  i18n={rowI18n}
                  onAddSolution={handleAddSolution}
                  onActivate={handleActivate}
                  onDelete={handleDelete}
                  onSolutionChange={handleSolutionChange}
                  suggestions={rowSuggestions}
                  readOnly={readOnly}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {hasError && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errors[field.name]?.message as string}
        </p>
      )}
    </div>
  );
}
