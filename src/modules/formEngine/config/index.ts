/**
 * Couche config-driven du moteur de formulaire (cf. doc/formulaire-config-driven.md).
 * P0 : schéma `JsonFormConfig` (zod) + adaptateur pur `configToDescriptor`.
 */
export { JsonFormConfigSchema, PredicateJson } from "./schema";
export type { JsonFormConfig, JsonFormFieldConfig, JsonFormLabel } from "./schema";
export { configToDescriptor, defaultWidgetForType, INPUT_TYPE_TO_WIDGET, type ConfigToDescriptorOpts } from "./configToDescriptor";
export { formDescriptorToConfig } from "./formDescriptorToConfig";
export { descriptorToTsSource } from "./descriptorToTs";
export { costumToConfig, descriptorToConfig, type CostumExtensionsArtifact } from "./costumToConfig";
