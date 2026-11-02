import { EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionMenu, type ActionMenuItem } from "@/modules/kanban/components/ui/ActionMenu";

export interface ColumnMenuProps {
  columnTitle: string;
  /** Nom accessible du menu ; par défaut « Actions de la colonne {{title}} ». */
  label?: string;
  /** Masquer la colonne sur ce poste (préférence locale, DESIGN §6.3 de co-kanban). */
  onHide?: () => void;
  /** Items propres à la vue (vue Rôles : supprimer le rôle), dans leur propre groupe. */
  extraItems?: readonly ActionMenuItem[];
  className?: string;
}

/**
 * Menu « ⋯ » d'une colonne, repris de co-kanban et réduit à un tableau relié : on n'y renomme
 * ni ne supprime une colonne (ce sont les statuts de Communecter). Il porte ce que tout le monde
 * peut faire, masquer la colonne chez soi, et les gestes de la vue (`extraItems`) dans leur
 * groupe. Sans aucun item, il ne se rend pas.
 */
export function ColumnMenu({ columnTitle, label: labelOverride, onHide, extraItems = [], className }: ColumnMenuProps) {
  const { t } = useTranslation("modules/kanban");
  const label = labelOverride ?? t("column.menu.label", { title: columnTitle });
  const everyday: ActionMenuItem[] = onHide ? [{ key: "hide", icon: EyeOff, label: t("column.menu.hide"), onSelect: onHide }] : [];
  return (
    <ActionMenu
      label={label}
      className={className}
      sections={[
        { key: "everyday", items: everyday },
        { key: "view", items: extraItems },
      ]}
    />
  );
}
