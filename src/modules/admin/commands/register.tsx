/**
 * Source de commandes du module admin : « Administration » dans la palette Ctrl+K.
 * Self-register (import side-effect depuis `commandPalette/sources/bootstrap.ts`, pattern profil).
 * Visible UNIQUEMENT si l'utilisateur passe le gate de la page /admin (isAdminEntryVisible :
 * admin activé en config + niveau >= admin.access.min) — jamais de lien vers une page qui refusera.
 */
import { ShieldCheck } from "lucide-react";

import { registerCommandSource } from "@/modules/commandPalette";
import type { Command, CommandReadContext } from "@/modules/commandPalette";

import { isAdminEntryVisible } from "../lib/adminEntry";

const ADMIN_ICON = <ShieldCheck className="h-5 w-5 opacity-70" />;

registerCommandSource({
  namespace: "admin:entry",
  groups: [{ id: "admin:entry", heading: { fr: "Administration", en: "Administration" }, order: 20 }],
  getCommands: (ctx: CommandReadContext): Command[] => {
    if (!isAdminEntryVisible(ctx.config, ctx.me, ctx.entity)) return [];
    const commands: Command[] = [
      {
        id: "nav:/admin",
        label: { fr: "Administration", en: "Administration" },
        description: { fr: "Tableau de bord d'administration du site", en: "Site administration dashboard" },
        keywords: ["admin", "administration", "gestion", "back-office"],
        icon: ADMIN_ICON,
        group: "admin:entry",
        perform: (run) => {
          run.navigate("/admin");
          run.close();
        },
      },
    ];
    // Un raccourci par onglet configuré (deep-link /admin/:section), même gate.
    for (const tab of ctx.config.admin?.tabs ?? []) {
      commands.push({
        id: `nav:/admin/${tab.id}`,
        label: tab.label ?? { fr: tab.id },
        description: { fr: "Administration", en: "Administration" },
        keywords: ["admin", tab.id],
        icon: ADMIN_ICON,
        group: "admin:entry",
        perform: (run) => {
          run.navigate(`/admin/${tab.id}`);
          run.close();
        },
      });
    }
    return commands;
  },
});
