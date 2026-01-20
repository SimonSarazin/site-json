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
                <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-20 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-4xl text-center">
                <div className="space-y-8 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                        {t(props.headline)}
                    </h2>

                    {props.subhead && (
                        <p className="text-xl text-muted max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}

                    {props.newsletterPlaceholder && (
                        <form onSubmit={handleSubmit} className="max-w-md mx-auto pt-8">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        placeholder={t(props.newsletterPlaceholder)}
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-10 h-12 bg-background/50 backdrop-blur-ocean border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="lg"
                                    className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                                >
                                    {props.newsletterButtonLabel
                                        ? t(props.newsletterButtonLabel)
                                        : "S'inscrire"}
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                            {props.newsletterDisclaimer && (
                                <p className="text-sm text-muted-foreground mt-3">
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
                                                ? "border-2 border-foreground/50 bg-background/20 backdrop-blur-ocean hover:bg-background/40 text-foreground"
                                                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
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
