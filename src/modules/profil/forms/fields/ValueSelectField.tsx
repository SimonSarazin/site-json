import { useMemo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
// Le `FormMessage` du MOTEUR de formulaire, seul à accepter `errorTranslate` — celui de `ui/form` est un
// simple <p> et rejetait la prop (les autres champs du moteur importent déjà celui-ci).
import { FormMessage } from "@/modules/formEngine/components/FormMessage";
import { SelectObject } from "@/components/ui/select-objet";
import { useCocolight } from "@/hooks/useCocolight";
import { useCostumListValues } from "@/hooks/useCostumListValues";
import { capitaliser, costumSlugOf } from "@/lib/costumLists";

interface ValueSelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  placeholderSearch?: string;
  /** Propositions déjà résolues par le moteur de formulaire (liste STATIQUE du costum). */
  options?: string[];
  /** Nom de la liste déclarée dans `costum.lists` (défaut : le nom du champ). */
  list?: string;
  /** Slug du costum ; par défaut celui du porteur du site. */
  costumSlug?: string;
  /** Sélection multiple (défaut) ou valeur unique. En mono, la valeur stockée est une CHAÎNE. */
  multiple?: boolean;
  min?: number;
  max?: number;
  /** Autoriser une valeur absente des propositions (défaut : oui). */
  creatable?: boolean;
  required?: boolean;
  errorTranslate?: (key: string) => string;
}

/**
 * Champ de **sélection de valeurs** — une ou plusieurs — parmi celles d'une liste déclarée du costum
 * (`costum.lists.<nom>`), avec saisie libre facultative.
 *
 * Volontairement SANS rapport avec les tags : le champ visé peut être `territoires`, `auteurs`,
 * `legalStatus`… Là où le widget `tags` reste attaché à la sémantique « mots-clés » (et à la recherche
 * de tags du réseau), celui-ci ne suppose rien du champ.
 *
 * RENDU : le MÊME `SelectObject` que `select` et `multiselect` — même déclencheur, mêmes pastilles,
 * même popover, mêmes hauteurs. Un champ ne doit pas trahir par son allure quel composant l'implémente ;
 * l'unique différence fonctionnelle, la saisie libre, passe par `creatable`.
 *
 * DEUX SOURCES. Une liste STATIQUE arrive par `options`, le chemin ordinaire du moteur de formulaire.
 * Le hook n'est sollicité que si ce chemin repart vide, c'est-à-dire pour une liste DYNAMIQUE, dont seul
 * le serveur peut tirer les valeurs — donc celles réellement employées, fraîches.
 */
export function ValueSelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  placeholderSearch,
  options,
  list,
  costumSlug,
  multiple = true,
  min,
  max,
  creatable = true,
  required,
  errorTranslate,
}: ValueSelectFieldProps<T>) {
  const { entity: carrier } = useCocolight();
  const slug = costumSlug ?? costumSlugOf(carrier);
  const statiques = options ?? [];
  const { data: resultat } = useCostumListValues(slug, list ?? String(name), {
    enabled: statiques.length === 0,
  });
  const dynamiques = resultat?.values ?? [];
  const valeurs = statiques.length > 0 ? statiques : dynamiques;

  // Identité stable tant que le contenu ne bouge pas : `SelectObject` recopie ses `options` dans un
  // état interne à chaque changement de référence.
  // `label` capitalisé, `value` intacte : cf. `capitaliser` — on retouche l'affichage, jamais la donnée
  // écrite (le champ doit rester byte-identique à ce que le legacy stockerait).
  const propositions = useMemo(
    () => valeurs.map((v) => ({ id: v, label: capitaliser(v), value: v })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valeurs.join(" ")],
  );

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        // La valeur du formulaire est une chaîne en mono, un tableau en multi.
        const brut = field.value as string | string[] | null | undefined;
        const liste = Array.isArray(brut) ? brut : brut ? [brut] : [];
        return (
          <FormItem>
            {label && <FormLabel>{label}{required && " *"}</FormLabel>}
            <FormControl>
              <SelectObject
                multiple={multiple}
                creatable={creatable}
                value={multiple ? liste : (typeof brut === "string" ? brut : "")}
                onChange={(v) => {
                  if (!multiple) { field.onChange(typeof v === "string" ? v : ""); return; }
                  const next = (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string");
                  field.onChange(max != null && next.length > max ? next.slice(0, max) : next);
                }}
                options={propositions}
                placeholder={placeholder}
                placeholderSearch={placeholderSearch}
              />
            </FormControl>
            {min != null && liste.length < min && (
              <p className="text-xs text-muted-foreground">
                {min === 1 ? "Au moins une valeur." : `Au moins ${min} valeurs.`}
              </p>
            )}
            <FormMessage errorTranslate={errorTranslate} />
          </FormItem>
        );
      }}
    />
  );
}
