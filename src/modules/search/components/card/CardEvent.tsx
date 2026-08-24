import { useState, useMemo } from "react";
import { format } from "date-fns";
import { SearchCardProps } from "../../schema";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import getDateFnsLocale from "@/dateFns";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import useItem from "../../hooks/useItem";
import { useT } from "@/hooks/useT";
import { getEntityColorClasses, getEntityIconName } from "@/lib/entityIcons";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { formatRecurrenceLabel } from "../../lib/openingHoursDays";

// Map des tags vers des icônes spécifiques aux événements
const TAG_ICON_MAP: Record<string, string> = {
  'workshop': 'wrench',
  'conference': 'presentation',
  'hackathon': 'zap',
  'meetup': 'users',
  'formation': 'graduation-cap',
};

function getEventAvatarIcon(tags: string[]): string {
  for (const tag of tags) {
    const icon = TAG_ICON_MAP[tag.toLowerCase()];
    if (icon) return icon;
  }
  return getEntityIconName("events"); // "calendar"
}

/**
 * Bloc date — MÊME design avec ou sans photo (jour en gros + mois, ou libellé
 * de récurrence à la place s'il y en a un) : source unique pour les deux
 * variantes de la carte, pas de pastille/icône séparée pour l'une des deux.
 */
function EventDateBlock({ recurrenceLabel, startDate }: { recurrenceLabel: string | null; startDate: Date | null }) {
  const locale = getDateFnsLocale();
  if (recurrenceLabel) {
    // Texte variable (« Chaque lundi, mardi… et dimanche » peut aller jusqu'à 7 jours) : taille
    // responsive plutôt que fixe, pour ne pas déborder/écraser la carte sur une colonne étroite
    // (grilles 2-4 colonnes en desktop) tout en restant agrandi sur les cartes larges.
    return <div className="text-base sm:text-lg font-bold leading-snug text-primary">{recurrenceLabel}</div>;
  }
  if (!startDate) return null;
  return (
    <div className="flex items-baseline gap-2 text-primary">
      <span className="text-4xl font-bold leading-none tabular-nums">
        {format(startDate, "d", { locale })}
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide">
        {format(startDate, "LLL yyyy", { locale })}
      </span>
    </div>
  );
}

interface EventCardPlainProps {
  onClick?: () => void;
  name: string | null;
  startDate: Date | null;
  /** « Chaque vendredi » — événement récurrent : préféré à la date d'occurrence, qui change chaque semaine. */
  recurrenceLabel: string | null;
  organizerName: string | null;
  location: string | null;
  avatarIcon: string;
  avatarColorClasses: string;
}

/**
 * Variante SANS image de la carte événement.
 *
 * Bâtie sur le `Card` shadcn — c'est exactement la boîte qu'il décrit (fond,
 * bordure, rayon, ombre), inutile de la réécrire à la main. L'espace laissé
 * libre par l'absence de visuel est rendu à l'information plutôt qu'occupé par
 * un décor : jour et mois en gros, titre, puis organisateur et lieu en pied.
 *
 * `h-full` plutôt que le `h-72` de la carte-affiche : les éléments d'une grille
 * s'étirent par défaut, donc une rangée uniquement composée de ces cartes se
 * règle sur son propre contenu (pas de vide de 288 px), tandis qu'une rangée
 * MIXTE s'aligne d'elle-même sur la hauteur de la carte-affiche.
 */
function EventCardPlain({
  onClick,
  name,
  startDate,
  recurrenceLabel,
  organizerName,
  location,
  avatarIcon,
  avatarColorClasses,
}: EventCardPlainProps) {
  return (
    <Card
      onClick={onClick}
      className="h-full w-full cursor-pointer gap-4 py-5 shadow-lg transition-shadow hover:shadow-xl"
    >
      <CardContent className="px-5">
        <EventDateBlock recurrenceLabel={recurrenceLabel} startDate={startDate} />

        {name && <h3 className="mt-3 line-clamp-3 text-base font-semibold">{name}</h3>}
      </CardContent>

      {/* `mt-auto` colle le pied en bas quel que soit le nombre de lignes du
          titre ; `border-t` déclenche le `pt` que `CardFooter` prévoit pour lui. */}
      <CardFooter className="mt-auto items-start gap-3 border-t px-5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm",
            avatarColorClasses,
          )}
        >
          <DynamicIcon name={avatarIcon as IconName} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {organizerName && <p className="truncate text-sm font-bold">{organizerName}</p>}
          {location && <p className="truncate text-xs text-muted-foreground">{location}</p>}
        </div>
      </CardFooter>
    </Card>
  );
}

