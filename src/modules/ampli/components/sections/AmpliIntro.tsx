import { AmpliConfig } from "../../schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { CardsSection } from "@/components/sections/CardsSection";
import { CardsSectionProps } from "@/types/site-schema";

interface AmpliIntroProps {
    props: AmpliConfig["props"]["intro"];
}

export default function AmpliIntro({ props }: AmpliIntroProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");
    const {
        headline,
        subhead,
        items,
    } = props || {};
    const defaultCards = [
        {
            "icon": "users",
            "title": {
                "fr": "Réseau de Confiance",
                "en": "Trusted Network"
            },
            "text": {
                "fr": "Un écosystème pair-à-pair où chaque membre est validé par la communauté",
                "en": "A peer-to-peer ecosystem where each member is validated by the community"
            }
        },
        {
            "icon": "vote",
            "title": {
                "fr": "Validation Collective",
                "en": "Collective Validation"
            },
            "text": {
                "fr": "Vos idées sont évaluées par des pairs partageant vos valeurs",
                "en": "Your ideas are evaluated by peers who share your values"
            }
        },
        {
            "icon": "megaphone",
            "title": {
                "fr": "Amplification Mondiale",
                "en": "Global Amplification"
            },
            "text": {
                "fr": "Les meilleures propositions sont diffusées massivement en dehors du réseau",
                "en": "The best proposals are widely disseminated outside the network"
            }
        },
        {
            "icon": "zap",
            "title": {
                "fr": "Pulsation Médiatique",
                "en": "Media Pulse"
            },
            "text": {
                "fr": "Création d'un rythme régulier pour maintenir l'attention du public",
                "en": "Creation of a regular rhythm to maintain public attention"
            }
        },
        {
            "icon": "network",
            "title": {
                "fr": "Effet Réseau",
                "en": "Network Effect"
            },
            "text": {
                "fr": "Plus nous sommes nombreux, plus notre impact grandit exponentiellement",
                "en": "The more we are, the greater our impact grows exponentially"
            }
        },
        {
            "icon": "heart",
            "title": {
                "fr": "Bien Commun",
                "en": "Common Good"
            },
            "text": {
                "fr": "Chaque action vise à améliorer la société dans son ensemble",
                "en": "Every action aims to improve society as a whole"
            }
        }
    ];

    return (
        <>
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                    {headline ? t(headline) : t("AmpliIntro.headline")}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {subhead ? t(subhead) : t("AmpliIntro.subhead")}
                </p>
            </div>
            <CardsSection id="intro-section-cards" props={{ items: (items ?? defaultCards) as CardsSectionProps["items"], layout: "grid", columns: 3, variant: "default", showHeader: false, showResultCount: false, showViewToggle: false }} />
        </>
    )
}