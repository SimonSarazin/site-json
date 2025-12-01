import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { AmpliConfig } from "../../schema";
import { useT } from "@/hooks/useT";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import { Button } from "@/components/ui/button";
import { getBaseUrl } from "@/lib/constant/common";

interface AmpliHeaderProps {
    props: AmpliConfig["props"]["hero"];
    form: AmpliConfig["props"]["coform"];
}

export default function AmpliHeader({ props, form }: AmpliHeaderProps) {
    useLoadNamespace("modules/ampli");
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
            className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
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
                    <h1 className="text-4xl font-bold text-foreground mb-4">
                        {t(headline ?? "AmpliHero.headline")}
                    </h1><p className="text-lg text-muted-foreground mb-6">
                        {t(subhead ?? "AmpliHero.subhead")}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
                        <Button
                            key="proposal-btn"
                            variant="secondary"
                            size="lg"
                            className="text-lg px-8 py-6"
                        // onClick={() => handleCTAClick(Button.href)}
                        >
                            <DynamicIcon
                                name="message-square-text"
                                size={64}
                            />
                            {t("AmpliHero.proposal")}
                        </Button>
                        <Button
                            key="join-btn"
                            variant="secondary"
                            size="lg"
                            className="text-lg px-8 py-6"
                        // onClick={() => handleCTAClick(Button.href)}
                        >
                            <DynamicIcon
                                name="user-round-plus"
                                size={64}
                            />
                            {t("AmpliHero.join")}
                        </Button>
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