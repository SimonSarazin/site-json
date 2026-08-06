import { useLocalization } from "@/hooks/useLocalization";
import { type MapBubblesProps } from "@/types/site-schema";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";

interface MapBubblesSectionProps {
    id?: string;
    props: MapBubblesProps;
}

const BG_MAP: Record<string, string> = {
    card: "bg-card",
    muted: "bg-muted",
    primary: "bg-primary/10",
    secondary: "bg-secondary",
    accent: "bg-accent/10",
    transparent: "bg-transparent",
};

export function MapBubbles({ id, props }: MapBubblesSectionProps) {
    const { t } = useLocalization();
    const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : "";
    const overlay = props.backgroundOverlay;

    return (
        <section id={id} className={`relative py-16 px-4 ${sectionBg}`}>
            {overlay && (
                <div
                    className="absolute inset-0 z-0"
                    style={{ background: `linear-gradient(${overlay.angle ?? 90}deg, ${overlay.from}, ${overlay.to})` }}
                />
            )}

            <div className="relative z-10 container mx-auto max-w-4xl">
                <div className="relative w-full @container/map-bubbles">
                    {props.backgroundImage ? (
                        <img
                            src={props.backgroundImage}
                            alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                            className="block w-full h-auto select-none"
                        />
                    ) : (
                        <div className="aspect-4/3" />
                    )}

                    <div className="absolute inset-0">
                        {props.items.map((item, index) => (
                            <Link
                                key={index}
                                to={item.href}
                                className="group absolute z-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center hover:z-20 focus-visible:z-20"
                                style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.size}%` }}
                            >
                                <img
                                    src={item.image}
                                    alt=""
                                    // `relative z-0` : le rond doit rester SOUS le label (span juste après,
                                    // qui le chevauche via `-mt-5`) — un `z-index` n'a aucun effet sur un
                                    // élément `static` (position par défaut), d'où le `relative` ici aussi.
                                    className="relative z-0 w-full h-auto object-contain drop-shadow-md transition-transform group-hover:scale-105"
                                />
                                <span
                                    // Couleurs FIXES, volontairement pas `bg-foreground`/`text-background` :
                                    // ces pastilles ne doivent pas changer d'apparence quel que soit le
                                    // mode clair/sombre du site.
                                    // `right-1/3` (au lieu de `right-1/4`) : l'ancre recule d'un tiers de
                                    // la largeur du rond, quelle que soit sa taille — laisse plus de sa
                                    // partie droite visible (avant : les petits ronds finissaient presque
                                    // entièrement recouverts par le label, cf. doc-projets §9quater).
                                    // `right-1/2` clipait le label hors écran pour les ronds proches du bord
                                    // gauche de la carte (Boulonnais, x:6%) dès 768px — 1/3 reste dans l'écran.
                                    // `-mt-5` (au lieu de `-mt-3`) en xs/sm : label remonté un peu plus sur
                                    // le rond (ne joue qu'en dessous de `md:`, avant le passage `md:absolute`).
                                    // `relative` (plutôt que `static`) + `z-[1]` : passe explicitement au-dessus
                                    // du rond (`z-0` ci-dessus) — un `z-index` n'a pas d'effet sur un élément
                                    // `static`, et `relative` garde le flux normal (contrairement à `absolute`).
                                    className="relative z-[1] font-serif -mt-5 mr-0 whitespace-nowrap rounded-full bg-[oklch(0.20_0.03_265)] px-2 py-0.5 text-white shadow-md md:absolute md:right-1/3 md:top-1/2 md:-mt-0 md:mr-2 md:-translate-y-1/2"
                                    style={{ fontSize: "clamp(0.7rem, 1.8cqw, 1.15rem)" }}
                                >
                                    {t(item.label)}
                                </span>
                            </Link>
                        ))}
                    </div>

                    {/* `top`/`mb` réduits sur mobile : sur une carte étroite, le badge (à taille
                        desktop) chevauchait les pastilles-labels des items voisins (positions en %
                        calibrées à la main, cf. doc-projets/parent62.md §9quater — ne pas les
                        retoucher pour compenser). Réduire le bloc titre/accroche est le seul levier
                        sûr ici. */}
                    <div className="absolute top-0 md:top-16 right-10 z-20 flex flex-col items-end gap-1 sm:gap-2 text-right">
                        {/* `translate-x-2` (au lieu de `translate-x-6`) en xs seulement : rapproche le
                            titre du bord gauche du bloc — repasse à `translate-x-6` dès `sm:`, desktop
                            inchangé. */}
                        <h2 className="translate-x-2 sm:translate-x-6">
                            {/* Couleurs FIXES, même raison que les pastilles d'item ci-dessus : pas
                                d'adaptatif clair/sombre ici. */}
                            <Badge className="rounded-none border-none -rotate-4 bg-[oklch(0.20_0.03_265)] text-white border-transparent px-2 py-1 sm:px-4 sm:py-1.5 text-2xl sm:text-3xl md:text-3xl lg:text-5xl font-serif mb-2 sm:mb-4 md:mb-10 ">
                                {t(props.headline)}
                            </Badge>
                        </h2>
                        {props.subhead && (
                            // `translate-x-2` en xs seulement : rapproche l'accroche du bord droit,
                            // dans l'autre sens que le titre ci-dessus (`sm:translate-x-0` = inchangé).
                            <p className={`max-w-32 sm:max-w-50 text-[0.65rem] sm:text-lg md:max-w-60 text-left translate-x-2 sm:translate-x-0 ${overlay ? "text-white/90" : "text-muted-foreground"}`}>
                                {t(props.subhead)}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default MapBubbles;
