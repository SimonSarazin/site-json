import { useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { ProseContent } from "@/components/shared/ProseContent";
import { Check, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { FormFieldMapping } from "../types";
import { MarkdownEditor } from "./MarkdownEditor";

// `ProseContent` a été sorti dans `@/components/shared` : les fiches AAC
// affichent en lecture les mêmes valeurs que les champs saisissent, et une
// seconde implémentation aurait signifié une seconde garantie de sécurité à
// maintenir. Ré-exporté ici pour que les call-sites du module ne bougent pas.
export { ProseContent };

/**
 * Composant pour afficher un indice/info avec support markdown ET HTML brut.
 * Délègue à `ProseContent` qui auto-détecte HTML vs markdown, rend le markdown
 * via markdown-it (`<br/>` inline supportés) puis **sanitise** le HTML avant
 * injection.
 *
 * `source="formDefinition"` : les 15 appelants de `HintText` lui passent
 * `field.info`, c'est-à-dire l'aide rédigée par l'administrateur de l'AAP dans
 * la définition du formulaire — pas une réponse de déposant. Elle garde donc le
 * profil DOMPurify par défaut (`style`, `class`, `id`, `<svg>` conservés) : des
 * formulaires du parc mettent leurs aides en forme. Cf. `@/lib/sanitize` et
 * `ProseContent`.
 */
export function HintText({ text }: { text: string }) {
  return (
    <ProseContent
      text={text}
      source="formDefinition"
      className="text-xs text-muted-foreground -mt-1 mb-1 prose prose-xs dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0"
    />
  );
}

/**
 * Message d'erreur de champ avec ARIA — id stable pour `aria-describedby`
 * et `role="alert"` pour annonce SR immédiate. Réutilisé par tous les
 * composants de champs CoForm (export pour usage cross-fichier).
 */
export function FieldError({ name, message }: { name: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p
      id={`${name}-error`}
      role="alert"
      className="text-xs text-destructive flex items-center gap-1 mt-1"
    >
      <svg aria-hidden="true" className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {message}
    </p>
  );
}

/**
 * Libellé d'une question — **point unique** où se règle son apparence.
 *
 * Les champs du module rendaient auparavant ce bloc en copie inline
 * (`<Label className="text-sm font-medium">{label}{isRequired && "*"}</Label>`),
 * dans 10 fichiers. Toute retouche de hiérarchie visuelle devait donc être
 * répétée à chaque champ — et le moindre oubli désalignait une question. Ici,
 * une seule ligne fait bouger tout le formulaire.
 *
 * **Hiérarchie** : la question est en `text-base font-semibold` alors que le
 * contenu (options, aides, valeurs) reste en `text-sm`. Cet écart d'un cran de
 * taille ET de graisse est ce qui permet de distinguer « ce qui est demandé »
 * de « ce avec quoi on répond » — avant, tout le formulaire était au même
 * `text-sm` et les deux niveaux se confondaient.
 *
 * **Élément rendu** : `<label>` **uniquement** si `htmlFor` est fourni. Sans
 * cible, un `<label>` n'a aucun effet d'accessibilité (il ne donne son nom à
 * rien) : on rend alors une `<div>`, que le contrôle référence par
 * `aria-labelledby={id}`. C'est le cas de tous les champs composites dont le
 * contrôle n'est pas un input focusable (liste de cases, bouton de modale…).
 */
export function FieldLabel({
  field,
  htmlFor,
  id,
  hasError,
  className,
}: {
  field: Pick<FormFieldMapping, "label" | "isRequired">;
  /** Id de l'input ciblé. Fourni → `<label for>` ; absent → `<div>`. */
  htmlFor?: string;
  /** Id du libellé, à référencer via `aria-labelledby` côté contrôle. */
  id?: string;
  hasError?: boolean;
  className?: string;
}) {
  const t = useT("modules/coform");
  if (!field.label) return null;

  const content = (
    <>
      {field.label}
      {field.isRequired && (
        <>
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
          {/* L'astérisque est décorative : lue telle quelle, elle s'annonce
              « étoile ». Le caractère obligatoire est donc porté ici par un
              texte réservé aux lecteurs d'écran, DANS le libellé — et non par
              `aria-required` sur le contrôle, que plusieurs champs du module ne
              posent pas (les composites dont le contrôle n'est pas un input).
              Au niveau du libellé, l'information vaut pour tous. */}
          <span className="sr-only">{t("coform.field.required", "obligatoire")}</span>
        </>
      )}
    </>
  );

  const classes = cn(
    "block text-base font-semibold leading-snug text-foreground",
    hasError && "text-destructive",
    className,
  );

  if (htmlFor) {
    return (
      <Label id={id} htmlFor={htmlFor} className={classes}>
        {content}
      </Label>
    );
  }

  return (
    <div id={id} className={classes}>
      {content}
    </div>
  );
}

interface FormFieldProps {
  field: FormFieldMapping;
  register?: UseFormRegister<Record<string, unknown>>;
  errors: FieldErrors;
  value?: unknown;
  onChange?: (value: unknown) => void;
}

/**
 * Composant pour afficher un champ texte simple
 */
export function TextField({ field, register, errors }: FormFieldProps) {
  const hasError = !!errors[field.name];
  // `type="url"` natif (validation HTML5) rejette les URL sans schéma. Le format
  // est validé côté Zod par une regex tolérante (cf. generateZodSchema) qui
  // accepte les URL sans http, et n'est pas appliquée à un champ vide non requis.
  const isUrl = field.inputType === "url";
  
  return (
    <div className={cn("space-y-2", field.width)}>
      <FieldLabel field={field} htmlFor={field.name} />
      {field.info && <HintText text={field.info} />}
      <div className={cn(
        // `overflow-hidden rounded-md` : clippe la sous-ligne `after:` au
        // même radius que l'<Input> (rounded-md). Sans ça, le trait rouge
        // (état erreur) ou bleu (focus) déborde aux deux coins inférieurs.
        "relative overflow-hidden rounded-md",
        "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full",
        "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
        hasError
          ? "after:scale-x-100 after:bg-destructive"
          : "focus-within:after:scale-x-100 after:bg-primary"
      )}>
        <Input
          id={field.name}
          type={isUrl ? "text" : field.inputType || "text"}
          inputMode={isUrl ? "url" : undefined}
          placeholder={field.placeholder}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
          aria-required={field.isRequired || undefined}
          {...(register ? register(field.name) : {})}
          className="border border-input focus-visible:ring-0 focus-visible:border-input"
        />
      </div>
      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

/**
 * Composant pour afficher un champ textarea (avec support markdown optionnel)
 */
export function TextAreaField({ field, register, errors, value, onChange }: FormFieldProps) {
  const hasError = !!errors[field.name];
  const isMarkdown = field.markdown === true;
  const textValue = typeof value === "string" ? value : "";
  
  return (
    <div className={cn("space-y-2", field.width)}>
      <FieldLabel field={field} htmlFor={field.name} />
      {field.info && <HintText text={field.info} />}

      {isMarkdown ? (
        <MarkdownEditor
          value={textValue}
          onChange={(val) => onChange?.(val || "")}
          height={200}
          preview="edit"
        />
      ) : (
        <div className={cn(
          // Cf. TextField : `overflow-hidden rounded-md` clippe la sous-ligne
          // `after:` au même radius que le <Textarea>, sinon le trait
          // rouge/bleu déborde aux coins inférieurs.
          "relative overflow-hidden rounded-md",
          "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full",
          "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
          hasError
            ? "after:scale-x-100 after:bg-destructive"
            : "focus-within:after:scale-x-100 after:bg-primary"
        )}>
          <Textarea
            id={field.name}
            placeholder={field.placeholder}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? `${field.name}-error` : undefined}
            aria-required={field.isRequired || undefined}
            {...(register ? register(field.name) : {})}
            className="min-h-25 border border-input focus-visible:ring-0 focus-visible:border-input"
          />
        </div>
      )}

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

/**
 * Séparateur de section avec titre (tpls.forms.sectionTitle)
 * Affiche un titre h2 + barre séparatrice + info optionnel.
 * N'enregistre aucune valeur dans react-hook-form.
 */
export function SectionTitleField({ field }: { field: FormFieldMapping }) {
  const cfg = field.sectionTitleConfig ?? {
    showBar: true,
    barPosition: "between" as const,
    align: "center" as const,
    textDecoration: "uppercase" as const,
  };

  const alignClass = { left: "text-left", center: "text-center", right: "text-right" }[cfg.align];

  return (
    <div className={cn("col-span-12 my-4", alignClass, field.width)}>
      {cfg.showBar && cfg.barPosition === "above" && (
        <hr className="mb-2 border-border" />
      )}
      {field.label && (
        <h2
          className="text-lg font-semibold text-foreground"
          style={{
            textTransform: cfg.textDecoration === "none" ? undefined : cfg.textDecoration,
            borderBottom: cfg.showBar && cfg.barPosition === "between" ? "1px solid hsl(var(--border))" : "none",
            paddingBottom: cfg.showBar && cfg.barPosition === "between" ? "0.5rem" : undefined,
            marginBottom: "0.25rem",
          }}
        >
          {field.label}
        </h2>
      )}
      {field.info && (
        // Définition du formulaire (admin AAP) → profil DOMPurify par défaut,
        // cf. `ProseContent` / `@/lib/sanitize`.
        <ProseContent
          text={field.info}
          source="formDefinition"
          className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none mt-1"
        />
      )}
      {cfg.showBar && cfg.barPosition === "below" && (
        <hr className="mt-2 border-border" />
      )}
    </div>
  );
}

/**
 * Séparateur de titre (`tpls.forms.titleSeparator`).
 *
 * Marque une rupture forte dans un formulaire long : le legacy rend un `<h2>`
 * centré dans un bandeau gris borduré de pointillés haut et bas, suivi d'un
 * chevron vers le bas (`titleSeparator.php`). On garde cette signature — bandeau
 * pleine largeur + pointillés + chevron — mais avec les tokens du design system
 * plutôt que le `#ddd` en dur, pour que le thème sombre suive.
 *
 * **N'enregistre aucune valeur** : ni défaut, ni entrée dans le schéma Zod.
 * ⚠️ `isRequired: true` est pourtant posé sur 57 des 78 occurrences du parc ;
 * l'honorer rendrait ces formulaires insoumettables (cf. `generateZodSchema`).
 * On l'ignore donc délibérément, et on ne rend pas d'astérisque.
 */
export function TitleSeparatorField({ field }: { field: FormFieldMapping }) {
  return (
    <div className={cn("col-span-12 my-6", field.width)}>
      <div className="border-y border-dashed border-border bg-muted/60 px-4 py-3 text-center">
        {field.label && (
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {field.label}
          </h2>
        )}
        {field.info && (
          // Définition du formulaire (admin AAP) → profil DOMPurify par défaut.
          <ProseContent
            text={field.info}
            source="formDefinition"
            className="mt-1 text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none [&>p]:m-0"
          />
        )}
        <ChevronDown
          aria-hidden="true"
          className="mx-auto mt-1 h-4 w-4 text-muted-foreground"
        />
      </div>
    </div>
  );
}

/**
 * Bloc de description de section (tpls.forms.sectionDescription)
 * Affiche un label optionnel + texte de description.
 * N'enregistre aucune valeur dans react-hook-form.
 */
export function SectionDescriptionField({ field }: { field: FormFieldMapping }) {
  return (
    <div className={cn("col-span-12 my-1", field.width)}>
      {/* Libellé ET info viennent de la définition du formulaire, écrite par
          l'administrateur de l'AAP → profil DOMPurify par défaut, qui conserve
          la mise en forme (`style`, `class`) de ces blocs de texte libre.
          Cf. `ProseContent` / `@/lib/sanitize`. */}
      {field.label && (
        <ProseContent
          text={field.label}
          forceMarkdown
          source="formDefinition"
          className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none mb-1"
        />
      )}
      {field.info && (
        <ProseContent
          text={field.info}
          forceMarkdown
          source="formDefinition"
          className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
        />
      )}
    </div>
  );
}

/**
 * Composant pour afficher des boutons radio
 */
export function RadioField({ field, errors, value, onChange }: FormFieldProps) {
  const options = field.options || [];
  const isRow = field.positionType === "row";
  const selectedValue = typeof value === "string" ? value : "";
  const hasError = !!errors[field.name];

  return (
    <div className={cn("space-y-4", field.width)}>
      <FieldLabel field={field} />
      {field.info && <HintText text={field.info} />}
      
      <RadioGroup
        value={selectedValue}
        onValueChange={onChange}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${field.name}-error` : undefined}
        aria-required={field.isRequired || undefined}
        className={cn(
          isRow ? "flex flex-row flex-wrap gap-4" : "flex-col space-y-0.5"
        )}
      >
        {options.map((option, index) => (
          <div
            key={index}
            className="flex items-center space-x-2.5 cursor-pointer"
          >
            <RadioGroupItem value={option} id={`${field.name}-${index}`} />
            <Label
              htmlFor={`${field.name}-${index}`}
              className="font-normal cursor-pointer flex-1"
            >
              {option}
            </Label>
          </div>
        ))}
      </RadioGroup>

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

/**
 * Liste déroulante (legacy `tpls/forms/select.php`).
 *
 * Single-select bâti sur le `<Select>` shadcn (Radix → ARIA correct par
 * défaut). La valeur stockée est l'option sélectionnée telle quelle ; pour
 * les options associatives legacy (`{cle: "Label"}`), `field.options` porte
 * les clés et `field.optionLabels` la correspondance clé→label affiché.
 *
 * Quand `field.searchable` est vrai (port du flag legacy `enableSelect2`), on
 * passe à un combobox recherchable (Popover + cmdk) ; sinon liste simple.
 *
 * NB : Radix interdit un `<SelectItem value="">` ; on filtre donc les options
 * vides. La valeur vide ("" = rien de sélectionné) reste gérée au niveau de
 * la racine `<Select>` (affiche le placeholder via `<SelectValue>`).
 */
export function SelectField({ field, errors, value, onChange }: FormFieldProps) {
  const t = useT("modules/coform");
  const [open, setOpen] = useState(false);
  const options = (field.options || []).filter((option) => option !== "");
  const selectedValue = typeof value === "string" ? value : "";
  const hasError = !!errors[field.name];
  const placeholder = field.placeholder || t("coform.fields.selectPlaceholder");
  const labelOf = (option: string) => field.optionLabels?.[option] ?? option;

  return (
    <div className={cn("space-y-2", field.width)}>
      <FieldLabel field={field} htmlFor={field.name} />
      {field.info && <HintText text={field.info} />}

      {field.searchable ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={field.name}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? `${field.name}-error` : undefined}
              aria-required={field.isRequired || undefined}
              className={cn(
                "w-full justify-between font-normal",
                !selectedValue && "text-muted-foreground",
                hasError && "border-destructive"
              )}
            >
              <span className="truncate">
                {selectedValue ? labelOf(selectedValue) : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
            <Command>
              <CommandInput placeholder={placeholder} />
              <CommandList>
                <CommandEmpty>{t("coform.fields.selectNoResult")}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option}
                      // valeur de recherche = label affiché (pour les options
                      // associatives, l'user tape le texte visible, pas la clé)
                      value={labelOf(option)}
                      onSelect={() => {
                        onChange?.(option);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedValue === option ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {labelOf(option)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <Select value={selectedValue} onValueChange={onChange}>
          <SelectTrigger
            id={field.name}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? `${field.name}-error` : undefined}
            aria-required={field.isRequired || undefined}
            className={cn("w-full border border-input", hasError && "border-destructive")}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {labelOf(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

/**
 * Composant pour afficher des cases à cocher
 */
export function CheckboxField({ field, errors, value = [], onChange }: FormFieldProps) {
  const options = field.options || [];
  const isRow = field.positionType === "row";
  const selectedValues = Array.isArray(value) ? value as string[] : [];
  const hasError = !!errors[field.name];

  const handleCheckboxChange = (option: string, checked: boolean) => {
    if (checked) {
      onChange?.([...selectedValues, option]);
    } else {
      onChange?.(selectedValues.filter((v: string) => v !== option));
    }
  };

  return (
    <div className={cn("space-y-4", field.width)}>
      <FieldLabel field={field} />
      {field.info && <HintText text={field.info} />}

      <div
        role="group"
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${field.name}-error` : undefined}
        className={cn(
          isRow ? "flex flex-row flex-wrap gap-4" : "flex-col space-y-0.5"
        )}
      >
        {options.map((option, index) => {
          const isChecked = selectedValues.includes(option);
          return (
            <div
              key={index}
              className="flex items-center space-x-2.5 py-1 cursor-pointer"
            >
              <Checkbox
                id={`${field.name}-${index}`}
                checked={isChecked}
                onCheckedChange={(checked) => handleCheckboxChange(option, checked as boolean)}
              />
              <Label
                htmlFor={`${field.name}-${index}`}
                className="font-normal cursor-pointer flex-1"
              >
                {option}
              </Label>
            </div>
          );
        })}
      </div>

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}
