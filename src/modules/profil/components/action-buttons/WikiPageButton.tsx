import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/hooks/useT";
import { isEvent } from "@/lib/getTypedEntity";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useProfilPermissions } from "../../hooks/useProfilPermissions";
import { useCreateEventWikiPage, useEventWikiPlan } from "../../actions/mutations/wikiPage";

interface WikiPageButtonProps {
  entity: EntityTypes | null;
  compactLabel?: boolean;
}

/**
 * « Page wiki » : crée sur le wiki (movilab.org) la page qui documente la rencontre et en garde le
 * lien dans la description de l'événement. Réservé aux événements, même droit que l'édition.
 * Absent si le serveur n'a pas de wiki configuré.
 */
export function WikiPageButton({ entity, compactLabel = false }: WikiPageButtonProps) {
  const t = useT("modules/profil");
  const { canEditProfile } = useProfilPermissions(entity);
  const event = entity && isEvent(entity) ? entity : null;
  const { data: plan } = useEventWikiPlan(event, canEditProfile);
  const mutation = useCreateEventWikiPage(event, plan);

  if (!event || !canEditProfile || !plan) return null;

  const description = typeof event.serverData?.description === "string" ? event.serverData.description : "";
  const exists = description.includes(plan.url);

  return (
    <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      <BookOpen />
      <span className={compactLabel ? "hidden sm:inline" : undefined}>
        {t(exists ? "ProfileTemplateDefault.openWikiPage" : "ProfileTemplateDefault.createWikiPage")}
      </span>
    </Button>
  );
}
