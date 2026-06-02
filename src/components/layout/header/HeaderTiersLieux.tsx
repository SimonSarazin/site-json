import { useState } from "react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { Header } from "@/types/site-schema";
import { ChevronDown, User, LogOut, Globe } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";

function NavLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  if (!to || to === "#") {
    return <span className={className}>{children}</span>;
  }
  if (to.startsWith("http")) {
    return <a href={to} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <Link to={to} className={className}>{children}</Link>;
}
import { ClientOnly } from "../ClientOnly";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AuthModalLazy } from "@/modules/auth";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderTiersLieuxProps {
    header: Header;
}

export default function HeaderTiersLieux({ header }: HeaderTiersLieuxProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const { currentLocale, setLocale, availableLocales } = useLocalization();
    const navigate = useNavigate();
    const { me, api } = useCocolight();

    const nav = header.nav;

    const profilThumbImageUrl = useReactiveProperty<string>(me?.serverData, 'profilThumbImageUrl') ?? null;
    const name = useReactiveProperty<string>(me?.serverData, 'name') ?? null;
    const email = useReactiveProperty<string>(me?.serverData, 'email') ?? null;

    const [loginDialogOpen, setLoginDialogOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <header className={`${header.transparent ? "bg-transparent" : "bg-background"} rounded-b-2xl border-b border-border ${header.sticky ? "sticky top-0 z-50" : ""}`}>
            <nav className="container mx-auto py-3 sm:py-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center shrink-0 gap-2 sm:gap-3">
                        <Link to={header.path || "/"} className="flex items-center shrink-0">
                            {header.logo && (
                                <OptimizedImage
                                    src={`/${header.logo}`}
                                    alt={header.logoAlt ? t(header.logoAlt) : ""}
                                    width={207}
                                    height={48}
                                    className="h-6 xs:h-8 sm:h-9 w-auto max-w-28 xs:max-w-32 sm:max-w-40 object-contain"
                                />
                            )}
                        </Link>
                    </div>

                    {/* Menu desktop */}
                    <div className="hidden md:flex items-center space-x-1.5 text-sm font-medium ml-8 min-w-0">
                        {nav.map((item, idx) => {
                            const hasChildren = !!item.children?.length;

                            return (
                                <div key={idx} className="relative group">
                                    <button type="button" className="hover:text-primary text-foreground transition flex items-center gap-1 truncate w-auto cursor-pointer">
                                        {t(item.label)}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                    </button>


                                    {hasChildren && item.children && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-60">
                                            {t(item.label) === "Les lieux" ? (
                                                <div className="grid grid-cols-3 gap-8">
                                                    <Link to="/lieux" className="text-primary font-semibold flex items-center gap-2">
                                                        <div className="flex flex-col items-center justify-center border-r border-border pr-6">
                                                            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mb-4">
                                                                <svg className="w-8 h-8 text-accent-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                                </svg>
                                                            </div>
                                                            <h3 className="font-bold text-popover-foreground text-center mb-2">
                                                                {item.children[0] && t(item.children[0].label)}
                                                            </h3>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </div>
                                                    </Link>


                                                    <div className="col-span-2 grid grid-cols-2 gap-6">
                                                        {item.children.slice(1).map((sub, i) => (
                                                            <NavLink key={i} to={sub.path || '#'} className="block hover:bg-accent rounded-lg p-2 -m-2 transition">
                                                                <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                                <p className="text-muted-foreground text-xs leading-relaxed">
                                                                    {sub.description ? t(sub.description) : ""}
                                                                </p>
                                                            </NavLink>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path || '#'} className="block hover:bg-accent rounded-lg p-2 -m-2 transition">
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </NavLink>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path || '#'} className="block hover:bg-accent rounded-lg p-2 -m-2 transition">
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </NavLink>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden md:flex items-center space-x-4 text-sm shrink-0 ml-4">
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        <ClientOnly fallback={<div className="w-10 h-10" />}>
                            {() => <ToggleButtonTheme />}
                        </ClientOnly>

                        {header.utilities?.langSwitch && availableLocales.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-2">
                                        <Globe className="h-4 w-4" />
                                        {currentLocale.toUpperCase()}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {availableLocales.map(loc => (
                                        <DropdownMenuItem
                                            key={loc}
                                            onClick={() => setLocale(loc)}
                                            className={loc === currentLocale ? 'bg-accent' : ''}
                                        >
                                            {loc.toUpperCase()}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {header.utilities?.auth && (
                            <ClientOnly fallback={<Button variant="ghost" disabled size="sm">…</Button>}>
                                {() => (
                                    <>
                                        {me?.isConnected ? (
                                            <>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="bg-background rounded-full px-3 lg:px-4 py-1.5 flex items-center gap-1.5 lg:gap-2 hover:bg-secondary/80 transition text-sm lg:text-base">
                                                            {profilThumbImageUrl ? (
                                                                <OptimizedImage
                                                                    src={profilThumbImageUrl}
                                                                    alt={name || 'Profile'}
                                                                    width={32}
                                                                    className="w-6 h-6 lg:w-8 lg:h-8 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="font-medium rounded-full px-1.5 lg:px-2 py-0.5 lg:py-1 bg-background text-foreground text-[10px] lg:text-xs">
                                                                    {name ? name.substring(0, 2).toUpperCase() : 'CN'}
                                                                </div>
                                                            )}
                                                            <span className="text-muted-foreground hidden lg:inline">|</span>
                                                            <span className="font-medium text-foreground truncate max-w-17.5 lg:max-w-30">
                                                                {name || email || t('Mon compte')}
                                                            </span>
                                                            <ChevronDown className="w-3 h-3 text-foreground shrink-0" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56">
                                                        <DropdownMenuItem onClick={() => navigate(getProfileUrl())}>
                                                            <User className="mr-2 h-4 w-4" />
                                                            {t('Profil')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={handleLogout}>
                                                            <LogOut className="mr-2 h-4 w-4" />
                                                            {t('Se déconnecter')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </>
                                        ) : (
                                            <button
                                                className="bg-secondary rounded-full px-4 py-1.5 flex items-center gap-2 hover:bg-secondary/80 transition font-medium text-foreground"
                                                onClick={() => setLoginDialogOpen(true)}
                                            >
                                                <div className="font-medium rounded-full px-2 py-1 bg-background text-foreground text-xs">
                                                    CN
                                                </div>
                                                <span className="text-muted-foreground">|</span>
                                                {t('Se connecter')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </ClientOnly>
                        )}
                    </div>

                    <div className="md:hidden flex items-center gap-1 xs:gap-2 shrink-0 ml-3">
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}
                        <ClientOnly fallback={<div className="w-7 h-7 xs:w-8 xs:h-8" />}>
                            {() => <ToggleButtonTheme />}
                        </ClientOnly>
                        {header.utilities?.langSwitch && availableLocales.length > 1 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-0.5 xs:gap-1 px-1.5 xs:px-2 h-8">
                                        <Globe className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                                        <span className="text-xs xs:text-sm">{currentLocale.toUpperCase()}</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {availableLocales.map(loc => (
                                        <DropdownMenuItem
                                            key={loc}
                                            onClick={() => setLocale(loc)}
                                            className={loc === currentLocale ? 'bg-accent' : ''}
                                        >
                                            {loc.toUpperCase()}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-foreground hover:text-primary transition relative z-50 p-1.5 xs:p-2"
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-5 h-5 xs:w-6 xs:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5 xs:w-6 xs:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="md:hidden absolute left-0 right-0 top-full bg-popover text-popover-foreground border-b border-border shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto z-55">
                        <div className="px-4 py-4 space-y-4">
                            {nav.map((item, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="font-semibold text-foreground">{t(item.label)}</div>
                                    {item.children && (
                                        <div className="pl-4 space-y-2">
                                            {item.children.map((sub, i) => {
                                                const isExternal = (sub.path || '').startsWith('http');
                                                return isExternal ? (
                                                    <a
                                                        key={i}
                                                        href={sub.path || '#'}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block text-sm text-muted-foreground hover:text-primary transition"
                                                        onClick={() => setMobileMenuOpen(false)}
                                                    >
                                                        {t(sub.label)}
                                                    </a>
                                                ) : (
                                                    <Link
                                                        key={i}
                                                        to={sub.path || '#'}
                                                        className="block text-sm text-muted-foreground hover:text-primary transition"
                                                        onClick={() => setMobileMenuOpen(false)}
                                                    >
                                                        {t(sub.label)}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {header.utilities?.auth && (
                                <ClientOnly fallback={<div className="h-10" />}>
                                    {() => (
                                        <div className="pt-4 border-t border-border">
                                            {me?.isConnected ? (
                                                <div className="space-y-2">
                                                    <button
                                                        onClick={() => {
                                                            navigate(getProfileUrl());
                                                            setMobileMenuOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-secondary transition flex items-center gap-2"
                                                    >
                                                        <User className="w-4 h-4" />
                                                        {t('Profil')}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleLogout();
                                                            setMobileMenuOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-2 rounded-lg hover:bg-secondary transition flex items-center gap-2"
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                        {t('Se déconnecter')}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setLoginDialogOpen(true);
                                                        setMobileMenuOpen(false);
                                                    }}
                                                    className="w-full bg-secondary rounded-lg px-4 py-2 flex items-center justify-center gap-2 hover:bg-secondary/80 transition font-medium text-foreground"
                                                >
                                                    {t('Se connecter')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </ClientOnly>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            <AuthModalLazy open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
        </header>
    );
}