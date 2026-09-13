import { AmpliConfig } from "../../schema";
import { useT } from "@/hooks/useT";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
// Set d'icônes STATIQUE (les 2 CTA de contenu) → imports nommés. Seule l'icône
// du hero vient de la config, elle seule justifie `DynamicIcon` (CLAUDE.md).
import { ListChecks, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBaseUrl } from "@/lib/constant/common";
import { AMPLI_SECTION_IDS } from "../../constants/sectionIds";
import { scrollToSection } from "../../utils/scrollToSection";
import { AmpliJoinButton } from "./parts/AmpliJoinButton";

interface AmpliHeaderProps {
    props: AmpliConfig["props"]["hero"];
}

/** Gabarit commun aux 3 appels à l'action du hero. */
const CTA_CLASS = "w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6";

export default function AmpliHeader({ props }: AmpliHeaderProps) {
    const t = useT("modules/ampli");

    const {
        headline,
        subhead,
        icon,
        videoBg,
        backgroundImage,
        listContent
    } = props || {};

    return (
        <section
            id="meeteem-hero-section"
            className="relative min-h-[70vh] py-16 sm:py-20 flex items-center justify-center overflow-hidden"
        >
            {/* Background */}
            {!videoBg && (
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${backgroundImage ? backgroundImage : getBaseUrl() + '/images/ampli/background.jpg'})` }}
                />
            )}

            {videoBg && (
                <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                >
                    <source src={videoBg} type="video/mp4" />
                </video>
            )}

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="mb-4 flex justify-center">
                        <div className={`p-4 rounded-full bg-primary/20${(!icon || (icon && icon.backdrop)) ? ' backdrop-blur-xs' : ''}`}>
                            <DynamicIcon
                                name={icon?.name as IconName || 'megaphone'}
                                size={icon?.size || 64}
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-balance mb-4">
                        {t(headline ?? "AmpliHero.headline")}
                    </h1><p className="text-base sm:text-lg text-muted-foreground text-pretty mb-6">
                        {t(subhead ?? "AmpliHero.subhead")}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
                        {/* « Proposer une idée » mène AU formulaire de la page, celui
                            de la section « Proposez votre idée » — et pas à une
                            seconde copie en modale : deux surfaces pour un même
                            formulaire, c'est deux brouillons et deux états. Le focus
                            est posé sur le premier champ, on arrive prêt à écrire. */}
                        <Button
                            key="proposal-btn"
                            variant="secondary"
                            size="lg"
                            className={CTA_CLASS}
                            onClick={() => scrollToSection(AMPLI_SECTION_IDS.FEATURES, { focus: true })}
                        >
                            <MessageSquareText />
                            {t("AmpliHero.proposal")}
                        </Button>
                        <Button
                            key="browse-btn"
                            variant="secondary"
                            size="lg"
                            className={CTA_CLASS}
                            onClick={() => scrollToSection(AMPLI_SECTION_IDS.MESSAGES)}
                        >
                            <ListChecks />
                            {t("AmpliHero.browse")}
                        </Button>
                        <AmpliJoinButton key="join-btn" className={CTA_CLASS} />
                    </div>

                    {listContent && listContent.items && listContent.items.length > 0 && (
                        <div className={`mt-8 flex gap-6 flex-wrap items-center justify-center ${listContent.layout === 'rows' ? 'flex-row' : 'flex-col'}`}>
                            {listContent.items.map((item, index) => (
                                <div
                                    key={index}
                                    className={`flex ${item.iconPosition === 'top' ? 'flex-col items-center text-center' :
                                        item.iconPosition === 'right' ? 'flex-row-reverse items-start' :
                                            item.iconPosition === 'bottom' ? 'flex-col-reverse items-center text-center' :
                                                'flex-row items-center'
                                        } gap-2`}
                                >
                                    {item.icon && (
                                        <div className="shrink-0">
                                            <DynamicIcon
                                                name={item.icon as IconName}
                                                size={24}
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{t(item.title)}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}