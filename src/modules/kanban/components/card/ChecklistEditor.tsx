import { useId, useRef, useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ChecklistItem } from "@/modules/kanban/types";
import { checklistProgress, nextChecklistItemId } from "./cardForm";

export interface ChecklistEditorProps {
  items: readonly ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  /** Vrai pour qui n'édite pas la carte et n'y est pas assigné : il voit l'avancement, il ne coche rien. */
  readOnly?: boolean;
  /** Longueur maximale d'un point, celle de la SOURCE du tableau (`cardFieldLimits`). */
  maxLabelLength: number;
  className?: string;
}

/**
 * Checklist de la fiche de carte, reprise de co-kanban (`ChecklistEditor`) : cocher, renommer,
 * retirer, ajouter. La saisie n'est pas un `<form>` : la fiche en est déjà un, et un formulaire
 * imbriqué est invalide en HTML. Entrée est donc interceptée ici.
 */
export function ChecklistEditor({ items, onChange, readOnly = false, maxLabelLength, className }: ChecklistEditorProps) {
  const { t } = useTranslation("modules/kanban");
  const [draftLabel, setDraftLabel] = useState("");
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const headingId = useId();
  const addFieldId = useId();
  const progress = checklistProgress(items);

  function addItem() {
    const label = draftLabel.trim();
    if (label.length === 0) return;
    onChange([...items, { id: nextChecklistItemId(items), label, done: false }]);
    setDraftLabel("");
    // Le champ garde le focus : on saisit une liste d'affilée, pas un point puis un clic.
    addInputRef.current?.focus();
  }

  function patchItem(index: number, patch: Partial<ChecklistItem>) {
    onChange(items.map((item, position) => (position === index ? { ...item, ...patch } : item)));
  }

  return (
    <section className={cn("min-w-0", className)} aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={headingId} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ListChecks aria-hidden className="size-4" />
          {t("checklist.title")}
        </h3>
        <output className="text-xs text-muted-foreground tabular-nums">{t("checklist.summary", { done: progress.done, total: progress.total })}</output>
      </div>

      {progress.total > 0 ? <Progress value={progress.percent} aria-label={t("checklist.progress")} className="mt-2 h-1.5" /> : null}

      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("checklist.empty")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {items.map((item, index) => (
            <li key={item.id} className="flex min-h-11 items-center gap-1.5 rounded-lg px-1 transition-colors duration-150 hover:bg-muted">
              {/* Le <label> ne contient QUE la case : englobant la ligne, il associerait le clic
                  du champ texte à la case et ferait basculer le point dès qu'on corrige son
                  libellé. Il porte la cible de 44 px que la case native n'a pas. */}
              <label className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={readOnly}
                  aria-label={t("checklist.toggle", { label: item.label })}
                  onChange={(event) => patchItem(index, { done: event.target.checked })}
                  className="size-4 accent-[var(--ck-success-ink)]"
                />
              </label>
              {readOnly ? (
                <span className={cn("min-w-0 flex-1 text-sm", item.done ? "text-muted-foreground line-through" : "text-foreground")}>{item.label}</span>
              ) : (
                <input
                  type="text"
                  value={item.label}
                  maxLength={maxLabelLength}
                  aria-label={t("checklist.itemLabel", { position: index + 1 })}
                  onChange={(event) => patchItem(index, { label: event.target.value })}
                  className={cn(
                    // Champ « nu » tant qu'on ne le vise pas : dix points tous encadrés font un mur
                    // de rectangles.
                    "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-foreground outline-none",
                    "hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    item.done && "text-muted-foreground line-through",
                  )}
                />
              )}
              {readOnly ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("checklist.remove", { label: item.label })}
                  className="text-muted-foreground pointer-coarse:size-11"
                  onClick={() => onChange(items.filter((_item, position) => position !== index))}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {readOnly ? null : (
        <div className="mt-3 flex items-center gap-2">
          <label className="sr-only" htmlFor={addFieldId}>
            {t("checklist.addLabel")}
          </label>
          <Input
            id={addFieldId}
            ref={addInputRef}
            value={draftLabel}
            maxLength={maxLabelLength}
            placeholder={t("checklist.addPlaceholder")}
            onChange={(event) => setDraftLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addItem();
            }}
            className="flex-1 pointer-coarse:h-11"
          />
          <Button type="button" variant="outline" onClick={addItem} disabled={draftLabel.trim().length === 0} className="pointer-coarse:h-11">
            <Plus aria-hidden />
            {t("checklist.add")}
          </Button>
        </div>
      )}
    </section>
  );
}
