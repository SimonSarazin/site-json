import { HomeIcon, LanguagesIcon, LogOutIcon, SunMoonIcon } from "lucide-react";
import type { Command, CommandReadContext, CommandSource } from "../registry/types";

const ICON_CLASS = "h-5 w-5 opacity-70";

/**
 * Actions globales : thème, langues disponibles (hors locale courante),
 * accueil, déconnexion (si connecté). Les capacités impératives proviennent du
 * `CommandRunContext` passé à `perform`.
 */
export const actionsSource: CommandSource = {
  namespace: "core:actions",
  groups: [{ id: "core:actions", heading: { fr: "Actions", en: "Actions" }, order: 90 }],
  getCommands: (ctx: CommandReadContext): Command[] => {
    const commands: Command[] = [];

    commands.push({
      id: "action:toggle-theme",
      label: { fr: "Basculer le thème (clair / sombre)", en: "Toggle theme (light / dark)" },
      keywords: ["theme", "thème", "dark", "light", "sombre", "clair", "appearance", "apparence"],
      icon: <SunMoonIcon className={ICON_CLASS} />,
      group: "core:actions",
      perform: (run) => {
        run.setTheme(run.theme === "dark" ? "light" : "dark");
        run.close();
      },
    });

    for (const lng of ctx.config.meta.languages) {
      if (lng === ctx.locale) continue;
      commands.push({
        id: `action:lang:${lng}`,
        label: { fr: `Passer en ${lng.toUpperCase()}`, en: `Switch to ${lng.toUpperCase()}` },
        keywords: ["language", "langue", "locale", "traduction", lng],
        icon: <LanguagesIcon className={ICON_CLASS} />,
        group: "core:actions",
        perform: (run) => {
          run.setLocale(lng);
          run.close();
        },
      });
    }

    commands.push({
      id: "action:home",
      label: { fr: "Aller à l'accueil", en: "Go to home" },
      keywords: ["home", "accueil", "start", "début"],
      icon: <HomeIcon className={ICON_CLASS} />,
      group: "core:actions",
      perform: (run) => {
        run.navigate("/");
        run.close();
      },
    });

    if (ctx.me) {
      commands.push({
        id: "action:logout",
        label: { fr: "Se déconnecter", en: "Log out" },
        keywords: ["logout", "déconnexion", "deconnexion", "signout", "quitter"],
        icon: <LogOutIcon className={ICON_CLASS} />,
        group: "core:actions",
        perform: (run) => {
          run.api?.logout();
          run.navigate("/");
          run.close();
        },
      });
    }

    return commands;
  },
};
