import { Suspense, useState } from "react";
import { lazy } from "vite-preload";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import type { ListConf } from "@/modules/search/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
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

// Détail d'entité (itemAction "preview") — lazy : le chunk du module search
// n'est chargé qu'au premier clic sur un résultat configuré en preview
// (pattern AuthModalLazy : lazy() vite-preload + montage conditionnel).
const SwitchDetailsModeLazy = lazy(() =>
  import("@/modules/search/components/SwitchDetailsMode").then((m) => ({
    default: m.SwitchDetailsMode,
  }))
);

interface EntityPreviewState {
  item: SearchEntity;
  detailsMode?: "drawer" | "dialog";
  preview?: ListConf["preview"];
  list?: ListConf;
}

export function CommandPalette() {
  useLoadNamespace("modules/commandPalette");
  const t = useT("modules/commandPalette");
  const { config } = useSite();
  const { currentLocale } = useLocalization();
  const { open, setOpen } = useCommandPalette();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const { groups, loading } = useCommands(query, open);
  const baseRun = useCommandRunContext();

  // itemAction "preview" : l'état vit ICI (la palette reste montée après
  // close()) — le détail s'ouvre donc après la fermeture de la palette.
  const [entityPreview, setEntityPreview] = useState<EntityPreviewState | null>(null);
  const run = {
    ...baseRun,
    openEntityPreview: (item: SearchEntity, opts: { detailsMode?: "drawer" | "dialog"; preview?: ListConf["preview"]; list?: ListConf }) =>
      setEntityPreview({ item, detailsMode: opts.detailsMode, preview: opts.preview, list: opts.list }),
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const placeholder =
    resolveText(config.commandPalette?.placeholder, currentLocale) || t("placeholder");
  const hasResults = groups.length > 0;

  // Corps cmdk partagé desktop / mobile. En mobile la liste remplit la hauteur
  // dispo (le plafond `max-h-[300px]` du `CommandList` est levé).
  const body = (
    <Command shouldFilter={false} className={cn(CMDK_CLASS, isMobile && "h-full")}>
      <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
      <CommandList className={isMobile ? "max-h-none flex-1" : undefined}>
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
  );

  // Mobile : feuille plein écran (input en haut, liste qui remplit, clavier en
  // bas). Desktop : modale centrée.
  const palette = isMobile ? (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="top" className="h-[100dvh] gap-0 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("dialogTitle")}</SheetTitle>
          <SheetDescription>{t("dialogDescription")}</SheetDescription>
        </SheetHeader>
        {body}
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{t("dialogTitle")}</DialogTitle>
        <DialogDescription>{t("dialogDescription")}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        {body}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {palette}
      {/* Détail d'entité (itemAction "preview") — réutilise le conteneur +
          preview du module search, comme le rowAction de l'observatoire. */}
      {entityPreview && (
        <Suspense fallback={null}>
          <SwitchDetailsModeLazy
            openDetails={!!entityPreview}
            setOpenDetails={(open) => {
              if (!open) setEntityPreview(null);
            }}
            item={entityPreview.item}
            // `card`/`preview` explicites si fournis ; sinon SwitchDetailsMode les dérive de `list`
            // (`list.card.detailsMode` / `list.preview`). `list` porte le bloc config-driven (resource/
            // testimonial) que lisent PreviewResource/PreviewTestimonial.
            card={entityPreview.detailsMode ? { detailsMode: entityPreview.detailsMode } : undefined}
            preview={entityPreview.preview}
            list={entityPreview.list}
          />
        </Suspense>
      )}
    </>
  );
}
