import { useMemo, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FieldError, FieldLabel, HintText } from "./FormFields";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCategorizedCheckboxOptions } from "../hooks/useCategorizedCheckboxOptions";
import {
  emptyCategorizedValue,
  normalizeCategorizedValue,
  resolveStoredKey,
  toggleCategory,
  toggleChild,
} from "../utils/categorizedCheckbox";
import { optionKeySlug } from "../utils/slugify";
import type {
  CategorizedCheckboxOption,
  CategorizedCheckboxValue,
  FormFieldMapping,
} from "../types";
import "../i18n/i18n";

interface CategorizedCheckboxFieldProps {
  field: FormFieldMapping;
  errors: FieldErrors;
  value?: CategorizedCheckboxValue;
  onChange?: (value: CategorizedCheckboxValue) => void;
  readOnly?: boolean;
  hideLabel?: boolean;
}

/** Une ligne du récapitulatif de lecture. */
interface SummaryRow {
  key: string;
  label: string;
  children: string[];
  unresolved: boolean;
}

/** Clé cochée en base qui ne correspond à aucune option connue — affichée quand même. */
interface OrphanEntry {
  parentKey: string;
  parentLabel: string;
  childKeys: string[];
}

/**
 * Cases à cocher à DEUX niveaux : des catégories, et sous chacune des sous-options.
 *
 * Les options viennent soit d'une liste saisie par l'admin, soit — et c'est la raison d'être de cet
 * input — de questions `commonTableV2` d'un formulaire TIERS : chaque question devient une
 * catégorie, chacune de ses criterias une sous-option (cf. `useCategorizedCheckboxOptions`).
 *
 * Deux comportements repris du legacy (`categorizedCheckbox.php:680` et `:702`) : cocher une
 * sous-option coche sa catégorie, et décocher la dernière sous-option décoche la catégorie.
 *
 * Les valeurs déjà en base dont la clé ne se résout plus (question renommée, liste réordonnée) sont
 * affichées en fin de liste plutôt qu'escamotées — cf. `resolveStoredKey`. Sans ça, ouvrir puis
 * ré-enregistrer une réponse effacerait silencieusement des choix que l'utilisateur voit cochés
 * côté legacy.
 */
