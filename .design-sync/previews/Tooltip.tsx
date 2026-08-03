import { Heart, Search, Share2 } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "site-forge";

export const AideIcone = () => (
  <div style={{ padding: "96px 32px 48px", display: "flex", gap: 12 }}>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Ajouter aux favoris">
          <Heart />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Ajouter aux favoris</TooltipContent>
    </Tooltip>
    <Button variant="outline" size="icon" aria-label="Partager">
      <Share2 />
    </Button>
  </div>
);

export const RaccourciClavier = () => (
  <div style={{ padding: "32px 32px 96px" }}>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline">
          <Search />
          Rechercher
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Ouvrir la recherche — Ctrl + K
      </TooltipContent>
    </Tooltip>
  </div>
);
