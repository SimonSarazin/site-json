import type { ModuleConfigSchema } from "@/lib/modules";
// Enregistre le bundle i18n du module (side-effect).
import "./i18n";

const config: ModuleConfigSchema = {
  name: "commandPalette",
  type: "core",
  enabled: true,
};

export default config;
