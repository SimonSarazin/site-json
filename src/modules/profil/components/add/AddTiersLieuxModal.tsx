import type { EntityTypes } from "@communecter/cocolight-api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAddTiersLieu } from "../../hooks/useAddMutations";
import {
  TiersLieuxForm,
  getDefaultTiersLieuxValues,
  type TiersLieuxSubmitPayload,
} from "./TiersLieuxForm";

interface AddTiersLieuxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: EntityTypes | null;
}

export function AddTiersLieuxModal({ open, onOpenChange, parent }: AddTiersLieuxModalProps) {
  const addMutation = useAddTiersLieu(parent);

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async (data: TiersLieuxSubmitPayload) => {
    try {
      await addMutation.mutateAsync(data);
      handleClose();
    } catch {
      // Le toast d'erreur est déjà émis par useMutationWithToast
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <TiersLieuxForm
          mode="add"
          defaultValues={getDefaultTiersLieuxValues()}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          isSubmitting={addMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

export default AddTiersLieuxModal;
