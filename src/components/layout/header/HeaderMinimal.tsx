import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import type { Header } from "@/types/site-schema";
import { ClientOnly } from "../ClientOnly";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthMenu } from "@/modules/auth";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import { Globe, Menu, X } from "lucide-react";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderMinimalProps {
    header: Header;
}

export default function HeaderMinimal({ header }: HeaderMinimalProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const { currentLocale, setLocale, availableLocales } = useLocalization();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const body = document.body;
        body.classList.remove("opacity-0", "translate-y-10");
    }, []);

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-40 nav-sticky border-b border-gray-100 bg-background/90 backdrop-blur-sm transition-colors duration-300">
                <div className="max-w-[1900px] mx-auto px-8 md:px-12 lg:px-16 py-5 flex justify-between items-center">

                    <div className="flex items-center gap-3">
                        <Link to={header.path || "/"} className="flex items-center gap-3 group">
                             {header.logo ? (
                                <img src={header.logo} alt={header.logoAlt ? t(header.logoAlt) : "Logo"} className="w-8 h-8 object-contain" />
                            ) : header.logoIcon ? (
                                <IconOrSvg value={header.logoIcon} className="w-8 h-8 text-primary" />
                            ) : null}

                            {header.logoTitle && (
                                <span className="font-bold uppercase tracking-[0.2em] text-foreground text-xs hidden md:block group-hover:text-primary transition-colors">
                                    {t(header.logoTitle)}
                                </span>
                            )}
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-[0.15em]">
                        {header.nav?.map((item, idx) => (
                            <Link
                                key={idx}
                                to={item.path || "#"}
                                className="hover:text-primary transition-colors text-foreground"
                            >
                                {t(item.label)}
                            </Link>
                        ))}

                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {header.utilities?.langSwitch && availableLocales.length > 1 && (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="hover:text-primary transition-colors flex items-center gap-1 text-foreground">
                                        <Globe className="w-4 h-4" />
                                        {currentLocale.toUpperCase()}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {availableLocales.map(loc => (
                                        <DropdownMenuItem key={loc} onClick={() => setLocale(loc)}>
                                            {loc.toUpperCase()}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-4 h-4" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}

                        {header.utilities?.auth && (
                            <AuthMenu
                                layout="menu"
                                density="compact"
                                showName
                                loginVariant="ghost"
                                loginLabel={header.ctaButton?.label}
                            />
                        )}
                    </div>

                    <div className="md:hidden flex items-center gap-4">
                         {header.utilities?.notifications && <NotificationBell />}
                         {header.utilities?.search && <CommandTriggerButton />}
                         {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-4 h-4" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-foreground">
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="md:hidden bg-background border-t border-gray-100 px-8 py-4 space-y-4 animate-in slide-in-from-top-5">
                        {header.nav?.map((item, idx) => (
                            <Link
                                key={idx}
                                to={item.path || "#"}
                                className="block text-sm font-bold uppercase tracking-[0.15em] hover:text-primary transition-colors text-foreground"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {t(item.label)}
                            </Link>
                        ))}

                        {header.utilities?.auth && (
                            <AuthMenu
                                layout="stack"
                                onAction={() => setMobileMenuOpen(false)}
                                loginVariant="ghost"
                                loginLabel={header.ctaButton?.label}
                            />
                        )}
                    </div>
                )}
            </nav>
        </>
    )
}
