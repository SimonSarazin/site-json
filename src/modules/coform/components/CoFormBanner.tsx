import { useT } from "@/hooks/useT";
import type { CoFormData } from "../types";

interface CoFormBannerProps {
  /** Form data — au minimum `name` ou (`useBannerImg` + `profilBannerUrl`) pour rendre quelque chose. */
  formData: CoFormData;
  /** Si true, le composant ne rend rien (court-circuit pour les modes embedded/standalone). */
  hidden?: boolean;
}

/**
 * Bannière du formulaire CoForm — titre en overlay sur image, ou bandeau
 * gradient avec titre simple si pas d'image, ou rien du tout si pas de nom.
 *
 * Extrait depuis `DynamicCoForm` et `MultiStepCoForm` qui dupliquaient ce bloc
 * (~25 lignes chacun) avec une seule différence cosmétique sur l'`alt` text.
 */
export function CoFormBanner({ formData, hidden = false }: CoFormBannerProps) {
  const t = useT("modules/coform");

  if (hidden) return null;

  if (formData.useBannerImg && formData.profilBannerUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg">
        <img
          src={formData.profilBannerUrl}
          alt={t("coform.banner.alt")}
          className="w-full h-48 object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
        {formData.name && (
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
              {formData.name}
            </h1>
          </div>
        )}
      </div>
    );
  }

  if (formData.name) {
    return (
      <div className="w-full rounded-lg bg-linear-to-r from-primary/10 via-primary/5 to-background p-8 border">
        <h1 className="text-4xl font-bold text-foreground">
          {formData.name}
        </h1>
      </div>
    );
  }

  return null;
}
