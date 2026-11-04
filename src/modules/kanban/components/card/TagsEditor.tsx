import { useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/modules/kanban/components/ui/Field";
import { fieldDescribedBy } from "@/modules/kanban/components/ui/fieldIds";
import { safeHexColor } from "@/modules/kanban/lib/colors";
import { addTag, CARD_TAGS_MAX, removeTag, tagLabelColor, TAG_MAX_LENGTH, type TagErrorCode } from "@/modules/kanban/lib/tags";

export interface TagsEditorProps {
  /** Intitulé visible du groupe (« Étiquettes »). */
  label: string;
  tags: readonly string[];
  /** Absent = lecture seule. */
  onChange?: (tags: string[]) => void;
  /** Tags déjà utilisés sur le tableau : proposés à la saisie. */
  suggestions?: readonly string[];
  /** Erreur de validation du formulaire, déjà traduite. */
  error?: string;
}

/**
 * Étiquettes LIBRES d'une action Communecter (§11.4), reprises de co-kanban (`TagsEditor`).
 *
 * Un tableau relié n'a pas de liste d'étiquettes à cocher : chaque carte porte ses tags, partagés
 * avec Kanban gestion. On les saisit (Entrée ou virgule, comme gestion), avec en suggestion ceux
 * du tableau pour ne pas multiplier « web » et « Web ». Pas de `<form>` imbriqué : Entrée est
 * interceptée ici.
 */
export function TagsEditor({ label, tags, onChange, suggestions = [], error }: TagsEditorProps) {
  const { t } = useTranslation("modules/kanban");
  const labelId = useId();
  const inputId = useId();
  const datalistId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [inputError, setInputError] = useState<TagErrorCode | null>(null);

  const editable = onChange !== undefined;
  const offered = suggestions.filter((tag) => !tags.includes(tag));
  const inputMessage = inputError ? t(`tags.errors.${inputError}`, { max: TAG_MAX_LENGTH, maxTags: CARD_TAGS_MAX }) : undefined;
  const hint = t("tags.hint");

  function commit() {
    if (!onChange) return;
    const result = addTag(tags, value);
    // Champ vide validé par mégarde : rien à dire, rien à ajouter.
    if (result.error === "empty") return;
    if (result.error !== null) {
      setInputError(result.error);
      return;
    }
    onChange(result.tags);
    setValue("");
    setInputError(null);
    // Le champ garde le focus : on saisit souvent plusieurs tags d'affilée.
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </span>

      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("tags.empty")}</p>
      ) : (
        <ul aria-labelledby={labelId} className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <li key={tag} className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-muted pr-1 pl-2.5 text-xs font-medium text-foreground">
              {/* Pastille de couleur décorative, couleur validée : le nom est toujours écrit. */}
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: safeHexColor(tagLabelColor(tag), "var(--muted-foreground)") }} />
              <span className="truncate">{tag}</span>
              {editable ? (
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("tags.remove", { tag })} className="size-6 rounded-full text-muted-foreground pointer-coarse:size-11" onClick={() => onChange(removeTag(tags, tag))}>
                  <X aria-hidden className="size-3.5" />
                </Button>
              ) : (
                <span aria-hidden className="w-1.5" />
              )}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <Field className="mt-1" label={t("tags.inputLabel")} htmlFor={inputId} hint={hint} error={inputMessage}>
          {/* Champ et bouton sur une rangée, aide et erreur SOUS les deux. */}
          <div className="flex items-center gap-2">
            <Input
              id={inputId}
              ref={inputRef}
              value={value}
              list={offered.length > 0 ? datalistId : undefined}
              maxLength={TAG_MAX_LENGTH + 1}
              autoComplete="off"
              placeholder={t("tags.placeholder")}
              aria-invalid={inputError !== null || undefined}
              aria-describedby={fieldDescribedBy(inputId, { hint, error: inputMessage })}
              onChange={(event) => {
                setValue(event.target.value);
                setInputError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== ",") return;
                event.preventDefault();
                commit();
              }}
              className="pointer-coarse:h-11"
            />
            <Button type="button" variant="outline" className="shrink-0 pointer-coarse:h-11" onClick={commit} disabled={value.trim().length === 0}>
              <Plus aria-hidden />
              {t("tags.add")}
            </Button>
            {offered.length > 0 ? (
              <datalist id={datalistId}>
                {offered.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            ) : null}
          </div>
        </Field>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
