import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "site-forge";

export const BarreGestion = () => (
  <div style={{ padding: 24, minHeight: 340 }}>
    <Menubar value="contenu" className="w-fit">
      <MenubarMenu value="contenu">
        <MenubarTrigger>Contenu</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>
            Nouvel article
            <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem>Nouvelle page</MenubarItem>
          <MenubarSeparator />
          <MenubarItem>Importer depuis WordPress…</MenubarItem>
          <MenubarSeparator />
          <MenubarItem variant="destructive">Corbeille</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu value="membres">
        <MenubarTrigger>Membres</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Inviter un membre</MenubarItem>
          <MenubarItem>Gérer les rôles</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu value="parametres">
        <MenubarTrigger>Paramètres</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Apparence du site</MenubarItem>
          <MenubarItem>Langues</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  </div>
);

export const PreferencesAffichage = () => (
  <div style={{ padding: 24, minHeight: 360 }}>
    <Menubar value="affichage" className="w-fit">
      <MenubarMenu value="edition">
        <MenubarTrigger>Édition</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>Annuler</MenubarItem>
          <MenubarItem>Rétablir</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu value="affichage">
        <MenubarTrigger>Affichage</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem checked>
            Barre latérale
          </MenubarCheckboxItem>
          <MenubarCheckboxItem>Mode focus</MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarLabel>Densité</MenubarLabel>
          <MenubarRadioGroup value="confort">
            <MenubarRadioItem value="confort">Confortable</MenubarRadioItem>
            <MenubarRadioItem value="compact">Compacte</MenubarRadioItem>
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  </div>
);
