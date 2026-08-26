import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import NavLink from "@/components/layout/NavLink";

export interface SportCategoriesCard {
  icon?: string;
  title?: LocalizedString;
  subtitle?: LocalizedString;
  link?: string;
}

export interface SportCategoriesSectionProps {
  headline?: LocalizedString;
  subhead?: LocalizedString;
  variant?: "primary" | "accent" | "frosted";
  columns?: number;
  cards: SportCategoriesCard[];
}

interface SportCategoriesSectionComponentProps {
  id?: string;
  props: SportCategoriesSectionProps;
}

export function SportCategoriesSection({
  id,
  props,
}: SportCategoriesSectionComponentProps) {
  const { t } = useLocalization();
  const variant = props.variant || "primary";
  const columns = props.columns || 3;

  const getGridColsClass = () => {
    const gridMap: Record<number, string> = {
      2: "sm:grid-cols-2 lg:grid-cols-2",
      3: "sm:grid-cols-2 lg:grid-cols-3",
      4: "sm:grid-cols-2 lg:grid-cols-4",
      5: "sm:grid-cols-2 lg:grid-cols-5",
      6: "sm:grid-cols-2 lg:grid-cols-6",
    };
    return gridMap[columns] || gridMap[3];
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "accent":
        return {
          sectionBg: "bg-gradient-to-b from-background to-card/20",
          cardBg: "bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60",
          accentColor: "text-accent",
        };
      case "frosted":
        return {
          sectionBg: "bg-gradient-to-b from-background to-background/80",
          cardBg: "bg-secondary/30 backdrop-blur-md border-primary/20 hover:bg-secondary/50",
          accentColor: "text-primary",
        };
      case "primary":
      default:
        return {
          sectionBg: "bg-gradient-to-b from-background to-background/80",
          cardBg: "bg-secondary/30 backdrop-blur-sm border  border-primary/20 hover:shadow-lg hover:shadow-primary/20",
          accentColor: "text-primary",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <section id={id} className={`relative overflow-hidden py-20 md:py-28 px-2 md:px-4 ${styles.sectionBg}`}>
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -left-32 top-8 hidden h-[420px] w-[420px] rounded-full bg-accent/40 opacity-60 blur-3xl md:block" />
      <div className="pointer-events-none absolute right-0 bottom-0 hidden h-[300px] w-[300px] rounded-full bg-card/30 opacity-40 blur-3xl md:block" />

      <div className="container relative z-10 mx-auto max-w-5xl">
        {/* Title */}
        {props.headline && (
          <div className="mb-16 text-center animate-fade-in">
            <h2 className="mt-2 font-body text-3xl font-extrabold leading-tight text-foreground md:text-5xl">
              {t(props.headline)}
            </h2>
            {props.subhead && (
              <p className="mx-auto mt-4 max-w-2xl font-body text-base text-muted-foreground md:text-lg">
                {t(props.subhead)}
              </p>
            )}
          </div>
        )}

        {/* Categories grid — 1 colonne sur mobile (cartes pleine largeur,
            évite l'écrasement des titres), 2+ dès `sm` via getGridColsClass. */}
        <div
          className={`grid grid-cols-1 gap-6 ${getGridColsClass()}`}
        >
          {props.cards.map((card, index) => {
            const cardElement = (
              <div
                key={index}
                className={`group flex flex-col items-center gap-4 rounded-2xl ${styles.cardBg} px-4 py-8 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background hover:shadow-lg hover:scale-105 animate-fade-in-up`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {card.icon && (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-background shadow-sm transition-colors group-hover:bg-accent/30">
                    <DynamicIcon
                      name={card.icon as IconName}
                      className={`h-12 w-12 ${styles.accentColor} transition-transform duration-300 group-hover:scale-110`}
                      strokeWidth={1.5}
                    />
                  </div>
                )}
                <div className="flex flex-col items-center gap-1 text-center">
                   {card.title && (
                      <span className="font-body text-md font-bold uppercase tracking-wider text-primary transition-colors group-hover:text-foreground">
                        {t(card.title)}
                      </span>
                  )}
                  {card.subtitle && (
                    <span className="text-muted-foreground ">
                      {t(card.subtitle)}
                    </span>
                  )}
                </div>
              </div>
            );

            if (card.link) {
              // `NavLink` plutôt qu'un `<a href>` brut : ces cartes sont le chemin de conversion
              // principal de l'accueil, et une ancre native rechargeait TOUTE l'application à
              // chaque clic (re-téléchargement du HTML + réhydratation), là où la même action
              // depuis le héros est instantanée. NavLink porte en plus le contrat 4 voies partagé
              // (interne / externe / mailto-tel-sms / inerte) — cf. src/lib/linkKind.ts.
              return (
                <NavLink
                  key={index}
                  to={card.link}
                  className="no-underline hover:no-underline block h-full"
                >
                  {cardElement}
                </NavLink>
              );
            }

            return cardElement;
          })}
        </div>
      </div>
    </section>
  );
}

export default SportCategoriesSection;
