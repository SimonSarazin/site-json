import { useState } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { type CtaNewsletterProps } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Mail } from "lucide-react";
import { Link } from "react-router";

interface CtaNewsletterSectionProps {
    id?: string;
    props: CtaNewsletterProps;
}

export function CtaNewsletter({ id, props }: CtaNewsletterSectionProps) {
    const { t } = useLocalization();
    const [email, setEmail] = useState("");
    const variant = props.variant || "primary";
    const isAccent = variant === "accent";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Newsletter subscription:", email);
        setEmail("");
    };

    const getButtonClasses = (btnVariant?: "default" | "outline" | "accent") => {
        if (btnVariant === "accent") {
            return "border-2 border-accent/50 bg-background/20 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground text-foreground";
        }
        if (btnVariant === "outline") {
            return "border-2 border-foreground/50 bg-background/20 backdrop-blur-sm hover:bg-background/40 text-foreground";
        }
        return "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow";
    };

    const BG_MAP: Record<string, string> = {
        card: "bg-card",
        muted: "bg-muted",
        primary: "bg-primary/10",
        secondary: "bg-secondary",
        accent: "bg-accent/10",
        transparent: "bg-transparent",
    };

    const defaultBg = isAccent
        ? "bg-gradient-to-br from-card/30 via-background to-card/20"
        : "bg-[image:var(--gradient-section)]";

    const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : defaultBg;

    const decorativeColor = isAccent ? "bg-accent" : "bg-chart-2";

    const inputClasses = isAccent
        ? "pl-10 h-12 bg-background/50 backdrop-blur-sm border-border/50 focus:border-primary text-foreground placeholder:text-muted-foreground"
        : "pl-10 h-12 bg-background/50 backdrop-blur-md border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground";

    return (
        <section id={id} className={`py-24 px-4 relative overflow-hidden ${sectionBg}`}>
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className={`absolute bottom-20 right-10 w-96 h-96 ${decorativeColor} rounded-full blur-3xl animate-float`}
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-4xl text-center">
                <div className="space-y-8 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                        {t(props.headline)}
                    </h2>

                    {props.subhead && (
                        <p className="text-xl text-foreground/80 max-w-2xl mx-auto">
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
                                        className={inputClasses}
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
                                        variant="outline"
                                        size="lg"
                                        className={getButtonClasses(button.variant)}
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

export default CtaNewsletter;
