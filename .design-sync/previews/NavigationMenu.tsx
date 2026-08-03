import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "site-forge";

export const NavigationPrincipale = () => (
  <div
    style={{
      padding: "24px 24px 0",
      minHeight: 400,
      display: "flex",
      justifyContent: "center",
      // flex-start : sinon le root (flex-1) s'étire sur toute la hauteur et
      // le viewport (absolute top-full) se détache de la barre.
      alignItems: "flex-start",
    }}
  >
    <NavigationMenu value="decouvrir">
      <NavigationMenuList>
        <NavigationMenuItem value="decouvrir">
          <NavigationMenuTrigger>Découvrir</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[420px] gap-2 p-2 md:grid-cols-2">
              <li>
                <NavigationMenuLink asChild>
                  <a href="#">
                    <div className="text-sm font-medium">Annuaire</div>
                    <div className="text-muted-foreground text-xs">
                      Associations, tiers-lieux et collectifs du territoire
                    </div>
                  </a>
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink asChild>
                  <a href="#">
                    <div className="text-sm font-medium">Agenda</div>
                    <div className="text-muted-foreground text-xs">
                      Ateliers, événements et rencontres à venir
                    </div>
                  </a>
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink asChild>
                  <a href="#">
                    <div className="text-sm font-medium">Carte</div>
                    <div className="text-muted-foreground text-xs">
                      Explorer les acteurs près de chez vous
                    </div>
                  </a>
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink asChild>
                  <a href="#">
                    <div className="text-sm font-medium">Actualités</div>
                    <div className="text-muted-foreground text-xs">
                      La vie du réseau au fil des semaines
                    </div>
                  </a>
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem value="participer">
          <NavigationMenuTrigger>Participer</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[300px] gap-2 p-2">
              <li>
                <NavigationMenuLink asChild>
                  <a href="#">Proposer un événement</a>
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <a href="#">Contact</a>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  </div>
);

export const LiensSimples = () => (
  <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <a href="#">Accueil</a>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <a href="#">Annuaire</a>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <a href="#">Agenda</a>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <a href="#">Contact</a>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  </div>
);
