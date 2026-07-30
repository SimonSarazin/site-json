import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
} from "site-forge";
import {
  CalendarDays,
  Home,
  MapPin,
  MessagesSquare,
  Settings,
  Users,
} from "lucide-react";

// collapsible="none" : rend un simple flex-col (pas de container fixed ni de
// Sheet mobile) → capturable dans une cellule. Le wrapper SidebarProvider pose
// min-h-svh → surchargé en min-h-0 + hauteur explicite.

export const NavigationComplete = () => (
  <SidebarProvider className="min-h-0 h-[460px] overflow-hidden rounded-lg border">
    <Sidebar collapsible="none" className="h-full border-r">
      <SidebarHeader>
        <div className="px-2 pt-1 text-sm font-semibold">Réseau Parentalité 66</div>
        <SidebarInput placeholder="Rechercher…" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Animation du réseau</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <Home />
                  <span>Tableau de bord</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <CalendarDays />
                  <span>Agenda</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>12</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <MessagesSquare />
                  <span>Messages</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Users />
                  <span>Membres</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Annuaire</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <MapPin />
                  <span>Lieux d'accueil</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton isActive>
                      <span>Perpignan Méditerranée</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>
                      <span>Vallespir</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton>
                      <span>Conflent-Canigó</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings />
              <span>Paramètres</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="p-4">
      <h2 className="text-lg font-semibold">Tableau de bord</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Zone de contenu principale (SidebarInset), à droite de la barre latérale.
      </p>
      <div className="mt-4 h-24 rounded-lg border border-dashed" />
    </SidebarInset>
  </SidebarProvider>
);
