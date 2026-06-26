/**
 * Agrégateur SIDE-EFFECT des modales costum dans la TABLE runtime (`costumFormRegistry`). Importé par les
 * registries de modale (ModalRegistry/EditModalRegistry) pour résoudre un costum PAR ID (clé `add-/edit-<id>`).
 *
 * Remplit la table avec : (1) les costums TS connus (leur `spec.ts` s'auto-enregistre à l'import) ; (2) les
 * costums déclarés dans la CONFIG GLOBALE `config.costumForms` (JSON) — voie « costum sans code » : un document
 * `CostumFormSchema` posé dans la config est compilé (`registerCostumForm`) en descriptor+spec, à condition que
 * les CLÉS qu'il référence (scope/payload/codecs…) soient déjà enregistrées (fns connues + codecs communs).
 *
 * Les CLÉS MÉTIER (fns) sont enregistrées par `registerSpecFns` (importé par EntityFormModal) ; les clés
 * GÉNÉRIQUES sont garanties ici par `sharedRegistrations` (importé EN PREMIER) → un costum de config qui ne
 * réutilise que des clés génériques se compile correctement même si aucun costum TS n'est chargé.
 */
import "./sharedRegistrations"; // clés génériques (codecs/coercions/geo/validators/fns partagés) AVANT registerCostumForm
import "./equipements-sportifs/spec"; // → registerCostumForm(SCHEMA) (descripteur + spec + garde)
import "./tiers-lieux/spec"; // → registerCostumForm(SCHEMA)
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
