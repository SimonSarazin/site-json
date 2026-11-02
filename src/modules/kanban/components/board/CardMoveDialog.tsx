import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "@/modules/kanban/components/ui/fieldStyles";
import type { Card, Column } from "@/modules/kanban/types";
import { currentCardSlotIndex, listCardDropSlots, resolveColumnTitle, slotToRequest, type CardMoveRequest, type CardMoveTarget, type CardOrder } from "./kanbanDnd";

/** Ce que la boîte « Déplacer vers… » lit d'une colonne. */
export type MoveColumn = Pick<Column, "_id" | "title" | "titleKey">;

interface CardMoveDialogProps {
  card: Card;
  currentColumnId: string;
  columns: readonly MoveColumn[];
  getCard: (cardId: string) => Card | undefined;
  cardOrder: CardOrder;
  canonical: boolean;
  /** Ce que désignent les colonnes : un statut, ou un jalon dans la vue Jalons (mots de la boîte). */
  moveTarget?: CardMoveTarget;
  onClose: () => void;
  onMove: (intent: CardMoveRequest) => void;
  /** Où rendre le focus à la fermeture : la boîte s'ouvre depuis un item de menu, déjà retiré. */
  returnFocus: () => HTMLElement | null;
}

/**
 * ALTERNATIVE CLAVIER explicite au glisser-déposer.
 *
 * Deux listes déroulantes NATIVES (colonne, position) et un bouton, sur les MÊMES helpers purs
 * que le glisser. Sur un tableau relié, la position n'existe pas (ordre canonique) : la liste
 * disparaît et la boîte dit pourquoi, plutôt que de proposer un choix que le serveur ignorerait.
 */
export default function CardMoveDialog({ card, currentColumnId, columns, getCard, cardOrder, canonical, moveTarget = "column", onClose, onMove, returnFocus }: CardMoveDialogProps) {
  const { t } = useTranslation("modules/kanban");
  const columnFieldId = useId();
  const positionFieldId = useId();

  const [columnId, setColumnId] = useState(currentColumnId);
  const [slotIndex, setSlotIndex] = useState(() => currentCardSlotIndex(cardOrder, currentColumnId, card._id));

  const slots = listCardDropSlots(cardOrder, columnId, card._id);

  function handleColumnChange(nextColumnId: string) {
    setColumnId(nextColumnId);
    // Changer de colonne change le nombre de positions : conserver l'index courant pointerait
    // à côté, voire hors de la liste.
    setSlotIndex(currentCardSlotIndex(cardOrder, nextColumnId, card._id));
  }

  function handleSubmit() {
    if (canonical) {
      // Le serveur range la carte à son rang canonique : seule la colonne part.
      if (columnId !== currentColumnId) onMove({ cardId: card._id, columnId });
      onClose();
      return;
    }
    const slot = slots[slotIndex] ?? slots[slots.length - 1];
    if (slot === undefined) return;
    onMove(slotToRequest(card._id, columnId, slot));
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = returnFocus();
          if (target?.isConnected) target.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("card.move.title")}</DialogTitle>
          <DialogDescription className="break-words">{card.title}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={columnFieldId}>{moveTarget === "milestone" ? t("card.move.milestone") : t("card.move.column")}</Label>
            <select id={columnFieldId} value={columnId} onChange={(event) => handleColumnChange(event.target.value)} className={SELECT_CLASS}>
              {columns.map((column) => (
                <option key={column._id} value={column._id}>
                  {resolveColumnTitle(column, t)}
                </option>
              ))}
            </select>
          </div>

          {canonical ? (
            <p className="text-sm text-muted-foreground">{moveTarget === "milestone" ? t("card.move.milestoneHint") : t("card.move.canonicalHint")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor={positionFieldId}>{t("card.move.position")}</Label>
              <select id={positionFieldId} value={slotIndex} onChange={(event) => setSlotIndex(Number(event.target.value))} className={SELECT_CLASS}>
                {slots.map((slot) => (
                  <option key={slot.index} value={slot.index}>
                    {slot.previousCardId === null ? t("card.move.top") : t("card.move.after", { title: getCard(slot.previousCardId)?.title ?? slot.previousCardId })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!canonical && slots.length === 0}>
              {t("card.move.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
