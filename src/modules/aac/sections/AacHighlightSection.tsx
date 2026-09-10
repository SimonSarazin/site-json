// Side-effect : enregistre le namespace i18n "modules/aac" dès le chargement du
// chunk de la section (le point d'entrée section n'importe pas index.ts).
import "../i18n";

import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { useAacCommunsCount } from "../hooks/useAacCommunsCount";
import { useAacDirectoryContext } from "../hooks/useAacDirectoryContext";
import type { AacHighlightSectionProps } from "../schema";

interface Props {
  id?: string;
  props: AacHighlightSectionProps;
}

/**
 * Bande d'appel à l'action d'un AAC, avec son médaillon chiffré.
 *
 * Le chiffre est compté à la demande — et seulement si la config en demande un :
 * une bande sans `count` ne déclenche aucune requête (`enabled`), ce qui permet
 * d'en poser plusieurs sur une page sans multiplier les allers-retours.
 */
export default function AacHighlightSection({ id, props }: Props) {
  const { t: localize } = useLocalization();
  const { title, description, className, tone = "primary", cta, count } = props;

  // Le décompte sera-t-il connu UN JOUR ? Sans AAC déclaré (`config.aac.formId`)
  // non ; mais pas davantage si la résolution du formulaire a échoué (formulaire
  // supprimé, 403) ou s'est terminée sans rien produire (pas d'entité costum,
  // donc requête jamais activée) : la requête du décompte attend `resolved` et
  // resterait `pending` pour toujours. Dans tous ces cas c'est une ABSENCE, pas
  // une attente — pas de médaillon du tout, plutôt qu'un squelette perpétuel.
  const { formId, resolved, isFormLoading, configError } = useAacDirectoryContext();
  const isCountReachable =
    formId !== null && !configError && (isFormLoading || Boolean(resolved));
  const wantsCount = count?.source === "communs" && isCountReachable;
  const { count: communsCount, error: countError } = useAacCommunsCount(wantsCount);

  const isPrimary = tone === "primary";

  return (
    <section
      id={id}
      className={cn(
        "py-16",
        isPrimary ? "bg-primary text-primary-foreground" : "bg-muted",
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{localize(title)}</h2>
          {description && (
            <p className={cn("text-base", isPrimary ? "opacity-90" : "text-muted-foreground")}>
              {localize(description)}
            </p>
          )}
          {cta && (
            <Button
              asChild
              size="lg"
              // Sur fond `primary`, un bouton `primary` serait invisible : la
              // bande inverse donc les rôles plutôt que de figer une couleur.
              variant={isPrimary ? "secondary" : "default"}
              className="rounded-full"
            >
              <Link to={cta.href}>{localize(cta.label)}</Link>
            </Button>
          )}
        </div>

        {wantsCount && (
          <CountMedallion
            value={communsCount}
            error={countError}
            label={count?.label ? localize(count.label) : undefined}
            isPrimary={isPrimary}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Le médaillon. Tant que le chiffre n'est pas connu on montre un squelette —
 * jamais un `0`, qui se lirait comme « aucun commun » et non comme « je ne sais
 * pas encore ». Ce squelette est aussi ce que rend le SSR : la requête n'y est
 * pas encore ACTIVÉE (elle attend le formulaire, jamais préchargé), donc
 * l'attente se lit sur `value`, pas sur `isLoading` — qui vaut false tant que
 * rien n'est en vol, et laisserait la place vide puis surgir le médaillon.
 * Lire l'attente sur `value` n'est tenable que parce que l'appelant a déjà
 * écarté les cas où le chiffre ne viendra JAMAIS (`isCountReachable`) : sans
 * cette garde, ce squelette serait perpétuel.
 *
 * En cas d'échec, `count` reste `null` et le médaillon disparaît : une bande
 * sans chiffre reste lisible, un chiffre faux ne l'est pas. Un chiffre déjà
 * connu prime sur une erreur de rafraîchissement — React Query le conserve,
 * on l'affiche plutôt que de faire disparaître le médaillon.
 */
function CountMedallion({
  value,
  error,
  label,
  isPrimary,
}: {
  value: number | null;
  error: Error | null;
  label?: string;
  isPrimary: boolean;
}) {
  const t = useT("modules/aac");
  const text = label ?? String(t("highlight.communs"));

  if (value === null && error) return null;

  return (
    <div
      className={cn(
        "flex aspect-square w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-full text-center md:w-48",
        isPrimary ? "bg-background" : "bg-card border"
      )}
    >
      {value === null ? (
        <Skeleton className="h-12 w-16" />
      ) : (
        <span className="text-5xl font-bold text-primary tabular-nums">{value}</span>
      )}
      <span className="max-w-[80%] text-xs font-medium text-muted-foreground">{text}</span>
    </div>
  );
}
