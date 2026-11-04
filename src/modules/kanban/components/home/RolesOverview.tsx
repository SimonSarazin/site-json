import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { memberKey } from "@/modules/kanban/components/roles/rolesBoard";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import type { RoleListResult } from "@/modules/kanban/types";
import { rolesGlance } from "./rolesGlance";

/** Portraits de la tuile, puis « +N ». */
const MAX_FACES = 7;

/**
 * Les rôles de l'élément porteur, vus de sa tuile sur `/kanban` : les deux chiffres (rôles,
 * membres), les visages de ceux qui les tiennent et, s'il y en a, les rôles qui attendent un
 * titulaire, la seule chose à faire que la tuile puisse annoncer. Les portraits sont décoratifs :
 * l'effectif est écrit au-dessus.
 */
export function RolesOverview({ list }: { list: RoleListResult }) {
  const t = useT("modules/kanban");
  const glance = rolesGlance(list, MAX_FACES);

  return (
    <div className="space-y-2.5">
      <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm tabular-nums">
        <span className="font-medium text-foreground">{String(t("home.stats.roles", undefined, { count: glance.roleCount }))}</span>
        <span className="sr-only">, </span>
        <span className="text-muted-foreground">{String(t("home.stats.members", undefined, { count: glance.memberCount }))}</span>
      </p>

      {glance.faces.length > 0 ? (
        <div aria-hidden className="flex items-center">
          {glance.faces.map((member, index) => (
            <MemberAvatar key={memberKey(member)} name={member.name} src={member.image} className={cn("ring-2 ring-card", index > 0 && "-ml-1.5")} />
          ))}
          {glance.hiddenFaces > 0 ? (
            <span className="-ml-1.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground tabular-nums ring-2 ring-card">
              +{glance.hiddenFaces}
            </span>
          ) : null}
        </div>
      ) : null}

      {glance.vacantRoleCount > 0 ? (
        <p className="text-xs text-muted-foreground">{String(t("home.stats.vacantRoles", undefined, { count: glance.vacantRoleCount }))}</p>
      ) : null}
    </div>
  );
}

/** Même encombrement que l'aperçu, pendant le chargement : la tuile ne saute pas (CLS). */
export function RolesOverviewSkeleton() {
  return (
    <div aria-hidden className="space-y-2.5">
      <Skeleton className="h-5 w-2/3 motion-reduce:animate-none" />
      <div className="flex">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className={cn("size-8 rounded-full ring-2 ring-card motion-reduce:animate-none", index > 0 && "-ml-1.5")} />
        ))}
      </div>
    </div>
  );
}