export default function CardEvent({
  item,
  onClick,
}: SearchCardProps) {
  const data = useItem(item);
  const t = useT("modules/search");
  const [imageFailed, setImageFailed] = useState(false);

  const {
    name,
    image,
    startDate,
    organizerName,
    address,
    tags = [],
  } = data;

  const location = address?.addressLocality || null;
  const avatarIcon = getEventAvatarIcon(tags);
  const avatarColorClasses = getEntityColorClasses("events");

  // Récurrent (`openingHours`) : la date d'une occurrence isolée est trompeuse (elle change chaque
  // semaine) — on préfère un libellé de récurrence stable, ex. « Chaque vendredi ».
  const recurrenceLabel = useMemo(() => {
    const raw = item?.serverData as Record<string, unknown> | undefined;
    return formatRecurrenceLabel(raw?.recurrency, raw?.openingHours, t);
  }, [item, t]);

  // Sans image, la carte-affiche perdait son fond : les deux panneaux de verre
  // flottaient sur 288 px de vide. Or beaucoup d'événements relayés (appels à
  // projets, assises, réunions) n'ont AUCUN visuel — la variante ci-dessous les
  // rend en typographie, la date devenant le repère principal.
  //
  // Même bascule si l'image ne CHARGE pas : un `profilImageUrl` peut pointer sur
  // un fichier absent (on en observe dont le chemin contient littéralement
  // `/null/null/`), et un cadre d'image rompu est pire que pas d'image du tout.
  //
  // Aiguillage en amont du rendu : la carte-affiche ci-dessous est INTACTE, un
  // événement dont l'image charge passe exactement par le même code qu'avant.
  if (!image || imageFailed) {
    return (
      <EventCardPlain
        onClick={onClick}
        name={name}
        startDate={startDate}
        recurrenceLabel={recurrenceLabel}
        organizerName={organizerName}
        location={location}
        avatarIcon={avatarIcon}
        avatarColorClasses={avatarColorClasses}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className="relative border border-border w-full h-72 rounded-xl overflow-hidden shadow-lg group cursor-pointer"
    >
      {/* Image de fond */}
      {image && (
        <OptimizedImage
          src={image}
          alt={name}
          width={400}
          onError={() => setImageFailed(true)}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {/* Date et titre de l'événement en haut — même bloc date que la variante sans image.
          `bg-background/80` (au lieu de /30) : sur une photo quelconque, un fond trop transparent
          laisse passer trop de l'image derrière le flou et casse le contraste de `text-primary` —
          `/80` retrouve quasi le contraste `text-primary` sur `bg-background` déjà garanti ailleurs
          dans l'app, indépendamment de l'image. */}
      <div className="
        absolute top-0 w-full px-2 pt-2 pb-2 z-10
        backdrop-blur-xl
        bg-background/80
        border-b border-border/40
        flex flex-col items-center gap-2
      ">
        <EventDateBlock recurrenceLabel={recurrenceLabel} startDate={startDate} />
        {name && (
          <div className="text-foreground font-semibold text-sm drop-shadow-lg">
            {name}
          </div>
        )}
      </div>

      {/* Card info en bas */}
      <div
        className="
          absolute bottom-3 left-3 right-3
          bg-card/80
          backdrop-blur-lg
          rounded-xl p-4
          flex items-start gap-3
          shadow-lg border border-border
          translate-y-2 group-hover:translate-y-0
          transition-all
        "
      >
        {/* Avatar Icon */}
        <div className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full shadow-sm shrink-0",
          avatarColorClasses
        )}>
          <DynamicIcon name={avatarIcon as IconName} className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm mb-1 truncate">
            {organizerName || name}
          </h3>
          {location && (
            <p className="text-muted-foreground text-xs truncate">
              {location}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
