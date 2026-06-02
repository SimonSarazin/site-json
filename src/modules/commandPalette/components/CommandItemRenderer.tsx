import { CommandItem, CommandShortcut } from "@/components/ui/command";
import { resolveText } from "../lib/resolveText";
import type { Command } from "../registry/types";

export function CommandItemRenderer({
  command,
  locale,
  onSelect,
}: {
  command: Command;
  locale: string;
  onSelect: () => void;
}) {
  const label = resolveText(command.label, locale);
  const description = command.description ? resolveText(command.description, locale) : undefined;

  return (
    <CommandItem value={command.id} onSelect={onSelect}>
      {command.icon}
      <span className="flex-1 truncate">{label}</span>
      {description && (
        <span className="text-muted-foreground hidden truncate text-xs sm:inline">
          {description}
        </span>
      )}
      {command.shortcut && command.shortcut.length > 0 && (
        <CommandShortcut>{command.shortcut.join("")}</CommandShortcut>
      )}
    </CommandItem>
  );
}
