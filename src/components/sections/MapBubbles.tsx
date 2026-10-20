import { useId, type ReactNode } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { type MapBubblesProps } from "@/types/site-schema";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";
import { tooltipAnchorClass } from "./mapBubbleTooltip";
import { sectionBadgeClass, sectionHeadlineStyle } from "./sectionBadge";

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

/** Marine des pastilles de la carte — couleur FIXE, identique en clair et en sombre (cf. items). */
const MARINE_FIXE = "oklch(0.20 0.03 265)";

/** Entrée des bulles (`animate`) : apparition zoomée en cascade — `tw-animate-css`, uniquement si
 *  l'utilisateur accepte le mouvement. `fill-mode-backwards` : invisible pendant son délai. */
const ENTREE = "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:duration-700 motion-safe:fill-mode-backwards";

/**
 * Respiration en boucle (`animate`) : rond ET étiquette clignotent ensemble — DEPUIS LEUR CENTRE,
 * en `scale` SEUL (`blink-scale`) — PAS `pulse-glow` (qui fait aussi varier l'opacité 0.5→0.8) :
 * ça délavait la couleur de marque des pastilles, qui doit rester pleine en permanence. PAS
 * `animate-float` (translation verticale) non plus : sur une bulle proche d'un bord de la carte
 * (ex. en haut à droite), la translation la faisait déraper hors de sa position d'ancrage au lieu
 * de respirer sur place. Déphasée par bulle pour ne pas battre à l'unisson. Hors `animate`, aucune
 * boîte n'est ajoutée : le rendu historique est intact.
 */
function Flottant({ actif, index, children }: { actif?: boolean; index: number; children: ReactNode }) {
    if (!actif) return <>{children}</>;
    return (
        <span
            className="relative flex w-full flex-col items-center motion-safe:animate-blink-scale"
            style={{ animationDelay: `${(index % 4) * 0.7}s` }}
        >
            {children}
        </span>
    );
}

