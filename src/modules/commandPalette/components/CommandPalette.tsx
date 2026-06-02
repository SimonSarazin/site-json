import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useSite } from "@/hooks/useSite";
import { useLocalization } from "@/hooks/useLocalization";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { useCommands } from "../hooks/useCommands";
import { useCommandRunContext } from "../hooks/useCommandRunContext";
import { CommandItemRenderer } from "./CommandItemRenderer";
import { resolveText } from "../lib/resolveText";
// Enregistre les sources core + profil (side-effect, idempotent).
import "../sources/bootstrap";

// Reprend la classe utilitaire du `CommandDialog` shadcn pour le style cmdk.
// On ré-implémente le wrapper (au lieu d'utiliser `CommandDialog`) afin de
// passer `shouldFilter={false}` : on filtre nous-mêmes (cf. `useCommands`),
// ce qui gère proprement le mélange sources synchrones / asynchrones backend.
const CMDK_CLASS =
  "[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5";

export function CommandPalette() {
  useLoadNamespace("modules/commandPalette");
  const t = useT("modules/commandPalette");
  const { config } = useSite();
  const { currentLocale } = useLocalization();
  const { open, setOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const { groups, loading } = useCommands(query, open);
  const run = useCommandRunContext();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const placeholder =
    resolveText(config.commandPalette?.placeholder, currentLocale) || t("placeholder");
  const hasResults = groups.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
        <DialogDescription>{t("dialogDescription")}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <Command shouldFilter={false} className={cn(CMDK_CLASS)}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {!loading && !hasResults && <CommandEmpty>{t("empty")}</CommandEmpty>}
            {groups.map(({ group, commands }) => (
              <CommandGroup key={group.id} heading={resolveText(group.heading, currentLocale)}>
                {commands.map((cmd) => (
                  <CommandItemRenderer
                    key={cmd.id}
                    command={cmd}
                    locale={currentLocale}
                    onSelect={() => {
                      void cmd.perform(run);
                    }}
                  />
                ))}
              </CommandGroup>
            ))}
            {loading && (
              <div className="text-muted-foreground py-6 text-center text-sm">{t("loading")}</div>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
