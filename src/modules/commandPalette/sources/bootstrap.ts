/**
 * Enregistrement des sources de commandes du core + des modules core.
 * Importé en side-effect par `CommandPalette` (et donc exécuté une seule fois
 * au chargement de l'app). Un module OPTIONAL ne doit PAS être importé ici
 * (cela casserait son lazy-loading) — il s'auto-enregistrerait dans son loader.
 */
import { registerCommandSource } from "../registry/registry";
import { navigationSource } from "./navigationSource";
import { actionsSource } from "./actionsSource";
// Source du module profil (recherche d'entités backend) — self-register.
import "@/modules/profil/commands/register";
// Source du module admin (entrée « Administration », gate d'accès) — self-register.
import "@/modules/admin/commands/register";
// Source du module blog (recherche d'articles → /blog/:slug) — self-register (blog = module core).
import "@/modules/blog/commands/register";

registerCommandSource(navigationSource);
registerCommandSource(actionsSource);
