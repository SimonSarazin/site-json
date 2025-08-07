import { useT } from "@/hooks/useT";
import { DetailsModeProps } from "../../schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Preview from "../Preview";

export default function DetailsModeDialog({ openDetails, setOpenDetails, item, preview }: DetailsModeProps) {
    const t = useT("modules/search");

    return (
        <Dialog open={openDetails} onOpenChange={setOpenDetails}>
          <DialogContent className="p-4 min-w-[320px] max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {t("Aperçu")}
              </DialogTitle>
              <DialogDescription>
                {t("Aperçu du contenu")}
              </DialogDescription>
            </DialogHeader>
            {item && <Preview item={item} preview={preview} />}
          </DialogContent>
        </Dialog>
    );
}   