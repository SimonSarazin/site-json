import { useState } from "react";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { ChevronDown, User, LogOut, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { ClientOnly } from "../ClientOnly";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LoginForm from "@/components/auth/LoginForm";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";

interface HeaderTiersLieuxProps {
    header: Header;
}

export default function HeaderTiersLieux({ header }: HeaderTiersLieuxProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const navigate = useNavigate();
    const { me, api } = useCocolight();
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
        <header className={`${header.transparent ? "bg-transparent" : "bg-background"} rounded-b-2xl border-b border-border ${header.sticky ? "sticky top-0 z-30" : ""}`}>
            <nav className="container mx-auto py-3 sm:py-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                    <Link to={header.path || "/"} className="flex items-center space-x-2">
                        {header.logo && (
                            <img
                                src={`/${header.logo}`}
                                alt={header.logoAlt ? t(header.logoAlt) : ""}
                            />
                        )}
                    </Link>

                    {/* Menu desktop */}
                    <div className="hidden md:flex items-center space-x-1.5 text-sm font-medium">
                        {header.nav.map((item, idx) => {
                            const hasChildren = !!item.children?.length;

                            return (
                                <div key={idx} className="relative group">
                                    <Link to="#" className="hover:text-teal-500 text-foreground transition flex items-center gap-1 truncate w-auto">
                                        {t(item.label)}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                    </Link>


                                    {hasChildren && item.children && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-background rounded-xl shadow-2xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-50">
                                            {t(item.label) === "Les lieux" ? (
                                                <div className="grid grid-cols-3 gap-8">
                                                    <Link to="/lieux" className="text-teal-500 font-semibold flex items-center gap-2">
                                                        <div className="flex flex-col items-center justify-center border-r border-border pr-6">
                                                            <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mb-4">
                                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                            <div key={i}>
                                                                <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                                <p className="text-muted-foreground text-xs leading-relaxed">
                                                                    {sub.description ? t(sub.description) : ""}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <div key={i}>
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {item.children.map((sub, i) => (
                                                        <div key={i}>
                                                            <h4 className="font-bold text-popover-foreground mb-2">{t(sub.label)}</h4>
                                                            <p className="text-muted-foreground text-xs leading-relaxed">
                                                                {sub.description ? t(sub.description) : ""}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="hidden md:flex items-center space-x-4 text-sm">
                        <ClientOnly fallback={<div className="w-10 h-10" />}>
                            {() => <ToggleButtonTheme />}
                        </ClientOnly>

                        {header.utilities?.auth && (
                            <ClientOnly fallback={<Button variant="ghost" disabled size="sm">…</Button>}>
                                {() => (
                                    <>
                                        {me?.isConnected ? (
                                            <>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="bg-background rounded-full px-3 lg:px-4 py-1.5 flex items-center gap-1.5 lg:gap-2 hover:bg-secondary/80 transition text-sm lg:text-base">
                                                            {me.serverData?.profilThumbImageUrl ? (
                                                                <img
                                                                    src={me.serverData.profilThumbImageUrl}
                                                                    alt={me.serverData?.name || 'Profile'}
                                                                    className="w-6 h-6 lg:w-8 lg:h-8 rounded-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="font-medium rounded-full px-1.5 lg:px-2 py-0.5 lg:py-1 bg-background text-foreground text-[10px] lg:text-xs">
                                                                    {me.serverData?.name ? me.serverData.name.substring(0, 2).toUpperCase() : 'CN'}
                                                                </div>
                                                            )}
                                                            <span className="text-muted-foreground hidden lg:inline">|</span>
                                                            <span className="font-medium text-foreground truncate max-w-[70px] lg:max-w-[120px]">
                                                                {me.serverData?.name || me.serverData?.email || t('Mon compte')}
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
                                                <button className="text-foreground hover:text-teal-500 transition" onClick={() => navigate('/settings')}>
                                                    <Settings className="w-5 h-5" />
                                                </button>
                                                <button className="text-foreground hover:text-teal-500 transition" onClick={() => navigate(getProfileUrl())}>
                                                    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M21 15H22C22 14.4477 21.5523 14 21 14V15ZM21 21V22C21.5523 22 22 21.5523 22 21H21ZM1 21H0C0 21.5523 0.447715 22 1 22L1 21ZM1 15V14C0.447715 14 0 14.4477 0 15H1ZM6 8C5.44772 8 5 8.44772 5 9C5 9.55229 5.44772 10 6 10V9V8ZM11 10C11.5523 10 12 9.55229 12 9C12 8.44772 11.5523 8 11 8V9V10ZM13.24 7.05C13.599 7.4697 14.2302 7.51892 14.6499 7.15993C15.0696 6.80095 15.1189 6.1697 14.7599 5.75L13.9999 6.4L13.24 7.05ZM14.7599 12.25C15.1189 11.8303 15.0696 11.1991 14.6499 10.8401C14.2302 10.4811 13.599 10.5303 13.24 10.95L13.9999 11.6L14.7599 12.25ZM21 15H20V21H21H22V15H21ZM21 21V20H1V21V22H21V21ZM1 21H2V15H1H0V21H1ZM16.5556 15V16H21V15V14H16.5556V15ZM1 15V16H5.44444V15V14H1V15ZM19 9H18C18 12.866 14.866 16 11 16V17V18C15.9706 18 20 13.9706 20 9H19ZM11 17V16C7.13401 16 4 12.866 4 9H3H2C2 13.9706 6.02944 18 11 18V17ZM3 9H4C4 5.13401 7.13401 2 11 2V1V0C6.02944 0 2 4.02944 2 9H3ZM11 1V2C14.866 2 18 5.13401 18 9H19H20C20 4.02944 15.9706 0 11 0V1ZM6 9V10H11V9V8H6V9ZM13.9999 6.4L14.7599 5.75C14.0955 4.9733 13.2091 4.41884 12.22 4.16132L11.9681 5.12905L11.7161 6.09679C12.3096 6.25131 12.8414 6.58398 13.24 7.05L13.9999 6.4ZM11.9681 5.12905L12.22 4.16132C11.2309 3.90379 10.1867 3.95557 9.22792 4.30967L9.57437 5.24774L9.92083 6.1858C10.4961 5.97334 11.1226 5.94228 11.7161 6.09679L11.9681 5.12905ZM9.57437 5.24774L9.22792 4.30967C8.26915 4.66378 7.44193 5.30319 6.85768 6.14181L7.67818 6.71344L8.49869 7.28508C8.84924 6.78192 9.34557 6.39827 9.92083 6.1858L9.57437 5.24774ZM7.67818 6.71344L6.85768 6.14181C6.27343 6.98042 5.96021 7.97793 5.96021 9H6.96021H7.96021C7.96021 8.38676 8.14814 7.78825 8.49869 7.28508L7.67818 6.71344ZM6.96021 9H5.96021C5.96021 10.0221 6.27343 11.0196 6.85768 11.8582L7.67818 11.2866L8.49869 10.7149C8.14814 10.2118 7.96021 9.61324 7.96021 9H6.96021ZM7.67818 11.2866L6.85768 11.8582C7.44193 12.6968 8.26915 13.3362 9.22792 13.6903L9.57437 12.7523L9.92083 11.8142C9.34557 11.6017 8.84924 11.2181 8.49869 10.7149L7.67818 11.2866ZM9.57437 12.7523L9.22792 13.6903C10.1867 14.0444 11.2309 14.0962 12.22 13.8387L11.9681 12.8709L11.7161 11.9032C11.1226 12.0577 10.4961 12.0267 9.92083 11.8142L9.57437 12.7523ZM11.9681 12.8709L12.22 13.8387C13.2091 13.5812 14.0955 13.0267 14.7599 12.25L13.9999 11.6L13.24 10.95C12.8414 11.416 12.3096 11.7487 11.7161 11.9032L11.9681 12.8709Z" fill="currentColor"></path>
                                                    </svg>
                                                </button>
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

                    <div className="md:hidden flex items-center gap-2">
                        <ClientOnly fallback={<div className="w-8 h-8" />}>
                            {() => <ToggleButtonTheme />}
                        </ClientOnly>
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-foreground hover:text-teal-500 transition relative z-50 p-2"
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {mobileMenuOpen && (
                    <div className="md:hidden absolute left-0 right-0 top-full bg-background border-b border-border shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto z-40">
                        <div className="px-4 py-4 space-y-4">
                            {header.nav.map((item, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="font-semibold text-foreground">{t(item.label)}</div>
                                    {item.children && (
                                        <div className="pl-4 space-y-2">
                                            {item.children.map((sub, i) => (
                                                <Link
                                                    key={i}
                                                    to={sub.path || '#'}
                                                    className="block text-sm text-muted-foreground hover:text-teal-500 transition"
                                                    onClick={() => setMobileMenuOpen(false)}
                                                >
                                                    {t(sub.label)}
                                                </Link>
                                            ))}
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

            <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border">
                    <DialogTitle className="sr-only">{t('Se connecter')}</DialogTitle>
                    <LoginForm
                        onSuccess={() => setLoginDialogOpen(false)}
                        hideBackButton={true}
                    />
                </DialogContent>
            </Dialog>
        </header>
    );
}