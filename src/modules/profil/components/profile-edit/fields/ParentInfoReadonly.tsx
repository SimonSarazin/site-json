import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";

interface ParentInfoReadonlyProps {
  /**
   * L'entité parente
   */
  parent: EntityTypes | null | undefined;
}

/**
 * Affichage en lecture seule du parent d'une entité
 */
export function ParentInfoReadonly({ parent }: ParentInfoReadonlyProps) {
  const t = useT("modules/profil");

  if (!parent) {
    return null;
  }

  return (
    <div className="text-sm text-muted-foreground">
      {t("ProfileEdit.fields.parent.label")}: <strong>{parent.serverData?.name}</strong>
    </div>
  );
}
