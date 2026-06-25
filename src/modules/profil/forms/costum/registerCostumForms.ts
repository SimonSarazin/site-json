/**
 * Agrégateur SIDE-EFFECT des modales costum dans la TABLE runtime (`costumFormRegistry`). Importé par les
 * registries de modale (ModalRegistry/EditModalRegistry) pour résoudre un costum PAR ID (clé `add-/edit-<id>`).
 *
 * Remplit la table avec : (1) les costums TS connus (leur `spec.ts` s'auto-enregistre à l'import) ; (2) les
 * costums déclarés dans la CONFIG GLOBALE `config.costumForms` (JSON) — voie « costum sans code » : un document
 * `CostumFormSchema` posé dans la config est compilé (`registerCostumForm`) en descriptor+spec, à condition que
 * les CLÉS qu'il référence (scope/payload/codecs…) soient déjà enregistrées (fns connues + codecs communs).
 *
 * Les CLÉS (fns) sont, elles, enregistrées par `registerSpecFns` (importé par EntityFormModal). Ici on ne
 * remplit que la table des SPECS.
 */
import "./equipements-sportifs/spec"; // s'auto-enregistre (registerCostumModalSpec)
import "./tiers-lieux/spec"; // s'auto-enregistre
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
