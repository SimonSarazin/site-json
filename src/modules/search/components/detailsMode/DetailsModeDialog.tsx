import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { DetailsModeProps } from "../../schema";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Preview from "../Preview";

/**
 * Largeur MAX du dialog, pilotée par la CONFIG (`preview.width`) — découplée du type de preview.
 * Classes littérales (Tailwind ne génère que ce qui est écrit en clair). Défaut : `5xl`
 * (comportement historique) quand `preview.width` n'est pas renseigné dans le JSON.
 */
const DIALOG_MAX_WIDTH: Record<string, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
  full: "sm:max-w-[95vw]",
};

/**
 * Conteneur de détail « dialog » — coque neutre. Le CONTENU est piloté par
 * `preview.type` (cf. `Preview.tsx`), indépendamment de la carte. `p-0` :
 * chaque `Preview*` borne sa propre hauteur/scroll (en-tête figé + corps).
 */
export default function DetailsModeDialog({ openDetails, setOpenDetails, item, preview, list }: DetailsModeProps) {
    const t = useT("modules/search");
    const maxWidth = DIALOG_MAX_WIDTH[preview?.width ?? "5xl"] ?? "sm:max-w-5xl";

    return (
        <Dialog open={openDetails} onOpenChange={setOpenDetails}>
          <DialogContent aria-describedby={undefined} className={cn("p-0 gap-0 max-h-[90vh] overflow-hidden", maxWidth)}>
            <DialogTitle className="sr-only">{t("Aperçu")}</DialogTitle>
            {item && (
              <Preview item={item} preview={preview} list={list} onClose={() => setOpenDetails(false)} />
            )}
          </DialogContent>
        </Dialog>
    );
}
