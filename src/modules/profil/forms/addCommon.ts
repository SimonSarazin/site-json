/**
 * Briques communes aux descripteurs « Add <entité> » (poi/project/organization, + futur event).
 * Mutualise les champs partagés (nom, description courte, url, tags, adresse), la section
 * localisation et la validation cross-champ addressValid — pour ne pas redupliquer.
 * Clés i18n identiques aux anciens FormField* (ProfileEdit.fields.*) → parité visuelle.
 */
import type { FieldDescriptor, FormValues, SectionDescriptor } from "@/modules/formEngine";

/** Clé i18n d'un champ ProfileEdit. */
export const PE = (k: string) => `ProfileEdit.fields.${k}`;

/** Champ « Nom » (requis). `extra` permet d'ajouter une règle (ex. minLength 3 pour orga). */
export const nameField = (extra: Partial<FieldDescriptor> = {}): FieldDescriptor => ({
  name: "name", type: "string", widget: "text", required: true,
  label: PE("name.label"), placeholder: PE("name.placeholder"), info: PE("name.description"), ...extra,
});

export const shortDescriptionField: FieldDescriptor = {
  name: "shortDescription", type: "string", widget: "textarea",
  label: PE("shortDescription.label"), placeholder: PE("shortDescription.placeholder"), info: PE("shortDescription.description"),
};

/** URL optionnelle (validée si non vide via la règle url ; vide accepté = parité urlOrEmptySchema). */
export const urlField: FieldDescriptor = {
  name: "url", type: "string", widget: "text", widgetProps: { inputType: "url" }, rules: { url: true },
  label: PE("url.label"), placeholder: PE("url.placeholder"), info: PE("url.description"),
};

export const tagsField: FieldDescriptor = {
  name: "tags", type: "array", widget: "tags", label: PE("tags.label"), widgetProps: { extendedTexts: true },
};

/** Bloc adresse complet (EditLocationTab via le widget location). Label ignoré par le widget. */
export const addressField: FieldDescriptor = {
  name: "address", type: "object", widget: "location", label: "",
};

/** Section « Localisation » (onglet) : adresse + `addressLocality` (rendu nul) pour le badge d'onglet. */
export const locationSection: SectionDescriptor = {
  id: "location", label: "AddEntity.tabs.location",
  groups: [{ columns: 1, fields: ["address", "addressLocality"] }],
};

/**
 * Validation cross-champ addressValid : adresse saisie sans ville sélectionnée (localityId) →
 * erreur sur `addressLocality` (affichée inline par EditLocationTab + allume le badge de l'onglet).
 * Évite l'abandon SILENCIEUX de l'adresse par buildAddressFromForm (amélioration vs legacy).
 */
export const addressValidate = (v: FormValues): Array<{ path: string; message: string }> => {
  const hasAddr = Boolean(v.addressCountry || v.addressLocality || v.postalCode || v.streetAddress);
  return hasAddr && !v.localityId ? [{ path: "addressLocality", message: "validation.addressLocality" }] : [];
};
