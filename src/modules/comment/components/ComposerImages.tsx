import { AlertCircle, Loader2, X } from "lucide-react";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import type { PendingImage } from "../hooks/useCommentImages";

export interface ComposerImagesProps {
  readonly items: readonly PendingImage[];
  readonly onRemove: (localId: string) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * Les images jointes à un message en cours d'écriture.
 *
 * Purement présentationnel : il ne sait rien du téléversement, qui vit dans `useCommentImages`.
 * C'est ce qui permettra de le rebrancher tel quel sur l'éditeur qui remplacera le composer.
 *
 * Le retrait reste offert pendant l'envoi : une image qu'on regrette n'a pas à attendre la fin
 * de son propre téléversement pour disparaître. Le document déjà créé restera orphelin — comme
 * ceux que le legacy a laissés en base —, ce qui est sans conséquence pour le message.
 */
export function ComposerImages({ items, onRemove, disabled = false, className }: ComposerImagesProps) {
  const t = useT("modules/comment");
  if (items.length === 0) return null;

  return (
    <ul
      data-composer-images=""
      className={cn("flex flex-wrap gap-2 px-3 pb-2", className)}
    >
      {items.map(item => (
        <li key={item.localId} className="relative">
          <span
            className={cn(
              "flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted",
              item.status === "error" ? "border-destructive" : "border-border",
            )}
          >
            {item.previewUrl ? (
              <OptimizedImage
                src={item.previewUrl}
                alt={item.name}
                width={128}
                className={cn(
                  "size-full object-cover",
                  item.status === "uploading" ? "opacity-50" : "",
                )}
              />
            ) : (
              <span className="px-1 text-center text-[10px] leading-tight text-muted-foreground">
                {item.name}
              </span>
            )}
          </span>

          {item.status === "uploading" ? (
            <span className="absolute inset-0 flex items-center justify-center" role="status">
              <Loader2 className="size-5 animate-spin text-foreground/70" aria-hidden />
              <span className="sr-only">{t("images.uploading", undefined, { name: item.name })}</span>
            </span>
          ) : null}

          {item.status === "error" ? (
            // Pas de `role="status"` ici : l'échec est annoncé une fois, par la phrase d'alerte du
            // composer. Ce texte-ci reste pour qui parcourt les aperçus.
            <span className="absolute inset-0 flex items-center justify-center">
              <AlertCircle className="size-5 text-destructive" aria-hidden />
              <span className="sr-only">{t("images.uploadFailed", undefined, { name: item.name })}</span>
            </span>
          ) : null}

          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(item.localId)}
            aria-label={String(t("images.remove", undefined, { name: item.name }))}
            className="absolute -end-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5
                       text-muted-foreground shadow-sm hover:text-foreground
                       focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="size-3" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
