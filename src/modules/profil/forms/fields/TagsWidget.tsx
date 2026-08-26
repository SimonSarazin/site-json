import type { Control, FieldPath, FieldValues } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { useCocolight } from "@/hooks/useCocolight";
import { useCostumListValues } from "@/hooks/useCostumListValues";
import { costumSlugOf } from "@/lib/costumLists";
import { FormFieldTags } from "@/modules/profil/components/profile-edit/fields/FormFieldTags";
import type { FieldDescriptor, I18n } from "@/modules/formEngine";

/**
 * Widget `tags` — mots-clés. Comportement d'origine INCHANGÉ : autocomplétion sur les tags du réseau
 * (recherche SDK), sauf `searchable:false`.
 *
 * Ce qu'il gagne : `widgetProps.list` branche EN PLUS les valeurs d'une liste déclarée du costum.
 * Statique, elle arrive par `options` — le chemin ordinaire du moteur de formulaire, sans requête.
 * Dynamique (`{collection, distinct, where}`), seul le serveur peut la résoudre, et le hook s'en
 * charge : les propositions sont alors les mots-clés RÉELLEMENT employés sur ce costum, rafraîchis,
 * de sorte qu'un mot saisi librement par un premier soit proposé aux suivants.
 *
 * Sans `list`, rien ne change et aucune requête n'est faite — c'est le cas des 20 champs `tags`
 * existants du parc.
 */
export function TagsWidget<T extends FieldValues>({
  p,
}: {
  p: {
    field: FieldDescriptor;
    form: UseFormReturn<FieldValues>;
    t: (k: I18n) => string;
    options?: Array<{ value: string; label: string }>;
  };
}) {
  const { entity: carrier } = useCocolight();
  const wp = p.field.widgetProps ?? {};
  const list = wp.list as string | undefined;
  const slug = (wp.costumSlug as string | undefined) ?? costumSlugOf(carrier);

  // Propositions statiques déjà livrées par le moteur — mais SEULEMENT si ce champ déclare une liste.
  // Sans ce garde, un champ `tags` ordinaire hériterait des options d'une liste costum simplement
  // HOMONYME de lui (`GenericForm` les résout par le nom du champ), ce qui éteindrait sa recherche
  // réseau sans que rien ne le déclare.
  const statiques = list ? (p.options?.map((o) => o.value) ?? []) : [];
  const { data: resultat } = useCostumListValues(slug, list ?? null, {
    enabled: !!list && statiques.length === 0,
  });
  const dynamiques = resultat?.values ?? [];
  const suggestions = statiques.length > 0 ? statiques : dynamiques;

  return (
    <FormFieldTags
      control={p.form.control as unknown as Control<T>}
      name={p.field.name as FieldPath<T>}
      label={p.field.label ? p.t(p.field.label) : ""}
      // La recherche réseau est le défaut, SAUF si ce champ tire ses propositions d'une liste du
      // costum. Les deux ne cohabitent PAS : dès que des suggestions locales sont fournies,
      // `TagSuggestions.tsx:42` désactive `useSearchTags` et `TagsInput.tsx:57` court-circuite. Poser
      // `searchable:true` AVEC une liste ne rallumerait donc rien — le défaut reflète le vrai câblage.
      searchable={(wp.searchable as boolean) ?? !list}
      maxTags={wp.maxTags as number | undefined}
      placeholder={p.field.placeholder ? p.t(p.field.placeholder) : undefined}
      suggestions={suggestions.length > 0 ? suggestions : undefined}
    />
  );
}
