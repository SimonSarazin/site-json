import { EntityEmptyState } from "site-forge";
import { CalendarX, Plus, Users } from "lucide-react";

// Variante d'état vide du module profil — ici `icon` est un ReactNode
// (élément), et `action` un objet {label, onClick, icon}.

export const Simple = () => (
  <EntityEmptyState
    icon={<CalendarX size={40} style={{ margin: "0 auto" }} />}
    title="Aucun événement programmé"
    description="Cette structure n'a pas encore publié d'événement."
  />
);

export const AvecAction = () => (
  <EntityEmptyState
    icon={<Users size={40} style={{ margin: "0 auto" }} />}
    title="Aucun membre dans cette organisation"
    description="Commencez par inviter les parents et bénévoles qui font vivre la structure."
    action={{
      label: "Inviter un membre",
      onClick: () => {},
      icon: <Plus size={16} style={{ marginRight: 6 }} />,
    }}
  />
);
