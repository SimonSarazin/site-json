import type { ModuleConfigSchema } from "@/lib/modules";

/**
 * Configuration du module AAC (Appel à Communs).
 *
 * Type: core — le module expose deux routes (`/aac` et `/aac/commun/:answerId`,
 * montées seulement si le site déclare `config.aac` — cf. `routes.tsx`) et des
 * sections encastrables (`aac-directory`, `aac-highlight`) ; chargé en eager pour
 * un rendu sans flash sur les pages publiques/profil (même raison que cagnotte,
 * dont l'AAC réutilise le contrat financier
 * `answers.<depenseStepKey>.depense[].financer[]`).
 *
 * Un « commun » = une réponse Coform (document `answers`). L'AAC se pose SUR
 * l'acquis coform / cagnotte / observatoire / search (cf. plan SOCLE).
 */
const config: ModuleConfigSchema = {
  name: "aac",
  type: "core",
  enabled: true,
};

export default config;