export function MapBubbles({ id, props }: MapBubblesSectionProps) {
    const { t } = useLocalization();
    const anime = props.animate === true;
    const idInfobulles = useId();
    const enCarte = props.design === "card";
    const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : "";
    const overlay = props.backgroundOverlay;
    // En habillage « carte », le fond (image ou dégradé CSS) habille la SEULE illustration : la carte
    // qui porte le bloc garde son fond, et titre comme accroche s'y lisent en encre de thème.
    // `illustrationBackgroundImage` prime (ex. un dégradé déjà cuit en PNG, plus fidèle qu'un
    // `linear-gradient` CSS reconstruit à la main) ; sinon repli sur `backgroundOverlay`.
    const voileIllustration = enCarte && props.illustrationBackgroundImage
        ? { backgroundImage: `url(${props.illustrationBackgroundImage})`, backgroundSize: "cover", backgroundPosition: "center" }
        : enCarte && overlay
        ? { background: `linear-gradient(${overlay.angle ?? 90}deg, ${overlay.from}, ${overlay.to})` }
        : undefined;

    return (
        <section id={id} className={`relative px-4 ${enCarte ? "flex h-full flex-col rounded-2xl pt-4 pb-4" : "py-16"} ${sectionBg}`}>
            {overlay && !enCarte && (
                <div
                    // `rounded-[inherit]` : le voile suit les coins de la section, qui les porte en
                    // habillage « carte » — sinon ses angles carrés dépassent de la carte arrondie.
                    className="absolute inset-0 z-0 rounded-[inherit]"
                    style={{ background: `linear-gradient(${overlay.angle ?? 90}deg, ${overlay.from}, ${overlay.to})` }}
                />
            )}

            <div className={`relative z-10 container mx-auto max-w-6xl ${enCarte ? "flex flex-1 flex-col" : ""}`}>
                {/* Habillage « carte » : l'étiquette déborde du haut de la carte qui porte le bloc, et
                    l'accroche se lit dessous — l'illustration vit alors sur son propre aplat arrondi,
                    au lieu de servir de fond au titre. */}
                {enCarte && (
                    <>
                        {/* DANS la carte (flux normal), pas flottante au-dessus de son bord — couleurs FIXES
                            (config ou marine par défaut), comme les pastilles d'item : pas d'adaptatif
                            clair/sombre. */}
                        <h2 className="mb-2">
                            <Badge
                                style={sectionHeadlineStyle(props.headlineStyle, props.badgeColor ?? MARINE_FIXE, props.badgeTextColor)}
                                className={`${sectionBadgeClass(props.headlineStyle)} gap-2`}
                            >
                                {props.headlineIcon && (
                                    <DynamicIcon
                                        name={props.headlineIcon as IconName}
                                        className="shrink-0"
                                        // `1em` : aussi grand que le TEXTE du titre (sa taille de police), pas une
                                        // taille fixe qui dériverait du texte au prochain changement de palier.
                                        style={{ width: "1em", height: "1em", ...(props.headlineIconColor ? { color: props.headlineIconColor } : {}) }}
                                        aria-hidden
                                    />
                                )}
                                {t(props.headline)}
                            </Badge>
                        </h2>
                        {props.subhead && (
                            <p className="mb-3 text-sm text-muted-foreground">{t(props.subhead)}</p>
                        )}
                    </>
                )}
                {/* Habillage « carte » : le panneau (dégradé ou aplat) s'étire jusqu'au bas de la carte,
                    et l'illustration s'y centre — les bulles, elles, restent positionnées en % de
                    l'ILLUSTRATION, sinon elles dérivent dès que le panneau est plus haut qu'elle. */}
                <div
                    style={voileIllustration}
                    // `contents` hors habillage carte : la boîte disparaît de la mise en page, le rendu
                    // historique (illustration et bulles directement dans le conteneur) est intact.
                    className={enCarte ? `flex flex-1 items-center rounded-2xl p-1.5 ${voileIllustration ? "" : "bg-[var(--page-accent-soft,transparent)]"}` : "contents"}
                >
                <div
                    className={`relative w-full @container/map-bubbles ${props.illustrationMaxWidth ? "mx-auto" : ""}`}
                    style={props.illustrationMaxWidth ? { maxWidth: props.illustrationMaxWidth } : undefined}
                >
                    {(() => {
                        // OPT-IN (`illustrationMaxHeight`) : jamais automatique, pour ne pas changer le rendu
                        // d'un site qui n'a rien demandé (cf. principe moteur — une nouveauté reste un choix
                        // explicite par site). Un plafond de HAUTEUR (`max-h` + `aspect-[…]`, PAS
                        // `object-cover`) fait tenir l'illustration dans la colonne SANS rogner un seul pixel —
                        // la largeur SUIT la hauteur plafonnée au lieu de forcer la hauteur à suivre la largeur
                        // de la colonne. Boîte interne dédiée (`mx-auto`, ratio EXPLICITE via
                        // `illustrationAspectRatio` — jamais deviné : un fichier qui n'est pas au format par
                        // défaut serait étiré) : les bulles restent en % de CETTE boîte — pas du conteneur
                        // `w-full` qui la déborde une fois rétrécie — donc toujours alignées sur leur
                        // territoire.
                        const plafonner = enCarte && !!props.backgroundImage && !!props.illustrationMaxHeight;
                        const bulles = (
                            <div className="absolute inset-0">
                                {props.items.map((item, index) => (
                            <Link
                                key={index}
                                to={item.href}
                                aria-describedby={item.cities ? `${idInfobulles}-${index}` : undefined}
                                className={`group absolute z-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center hover:z-20 focus-visible:z-20 ${anime ? ENTREE : ""}`}
                                style={{ left: `${item.x}%`, top: `${item.y}%`, width: `${item.size}%`, ...(anime ? { animationDelay: `${index * 120}ms` } : {}) }}
                            >
                                <Flottant actif={anime} index={index}>
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
                                </Flottant>
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
                        );
                        const illustration = props.backgroundImage ? (
                            // `dark:brightness-75` : l'illustration (carte + lavis, cuits dans l'image)
                            // garde sa pleine luminosité de jour ; en sombre elle est tamisée — sans ça, la
                            // section reste le bloc le plus lumineux d'une page de nuit (assombrir le
                            // dégradé DERRIÈRE ne suffit pas, l'image le recouvre presque entièrement).
                            <img
                                src={props.backgroundImage}
                                alt={props.backgroundImageAlt ? t(props.backgroundImageAlt) : ""}
                                className={plafonner ? "block h-full w-full select-none object-contain dark:brightness-75" : "block w-full h-auto select-none dark:brightness-75"}
                            />
                        ) : (
                            <div className="aspect-4/3" />
                        );
                        if (plafonner) {
                            return (
                                <div
                                    className="relative mx-auto w-auto"
                                    style={{ aspectRatio: props.illustrationAspectRatio || "4/3", maxHeight: props.illustrationMaxHeight }}
                                >
                                    {illustration}
                                    {bulles}
                                </div>
                            );
                        }
                        return (
                            <>
                                {illustration}
                                {bulles}
                            </>
                        );
                    })()}

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
                    {/* Rendu CONDITIONNEL et non `hidden` : `hidden` et `flex` sont deux utilitaires
                        `display` de la même couche, c'est l'ordre d'émission Tailwind qui tranchait. */}
                    {!enCarte && (
                    <div className="z-20 flex flex-col items-start absolute top-0 left-0">
                        <h2>
                            {/* Couleurs FIXES, même raison que les pastilles d'item ci-dessus : pas
                                d'adaptatif clair/sombre ici. */}
                            <Badge className="rounded-none border-none -rotate-4 bg-[oklch(0.20_0.03_265)] text-white border-transparent px-2 py-1 @sm/map-bubbles:px-4 @sm/map-bubbles:py-1.5 text-xl @sm/map-bubbles:text-3xl @4xl/map-bubbles:text-5xl font-serif mb-2 @sm/map-bubbles:mb-4 @3xl/map-bubbles:mb-10 ">
                                {t(props.headline)}
                            </Badge>
                        </h2>
                    </div>
                    )}

                    {/* Accroche : reste à DROITE, en vis-à-vis du titre. Décalée vers le bas d'autant que
                        le badge est haut, sinon les deux se retrouvent sur la même ligne d'yeux. */}
                    {!enCarte && props.subhead && (
                        <div className="z-20 flex justify-end absolute top-12 @sm/map-bubbles:top-16 @3xl/map-bubbles:top-28 right-6 @sm/map-bubbles:right-10">
                            <p className={`max-w-32 @sm/map-bubbles:max-w-50 text-[0.65rem] @sm/map-bubbles:text-lg @3xl/map-bubbles:max-w-60 text-left ${overlay ? "text-white/90" : "text-muted-foreground"}`}>
                                {t(props.subhead)}
                            </p>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </section>
    );
}

export default MapBubbles;