export function CategorizedCheckboxField({
  field,
  errors,
  value,
  onChange,
  readOnly,
  hideLabel,
}: CategorizedCheckboxFieldProps) {
  useLoadNamespace("modules/coform");
  const t = useT("modules/coform");

  const config = field.categorizedCheckboxConfig;
  const hasError = !!errors[field.name];
  const interactive = !readOnly && !!onChange;

  const current = useMemo(
    () => (value ? normalizeCategorizedValue(value) : emptyCategorizedValue()),
    [value],
  );

  const { options, isLoading, error } = useCategorizedCheckboxOptions(config);

  const emit = (next: CategorizedCheckboxValue) => onChange?.(next);

  // Catégories dépliées. Défaut : celles qui portent déjà une réponse — l'utilisateur voit
  // immédiatement ce qu'il a coché sans avoir à ouvrir chaque bloc.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (option: CategorizedCheckboxOption): boolean =>
    expanded[option.key] ?? isChecked(option.key);

  /**
   * Cocher une catégorie ouvre ses sous-options (comportement legacy,
   * `categorizedCheckbox.php:598-604`) : cocher n'a de sens que pour préciser ensuite, laisser le
   * bloc replié cacherait l'étape suivante. Le repli automatique sur `isChecked` ne suffit pas —
   * il est court-circuité dès que l'utilisateur a replié le bloc à la main.
   *
   * Décocher ne referme PAS : le legacy ne le fait pas non plus, et laisser ouvert permet de
   * re-cocher directement une sous-option (ce qui re-coche la catégorie).
   */
  const handleCategoryToggle = (option: CategorizedCheckboxOption, checked: boolean) => {
    if (checked && option.children.length > 0) {
      setExpanded((e) => ({ ...e, [option.key]: true }));
    }
    emit(toggleCategory(current, storedKeyFor(option.key), checked));
  };

  function isChecked(optionKey: string): boolean {
    return current.list.some((stored) => stored === optionKey || optionKeySlug(stored) === optionKeySlug(optionKey));
  }

  /** Clé telle qu'elle est STOCKÉE pour cette option (peut différer de la clé dérivée). */
  function storedKeyFor(optionKey: string): string {
    return (
      current.list.find((stored) => stored === optionKey || optionKeySlug(stored) === optionKeySlug(optionKey)) ??
      optionKey
    );
  }

  function isChildChecked(optionKey: string, childKey: string): boolean {
    const children = current.sublist[storedKeyFor(optionKey)] ?? [];
    return children.some((stored) => stored === childKey || optionKeySlug(stored) === optionKeySlug(childKey));
  }

  /**
   * UNE seule passe sur la valeur, deux sorties (norme : regrouper les dérivations liées plutôt
   * que de refaire la même boucle) :
   *  - `summary` : le récapitulatif de LECTURE, uniquement ce qui a été coché. Le reste du module
   *    en lecture seule n'affiche que les valeurs choisies, et un tiret quand il n'y en a pas —
   *    dérouler ici les 16 catégories grisées jurerait avec tous les champs voisins ;
   *  - `orphans` : le sous-ensemble dont la clé ne se résout plus, signalé à part en ÉDITION.
   *
   * Les deux parcourent `list` puis les clés de `sublist` sans parent : le legacy ne purgeait pas
   * `sublist` en décochant sa catégorie, ces réponses existent en base et restent visibles côté
   * legacy — les perdre ici les effacerait au premier ré-enregistrement.
   */
  const { summary, orphans } = useMemo(() => {
    const rows: SummaryRow[] = [];
    const orphelines: OrphanEntry[] = [];
    const vues = new Set<string>();

    const ligne = (storedKey: string) => {
      if (vues.has(storedKey)) return;
      vues.add(storedKey);
      const option = resolveStoredKey(storedKey, options);
      const storedChildren = current.sublist[storedKey] ?? [];
      rows.push({
        key: storedKey,
        label: option?.label ?? humanizeKey(storedKey),
        children: storedChildren.map((c) => {
          const child = option ? resolveStoredKey(c, option.children) : undefined;
          return child?.label ?? humanizeKey(c);
        }),
        unresolved: !option,
      });
      if (!option) {
        orphelines.push({ parentKey: storedKey, parentLabel: humanizeKey(storedKey), childKeys: storedChildren });
      }
    };

    for (const storedKey of current.list) ligne(storedKey);
    for (const parentKey of Object.keys(current.sublist)) {
      if (!current.list.includes(parentKey)) ligne(parentKey);
    }
    return { summary: rows, orphans: orphelines };
  }, [current, options]);

  const notConfigured =
    !config ||
    (config.dataSourceToUse === "manual" && config.list.length === 0) ||
    (options.length === 0 && !isLoading && !error);

  if (readOnly) {
    return (
      <div className={cn("space-y-2", field.width || "col-span-12")}>
        {!hideLabel && <FieldLabel field={field} />}
        {summary.length === 0 ? (
          <span className="text-muted-foreground/50 italic">—</span>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {summary.map((row) => (
              <li key={row.key}>
                <span className={cn("font-medium", row.unresolved && "text-muted-foreground")}>
                  {row.label}
                </span>
                {row.children.length > 0 && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 text-muted-foreground">
                    {row.children.map((c) => (
                      <li key={c}>· {c}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", field.width || "col-span-12")}>
      {/* Label en `<div>` : le contrôle est une liste de cases, pas un input ciblable. */}
      {!hideLabel && <FieldLabel field={field} id={`${field.name}-label`} hasError={hasError} />}

      {field.info && <HintText text={field.info} />}

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-3/5" />
        </div>
      )}

      {!isLoading && error && (
        <p className="text-sm text-destructive">
          {t("coform.categorizedCheckbox.loadError", "Impossible de charger les options.")}
        </p>
      )}

      {!isLoading && !error && notConfigured && orphans.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          {t("coform.categorizedCheckbox.notConfigured", "Ce champ n'est pas encore configuré.")}
        </p>
      )}

      {!isLoading && !error && options.length > 0 && (
        <ul
          className="space-y-1"
          aria-labelledby={!hideLabel ? `${field.name}-label` : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
        >
          {options.map((option) => {
            const checked = isChecked(option.key);
            const open = isExpanded(option);
            const hasChildren = option.children.length > 0;
            return (
              <li key={option.key} className="rounded-md">
                <div className="flex items-start gap-2">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [option.key]: !open }))}
                      className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-expanded={open}
                      aria-label={
                        open
                          ? t("coform.categorizedCheckbox.collapse", "Replier")
                          : t("coform.categorizedCheckbox.expand", "Déplier")
                      }
                    >
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <span className="w-4" aria-hidden="true" />
                  )}

                  <Checkbox
                    id={`${field.name}-${option.key}`}
                    checked={checked}
                    disabled={!interactive}
                    onCheckedChange={(c) => handleCategoryToggle(option, c === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`${field.name}-${option.key}`}
                    className={cn("text-sm leading-snug", interactive ? "cursor-pointer" : "cursor-default")}
                  >
                    {option.label}
                  </label>
                </div>

                {hasChildren && open && (
                  <ul className="mt-1 ml-6 space-y-1 border-l border-border pl-4">
                    {option.children.map((child) => {
                      const childChecked = isChildChecked(option.key, child.key);
                      const id = `${field.name}-${option.key}-${child.key}`;
                      return (
                        <li key={child.key} className="flex items-start gap-2">
                          <Checkbox
                            id={id}
                            checked={childChecked}
                            disabled={!interactive}
                            onCheckedChange={(c) =>
                              emit(toggleChild(current, storedKeyFor(option.key), child.key, c === true))
                            }
                            className="mt-0.5"
                          />
                          <label
                            htmlFor={id}
                            className={cn(
                              "text-sm leading-snug",
                              interactive ? "cursor-pointer" : "cursor-default",
                            )}
                          >
                            {child.label}
                            {/* Popularité de l'usage dans les réponses source — information que le
                                legacy n'affichait pas, gratuite ici (`getCatalogs` la renvoie). */}
                            {!!child.count && child.count > 0 && (
                              <span className="ml-1.5 text-xs text-muted-foreground">({child.count})</span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {orphans.length > 0 && (
        <div className="space-y-1 rounded-md border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            {t(
              "coform.categorizedCheckbox.orphans",
              "Réponses enregistrées ne correspondant plus à une option proposée :",
            )}
          </p>
          <ul className="space-y-0.5">
            {orphans.map((o) => (
              <li key={o.parentKey} className="text-sm text-muted-foreground">
                {o.parentLabel}
                {o.childKeys.length > 0 && (
                  <span className="text-xs"> — {o.childKeys.map(humanizeKey).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FieldError name={field.name} message={errors[field.name]?.message as string | undefined} />
    </div>
  );
}

/**
 * Rend une clé orpheline lisible : `4_autres-outils-de-la-cae` → « Autres outils de la cae ».
 * Reconstruction approximative — le libellé d'origine n'existe plus nulle part, seul le slug reste.
 */
function humanizeKey(key: string): string {
  const slug = optionKeySlug(key).replace(/-/g, " ").trim();
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : key;
}
