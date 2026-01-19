import { useState } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail } from "lucide-react";
import { Link } from "react-router";

export interface CallToActionRezoLaMerProps {
    headline: LocalizedString;
    subhead?: LocalizedString;
    newsletterPlaceholder?: LocalizedString;
    newsletterButtonLabel?: LocalizedString;
    newsletterDisclaimer?: LocalizedString;
    buttons?: Array<{
        label: LocalizedString;
        href: string;
        variant?: "default" | "outline";
    }>;
}

interface CallToActionRezoLaMerSectionProps {
    id?: string;
    props: CallToActionRezoLaMerProps;
}

export function CallToActionRezoLaMer({ id, props }: CallToActionRezoLaMerSectionProps) {
    const { t } = useLocalization();
    const [email, setEmail] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Newsletter subscription:", email);
        setEmail("");
    };

    return (
        <section id={id} className="py-24 px-4 bg-ocean-gradient relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-20 left-10 w-64 h-64 bg-turquoise rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-bright rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-4xl text-center">
                <div className="space-y-8 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl font-bold text-ocean-text-light">
                        {t(props.headline)}
                    </h2>

                    {props.subhead && (
                        <p className="text-xl text-ocean-foam max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}

                    {props.newsletterPlaceholder && (
                        <form onSubmit={handleSubmit} className="max-w-md mx-auto pt-8">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ocean-text-muted" />
                                    <Input
                                        type="email"
                                        placeholder={t(props.newsletterPlaceholder)}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-12 bg-ocean-deep/50 backdrop-blur-ocean border-turquoise/30 focus:border-turquoise text-ocean-text-light placeholder:text-ocean-text-muted"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="lg"
                                    className="h-12 px-8 bg-turquoise hover:bg-turquoise/90 text-ocean-deep shadow-glow"
                                >
                                    {props.newsletterButtonLabel
                                        ? t(props.newsletterButtonLabel)
                                        : "S'inscrire"}
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                            {props.newsletterDisclaimer && (
                                <p className="text-sm text-ocean-text-muted mt-3">
                                    {t(props.newsletterDisclaimer)}
                                </p>
                            )}
                        </form>
                    )}

                    {props.buttons && props.buttons.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
                            {props.buttons.map((button, index) => (
                                <Link key={index} to={button.href}>
                                    <Button
                                        variant={button.variant || "outline"}
                                        size="lg"
                                        className={
                                            button.variant === "outline"
                                                ? "border-2 border-ocean-text-light/50 bg-ocean-deep/20 backdrop-blur-ocean hover:bg-ocean-deep/40 text-ocean-text-light"
                                                : "bg-turquoise hover:bg-turquoise/90 text-ocean-deep shadow-glow"
                                        }
                                    >
                                        {t(button.label)}
                                    </Button>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default CallToActionRezoLaMer;
