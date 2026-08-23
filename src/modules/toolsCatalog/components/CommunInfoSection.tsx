import { Mail, MessagesSquare, Globe, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { formatCurrency } from "@/modules/cagnotte/utils/format";
import { SectionHeader } from "./SectionHeader";
import { useCommunInfo } from "../hooks/useCommunInfo";

interface CommunInfoSectionProps {
  /** `_id` (24hex) de la réponse AAP du commun (item.communId). */
  communId: string;
  /** Id du form AAP des communs (verrou de périmètre anti-IDOR, requis). */
  communFormId?: string;
}

/** Ligne de contact (icône + lien externe), rendue seulement si `href` non vide. */
function ContactRow({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Mail;
  label: string;
  href: string | null;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

/**
 * Bloc « Informations liées au commun » de la modale détail : contact / canal /
 * site + tags + description du commun (réponse AAP) et ses besoins financiers
 * (postes recalculés serveur, fournis par la même requête). Monté SEULEMENT pour
 * les outils qui référencent un commun (item.communId non vide) ; s'efface
 * silencieusement si le commun est hors périmètre, introuvable, ou sans contenu.
 */
export function CommunInfoSection({ communId, communFormId }: CommunInfoSectionProps) {
  const t = useT("modules/toolsCatalog");
  const { commun, isPending, error } = useCommunInfo({ communId, communFormId });

  if (isPending) {
    return (
      <section className="space-y-3">
        <SectionHeader>{t("commun.title")}</SectionHeader>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </section>
    );
  }

  // Hors périmètre / introuvable / erreur → bloc simplement absent.
  if (error || !commun) return null;

  const hasContact = !!(commun.email || commun.channelUrl || commun.toolUrl);
  const postes = commun.postes ?? [];
  // Pas de contenu affichable → pas de bandeau orphelin.
  if (!hasContact && commun.tags.length === 0 && !commun.description && postes.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <SectionHeader>{t("commun.title")}</SectionHeader>

      {hasContact && (
        <div className="flex flex-col gap-1.5">
          <ContactRow icon={Mail} label={commun.email} href={commun.email ? `mailto:${commun.email}` : null} />
          <ContactRow icon={MessagesSquare} label={t("commun.channel")} href={commun.channelUrl || null} />
          <ContactRow icon={Globe} label={t("commun.website")} href={commun.toolUrl || null} />
        </div>
      )}

      {commun.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {commun.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {commun.description && (
        // Saisie AAP en textarea markdown → on parse (sinon `**gras**` et les
        // listes s'affichent en syntaxe brute). `@tailwindcss/typography` n'est
        // pas installé ici : le style des balises produites est explicite.
        <div className="border-l-2 border-primary pl-3 text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline [&_li]:mb-0.5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&>*:last-child]:mb-0">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            }}
          >
            {commun.description}
          </ReactMarkdown>
        </div>
      )}

      {postes.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <p className="text-sm font-semibold">{t("commun.fundingTitle")}</p>
          <ul className="space-y-2.5">
            {postes.map((poste, i) => {
              const pct = poste.target > 0 ? Math.min(100, Math.round((poste.collected / poste.target) * 100)) : 0;
              return (
                <li key={`${poste.label}-${i}`} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{poste.label || t("commun.fundingUnnamed")}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatCurrency(poste.collected)} / {formatCurrency(poste.target)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
