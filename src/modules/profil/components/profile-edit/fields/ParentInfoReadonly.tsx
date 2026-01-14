import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";

interface ParentInfoReadonlyProps {
  /**
   * L'entité parente
   */
  parent: EntityTypes | null | undefined;
  /**
   * Clé de traduction pour le label (par défaut: ProfileEdit.fields.parent.label)
   */
  labelKey?: string;
}

/**
 * Affichage en lecture seule du parent d'une entité
 */
export function ParentInfoReadonly({ parent, labelKey = "ProfileEdit.fields.parent.label" }: ParentInfoReadonlyProps) {
  const t = useT("modules/profil");

  if (!parent) {
    return null;
  }

  return (
    <div className="text-sm text-muted-foreground">
      {t(labelKey)}: <strong className="text-primary">{parent.serverData?.name}</strong>
    </div>
  );
}
