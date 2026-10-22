// Charge le bundle FR/EN du module (side-effect : addResourceBundle "modules/ampli").
// C'est `module.config.ts` — et non `index.ts` — qui est glob-importé en eager par
// `discoverModules()` (src/lib/modules.ts). Sans cet import, aucun code du module ne
// tire `index.ts` et le namespace n'est jamais enregistré : `useLoadNamespace` ne peut
// pas le rattraper (i18next n'a pas de backend) → toutes les clés s'affichent brutes.
import "./i18n";

import type { ModuleConfigSchema } from "@/lib/modules";

const config: ModuleConfigSchema = {
    name: "ampli",
    type: "core",
    enabled: true
};

export default config;