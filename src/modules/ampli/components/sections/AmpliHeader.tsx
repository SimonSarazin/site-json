import { useT } from "@/hooks/useT";
// Set d'icônes STATIQUE → imports nommés (CLAUDE.md) : plus aucune icône ne
// vient de la config depuis que les amplis sont lus dans `costum.ampli`.
import { ListChecks, Megaphone, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBaseUrl } from "@/lib/constant/common";
import { AMPLI_SECTION_IDS } from "../../constants/sectionIds";
import { scrollToSection } from "../../utils/scrollToSection";
import { AmpliJoinButton } from "./parts/AmpliJoinButton";

interface AmpliHeaderProps {
    /** Nom de l'ampli (`costum.ampli.<slug>.name`) — titre du hero. Absent en
     *  forme de config historique : le titre générique reprend alors sa place. */
    name?: string;
}

/** Gabarit commun aux 3 appels à l'action du hero. */
const CTA_CLASS = "w-full sm:w-auto text-base sm:text-lg px-6 sm:px-8 py-6";

export default function AmpliHeader({ name }: AmpliHeaderProps) {
    const t = useT("modules/ampli");

    return (
        <section
            id="meeteem-hero-section"
            className="relative min-h-[70vh] py-16 sm:py-20 flex items-center justify-center overflow-hidden"
        >
            {/* Background */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${getBaseUrl()}/images/ampli/background.jpg)` }}
            />

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="p-4 rounded-full bg-primary/20 backdrop-blur-xs">
                            <Megaphone size={64} />
                        </div>
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-balance mb-4">
                        {name ?? t("AmpliHero.headline")}
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground text-pretty mb-6">
                        {t("AmpliHero.subhead")}
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
                </div>
            </div>
        </section>
    );
}
