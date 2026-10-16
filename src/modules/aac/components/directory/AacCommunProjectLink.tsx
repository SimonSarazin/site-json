import { Link } from "react-router";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { AacCommunProject } from "../../lib/parseAacAnswer";

interface AacCommunProjectLinkProps {
  project: AacCommunProject | null;
  className?: string;
}

/**
 * Projet lié d'un commun dans l'annuaire : « Projet : <nom> » vers sa page, « En projet »
 * sans lien s'il n'est pas résolu. `relative z-10` : au-dessus du lien étiré des cartes.
 */
export function AacCommunProjectLink({ project, className }: AacCommunProjectLinkProps) {
  const t = useT("modules/aac");
  if (!project) return null;

  const label = project.name
    ? String(t("directory.card.project", undefined, { name: project.name }))
    : String(t("directory.card.inProject"));
  const classes = cn("relative z-10 inline-flex min-w-0 max-w-full items-center gap-1 text-xs", className);
  const content = (
    <>
      <Briefcase className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );

  return project.slug ? (
    <Link to={`/profil/${project.slug}`} title={label} className={cn(classes, "hover:underline")}>
      {content}
    </Link>
  ) : (
    <span title={label} className={classes}>
      {content}
    </span>
  );
}
