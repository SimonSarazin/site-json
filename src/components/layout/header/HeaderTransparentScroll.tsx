import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Header } from "@/types/site-schema";
import { ChevronDown } from "lucide-react";
import { IconOrSvg } from "@/components/ui/icon-or-svg";
import { ClientOnly } from "../ClientOnly";
import NavLink from "../NavLink";
import LangSwitch from "./LangSwitch";
import MobileMenuSheet from "./MobileMenuSheet";
import { AuthMenu } from "@/modules/auth";
import ToggleButtonTheme from "@/components/layout/ToggleButtonTheme";
import { PiggyBankHeaderButton } from "@/modules/cagnotte/components/PiggyBankHeaderButton";
import NotificationBell from "@/modules/notification/components/NotificationBell";
import CommandTriggerButton from "@/modules/commandPalette/components/CommandTriggerButton";
import { useScrollAware, useScrollToTopOnRouteChange, useNavItemActive } from "./useHeaderBehavior";

interface HeaderTransparentScrollProps {
    header: Header;
}

type HeaderNavItem = Header['nav'][number];

export default function HeaderTransparentScroll({ header }: HeaderTransparentScrollProps) {
    useLoadNamespace("components/layout");
    const t = useT("components/layout");
    const isNavItemActive = useNavItemActive();

    const isPathInsideNav = (items: HeaderNavItem[]): boolean => {
        return items.some(item => {
            if (isNavItemActive(item.path)) return true;
            if (item.children?.length) {
                return isPathInsideNav(item.children);
            }
            return false;
        });
    };

    useScrollToTopOnRouteChange();

    const isScrolled = useScrollAware();

    const shouldHideNav = Boolean(
        header.navVisibleOnlyForListedPages && !isPathInsideNav(header.nav)
    );

    const secondaryNavItems = header.secondaryNav ?? [];
    const shouldHideSecondaryNav = Boolean(
        secondaryNavItems.length > 0
        && header.secondaryNavVisibleOnlyForListedPages
        && !isPathInsideNav(secondaryNavItems)
    );

    const navItemsToDisplay = !shouldHideNav
        ? header.nav
        : (!shouldHideSecondaryNav ? secondaryNavItems : []);

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${(isScrolled || header.transparent === false) ? 'bg-background/90 backdrop-blur-md shadow-deep' : 'bg-transparent'}`}>
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    <NavLink to={header.path || "/"} className="flex items-center gap-3 cursor-pointer group">
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
                        {(header.logoTitle || header.logoSubtitle) && (
                            <span className="flex flex-col leading-tight">
                                {header.logoTitle && (
                                    <span className="text-lg font-bold text-foreground">{t(header.logoTitle)}</span>
                                )}
                                {header.logoSubtitle && (
                                    <span className="text-xs font-medium text-muted-foreground">{t(header.logoSubtitle)}</span>
                                )}
                            </span>
                        )}
                    </NavLink>

                    <div className="hidden md:flex items-center gap-8">
                        {navItemsToDisplay.map((item, idx) => {
                            const isActive = isNavItemActive(item.path);
                            const hasChildren = !!item.children?.length;
                            return (
                                <div key={idx} className="relative group">
                                    <NavLink
                                        to={item.path}
                                        ariaCurrent={isActive ? "page" : undefined}
                                        className={`transition-colors font-medium relative group ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'} ${hasChildren ? 'transition flex items-center gap-1' : ''}`}
                                    >
                                        {t(item.label)}
                                        {hasChildren && <ChevronDown className="w-3 h-3" />}
                                        <span className={`absolute -bottom-1 left-0 h-0.5 bg-primary transition-all ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
                                    </NavLink>
                                    {hasChildren && item.children && (
                                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-screen max-w-2xl bg-popover text-popover-foreground rounded-xl shadow-2xl border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-8 z-60">
                                            {item.children.length > 2 ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {item.children.map((sub, i) => (
                                                        <NavLink key={i} to={sub.path} className="block">
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
                                                        <NavLink key={i} to={sub.path} className="block">
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
                            <NavLink
                                to={header.urgenceButton.path}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/20 hover:bg-accent/30 text-primary transition-all group"
                            >
                                {header.urgenceButton.icon ? (
                                    <IconOrSvg
                                        value={header.urgenceButton.icon}
                                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                                    />
                                ) : null}
                                <span className="font-semibold text-sm">{t(header.urgenceButton.label)}</span>
                            </NavLink>
                        )}

                        {header.utilities?.notifications && <NotificationBell />}
                        {header.utilities?.search && <CommandTriggerButton />}

                        {header.utilities?.themeSwitch !== false && (
                            <ClientOnly fallback={<div className="w-10 h-10" />}>
                                {() => <ToggleButtonTheme />}
                            </ClientOnly>
                        )}

                        {header.utilities?.langSwitch && (
                            <LangSwitch triggerClassName="text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted" />
                        )}
                    </div>

                    <div className="hidden md:block">
                        {header.utilities?.auth && (
                            <AuthMenu layout="menu" density="compact" showDropdownHeader loginVariant="solid" loginClassName="shadow-glow" loginLabel={header.ctaButton?.label} />
                        )}
                        {!header.utilities?.auth && header.ctaButton && (
                            <NavLink
                                to={header.ctaButton.path}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md font-medium shadow-glow transition-all"
                            >
                                {t(header.ctaButton.label)}
                            </NavLink>
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
                            <MobileMenuSheet triggerClassName="text-muted-foreground hover:text-foreground">
                                {(close) => (
                                    <>
                                        {navItemsToDisplay.map((item, idx) => {
                                            const isActive = isNavItemActive(item.path);
                                            return (
                                                <NavLink
                                                    key={idx}
                                                    to={item.path}
                                                    ariaCurrent={isActive ? "page" : undefined}
                                                    className={`block py-2 transition-colors ${isActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                                                    onClick={close}
                                                >
                                                    {t(item.label)}
                                                </NavLink>
                                            );
                                        })}

                                        {header.urgenceButton && (
                                            <NavLink
                                                to={header.urgenceButton.path}
                                                className="w-full flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30 transition-colors"
                                                onClick={close}
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
                                            </NavLink>
                                        )}

                                        {header.utilities?.langSwitch && (
                                            <LangSwitch triggerClassName="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted" />
                                        )}

                                        {header.utilities?.auth && (
                                            <AuthMenu layout="stack" onAction={close} loginVariant="solid" loginClassName="shadow-glow" loginLabel={header.ctaButton?.label} />
                                        )}
                                        {!header.utilities?.auth && header.ctaButton && (
                                            <NavLink
                                                to={header.ctaButton.path}
                                                className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-center block"
                                                onClick={close}
                                            >
                                                {t(header.ctaButton.label)}
                                            </NavLink>
                                        )}
                                    </>
                                )}
                            </MobileMenuSheet>
                        )}
                    </div>
                </div>
            </div>

        </nav>
    );
}
