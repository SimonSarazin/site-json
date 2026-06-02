import { useState, useEffect } from "react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { Header } from "@/types/site-schema";
import { ChevronDown, User, LogOut, Globe, Menu, X } from "lucide-react";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
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
import { AuthModalLazy } from "@/modules/auth";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { PiggyBankHeaderButton } from "@/modules/cagnotte/components/PiggyBankHeaderButton";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderRezoLaMerProps {
    header: Header;
}

type HeaderNavItem = Header['nav'][number];

export default function HeaderRezoLaMer({ header }: HeaderRezoLaMerProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const { currentLocale, setLocale, availableLocales } = useLocalization();
    const navigate = useNavigate();
    const location = useLocation();
    const { me, api } = useCocolight();

    const isNavItemActive = (itemPath?: string) => {
        if (!itemPath) return false;
        if (itemPath === "/" && location.pathname === "/") return true;
        if (itemPath !== "/" && location.pathname.startsWith(itemPath)) return true;
        return false;
    };

    const isPathInsideNav = (items: HeaderNavItem[]): boolean => {
        return items.some(item => {
            if (isNavItemActive(item.path)) return true;
            if (item.children?.length) {
                return isPathInsideNav(item.children as HeaderNavItem[]);
            }
            return false;
        });
    };

    useEffect(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [location.pathname]);

    const profilThumbImageUrl = useReactiveProperty<string>(me?.serverData, 'profilThumbImageUrl') ?? null;
    const name = useReactiveProperty<string>(me?.serverData, 'name') ?? null;
    const email = useReactiveProperty<string>(me?.serverData, 'email') ?? null;

    const [loginDialogOpen, setLoginDialogOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    const shouldHideNav = Boolean(
        header.navVisibleOnlyForListedPages && !isPathInsideNav(header.nav)
    );

    const secondaryNavItems = (header.secondaryNav ?? []) as HeaderNavItem[];
    const shouldHideSecondaryNav = Boolean(
        secondaryNavItems.length > 0
        && header.secondaryNavVisibleOnlyForListedPages
        && !isPathInsideNav(secondaryNavItems)
    );

    const navItemsToDisplay = !shouldHideNav
        ? header.nav
        : (!shouldHideSecondaryNav ? secondaryNavItems : []);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = () => {
        if (!api) return;
        try {
            api.logout();
            navigate('/');
        } catch (err) {
            console.error('Logout error', err);
        }
    };

    const getProfileUrl = () => {
        if (!me?.serverData?.slug) return '/profile';
        return `/profil/${me.serverData.slug}`;
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-background/90 backdrop-blur-ocean shadow-ocean' : 'bg-transparent'}`}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    <Link to={header.path || "/"} className="flex items-center gap-3 cursor-pointer group">
                        {header.logo ? (
                            <img
                                src={`/${header.logo}`}
                                alt={header.logoAlt ? t(header.logoAlt) : ""}
                                className="h-8 w-8 object-contain group-hover:scale-110 transition-transform"
                            />
                        ) : header.logoIcon ? (
                            <IconOrSvg
                                value={header.logoIcon}
                                className="w-8 h-8 text-primary group-hover:scale-110 transition-transform"
                            />
                        ) : null}
                        {header.logoTitle && (
                            <span className="text-xl font-bold text-foreground">{t(header.logoTitle)}</span>
                        )}
                    </Link>

                    <div className="hidden md:flex items-center gap-8">
                        {navItemsToDisplay.map((item, idx) => {
                            const isActive = isNavItemActive(item.path);
                            const hasChildren = !!item.children?.length;
                            return (
                                <div key={idx} className="relative group">
                                    <Link
                                        to={item.path || "#"}
                                        className={`transition-colors font-medium relative group ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'} ${hasChildren ? 'transition flex items-center gap-1' : ''}`}
                                    >
                                        {t(item.label)}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                        <span className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                                    </Link>
                                    {hasChildren && item.children && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-60">
                                            {item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <Link key={i} to={sub.path || "#"} className="block">
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {item.children.map((sub, i) => (
                                                        <Link key={i} to={sub.path || "#"} className="block">
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {header.utilities?.piggyBank && (
                            // ClientOnly : la cagnotte est member-only (le composant lit `me`
                            // pour décider de rendre ou pas). Sans ClientOnly, SSR rend le bouton
                            // (me=null → null), client le rend après auth → hydration mismatch
                            // (cf. PiggyBankHeaderButton:if (!me?.id) return null).
                            <ClientOnly>
                                {() => <PiggyBankHeaderButton />}
                            </ClientOnly>
                        )}

                        {header.urgenceButton && (
                            <Link
                                to={header.urgenceButton.path || "#"}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 hover:bg-accent/30 text-primary transition-all group"
                            >
                                {header.urgenceButton.icon ? (
                                    <IconOrSvg
                                        value={header.urgenceButton.icon}
                                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                                    />
                                ) : null}
                                <span className="font-semibold text-sm">{t(header.urgenceButton.label)}</span>
                            </Link>
                        )}

                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-10 h-10" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}

                        {header.utilities?.langSwitch && availableLocales.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10">
                                        <Globe className="h-4 w-4" />
                                        {currentLocale.toUpperCase()}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-background border-secondary">
                                    {availableLocales.map(loc => (
                                        <DropdownMenuItem
                                            key={loc}
                                            onClick={() => setLocale(loc)}
                                            className={`text-muted-foreground hover:text-primary hover:bg-secondary/50 ${loc === currentLocale ? 'bg-secondary/30' : ''}`}
                                        >
                                            {loc.toUpperCase()}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    <div className="hidden md:block">
                        {header.utilities?.auth && (
                            <ClientOnly fallback={<Button variant="ghost" disabled size="sm">…</Button>}>
                                {() => (
                                    <>
                                        {me?.isConnected ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium shadow-glow transition-all">
                                                        {profilThumbImageUrl ? (
                                                            <img
                                                                src={profilThumbImageUrl}
                                                                alt={name || 'Profile'}
                                                                className="w-6 h-6 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <User className="w-4 h-4" />
                                                        )}
                                                        <span className="truncate max-w-25">
                                                            {name || email || t('Mon compte')}
                                                        </span>
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 bg-background border-secondary">
                                                    <DropdownMenuItem onClick={() => navigate(getProfileUrl())} className="text-muted-foreground hover:text-primary hover:bg-secondary/50">
                                                        <User className="mr-2 h-4 w-4" />
                                                        {t('Profil')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={handleLogout} className="text-muted-foreground hover:text-primary hover:bg-secondary/50">
                                                        <LogOut className="mr-2 h-4 w-4" />
                                                        {t('Se déconnecter')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <button
                                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium shadow-glow transition-all"
                                                onClick={() => setLoginDialogOpen(true)}
                                            >
                                                {header.ctaButton ? t(header.ctaButton.label) : t('Rejoindre')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </ClientOnly>
                        )}
                        {!header.utilities?.auth && header.ctaButton && (
                            <Link
                                to={header.ctaButton.path || "#"}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium shadow-glow transition-all"
                            >
                                {t(header.ctaButton.label)}
                            </Link>
                        )}
                    </div>

                    <div className="md:hidden flex items-center gap-2">
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}
                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-8 h-8" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}
                        {navItemsToDisplay.length > 0 && (
                            <button
                                className="p-2 text-muted-foreground hover:text-primary"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Toggle menu"
                            >
                                {mobileMenuOpen ? (
                                    <X className="w-6 h-6" />
                                ) : (
                                    <Menu className="w-6 h-6" />
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {mobileMenuOpen && navItemsToDisplay.length > 0 && (
            <div className="md:hidden bg-background/95 backdrop-blur-ocean border-t border-secondary/50 animate-fade-in-up">
                <div className="container mx-auto px-4 py-4 space-y-3">
                    {navItemsToDisplay.map((item, idx) => {
                        const isActive = isNavItemActive(item.path);
                        return (
                            <Link
                                key={idx}
                                to={item.path || "#"}
                                className={`block py-2 transition-colors ${isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {t(item.label)}
                            </Link>
                        );
                    })}

                    {header.urgenceButton && (
                        <Link
                            to={header.urgenceButton.path || "#"}
                            className="w-full flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            <span className="flex items-center gap-2">
                                {header.urgenceButton.icon ? (
                                    <IconOrSvg
                                        value={header.urgenceButton.icon}
                                        className="w-5 h-5"
                                    />
                                ) : null}
                                <span className="font-medium">{t(header.urgenceButton.label)}</span>
                            </span>
                        </Link>
                    )}

                    {header.utilities?.langSwitch && availableLocales.length > 1 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-2 w-full justify-start text-muted-foreground hover:text-primary hover:bg-primary/10">
                                    <Globe className="h-4 w-4" />
                                    {currentLocale.toUpperCase()}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-background border-secondary">
                                {availableLocales.map(loc => (
                                    <DropdownMenuItem
                                        key={loc}
                                        onClick={() => setLocale(loc)}
                                        className={`text-muted-foreground hover:text-primary hover:bg-secondary/50 ${loc === currentLocale ? 'bg-secondary/30' : ''}`}
                                    >
                                        {loc.toUpperCase()}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {header.utilities?.auth && (
                        <ClientOnly fallback={<div className="h-10" />}>
                            {() => (
                                <>
                                    {me?.isConnected ? (
                                        <div className="space-y-2 pt-2 border-t border-secondary/30">
                                            <button
                                                onClick={() => {
                                                    navigate(getProfileUrl());
                                                    setMobileMenuOpen(false);
                                                }}
                                                className="w-full text-left py-2 text-muted-foreground hover:text-primary flex items-center gap-2"
                                            >
                                                <User className="w-4 h-4" />
                                                {t('Profil')}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    handleLogout();
                                                    setMobileMenuOpen(false);
                                                }}
                                                className="w-full text-left py-2 text-muted-foreground hover:text-primary flex items-center gap-2"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                {t('Se déconnecter')}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
                                            onClick={() => {
                                                setLoginDialogOpen(true);
                                                setMobileMenuOpen(false);
                                            }}
                                        >
                                            {header.ctaButton ? t(header.ctaButton.label) : t('Rejoindre')}
                                        </button>
                                    )}
                                </>
                            )}
                        </ClientOnly>
                    )}
                    {!header.utilities?.auth && header.ctaButton && (
                        <Link
                            to={header.ctaButton.path || "#"}
                            className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-center block"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t(header.ctaButton.label)}
                        </Link>
                    )}
                </div>
            </div>
            )}

            <AuthModalLazy open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
        </nav>
    );
}
