import { CheckCheck, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/useT';
import { useLoadNamespace } from '@/hooks/useLoadNamespace';

type MilestoneManageActionsProps = {
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onRestore?: () => void;
  isClosed?: boolean;
  isDeleting?: boolean;
  isClosing?: boolean;
  isRestoring?: boolean;
  closeDisabled?: boolean;
  disabled?: boolean;
  /** UX flag (legacy) — cacher complètement le bouton edit dans certains contextes. Défaut true. */
  showEdit?: boolean;
  /** UX flag (legacy) — cacher complètement le bouton delete. Défaut true. */
  showDelete?: boolean;
  /** Permission runtime — l'utilisateur a-t-il le droit d'éditer ce milestone ? Défaut true. */
  canEdit?: boolean;
  /** Permission runtime — droit de clôturer ce milestone (statut open). Défaut true. */
  canClose?: boolean;
  /** Permission runtime — droit de restaurer ce milestone (statut close). Défaut true. */
  canRestore?: boolean;
  /** Permission runtime — droit de supprimer ce milestone. Défaut true. */
  canDelete?: boolean;
};

export function MilestoneManageActions({
  onEdit,
  onDelete,
  onClose,
  onRestore,
  isClosed = false,
  isDeleting = false,
  isClosing = false,
  isRestoring = false,
  closeDisabled = false,
  disabled = false,
  showEdit = true,
  showDelete = true,
  canEdit = true,
  canClose = true,
  canRestore = true,
  canDelete = true,
}: MilestoneManageActionsProps) {
  useLoadNamespace('modules/cagnotte');
  const t = useT('modules/cagnotte');
  return (
    <>
      {showEdit && canEdit && !isClosed ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          disabled={disabled || isDeleting || isClosing || isRestoring}
        >
          <Pencil className="h-3 w-3" /> {t('MilestoneManageActions.edit')}
        </Button>
      ) : null}

      {isClosed && canRestore ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-success"
          disabled={disabled || isDeleting || isClosing || isRestoring || typeof onRestore !== 'function'}
          onClick={onRestore}
        >
          {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          {t('MilestoneManageActions.restore')}
        </Button>
      ) : null}

      {!isClosed && canClose ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-success"
          disabled={disabled || isDeleting || isClosing || isRestoring || closeDisabled}
          onClick={onClose}
        >
          {isClosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
          {t('MilestoneManageActions.close')}
        </Button>
      ) : null}

      {showDelete && canDelete && !isClosed ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-destructive"
          disabled={disabled || isDeleting || isClosing || isRestoring}
          onClick={onDelete}
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          {t('MilestoneManageActions.delete')}
        </Button>
      ) : null}
    </>
  );
}
