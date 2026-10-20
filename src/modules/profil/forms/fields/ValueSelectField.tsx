import { useMemo } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
// Le `FormMessage` du MOTEUR de formulaire, seul à accepter `errorTranslate` — celui de `ui/form` est un
// simple <p> et rejetait la prop (les autres champs du moteur importent déjà celui-ci).
import { FormMessage } from "@/modules/formEngine/components/FormMessage";
import { SelectObject } from "@/components/ui/select-objet";
import { useListSources } from "@/hooks/useListSources";
import { capitaliser } from "@/lib/costumLists";

interface ValueSelectFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
  placeholder?: string;
  placeholderSearch?: string;
  /** SOCLE déclaré en config (`enum` du champ), déjà résolu par le moteur de formulaire — première
   *  source, prioritaire sur les listes costum (cf. docstring du composant). */
  options?: string[];
  /** Nom de la ou des listes déclarées dans `costum.lists` (défaut : le nom du champ). Plusieurs
   *  listes sont FUSIONNÉES dans l'ordre déclaré — cas d'un même champ alimenté depuis plusieurs
   *  collections (parent62 : `themes` est écrit sur `poi` ET sur `events`, donc une recette par
   *  collection). La forme de chacune (statique ou recette) est détectée automatiquement. */
  list?: string | string[];
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
 * SAISIE LIBRE OUVERTE À TOUS (`creatable`, `true` par défaut ; `creatable: false` la ferme). Ce champ
 * n'ÉCRIT rien : `costum.lists` est en lecture seule depuis site-json. Une valeur saisie vit sur la
 * fiche, et c'est la recette `distinct` qui la fait remonter aux suivants — une fois la fiche visible
 * et modérée, gate appliquée par le serveur (`ListValuesAction`, GARDE 3). Une valeur qu'aucune fiche
 * ne porte encore s'ajoute donc en config (le socle ci-dessous), pas depuis l'application.
 *
 * SOURCES — toutes FUSIONNÉES, dans cet ordre de priorité (`useListSources` / `resolveListSources`) :
 *  1. `options` — l'`enum` DÉCLARÉ dans la config (le moteur de formulaire le résout normalement).
 *     C'est le SOCLE : les valeurs qu'un site veut proposer d'emblée, même si aucune fiche ne les
 *     porte encore. Le défaut se déclare donc là où vit le champ, pas en base.
 *  2. chaque liste de `list`, sous la forme où elle est déclarée — statique (lue en mémoire, telle que
 *     le costum la porte) ou recette résolue par le serveur
 *     (`costum/co/listvalues` — les valeurs RÉELLEMENT saisies, ex. `auteurs`/`territoires` sur
 *     institut-bleu). Abonné aux signaux réactifs natifs du SDK : tout rafraîchissement du carrier met
 *     ce champ à jour sans reload.
 *
 * FUSION, PAS SUBSTITUTION — et c'est un changement délibéré. Le serveur n'était auparavant interrogé
 * QUE si (1) et (2) étaient vides : un champ à `enum` non vide ne voyait donc JAMAIS les valeurs
 * réellement employées, et un thème inédit accepté chez l'un restait invisible pour le suivant, qui
 * retapait la même idée sous une autre graphie. Le dédoublonnage casse/accents et l'ordre de priorité
 * font que le socle garde sa graphie (donc son libellé) quand la base porte la même valeur autrement.
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
  const listNames = list ?? String(name);
  // Socle déclaré + liste(s) costum, fusionnés — la forme de chaque liste (statique/recette) est
  // détectée par le hook, ce champ n'a pas à la connaître. `variants` n'est pas exploité ici : il sert
  // à INTERROGER un groupe de graphies (filtres), pas à en saisir une.
  const { values: valeurs } = useListSources(listNames, { declared: options, costumSlug });

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
