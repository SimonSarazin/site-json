import { useState, useEffect } from "react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { Header, LocalizedString } from "@/types/site-schema";
import { User, Globe, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { ClientOnly } from "../ClientOnly";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import { AuthModalLazy } from "@/modules/auth";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderCommuneTransparenteProps {
    header: Header & {
        logoTitle?: LocalizedString;
        logoIcon?: string;
        ctaButton?: {
            label: LocalizedString;
            path?: string;
        };
    };
}

export default function HeaderCommuneTransparente({ header }: HeaderCommuneTransparenteProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const { currentLocale, setLocale, availableLocales } = useLocalization();
    const navigate = useNavigate();
    const location = useLocation();
    const { me, api, entity } = useCocolight();

    const isNavItemActive = (itemPath?: string) => {
        if (!itemPath) return false;
        if (itemPath === "/" && location.pathname === "/") return true;
        if (itemPath !== "/" && location.pathname.startsWith(itemPath)) return true;
        return false;
    };

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [location.pathname]);

    const profilThumbImageUrl = useReactiveProperty<string>(me?.serverData, "profilThumbImageUrl") ?? null;
    const name = useReactiveProperty<string>(me?.serverData, "name") ?? null;

    const [loginDialogOpen, setLoginDialogOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleLogout = () => {
        if (!api) return;
        try {
            api.logout();
            navigate("/");
        } catch (err) {
            console.error("Logout error", err);
        }
    };

    const getProfileUrl = () => {
        if (!me?.serverData?.slug) return "/profile";
        return `/profil/${me.serverData.slug}`;
    };

    // Header bg: dark purple, transparent on homepage hero only
    const headerBg =
        (isScrolled || location.pathname !== "/")
            ? "bg-ct-header backdrop-blur-sm shadow-lg"
            : "bg-transparent";
    
    const dataCostum = entity?.serverData?.costum as Record<string, unknown> | undefined;
    const slug = entity?.serverData?.slug;
    // Créer des variables locales pour logo et logoTitle au lieu de modifier les props
    const preUrl = (slug  == "etangsale1" || slug == "tampon" || slug  == "saintbenoit4" || slug == "saintemarie1" || slug  == "saintpaul4") ? "https://communecter.org" : ""; 
    const logo = dataCostum?.transparentCommune
        ?  preUrl + (dataCostum?.logo as string || dataCostum?.bannerLogoUrl as string) || header.logo || ""
        : header.logo;
        
    const logoTitle = dataCostum?.transparentCommune
        ? { fr: entity?.serverData?.name || "Votre ville", en: entity?.serverData?.name || "Your city" }
        : header.logoTitle;
    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo */}
                    <Link
                        to={header.path || "/"}
                        className="flex items-center gap-2 cursor-pointer group"
                    >
                        {logo ? (
                            <img
                                src={`${logo}`}
                                alt={header.logoAlt ? t(header.logoAlt) : ""}
                                className="h-9 w-auto object-contain group-hover:scale-105 transition-transform"
                            />
                        ) : header.logoIcon ? (
                            <IconOrSvg
                                value={header.logoIcon}
                                className="w-8 h-8 text-primary group-hover:scale-110 transition-transform"
                            />
                        ) : null}
                        {logoTitle && (
                            <span className="text-white font-bold text-lg hidden sm:block">
                                {t(logoTitle)}
                            </span>
                        )}
                    </Link>

                    {/* Desktop navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {header.nav?.map((item, idx) => (
                            item.path ? (
                                <Link
                                    key={idx}
                                    to={item.path}
                                    className={`
                                        px-3 py-2 text-base font-medium rounded-md transition-all duration-200
                                        ${isNavItemActive(item.path)
                                            ? "text-white bg-white/20"
                                            : "text-white/80 hover:text-white hover:bg-white/10"
                                        }
                                    `}
                                >
                                    {t(item.label)}
                                </Link>
                            ) : item.href ? (
                                <a
                                    key={idx}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 text-base font-medium text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all"
                                >
                                    {t(item.label)}
                                </a>
                            ) : null
                        ))}
                    </div>

                    {/* Right utilities */}
                    <div className="flex items-center gap-2">
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {/* Lang switcher */}
                        {header.utilities?.langSwitch && availableLocales.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 gap-1 px-2">
                                        <Globe className="h-4 w-4" />
                                        <span className="text-xs uppercase hidden sm:inline">{currentLocale}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-30">
                                    {availableLocales.map((locale) => (
                                        <DropdownMenuItem
                                            key={locale}
                                            onClick={() => setLocale(locale)}
                                            className={currentLocale === locale ? "font-semibold bg-primary/10" : ""}
                                        >
                                            {locale.toUpperCase()}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* Auth */}
                        {header.utilities?.auth && (
                            <ClientOnly>
                                {() => me ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex items-center gap-2 focus:outline-none group">
                                                {profilThumbImageUrl ? (
                                                    <img
                                                        src={profilThumbImageUrl}
                                                        alt={name || "Profile"}
                                                        className="w-8 h-8 rounded-full object-cover border-2 border-white/40 group-hover:border-white/70 transition-all"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-primary/80 border-2 border-white/40 flex items-center justify-center group-hover:border-white/70 transition-all">
                                                        <User className="w-4 h-4 text-white" />
                                                    </div>
                                                )}
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => navigate(getProfileUrl())}>
                                                <User className="w-4 h-4 mr-2" />
                                                {name || t({ fr: "Mon profil", en: "My profile" })}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                                <LogOut className="w-4 h-4 mr-2" />
                                                {t({ fr: "Se déconnecter", en: "Sign out" })}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-white border-white/40 hover:bg-white/10 hover:border-white/70 bg-transparent text-xs sm:text-sm"
                                        onClick={() => setLoginDialogOpen(true)}
                                    >
                                        {header.ctaButton?.label
                                            ? t(header.ctaButton.label)
                                            : t({ fr: "Se connecter", en: "Sign in" })}
                                    </Button>
                                )}
                            </ClientOnly>
                        )}

                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-all"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-ct-header border-t border-white/10 px-4 py-3 space-y-1">
                    {header.nav?.map((item, idx) =>
                        item.path ? (
                            <Link
                                key={idx}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`
                                    block px-3 py-2 rounded-md text-sm font-medium transition-all
                                    ${isNavItemActive(item.path)
                                        ? "text-white bg-white/20"
                                        : "text-white/80 hover:text-white hover:bg-white/10"
                                    }
                                `}
                            >
                                {t(item.label)}
                            </Link>
                        ) : null
                    )}
                </div>
            )}

            {/* Login / inscription / récupération mot de passe */}
            <AuthModalLazy open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
        </nav>
    );
}
