import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { useCocolight } from "@/hooks/useCocolight";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import type { Header } from "@/types/site-schema";
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
import LoginForm from "@/components/auth/LoginForm";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import { ChevronDown, User, LogOut, Globe, Menu, X } from "lucide-react";

interface HeaderJuliePotVinProps {
    header: Header;
}

export default function HeaderJuliePotVin({ header }: HeaderJuliePotVinProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const { currentLocale, setLocale, availableLocales } = useLocalization();
    const navigate = useNavigate();
    const { me, api } = useCocolight();

    const [loginDialogOpen, setLoginDialogOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const profilThumbImageUrl = useReactiveProperty<string>(me?.serverData, 'profilThumbImageUrl') ?? null;
    const name = useReactiveProperty<string>(me?.serverData, 'name') ?? null;
    const email = useReactiveProperty<string>(me?.serverData, 'email') ?? null;

    useEffect(() => {
        const body = document.body;
        body.classList.remove("opacity-0", "translate-y-10");
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
        <>
            <nav className="fixed top-0 left-0 right-0 z-40 nav-sticky border-b border-gray-100 bg-background/90 backdrop-blur-sm transition-colors duration-300">
                <div className="max-w-[1900px] mx-auto px-8 md:px-12 lg:px-16 py-5 flex justify-between items-center">

                    <div className="flex items-center gap-3">
                        <Link to={header.path || "/"} className="flex items-center gap-3 group">
                             {header.logo ? (
                                <img src={header.logo} alt={header.logoAlt ? t(header.logoAlt) : "Logo"} className="w-8 h-8 object-contain" />
                            ) : header.logoIcon ? (
                                <div className="w-8 h-8 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: header.logoIcon }} />
                            ) : (
                                <img src="images/juliePotVin/monogramme.svg" alt="Monogramme" className="w-8 h-8" />
                            )}
                            
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
                            <ClientOnly fallback={<div className="w-20" />}>
                                {() => (
                                    <>
                                        {me?.isConnected ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="flex items-center gap-2 hover:text-primary transition-colors text-foreground">
                                                        {profilThumbImageUrl ? (
                                                            <img
                                                                src={profilThumbImageUrl}
                                                                alt={name || 'Profile'}
                                                                className="w-6 h-6 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <User className="w-4 h-4" />
                                                        )}
                                                        <span className="truncate max-w-[100px] normal-case tracking-normal">
                                                            {name || email || t('Mon compte')}
                                                        </span>
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
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
                                        ) : (
                                            <button
                                                className="hover:text-primary transition-colors text-foreground"
                                                onClick={() => setLoginDialogOpen(true)}
                                            >
                                                {header.ctaButton ? t(header.ctaButton.label) : t('Connexion')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </ClientOnly>
                        )}
                    </div>

                    <div className="md:hidden flex items-center gap-4">
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
                             <ClientOnly fallback={null}>
                                {() => (
                                    <>
                                        {me?.isConnected ? (
                                            <>
                                                <button 
                                                    onClick={() => { navigate(getProfileUrl()); setMobileMenuOpen(false); }}
                                                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] hover:text-primary transition-colors w-full text-left text-foreground"
                                                >
                                                    <User className="w-4 h-4" /> {t('Profil')}
                                                </button>
                                                <button 
                                                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] hover:text-primary transition-colors w-full text-left text-foreground"
                                                >
                                                    <LogOut className="w-4 h-4" /> {t('Se déconnecter')}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                className="block text-sm font-bold uppercase tracking-[0.15em] hover:text-primary transition-colors w-full text-left text-foreground"
                                                onClick={() => { setLoginDialogOpen(true); setMobileMenuOpen(false); }}
                                            >
                                                {header.ctaButton ? t(header.ctaButton.label) : t('Connexion')}
                                            </button>
                                        )}
                                    </>
                                )}
                            </ClientOnly>
                        )}
                    </div>
                )}
            </nav>

            <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogTitle className="sr-only">{t('Se connecter')}</DialogTitle>
                    <LoginForm
                        onSuccess={() => setLoginDialogOpen(false)}
                        hideBackButton={true}
                    />
                </DialogContent>
            </Dialog>
        </>
    )
}
