import { useMemo } from "react";
import type { Organization } from "@communecter/cocolight-api-client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEditTiersLieu } from "../../hooks/useEditTiersLieu";
import { mapEntityToTiersLieuxValues } from "../../utils/tiersLieuxMapping";
import {
  TiersLieuxForm,
  type TiersLieuxSubmitPayload,
} from "../add/TiersLieuxForm";

interface EditTiersLieuxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
}

export function EditTiersLieuxModal({
  open,
  onOpenChange,
  organization,
}: EditTiersLieuxModalProps) {
  const editMutation = useEditTiersLieu(organization);

  const defaultValues = useMemo(
    () => mapEntityToTiersLieuxValues(organization),
    [organization]
  );

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async (data: TiersLieuxSubmitPayload) => {
    try {
      await editMutation.mutateAsync(data);
      handleClose();
    } catch {
      // Toast d'erreur déjà émis par useMutationWithToast
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[820px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <TiersLieuxForm
          mode="edit"
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          isSubmitting={editMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

export default EditTiersLieuxModal;
