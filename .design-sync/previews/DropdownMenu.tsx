import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "site-forge";

export const MenuProfil = () => (
  <div style={{ padding: 32, minHeight: 360 }}>
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">MD</AvatarFallback>
          </Avatar>
          Marie Dupont
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuLabel>
          <div className="grid">
            <span>Marie Dupont</span>
            <span className="text-muted-foreground text-xs font-normal">
              marie.dupont@exemple.org
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User />
          Mon profil
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Mes projets</DropdownMenuItem>
        <DropdownMenuItem>Mes inscriptions</DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Paramètres du compte
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <LogOut />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const OptionsAffichage = () => (
  <div style={{ padding: 32, minHeight: 360 }}>
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Affichage
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Options de la carte</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>
          Afficher les tiers-lieux
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked>
          Afficher les événements
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>
          Afficher les projets clos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Trier par</DropdownMenuLabel>
        <DropdownMenuRadioGroup value="recent">
          <DropdownMenuRadioItem value="recent">
            Plus récents
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="alpha">
            Ordre alphabétique
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="proximite">
            Proximité
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
