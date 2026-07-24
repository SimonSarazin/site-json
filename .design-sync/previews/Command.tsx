import {
  CalendarDays,
  Home,
  MapPin,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "site-forge";

export const PaletteRecherche = () => (
  <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
    <Command className="w-[440px] rounded-lg border shadow-md">
      <CommandInput placeholder="Rechercher une page, un membre, une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>
            <Home />
            Accueil
          </CommandItem>
          <CommandItem>
            <CalendarDays />
            Agenda
            <CommandShortcut>⌘A</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <MapPin />
            Carte des acteurs
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem>
            <Plus />
            Créer un événement
          </CommandItem>
          <CommandItem>
            <UserPlus />
            Inviter un membre
          </CommandItem>
          <CommandItem>
            <Users />
            Rejoindre un projet
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);

export const AucunResultat = () => (
  <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
    <Command className="w-[440px] rounded-lg border shadow-md">
      <CommandInput value="xylophone" placeholder="Rechercher…" />
      <CommandList>
        <CommandEmpty>
          Aucun résultat pour cette recherche. Essayez un autre mot-clé.
        </CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem>Accueil</CommandItem>
          <CommandItem>Agenda</CommandItem>
          <CommandItem>Annuaire</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </div>
);
