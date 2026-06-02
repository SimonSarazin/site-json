import { FileTextIcon } from "lucide-react";
import type { NavItem } from "@/types/site-schema";
import type {
  Command,
  CommandReadContext,
  CommandSource,
  LocalizedText,
} from "../registry/types";

const NAV_ICON = <FileTextIcon className="h-5 w-5 opacity-70" />;

/**
 * Source de navigation : une commande par page (`config.pages`) et par item de
 * navigation interne (`config.header.nav`, récursif). Exclut `path === "#"` et
 * déduplique par path.
 */
export const navigationSource: CommandSource = {
  namespace: "core:navigation",
  groups: [{ id: "core:navigation", heading: { fr: "Navigation", en: "Navigation" }, order: 10 }],
  getCommands: (ctx: CommandReadContext): Command[] => {
    const seen = new Set<string>();
    const commands: Command[] = [];

    const add = (path: string | undefined, label: LocalizedText) => {
      if (!path || path === "#" || seen.has(path)) return;
      seen.add(path);
      commands.push({
        id: `nav:${path}`,
        label,
        keywords: [path],
        icon: NAV_ICON,
        group: "core:navigation",
        perform: (run) => {
          run.navigate(path);
          run.close();
        },
      });
    };

    for (const page of ctx.config.pages) add(page.path, page.title);

    const walk = (items: NavItem[] | undefined) => {
      for (const item of items ?? []) {
        if (item.path) add(item.path, item.label);
        if (item.children) walk(item.children);
      }
    };
    walk(ctx.config.header.nav as NavItem[]);

    return commands;
  },
};
