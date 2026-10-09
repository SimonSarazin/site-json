import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { DiscussionModalShell } from "./DiscussionModal";
import { SpacePanel } from "./SpacePanel";
import type { CommentTarget, SpaceRef } from "../../types";
// La modale se charge EN DIFFÉRÉ, par son propre fichier et non par l'entrée du module : c'est
// donc à elle d'enregistrer les libellés, sans quoi ils sortiraient en clés brutes (même raison
// que `pages/DiscussionsPage`).
import "../../i18n";

export interface SpaceModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** L'élément dont on ouvre l'espace — aujourd'hui un commun. */
  readonly space: SpaceRef;
  /** Son titre, tel que la fiche l'a résolu. */
  readonly title?: string | null;
  /** Le fil ouvert et de quoi en changer : ce que rend `useSpaceLauncher`. */
  readonly target: CommentTarget | null;
  readonly onSelect: (target: CommentTarget | null) => void;
  /** L'entité qui cadre la recherche des personnes à mentionner. */
  readonly scopeEntity?: EntityTypes | null;
}

/**
 * L'espace de discussion d'un commun, en modale — ce que la fiche legacy ouvre par son bouton
 * « Commentaires ». Même coquille que la modale du panneau général ; deux colonnes au lieu de
 * trois, donc une largeur moindre : un fil n'a rien à gagner à s'étirer sur 84 rem.
 */
export function SpaceModal({ open, onOpenChange, space, title, target, onSelect, scopeEntity }: SpaceModalProps) {
  const t = useT("modules/comment");

  return (
    <DiscussionModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title ? String(t("space.titleOf", undefined, { name: title })) : String(t("space.title"))}
      description={String(t("space.description"))}
      // En `md:`, comme la largeur de la coquille qu'elle remplace : sans variante, elle perdrait
      // contre son `sm:max-w-none`.
      className="md:max-w-[min(64rem,calc(100vw-4rem))]"
    >
      {headerEnd => (
        <SpacePanel
          space={space}
          title={title}
          target={target}
          onSelect={onSelect}
          scopeEntity={scopeEntity}
          headerEnd={headerEnd}
          className="rounded-none border-0"
        />
      )}
    </DiscussionModalShell>
  );
}

// Export par défaut : c'est ce que `lazy()` de `vite-preload` sait tracer (cf. `launch.ts`).
export default SpaceModal;
