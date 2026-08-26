import { memo, useCallback, useMemo, useRef, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { Search, X, Plus, User } from "lucide-react";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import "../i18n/i18n";
import { useCommonTableCatalog } from "../hooks/useCommonTableCatalog";
import { getOriginalFieldKey } from "../utils/formParser";
import { getNoteAppearance } from "../utils/commonTableNote";
import { buildUsageGroupKeyResolver, normalizeUsage } from "../utils/commonTableUsage";
import { CommonTableContributorsDialog } from "./CommonTableContributorsDialog";
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
  /**
   * ID du formulaire parent — requis pour fetcher la liste détaillée des
   * contributeurs au clic sur le badge de la colonne solution. Si absent,
   * les badges restent affichés (lecture du `count` du catalogue local) mais
   * ne sont pas cliquables.
   */
  formId?: string;
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

/**
 * Format aligné sur le legacy `commonTableV2.php` (qui produit
 * `criteria${time()}` — soit "criteria" + timestamp en secondes). On reste
 * sur ce format pour que les outils legacy qui parsent les criteriaId
 * (statistiques, exports, etc.) restent compatibles. On utilise les
 * millisecondes pour réduire les collisions si l'utilisateur crée
 * plusieurs entries rapidement.
 */
function generateCriteriaId(): string {
  return `criteria${Date.now()}`;
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
// donc pas de clipping par le viewport de la `<ScrollArea>` de la table.

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
  const { idx, trackTint, textColor } = getNoteAppearance(value);
  const label = levelLabels[idx] ?? "";
  // Note=0 = non renseigné. On garde `aria-valuetext` sur le slider (le
  // lecteur d'écran annonce "Non renseigné"), mais on masque visuellement
  // le label pour ne pas répéter "Non renseigné" sur chaque row vide —
  // sinon l'UI devient bruyante. La hauteur est préservée via
  // `invisible` (le span occupe sa place sans s'afficher) pour aligner
  // les rows notées et non notées.
  const isUnset = value === 0;

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
      <span
        className={cn(
          "text-xs text-center font-medium",
          isUnset ? "invisible select-none" : textColor
        )}
        aria-hidden={isUnset || undefined}
      >
        {isUnset ? " " : label}
      </span>
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
  // Ref vers l'input pour exclure ses clics du "interact outside" de Radix
  // (cf. handler `onInteractOutside` plus bas — sinon flicker open/close).
  const inputRef = useRef<HTMLInputElement | null>(null);

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
  // viewport de la `<ScrollArea>` de la table : il flotte au-dessus du
  // DOM, ne pousse aucun contenu et n'élargit pas la cellule.
  const showDropdown = open && filtered.length > 0;

  const canSubmit = !disabled && draft.trim() !== "";

  return (
    <Popover open={showDropdown} onOpenChange={(o) => !o && setOpen(false)}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
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
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            // pr-8 réserve la place du bouton intégré à droite.
            className="h-8 text-sm w-full pr-8"
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
          />
          <button
            type="button"
            onMouseDown={(e) => {
              // mousedown avant le blur de l'input : sinon Radix ferme la
              // popover et perd la sélection en cours.
              e.preventDefault();
              if (canSubmit) submit();
            }}
            disabled={!canSubmit}
            aria-label={buttonLabel}
            title={buttonLabel}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2",
              "inline-flex items-center justify-center h-6 w-6 rounded-sm",
              "text-muted-foreground transition-colors cursor-pointer",
              canSubmit
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-transparent opacity-40 cursor-not-allowed"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-(--radix-popover-trigger-width) max-h-56 overflow-auto"
        // Garde le focus sur l'input — sans ça Radix volerait le focus à l'ouverture.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Empêche Radix de fermer la popover quand on clique sur l'input
        // (l'`anchor` n'est pas un `trigger` aux yeux de Radix → un clic
        // dessus est considéré "outside content" → fermeture parasite que
        // l'on devait précédemment compenser avec un `onClick` sur l'input,
        // ce qui causait le flicker open/close/open).
        onInteractOutside={(e) => {
          const target = e.target as Node | null;
          if (target && inputRef.current?.contains(target)) {
            e.preventDefault();
          }
        }}
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
    contributorsTooltip: string;
  };
  onAddSolution: (usageKey: string, usageLabel: string, name: string) => void;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  onSolutionChange: (id: string, patch: Partial<CommonTableSolution>) => void;
  /**
   * Upsert d'une solution : utilisé en mode `!showColumns.criteria` où la
   * notation s'applique au besoin (la row) directement, sans passer par
   * un outil. Si la solution `criteriaId` existe → patch. Sinon → crée
   * avec un nom vide. Pour le mode normal (avec colonne criteria), on
   * continue d'utiliser `onAddSolution` + `onSolutionChange`.
   */
  onSolutionUpsert: (
    criteriaId: string,
    usageKey: string,
    usageLabel: string,
    patch: Partial<CommonTableSolution>,
    options?: { skipMyCatalog?: boolean }
  ) => void;
  /** Suggestions de solutions pour CET usage (issues du catalogue collaboratif). */
  suggestions: SolutionSuggestion[];
  /**
   * Nombre total de contributions sur cette ligne (agrégé via le
   * groupKeyResolver). Si > 0, un badge cliquable s'affiche pour ouvrir
   * la liste détaillée.
   */
  contributorCount: number;
  onShowContributors?: () => void;
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
  onSolutionUpsert,
  suggestions,
  contributorCount,
  onShowContributors,
  readOnly,
}: CommonTableRowProps) {
  const active = solutions.find((s) => s.criteriaId === activeSolutionId) ?? null;
  const handleAdd = useCallback(
    (name: string) => onAddSolution(usage.usageKey, usage.label, name),
    [onAddSolution, usage.usageKey, usage.label]
  );

  // Mode "sans colonne criteria" : la notation s'applique au besoin
  // (la row) directement. On synthétise une solution implicite pour
  // l'affichage initial ; la première interaction la matérialise dans
  // `value.scores` via `onSolutionUpsert` avec un criteriaId timestamp
  // (`criteria${Date.now()}`) — aligné sur le format legacy `criteria${time()}`.
  // Si la response chargée contient déjà une solution pour cette row,
  // on la réutilise.
  const noCriteria = !showColumns.criteria;
  // Si la row a déjà N>1 solutions (cas d'un toggle criteriaColumn=true→false
  // a posteriori sur une réponse existante), on respecte le dernier
  // `activeSolutionId` mémorisé — fallback solutions[0]. Les solutions
  // restantes restent persistées dans `value.scores` mais ne sont pas
  // surfacées dans cette UI (limitation connue, voir review).
  const phantomExisting = noCriteria
    ? solutions.find((s) => s.criteriaId === activeSolutionId) ?? solutions[0] ?? null
    : null;
  // En mode readOnly + noCriteria + aucune solution réelle, on NE
  // synthétise PAS de phantom : rendre des contrôles avec des défauts
  // (`UrgencyGauge=0`, `YesNoToggle=Non`) ferait passer une row non
  // répondue pour une réponse réelle (« 0 urgence / réponse Non »).
  // Dans ce cas, displayActive reste null et les cellules sont vides
  // — cohérent avec le comportement du mode criteria.
  const displayActive: CommonTableSolution | null = noCriteria
    ? phantomExisting ?? (readOnly
        ? null
        : makeDefaultSolution("", usage.usageKey, usage.label))
    : active;

  const writeChange = (patch: Partial<CommonTableSolution>) => {
    if (noCriteria) {
      // Re-utilise l'id existant si on a déjà matérialisé la solution ;
      // sinon génère un criteriaId timestamp au moment du write (et pas
      // au render) — évite l'id déterministe `criteria-row-${usageKey}`
      // qui (a) ne correspond pas à la convention legacy `criteria${time()}`
      // et (b) peut contenir des caractères non-ASCII (espaces, accents)
      // qui cassent les regex PHP côté serveur.
      const id = phantomExisting?.criteriaId ?? generateCriteriaId();
      // skipMyCatalog: en noCriteria, le legacy n'écrit PAS de `criterias{key}`
      // (myCatalog). Seul `yesOrNo{key}.{criteriaId}` est persisté.
      onSolutionUpsert(id, usage.usageKey, usage.label, patch, { skipMyCatalog: true });
      return;
    }
    if (active) onSolutionChange(active.criteriaId, patch);
  };

  return (
    <tr className="border-b border-border align-top">
      {/* Usage label */}
      <td className="p-2 align-top bg-muted/30 font-medium text-sm wrap-break-word border-r border-border/60">
        {usage.label}
      </td>

      {/* Solutions (input + tags) */}
      {showColumns.criteria && (
        <td className="p-2 align-top space-y-2 wrap-break-word border-r border-border/60">
          {(!readOnly || (contributorCount > 0 && onShowContributors)) && (
            <div className="flex items-center gap-1.5">
              {!readOnly && (
                <div className="flex-1 min-w-0">
                  <AddSolutionInput
                    onAdd={handleAdd}
                    placeholder={i18n.addPlaceholder}
                    buttonLabel={i18n.addButton}
                    suggestions={suggestions}
                  />
                </div>
              )}
              {contributorCount > 0 && onShowContributors && (
                <button
                  type="button"
                  onClick={onShowContributors}
                  title={i18n.contributorsTooltip}
                  aria-label={i18n.contributorsTooltip}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-border shrink-0",
                    "bg-muted/40 h-7 px-2 text-xs font-medium",
                    "hover:bg-muted hover:border-primary/50 transition-colors cursor-pointer"
                  )}
                >
                  <User className="h-3 w-3" />
                  {contributorCount}
                </button>
              )}
            </div>
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
          {displayActive ? (
            <HappinessSelector
              value={displayActive.happiness}
              onChange={(h) => writeChange({ happiness: h })}
              disabled={readOnly}
              labels={i18n.happinessLabels}
            />
          ) : (
            // En lecture seule, « Ajoutez une solution… » inviterait à une action
            // impossible : on retombe sur le tiret des valeurs vides.
            <span className="text-xs text-muted-foreground italic">
              {readOnly ? "—" : i18n.selectFirst}
            </span>
          )}
        </td>
      )}

      {/* Note (urgence) */}
      {showColumns.note && (
        <td className="p-2 align-middle border-r border-border/60">
          {displayActive && (
            <UrgencyGauge
              value={displayActive.note}
              onChange={(n) => writeChange({ note: n })}
              disabled={readOnly}
              levelLabels={i18n.noteLevels}
            />
          )}
        </td>
      )}

      {/* Yes/No */}
      {showColumns.yesNo && (
        <td className="p-2 align-middle border-r border-border/60">
          {displayActive && (
            <YesNoToggle
              value={displayActive.yesOrNo}
              onChange={(b) => writeChange({ yesOrNo: b })}
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
          {displayActive && !readOnly && (
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
  formId,
}: CommonTableFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const config = field.commonTableConfig;
  const hasError = !!errors[field.name];

  // Catalogue collaboratif (lecture seule) issu du fetch batch au niveau form.
  const collabCatalog = useCommonTableCatalog(getOriginalFieldKey(field));

  // Vue enrichie de `value.scores` pour l'affichage : ré-ancre les scores
  // legacy orphelins (sans `usage`/`usageKey`) en consultant
  // `collabCatalog[criteriaId]` — qui agrege les `criterias{key}` de tous
  // les répondants côté serveur. Permet d'afficher un score legacy
  // `{criteria1688469657: {note: 2}}` sous la row "Bureautiques" même
  // quand le form admin n'a pas seedé `params.criterias{key}` (cas du form
  // tiers-lieux Saint-Leu — équivalent legacy de
  // `criteriasMerge = criteriasFromForms + criteriasFromAnswers` dans
  // commonTableV2.php). Les writes continuent de muter `value.scores`.
  const displayScores = useMemo(() => {
    let mutated = false;
    const out: typeof value.scores = {};
    for (const [criteriaId, sol] of Object.entries(value.scores)) {
      if (sol.usageKey || sol.usage) {
        out[criteriaId] = sol;
        continue;
      }
      const catalogHit = collabCatalog[criteriaId];
      if (catalogHit?.usage || catalogHit?.usageKey) {
        out[criteriaId] = {
          ...sol,
          usage: sol.usage || catalogHit.usage || "",
          usageKey: sol.usageKey || catalogHit.usageKey || criteriaId,
        };
        mutated = true;
      } else {
        out[criteriaId] = sol;
      }
    }
    return mutated ? out : value.scores;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `value.scores` est la dep réelle ; `value` complet trigger re-compute inutilement sur myCatalog
  }, [value.scores, collabCatalog]);

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

  // Key effective pour grouper les entries en lignes de tableau : plusieurs criterias partageant
  // le même `usage` (texte) sont fusionnées en UNE ligne, même si une partie n'a pas de `usageKey`
  // (cas typique des données legacy, où `usageKey` n'a été ajouté que tardivement).
  //
  // La règle vit dans `utils/commonTableUsage` : `categorizedCheckbox` construit ses sous-options
  // depuis le MÊME catalogue et doit regrouper à l'identique — deux implémentations divergeraient.
  // L'ordre des sources fixe la priorité (première `usageKey` vue pour un usage donné).
  const groupKeyResolver = useMemo(
    () =>
      buildUsageGroupKeyResolver([
        Object.values(collabCatalog),
        Object.values(displayScores),
        Object.values(value.myCatalog),
      ]),
    [collabCatalog, displayScores, value.myCatalog],
  );

  // Augmente la liste d'usages : config admin + tous les usages effectifs qui
  // apparaissent dans le catalogue collaboratif, plus ceux de MES scores /
  // MON catalog (mode édition).
  const augmentedUsages = useMemo(() => {
    const resolveGroupKey = groupKeyResolver;
    const seen = new Set<string>();
    const out: typeof usages = [];
    // 1) Admin-defined usages (config) : on les laisse passer tels quels.
    for (const u of usages) {
      const gk = resolveGroupKey(u.usageKey, u.label);
      if (!seen.has(gk)) {
        seen.add(gk);
        out.push({ ...u, usageKey: gk });
      }
    }
    // 2) Catalog collaboratif : agréger par groupKey, ignorer `usage` vide
    //    (entry sans nom de besoin n'est pas affichable comme ligne).
    for (const entry of Object.values(collabCatalog)) {
      const usageLabel = (entry.usage ?? "").trim();
      if (!usageLabel && !entry.usageKey) continue;
      const gk = resolveGroupKey(entry.usageKey, usageLabel);
      if (!seen.has(gk)) {
        seen.add(gk);
        out.push({ usageKey: gk, label: usageLabel || entry.usageKey || gk });
      }
    }
    // 3) MES scores / MON catalog (édition d'une réponse existante).
    for (const sol of Object.values(displayScores)) {
      const usageLabel = (sol.usage ?? "").trim();
      if (!usageLabel && !sol.usageKey) continue;
      const gk = resolveGroupKey(sol.usageKey, usageLabel);
      if (!seen.has(gk)) {
        seen.add(gk);
        out.push({ usageKey: gk, label: usageLabel || sol.usageKey || gk });
      }
    }
    for (const entry of Object.values(value.myCatalog)) {
      const usageLabel = (entry.usage ?? "").trim();
      if (!usageLabel && !entry.usageKey) continue;
      const gk = resolveGroupKey(entry.usageKey, usageLabel);
      if (!seen.has(gk)) {
        seen.add(gk);
        out.push({ usageKey: gk, label: usageLabel || entry.usageKey || gk });
      }
    }
    return out;
  }, [usages, collabCatalog, displayScores, value.myCatalog, groupKeyResolver]);

  // Filtre client-side (n'altère JAMAIS `value` — uniquement l'affichage).
  const [filter, setFilter] = useState("");
  const visibleUsages = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return augmentedUsages;
    return augmentedUsages.filter((u) => u.label.toLowerCase().includes(f));
  }, [augmentedUsages, filter]);

  // Solution active par usage, indépendante de `value`.
  const [activeByUsage, setActiveByUsage] = useState<Record<string, string>>({});

  // Suggestions par usage : extraites du catalogue collaboratif, indexées par
  // groupKey effective (cf. groupKeyResolver) — pas par `entry.usageKey` brut,
  // sinon les suggestions des entries legacy (sans usageKey) sont perdues.
  //
  // On consomme la distribution `entry.names` (Record<name, count>) plutôt
  // que le seul `entry.name` canonique : un même criteriaId peut avoir été
  // rempli avec des solutions différentes par plusieurs users (ex: Sage,
  // Odoo, EBP COMPTA pour "Comptabilité"). Sans cette agrégation, on ne
  // verrait que la solution majoritaire. Pour les anciens entries qui
  // n'auraient pas encore `names`, fallback sur `name` seul.
  // Pour chaque ligne du tableau (= un usage / groupKey), on a besoin de :
  //   - `count` : total des contributions (pour le badge cliquable)
  //   - `criteriaIds` : toutes les criterias dédupées par le resolver — passées
  //     à l'API `getCommonTableContributors` au moment d'ouvrir le dialog.
  // On parcourt `collabCatalog` une seule fois (en plus de `suggestionsByUsage`
  // pour rester DRY, sinon double itération pour la même donnée).
  const contributorsByUsage = useMemo(() => {
    const out: Record<string, { count: number; criteriaIds: string[] }> = {};
    for (const [criteriaId, entry] of Object.entries(collabCatalog)) {
      const gk = groupKeyResolver(entry.usageKey, entry.usage);
      const bucket = (out[gk] ??= { count: 0, criteriaIds: [] });
      bucket.count += entry.count ?? 0;
      bucket.criteriaIds.push(criteriaId);
    }
    return out;
  }, [collabCatalog, groupKeyResolver]);

  const suggestionsByUsage = useMemo(() => {
    const accumulator: Record<string, Record<string, number>> = {};
    for (const entry of Object.values(collabCatalog)) {
      const gk = groupKeyResolver(entry.usageKey, entry.usage);
      const bucket = (accumulator[gk] ??= {});
      if (entry.names && Object.keys(entry.names).length > 0) {
        for (const [name, c] of Object.entries(entry.names)) {
          if (!name) continue;
          bucket[name] = (bucket[name] ?? 0) + (typeof c === "number" ? c : 0);
        }
      } else if (entry.name) {
        bucket[entry.name] = (bucket[entry.name] ?? 0) + (entry.count ?? 0);
      }
    }
    const out: Record<string, SolutionSuggestion[]> = {};
    for (const [gk, names] of Object.entries(accumulator)) {
      out[gk] = Object.entries(names)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }
    return out;
  }, [collabCatalog, groupKeyResolver]);

  // Index des solutions par usageKey, basé sur `displayScores` (vue enrichie
  // de `value.scores` — ré-ancre les scores legacy orphelins via collabCatalog).
  // Cache de référence pour que React.memo sur <CommonTableRow> ne re-rende
  // QUE la ligne modifiée.
  const prevSolutionsRef = useRef<Record<string, CommonTableSolution[]>>({});
  const solutionsByUsage = useMemo(() => {
    const fresh: Record<string, CommonTableSolution[]> = {};
    for (const sol of Object.values(displayScores)) {
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
  }, [displayScores]);

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

      // STEP 2 — réutiliser une "stub orpheline" du myCatalog : entry créée
      // précédemment par "Ajouter un besoin" (label vide, pas encore associée
      // à une solution dans scores). Permet d'éviter le doublon où on aurait
      // une entry "stub besoin" + une entry "première solution" dans
      // myCatalog pour le même besoin.
      const stubEntry = Object.entries(cur.myCatalog).find(
        ([criteriaId, entry]) =>
          !entry.label &&
          !cur.scores[criteriaId] &&
          groupKeyResolver(entry.usageKey, entry.usage) === usageKey
      );
      if (stubEntry) {
        const [stubCriteriaId, oldEntry] = stubEntry;
        const sol = makeDefaultSolution(trimmed, usageKey, usageLabel);
        sol.criteriaId = stubCriteriaId;
        onChange?.({
          scores: { ...cur.scores, [stubCriteriaId]: sol },
          myCatalog: {
            ...cur.myCatalog,
            // Met à jour l'usageKey (de "" à la valeur résolue) sans
            // toucher au reste de la stub.
            [stubCriteriaId]: { ...oldEntry, usageKey, coeff: oldEntry.coeff ?? 1 },
          },
        });
        setActiveByUsage((prev) => ({ ...prev, [usageKey]: stubCriteriaId }));
        return;
      }

      // STEP 3 — match par nom dans le catalogue collaboratif : réutiliser le
      // criteriaId existant pour ne pas dupliquer (et bénéficier du `count`
      // agrégé). On matche sur le groupKey résolu — sinon les entries
      // legacy (usageKey brut vide) ne seraient jamais retrouvées.
      const reuseEntry = Object.entries(collabCatalog).find(
        ([, entry]) =>
          groupKeyResolver(entry.usageKey, entry.usage) === usageKey &&
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
    [onChange, collabCatalog, groupKeyResolver]
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

  // Upsert : utilisé exclusivement en mode `!showColumns.criteria` pour
  // matérialiser à la première interaction la solution implicite d'une
  // row (notation au besoin direct, sans outil intermédiaire). On crée
  // alors une entry dans `scores` ET dans `myCatalog` avec un label vide
  // (cf. `handleAddSolution` STEP 4 — même conventions, mais avec un
  // criteriaId fourni par le caller au lieu d'être généré). Si la row
  // contient déjà une solution réelle (cas du re-chargement), le caller
  // passe son criteriaId existant → simple patch sans création.
  const handleSolutionUpsert = useCallback(
    (
      criteriaId: string,
      usageKey: string,
      usageLabel: string,
      patch: Partial<CommonTableSolution>,
      options?: { skipMyCatalog?: boolean },
    ) => {
      const cur = valueRef.current;
      const existing = cur.scores[criteriaId];
      if (existing) {
        onChange?.({
          ...cur,
          scores: { ...cur.scores, [criteriaId]: { ...existing, ...patch } },
        });
        return;
      }
      // Mode noCriteria (sans colonne outil) : le legacy ne CRÉE PAS de
      // nouvelle entry `criterias{key}` (myCatalog) à la notation. Mais une
      // entry locale existe quand l'user a explicitement ajouté un besoin
      // custom via le dialog "Ajouter un besoin" (cf. submitAddUsage) —
      // on la conserve et on la PATCH pour rester cohérent.
      if (options?.skipMyCatalog) {
        // ANCRAGE CANONIQUE en cascade :
        //   1. collabCatalog (aggregate serveur des `answers.criterias{key}`
        //      des autres répondants) → criteriaId canonical historique
        //      genre `criteria1688469657` pour "Bureautiques".
        //   2. value.myCatalog local → criteriaId fraîchement généré par
        //      `submitAddUsage` (besoin custom pas encore save+reload).
        //      Sans ce fallback, on persisterait la note sous un NOUVEAU
        //      criteriaId disjoint de l'entry myCatalog locale → split à
        //      la lecture (et drift visible en base).
        //   3. fallback: le criteriaId proposé par le caller (nouveau
        //      timestamp ms — chemin emprunté pour les rows orphelines
        //      jamais déclarées dans aucun catalogue).
        let anchorId: string | undefined;
        let anchorSource: "collab" | "local" | undefined;
        for (const [id, entry] of Object.entries(collabCatalog)) {
          if (groupKeyResolver(entry.usageKey, entry.usage) === usageKey) {
            anchorId = id;
            anchorSource = "collab";
            break;
          }
        }
        if (!anchorId) {
          for (const [id, entry] of Object.entries(cur.myCatalog)) {
            if (groupKeyResolver(entry.usageKey, entry.usage) === usageKey) {
              anchorId = id;
              anchorSource = "local";
              break;
            }
          }
        }
        const finalCriteriaId = anchorId ?? criteriaId;
        // Quand l'ancrage est trouvé, on aligne aussi `usageKey` sur
        // l'anchor (= criteriaId canonical). Sans ça, on persisterait
        // `usageKey="mine equipement"` (le groupKey normalisé calculé
        // par groupKeyResolver) alors que la row legacy ancre par
        // criteriaId clé + `usage` texte.
        const finalUsageKey = anchorId ?? usageKey;
        const created: CommonTableSolution = {
          ...makeDefaultSolution("", finalUsageKey, usageLabel),
          criteriaId: finalCriteriaId,
          ...patch,
        };
        // Si l'ancrage vient du myCatalog local, on patch l'entry pour
        // refléter usageKey = finalUsageKey (sinon mismatch au reload :
        // myCatalog garde usageKey="" mais scores a usageKey=criteriaId).
        const nextMyCatalog = anchorSource === "local"
          ? {
              ...cur.myCatalog,
              [finalCriteriaId]: {
                ...cur.myCatalog[finalCriteriaId],
                usageKey: finalUsageKey,
              },
            }
          : cur.myCatalog;
        onChange?.({
          scores: { ...cur.scores, [finalCriteriaId]: created },
          myCatalog: nextMyCatalog,
        });
        setActiveByUsage((prev) => ({ ...prev, [finalUsageKey]: finalCriteriaId }));
        return;
      }
      // STUB REUSE — si l'user a précédemment cliqué « Ajouter un besoin »
      // pour ce usage (créant un stub `myCatalog[randomId] = {label:'',
      // usage, usageKey:''}` cf. handleAddSolution STEP 2), on doit
      // ré-utiliser ce criteriaId au lieu d'en créer un second. Sans ça,
      // deux entries myCatalog cohabitent pour le même besoin et
      // polluent le catalogue collaboratif au save.
      const stubEntry = Object.entries(cur.myCatalog).find(
        ([id, entry]) =>
          !entry.label &&
          !cur.scores[id] &&
          groupKeyResolver(entry.usageKey, entry.usage) === usageKey
      );
      const targetCriteriaId = stubEntry ? stubEntry[0] : criteriaId;
      const created: CommonTableSolution = {
        ...makeDefaultSolution("", usageKey, usageLabel),
        criteriaId: targetCriteriaId,
        ...patch,
      };
      const stubMeta = stubEntry?.[1];
      onChange?.({
        scores: { ...cur.scores, [targetCriteriaId]: created },
        myCatalog: {
          ...cur.myCatalog,
          [targetCriteriaId]: {
            ...(stubMeta ?? {}),
            label: stubMeta?.label ?? "",
            usage: usageLabel,
            usageKey,
            coeff: stubMeta?.coeff ?? 1,
          },
        },
      });
      setActiveByUsage((prev) => ({ ...prev, [usageKey]: targetCriteriaId }));
    },
    [onChange, groupKeyResolver, collabCatalog]
  );

  const handleActivate = useCallback((id: string) => {
    const solutions = Object.values(valueRef.current.scores);
    const sol = solutions.find((s) => s.criteriaId === id);
    if (!sol) return;
    setActiveByUsage((prev) => ({ ...prev, [sol.usageKey]: id }));
  }, []);

  // Dialog "voir les contributeurs" : ouvert au clic sur le badge d'une ligne.
  // L'état mémorise la ligne ciblée (criteriaIds + label) — un seul Dialog
  // monté pour toutes les lignes, contexte rebuilt au moment du clic.
  const [contributorsContext, setContributorsContext] = useState<
    { criteriaIds: string[]; usageLabel: string } | null
  >(null);
  const openContributorsDialog = useCallback(
    (criteriaIds: string[], usageLabel: string) => {
      setContributorsContext({ criteriaIds, usageLabel });
    },
    []
  );

  // ─── Ajout d'un nouveau besoin (usage) par l'utilisateur ─────────────────
  // Pattern aligné sur le legacy `commonTableV2.php` (`addEditDeleteLine`)
  // qui crée une entry minimale {label:"", coeff:1, usage} dans le catalogue
  // de la réponse. Côté React on persiste dans `value.myCatalog` ; au save,
  // `denormalizeAnswerData` transforme `myCatalog` → `criterias{key}` qui
  // sera agrégé au catalogue collaboratif au prochain GET.
  const [addUsageDialogOpen, setAddUsageDialogOpen] = useState(false);
  const [newUsageDraft, setNewUsageDraft] = useState("");
  const [addUsageError, setAddUsageError] = useState<string | null>(null);

  const openAddUsageDialog = useCallback(() => {
    setNewUsageDraft("");
    setAddUsageError(null);
    setAddUsageDialogOpen(true);
  }, []);

  const submitAddUsage = useCallback(() => {
    const trimmed = newUsageDraft.trim();
    if (!trimmed) {
      setAddUsageError(t("coform.commonTable.addUsage.dialog.errorEmpty"));
      return;
    }
    const norm = normalizeUsage(trimmed);
    const exists = augmentedUsages.some((u) => normalizeUsage(u.label) === norm);
    if (exists) {
      setAddUsageError(t("coform.commonTable.addUsage.dialog.errorDuplicate"));
      return;
    }
    const cur = valueRef.current;
    const newCriteriaId = generateCriteriaId();
    onChange?.({
      ...cur,
      myCatalog: {
        ...cur.myCatalog,
        [newCriteriaId]: { label: "", usage: trimmed, usageKey: "", coeff: 1 },
      },
    });
    setAddUsageDialogOpen(false);
  }, [newUsageDraft, augmentedUsages, onChange, t]);

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
      // Surchargé par ligne dans le map (interpolation `count` du badge).
      contributorsTooltip: "",
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
      <ScrollArea className="border rounded-md w-full">
        <table className="border-collapse text-sm table-fixed w-full min-w-240">
          {/* Largeurs explicites par colonne. Les colonnes textuelles (Besoin,
              Solutions, Commentaire) ont une largeur cible large pour ne pas
              cramper l'input ; si le viewport est étroit, la `<ScrollArea>`
              au-dessus active un scrollbar horizontal fin (Radix). */}
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
              const rowContributors = contributorsByUsage[u.usageKey];
              const rowCount = rowContributors?.count ?? 0;
              const rowCriteriaIds = rowContributors?.criteriaIds ?? [];
              // Pluralisation gérée par i18next (clé `_one` / `_other`).
              const rowTooltip = t("coform.commonTable.contributors.openTooltip", undefined, { count: rowCount });
              const rowI18nWithTooltip = { ...rowI18n, contributorsTooltip: rowTooltip };
              return (
                <CommonTableRow
                  key={u.usageKey}
                  usage={u}
                  solutions={solutions}
                  activeSolutionId={active}
                  showColumns={showColumns}
                  i18n={rowI18nWithTooltip}
                  onAddSolution={handleAddSolution}
                  onActivate={handleActivate}
                  onDelete={handleDelete}
                  onSolutionChange={handleSolutionChange}
                  onSolutionUpsert={handleSolutionUpsert}
                  suggestions={rowSuggestions}
                  contributorCount={rowCount}
                  onShowContributors={
                    rowCount > 0 && formId
                      ? () => openContributorsDialog(rowCriteriaIds, u.label)
                      : undefined
                  }
                  readOnly={readOnly}
                />
              );
            })}
          </tbody>
        </table>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
      )}

      {/* Bouton "Ajouter <label>" — créera une nouvelle ligne du tableau.
          Le label dynamique reprend `labels.usage` (cf. legacy commonTableV2.php
          `Ajouter <?= $columnLabel["usageColumn"] ?>`) → "Ajouter Equipements",
          "Ajouter Outils", etc. Fallback générique si le form n'a pas de label.
          Disponible aussi en cas de tableau vide (utile pour démarrer le form). */}
      {!readOnly && (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openAddUsageDialog}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            {t("coform.commonTable.addUsage.buttonLabel", undefined, {
              label: labels.usage?.trim() || t("coform.commonTable.addUsage.defaultLabel"),
            })}
          </Button>
        </div>
      )}

      <Dialog open={addUsageDialogOpen} onOpenChange={setAddUsageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("coform.commonTable.addUsage.dialog.title")}</DialogTitle>
            <DialogDescription>
              {t("coform.commonTable.addUsage.dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`add-usage-input-${field.name}`}>
              {t("coform.commonTable.addUsage.dialog.usageLabel")}
            </Label>
            <Input
              id={`add-usage-input-${field.name}`}
              autoFocus
              value={newUsageDraft}
              onChange={(e) => {
                setNewUsageDraft(e.target.value);
                if (addUsageError) setAddUsageError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitAddUsage();
                }
              }}
              placeholder={t("coform.commonTable.addUsage.dialog.usagePlaceholder")}
              aria-invalid={!!addUsageError || undefined}
              aria-errormessage={addUsageError ? `add-usage-error-${field.name}` : undefined}
            />
            {addUsageError && (
              <p
                id={`add-usage-error-${field.name}`}
                role="alert"
                className="text-sm text-destructive"
              >
                {addUsageError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddUsageDialogOpen(false)}
            >
              {t("coform.commonTable.addUsage.dialog.cancel")}
            </Button>
            <Button type="button" onClick={submitAddUsage}>
              {t("coform.commonTable.addUsage.dialog.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liste détaillée des contributeurs sur une ligne donnée. Le dialog est
          contrôlé par `contributorsContext` ; on le démonte (open=false) quand
          `null` plutôt que de garder un montage permanent — évite tout fetch
          inutile quand l'utilisateur n'a jamais cliqué un badge. */}
      {formId && (
        <CommonTableContributorsDialog
          open={contributorsContext !== null}
          onOpenChange={(o) => {
            if (!o) setContributorsContext(null);
          }}
          formId={formId}
          inputKey={getOriginalFieldKey(field)}
          criteriaIds={contributorsContext?.criteriaIds ?? []}
          usageLabel={contributorsContext?.usageLabel ?? ""}
        />
      )}

      {hasError && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errors[field.name]?.message as string}
        </p>
      )}
    </div>
  );
}
