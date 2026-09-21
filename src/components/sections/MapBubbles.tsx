import { useId } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { type MapBubblesProps } from "@/types/site-schema";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";
import { tooltipAnchorClass } from "./mapBubbleTooltip";

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
    const idInfobulles = useId();
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
                        // `dark:brightness-75` : l'illustration (carte + lavis, cuits dans
                        // l'image) garde sa pleine luminosité de jour ; en sombre elle est
                        // tamisée — sans ça, la section reste le bloc le plus lumineux d'une
                        // page de nuit (assombrir le dégradé DERRIÈRE ne suffit pas, l'image
                        // le recouvre presque entièrement).
                        <img
                            src={props.backgroundImage}
                            alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                            className="block w-full h-auto select-none dark:brightness-75"
                        />
                    ) : (
                        <div className="aspect-4/3" />
                    )}

                    <div className="absolute inset-0">
                        {props.items.map((item, index) => (
                            <Link
                                key={index}
                                to={item.href}
                                aria-describedby={item.cities ? `${idInfobulles}-${index}` : undefined}
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
                                {item.cities && (
                                    <span
                                        id={`${idInfobulles}-${index}`}
                                        // Villes du territoire, au survol comme au focus clavier.
                                        // `pointer-events-none` : ne jamais intercepter le clic du lien.
                                        // Dès `md:`, l'infobulle part du MILIEU de la bulle, où la pastille du nom
                                        // est ancrée : sous le bas du rond, elle s'en détachait de 40 px.
                                        className={`pointer-events-none absolute top-full z-30 mt-2 w-44 md:top-1/2 md:mt-4 rounded-lg bg-[oklch(0.20_0.03_265)] px-3 py-2 text-center text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${tooltipAnchorClass(item.x)}`}
                                    >
                                        {t(item.cities)}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* `top`/`mb` réduits sur carte étroite : le badge à taille desktop chevauchait
                        les pastilles-labels des items voisins (positions en % calibrées à la main,
                        cf. doc-projets/parent62.md §9quater — ne pas les retoucher pour compenser).
                        Réduire le bloc titre/accroche est le seul levier sûr ici.

                        TOUS les paliers sont des `@`-queries sur `@container/map-bubbles`, jamais des
                        breakpoints de viewport : ce qui compte est la largeur de LA CARTE, pas celle
                        de l'écran. Une carte peut être étroite sur un grand écran — c'est le cas dès
                        qu'un `gridLayout` la met en colonne (accueil parent62) : le viewport valait
                        alors 1440px, `md:`/`lg:` s'appliquaient, et le bloc reprenait sa taille
                        desktop par-dessus les bulles. Les paliers BAS ont suivi pour la même raison :
                        les croire réservés au mobile supposait qu'une carte étroite implique un petit
                        écran — faux dès qu'un zoom navigateur met une colonne de 350px sous un
                        viewport de 960px, où `sm:` rendait le texte en taille tablette. */}
                    {/* TITRE en haut à GAUCHE, et l'accroche seule à droite (bloc suivant) : les deux
                        vivaient ensemble à droite, ce qui plaçait la pastille « Territoires » à l'opposé
                        de celle du bloc voisin « À la une ». Les aligner demande de les séparer. Le coin
                        haut-gauche de l'illustration est la mer — aucune pastille de territoire n'y est
                        posée, le badge ne masque donc rien. */}
                    <div className="absolute top-0 left-0 z-20 flex flex-col items-start">
                        <h2>
                            {/* Couleurs FIXES, même raison que les pastilles d'item ci-dessus : pas
                                d'adaptatif clair/sombre ici. */}
                            <Badge className="rounded-none border-none -rotate-4 bg-[oklch(0.20_0.03_265)] text-white border-transparent px-2 py-1 @sm/map-bubbles:px-4 @sm/map-bubbles:py-1.5 text-xl @sm/map-bubbles:text-3xl @4xl/map-bubbles:text-5xl font-serif mb-2 @sm/map-bubbles:mb-4 @3xl/map-bubbles:mb-10 ">
                                {t(props.headline)}
                            </Badge>
                        </h2>
                    </div>

                    {/* Accroche : reste à DROITE, en vis-à-vis du titre. Décalée vers le bas d'autant que
                        le badge est haut, sinon les deux se retrouvent sur la même ligne d'yeux. */}
                    {props.subhead && (
                        <div className="absolute top-12 @sm/map-bubbles:top-16 @3xl/map-bubbles:top-28 right-6 @sm/map-bubbles:right-10 z-20 flex justify-end">
                            <p className={`max-w-32 @sm/map-bubbles:max-w-50 text-[0.65rem] @sm/map-bubbles:text-lg @3xl/map-bubbles:max-w-60 text-left ${overlay ? "text-white/90" : "text-muted-foreground"}`}>
                                {t(props.subhead)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default MapBubbles;
