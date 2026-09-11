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
          {/* Pastille de contraste sous la croix. En `p-0`, plusieurs previews ouvrent sur une BANNIÈRE
              d'image pleine largeur (`resource`, `testimonial`) : la croix de `DialogContent`, posée en
              `absolute top-4 right-4` sans fond ni ombre et à `opacity-70`, se retrouve alors sur une
              photo arbitraire — illisible sur une photo sombre en thème clair, et inversement (WCAG
              1.4.11, contraste d'un contrôle). Le fond est posé ICI, dans la coque, plutôt que dans
              chaque preview : c'est la coque qui pose la croix. */}
          <DialogContent
            aria-describedby={undefined}
            className={cn(
              "p-0 gap-0 max-h-[90vh] overflow-hidden",
              "[&>[data-slot=dialog-close]]:rounded-full [&>[data-slot=dialog-close]]:bg-background/80",
              "[&>[data-slot=dialog-close]]:p-1.5 [&>[data-slot=dialog-close]]:opacity-100",
              "[&>[data-slot=dialog-close]]:backdrop-blur-sm [&>[data-slot=dialog-close]]:shadow-sm",
              maxWidth,
            )}
          >
            <DialogTitle className="sr-only">{t("Aperçu")}</DialogTitle>
            {item && (
              <Preview item={item} preview={preview} list={list} onClose={() => setOpenDetails(false)} />
            )}
          </DialogContent>
        </Dialog>
    );
}
