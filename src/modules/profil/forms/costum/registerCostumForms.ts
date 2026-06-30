/**
 * Agrégateur SIDE-EFFECT des modales costum dans la TABLE runtime (`costumFormRegistry`). Importé par les
 * registries de modale (ModalRegistry/EditModalRegistry) pour résoudre un costum PAR ID (`add-/edit-<id>`).
 *
 * « CONFIG FAIT FOI » : au runtime, les costums sont chargés UNIQUEMENT depuis la config globale
 * `config.costumForms` (JSON, par déploiement) → `registerCostumForm(doc)` (compile + garde des clés +
 * enregistre descripteur + spec). PLUS AUCUN schéma TS hardcodé chargé ici (les `<costum>/spec.ts` ne servent
 * plus qu'aux tests). `registerSpecFns` (importé EN PREMIER) garantit les CLÉS — génériques
 * (`sharedRegistrations`) ET métier (`<costum>/fns`) — pour que la garde de `registerCostumForm` les trouve.
 */
import "../registerSpecFns"; // clés génériques + métier (sharedRegistrations + fns) AVANT le chargement config
import { registerCostumForm, getCostumModalSpec } from "./costumFormRegistry";
import type { CostumFormSchema } from "./compileCostumSchema";

// Costums de la config globale (client-side : `window.__CONFIG__.costumForms`). NB : zod permissif côté
// site-schema (validation de structure déléguée au compilateur/registre) — durcissement zod = chantier à part.
const configForms = typeof window !== "undefined"
  ? (window as { __CONFIG__?: { costumForms?: Record<string, CostumFormSchema> } }).__CONFIG__?.costumForms
  : undefined;
if (configForms) {
  for (const schema of Object.values(configForms)) {
    try {
      registerCostumForm(schema);
    } catch (e) {
      console.warn("[costumForms] échec d'enregistrement d'un costum de config", e);
    }
  }
}

export { getCostumModalSpec };
