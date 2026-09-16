import { useId, useMemo, useRef, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError, FieldLabel, HintText } from "./FormFields";
import { useTagSuggestions } from "../hooks/useTagSuggestions";
import { addTags, normalizeTagsValue, removeTag } from "../utils/tags";
import type { FormFieldMapping, TagsValue } from "../types";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "../i18n/i18n";

/** Référence stable : `?? []` en ligne recréerait un tableau à chaque rendu. */
const SANS_VOCABULAIRE: string[] = [];

interface TagsFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: TagsValue;
  onChange?: (value: TagsValue) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
}

/**
 * Champ de mots-clés libres (`tpls.forms.tags`) — port du select2 `tags: true`
 * du legacy (`tags.php`).
 *
 * Trois comportements repris tels quels : saisie libre (`createSearchChoice`),
 * virgule séparatrice (`tokenSeparators`), et autocomplétion sur les tags déjà
 * employés. La source des suggestions est décrite dans `useTagSuggestions`.
 *
 * **Suggestions rendues EN LIGNE, pas en `Popover`.** Un formulaire coform se
 * rend couramment dans une `Dialog` (`CoFormModal`), et un contenu portalisé y
 * a déjà coûté deux bugs distincts : la molette meurt (`react-remove-scroll`
 * voit le portail comme « dehors ») et un clic sur l'ancre est traité comme un
 * clic extérieur. Une liste en flux normal n'a ni l'un ni l'autre.
 *
 * ⚠️ Écart assumé avec le legacy : celui-ci pousse chaque tag saisi dans le
 * vocabulaire partagé du formulaire (`PushTagsAction`, `$addToSet` sur
 * `params.<inputKey>.list`). Le SDK n'expose pas d'équivalent — `updateField`
 * sait faire `$push` mais pas `$addToSet` — donc le vocabulaire ne grossit pas
 * depuis React. Les réponses, elles, sont enregistrées normalement ; seules les
 * suggestions offertes aux répondants suivants stagnent. Cf. le dossier projet.
 */
export function TagsField({
  field,
  errors,
  value,
  onChange,
  readOnly = false,
  hideLabel = false,
}: TagsFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const tags = useMemo(() => normalizeTagsValue(value), [value]);
  const hasError = !!errors[field.name];

  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const { suggestions, isLoading } = useTagSuggestions({
    query: draft,
    vocabulary: field.tagsConfig?.list ?? SANS_VOCABULAIRE,
    selected: tags,
    enabled: !readOnly,
  });

  const commit = (raw: string) => {
    const next = addTags(tags, raw);
    if (next !== tags) onChange?.(next);
    setDraft("");
    setActiveIndex(-1);
  };

  const drop = (tag: string) => {
    const next = removeTag(tags, tag);
    if (next !== tags) onChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const visible = isOpen ? suggestions : [];

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (visible.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => {
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next = i + delta;
        if (next < 0) return visible.length - 1;
        if (next >= visible.length) return 0;
        return next;
      });
      return;
    }

    // Entrée : pose le tag surligné s'il y en a un, sinon la saisie brute —
    // c'est ce qui rend la création libre possible même quand une suggestion
    // est affichée.
    if (e.key === "Enter") {
      const picked = activeIndex >= 0 ? visible[activeIndex] : undefined;
      if (!picked && !draft.trim()) return;
      e.preventDefault();
      commit(picked ?? draft);
      return;
    }

    // Virgule : sépare des tokens, donc valide TOUJOURS ce qui est tapé et
    // jamais la suggestion surlignée — sinon taper « coop, » alors que
    // « coopération » est surligné poserait un tag que l'on n'a pas écrit.
    if (e.key === ",") {
      if (!draft.trim()) return;
      e.preventDefault();
      commit(draft);
      return;
    }

    if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    // Retour arrière sur un champ vide : retire le dernier tag, comme select2.
    if (e.key === "Backspace" && draft === "" && tags.length > 0) {
    e.preventDefault();
    drop(tags[tags.length - 1]);
    }
  };

  if (readOnly) {
    return (
      <div className={cn("space-y-2", field.width || "col-span-12")}>
        {!hideLabel && <FieldLabel field={field} />}
        {tags.length === 0 ? (
          <span className="text-muted-foreground/50 italic">—</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal text-xs px-2 py-0.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  const showSuggestions = isOpen && suggestions.length > 0;

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      {!hideLabel && <FieldLabel field={field} htmlFor={field.name} hasError={hasError} />}
      {field.info && <HintText text={field.info} />}

      {/* Le conteneur imite un input : les puces vivent DANS le cadre, la zone
          de frappe occupe la place restante. Cliquer n'importe où donne le focus. */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5",
          "focus-within:border-primary transition-colors",
          hasError && "border-destructive",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="font-normal text-xs gap-1 pl-2 pr-1 py-0.5">
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                drop(tag);
              }}
              className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
              aria-label={t("coform.tags.remove", "Retirer le tag {{tag}}", { tag })}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}

        <Input
          ref={inputRef}
          id={field.name}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          // Fermeture directe : cliquer une suggestion ne déclenche PAS de blur
          // (son `onMouseDown` fait `preventDefault`, le focus ne quitte pas
          // l'input), donc pas besoin de différer.
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={field.placeholder || t("coform.tags.placeholder", "Ajouter un mot-clé…")}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={
            showSuggestions && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
          aria-required={field.isRequired || undefined}
          className={cn(
            "h-7 flex-1 min-w-32 border-0 bg-transparent px-1 py-0 shadow-none",
            "focus-visible:ring-0 focus-visible:border-0",
          )}
        />
      </div>

      {showSuggestions && (
        <ul
          id={listboxId}
          role="listbox"
          className="scrollbar-thin max-h-48 overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-sm"
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // `onMouseDown` et pas `onClick` : le blur de l'input part avant
              // le click et fermerait la liste sous le curseur.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(tag);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5",
                i === activeIndex && "bg-accent text-accent-foreground",
              )}
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {isLoading && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("coform.tags.searching", "Recherche…")}
        </p>
      )}

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

export default TagsField;
