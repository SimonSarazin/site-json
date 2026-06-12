import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { useLocation } from "react-router";
import { useCocolight } from "@/hooks/useCocolight";
import { useScrollAware, useScrollToTopOnRouteChange, useNavItemActive } from "./useHeaderBehavior";
import NavLink from "../NavLink";
import LangSwitch from "./LangSwitch";
import MobileMenuSheet from "./MobileMenuSheet";
import MobileMenuBrand from "./MobileMenuBrand";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import { AuthMenu } from "@/modules/auth";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";

interface HeaderTransparentDarkProps {
    header: Header;
}

export default function HeaderTransparentDark({ header }: HeaderTransparentDarkProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const location = useLocation();
    const { entity } = useCocolight();

    const isNavItemActive = useNavItemActive();

    useScrollToTopOnRouteChange();

    const isScrolled = useScrollAware();

    // Header bg: dark purple, transparent on homepage hero only
    const headerBg =
        (isScrolled || location.pathname !== "/")
            ? "bg-header-bar backdrop-blur-sm shadow-lg"
            : "bg-transparent";
    
    const dataCostum = entity?.serverData?.costum as Record<string, unknown> | undefined;
    // Override logo/titre depuis l'entité costum — UNIQUEMENT si la config l'active
    // (`header.entityLogoOverride`). Sinon, comportement 100% piloté par la config.
    const useEntityOverride = header.entityLogoOverride && !!dataCostum?.transparentCommune;

    // Variables locales pour logo et logoTitle (sans modifier les props)
    const logo = useEntityOverride
        ? "https://www.communecter.org" + (dataCostum?.logo as string || dataCostum?.bannerLogoUrl as string) || header.logo || ""
        : header.logo;

    const logoTitle = useEntityOverride
        ? { fr: entity?.serverData?.name || "Votre ville", en: entity?.serverData?.name || "Your city" }
        : header.logoTitle;
    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo */}
                    <NavLink
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
                    </NavLink>

                    {/* Desktop navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {header.nav?.map((item, idx) => {
                            const to = item.path ?? item.href;
                            if (!to) return null;
                            const active = !!item.path && isNavItemActive(item.path);
                            return (
                                <NavLink
                                    key={idx}
                                    to={to}
                                    ariaCurrent={active ? "page" : undefined}
                                    className={`
                                        px-3 py-2 text-base font-medium rounded-md transition-all duration-200
                                        ${active
                                            ? "text-white bg-white/20"
                                            : "text-white/80 hover:text-white hover:bg-white/10"
                                        }
                                    `}
                                >
                                    {t(item.label)}
                                </NavLink>
                            );
                        })}
                    </div>

                    {/* Right utilities */}
                    <div className="flex items-center gap-2">
                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {/* Lang switcher */}
                        {header.utilities?.langSwitch && <LangSwitch tone="onColor" />}

                        {/* Auth — widget partagé (avatar/dropdown ou bouton login → modal global) */}
                        {header.utilities?.auth && (
                            <AuthMenu
                                layout="menu"
                                tone="onColor"
                                density="compact"
                                showName={false}
                                showChevron={false}
                                loginVariant="outline"
                                loginLabel={header.ctaButton?.label}
                                loginClassName="text-white border-white/40 hover:bg-white/10 hover:border-white/70 bg-transparent text-xs sm:text-sm"
                            />
                        )}

                        {/* Mobile menu */}
                        <MobileMenuSheet
                            tone="onColor"
                            contentClassName="bg-header-bar text-white border-white/10"
                            brand={(close) => <MobileMenuBrand header={header} tone="onColor" onNavigate={close} />}
                        >
                            {(close) =>
                                header.nav?.map((item, idx) => {
                                    const to = item.path ?? item.href;
                                    if (!to) return null;
                                    const active = !!item.path && isNavItemActive(item.path);
                                    return (
                                        <NavLink
                                            key={idx}
                                            to={to}
                                            onClick={close}
                                            ariaCurrent={active ? "page" : undefined}
                                            className={`
                                                block px-3 py-2 rounded-md text-sm font-medium transition-all
                                                ${active
                                                    ? "text-white bg-white/20"
                                                    : "text-white/80 hover:text-white hover:bg-white/10"
                                                }
                                            `}
                                        >
                                            {t(item.label)}
                                        </NavLink>
                                    );
                                })
                            }
                        </MobileMenuSheet>
                    </div>
                </div>
            </div>
        </nav>
    );
}
