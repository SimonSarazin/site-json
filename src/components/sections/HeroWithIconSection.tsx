import { useLocalization } from "@/hooks/useLocalization";
import { type HeroWithIconSectionProps } from "@/types/site-schema";
import { useNavigate } from "react-router";
import { Button } from "../ui/button";
import { DynamicIcon, IconName } from "lucide-react/dynamic";

export function HeroWithIconSection({ id, props }: { id?: string, props: HeroWithIconSectionProps }) {
    const { t } = useLocalization();
    const navigate = useNavigate();

    const {
        headline,
        subhead,
        backgroundImage,
        videoBg,
        align = 'center',
        overlay = false,
        cta,
        icon,
        listContent
    } = props;

    const handleScrollTo = (target: string) => {
        const element = document.querySelector(target);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleCTAClick = (href: string) => {
        if (href.startsWith('#')) {
            handleScrollTo(href);
        } else if (href.startsWith('http') || href.startsWith('//')) {
            window.open(href, '_blank', 'noopener,noreferrer');
        } else {
            navigate(href);
        }
    };

    return (
        <section
            id={id}
            className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
        >
            {/* Background */}
            {backgroundImage && (
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
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

            {/* Overlay */}
            {overlay && (backgroundImage || videoBg) && (
                <div className="absolute inset-0 bg-black/50" />
            )}

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className={`max-w-4xl mx-auto text-${align}`}>
                    {icon && icon.show && (
                        <div className="mb-4 flex justify-center">
                            <div className={`p-4 rounded-full bg-primary/20${icon.backdrop ? ' backdrop-blur-xs' : ''}`}>
                                <DynamicIcon
                                    name={icon.name as IconName}
                                    size={icon.size || 64}
                                />
                            </div>
                        </div>
                    )}
                    {headline && (
                        <h1 className="text-4xl font-bold text-foreground mb-4">
                            {t(headline)}
                        </h1>
                    )}
                    {subhead && (
                        <p className="text-lg text-muted-foreground mb-6">
                            {t(subhead)}
                        </p>
                    )}

                    {cta && cta.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-400">
                            {cta.map((button, index) => (
                                <Button
                                    key={index}
                                    variant={button.variant === 'secondary' ? 'secondary' : 'default'}
                                    size="lg"
                                    className="text-lg px-8 py-6"
                                    onClick={() => handleCTAClick(button.href)}
                                >
                                    {button.icon && (
                                        <DynamicIcon
                                            name={button.icon as IconName}
                                            size={64}
                                        />
                                    )}
                                    {t(button.label)}
                                </Button>
                            ))}
                        </div>
                    )}

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
                                        <div className="flex-shrink-0">
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
};