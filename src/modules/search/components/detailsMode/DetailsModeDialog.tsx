import { useT } from "@/hooks/useT";
import { DetailsModeProps } from "../../schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Preview from "../Preview";

/**
 * Conteneur de détail « dialog » — coque neutre. Le CONTENU est piloté par
 * `preview.type` (cf. `Preview.tsx`), indépendamment de la carte. `p-0` + large :
 * chaque `Preview*` borne sa propre hauteur/scroll (en-tête figé + corps).
 */
export default function DetailsModeDialog({ openDetails, setOpenDetails, item, preview }: DetailsModeProps) {
    const t = useT("modules/search");

    return (
        <Dialog open={openDetails} onOpenChange={setOpenDetails}>
          <DialogContent aria-describedby={undefined} className="p-0 gap-0 sm:max-w-5xl max-h-[90vh] overflow-hidden">
            <DialogTitle className="sr-only">{t("Aperçu")}</DialogTitle>
            {item && (
              <Preview item={item} preview={preview} onClose={() => setOpenDetails(false)} />
            )}
          </DialogContent>
        </Dialog>
    );
}
