import { CheckCheck, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

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
  showEdit?: boolean;
  showDelete?: boolean;
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
}: MilestoneManageActionsProps) {
  return (
    <>
      {showEdit && !isClosed ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          disabled={disabled || isDeleting || isClosing || isRestoring}
        >
          <Pencil className="h-3 w-3" /> Modifier
        </Button>
      ) : null}

      {isClosed ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-emerald-600"
          disabled={disabled || isDeleting || isClosing || isRestoring || typeof onRestore !== 'function'}
          onClick={onRestore}
        >
          {isRestoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          Restaurer
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-emerald-600"
          disabled={disabled || isDeleting || isClosing || isRestoring || closeDisabled}
          onClick={onClose}
        >
          {isClosing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
          Clôturer
        </Button>
      )}

      {showDelete && !isClosed ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] gap-1 px-2 text-muted-foreground hover:text-destructive"
          disabled={disabled || isDeleting || isClosing || isRestoring}
          onClick={onDelete}
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Supprimer
        </Button>
      ) : null}
    </>
  );
}
