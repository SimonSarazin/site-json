import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/modules/kanban/lib/initials";
import { resolveMediaUrl } from "@/modules/kanban/lib/media";

const SIZES = { sm: "size-6 text-[0.625rem]", md: "size-8 text-xs" } as const;

/**
 * Portrait d'un membre, sur l'`Avatar` du site : la photo, résolue contre le backend
 * (`resolveMediaUrl` : Communecter stocke des chemins relatifs), sinon les initiales.
 *
 * Toujours DÉCORATIF ici : le nom est écrit à côté, un lecteur d'écran le lirait deux fois.
 */
export function MemberAvatar({ name, src, size = "md", className }: { name: string; src: string | null | undefined; size?: keyof typeof SIZES; className?: string }) {
  const url = resolveMediaUrl(src);
  return (
    <Avatar aria-hidden className={cn("shrink-0 ring-1 ring-border", SIZES[size], className)}>
      {url !== null ? <AvatarImage src={url} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-muted font-semibold text-muted-foreground">{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}
