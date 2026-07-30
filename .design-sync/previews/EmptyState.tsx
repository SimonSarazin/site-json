import { Button, EmptyState } from "site-forge";
import { CalendarX, FolderOpen, Users } from "lucide-react";

// État vide réutilisable du module profil — `icon` attend un composant
// (LucideIcon), pas un élément JSX.

export const ParDefaut = () => (
  <EmptyState
    icon={Users}
    title="Aucun membre pour le moment"
    description="Invitez des parents et des professionnels à rejoindre votre structure pour animer la communauté."
    action={<Button>Inviter des membres</Button>}
  />
);

export const Compact = () => (
  <EmptyState
    icon={CalendarX}
    variant="compact"
    title="Aucun événement à venir"
    description="Les prochains ateliers et cafés des parents s'afficheront ici."
  />
);

export const EnCarte = () => (
  <div style={{ maxWidth: 560, margin: "0 auto" }}>
    <EmptyState
      icon={FolderOpen}
      variant="card"
      title="Aucun projet publié"
      description="Partagez un premier projet pour le rendre visible auprès du réseau."
      action={<Button variant="outline">Créer un projet</Button>}
    />
  </div>
);
