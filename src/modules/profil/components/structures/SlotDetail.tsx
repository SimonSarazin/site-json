import { Suspense } from "react";
import type { SearchEntity } from "@communecter/cocolight-api-client";

import { SwitchDetailsMode } from "@/modules/search/components/SwitchDetailsMode";
import type { ListConf } from "@/modules/search/schema";

const CARD_DIALOG: ListConf["card"] = { detailsMode: "dialog" };
/** Lecture seule : l'onglet n'ouvre l'édition que sur `answers.editButton`. */
const PREVIEW_READ_ONLY: ListConf["preview"] = { type: "coform-answer" };
/**
 * « Modifier » dans le détail, pour qui gère le créneau ou l'a déposé (`canEditCoformAnswer`). Le
 * statut reste hors de la main d'un non-admin : `isAdminOnly`, il est retiré du formulaire et le
 * serveur garde sa valeur en base.
 */
const PREVIEW_EDITABLE: ListConf["preview"] = { type: "coform-answer", editButton: true };

interface SlotDetailProps {
  item: SearchEntity;
  editable: boolean;
  /** Fermeture du détail — après un enregistrement aussi (`PreviewCoformAnswer` le ferme). */
  onClose: () => void;
}

/**
 * Détail d'un créneau ouvert depuis l'onglet « Structures », en boîte de dialogue. Suspense LOCAL :
 * le détail est chargé à la demande ; sans lui, le premier clic suspendait jusqu'à la frontière du
 * profil, qui disparaissait derrière un spinner.
 */
export function SlotDetail({ item, editable, onClose }: SlotDetailProps) {
  return (
    <Suspense fallback={null}>
      <SwitchDetailsMode
        openDetails
        setOpenDetails={(open) => {
          if (!open) onClose();
        }}
        item={item}
        card={CARD_DIALOG}
        preview={editable ? PREVIEW_EDITABLE : PREVIEW_READ_ONLY}
      />
    </Suspense>
  );
}
